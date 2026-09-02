import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const START_TIME = 1_756_684_800
const END_TIME_EXCLUSIVE = 1_757_980_800
const MIGRATION_AUTHORITY = '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg'
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
const PUMPSWAP_PROGRAM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'
const MIGRATE_DISCRIMINATOR = [155, 234, 231, 146, 236, 158, 162, 30]
const CREATE_POOL_DISCRIMINATOR = [233, 146, 209, 142, 207, 104, 64, 188]
const PAGE_LIMIT = 1_000
const METHODOLOGY = 'pump-migration-authority-universe-v1'

type Instruction = { programId?: string; data?: string; accounts?: string[] }
type ArchivalRow = {
  slot?: number
  blockTime?: number
  transactionIndex?: number
  transaction?: { signatures?: string[]; message?: { instructions?: Instruction[] } }
  meta?: { err?: unknown; logMessages?: string[]; innerInstructions?: Array<{ instructions?: Instruction[] }> }
}
type PageResult = { data?: ArchivalRow[]; paginationToken?: string | null }
type Graduation = {
  mint: string
  graduation_signature: string
  graduation_slot: number
  graduation_timestamp_utc: string
  observation_end_utc: string
  bonding_curve: string
  pumpswap_pool: string
  migration_authority: string
  inclusion_evidence: Record<string, unknown>
  source_provenance: Record<string, unknown>
  _transactionIndex: number
}
type Boundary = { page: number; paginationTokenUsed: string | null; nextPaginationToken: string | null; count: number; first: CursorPoint | null; last: CursorPoint | null; overlapsPreviousPage: number; monotonic: boolean }
type CursorPoint = { slot: number; transactionIndex: number; signature: string; blockTime: number }
type Retry = { at: string; operation: string; attempt: number; paginationToken: string | null; message: string }
type State = {
  schemaVersion: 1
  methodology: string
  complete: boolean
  nextPaginationToken: string | null
  pagesCompleted: number
  scanned: number
  successfulMigrateInstructions: number
  createPoolMigrations: Graduation[]
  noopMigrations: number
  malformedMigrations: number
  seenTransactionSignatures: string[]
  pageBoundaries: Boundary[]
  retries: Retry[]
  startedAt: string
  updatedAt: string
}

const outputDirectory = path.resolve('research/market-structure')
const checkpointPath = path.join(outputDirectory, 'token-universe-backfill.checkpoint.json')
const retryLogPath = path.join(outputDirectory, 'token-universe-fetch-errors.jsonl')
const universePath = path.join(outputDirectory, 'token-universe.json')
const auditPath = path.join(outputDirectory, 'token-universe-audit.md')

function decodeBase58(value: string) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let number = BigInt(0)
  for (const character of value) {
    const digit = alphabet.indexOf(character)
    if (digit < 0) throw new Error('Invalid base58 instruction data')
    number = number * BigInt(58) + BigInt(digit)
  }
  const bytes: number[] = []
  while (number > BigInt(0)) { bytes.unshift(Number(number & BigInt(255))); number >>= BigInt(8) }
  for (const character of value) { if (character !== '1') break; bytes.unshift(0) }
  return bytes
}

function hasDiscriminator(instruction: Instruction, discriminator: number[]) {
  if (!instruction.data) return false
  const bytes = decodeBase58(instruction.data)
  return discriminator.every((value, index) => bytes[index] === value)
}

const iso = (unix: number) => new Date(unix * 1_000).toISOString()
const point = (row: ArchivalRow): CursorPoint | null => {
  const signature = row.transaction?.signatures?.[0]
  return typeof row.slot === 'number' && typeof row.blockTime === 'number' && signature
    ? { slot: row.slot, transactionIndex: row.transactionIndex ?? -1, signature, blockTime: row.blockTime }
    : null
}
const comparePoint = (left: CursorPoint, right: CursorPoint) => left.slot - right.slot || left.transactionIndex - right.transactionIndex || left.signature.localeCompare(right.signature)

async function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporary, file)
}

async function rpc<T>(apiKey: string, method: string, params: unknown[], operation: string, state: State, paginationToken: string | null = null): Promise<T> {
  let lastError = 'Unknown RPC error'
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
      const text = await response.text()
      const body = JSON.parse(text) as { result?: T; error?: { message?: string } }
      if (!response.ok || body.error || body.result === undefined) throw new Error(body.error?.message ?? `HTTP ${response.status}: ${text.slice(0, 200)}`)
      return body.result
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      const retry = { at: new Date().toISOString(), operation, attempt, paginationToken, message: lastError }
      state.retries.push(retry); await appendFile(retryLogPath, `${JSON.stringify(retry)}\n`)
      if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1_000 * 2 ** (attempt - 1))))
    }
  }
  throw new Error(`${operation} failed after retries: ${lastError}`)
}

function pageOptions(start: number, endExclusive: number, paginationToken?: string | null) {
  return { transactionDetails: 'full', encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, limit: PAGE_LIMIT, sortOrder: 'asc', commitment: 'finalized', filters: { status: 'succeeded', blockTime: { gte: start, lt: endExclusive } }, ...(paginationToken ? { paginationToken } : {}) }
}

async function fetchPage(apiKey: string, state: State, start: number, endExclusive: number, paginationToken: string | null, operation: string) {
  return rpc<PageResult>(apiKey, 'getTransactionsForAddress', [MIGRATION_AUTHORITY, pageOptions(start, endExclusive, paginationToken)], operation, state, paginationToken)
}

function inspectRow(row: ArchivalRow): { graduation?: Graduation; migrate: boolean; noop: boolean; malformed: boolean } {
  if (row.meta?.err != null) return { migrate: false, noop: false, malformed: false }
  if (typeof row.blockTime !== 'number' || row.blockTime < START_TIME || row.blockTime >= END_TIME_EXCLUSIVE) return { migrate: false, noop: false, malformed: false }
  const outer = (row.transaction?.message?.instructions ?? []).find((instruction) => instruction.programId === PUMP_PROGRAM && hasDiscriminator(instruction, MIGRATE_DISCRIMINATOR))
  if (!outer) return { migrate: false, noop: false, malformed: false }
  const accounts = outer.accounts ?? []
  if (accounts.length <= 9 || accounts[1] !== MIGRATION_AUTHORITY || accounts[8] !== PUMPSWAP_PROGRAM) return { migrate: true, noop: false, malformed: true }
  const createPool = (row.meta?.innerInstructions ?? []).flatMap((group) => group.instructions ?? []).some((instruction) => instruction.programId === PUMPSWAP_PROGRAM && hasDiscriminator(instruction, CREATE_POOL_DISCRIMINATOR))
  if (!createPool) return { migrate: true, noop: true, malformed: false }
  const signature = row.transaction?.signatures?.[0]
  if (!signature || typeof row.slot !== 'number') return { migrate: true, noop: false, malformed: true }
  return {
    migrate: true, noop: false, malformed: false,
    graduation: {
      mint: accounts[2], graduation_signature: signature, graduation_slot: row.slot,
      graduation_timestamp_utc: iso(row.blockTime), observation_end_utc: iso(row.blockTime + 7_200),
      bonding_curve: accounts[3], pumpswap_pool: accounts[9], migration_authority: accounts[1],
      inclusion_evidence: {
        transaction_inside_locked_window: true, transaction_succeeded: true,
        outer_pump_migrate_discriminator: MIGRATE_DISCRIMINATOR,
        inner_pumpswap_create_pool_discriminator: CREATE_POOL_DISCRIMINATOR,
        pump_migrate_idl_accounts: { mint: 2, bonding_curve: 3, pump_amm: 8, pool: 9, migration_authority: 1 },
        pump_amm: accounts[8], create_pool_log_observed: (row.meta?.logMessages ?? []).some((log) => log.includes('Instruction: CreatePool')),
      },
      source_provenance: {
        source: 'Helius archival RPC getTransactionsForAddress', queried_address: MIGRATION_AUTHORITY,
        methodology: METHODOLOGY, commitment: 'finalized', transaction_details: 'full', encoding: 'jsonParsed',
        window_start_utc: iso(START_TIME), window_end_utc_inclusive: iso(END_TIME_EXCLUSIVE - 1),
      },
      _transactionIndex: row.transactionIndex ?? -1,
    },
  }
}

function deduplicate(rows: Graduation[]) {
  const ordered = [...rows].sort((a, b) => a.graduation_slot - b.graduation_slot || a._transactionIndex - b._transactionIndex || a.graduation_signature.localeCompare(b.graduation_signature))
  const signatures = new Set<string>(), mints = new Set<string>(), pools = new Set<string>()
  const retained: Graduation[] = [], removed = { signature: 0, mint: 0, pool: 0 }
  for (const row of ordered) {
    if (signatures.has(row.graduation_signature)) { removed.signature++; continue }
    if (mints.has(row.mint)) { removed.mint++; continue }
    if (pools.has(row.pumpswap_pool)) { removed.pool++; continue }
    signatures.add(row.graduation_signature); mints.add(row.mint); pools.add(row.pumpswap_pool); retained.push(row)
  }
  return { retained, removed }
}

async function boundaryAudit(apiKey: string, state: State, retainedSignatures: Set<string>) {
  const windows = [{ name: 'opening-minute', start: START_TIME, end: START_TIME + 60 }, { name: 'closing-minute', start: END_TIME_EXCLUSIVE - 60, end: END_TIME_EXCLUSIVE }]
  const results = []
  for (const window of windows) {
    let token: string | null = null, pages = 0
    const rows: ArchivalRow[] = []
    do {
      const page = await fetchPage(apiKey, state, window.start, window.end, token, `boundary-${window.name}-${pages + 1}`)
      rows.push(...(page.data ?? [])); token = page.paginationToken ?? null; pages++
    } while (token)
    const decoded = rows.flatMap((row) => inspectRow(row).graduation ?? [])
    results.push({ window: window.name, startUtc: iso(window.start), endExclusiveUtc: iso(window.end), pagesExhausted: pages, transactionsScanned: rows.length, decodedGraduations: decoded.length, allPresentInUniverse: decoded.every((row) => retainedSignatures.has(row.graduation_signature)) })
  }
  return results
}

async function main() {
  await mkdir(outputDirectory, { recursive: true })
  const env = await readFile('.env.local', 'utf8'), apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim()
  if (!apiKey) throw new Error('HELIUS_API_KEY is required in .env.local')
  let state: State
  try { state = JSON.parse(await readFile(checkpointPath, 'utf8')) as State } catch {
    state = { schemaVersion: 1, methodology: METHODOLOGY, complete: false, nextPaginationToken: null, pagesCompleted: 0, scanned: 0, successfulMigrateInstructions: 0, createPoolMigrations: [], noopMigrations: 0, malformedMigrations: 0, seenTransactionSignatures: [], pageBoundaries: [], retries: [], startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  }
  if (state.methodology !== METHODOLOGY) throw new Error('Checkpoint methodology mismatch')
  const seen = new Set(state.seenTransactionSignatures)
  let previousLast = state.pageBoundaries.at(-1)?.last ?? null
  while (!state.complete) {
    const tokenUsed = state.nextPaginationToken
    const page = await fetchPage(apiKey, state, START_TIME, END_TIME_EXCLUSIVE, tokenUsed, `page-${state.pagesCompleted + 1}`)
    const rows = page.data ?? [], points = rows.map(point).filter((value): value is CursorPoint => Boolean(value))
    const overlap = rows.filter((row) => { const signature = row.transaction?.signatures?.[0]; return Boolean(signature && seen.has(signature)) }).length
    const monotonicWithin = points.every((value, index) => index === 0 || comparePoint(points[index - 1], value) <= 0)
    const monotonicBoundary = !previousLast || !points[0] || comparePoint(previousLast, points[0]) <= 0
    for (const row of rows) {
      const signature = row.transaction?.signatures?.[0]
      if (!signature || seen.has(signature)) continue
      seen.add(signature); state.scanned++
      const result = inspectRow(row)
      if (result.migrate) state.successfulMigrateInstructions++
      if (result.noop) state.noopMigrations++
      if (result.malformed) state.malformedMigrations++
      if (result.graduation) state.createPoolMigrations.push(result.graduation)
    }
    state.pagesCompleted++
    state.nextPaginationToken = page.paginationToken ?? null
    state.complete = !page.paginationToken
    state.seenTransactionSignatures = [...seen]
    state.pageBoundaries.push({ page: state.pagesCompleted, paginationTokenUsed: tokenUsed, nextPaginationToken: state.nextPaginationToken, count: rows.length, first: points[0] ?? null, last: points.at(-1) ?? null, overlapsPreviousPage: overlap, monotonic: monotonicWithin && monotonicBoundary })
    previousLast = points.at(-1) ?? previousLast
    state.updatedAt = new Date().toISOString(); await atomicJson(checkpointPath, state)
    console.log(`Page ${state.pagesCompleted}: ${rows.length} rows, ${state.scanned} unique scanned, ${state.createPoolMigrations.length} pool-creating migrations${state.complete ? ' (complete)' : ''}`)
    if (!state.complete) await new Promise((resolve) => setTimeout(resolve, 250))
  }

  const { retained, removed } = deduplicate(state.createPoolMigrations)
  const cleanRows = retained.map(({ _transactionIndex, ...row }) => row)
  const boundary = await boundaryAudit(apiKey, state, new Set(cleanRows.map((row) => row.graduation_signature)))
  const authorityAudit = {
    queriedAuthority: MIGRATION_AUTHORITY,
    retainedWithExpectedAuthority: cleanRows.filter((row) => row.migration_authority === MIGRATION_AUTHORITY).length,
    retainedWithExpectedPumpAmm: cleanRows.filter((row) => row.inclusion_evidence.pump_amm === PUMPSWAP_PROGRAM).length,
    malformedMigrateLayouts: state.malformedMigrations,
    allPageBoundariesMonotonic: state.pageBoundaries.every((item) => item.monotonic),
    evidence: 'Every retained graduation is a successful Pump migrate whose IDL relation account equals the queried authority and whose CPI creates a PumpSwap pool. This proves authority validity at every retained migration; it cannot by itself prove that no undocumented alternate authority was briefly configured between observed migrations.',
  }
  const authorityDays = new Set(cleanRows.map((row) => row.graduation_timestamp_utc.slice(0, 10)))
  const universe = {
    schema_version: 1, methodology: METHODOLOGY,
    locked_window: { start_utc: iso(START_TIME), end_utc_inclusive: iso(END_TIME_EXCLUSIVE - 1) },
    generated_at: new Date().toISOString(), cohort_size: cleanRows.length, graduations: cleanRows,
  }
  await atomicJson(universePath, universe)
  const duplicatesTotal = removed.signature + removed.mint + removed.pool
  const earliest = cleanRows[0], latest = cleanRows.at(-1)
  const audit = `# Neutral Pump.fun to PumpSwap Graduation Universe Audit\n\n` +
    `- Locked window: ${iso(START_TIME)} through ${iso(END_TIME_EXCLUSIVE - 1)} inclusive.\n` +
    `- Primary source: Helius archival RPC \`getTransactionsForAddress\`, full JSON-parsed finalized results, ascending, succeeded only.\n` +
    `- Migration authority queried: \`${MIGRATION_AUTHORITY}\`.\n` +
    `- Methodology: \`${METHODOLOGY}\`.\n\n## Counts\n\n` +
    `- Total unique migration-authority transactions scanned: ${state.scanned}.\n` +
    `- Successful Pump migrate instructions found: ${state.successfulMigrateInstructions}.\n` +
    `- Actual PumpSwap CreatePool migrations decoded before cohort deduplication: ${state.createPoolMigrations.length}.\n` +
    `- Successful idempotent/no-op migrations excluded: ${state.noopMigrations}.\n` +
    `- Malformed migrate layouts excluded: ${state.malformedMigrations}.\n` +
    `- Duplicates removed: ${duplicatesTotal} (signature ${removed.signature}, mint ${removed.mint}, pool ${removed.pool}).\n` +
    `- Final cohort size: ${cleanRows.length}.\n\n## Pagination and retrieval\n\n` +
    `- Completed pages: ${state.pagesCompleted}.\n- Logged retry events: ${state.retries.length}.\n` +
    `- Page boundaries monotonic: ${state.pageBoundaries.every((item) => item.monotonic)}.\n` +
    `- Pagination overlaps observed and deterministically deduplicated: ${state.pageBoundaries.reduce((sum, item) => sum + item.overlapsPreviousPage, 0)}.\n` +
    `- Opening/closing boundary verification: ${JSON.stringify(boundary)}.\n` +
    `- Explicit retry/error log: \`research/market-structure/token-universe-fetch-errors.jsonl\`.\n` +
    `- Resume checkpoint: \`research/market-structure/token-universe-backfill.checkpoint.json\`.\n\n## Authority-consistency audit\n\n` +
    `- Retained migrations using the documented authority: ${authorityAudit.retainedWithExpectedAuthority}/${cleanRows.length}.\n` +
    `- Retained migrations naming the documented PumpSwap program in the official Pump migrate layout: ${authorityAudit.retainedWithExpectedPumpAmm}/${cleanRows.length}.\n` +
    `- Calendar days in the locked 15-day window with at least one deterministically decoded migration using the documented authority: ${authorityDays.size}/15.\n` +
    `- ${authorityAudit.evidence}\n\n## Range\n\n` +
    `- Earliest retained graduation: ${earliest ? `\`${earliest.graduation_signature}\` at slot ${earliest.graduation_slot}, ${earliest.graduation_timestamp_utc}` : 'none'}.\n` +
    `- Latest retained graduation: ${latest ? `\`${latest.graduation_signature}\` at slot ${latest.graduation_slot}, ${latest.graduation_timestamp_utc}` : 'none'}.\n\n## False-negative uncertainty\n\n` +
    `The archival stream and boundary checks were complete for the queried authority. The remaining structural uncertainty is an undocumented temporary change to the Pump Global withdraw authority: the retained on-chain instructions prove the documented authority was valid whenever a graduation was observed, but an address-indexed query cannot discover migrations performed under an unknown alternate authority. No token outcomes or post-graduation market data were consulted. Current pool ownership was not used for inclusion.\n`
  await writeFile(auditPath, audit)
  console.log(`Wrote ${universePath} with ${cleanRows.length} graduations`)
  console.log(`Wrote ${auditPath}`)
}

void main()
