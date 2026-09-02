import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collectComputeBudget, deriveExecutionState, derivePriorityFeeLamports, findExplicitProgramError, type ReceiptRpcInstruction, type ReceiptRpcTransaction } from '../lib/receipt-evidence.ts'
import { buildEpisode, DEFAULT_SAMPLING, METHODOLOGY_VERSION, type ResearchRecord } from './market-structure-core.ts'

type CohortRow = { mint: string; stable_hash_fnv1a_32?: number; graduation_slot: number; graduation_timestamp_utc: string; observation_end_utc: string }
type AccountKey = string | { pubkey?: string; signer?: boolean }
type Instruction = ReceiptRpcInstruction
type Block = { blockTime?: number | null; transactions?: Array<{ transaction?: { signatures?: string[]; message?: { accountKeys?: AccountKey[] } } }> }
type RpcTx = ReceiptRpcTransaction & { slot?: number; blockTime?: number | null; meta?: ReceiptRpcTransaction['meta'] & { innerInstructions?: Array<{ instructions?: Instruction[] }> }; transaction?: ReceiptRpcTransaction['transaction'] & { message?: { accountKeys?: AccountKey[]; instructions?: Instruction[] } } }
type SampleEntry = { signature: string; metadata: { samplingPhase: number; samplingSlice: number; sampledBlockSlot: number } }
type Slice = { phase: number; slice: number; requestedCenterSlot: number; sampledBlockSlot: number; eligible: number; retained: number }
type RequestStats = { attempts: number; successes: number; failures: number; http429: number; latencyMs: number[] }
type TransportMetrics = { configuredMaxRps: number; effectiveRpsAtStart: number; effectiveRpsAtEnd: number; peakInFlight: number; requestsBySecond: Record<string, number>; requestsByMinute: Record<string, number>; methods: Record<string, RequestStats>; retryCountsByRequest: Array<{ request: string; method: string; retries: number; terminal: string }>; unresolvedRequests: Array<{ request: string; method: string; attempts: number; message: string }> }
type Counters = { rpcMethodCalls: number; httpRequests: number; estimatedCredits: number; retries: number; errors: Array<{ operation: string; method: string; attempt: number; message: string }>; transport: TransportMetrics }
type TokenState = { endSlot?: number; slices: Slice[]; transactions: SampleEntry[]; receipts: Record<string, { transaction?: RpcTx; error?: string }>; counters: Counters; startedAt: string }

const inputPath = path.resolve(process.argv[2] ?? 'research/market-structure/pilot-50.json')
const outputRoot = path.resolve(process.argv[3] ?? 'research/market-structure/pilot-50')
const progressFileName = process.argv[4] ?? 'cohort-progress.json'
const pilotOutputRoot = path.resolve('research/market-structure/pilot-50')
const RPC_METHODS_PER_BATCH = 10
const DEFAULT_MAX_RPS = 1.5
const MIN_RPS = .25
const CLEAN_REQUESTS_FOR_RECOVERY = 60
const RETRY_ATTEMPTS = 12
let scheduler: GlobalRequestScheduler
const keyAddress = (key: AccountKey | undefined) => typeof key === 'string' ? key : key?.pubkey
function hash(value: string) { let current = 2_166_136_261; for (let index = 0; index < value.length; index++) { current ^= value.charCodeAt(index); current = Math.imul(current, 16_777_619) }; return current >>> 0 }
async function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`)
  let lastError: unknown
  for (let attempt = 1; attempt <= 8; attempt++) {
    try { await rename(temporary, file); return } catch (error) {
      lastError = error
      if (!(error instanceof Error) || !/EPERM|EBUSY|EACCES/.test(error.message) || attempt === 8) break
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
    }
  }
  throw lastError
}

function createCounters(maxRps = DEFAULT_MAX_RPS): Counters {
  return { rpcMethodCalls: 0, httpRequests: 0, estimatedCredits: 0, retries: 0, errors: [], transport: { configuredMaxRps: maxRps, effectiveRpsAtStart: maxRps, effectiveRpsAtEnd: maxRps, peakInFlight: 0, requestsBySecond: {}, requestsByMinute: {}, methods: {}, retryCountsByRequest: [], unresolvedRequests: [] } }
}
function sleep(milliseconds: number) { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }
function normalizeCounters(value: Partial<Counters> | undefined, maxRps: number): Counters {
  const fresh = createCounters(maxRps), current = value ?? {}
  return { ...fresh, ...current, errors: current.errors ?? [], transport: { ...fresh.transport, ...(current.transport ?? {}), methods: current.transport?.methods ?? {}, requestsBySecond: current.transport?.requestsBySecond ?? {}, requestsByMinute: current.transport?.requestsByMinute ?? {}, retryCountsByRequest: current.transport?.retryCountsByRequest ?? [], unresolvedRequests: current.transport?.unresolvedRequests ?? [] } }
}

class GlobalRequestScheduler {
  private effectiveRps: number
  private nextPermitAt = 0
  private inFlight = 0
  private cleanRequests = 0
  readonly configuredMaxRps: number
  constructor(configuredMaxRps: number) { this.configuredMaxRps = configuredMaxRps; this.effectiveRps = configuredMaxRps }
  async acquire(counters: Counters) {
    const now = Date.now(), wait = Math.max(0, this.nextPermitAt - now)
    if (wait) await sleep(wait)
    this.nextPermitAt = Math.max(Date.now(), this.nextPermitAt) + 1_000 / this.effectiveRps
    this.inFlight++; counters.transport.peakInFlight = Math.max(counters.transport.peakInFlight, this.inFlight)
  }
  release() { this.inFlight = Math.max(0, this.inFlight - 1) }
  observe(status: number | null, counters: Counters) {
    if (status === 429) { this.effectiveRps = Math.max(MIN_RPS, this.effectiveRps * .5); this.cleanRequests = 0 }
    else if (status != null && status >= 200 && status < 300) { this.cleanRequests++; if (this.cleanRequests >= CLEAN_REQUESTS_FOR_RECOVERY && this.effectiveRps < this.configuredMaxRps) { this.effectiveRps = Math.min(this.configuredMaxRps, this.effectiveRps + .1); this.cleanRequests = 0 } }
    else this.cleanRequests = 0
    counters.transport.effectiveRpsAtEnd = this.effectiveRps
  }
}

async function batchRpc<T>(apiKey: string, calls: Array<{ method: string; params: unknown[] }>, counters: Counters, operation: string): Promise<Array<{ result?: T; error?: string }>> {
  const output: Array<{ result?: T; error?: string }> = []
  for (let index = 0; index < calls.length; index++) {
    const call = calls[index], request = `${operation}:${index}:${call.method}`
    let lastMessage = 'unresolved'
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      let status: number | null = null, retryAfterMs = 0, latency = 0
      await scheduler.acquire(counters)
      const started = Date.now(), second = new Date(started).toISOString().slice(0, 19), minute = second.slice(0, 16)
      counters.httpRequests++; counters.rpcMethodCalls++; counters.estimatedCredits++
      counters.transport.requestsBySecond[second] = (counters.transport.requestsBySecond[second] ?? 0) + 1
      counters.transport.requestsByMinute[minute] = (counters.transport.requestsByMinute[minute] ?? 0) + 1
      const stats = counters.transport.methods[call.method] ??= { attempts: 0, successes: 0, failures: 0, http429: 0, latencyMs: [] }; stats.attempts++
      try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 0, ...call }) })
        status = response.status; retryAfterMs = Math.max(0, Number(response.headers.get('retry-after')) * 1_000 || 0)
        const text = await response.text(); latency = Date.now() - started; stats.latencyMs.push(latency)
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`)
        const body = JSON.parse(text) as { result?: T; error?: { message?: string } }
        stats.successes++; scheduler.observe(status, counters); counters.transport.retryCountsByRequest.push({ request, method: call.method, retries: attempt - 1, terminal: 'success' }); output.push(body.error ? { error: body.error.message ?? 'RPC error' } : { result: body.result }); break
      } catch (error) {
        latency ||= Date.now() - started; if (!stats.latencyMs.length || stats.latencyMs.at(-1) !== latency) stats.latencyMs.push(latency)
        stats.failures++; if (status === 429) stats.http429++; scheduler.observe(status, counters)
        lastMessage = error instanceof Error ? error.message : String(error); counters.errors.push({ operation: request, method: call.method, attempt, message: lastMessage })
        if (attempt === RETRY_ATTEMPTS) { counters.transport.retryCountsByRequest.push({ request, method: call.method, retries: attempt - 1, terminal: 'unresolved' }); counters.transport.unresolvedRequests.push({ request, method: call.method, attempts: attempt, message: lastMessage }); throw new Error(`Retryable archival RPC request unresolved: ${request}: ${lastMessage}`) }
        counters.retries++; const exponential = Math.min(120_000, 1_000 * 2 ** (attempt - 1)), jitter = Math.floor(Math.random() * Math.max(250, exponential * .25)); await sleep(Math.max(retryAfterMs, exponential + jitter))
      } finally { scheduler.release() }
    }
  }
  return output
}

async function blockTime(apiKey: string, slot: number, counters: Counters) {
  const [response] = await batchRpc<number | null>(apiKey, [{ method: 'getBlockTime', params: [slot] }], counters, `getBlockTime-${slot}`)
  return response.result ?? null
}

async function resolveEndSlot(apiKey: string, startSlot: number, endUnix: number, counters: Counters) {
  let low = startSlot, high = startSlot + 25_000
  while ((await blockTime(apiKey, high, counters))! < endUnix) high += 10_000
  while (low < high) {
    const mid = Math.floor((low + high) / 2), time = await blockTime(apiKey, mid, counters)
    if (time == null || time < endUnix) low = mid + 1; else high = mid
  }
  return low - 1
}

async function collect(apiKey: string, pilot: CohortRow, directory: string, state: TokenState) {
  if (!state.endSlot) state.endSlot = await resolveEndSlot(apiKey, pilot.graduation_slot, Math.floor(new Date(pilot.observation_end_utc).getTime() / 1_000), state.counters)
  const completed = new Set(state.slices.map((slice) => `${slice.phase}:${slice.slice}`)), records = new Map(state.transactions.map((entry) => [entry.signature, entry]))
  const pending: Array<{ phase: number; slice: number; center: number }> = []
  for (let phase = 0; phase < DEFAULT_SAMPLING.phases; phase++) for (let index = 0; index < DEFAULT_SAMPLING.slicesPerPhase; index++) {
    if (completed.has(`${phase + 1}:${index + 1}`)) continue
    const position = phase === 0 ? (index + .5) / DEFAULT_SAMPLING.slicesPerPhase : (index + 1) / (DEFAULT_SAMPLING.slicesPerPhase + 1)
    pending.push({ phase: phase + 1, slice: index + 1, center: Math.round(pilot.graduation_slot + (state.endSlot - pilot.graduation_slot) * position) })
  }
  for (let offset = 0; offset < pending.length; offset += RPC_METHODS_PER_BATCH) {
    const group = pending.slice(offset, offset + RPC_METHODS_PER_BATCH), unresolved = new Map(group.map((item) => [`${item.phase}:${item.slice}`, item])), found = new Map<string, { slot: number; block: Block }>()
    for (let distance = 0; distance <= 4 && unresolved.size; distance++) {
      const attempts = [...unresolved.entries()].flatMap(([key, item]) => (distance === 0 ? [item.center] : [item.center - distance, item.center + distance]).map((slot) => ({ key, item, slot })))
      const responses = await batchRpc<Block | null>(apiKey, attempts.map((item) => ({ method: 'getBlock', params: [item.slot, { encoding: 'jsonParsed', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 0 }] })), state.counters, `blocks-${pilot.mint}-${offset}-${distance}`)
      attempts.forEach((attempt, index) => { const block = responses[index].result; if (block?.transactions && unresolved.has(attempt.key)) { found.set(attempt.key, { slot: attempt.slot, block }); unresolved.delete(attempt.key) } })
    }
    if (unresolved.size) throw new Error(`No block within fallback radius for ${[...unresolved.keys()].join(',')}`)
    for (const item of group) {
      const resolved = found.get(`${item.phase}:${item.slice}`)!, candidates = (resolved.block.transactions ?? []).filter((transaction) => transaction.transaction?.message?.accountKeys?.some((key) => keyAddress(key) === pilot.mint)).map((transaction) => transaction.transaction?.signatures?.[0]).filter((value): value is string => Boolean(value)).sort((a, b) => hash(a) - hash(b) || a.localeCompare(b))
      const retained = candidates.slice(0, DEFAULT_SAMPLING.quotaPerSlice)
      for (const signature of retained) if (!records.has(signature)) records.set(signature, { signature, metadata: { samplingPhase: item.phase, samplingSlice: item.slice, sampledBlockSlot: resolved.slot } })
      state.slices.push({ phase: item.phase, slice: item.slice, requestedCenterSlot: item.center, sampledBlockSlot: resolved.slot, eligible: candidates.length, retained: retained.length })
    }
    state.transactions = [...records.values()]; await atomicJson(path.join(directory, 'state.json'), state)
  }
}

async function fetchReceipts(apiKey: string, directory: string, state: TokenState) {
  const missing = state.transactions.filter((entry) => !state.receipts[entry.signature])
  for (let offset = 0; offset < missing.length; offset += RPC_METHODS_PER_BATCH) {
    const batch = missing.slice(offset, offset + RPC_METHODS_PER_BATCH), responses = await batchRpc<RpcTx | null>(apiKey, batch.map((entry) => ({ method: 'getTransaction', params: [entry.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] })), state.counters, `receipts-${offset}`)
    responses.forEach((response, index) => { state.receipts[batch[index].signature] = response.result ? { transaction: response.result } : { error: response.error ?? 'Transaction unavailable' } })
    await atomicJson(path.join(directory, 'state.json'), state)
  }
}

function extract(entry: SampleEntry, tx: RpcTx): ResearchRecord {
  const keys = tx.transaction?.message?.accountKeys ?? [], primarySigner = keys.find((key) => typeof key !== 'string' && key.signer)
  const budget = collectComputeBudget(tx), priority = derivePriorityFeeLamports(tx, budget), receiptState = deriveExecutionState(tx), state = receiptState === 'did-not-land' ? 'unavailable' : receiptState
  const documented = findExplicitProgramError(tx, (id) => id), noProfit = state === 'landed-but-failed' && (tx.meta?.logMessages ?? []).some((line) => /\bno_profit\b|\bno profitable\b.*\b(route|pair)\b/i.test(line))
  const instructions = [...(tx.transaction?.message?.instructions ?? []), ...(tx.meta?.innerInstructions?.flatMap((group) => group.instructions ?? []) ?? [])]
  const programs = [...new Set(instructions.map((instruction) => instruction.programId ?? (typeof instruction.programIdIndex === 'number' ? keyAddress(keys[instruction.programIdIndex]) : undefined)).filter((value): value is string => Boolean(value)))]
  return { signature: entry.signature, slot: tx.slot ?? null, blockTime: tx.blockTime ?? null, primarySigner: typeof primarySigner === 'string' ? primarySigner : primarySigner?.pubkey ?? null, execution: { state }, fees: { totalLamports: typeof tx.meta?.fee === 'number' ? tx.meta.fee : null, priorityFeeLamports: priority.amountLamports }, compute: { requestedCU: budget.computeUnitLimit, consumedCU: tx.meta?.computeUnitsConsumed ?? null }, programs: programs.map((id) => ({ id })), failureClass: state !== 'landed-but-failed' ? null : noProfit ? 'explicit-no-profit-or-route' : documented?.name ?? (documented ? 'opaque-custom-error' : 'undocumented'), failingProgram: state === 'landed-but-failed' ? documented?.programId ?? null : null }
}

async function processToken(apiKey: string, pilot: CohortRow, index: number, total: number) {
  const directory = path.join(outputRoot, pilot.mint), statePath = path.join(directory, 'state.json'), episodePath = path.join(directory, 'episode.json'), operationsPath = path.join(directory, 'operations.json')
  await mkdir(directory, { recursive: true }); const wallStart = Date.now()
  let state: TokenState | null = null
  try {
    const existingEpisode = await readFile(episodePath, 'utf8').then(JSON.parse).catch(() => null)
    const existingOperations = await readFile(operationsPath, 'utf8').then(JSON.parse).catch(() => null)
    if (existingEpisode && existingOperations?.complete) { console.log(`[${index}/${total}] ${pilot.mint}: already complete`); return existingOperations }
    // The pilot selection was mint-hash-only and uses the identical frozen collection
    // contract.  Reuse only an already COMPLETE pilot Episode; incomplete pilot work
    // remains eligible for the normal resumable collection path below.
    if (outputRoot !== pilotOutputRoot) {
      const pilotDirectory = path.join(pilotOutputRoot, pilot.mint)
      const pilotEpisode = await readFile(path.join(pilotDirectory, 'episode.json'), 'utf8').then(JSON.parse).catch(() => null)
      const pilotOperations = await readFile(path.join(pilotDirectory, 'operations.json'), 'utf8').then(JSON.parse).catch(() => null)
      if (pilotEpisode && pilotOperations?.complete) {
        const reused = { ...pilotOperations, mint: pilot.mint, complete: true, reusedFromPilot: true, episodeSourcePath: path.relative(process.cwd(), path.join(pilotDirectory, 'episode.json')) }
        await atomicJson(operationsPath, reused)
        console.log(`[${index}/${total}] ${pilot.mint}: reused COMPLETE pilot Episode`)
        return reused
      }
    }
    state = await readFile(statePath, 'utf8').then(JSON.parse).catch(() => ({ slices: [], transactions: [], receipts: {}, counters: createCounters(scheduler.configuredMaxRps), startedAt: new Date().toISOString() }))
    if (!state) throw new Error('Unable to initialize collection state')
    state.counters = normalizeCounters(state.counters, scheduler.configuredMaxRps)
    const activeState = state
    await collect(apiKey, pilot, directory, activeState); await fetchReceipts(apiKey, directory, activeState)
    const records = activeState.transactions.flatMap((entry) => activeState.receipts[entry.signature]?.transaction ? [extract(entry, activeState.receipts[entry.signature].transaction!)] : [])
    const sampling = { methodologyVersion: METHODOLOGY_VERSION, method: 'Two interleaved sets of 250 evenly spaced full-block slices; mint account-key filter; stable FNV-1a signature-hash quota per slice; signature deduplication across phases', selection: 'Slice position, mint account-key reference, and stable signature hash only. Receipt facts and outcomes are not used.', targetMint: pilot.mint, requestedWindow: { startSlot: pilot.graduation_slot, endSlot: activeState.endSlot, startTimestamp: pilot.graduation_timestamp_utc, endTimestamp: pilot.observation_end_utc }, ...DEFAULT_SAMPLING, slices: activeState.slices, transactionsRetained: activeState.transactions.length }
    const episode = { generatedAt: new Date().toISOString(), outcomeDataIncluded: false, fetchFailures: activeState.transactions.filter((entry) => !activeState.receipts[entry.signature]?.transaction).map((entry) => ({ signature: entry.signature, error: activeState.receipts[entry.signature]?.error ?? 'missing' })), records, ...buildEpisode(records, { mint: pilot.mint, observationStartSlot: pilot.graduation_slot, observationEndSlot: activeState.endSlot! }, sampling) }
    await atomicJson(episodePath, episode)
    const operations = { mint: pilot.mint, complete: true, retryable: false, incompleteReason: null, candidateTransactionsEncountered: state.slices.reduce((sum, slice) => sum + slice.eligible, 0), transactionsRetained: state.transactions.length, transactionsFetched: records.length, rpcMethodCalls: state.counters.rpcMethodCalls, httpRequests: state.counters.httpRequests, heliusCredits: state.counters.estimatedCredits, heliusCreditsMeasurement: 'estimated from one credit per standard archival RPC method call; no JSON-RPC batching is used', runtimeSecondsThisRun: (Date.now() - wallStart) / 1_000, retries: state.counters.retries, fetchFailures: state.transactions.length - records.length, errors: state.counters.errors, transport: state.counters.transport }
    await atomicJson(operationsPath, operations); console.log(`[${index}/${total}] ${pilot.mint}: complete, ${records.length} receipts, ${operations.runtimeSecondsThisRun.toFixed(1)}s`); return operations
  } catch (error) {
    if (state) await atomicJson(statePath, state)
    const operations = { mint: pilot.mint, complete: false, retryable: true, incompleteReason: error instanceof Error ? error.message : String(error), runtimeSecondsThisRun: (Date.now() - wallStart) / 1_000, rpcMethodCalls: state?.counters.rpcMethodCalls ?? 0, httpRequests: state?.counters.httpRequests ?? 0, heliusCredits: state?.counters.estimatedCredits ?? 0, heliusCreditsMeasurement: 'estimated from one credit per standard archival RPC method call; no JSON-RPC batching is used', retries: state?.counters.retries ?? 0, fetchFailures: state ? state.transactions.filter((entry) => !state!.receipts[entry.signature]?.transaction).length : 0, errors: state?.counters.errors ?? [], transport: state?.counters.transport ?? null }
    await atomicJson(operationsPath, operations); console.error(`[${index}/${total}] ${pilot.mint}: incomplete: ${operations.incompleteReason}`); return operations
  }
}

function percentile(values: number[], p: number) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b), position = (sorted.length - 1) * p, low = Math.floor(position), high = Math.ceil(position); return sorted[low] + (sorted[high] - sorted[low]) * (position - low) }
async function main() {
  const input = JSON.parse(await readFile(inputPath, 'utf8')) as { selected?: CohortRow[]; graduations?: CohortRow[] }, selected = input.selected ?? input.graduations ?? []
  if (!selected.length) throw new Error('Input must contain selected or graduations rows')
  const env = await readFile('.env.local', 'utf8'), apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim(); if (!apiKey) throw new Error('HELIUS_API_KEY is required')
  const configuredMaxRps = Number(process.env.HELIUS_MAX_RPS ?? DEFAULT_MAX_RPS); if (!Number.isFinite(configuredMaxRps) || configuredMaxRps < MIN_RPS) throw new Error(`HELIUS_MAX_RPS must be at least ${MIN_RPS}`)
  scheduler = new GlobalRequestScheduler(configuredMaxRps)
  await mkdir(outputRoot, { recursive: true })
  const operations = new Array<Awaited<ReturnType<typeof processToken>>>(selected.length)
  const progressPath = path.join(outputRoot, progressFileName)
  async function persistProgress() {
    const terminal = operations.filter(Boolean)
    const complete = terminal.filter((item) => item.complete).length
    await atomicJson(progressPath, {
      generatedAt: new Date().toISOString(), inputPath, total: selected.length,
      complete, partialOrFailed: terminal.length - complete, terminal: terminal.length,
      pending: selected.length - terminal.length,
      progress: `${terminal.length} / ${selected.length}`,
    })
  }
  let nextIndex = 0
  const workers = Array.from({ length: 1 }, async () => {
    while (true) {
      const index = nextIndex++
      if (index >= selected.length) return
      operations[index] = await processToken(apiKey, selected[index], index + 1, selected.length)
      await persistProgress()
    }
  })
  await Promise.all(workers)
  const complete = operations.filter((item): item is Record<string, any> & { complete: true } => item.complete), transactions = complete.map((item) => item.transactionsFetched as number), runtimes = complete.map((item) => item.runtimeSecondsThisRun as number), credits = complete.map((item) => item.heliusCredits as number)
  const report = { generatedAt: new Date().toISOString(), inputPath, selected: selected.length, completeEpisodes: complete.length, incompleteEpisodes: selected.length - complete.length, failureReasons: operations.filter((item) => !item.complete).map((item) => ({ mint: item.mint, reason: item.incompleteReason })), totals: { candidateTransactionsEncountered: complete.reduce((sum, item) => sum + item.candidateTransactionsEncountered, 0), transactionsProcessed: transactions.reduce((a, b) => a + b, 0), rpcMethodCalls: complete.reduce((sum, item) => sum + item.rpcMethodCalls, 0), httpRequests: complete.reduce((sum, item) => sum + item.httpRequests, 0), estimatedHeliusCredits: credits.reduce((a, b) => a + b, 0), runtimeSeconds: runtimes.reduce((a, b) => a + b, 0), retries: complete.reduce((sum, item) => sum + item.retries, 0), fetchFailures: complete.reduce((sum, item) => sum + item.fetchFailures, 0) }, distributions: { transactionsPerToken: { median: percentile(transactions, .5), p95: percentile(transactions, .95) }, runtimeSecondsPerToken: { median: percentile(runtimes, .5), p95: percentile(runtimes, .95) }, estimatedCreditsPerToken: { median: percentile(credits, .5), p95: percentile(credits, .95) } }, operations }
  await atomicJson(path.join(outputRoot, 'operational-report.json'), report); console.log(`Cohort run complete: ${complete.length}/${selected.length} Episodes`)
}
void main()
