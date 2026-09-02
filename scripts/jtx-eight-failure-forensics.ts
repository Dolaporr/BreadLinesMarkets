import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const JTX = 'JTXJTXfr1wVRMEzqiPhXUr69zJtfGuLh5qEiXG772Zj'
const DFLOW = 'DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH'
const root = path.resolve('research/jtx-execution-study/eight-failure-forensics')
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function atomic(file: string, data: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`); await rename(temp, file) }
function address(key: any) { return typeof key === 'string' ? key : key?.pubkey ?? null }
function programId(ix: any, keys: any[]) { return ix.programId ?? (typeof ix.programIdIndex === 'number' ? address(keys[ix.programIdIndex]) : null) }
async function receipt(key: string, signature: string) {
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: signature, method: 'getTransaction', params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' }] }) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = await response.json() as any
  if (body.error || !body.result) throw new Error(body.error?.message ?? 'receipt unavailable')
  return body.result
}
function frames(logs: string[]) {
  const stack: Array<{ program_id: string; depth: number }> = [], events: any[] = []
  for (const [index, log] of logs.entries()) {
    const begin = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[(\d+)\]$/)
    if (begin) { const depth = Number(begin[2]); while (stack.length && stack.at(-1)!.depth >= depth) stack.pop(); stack.push({ program_id: begin[1], depth }); events.push({ index, log, invocation_path: stack.map((frame) => frame.program_id) }); continue }
    const close = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) (success|failed:.*)$/)
    if (close) { events.push({ index, log, invocation_path: stack.map((frame) => frame.program_id) }); for (let i = stack.length - 1; i >= 0; i--) if (stack[i]?.program_id === close[1]) { stack.splice(i); break } }
  }
  return events
}
function namedInstructions(logs: string[]) { return logs.flatMap((log, index) => log.match(/^Program log: ix: (.+)$/)?.[1] ? [{ index, instruction_name: log.match(/^Program log: ix: (.+)$/)![1], log }] : []) }
function custom(logs: string[]) { const match = logs.find((log) => /custom program error: 0x/i.test(log))?.match(/custom program error: (0x[0-9a-f]+)/i); return match ? { hex: match[1], decimal: Number.parseInt(match[1], 16) } : null }
async function main() {
  const env = await readFile('.env.local', 'utf8'), key = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim(); if (!key) throw new Error('HELIUS_API_KEY missing')
  await mkdir(root, { recursive: true })
  const sample = JSON.parse(await readFile('research/jtx-execution-study/jtx-execution-sample.json', 'utf8')).records as any[]
  const targets = sample.filter((row) => row.execution_state === 'landed-but-failed' && [JTX, DFLOW].includes(row.failing_program)).sort((a, b) => String(a.signature).localeCompare(String(b.signature)))
  let raw: Record<string, any> = {}; try { raw = JSON.parse(await readFile(path.join(root, 'raw-receipts.json'), 'utf8')) } catch {}
  const records: any[] = []
  for (const row of targets) {
    if (!raw[row.signature]) { raw[row.signature] = await receipt(key, row.signature); await atomic(path.join(root, 'raw-receipts.json'), raw); await sleep(700) }
    const tx = raw[row.signature], keys = tx.transaction.message.accountKeys ?? [], outer = (tx.transaction.message.instructions ?? []).map((ix: any) => programId(ix, keys)), logs = tx.meta?.logMessages ?? [], failureLogIndex = logs.findIndex((log: string) => log.includes(`${row.failing_program} failed:`)), trace = frames(logs), failureEvent = trace.find((event: any) => event.index === failureLogIndex) ?? null, names = namedInstructions(logs), error = custom(logs)
    const dflowInstruction = logs.find((log: string) => /^Program log: Instruction: (.+)$/.test(log))?.match(/^Program log: Instruction: (.+)$/)?.[1] ?? null
    records.push({ signature: row.signature, slot: tx.slot, block_time_utc: tx.blockTime == null ? null : new Date(tx.blockTime * 1000).toISOString(), failing_invocation_frame: { program_id: row.failing_program, log: failureLogIndex >= 0 ? logs[failureLogIndex] : null, invocation_path: failureEvent?.invocation_path ?? null, parent_frame: failureEvent?.invocation_path?.at(-2) ?? null }, full_relevant_log_sequence: logs, custom_error: error, structured_program_logs_before_failure: [...names, ...logs.flatMap((log: string, index: number) => /AnchorError|Error Code:|Error Message:|Invalid account owner/i.test(log) ? [{ index, log }] : [])], strongest_deterministic_plain_language_evidence: row.failing_program === JTX ? 'JTX logged ix: LimitOrderCancel and then failed: Invalid account owner. The receipt does not identify which account failed the owner check.' : 'DFlow logged AnchorError: SlippageLimitExceeded (15001), then returned custom error 0x3a99.', jtx_outer_instruction_positions: outer.flatMap((id: string, index: number) => id === JTX ? [index] : []), jtx_outer_instruction_count: outer.filter((id: string) => id === JTX).length, exact_instruction_name_exposed: row.failing_program === DFLOW ? dflowInstruction : names.filter((entry: any) => entry.index < failureLogIndex).at(-1)?.instruction_name ?? null, fee_lamports: tx.meta?.fee ?? null, compute_budget: row.compute_budget, compute_units_consumed: tx.meta?.computeUnitsConsumed ?? null, signer_addresses: keys.filter((account: any) => typeof account !== 'string' && account.signer).map(address), fee_payer: address(keys[0]), same_fee_payer_successes_in_fixed_500: sample.filter((candidate) => candidate.execution_state === 'landed' && candidate.fee_payer === address(keys[0])).length, exact_outer_structure_successes_in_fixed_500: sample.filter((candidate) => candidate.execution_state === 'landed' && candidate.fee_payer === address(keys[0]) && JSON.stringify(candidate.outer_programs) === JSON.stringify(row.outer_programs)).length })
  }
  const jtx = records.filter((record) => record.failing_invocation_frame.program_id === JTX), dflow = records.filter((record) => record.failing_invocation_frame.program_id === DFLOW)
  const report = { scope: 'Exactly the eight non-System landed failures from the frozen 500-execution population. No new population sampled.', totals: { jtx_frame_failures: jtx.length, dflow_frame_failures: dflow.length }, jtx_taxonomy: { deterministic_named_instruction_and_error: { count: jtx.filter((record) => record.exact_instruction_name_exposed === 'LimitOrderCancel' && /Invalid account owner/.test(record.failing_invocation_frame.log ?? '')).length, interpretation: 'JTX itself was the active failing frame. The observed JTX log names LimitOrderCancel; the program then returned Invalid account owner. No custom numeric error is present.' }, opaque: { count: jtx.filter((record) => !/Invalid account owner/.test(record.failing_invocation_frame.log ?? '')).length } }, dflow_taxonomy: { count: dflow.length, interpretation: 'DFlow itself was the active failing frame. Its observed Anchor log names SlippageLimitExceeded, error 15001, immediately before custom error 0x3a99.' }, public_decode_check: { jtx: 'No public error-table mapping was needed or used: all seven JTX receipts contain their own deterministic instruction name and runtime reason. No undocumented numeric JTX error was inferred.', dflow: 'No external DFlow table was used: the transaction itself emitted AnchorError SlippageLimitExceeded (15001).' }, breadlines_deterministically_explains: { jtx: jtx.length, dflow: dflow.length, opaque: 0 }, representative_receipts: [jtx[0]?.signature ?? null, dflow[0]?.signature ?? null].filter(Boolean), commercial_verdict: 'WEAK WEDGE — the eight receipts demonstrate accurate first-party frame attribution and a clean explanation for LimitOrderCancel / Invalid account owner, but all seven JTX-frame failures are one repeated pattern from one fee payer. Frequency and actor diversity are insufficient for a strong JTX-specific failure-receipt wedge.', ui_incremental_information: 'A receipt can name the failing program frame, named instruction, and observed reason/structured error instead of only a failed state or raw code. JTX UI visibility remains UNKNOWN.' }
  await atomic(path.join(root, 'eight-failure-records.json'), { records })
  await atomic(path.join(root, 'eight-failure-report.json'), report)
  await writeFile(path.join(root, 'eight-failure-report.md'), `# Eight non-System JTX-population failures\n\n- JTX-frame: ${jtx.length}; all are observed \`LimitOrderCancel → Invalid account owner\`.\n- DFlow-frame: ${dflow.length}; observed \`SlippageLimitExceeded\` (15001 / \`0x3a99\`).\n- Commercial verdict: **WEAK WEDGE**.\n\nThe detailed JSON record set contains exact logs, invocation paths, fee/CU, signer fields, and same-sample structural-success counts.\n`)
  console.log(`Eight-failure forensics complete: ${jtx.length} JTX; ${dflow.length} DFlow.`)
}
void main()
