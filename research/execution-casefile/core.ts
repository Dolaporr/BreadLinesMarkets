import { COMPUTE_BUDGET_PROGRAM_ID, collectComputeBudget, derivePriorityFeeLamports, findExplicitProgramError, type ReceiptRpcTransaction, type ReceiptRpcInstruction } from './receipt-parser.ts'
import type { buildExecutionEpisode } from '../../scripts/execution-episode-core.ts'

export const CASEFILE_VERSION = 'breadlines-casefile-v1.2.0'
export type Episode = ReturnType<typeof buildExecutionEpisode>
export type Receipt = ReceiptRpcTransaction & {
  version?: 'legacy' | number
  blockTime?: number | null
  meta?: NonNullable<ReceiptRpcTransaction['meta']> & { loadedAddresses?: { writable: string[]; readonly: string[] }; innerInstructions?: Array<{ index: number; instructions: Array<ReceiptRpcInstruction & { stackHeight?: number }> }> }
  transaction?: NonNullable<ReceiptRpcTransaction['transaction']> & {
    message?: NonNullable<NonNullable<ReceiptRpcTransaction['transaction']>['message']> & {
      header?: { numRequiredSignatures: number; numReadonlySignedAccounts: number; numReadonlyUnsignedAccounts: number }
      addressTableLookups?: unknown[]
    }
  }
}
export type Frame = {
  id: number; programId: string; depth: number; parentId: number | null
  start: number; end: number | null; ownLogIndices: number[]
  status: 'SUCCESS' | 'FAILED' | 'INCOMPLETE'; error: string | null; instruction: string | null
}
export const names: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program',
  ComputeBudget111111111111111111111111111111: 'Compute Budget',
  JTXJTXfr1wVRMEzqiPhXUr69zJtfGuLh5qEiXG772Zj: 'JTX',
  DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH: 'DFlow',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter v6',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'Token Program',
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: 'PumpSwap',
}
export const short = (s: string) => s.length > 18 ? `${s.slice(0, 7)}…${s.slice(-6)}` : s
export const programName = (s: string) => names[s] ?? short(s)
export function normalizeReceipt(value: unknown): Receipt {
  const tx = structuredClone(value) as Receipt
  if (!tx || !Number.isSafeInteger(tx.slot) || tx.slot < 0 || !tx.transaction?.signatures?.[0]) throw new Error('A receipt requires a landed slot and signature.')
  // Transaction v1 is modelled as one atomic unit that may commit more than one state root.
  // Neither its resource configuration nor its cross-root commitment has a representation here,
  // so it fails closed. Decoding the configuration alone does not lift this gate.
  if (tx.version !== undefined && tx.version !== 'legacy' && tx.version !== 0) throw new Error('Unsupported transaction version. This preview supports legacy and v0 JSON. Transaction v1 is not decoded: neither its resource configuration nor the multiple state-root transitions it may commit atomically has a representation in this model.')
  if (!tx.meta || !Object.hasOwn(tx.meta, 'err') || tx.meta.err === undefined) throw new Error('Execution metadata (meta.err) is missing. Success cannot be assumed.')
  const message = tx.transaction.message
  if (!message || !Array.isArray(message.accountKeys) || !Array.isArray(message.instructions)) throw new Error('JSON account keys and instructions are required. Encoded transactions are not supported.')
  if ('transactionConfig' in tx || 'transactionConfig' in message || 'config' in message) throw new Error('Unsupported transaction configuration. Do not interpret v1 configuration as legacy Compute Budget instructions.')
  if (tx.meta.logMessages != null && (!Array.isArray(tx.meta.logMessages) || tx.meta.logMessages.some(l => typeof l !== 'string'))) throw new Error('Invalid transaction logs.')
  const keys = message.accountKeys
  if (keys.every(k => typeof k === 'string') && message.header) {
    const h = message.header
    if (![h.numRequiredSignatures, h.numReadonlySignedAccounts, h.numReadonlyUnsignedAccounts].every(n => Number.isSafeInteger(n) && n >= 0)
      || h.numRequiredSignatures > keys.length || h.numReadonlySignedAccounts > h.numRequiredSignatures
      || h.numReadonlyUnsignedAccounts > keys.length - h.numRequiredSignatures) throw new Error('Invalid account header.')
    message.accountKeys = keys.map((k, i) => ({ pubkey: k as string, signer: i < h.numRequiredSignatures,
      writable: i < h.numRequiredSignatures ? i < h.numRequiredSignatures - h.numReadonlySignedAccounts : i < keys.length - h.numReadonlyUnsignedAccounts }))
    if (message.addressTableLookups?.length && !tx.meta.loadedAddresses) {
      // Do not expose a partial writable set as complete.
      message.accountKeys = keys
    } else if (tx.meta.loadedAddresses) {
      message.accountKeys.push(...tx.meta.loadedAddresses.writable.map(pubkey => ({ pubkey, signer: false, writable: true })),
        ...tx.meta.loadedAddresses.readonly.map(pubkey => ({ pubkey, signer: false, writable: false })))
    }
  }
  return tx
}

export function parseFrames(logs: string[]) {
  const frames: Frame[] = [], stack: Frame[] = []
  let complete = true
  for (const [index, line] of logs.entries()) {
    const begin = /^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[(\d+)\]$/.exec(line)
    if (begin) {
      const depth = Number(begin[2])
      if (depth !== stack.length + 1) complete = false
      while (stack.length && stack.at(-1)!.depth >= depth) stack.pop()
      const frame: Frame = { id: frames.length, programId: begin[1], depth, parentId: stack.at(-1)?.id ?? null,
        start: index, end: null, ownLogIndices: [index], status: 'INCOMPLETE', error: null, instruction: null }
      frames.push(frame); stack.push(frame); continue
    }
    const frame = stack.at(-1)
    if (/log.*truncat/i.test(line)) complete = false
    if (!frame) { if (/^Program \S+ (success|failed:)/.test(line)) complete = false; continue }
    frame.ownLogIndices.push(index)
    const instruction = /^Program log: Instruction: (.+)$/.exec(line)
    if (instruction) frame.instruction = instruction[1]
    const end = /^Program ([1-9A-HJ-NP-Za-km-z]+) (success|failed: (.+))$/.exec(line)
    if (end) {
      if (end[1] !== frame.programId) { complete = false; continue }
      frame.status = end[2] === 'success' ? 'SUCCESS' : 'FAILED'; frame.error = end[3] ?? null; frame.end = index; stack.pop()
    }
  }
  return { frames, complete: complete && stack.length === 0 && frames.length > 0 }
}

/**
 * The log verb a frame returned, qualified by what the transaction actually kept.
 * A frame inside a failed transaction can return success and still commit nothing, so its status
 * is reported as what it returned rather than as an outcome.
 */
export function frameStatusLabel(status: Frame['status'], state: 'LANDED_SUCCESS' | 'LANDED_FAILED') {
  if (state === 'LANDED_FAILED' && status === 'SUCCESS') return 'returned success · rolled back'
  return status.toLowerCase()
}

export function buildCaseFile(raw: Receipt, provenance: { source: string; sha256: string | null }, episode?: Episode) {
  const receipt = normalizeReceipt(raw), signature = receipt.transaction!.signatures![0]
  if (episode && (episode.target.signature !== signature || episode.target.slot !== receipt.slot)) throw new Error('Episode and receipt do not match.')
  const logs = receipt.meta?.logMessages ?? [], { frames, complete } = parseFrames(logs)
  const error = receipt.meta!.err
  const metaIx = error && typeof error === 'object' && 'InstructionError' in error ? (error as { InstructionError: unknown[] }).InstructionError : null
  const failedIndex = Array.isArray(metaIx) && Number.isSafeInteger(metaIx[0]) ? metaIx[0] as number : null
  const keys = receipt.transaction!.message!.accountKeys!
  if (failedIndex != null && (failedIndex < 0 || failedIndex >= receipt.transaction!.message!.instructions!.length)) throw new Error('Failing instruction position is outside the message.')
  const outers = receipt.transaction!.message!.instructions!.map((ix, index) => {
    const key = keys[ix.programIdIndex ?? -1]
    const programId = ix.programId ?? (typeof key === 'string' ? key : key?.pubkey) ?? 'UNKNOWN'
    // `state` is how far the runtime got. `commitment` is what the ledger kept. In a failed
    // transaction nothing commits, so an earlier position is EXECUTED_NOT_COMMITTED, never
    // "completed". Do not let a position in the route imply a partially committed state transition.
    const state = error == null ? 'COMMITTED'
      : failedIndex == null ? 'UNKNOWN'
      : index > failedIndex ? 'NOT_REACHED'
      : index === failedIndex ? 'FAILED'
      : 'EXECUTED_NOT_COMMITTED'
    return { index, programId, state, commitment: error == null ? 'COMMITTED' as const : 'NOT_COMMITTED' as const }
  })
  const roots = frames.filter(f => f.parentId === null)
  const last = roots.at(-1)
  // Match the terminal root against meta.err; never promote a caught child failure.
  const metaCustom = metaIx?.[1] && typeof metaIx[1] === 'object' && 'Custom' in metaIx[1] ? (metaIx[1] as { Custom: number }).Custom : null
  const rootCustom = last?.error?.match(/custom program error: (0x[0-9a-f]+)/i)
  const customAgrees = metaCustom == null || (rootCustom != null && parseInt(rootCustom[1], 16) === metaCustom)
  const root = error != null && complete && customAgrees && last?.status === 'FAILED' && failedIndex != null && last.programId === outers[failedIndex]?.programId ? last : null
  const path: Frame[] = root ? [root] : []
  while (path.length) {
    const parent = path.at(-1)!
    const child = frames.filter(f => f.parentId === parent.id).at(-1)
    if (!child || child.status !== 'FAILED' || child.error !== parent.error) break
    // Additional application logs may describe handling and a separate rejection.
    const between = logs.slice(child.end! + 1, parent.end!)
    if (between.some(line => !line.startsWith(`Program ${parent.programId} consumed `))) break
    path.push(child)
  }
  const failure = path.at(-1) ?? null
  const scopedLogs = failure ? failure.ownLogIndices.map(i => logs[i]) : []
  // Existing receipt semantics, scoped to the observed terminal failure frame.
  const semantic = failure ? findExplicitProgramError({ ...receipt, meta: { ...receipt.meta, logMessages: scopedLogs } }, programName) : null
  const custom = failure?.error?.match(/custom program error: (0x[0-9a-f]+)/i)
  const semanticNamed = semantic && (semantic.name || semantic.quantities)
    && (!custom || semantic.code == null || semantic.code === parseInt(custom[1], 16)) ? semantic : null
  let explanation = error == null ? 'The landed transaction completed successfully.' : 'The landed transaction failed. The available evidence does not identify a complete failing invocation path.'
  if (failure) explanation = semanticNamed?.quantities
    ? `${programName(failure.programId)} reported a rejected transfer: ${semanticNamed.quantities.availableLamports.toLocaleString('en-US')} lamports were available; ${semanticNamed.quantities.requiredLamports.toLocaleString('en-US')} were required.`
    : semanticNamed ? `${programName(failure.programId)} reported ${semanticNamed.name}: ${semanticNamed.message}`
    : `${programName(failure.programId)} failed with ${failure.error}. The semantic reason remains unavailable.`
  if (failure?.error && /computational budget exceeded|exceeded CUs meter|exceeded.*compute/i.test(failure.error)) explanation = `${programName(failure.programId)} exhausted the available compute budget during execution.`
  let systemTransfer: { source: string; destination: string; lamports: number; outerIndex: number; innerIndex: number; basis: string } | null = null
  if (root && failure && failure.depth > 1 && failure.programId === '11111111111111111111111111111111') {
    const inner = receipt.meta?.innerInstructions?.find(g => g.index === failedIndex)?.instructions ?? []
    const descendants = frames.filter(f => f.start > root.start && f.start < root.end!)
    const matches = inner.length === descendants.length && inner.every((ix, i) => {
      const key = keys[ix.programIdIndex ?? -1]
      const pid = ix.programId ?? (typeof key === 'string' ? key : key?.pubkey)
      return pid === descendants[i].programId && ix.stackHeight === descendants[i].depth
    })
    const innerIndex = descendants.findIndex(f => f.id === failure.id)
    const parsed = matches && innerIndex >= 0 ? inner[innerIndex].parsed as { type?: string; info?: { source?: string; destination?: string; lamports?: number } } : null
    if (parsed?.type === 'transfer' && typeof parsed.info?.source === 'string' && typeof parsed.info.destination === 'string'
      && Number.isSafeInteger(parsed.info.lamports) && parsed.info.lamports === semanticNamed?.quantities?.requiredLamports) {
      systemTransfer = { source: parsed.info.source, destination: parsed.info.destination, lamports: parsed.info.lamports!, outerIndex: failedIndex!, innerIndex,
        basis: 'RPC-parsed System transfer; complete inner instruction sequence matched to log frames by program ID and stack height; amount agrees with the failure log.' }
    }
  }
  const computeBudget = collectComputeBudget(receipt)
  const candidatePriority = derivePriorityFeeLamports(receipt, computeBudget)
  // Abstain where requested values would need runtime clamping or unsafe arithmetic.
  // This guard is local to the research case file; production parsing is unchanged.
  const budgetInstructions = receipt.transaction!.message!.instructions!.map(ix => collectComputeBudget({ ...receipt, transaction: { ...receipt.transaction, message: { ...receipt.transaction!.message, instructions: [ix] } } }))
  const priorityUsable = computeBudget.computeUnitLimit != null && computeBudget.computeUnitLimit > 0 && computeBudget.computeUnitLimit <= 1_400_000
    && computeBudget.computeUnitPriceMicroLamports != null && Number.isSafeInteger(computeBudget.computeUnitPriceMicroLamports)
    && computeBudget.computeUnitPriceMicroLamports >= 0 && Number.isSafeInteger(computeBudget.computeUnitLimit * computeBudget.computeUnitPriceMicroLamports)
    && budgetInstructions.filter(b => b.computeUnitLimit != null).length === 1
    && budgetInstructions.filter(b => b.computeUnitPriceMicroLamports != null).length === 1
    && candidatePriority.amountLamports != null && (typeof receipt.meta?.fee !== 'number' || candidatePriority.amountLamports <= receipt.meta.fee)
  const priority = priorityUsable ? candidatePriority : { amountLamports: null, derivation: null }
  const writableComplete = keys.length > 0 && keys.every(k => typeof k !== 'string' && typeof k.writable === 'boolean' && !!k.pubkey)
  const writable = writableComplete ? keys.filter(k => typeof k !== 'string' && k.writable).map(k => (k as { pubkey: string }).pubkey) : null
  // Distinct non-ComputeBudget programs this transaction was observed to invoke, outer or via CPI.
  // Invocation is the direct evidence of reach, so logs lead; declared outer programs are the
  // fallback when no frame could be recovered. A program the transaction never reached is not
  // part of its route. This counts programs, and deliberately does not classify any of them as a
  // market: the receipt does not establish that, and guessing it is the inference being avoided.
  const invoked = frames.length ? frames.map(f => f.programId) : outers.map(o => o.programId)
  const routedPrograms = [...new Set(invoked)].filter(id => id !== COMPUTE_BUDGET_PROGRAM_ID && id !== 'UNKNOWN')
  const context = episode?.context ?? null
  const contextComplete = context?.coverage === 'COMPLETE' && context.contextTransactionsWithoutWritableMetadata === 0 && writableComplete
  const overlapAvailable = !!context && context.coverage !== 'UNAVAILABLE' && writableComplete
  const overlaps = overlapAvailable ? context.sharedWritableActivity.records : []
  const accounts = [...new Set(overlaps.flatMap(r => r.sharedWritableAccounts))].sort().map(address => ({ address,
    signatures: overlaps.filter(r => r.sharedWritableAccounts.includes(address)).map(r => r.signature) }))
  return {
    schemaVersion: CASEFILE_VERSION, signature, slot: receipt.slot, blockTime: receipt.blockTime ?? null,
    state: error == null ? 'LANDED_SUCCESS' as const : 'LANDED_FAILED' as const, explanation,
    provenance: { ...provenance, parserVersion: CASEFILE_VERSION, verification: 'Source-supplied RPC evidence; no independent consensus verification in this viewer.' },
    receipt: structuredClone(raw), execution: { frames, logs, logsComplete: complete, outers, failurePath: path.map(f => f.id), failureFrameId: failure?.id ?? null, systemTransfer,
      customError: custom ? { decimal: parseInt(custom[1], 16), hex: custom[1].toLowerCase() } : null,
      semantic: semanticNamed, failedOuterIndex: failedIndex,
      explanationEvidence: failure ? failure.ownLogIndices : [],
      attributionBoundary: 'The path locates the observed rejection inside one atomic transaction. It does not establish provider fault, intent, an external cause, or that any frame before the rejection committed state. A rejection late in the route is not evidence that the transaction reached a program late or was ordered behind another transaction.',
      stateCommitment: {
        unit: 'ATOMIC_TRANSACTION',
        outcome: error == null ? 'ALL_COMMITTED' as const : 'NONE_COMMITTED' as const,
        statement: error == null
          ? 'The transaction committed as one unit. Every instruction it executed committed together.'
          : 'The transaction committed nothing. Every instruction it executed was rolled back as one unit; the fee was still charged.',
        basis: 'The runtime commits a landed transaction all-or-nothing. This applies that rule to the observed meta.err; it is not a separate per-instruction observation and does not enumerate state roots, markets or programs that committed individually.',
        boundary: 'The transaction is the commitment unit recorded here. A route through several programs is one commitment, not one commitment per program. This model does not decode transactions that carry more than one state root, and it does not report a per-root commitment.',
      } },
    metrics: { feeLamports: receipt.meta?.fee ?? null, consumedCU: receipt.meta?.computeUnitsConsumed ?? null,
      computeBudget, priority, writableAccounts: writable,
      signerAddresses: writableComplete ? keys.filter(k => typeof k !== 'string' && k.signer).map(k => (k as { pubkey: string }).pubkey) : null },
    context: { coverage: !overlapAvailable ? 'UNAVAILABLE' : contextComplete ? 'COMPLETE' : 'PARTIAL',
      slotRange: context?.slotRange ?? { start: receipt.slot, end: receipt.slot },
      examined: context?.observedTransactionCount ?? null, count: overlapAvailable ? overlaps.length : null, accounts, overlaps,
      source: context?.sourceDescription ?? 'No neighboring evidence attached.',
      limitation: 'Declared writable-account overlap does not prove writes occurred, lock contention, execution timing or causation.' },
    missingTelemetry: [
      { question: 'When was it submitted?', required: 'An application trace with a local monotonic clock and an explicit clock domain.' },
      { question: 'Did a leader receive it?', required: 'Authenticated provider or leader telemetry joined to this signature.' },
      { question: 'Did nearby activity cause the failure?', required: 'Program-specific state evidence and a validated causal reconstruction. Account overlap alone is insufficient.' },
      { question: 'Would another path or fee have helped?', required: 'A controlled experiment or validated model with disclosed assumptions.' },
      ...(!semanticNamed && error != null ? [{ question: 'What does the opaque error mean?', required: 'Semantic logs or an error table matched to the exact program and applicable version.' }] : []),
      // Several routed programs invite a per-program reading the receipt cannot support. A route
      // reaches most of its markets through CPI, so outer instructions alone do not count it.
      ...(routedPrograms.length > 1 ? [{ question: 'What did each market or state root in this route commit?',
        required: 'Program-specific state-root decoding and observed pre/post root evidence for each root. This transaction is one commitment; the receipt records that single outcome and does not decompose it per program, market or root.' }] : []),
    ],
  }
}
export type CaseFile = ReturnType<typeof buildCaseFile>
export function caseReport(c: CaseFile) {
  return [`# Breadlines execution case file`, `Signature: ${c.signature}`, `Slot: ${c.slot}`, `State: ${c.state}`,
    '', c.explanation, `Observed failure path: ${c.execution.failurePath.map(id => programName(c.execution.frames[id].programId)).join(' → ') || 'Unavailable'}`,
    `State commitment: ${c.execution.stateCommitment.outcome}. ${c.execution.stateCommitment.statement}`,
    c.execution.attributionBoundary,
    `Context: ${c.context.coverage}; ${c.context.examined ?? 'unknown'} neighboring transactions examined; ${c.context.count ?? 'unknown'} observed overlaps.`,
    c.context.limitation, '', '## Exact evidence', ...c.execution.explanationEvidence.map(i => `Log ${i + 1}: ${c.execution.logs[i]}`),
    '', '## Missing telemetry', ...c.missingTelemetry.map(t => `${t.question} ${t.required}`), '',
    `Source: ${c.provenance.source}`, `SHA-256 of source receipt: ${c.provenance.sha256 ?? 'not recorded'}`, `Parser: ${c.schemaVersion}`].join('\n')
}
