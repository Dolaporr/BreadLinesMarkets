import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collectComputeBudget, deriveExecutionState, derivePriorityFeeLamports, documentedErrorHeadline, findExplicitProgramError, type ReceiptRpcAccountKey, type ReceiptRpcInstruction, type ReceiptRpcTransaction } from '../lib/receipt-evidence.ts'

const JTX_PROGRAM = 'JTXJTXfr1wVRMEzqiPhXUr69zJtfGuLh5qEiXG772Zj'
const TARGET = 500
const FULL_PAGE_LIMIT = 100
const CREDITS_PER_FULL_PAGE = 50 // User-specified current billing assumption, recorded without inference.
const root = path.resolve('research/jtx-execution-study')
type Key = ReceiptRpcAccountKey
type Tx = ReceiptRpcTransaction & { blockTime?: number | null; transactionIndex?: number; meta?: ReceiptRpcTransaction['meta'] & { innerInstructions?: Array<{ instructions?: ReceiptRpcInstruction[] }> } }
type RpcResult = { result?: { data?: Tx[]; paginationToken?: string | null }; error?: { message?: string } }
const address = (key: Key | undefined) => typeof key === 'string' ? key : key?.pubkey
const percentile = (values: number[], p: number) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b), x = (sorted.length - 1) * p, lo = Math.floor(x), hi = Math.ceil(x); return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo) }
const iso = (seconds: number | null | undefined) => seconds == null ? null : new Date(seconds * 1_000).toISOString()
async function atomic(file: string, data: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`); await rename(temp, file) }
async function rpc(apiKey: string, params: unknown[]) {
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransactionsForAddress', params }) })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const body = await response.json() as RpcResult
  if (body.error) throw new Error(`RPC error: ${body.error.message ?? 'unknown'}`)
  return body.result ?? { data: [], paginationToken: null }
}
function instructionProgramId(instruction: ReceiptRpcInstruction, keys: Key[]) {
  const direct = instruction.programId
  if (direct) return direct
  const compiled = instruction as ReceiptRpcInstruction & { programIdIndex?: number }
  return typeof compiled.programIdIndex === 'number' ? address(keys[compiled.programIdIndex]) : undefined
}
function outerPrograms(tx: Tx) {
  const keys = tx.transaction?.message?.accountKeys ?? []
  return tx.transaction?.message?.instructions?.map((instruction) => instructionProgramId(instruction, keys)).filter((id): id is string => Boolean(id)) ?? []
}
function invokedStack(tx: Tx) { return (tx.meta?.logMessages ?? []).flatMap((line) => line.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[\d+\]$/)?.[1] ?? []) }
function failureLogs(tx: Tx) { return (tx.meta?.logMessages ?? []).filter((line) => /failed:|Error:|TXFAILINFO:|insufficient lamports/i.test(line)) }
function failureFrame(tx: Tx) { const logs = tx.meta?.logMessages ?? []; for (let index = logs.length - 1; index >= 0; index--) { const match = logs[index]?.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) failed:/); if (match) return { programId: match[1], log: logs[index] } } return null }
function routePrograms(tx: Tx) { const ids = new Set([...outerPrograms(tx), ...invokedStack(tx)]); return [...ids].flatMap((id) => id === 'DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH' ? [{ id, label: 'DFlow (observed program only)' }] : id === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' ? [{ id, label: 'Jupiter (observed program only)' }] : []) }
function classify(tx: Tx) {
  const state = deriveExecutionState(tx), error = state === 'landed-but-failed' ? findExplicitProgramError(tx, (id) => id === JTX_PROGRAM ? 'JTX' : 'Unknown Program') : null
  if (state !== 'landed-but-failed') return { category: null, error, headline: null, useful: null }
  const actionable = Boolean(error && (error.quantities || error.structuredEvidence?.length || (error.name && error.name !== 'InvalidStatus' && !/^Custom program error/i.test(error.message))))
  const category = actionable ? 'DOCUMENTED_ACTIONABLE' : error ? 'DOCUMENTED_TECHNICAL' : 'INSUFFICIENT_EVIDENCE'
  return { category, error, headline: documentedErrorHeadline({ executionState: state, slot: tx.slot, executionError: error }), useful: actionable }
}
function row(tx: Tx) {
  const keys = tx.transaction?.message?.accountKeys ?? [], signers = keys.filter((key) => typeof key !== 'string' && key.signer).map(address).filter((value): value is string => Boolean(value)), budget = collectComputeBudget(tx), priority = derivePriorityFeeLamports(tx, budget), outcome = classify(tx), outer = outerPrograms(tx), stack = invokedStack(tx)
  return { signature: tx.transaction?.signatures?.[0] ?? null, slot: tx.slot, block_time_utc: iso(tx.blockTime), execution_state: deriveExecutionState(tx), fee_payer: signers[0] ?? address(keys[0]) ?? null, signers, total_fee_lamports: tx.meta?.fee ?? null, compute_budget: budget, derived_priority_fee_lamports: priority.amountLamports, priority_fee_derivation: priority.derivation, compute_units_consumed: tx.meta?.computeUnitsConsumed ?? null, jtx_outer_instruction_count: outer.filter((id) => id === JTX_PROGRAM).length, outer_programs: outer, invoked_program_stack: stack, writable_account_count: keys.filter((key) => typeof key !== 'string' && key.writable).length, route_programs_observed: routePrograms(tx), failure_category: outcome.category, failing_program: outcome.error?.programId ?? failureFrame(tx)?.programId ?? null, failing_invocation_frame: failureFrame(tx), failure_logs_exact: failureLogs(tx), strongest_deterministic_human_readable_evidence: outcome.headline, failure_class: outcome.error?.name ?? (outcome.error?.code != null ? `custom-error-${outcome.error.code}` : null), failure_technical_evidence: outcome.error, useful_deterministic_evidence_beyond_generic_or_raw_custom: outcome.useful, raw_log_messages: tx.meta?.logMessages ?? [] }
}
function count(values: Array<string | null | undefined>) { const map = new Map<string, number>(); for (const value of values) if (value) map.set(value, (map.get(value) ?? 0) + 1); return [...map].map(([value, total]) => ({ value, count: total })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)) }
async function main() {
  const env = await readFile('.env.local', 'utf8'), apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim(); if (!apiKey) throw new Error('HELIUS_API_KEY is required')
  await mkdir(root, { recursive: true })
  const startedAt = new Date(), endUnix = Math.floor(startedAt.getTime() / 1_000), protocolPath = path.join(root, 'study-protocol.json')
  await atomic(protocolPath, { generated_at: startedAt.toISOString(), inclusion_fingerprint: JTX_PROGRAM, target_attributable_executions: TARGET, observation_end_utc: startedAt.toISOString(), observation_start_utc: null, ordering: 'Most-recent consecutive JTX-program-address history ending at observation_end_utc; retain in API descending order, then output ascending chronological order.', transaction_selection: 'No success/failure, signer, fee, route, token, order-type, or behavior filter.', stopping_rule: `Stop after the first ${TARGET} locally verified outer-JTX invocations encountered in deterministic reverse-chronological pagination.`, billing_assumption_helius_credits_per_full_page: CREDITS_PER_FULL_PAGE, full_page_limit: FULL_PAGE_LIMIT })
  const retained: Tx[] = [], rejected: Array<{ signature: string | null; reason: string }> = []; let token: string | null | undefined = null, pages = 0
  while (retained.length < TARGET) {
    const result = await rpc(apiKey, [JTX_PROGRAM, { transactionDetails: 'full', sortOrder: 'desc', limit: FULL_PAGE_LIMIT, maxSupportedTransactionVersion: 0, filters: { blockTime: { lte: endUnix }, status: 'any', tokenAccounts: 'none' }, ...(token ? { paginationToken: token } : {}) }])
    pages++; const data = result.data ?? []; if (!data.length) break
    for (const tx of data) { if (outerPrograms(tx).includes(JTX_PROGRAM)) retained.push(tx); else rejected.push({ signature: tx.transaction?.signatures?.[0] ?? null, reason: 'address query result did not contain an outer JTX invocation' }); if (retained.length === TARGET) break }
    token = result.paginationToken; if (!token) break
    await atomic(path.join(root, 'collection-checkpoint.json'), { pages_fetched: pages, retained_outer_jtx: retained.length, rejected_non_outer: rejected.length, next_pagination_token: token, observation_end_utc: startedAt.toISOString() })
  }
  const records = retained.sort((a, b) => (a.slot - b.slot) || ((a.transactionIndex ?? 0) - (b.transactionIndex ?? 0))).map(row)
  const firstRecord = records[0] ?? null, lastRecord = records.length ? records[records.length - 1] : null
  await atomic(protocolPath, {
    generated_at: startedAt.toISOString(), inclusion_fingerprint: JTX_PROGRAM, target_attributable_executions: TARGET,
    observation_end_utc: startedAt.toISOString(), observation_start_utc: firstRecord?.block_time_utc ?? null,
    ordering: 'Most-recent consecutive JTX-program-address history ending at observation_end_utc; retain in API descending order, then output ascending chronological order.',
    transaction_selection: 'No success/failure, signer, fee, route, token, order-type, or behavior filter.',
    stopping_rule: `Stop after the first ${TARGET} locally verified outer-JTX invocations encountered in deterministic reverse-chronological pagination.`,
    billing_assumption_helius_credits_per_full_page: CREDITS_PER_FULL_PAGE, full_page_limit: FULL_PAGE_LIMIT,
    retained_first_slot: firstRecord?.slot ?? null, retained_last_slot: lastRecord?.slot ?? null
  })
  const failed = records.filter((record) => record.execution_state === 'landed-but-failed'), successful = records.filter((record) => record.execution_state === 'landed')
  const representative = [...new Map(failed.sort((a, b) => `${a.failure_category}|${a.failure_class ?? ''}|${a.failing_program ?? ''}`.localeCompare(`${b.failure_category}|${b.failure_class ?? ''}|${b.failing_program ?? ''}`) || String(a.signature).localeCompare(String(b.signature))).map((record) => [`${record.failure_category}|${record.failure_class ?? ''}|${record.failing_program ?? ''}`, record])).values()].slice(0, 10).map((record) => ({ signature: record.signature, raw_chain_evidence: { failing_frame: record.failing_invocation_frame, failure_logs_exact: record.failure_logs_exact, total_fee_lamports: record.total_fee_lamports, compute_units_consumed: record.compute_units_consumed }, breadlines_interpretation: record.strongest_deterministic_human_readable_evidence, classification: record.failure_category }))
  const numeric = (values: Array<number | null | undefined>) => values.filter((value): value is number => typeof value === 'number')
  const report = {
    generated_at: new Date().toISOString(), protocol: JSON.parse(await readFile(protocolPath, 'utf8')),
    collection: { pages_fetched: pages, helius_credit_estimate: pages * CREDITS_PER_FULL_PAGE, retained_outer_jtx: records.length, rejected_non_outer: rejected.length, complete_target: records.length === TARGET },
    totals: { total_attributable_jtx_executions: records.length, successful: successful.length, landed_but_failed: failed.length, failure_rate: records.length ? failed.length / records.length : null, documented_actionable_failures: failed.filter((record) => record.failure_category === 'DOCUMENTED_ACTIONABLE').length, documented_technical_failures: failed.filter((record) => record.failure_category === 'DOCUMENTED_TECHNICAL').length, insufficient_evidence_failures: failed.filter((record) => record.failure_category === 'INSUFFICIENT_EVIDENCE').length, useful_deterministic_evidence_beyond_generic_or_raw_custom: failed.filter((record) => record.useful_deterministic_evidence_beyond_generic_or_raw_custom).length, useful_deterministic_evidence_percentage_of_failed: failed.length ? failed.filter((record) => record.useful_deterministic_evidence_beyond_generic_or_raw_custom).length / failed.length : null },
    top_failing_programs: count(failed.map((record) => record.failing_program)), top_documented_failure_classes: count(failed.map((record) => record.failure_class)),
    fees_paid_lamports_by_failed: { count: failed.filter((record) => record.total_fee_lamports != null).length, total: failed.reduce((sum, record) => sum + (record.total_fee_lamports ?? 0), 0), p50: percentile(numeric(failed.map((record) => record.total_fee_lamports)), .5), p95: percentile(numeric(failed.map((record) => record.total_fee_lamports)), .95) },
    compute_units_consumed: {
      successful: { p50: percentile(numeric(successful.map((record) => record.compute_units_consumed)), .5), p95: percentile(numeric(successful.map((record) => record.compute_units_consumed)), .95), count: successful.filter((record) => record.compute_units_consumed != null).length },
      failed: { p50: percentile(numeric(failed.map((record) => record.compute_units_consumed)), .5), p95: percentile(numeric(failed.map((record) => record.compute_units_consumed)), .95), count: failed.filter((record) => record.compute_units_consumed != null).length }
    },
    repeated_signer_observations: count(records.map((record) => record.fee_payer)).filter((row) => row.count > 1), ui_visibility: 'UNKNOWN from on-chain evidence. This study does not assert what JTX shows users.'
  }
  await atomic(path.join(root, 'jtx-execution-sample.json'), { records })
  await atomic(path.join(root, 'representative-failures.json'), { selection: 'One lexicographically earliest signature per deterministic failure-category/class/failing-program group; first ten groups.', examples: representative })
  await atomic(path.join(root, 'jtx-execution-report.json'), report)
  await writeFile(path.join(root, 'jtx-execution-report.md'), `# JTX execution study\n\n- Fixed observation end: ${startedAt.toISOString()}\n- Retained attributable executions: ${records.length}\n- Successful: ${successful.length}\n- Landed but failed: ${failed.length}\n- Failure rate: ${report.totals.failure_rate}\n- Actionable / technical / insufficient: ${report.totals.documented_actionable_failures} / ${report.totals.documented_technical_failures} / ${report.totals.insufficient_evidence_failures}\n- Useful deterministic evidence beyond a generic/raw-custom failure: ${report.totals.useful_deterministic_evidence_beyond_generic_or_raw_custom} (${report.totals.useful_deterministic_evidence_percentage_of_failed})\n- Estimated Helius credits: ${report.collection.helius_credit_estimate} (${pages} full pages × ${CREDITS_PER_FULL_PAGE})\n\nOn-chain evidence does not establish JTX UI visibility.\n`)
  console.log(`JTX sample complete: ${records.length} attributable executions; ${failed.length} landed-but-failed; ${pages} pages.`)
}
void main()
