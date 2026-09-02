import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  COMPUTE_BUDGET_PROGRAM_ID,
  JUPITER_PROGRAM_ID,
  collectComputeBudget,
  deriveExecutionState,
  derivePriorityFeeLamports,
  findExplicitProgramError,
  type ReceiptRpcInstruction,
  type ReceiptRpcTransaction,
} from '../lib/receipt-evidence.ts'

type InputRecord = {
  signature: string
  metadata: Record<string, unknown>
}

type InputDataset = {
  records: InputRecord[]
  sampling: Record<string, unknown> | null
}

type RpcAccountKey = string | {
  pubkey?: string
  signer?: boolean
  writable?: boolean
  source?: string
}

type RpcTransaction = ReceiptRpcTransaction & {
  blockTime?: number | null
  meta?: ReceiptRpcTransaction['meta'] & {
    innerInstructions?: Array<{ instructions?: ReceiptRpcInstruction[] }>
  }
  transaction?: ReceiptRpcTransaction['transaction'] & {
    message?: NonNullable<ReceiptRpcTransaction['transaction']>['message'] & {
      accountKeys?: RpcAccountKey[]
    }
  }
}

type EpisodeTransaction = {
  signature: string
  metadata: Record<string, unknown>
  fetchError?: string
  slot?: number
  blockTime?: number | null
  execution: {
    state: 'landed' | 'landed-but-failed' | 'did-not-land' | 'unavailable'
    evidence: 'observed'
  }
  signer: { address: string | null; evidence: 'observed' | 'unknown' }
  programs: Array<{ id: string; label: string; instructionCount: number; evidence: 'observed' }>
  writableAccounts: Array<{ address: string; evidence: 'observed' }>
  fees: {
    totalLamports: number | null
    evidence: 'observed' | 'unknown'
    priorityFeeLamports: number | null
    priorityFeeEvidence: 'derived' | 'unknown'
    priorityFeeFormula: string | null
  }
  compute: {
    requestedLimit: number | null
    consumed: number | null
    priceMicroLamports: number | null
    evidence: 'observed' | 'unknown'
  }
  failure: {
    class: string | null
    documentedError: ReturnType<typeof findExplicitProgramError>
    searcherLike: { classification: 'no-profit-or-no-profitable-route'; log: string; evidence: 'observed' } | null
  }
}

const PROGRAM_LABELS: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program',
  [COMPUTE_BUDGET_PROGRAM_ID]: 'Compute Budget',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'Associated Token Account',
  [JUPITER_PROGRAM_ID]: 'Jupiter Aggregator',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM v4',
  '2KehYt3KsEQR53jYcxjbQp2d2kCp4AkuQW68atufRwSr': 'Symmetry Engine',
  whirLbMiicVdio4qvUfM5KAg6CtQonwY6WcAm7A9Xq: 'Orca Whirlpool',
  dRiftyHA39mYBAzirNc3LfgcHftc83mDtvrVQSaVbb: 'Drift Protocol',
  PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY: 'Phoenix',
}

function accountAddress(account: RpcAccountKey | undefined) {
  return typeof account === 'string' ? account : account?.pubkey
}

function programLabel(programId: string, programName?: string) {
  return PROGRAM_LABELS[programId] ?? programName ?? 'Unknown Program'
}

function programId(instruction: ReceiptRpcInstruction, accountKeys: RpcAccountKey[]) {
  if (instruction.programId) return instruction.programId
  if (typeof instruction.programIdIndex === 'number') return accountAddress(accountKeys[instruction.programIdIndex])
  return undefined
}

function parseCsvRow(row: string) {
  const values: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index]
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value.trim())
      value = ''
    } else {
      value += character
    }
  }

  values.push(value.trim())
  return values
}

function inputRecords(raw: string, inputPath: string): InputDataset {
  if (inputPath.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(raw) as unknown
    const rows = Array.isArray(parsed) ? parsed : (parsed as { transactions?: unknown[] }).transactions
    if (!Array.isArray(rows)) throw new Error('JSON input must be an array or an object with a transactions array.')

    const records = rows.map((row, index) => {
      if (typeof row === 'string') return { signature: row, metadata: {} }
      if (!row || typeof row !== 'object' || typeof (row as { signature?: unknown }).signature !== 'string') {
        throw new Error(`Input row ${index + 1} is missing a signature.`)
      }
      const { signature, metadata, ...rest } = row as { signature: string; metadata?: Record<string, unknown> }
      return { signature, metadata: { ...rest, ...(metadata ?? {}) } }
    })
    return {
      records,
      sampling: !Array.isArray(parsed) && parsed && typeof parsed === 'object'
        ? ((parsed as { sampling?: unknown }).sampling as Record<string, unknown> | undefined) ?? null
        : null,
    }
  }

  const rows = raw.split(/\r?\n/).filter((line) => line.trim())
  if (!rows.length) return { records: [], sampling: null }
  const headers = parseCsvRow(rows[0]).map((header) => header.toLowerCase())
  const signatureIndex = headers.indexOf('signature')
  if (signatureIndex < 0) throw new Error('CSV input must include a signature column.')

  return { records: rows.slice(1).map((row, index) => {
    const values = parseCsvRow(row)
    const metadata = Object.fromEntries(headers
      .map((header, column) => [header, values[column] ?? ''])
      .filter(([header]) => header !== 'signature'))
    const signature = values[signatureIndex]
    if (!signature) throw new Error(`CSV row ${index + 2} is missing a signature.`)
    return { signature, metadata }
  }), sampling: null }
}

async function heliusTransactions(records: InputRecord[], apiKey: string) {
  const results = new Map<string, { transaction?: RpcTransaction; error?: string }>()
  const chunkSize = 10
  for (let offset = 0; offset < records.length; offset += chunkSize) {
    const chunk = records.slice(offset, offset + chunkSize)
    let body: Array<{ id?: number; error?: { message?: string }; result?: RpcTransaction | null }> | null = null
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map((record, index) => ({
          jsonrpc: '2.0', id: index, method: 'getTransaction',
          params: [record.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        }))),
      })
      const text = await response.text()
      if (response.ok) {
        try { body = JSON.parse(text) as typeof body } catch { body = null }
      }
      if (Array.isArray(body)) break
      if (attempt === 3) throw new Error(`RPC batch request failed (${response.status}): ${text.slice(0, 120)}`)
      await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)))
    }
    if (!body) throw new Error('RPC batch response was unavailable.')
    for (const item of body as Array<{ id?: number; error?: { message?: string }; result?: RpcTransaction | null }>) {
      const record = typeof item.id === 'number' ? chunk[item.id] : undefined
      if (!record) continue
      results.set(record.signature, item.error
        ? { error: item.error.message ?? 'RPC error' }
        : item.result ? { transaction: item.result } : { error: 'Transaction was not returned by RPC.' })
    }
    if (offset + chunkSize < records.length) await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  return results
}

async function heliusTransaction(signature: string, apiKey: string) {
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
    }),
  })
  const body = await response.json() as { error?: { message?: string }; result?: RpcTransaction | null }
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `RPC request failed (${response.status})`)
  if (!body.result) throw new Error('Transaction was not returned by RPC.')
  return body.result
}

function collectPrograms(tx: RpcTransaction) {
  const accountKeys = tx.transaction?.message?.accountKeys ?? []
  const instructions = [
    ...(tx.transaction?.message?.instructions ?? []),
    ...(tx.meta?.innerInstructions?.flatMap((group) => group.instructions ?? []) ?? []),
  ]
  const programs = new Map<string, { id: string; label: string; instructionCount: number; evidence: 'observed' }>()

  for (const instruction of instructions) {
    const id = programId(instruction, accountKeys)
    if (!id) continue
    const existing = programs.get(id)
    if (existing) existing.instructionCount += 1
    else programs.set(id, { id, label: programLabel(id, instruction.program), instructionCount: 1, evidence: 'observed' })
  }

  return [...programs.values()].sort((left, right) => right.instructionCount - left.instructionCount)
}

function extractTransaction(record: InputRecord, tx: RpcTransaction): EpisodeTransaction {
  const accountKeys = tx.transaction?.message?.accountKeys ?? []
  const signer = accountKeys.find((account) => typeof account !== 'string' && account.signer)
  const computeBudget = collectComputeBudget(tx)
  const priorityFee = derivePriorityFeeLamports(tx, computeBudget)
  const executionState = deriveExecutionState(tx)
  const documentedError = findExplicitProgramError(tx, (id) => programLabel(id))
  const searcherLog = (tx.meta?.logMessages ?? []).find((log) =>
    /\bno_profit\b|\bno profitable\b.*\b(route|pair)\b/i.test(log),
  )

  return {
    signature: record.signature,
    metadata: record.metadata,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    execution: { state: executionState, evidence: 'observed' },
    signer: signer && typeof signer !== 'string'
      ? { address: signer.pubkey ?? null, evidence: signer.pubkey ? 'observed' : 'unknown' }
      : { address: null, evidence: 'unknown' },
    programs: collectPrograms(tx),
    writableAccounts: accountKeys
      .filter((account): account is Exclude<RpcAccountKey, string> => typeof account !== 'string' && Boolean(account.writable) && Boolean(account.pubkey))
      .map((account) => ({ address: account.pubkey as string, evidence: 'observed' as const })),
    fees: {
      totalLamports: typeof tx.meta?.fee === 'number' ? tx.meta.fee : null,
      evidence: typeof tx.meta?.fee === 'number' ? 'observed' : 'unknown',
      priorityFeeLamports: priorityFee.amountLamports,
      priorityFeeEvidence: priorityFee.derivation ? 'derived' : 'unknown',
      priorityFeeFormula: priorityFee.derivation?.formula ?? null,
    },
    compute: {
      requestedLimit: computeBudget.computeUnitLimit,
      consumed: tx.meta?.computeUnitsConsumed ?? null,
      priceMicroLamports: computeBudget.computeUnitPriceMicroLamports,
      evidence: computeBudget.computeUnitLimit != null || tx.meta?.computeUnitsConsumed != null ? 'observed' : 'unknown',
    },
    failure: {
      class: executionState !== 'landed-but-failed'
        ? null
        : searcherLog
          ? 'searcher-like:no-profit-or-no-profitable-route'
          : documentedError?.name ?? (documentedError ? 'opaque-custom-error' : 'undocumented-failure'),
      documentedError,
      searcherLike: searcherLog
        ? { classification: 'no-profit-or-no-profitable-route', log: searcherLog, evidence: 'observed' }
        : null,
    },
  }
}

function countValues(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([value, count]) => ({ value, count }))
}

function countRepeated(values: Array<string | null | undefined>) {
  return countValues(values).filter(({ count }) => count > 1)
}

function distribution(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === 'number').sort((left, right) => left - right)
  if (!present.length) return { count: 0, min: null, median: null, mean: null, max: null }
  const middle = Math.floor(present.length / 2)
  return {
    count: present.length,
    min: present[0],
    median: present.length % 2 ? present[middle] : (present[middle - 1] + present[middle]) / 2,
    mean: Number((present.reduce((sum, value) => sum + value, 0) / present.length).toFixed(2)),
    max: present[present.length - 1],
  }
}

function aggregate(transactions: EpisodeTransaction[]) {
  const successful = transactions.filter((transaction) => transaction.execution.state === 'landed')
  const failed = transactions.filter((transaction) => transaction.execution.state === 'landed-but-failed')
  const failureClasses = countValues(failed.map((transaction) => transaction.failure.class))
  const signerGroups = new Map<string, EpisodeTransaction[]>()
  for (const transaction of transactions) {
    if (!transaction.signer.address) continue
    const group = signerGroups.get(transaction.signer.address) ?? []
    group.push(transaction)
    signerGroups.set(transaction.signer.address, group)
  }
  const slices = new Map<number, EpisodeTransaction[]>()
  for (const transaction of transactions) {
    const slice = transaction.metadata.samplingSlice
    if (typeof slice !== 'number') continue
    const group = slices.get(slice) ?? []
    group.push(transaction)
    slices.set(slice, group)
  }

  return {
    totalTransactionsAnalyzed: transactions.length,
    successCount: successful.length,
    failureCount: failed.length,
    unavailableCount: transactions.filter((transaction) => transaction.execution.state === 'unavailable').length,
    failureClasses,
    repeatedSigners: countRepeated(transactions.map((transaction) => transaction.signer.address)),
    repeatedFailingPrograms: countRepeated(failed.map((transaction) => transaction.failure.documentedError?.programId)),
    repeatedWritableAccounts: countRepeated(transactions.flatMap((transaction) => transaction.writableAccounts.map((account) => account.address))),
    searcherLikeFailures: failed
      .filter((transaction) => transaction.failure.searcherLike)
      .map((transaction) => ({ signature: transaction.signature, ...transaction.failure.searcherLike! })),
    sameSignerSuccessFailureSequences: [...signerGroups.entries()]
      .map(([signer, records]) => ({
        signer,
        sequence: [...records]
          .sort((left, right) => (left.slot ?? 0) - (right.slot ?? 0))
          .map((record) => ({ signature: record.signature, slot: record.slot ?? null, state: record.execution.state })),
      }))
      .filter(({ sequence }) => new Set(sequence.map((record) => record.state)).size > 1),
    feeDistributionsLamports: {
      successful: distribution(successful.map((transaction) => transaction.fees.totalLamports)),
      failed: distribution(failed.map((transaction) => transaction.fees.totalLamports)),
    },
    priorityFeeDistributionsLamports: {
      successful: distribution(successful.map((transaction) => transaction.fees.priorityFeeLamports)),
      failed: distribution(failed.map((transaction) => transaction.fees.priorityFeeLamports)),
    },
    computeDistributions: {
      successfulRequested: distribution(successful.map((transaction) => transaction.compute.requestedLimit)),
      failedRequested: distribution(failed.map((transaction) => transaction.compute.requestedLimit)),
      successfulConsumed: distribution(successful.map((transaction) => transaction.compute.consumed)),
      failedConsumed: distribution(failed.map((transaction) => transaction.compute.consumed)),
    },
    temporalSlices: [...slices.entries()].sort(([left], [right]) => left - right).map(([slice, records]) => {
      const sliceSuccesses = records.filter((record) => record.execution.state === 'landed')
      const sliceFailures = records.filter((record) => record.execution.state === 'landed-but-failed')
      return {
        slice,
        sampledBlockSlot: typeof records[0]?.metadata.sampledBlockSlot === 'number' ? records[0].metadata.sampledBlockSlot : null,
        totalTransactions: records.length,
        successCount: sliceSuccesses.length,
        failureCount: sliceFailures.length,
        failureClasses: countValues(sliceFailures.map((record) => record.failure.class)),
      }
    }),
  }
}

function markdownReport(transactions: EpisodeTransaction[], summary: ReturnType<typeof aggregate>, sampling: Record<string, unknown> | null) {
  const observedFailures = transactions
    .filter((transaction) => transaction.execution.state === 'landed-but-failed')
    .map((transaction) => {
      const error = transaction.failure.documentedError
      const searcherLog = transaction.failure.searcherLike?.log
      return `- \`${transaction.signature}\`: ${searcherLog ? `observed program log: ${searcherLog}` : error ? `${error.program}: ${error.message}` : 'landed but failed; no documented program error was available.'}`
    })
  const patterns = [
    summary.repeatedSigners.length ? `Repeated signers: ${summary.repeatedSigners.map(({ value, count }) => `\`${value}\` (${count})`).join(', ')}.` : null,
    summary.repeatedFailingPrograms.length ? `Repeated failing programs: ${summary.repeatedFailingPrograms.map(({ value, count }) => `\`${value}\` (${count})`).join(', ')}.` : null,
    summary.repeatedWritableAccounts.length ? `Top repeated writable accounts: ${summary.repeatedWritableAccounts.slice(0, 5).map(({ value, count }) => `\`${value}\` (${count})`).join(', ')}.` : null,
    summary.sameSignerSuccessFailureSequences.length ? `Same-signer success/failure sequence(s): ${summary.sameSignerSuccessFailureSequences.map(({ signer, sequence }) => `\`${signer}\` (${sequence.map(({ state, slot }) => `${state}@${slot ?? 'unknown'}`).join(' -> ')})`).join('; ')}.` : null,
    summary.searcherLikeFailures.length ? `${summary.searcherLikeFailures.length} failure(s) include an explicit no-profit/no-profitable-route-or-pair log.` : null,
  ].filter((line): line is string => Boolean(line))
  const slingTakeaway = summary.searcherLikeFailures.length
    ? 'The supplied transactions include explicit no-profit or no-profitable-route failures, which Breadlines can distinguish from generic opaque errors without claiming why the route was unprofitable.'
    : summary.failureClasses.length
      ? 'The episode contains documented program-level failures that can be grouped without attributing them to fee, congestion, or account overlap.'
      : null
  const fetchFailures = transactions.filter((transaction) => transaction.fetchError)
  const methodology = sampling ? `## Sampling Methodology\n\n- Method: ${sampling.method ?? 'not supplied'}.\n- Target mint: \`${sampling.targetMint ?? 'not supplied'}\`.\n- Target slot range: ${sampling.targetSlotStart ?? 'unknown'}-${sampling.targetSlotEnd ?? 'unknown'}.\n- Candidate signatures inspected: ${sampling.candidateSignaturesInspected ?? 'unknown'}.\n- Transactions retained: ${sampling.transactionsRetained ?? transactions.length}.\n- Selection: ${sampling.selection ?? 'not supplied'}.\n\n` : ''
  const temporal = summary.temporalSlices.length
    ? summary.temporalSlices.map((slice) => `- Slice ${slice.slice} (block ${slice.sampledBlockSlot ?? 'unknown'}): ${slice.totalTransactions} retained, ${slice.successCount} landed, ${slice.failureCount} landed-but-failed; classes: ${slice.failureClasses.length ? slice.failureClasses.map(({ value, count }) => `${value} (${count})`).join(', ') : 'none'}.`).join('\n')
    : '- No systematic temporal slices were supplied.'
  const verdict = summary.searcherLikeFailures.length >= 2
    ? `MAYBE - The strongest finding is ${summary.searcherLikeFailures.length} explicit no-profit/no-profitable-route-or-pair rejection${summary.searcherLikeFailures.length === 1 ? '' : 's'} in this systematically selected sample. It is a documented execution pattern, but the evidence does not establish a creator-actionable cause.`
    : (summary.repeatedSigners.length || summary.repeatedFailingPrograms.length || summary.sameSignerSuccessFailureSequences.length)
      ? 'MAYBE — An interesting repeated execution pattern exists in this supplied sample, but the partial sample and available evidence do not establish a creator-actionable cause.'
      : 'NO — Nothing in this supplied sample is sufficiently non-obvious and well-supported to justify showing it yet.'

  return `This is an analysis of a partial transaction sample, not the complete TOAD execution window.\n\n# TOAD Execution Episode\n\n## Observed\n\n- Input records: ${transactions.length}.\n- Landed successes: ${summary.successCount}.\n- Landed-but-failed transactions: ${summary.failureCount}.\n${observedFailures.length ? `${observedFailures.join('\n')}\n` : '- No landed-but-failed transaction was returned by the supplied input.\n'}\n${fetchFailures.length ? `\n## Fetch Failures\n\n${fetchFailures.map((transaction) => `- \`${transaction.signature}\`: ${transaction.fetchError}`).join('\n')}\n` : ''}\n## Derived\n\n- Failure classes within this supplied sample: ${summary.failureClasses.length ? summary.failureClasses.map(({ value, count }) => `${value} (${count})`).join(', ') : 'none'}.\n- Fee distribution, successful: ${JSON.stringify(summary.feeDistributionsLamports.successful)}.\n- Fee distribution, failed: ${JSON.stringify(summary.feeDistributionsLamports.failed)}.\n- Priority-fee distribution, successful: ${JSON.stringify(summary.priorityFeeDistributionsLamports.successful)}.\n- Priority-fee distribution, failed: ${JSON.stringify(summary.priorityFeeDistributionsLamports.failed)}.\n- CU requested, successful/failed: ${JSON.stringify(summary.computeDistributions.successfulRequested)} / ${JSON.stringify(summary.computeDistributions.failedRequested)}.\n- CU consumed, successful/failed: ${JSON.stringify(summary.computeDistributions.successfulConsumed)} / ${JSON.stringify(summary.computeDistributions.failedConsumed)}.\n\n## Patterns\n\n${patterns.length ? patterns.map((line) => `- ${line}`).join('\n') : '- No repeated cross-transaction pattern met the reporting threshold.'}\n\nThese are cross-transaction observations only. They do not establish that fee, congestion, contention, writable-account overlap, timing, or any other context caused an outcome.\n\n## Unknown\n\n- A transaction receipt cannot establish trader intent, whether a signer was a buyer, why an instruction was constructed a certain way, or a causal difference between two transactions.\n- Opaque custom errors remain uninterpreted unless a deterministic program log explains them.\n- Repeated signers, programs, and writable accounts are not proof of a shared cause or actor relationship.\n\n${slingTakeaway ? `## Potential Slingor Takeaway\n\n${slingTakeaway}\n\n` : ''}## Is this worth showing Slingor?\n\n${verdict}\n`
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) throw new Error('Usage: npm run research:toad -- <input.json|input.csv> [output-directory]')

  const outputDirectory = path.resolve(process.argv[3] ?? 'research')
  const rawInput = await readFile(inputPath, 'utf8')
  const input = inputRecords(rawInput, inputPath)
  const env = await readFile('.env.local', 'utf8')
  const apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim()
  if (!apiKey) throw new Error('HELIUS_API_KEY is required in .env.local.')

  const responses = await heliusTransactions(input.records, apiKey)
  const transactions: EpisodeTransaction[] = []
  for (const record of input.records) {
    try {
      const response = responses.get(record.signature)
      if (!response?.transaction) throw new Error(response?.error ?? 'Transaction was not returned by RPC.')
      transactions.push(extractTransaction(record, response.transaction))
    } catch (error) {
      transactions.push({
        signature: record.signature,
        metadata: record.metadata,
        fetchError: error instanceof Error ? error.message : 'Unknown RPC error',
        execution: { state: 'unavailable', evidence: 'observed' },
        signer: { address: null, evidence: 'unknown' },
        programs: [],
        writableAccounts: [],
        fees: { totalLamports: null, evidence: 'unknown', priorityFeeLamports: null, priorityFeeEvidence: 'unknown', priorityFeeFormula: null },
        compute: { requestedLimit: null, consumed: null, priceMicroLamports: null, evidence: 'unknown' },
        failure: { class: null, documentedError: null, searcherLike: null },
      })
    }
  }

  const summary = aggregate(transactions)
  const output = {
    experiment: 'TOAD Execution Episode',
    generatedAt: new Date().toISOString(),
    evidenceBoundary: 'Observed transaction data, derived aggregates, and non-causal cross-transaction patterns.',
    sampling: input.sampling,
    transactions,
    summary,
  }

  await mkdir(outputDirectory, { recursive: true })
  await writeFile(path.join(outputDirectory, 'toad-episode.json'), `${JSON.stringify(output, null, 2)}\n`)
  const samplingAppendix = input.sampling
    ? `\n## Systematic Sampling Methodology\n\n- Method: ${input.sampling.method ?? 'not supplied'}.\n- Target mint: \`${input.sampling.targetMint ?? 'not supplied'}\`.\n- Target slot range: ${input.sampling.targetSlotStart ?? 'unknown'}-${input.sampling.targetSlotEnd ?? 'unknown'}.\n- Candidate signatures inspected: ${input.sampling.candidateSignaturesInspected ?? 'unknown'}.\n- Transactions retained: ${input.sampling.transactionsRetained ?? transactions.length}.\n- Selection: ${input.sampling.selection ?? 'not supplied'}.\n\n## Temporal Slices\n\n${summary.temporalSlices.length ? summary.temporalSlices.map((slice) => `- Slice ${slice.slice} (block ${slice.sampledBlockSlot ?? 'unknown'}): ${slice.totalTransactions} retained, ${slice.successCount} landed, ${slice.failureCount} landed-but-failed; classes: ${slice.failureClasses.length ? slice.failureClasses.map(({ value, count }) => `${value} (${count})`).join(', ') : 'none'}.`).join('\n') : '- No systematic temporal slices were supplied.'}\n\nThese are derived counts from independently selected block slices. Differences across slices are descriptive, not causal.\n`
    : ''
  await writeFile(path.join(outputDirectory, 'toad-episode.md'), `${markdownReport(transactions, summary, input.sampling)}${samplingAppendix}`)
  console.log(`Wrote ${path.join(outputDirectory, 'toad-episode.json')}`)
  console.log(`Wrote ${path.join(outputDirectory, 'toad-episode.md')}`)
}

void main()
