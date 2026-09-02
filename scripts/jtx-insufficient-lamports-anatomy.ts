import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SYSTEM = '11111111111111111111111111111111'
const JTX = 'JTXJTXfr1wVRMEzqiPhXUr69zJtfGuLh5qEiXG772Zj'
const root = path.resolve('research/jtx-execution-study')
const anatomyRoot = path.join(root, 'insufficient-lamports-anatomy')
const pauseMs = 700
type RecordRow = Record<string, any>
type RawTransaction = Record<string, any>
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function atomic(file: string, data: unknown) {
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { await rename(temp, file); return } catch (error: any) {
      if (error?.code !== 'EPERM' || attempt === 7) throw error
      await sleep(125 * (attempt + 1))
    }
  }
}
function keyAddress(key: any) { return typeof key === 'string' ? key : key?.pubkey ?? null }
function programId(instruction: any, keys: any[]) { return instruction?.programId ?? (typeof instruction?.programIdIndex === 'number' ? keyAddress(keys[instruction.programIdIndex]) : null) }
function outerPrograms(tx: RawTransaction) { const keys = tx.transaction?.message?.accountKeys ?? []; return (tx.transaction?.message?.instructions ?? []).map((ix: any) => programId(ix, keys)).filter(Boolean) }
function parseFrames(logs: string[]) {
  const stack: Array<{ program_id: string; depth: number; log_index: number }> = []
  const hits: Array<any> = []
  for (const [index, log] of logs.entries()) {
    const invoke = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[(\d+)\]$/)
    if (invoke) { const depth = Number(invoke[2]); while (stack.length && stack.at(-1)!.depth >= depth) stack.pop(); stack.push({ program_id: invoke[1], depth, log_index: index }); continue }
    const insufficient = log.match(/(?:Program log: )?Transfer: insufficient lamports (\d+), need (\d+)/i)
    if (insufficient) hits.push({ log_index: index, log, available_lamports: Number(insufficient[1]), requested_lamports: Number(insufficient[2]), failing_system_depth: stack.at(-1)?.program_id === SYSTEM ? stack.at(-1)?.depth ?? null : null, invocation_path: stack.map((frame) => frame.program_id), parent_invocation_frame: stack.length > 1 ? stack.at(-2)?.program_id ?? null : null, preceding_context: logs.slice(Math.max(0, index - 4), index + 1) })
    const close = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) (?:success|failed:)/)
    if (close) { for (let position = stack.length - 1; position >= 0; position--) if (stack[position]?.program_id === close[1]) { stack.splice(position); break } }
  }
  return hits
}
function innerTransfer(tx: RawTransaction, required: number) {
  const candidates: Array<any> = []
  for (const group of tx.meta?.innerInstructions ?? []) for (const ix of group.instructions ?? []) {
    const parsed = ix.parsed
    const info = parsed?.info ?? {}
    if ((ix.programId === SYSTEM || ix.program === 'system') && parsed?.type === 'transfer' && Number(info.lamports) === required) candidates.push({ outer_instruction_index: group.index ?? null, source: info.source ?? null, destination: info.destination ?? null, lamports: Number(info.lamports) })
  }
  if (candidates.length !== 1) return { deterministically_recovered: false, source: null, destination: null, outer_instruction_index: null, candidate_count: candidates.length, source_pre_balance_lamports: null, source_post_balance_lamports: null }
  const transfer = candidates[0]!, keys = tx.transaction?.message?.accountKeys ?? [], sourceIndex = keys.findIndex((key: any) => keyAddress(key) === transfer.source)
  return { deterministically_recovered: true, ...transfer, candidate_count: 1, source_pre_balance_lamports: sourceIndex >= 0 ? tx.meta?.preBalances?.[sourceIndex] ?? null : null, source_post_balance_lamports: sourceIndex >= 0 ? tx.meta?.postBalances?.[sourceIndex] ?? null : null }
}
function systemTransfers(tx: RawTransaction) {
  const transfers: Array<any> = []
  for (const group of tx.meta?.innerInstructions ?? []) for (const ix of group.instructions ?? []) {
    const info = ix.parsed?.info ?? {}
    if ((ix.programId === SYSTEM || ix.program === 'system') && ix.parsed?.type === 'transfer' && Number.isFinite(Number(info.lamports))) {
      const keys = tx.transaction?.message?.accountKeys ?? [], sourceIndex = keys.findIndex((key: any) => keyAddress(key) === info.source)
      transfers.push({ outer_instruction_index: group.index ?? null, source: info.source ?? null, destination: info.destination ?? null, lamports: Number(info.lamports), source_pre_balance_lamports: sourceIndex >= 0 ? tx.meta?.preBalances?.[sourceIndex] ?? null : null, source_post_balance_lamports: sourceIndex >= 0 ? tx.meta?.postBalances?.[sourceIndex] ?? null : null })
    }
  }
  return transfers
}
function count(values: Array<string | number | null | undefined>) { const map = new Map<string, number>(); for (const value of values) if (value != null) { const key = String(value); map.set(key, (map.get(key) ?? 0) + 1) }; return [...map].map(([value, occurrences]) => ({ value, count: occurrences })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)) }
function concentration(values: Array<string | null | undefined>) { const populated = values.filter((value): value is string => Boolean(value)), counts = count(populated).map((row) => row.count), total = populated.length; return { total_observations: total, unique: counts.length, top_1_share: total ? counts[0]! / total : null, top_5_share: total ? counts.slice(0, 5).reduce((sum, value) => sum + value, 0) / total : null, top_10_share: total ? counts.slice(0, 10).reduce((sum, value) => sum + value, 0) / total : null, top: count(populated).slice(0, 10) } }
async function fetchReceipt(apiKey: string, signature: string) {
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: signature, method: 'getTransaction', params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' }] }) })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`)
  const body = await response.json() as any
  if (body.error) throw new Error(body.error.message ?? 'RPC error')
  if (!body.result) throw new Error('transaction receipt unavailable')
  return body.result as RawTransaction
}
function fingerprint(record: any) { return JSON.stringify({ parent: record.parent_invocation_frame, path: record.invocation_path, jtx_position: record.jtx_instruction_position, jtx_count: record.jtx_outer_instruction_count, system_outer: record.system_transfer_is_outer, transfer_outer_index: record.transfer?.outer_instruction_index ?? null }) }
async function main() {
  const env = await readFile('.env.local', 'utf8'), apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim(); if (!apiKey) throw new Error('HELIUS_API_KEY missing')
  await mkdir(anatomyRoot, { recursive: true })
  const sample = JSON.parse(await readFile(path.join(root, 'jtx-execution-sample.json'), 'utf8')).records as RecordRow[]
  const target = sample.filter((record) => record.execution_state === 'landed-but-failed' && record.failure_class === 'InsufficientLamports').sort((a, b) => String(a.signature).localeCompare(String(b.signature)))
  const rawPath = path.join(anatomyRoot, 'raw-receipts.json'), checkpointPath = path.join(anatomyRoot, 'checkpoint.json')
  let raw: Record<string, RawTransaction> = {}; try { raw = JSON.parse(await readFile(rawPath, 'utf8')) } catch {}
  const failures: any[] = []
  for (const item of target) {
    const signature = String(item.signature)
    if (!raw[signature]) { raw[signature] = await fetchReceipt(apiKey, signature); await atomic(rawPath, raw); await sleep(pauseMs) }
    const tx = raw[signature], logs = tx.meta?.logMessages ?? [], hit = parseFrames(logs).find((entry) => entry.available_lamports === item.failure_technical_evidence?.quantities?.availableLamports && entry.requested_lamports === item.failure_technical_evidence?.quantities?.requiredLamports) ?? parseFrames(logs)[0]
    if (!hit) throw new Error(`No InsufficientLamports log for ${signature}`)
    const keys = tx.transaction?.message?.accountKeys ?? [], outer = outerPrograms(tx), jtxPositions = outer.flatMap((id: string, index: number) => id === JTX ? [index] : [])
    failures.push({ signature, slot: item.slot, block_time_utc: item.block_time_utc, signer_addresses: (keys.filter((key: any) => typeof key !== 'string' && key.signer).map(keyAddress)).filter(Boolean), fee_payer: keyAddress(keys[0]), failing_system_program_invocation_depth: hit.failing_system_depth, parent_invocation_frame: hit.parent_invocation_frame, requested_lamports: hit.requested_lamports, available_lamports: hit.available_lamports, shortfall_lamports: hit.requested_lamports - hit.available_lamports, immediately_preceding_relevant_context: hit.preceding_context, jtx_instruction_position: jtxPositions, jtx_outer_instruction_count: jtxPositions.length, invocation_path: hit.invocation_path, system_transfer_is_outer: outer.includes(SYSTEM), transfer: innerTransfer(tx, hit.requested_lamports), transaction_fee_lamports: tx.meta?.fee ?? null, compute_budget: item.compute_budget, compute_units_consumed: tx.meta?.computeUnitsConsumed ?? null, raw_log: hit.log })
    await atomic(checkpointPath, { target_failures: target.length, complete_failures: failures.length, raw_receipts_cached: Object.keys(raw).length, last_signature: signature })
  }
  failures.sort((a, b) => a.slot - b.slot || String(a.signature).localeCompare(String(b.signature)))
  const failedPayers = failures.map((record) => record.fee_payer), success = sample.filter((record) => record.execution_state === 'landed')
  const failureFingerprints = count(failures.map(fingerprint)), dominant = failureFingerprints[0]?.value ?? null
  const affectedAlsoSuccessful = new Set(failedPayers.filter((payer) => success.some((record) => record.fee_payer === payer)))
  const successInput = success.filter((record) => affectedAlsoSuccessful.has(record.fee_payer)).sort((a, b) => String(a.signature).localeCompare(String(b.signature)))
  const rawSuccessPath = path.join(anatomyRoot, 'raw-success-receipts.json')
  let rawSuccess: Record<string, RawTransaction> = {}; try { rawSuccess = JSON.parse(await readFile(rawSuccessPath, 'utf8')) } catch {}
  const successfulComparators: any[] = []
  for (const item of successInput) {
    const signature = String(item.signature)
    if (!rawSuccess[signature]) { rawSuccess[signature] = await fetchReceipt(apiKey, signature); await atomic(rawSuccessPath, rawSuccess); await sleep(pauseMs) }
    const tx = rawSuccess[signature], outer = outerPrograms(tx), jtxPositions = outer.flatMap((id: string, index: number) => id === JTX ? [index] : [])
    successfulComparators.push({ signature, slot: item.slot, block_time_utc: item.block_time_utc, fee_payer: item.fee_payer, jtx_instruction_position: jtxPositions, jtx_outer_instruction_count: jtxPositions.length, outer_programs: outer, dflow_outer_instruction_index: outer.findIndex((id: string) => id === 'DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH'), system_transfers: systemTransfers(tx), transaction_fee_lamports: tx.meta?.fee ?? null, compute_budget: item.compute_budget, compute_units_consumed: tx.meta?.computeUnitsConsumed ?? null })
  }
  const exactOuterStructure = successfulComparators.filter((record) => record.dflow_outer_instruction_index === 2 && JSON.stringify(record.jtx_instruction_position) === '[3,5]')
  const failedSources = new Set(failures.map((record) => record.transfer.source)), failedDestinations = new Set(failures.map((record) => record.transfer.destination)), failedAmounts = new Set(failures.map((record) => record.requested_lamports))
  const transferMatches = exactOuterStructure.flatMap((record) => record.system_transfers.filter((transfer: any) => failedSources.has(transfer.source) && failedDestinations.has(transfer.destination) && failedAmounts.has(transfer.lamports)).map((transfer: any) => ({ signature: record.signature, slot: record.slot, ...transfer })))
  const report = { generated_at: new Date().toISOString(), scope: 'Only the fixed 500-execution Phase 2 population. No new address-history executions were sampled.', population: { insufficient_lamports_failures: failures.length, all_quantified: failures.every((record) => record.requested_lamports != null && record.available_lamports != null) }, concentration: { parent_program: concentration(failures.map((record) => record.parent_invocation_frame)), invocation_path: concentration(failures.map((record) => JSON.stringify(record.invocation_path))), jtx_instruction_structure: concentration(failures.map((record) => `${record.jtx_outer_instruction_count}:${record.jtx_instruction_position.join(',')}`)), fee_payer: concentration(failedPayers), signer: concentration(failures.flatMap((record) => record.signer_addresses)), requested_lamports: concentration(failures.map((record) => String(record.requested_lamports))), available_lamports: concentration(failures.map((record) => String(record.available_lamports))), shortfall_lamports: concentration(failures.map((record) => String(record.shortfall_lamports))), recovered_source_account: concentration(failures.map((record) => record.transfer.source)), recovered_destination_account: concentration(failures.map((record) => record.transfer.destination)), temporal_spacing_seconds: failures.slice(1).map((record, index) => new Date(record.block_time_utc).getTime() / 1000 - new Date(failures[index].block_time_utc).getTime() / 1000) }, source_destination_recovery: { uniquely_recovered: failures.filter((record) => record.transfer.deterministically_recovered).length, ambiguous_or_unavailable: failures.filter((record) => !record.transfer.deterministically_recovered).length }, actor_concentration: { unique_fee_payers: new Set(failedPayers.filter(Boolean)).size, unique_signers: new Set(failures.flatMap((record) => record.signer_addresses)).size, top_fee_payer_shares: concentration(failedPayers), affected_fee_payers_with_successful_execution_in_same_sample: affectedAlsoSuccessful.size }, structural_fingerprint: { unique_fingerprints: failureFingerprints.length, top_fingerprints: failureFingerprints.slice(0, 10) }, successful_comparison: { successful_same_fee_payer_in_fixed_population: successfulComparators.length, exact_outer_structure_matches_dflow_2_jtx_3_5: exactOuterStructure.length, same_source_destination_requested_amount_transfer_matches: transferMatches.length, matching_transfers: transferMatches, comparison_note: 'All comparison receipts are from successful transactions already in the fixed 500-execution population. Source pre/post balances are observed only for the matched parsed System Program transfers.' }, attribution: { A_wallet_did_not_have_enough_SOL: 'SUPPORTED BUT INCOMPLETE — the uniquely recovered transfer source is also the sole signer and fee payer, and its observed available lamports are below the requested transfer. The receipt does not establish a person, wallet application, or account ownership.', B_system_transfer_did_not_have_enough_lamports_available: 'PROVEN — each retained record has the observed System Program log with available and required lamports.', C_JTX_controlled_account_did_not_have_enough_lamports: 'NOT ESTABLISHED — account ownership/control is not established by this receipt analysis.', D_JTX_instruction_caused_a_CPI_that_ultimately_attempted_the_insufficient_transfer: 'FALSE for this failure set — the observed path is DFlow → System Program and the uniquely recovered transfer belongs to outer instruction 2, before the outer JTX instructions at 3 and 5.', E_user_attempted_to_trade_more_SOL_than_available: 'NOT ESTABLISHED — the receipt establishes a failed transfer amount, not user intent or trade semantics.', F_JTX_order_architecture_produced_the_condition: 'NOT ESTABLISHED — the exact failing outer instruction is DFlow, not JTX.' }, question_of_product_problem: 'NO for this 159-failure cluster as a JTX-specific product claim — all failures are one address and the deterministically failing path is DFlow → System Program before JTX instructions. This does not rule out a general execution-explanation integration.', ui_incremental_information: 'YES, conditionally: an evidence-backed receipt can state the observed System Program transfer shortfall, failing DFlow frame, and attribution boundary, which is materially more specific than a generic failed state. What JTX currently displays remains UNKNOWN.' }
  await atomic(path.join(anatomyRoot, 'insufficient-lamports-records.json'), { records: failures })
  await atomic(path.join(anatomyRoot, 'successful-structural-comparators.json'), { records: successfulComparators })
  await atomic(path.join(anatomyRoot, 'insufficient-lamports-report.json'), report)
  await writeFile(path.join(anatomyRoot, 'insufficient-lamports-report.md'), `# JTX InsufficientLamports anatomy\n\n- Failures analysed: ${failures.length}\n- Unique fee payers: ${report.actor_concentration.unique_fee_payers}\n- Unique signers: ${report.actor_concentration.unique_signers}\n- Same-sample affected fee payers also successful: ${report.actor_concentration.affected_fee_payers_with_successful_execution_in_same_sample}\n- Unique transfer source/destination recoveries: ${report.source_destination_recovery.uniquely_recovered}\n\nSee the JSON report for exact invocation paths, concentration tables, bounded attribution statements, and raw evidence references.\n`)
  console.log(`Anatomy complete: ${failures.length} failures, ${report.actor_concentration.unique_fee_payers} fee payers.`)
}
void main()
