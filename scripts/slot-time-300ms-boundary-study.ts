import { appendFile, mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

type RpcInstruction = { programIdIndex?: number; data?: string }
type RpcTransaction = { transaction?: { message?: { accountKeys?: string[]; instructions?: RpcInstruction[] }; signatures?: string[] }; meta?: { err?: unknown; fee?: number; computeUnitsConsumed?: number; costUnits?: number }; version?: string | number }
type Block = { blockTime?: number | null; transactions?: RpcTransaction[] }
type WindowLabel = 'before_60m' | 'after_60m' | 'before_3h' | 'after_3h' | 'before_6h' | 'after_6h' | 'before_12h' | 'after_12h' | 'before_24h' | 'after_24h' | 'before_60m_buffered' | 'after_60m_buffered' | 'before_3h_buffered' | 'after_3h_buffered' | 'before_6h_buffered' | 'after_6h_buffered' | 'before_12h_buffered' | 'after_12h_buffered' | 'before_24h_buffered' | 'after_24h_buffered'
type Snapshot = { slot: number; blockTime: number | null; window: WindowLabel; aggregate: BlockAggregate }
type BlockAggregate = { landedNonVote: number; success: number; failure: number; totalCu: number; successCu: number; failureCu: number; totalFees: number; successFees: number; failureFees: number; allLandedCu: number; cuValues: number[]; costValues: number[]; feeValues: number[]; successFeeValues: number[]; failureFeeValues: number[]; priorityFeeValues: number[]; pairedCostCu: Array<{ cost: number; cu: number }> ; unknownCu: number; unknownCost: number; priorityUnavailable: number; transactionParseUnknown: number }
type Checkpoint = { schemaVersion: 1; methodology: Record<string, unknown>; boundary: Record<string, unknown>; samples: Snapshot[]; completedSlots: number[]; errors: Array<{ slot: number; message: string }>; updatedAt: string }
type WindowRequest = { window: WindowLabel; start: number; end: number; count: number }
type SamplingPlan = { schemaVersion: 1; boundarySlot: number; boundaryTime: number; windows: Partial<Record<WindowLabel, { start: number; end: number; count: number; candidateBlockCount: number; slots: number[] }>>; updatedAt: string }
type IndexSide = { start: number; end: number; nextCursor: number; slots: number[]; complete: boolean }
type BlockIndex = { schemaVersion: 1; boundarySlot: number; boundaryTime: number; before?: IndexSide; after?: IndexSide; updatedAt: string }
type BlockIndexRecord = { schemaVersion: 1; boundarySlot: number; boundaryTime: number; side: 'before' | 'after'; start: number; end: number; cursor: number; nextCursor: number; slots: number[]; migratedLegacy?: boolean; recordedAt: string }

const OUT = path.resolve('research/slot-time-300ms-boundary')
const CHECKPOINT = path.join(OUT, 'checkpoint.json')
const PLAN = path.join(OUT, 'sampling-plan.json')
const LEGACY_BLOCK_INDEX = path.join(OUT, 'block-index.json')
const BLOCK_INDEX_LOG = path.join(OUT, 'block-index.jsonl')
const COLLECTOR_LOCK = path.join(OUT, 'collector.lock.json')
const COLLECTOR_HEARTBEAT = path.join(OUT, 'collector-heartbeat.json')
const REPORT = path.join(OUT, 'analysis.json')
const MARKDOWN = path.join(OUT, 'analysis.md')
const VOTE = 'Vote111111111111111111111111111111111111111'
const COMPUTE = 'ComputeBudget111111111111111111111111111111'
const FEATURE_300MS = 'iBRLL3k18HST852F1Mf3Lv83waTNQmmqvKDxvYGwQFL'
const BOUNDARY_SLOT = 442_368_000
// SIMD-0286's 100M baseline was active; SIMD-0525 scales it by target slot time.
const BEFORE_LIMIT = 87_500_000
const AFTER_LIMIT = 75_000_000
const SAMPLES_60M = 60
const SAMPLES_3H = 180
const SAMPLES_EXTENDED = 120
const TRANSITION_BUFFER_SECONDS = 600
// 5 RPS was clean over 100 full getBlock calls; use a 20% safety margin.
const RPS = 4

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)) }
function iso(unix: number | null) { return unix == null ? null : new Date(unix * 1_000).toISOString() }
function empty(): BlockAggregate { return { landedNonVote: 0, success: 0, failure: 0, totalCu: 0, successCu: 0, failureCu: 0, totalFees: 0, successFees: 0, failureFees: 0, allLandedCu: 0, cuValues: [], costValues: [], feeValues: [], successFeeValues: [], failureFeeValues: [], priorityFeeValues: [], pairedCostCu: [], unknownCu: 0, unknownCost: 0, priorityUnavailable: 0, transactionParseUnknown: 0 } }
async function atomic(file: string, value: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); let last: unknown; for (let attempt = 0; attempt < 4; attempt++) { try { await rename(temp, file); return } catch (error) { last = error; if (attempt === 3) break; await sleep(100 * (attempt + 1)) } } throw last }
let lastHeartbeatAt = 0
async function heartbeat(phase: string, detail: Record<string, unknown> = {}, force = false) {
  if (!force && Date.now() - lastHeartbeatAt < 30_000) return
  lastHeartbeatAt = Date.now()
  await atomic(COLLECTOR_HEARTBEAT, { schemaVersion: 1, pid: process.pid, phase, detail, updatedAt: new Date().toISOString() })
}
function pidIsAlive(pid: number) { try { process.kill(pid, 0); return true } catch { return false } }
async function acquireCollectorLock() {
  for (let attempt = 0; attempt < 2; attempt++) try {
    const handle = await open(COLLECTOR_LOCK, 'wx')
    await handle.writeFile(`${JSON.stringify({pid:process.pid,startedAt:new Date().toISOString(),purpose:'slot-time 6h event study with buffered variant'})}\n`)
    await handle.close(); return
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST' || attempt === 1) throw error
    let lock: { pid?: number } = {}; try { lock = JSON.parse(await readFile(COLLECTOR_LOCK, 'utf8')) } catch { /* corrupt stale lock */ }
    if (typeof lock.pid === 'number' && pidIsAlive(lock.pid)) throw new Error(`Collector lock is held by live PID ${lock.pid}; refusing a concurrent run`)
    await unlink(COLLECTOR_LOCK)
  }
  throw new Error('Unable to acquire collector lock')
}
async function releaseCollectorLock() { try { const lock=JSON.parse(await readFile(COLLECTOR_LOCK,'utf8')) as {pid?:number}; if(lock.pid===process.pid) await unlink(COLLECTOR_LOCK) } catch { /* already released or stale */ } }
async function key() { const env = await readFile('.env.local', 'utf8'); const value = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim(); if (!value) throw new Error('HELIUS_API_KEY is required'); return value }
let nextRequestAt = 0
async function rpc<T>(apiKey: string, method: string, params: unknown[]): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await heartbeat('rpc', { method, attempt })
    const wait = Math.max(0, nextRequestAt - Date.now()); if (wait) await sleep(wait); nextRequestAt = Math.max(nextRequestAt, Date.now()) + 1_000 / RPS
    try {
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(60_000) })
      const text = await response.text(); const body = JSON.parse(text) as { result?: T; error?: { message?: string } }
      if (response.ok && !body.error && body.result !== undefined) return body.result
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === 7) throw new Error(body.error?.message ?? `HTTP ${response.status}`)
      const retryAfterSeconds = Number(response.headers.get('retry-after'))
      const retryDelay = Math.max(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1_000 : 0, Math.min(60_000, 1_000 * 2 ** attempt + Math.floor(Math.random() * 500)))
      nextRequestAt = Math.max(nextRequestAt, Date.now() + retryDelay)
      await sleep(retryDelay)
    } catch (error) {
      if (attempt === 7) throw error
      await sleep(Math.min(60_000, 1_000 * 2 ** attempt + Math.floor(Math.random() * 500)))
    }
  }
  throw new Error(`RPC ${method} exhausted retries`)
}
function epoch(schedule: { firstNormalEpoch: number; firstNormalSlot: number; slotsPerEpoch: number; warmup: boolean }, slot: number) {
  if (schedule.warmup || slot < schedule.firstNormalSlot) throw new Error('Unexpected epoch schedule')
  return schedule.firstNormalEpoch + Math.floor((slot - schedule.firstNormalSlot) / schedule.slotsPerEpoch)
}
function decodeFeatureActivation(data: string) { const bytes = Buffer.from(data, 'base64'); if (bytes.length !== 9 || bytes[0] !== 1) return null; return Number(bytes.readBigUInt64LE(1)) }
async function blockTime(apiKey: string, slot: number) { return rpc<number | null>(apiKey, 'getBlockTime', [slot]) }
async function firstSlotAtOrAfter(apiKey: string, target: number, low: number, high: number) {
  while (low < high) { const mid = Math.floor((low + high) / 2), time = await blockTime(apiKey, mid); if (time == null || time < target) low = mid + 1; else high = mid }
  return low
}
async function allBlocks(apiKey: string, start: number, end: number) {
  const slots: number[] = []
  for (let cursor = start; cursor <= end; cursor += 500) slots.push(...await rpc<number[]>(apiKey, 'getBlocks', [cursor, Math.min(end, cursor + 499)]))
  return slots
}
function applyIndexRecord(index: BlockIndex, record: BlockIndexRecord) {
  if (record.schemaVersion !== 1 || record.boundarySlot !== BOUNDARY_SLOT) throw new Error('Invalid block-index journal record')
  const existing = index[record.side]
  if (!existing) { index[record.side] = { start:record.start, end:record.end, nextCursor:record.nextCursor, slots:[...new Set(record.slots)], complete:record.nextCursor > record.end }; return }
  if (existing.start !== record.start || existing.end !== record.end) throw new Error('Block-index journal range mismatch')
  if (record.nextCursor <= existing.nextCursor) return
  if (record.cursor !== existing.nextCursor) throw new Error(`Block-index journal has a gap at ${record.side}: expected ${existing.nextCursor}, found ${record.cursor}`)
  const seen = new Set(existing.slots); existing.slots.push(...record.slots.filter(slot => !seen.has(slot) && (seen.add(slot), true))); existing.nextCursor=record.nextCursor; existing.complete=existing.nextCursor>existing.end
}
async function appendIndexRecord(record: BlockIndexRecord) { await appendFile(BLOCK_INDEX_LOG, `${JSON.stringify(record)}\n`, 'utf8') }
async function loadBlockIndex(boundaryTime: number): Promise<BlockIndex> {
  const index: BlockIndex = { schemaVersion:1, boundarySlot:BOUNDARY_SLOT, boundaryTime, updatedAt:new Date().toISOString() }
  let journal = ''
  try { journal = await readFile(BLOCK_INDEX_LOG, 'utf8') } catch { /* first run */ }
  const lines = journal.split('\n'), lastNonEmpty = lines.reduce((last,line,index) => line.trim() ? index : last, -1)
  for (let position = 0; position < lines.length; position++) {
    const line = lines[position].trim(); if (!line) continue
    try { applyIndexRecord(index, JSON.parse(line) as BlockIndexRecord) } catch (error) { if (position === lastNonEmpty) break; throw error }
  }
  if (journal.trim()) return index
  try {
    const legacy = JSON.parse(await readFile(LEGACY_BLOCK_INDEX, 'utf8')) as BlockIndex
    if (legacy.boundarySlot !== BOUNDARY_SLOT || legacy.boundaryTime !== boundaryTime) throw new Error('Legacy block index boundary does not match the validated epoch transition')
    for (const side of ['before','after'] as const) if (legacy[side]) {
      const entry = legacy[side]!
      const record: BlockIndexRecord = { schemaVersion:1,boundarySlot:BOUNDARY_SLOT,boundaryTime,side,start:entry.start,end:entry.end,cursor:entry.start,nextCursor:entry.nextCursor,slots:entry.slots,migratedLegacy:true,recordedAt:new Date().toISOString() }
      await appendIndexRecord(record); applyIndexRecord(index,record)
    }
  } catch (error) { if (!(error instanceof Error) || !error.message.includes('ENOENT')) throw error }
  return index
}
async function indexSide(apiKey: string, index: BlockIndex, side: 'before' | 'after', start: number, end: number) {
  let entry = index[side]
  if (!entry || entry.start !== start || entry.end !== end) {
    entry = { start, end, nextCursor: start, slots: [], complete: false }
    index[side] = entry
  }
  while (!entry.complete) {
    const cursor = entry.nextCursor
    const slots = await rpc<number[]>(apiKey, 'getBlocks', [cursor, Math.min(end, cursor + 499)])
    const record: BlockIndexRecord = { schemaVersion:1,boundarySlot:BOUNDARY_SLOT,boundaryTime:index.boundaryTime,side,start,end,cursor,nextCursor:cursor+500,slots,recordedAt:new Date().toISOString() }
    await appendIndexRecord(record)
    entry.slots.push(...slots)
    entry.nextCursor = record.nextCursor
    entry.complete = entry.nextCursor > end
    console.log(`Indexed ${side}: ${Math.min(entry.nextCursor - 1, end)}/${end}`)
  }
  return entry.slots
}
function pick(slots: number[], count: number) { if (slots.length < count) throw new Error(`Only ${slots.length} landed blocks available for sample of ${count}`); return Array.from({ length: count }, (_, index) => slots[Math.min(slots.length - 1, Math.floor((index + .5) * slots.length / count))]) }
function base58(value: string) { const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', bytes: number[] = []; for (const char of value) { let carry = alphabet.indexOf(char); if (carry < 0) return []; for (let index = 0; index < bytes.length; index++) { carry += bytes[index] * 58; bytes[index] = carry & 255; carry >>= 8 } while (carry) { bytes.push(carry & 255); carry >>= 8 } } for (let index = 0; index < value.length - 1 && value[index] === '1'; index++) bytes.push(0); return bytes.reverse() }
function u32(bytes: number[]) { return bytes.length >= 5 ? (bytes[1] | bytes[2] << 8 | bytes[3] << 16 | bytes[4] << 24) >>> 0 : null }
function u64(bytes: number[]) { if (bytes.length < 9) return null; let value = 0; for (let index = 0; index < 8; index++) value += bytes[index + 1] * 2 ** (8 * index); return Number.isSafeInteger(value) ? value : null }
function priorityFee(tx: RpcTransaction) {
  const keys = tx.transaction?.message?.accountKeys, instructions = tx.transaction?.message?.instructions
  if (!keys || !instructions) return null
  let limit: number | null = null, price: number | null = null, seenPrice = false
  for (const ix of instructions) if (keys[ix.programIdIndex ?? -1] === COMPUTE) { const bytes = ix.data ? base58(ix.data) : []; if (bytes[0] === 2) limit = u32(bytes); if (bytes[0] === 3) { seenPrice = true; price = u64(bytes) } }
  return seenPrice && price != null && price > 0 && limit != null ? Math.ceil(limit * price / 1_000_000) : null
}
function voteOnly(tx: RpcTransaction) {
  const keys = tx.transaction?.message?.accountKeys, instructions = tx.transaction?.message?.instructions
  if (!keys || !instructions) return null
  const programs = instructions.map(ix => keys[ix.programIdIndex ?? -1]); return programs.includes(VOTE) && programs.every(program => program === VOTE || program === COMPUTE)
}
function aggregate(block: Block): BlockAggregate {
  const out = empty()
  for (const tx of block.transactions ?? []) {
    const onlyVote = voteOnly(tx); if (onlyVote == null) { out.transactionParseUnknown++; continue }
    const cu = tx.meta?.computeUnitsConsumed, cost = tx.meta?.costUnits
    if (Number.isFinite(cu)) out.allLandedCu += cu!
    if (onlyVote) continue
    out.landedNonVote++; const failed = tx.meta?.err != null, fee = tx.meta?.fee
    if (failed) out.failure++; else out.success++
    if (Number.isFinite(cu)) { out.totalCu += cu!; out.cuValues.push(cu!); if (failed) out.failureCu += cu!; else out.successCu += cu! } else out.unknownCu++
    if (Number.isFinite(cost)) out.costValues.push(cost!); else out.unknownCost++
    if (Number.isFinite(cost) && Number.isFinite(cu) && cu! > 0) out.pairedCostCu.push({ cost: cost!, cu: cu! })
    if (Number.isFinite(fee)) { out.totalFees += fee!; out.feeValues.push(fee!); if (failed) { out.failureFees += fee!; out.failureFeeValues.push(fee!) } else { out.successFees += fee!; out.successFeeValues.push(fee!) } }
    const priority = priorityFee(tx); if (priority == null) out.priorityUnavailable++; else out.priorityFeeValues.push(priority)
  }
  return out
}
function merge(values: BlockAggregate[]) { const out = empty(); for (const value of values) { for (const key of ['landedNonVote','success','failure','totalCu','successCu','failureCu','totalFees','successFees','failureFees','allLandedCu','unknownCu','unknownCost','priorityUnavailable','transactionParseUnknown'] as const) out[key] += value[key]; out.cuValues.push(...value.cuValues); out.costValues.push(...value.costValues); out.feeValues.push(...(value.feeValues ?? [])); out.successFeeValues.push(...(value.successFeeValues ?? [])); out.failureFeeValues.push(...(value.failureFeeValues ?? [])); out.priorityFeeValues.push(...value.priorityFeeValues); out.pairedCostCu.push(...value.pairedCostCu) } return out }
function dist(values: number[]) { const data = [...values].sort((a,b) => a-b), q = (p: number) => data.length ? data[Math.floor((data.length - 1) * p)] : null; return { count: data.length, min: data[0] ?? null, p25: q(.25), median: q(.5), p75: q(.75), p90: q(.9), p95: q(.95), mean: data.length ? data.reduce((a,b)=>a+b,0)/data.length : null, max: data.at(-1) ?? null } }
function pearson(rows: Array<{ cost: number; cu: number }>) { if (rows.length < 2) return null; const cx = rows.reduce((s,x)=>s+x.cost,0)/rows.length, cy = rows.reduce((s,x)=>s+x.cu,0)/rows.length; const top = rows.reduce((s,x)=>s+(x.cost-cx)*(x.cu-cy),0), x = rows.reduce((s,x)=>s+(x.cost-cx)**2,0), y = rows.reduce((s,x)=>s+(x.cu-cy)**2,0); return x && y ? top / Math.sqrt(x*y) : null }
function summarize(samples: Snapshot[], limit: number, start: number, end: number) { const blocks = samples.map(x=>x.aggregate), a = merge(blocks), perBlockTx = blocks.map(x=>x.landedNonVote), perBlockCu = blocks.map(x=>x.totalCu), full = blocks.map(x=>x.allLandedCu / limit), nonVoteCapacity = blocks.map(x=>x.totalCu / limit); return { evidence: 'OBSERVED', sampledBlocks: blocks.length, sampledLandedNonVoteTransactions: a.landedNonVote, success: { count: a.success, rate: a.landedNonVote ? a.success/a.landedNonVote : null }, failure: { count: a.failure, rate: a.landedNonVote ? a.failure/a.landedNonVote : null }, computeUnits: { total: a.totalCu, success: a.successCu, failed: a.failureCu, failedCuShare: a.totalCu ? a.failureCu/a.totalCu : null, distribution: dist(a.cuValues) }, costUnits: { distribution: dist(a.costValues), availabilityRate: a.landedNonVote ? a.costValues.length/a.landedNonVote : null, relationshipWithCompute: { status: 'UNKNOWN', reason: 'Cost units and consumed compute units are different runtime measures; no causal or ratio interpretation is asserted.', observedPearsonCorrelation: pearson(a.pairedCostCu), pairedCount: a.pairedCostCu.length } }, feesLamports: { total: a.totalFees, success: a.successFees, failed: a.failureFees }, priorityFeeLamports: { distribution: dist(a.priorityFeeValues), reconstructableRate: a.landedNonVote ? a.priorityFeeValues.length/a.landedNonVote : null, unavailableCount: a.priorityUnavailable }, perBlock: { transactions: dist(perBlockTx), nonVoteCu: dist(perBlockCu), allLandedCuUtilization: dist(full), nonVoteCuShareOfApplicableLimit: dist(nonVoteCapacity), applicableBlockCuLimit: limit }, availability: { unknownCu: a.unknownCu, unknownCost: a.unknownCost, transactionParseUnknown: a.transactionParseUnknown }, window: { startUtc: iso(start), endUtc: iso(end), endExclusive: true } }
}
function buckets(samples: Snapshot[], start: number, duration: number, count: number, limit: number) { return Array.from({length: count}, (_, index) => { const low=start+index*duration/count, high=start+(index+1)*duration/count; const included=samples.filter(x => x.blockTime != null && x.blockTime! >= low && x.blockTime! < high); return { index:index+1, startUtc:iso(low), endUtc:iso(high), ...summarize(included,limit,low,high) } }) }

async function main() {
  await mkdir(OUT, { recursive: true }); await acquireCollectorLock(); try { const apiKey = await key()
  await heartbeat('starting', {}, true)
  const [schedule, boundaryTime, beforeTime, afterTime, account] = await Promise.all([
    rpc<{firstNormalEpoch:number;firstNormalSlot:number;slotsPerEpoch:number;warmup:boolean}>(apiKey,'getEpochSchedule',[]), blockTime(apiKey,BOUNDARY_SLOT), blockTime(apiKey,BOUNDARY_SLOT-1), blockTime(apiKey,BOUNDARY_SLOT+1), rpc<{value?:{data?:[string,string]}|null}>(apiKey,'getAccountInfo',[FEATURE_300MS,{encoding:'base64',commitment:'finalized'}]),
  ])
  const activationSlot=account.value?.data?.[0] ? decodeFeatureActivation(account.value.data[0]) : null
  const validation={ schedule, beforeEpoch:epoch(schedule,BOUNDARY_SLOT-1), boundaryEpoch:epoch(schedule,BOUNDARY_SLOT), beforeBlockTime:beforeTime, boundaryBlockTime:boundaryTime, afterBlockTime:afterTime, feature300ms:FEATURE_300MS, featureActivationSlot:activationSlot, effectiveSlot:BOUNDARY_SLOT, consistent: epoch(schedule,BOUNDARY_SLOT-1)===1023 && epoch(schedule,BOUNDARY_SLOT)===1024 && activationSlot===441_936_000 && boundaryTime!=null }
  if (!validation.consistent || boundaryTime == null) throw new Error(`Boundary validation failed: ${JSON.stringify(validation)}`)
  const methodology={ population:'Landed transactions in deterministically selected full blocks; vote-only transactions are excluded when every outer instruction is Vote or Compute Budget and at least one is Vote.', sampling:'Fixed stratified block sample. Completed windows retain 60 evenly ranked landed blocks per 60-minute side and 180 per 3-hour side. The active added 6-hour side uses 120 evenly ranked landed blocks (20 per one-sixth chronological bucket). The 12-hour window is deferred. The active 6-hour buffered variant retains the same count per side but excludes a pre-registered 10-minute interval on either side of the boundary. No status, fee, compute, signer, program, or outcome field affects selection.', boundaryBuffer:{unbuffered:'No predeclared exclusion: eligible windows meet at slot 442368000. Independent deterministic samples leave an implicit gap between their closest selected blocks; it is recorded as sampling coverage, not treated as a zero-width transition buffer.',bufferedSeconds:TRANSITION_BUFFER_SECONDS,buffered:'Each side excludes the fixed 10-minute interval adjacent to the boundary before selection.'}, pacing:`Sequential Helius getBlock calls at ${RPS} request/second with retry/backoff.`, limits:{before350ms:BEFORE_LIMIT,after300ms:AFTER_LIMIT}, labels:'All transaction totals are sampled-ledger totals, not network totals.' }
  let checkpoint: Checkpoint; try { checkpoint=JSON.parse(await readFile(CHECKPOINT,'utf8')) } catch { checkpoint={schemaVersion:1,methodology,boundary:validation,samples:[],completedSlots:[],errors:[],updatedAt:new Date().toISOString()} }
  const completed=new Set(checkpoint.completedSlots)
  const requested: WindowRequest[] = []
  for (const [hours, count, suffix] of [[1,SAMPLES_60M,'60m'],[3,SAMPLES_3H,'3h'],[6,SAMPLES_EXTENDED,'6h']] as const) {
    const startBefore=await firstSlotAtOrAfter(apiKey,boundaryTime-hours*3600,Math.max(0,BOUNDARY_SLOT-Math.ceil(hours*3600/.25)),BOUNDARY_SLOT-1)
    const endAfter=(await firstSlotAtOrAfter(apiKey,boundaryTime+hours*3600,BOUNDARY_SLOT,BOUNDARY_SLOT+Math.ceil(hours*3600/.2)))-1
    requested.push({window:`before_${suffix}` as WindowLabel,start:startBefore,end:BOUNDARY_SLOT-1,count},{window:`after_${suffix}` as WindowLabel,start:BOUNDARY_SLOT,end:endAfter,count})
    if (hours >= 6) {
      const bufferedBeforeEnd=(await firstSlotAtOrAfter(apiKey,boundaryTime-TRANSITION_BUFFER_SECONDS,startBefore,BOUNDARY_SLOT-1))-1
      const bufferedAfterStart=await firstSlotAtOrAfter(apiKey,boundaryTime+TRANSITION_BUFFER_SECONDS,BOUNDARY_SLOT,endAfter)
      requested.push({window:`before_${suffix}_buffered` as WindowLabel,start:startBefore,end:bufferedBeforeEnd,count},{window:`after_${suffix}_buffered` as WindowLabel,start:bufferedAfterStart,end:endAfter,count})
    }
  }
  let planCheckpoint: SamplingPlan
  try { planCheckpoint=JSON.parse(await readFile(PLAN,'utf8')) } catch { planCheckpoint={schemaVersion:1,boundarySlot:BOUNDARY_SLOT,boundaryTime,windows:{},updatedAt:new Date().toISOString()} }
  if (planCheckpoint.boundarySlot !== BOUNDARY_SLOT || planCheckpoint.boundaryTime !== boundaryTime) throw new Error('Sampling plan boundary does not match the validated epoch transition')
  const blockIndex = await loadBlockIndex(boundaryTime)
  const beforeMax = requested.find(item => item.window === 'before_6h')!, afterMax = requested.find(item => item.window === 'after_6h')!
  const beforeIndex = await indexSide(apiKey,blockIndex,'before',beforeMax.start,beforeMax.end)
  const afterIndex = await indexSide(apiKey,blockIndex,'after',afterMax.start,afterMax.end)
  await heartbeat('selecting-deterministic-sample', { beforeCandidateBlocks: beforeIndex.length, afterCandidateBlocks: afterIndex.length }, true)
  const plan = new Map<number, Set<Snapshot['window']>>()
  for (const item of requested) {
    let selected = planCheckpoint.windows[item.window]
    if (!selected || selected.start !== item.start || selected.end !== item.end || selected.count !== item.count) {
      const candidates = (item.window.startsWith('before_') ? beforeIndex : afterIndex).filter(slot => slot >= item.start && slot <= item.end)
      selected = { start:item.start, end:item.end, count:item.count, candidateBlockCount:candidates.length, slots:pick(candidates,item.count) }
      planCheckpoint.windows[item.window] = selected
      planCheckpoint.updatedAt = new Date().toISOString()
      await atomic(PLAN,planCheckpoint)
    }
    for (const slot of selected.slots) (plan.get(slot) ?? plan.set(slot, new Set()).get(slot)!).add(item.window)
  }
  const selected = [...plan.entries()].map(([slot, windows]) => ({ slot, windows }))
  for (let index=0;index<selected.length;index++) {
    const item=selected[index], prior=checkpoint.samples.find(sample => sample.slot===item.slot)
    await heartbeat('fetching-sampled-blocks', { completed: index, total: selected.length, slot: item.slot })
    try {
      const source = prior ?? (() => null)()
      if (!source && !completed.has(item.slot)) {
        const block=await rpc<Block|null>(apiKey,'getBlock',[item.slot,{encoding:'json',transactionDetails:'full',rewards:false,maxSupportedTransactionVersion:1}]); if (!block) throw new Error('block unavailable')
        const snapshot={slot:item.slot,blockTime:block.blockTime??null,window:[...item.windows][0],aggregate:aggregate(block)}
        checkpoint.samples.push(snapshot); completed.add(item.slot); checkpoint.completedSlots.push(item.slot)
      }
      const reusable=checkpoint.samples.find(sample => sample.slot===item.slot)
      if (!reusable) throw new Error('selected block has no reusable checkpoint evidence')
      for (const window of item.windows) if (!checkpoint.samples.some(sample => sample.slot===item.slot && sample.window===window)) checkpoint.samples.push({ ...reusable, window })
    } catch(error) { checkpoint.errors.push({slot:item.slot,message:error instanceof Error?error.message:String(error)}) }
    checkpoint.updatedAt=new Date().toISOString(); await atomic(CHECKPOINT,checkpoint); console.log(`${index+1}/${selected.length} unique sampled blocks processed`)
  }
  if (checkpoint.errors.length) throw new Error(`Study incomplete: ${checkpoint.errors.length} block fetch errors`)
  await heartbeat('writing-analysis', { sampledSlots: selected.length }, true)
  const windowEvidence = (hours:number, suffix:'60m'|'3h'|'6h'|'12h'|'24h') => { const before=checkpoint.samples.filter(x=>x.window===`before_${suffix}`), after=checkpoint.samples.filter(x=>x.window===`after_${suffix}`); return {before:summarize(before,BEFORE_LIMIT,boundaryTime-hours*3600,boundaryTime),after:summarize(after,AFTER_LIMIT,boundaryTime,boundaryTime+hours*3600),beforeBuckets:buckets(before,boundaryTime-hours*3600,hours*3600,6,BEFORE_LIMIT),afterBuckets:buckets(after,boundaryTime,hours*3600,6,AFTER_LIMIT)} }
  const bufferedEvidence = (hours:number, suffix:'60m'|'3h'|'6h'|'12h'|'24h') => { const before=checkpoint.samples.filter(x=>x.window===`before_${suffix}_buffered`), after=checkpoint.samples.filter(x=>x.window===`after_${suffix}_buffered`), retained=hours*3600-TRANSITION_BUFFER_SECONDS; return {before:summarize(before,BEFORE_LIMIT,boundaryTime-hours*3600,boundaryTime-TRANSITION_BUFFER_SECONDS),after:summarize(after,AFTER_LIMIT,boundaryTime+TRANSITION_BUFFER_SECONDS,boundaryTime+hours*3600),beforeBuckets:buckets(before,boundaryTime-hours*3600,retained,6,BEFORE_LIMIT),afterBuckets:buckets(after,boundaryTime+TRANSITION_BUFFER_SECONDS,retained,6,AFTER_LIMIT)} }
  const report={ generatedAt:new Date().toISOString(), boundary:validation, methodology, primary60Minutes:windowEvidence(1,'60m'), robustness3Hours:windowEvidence(3,'3h'), extended6Hours:windowEvidence(6,'6h'), extended12Hours:{status:'DEFERRED_NOT_COLLECTED'}, extended24Hours:{status:'DEFERRED_NOT_COLLECTED'}, bufferedVariants:{bufferSeconds:TRANSITION_BUFFER_SECONDS,extended6Hours:bufferedEvidence(6,'6h')}, source:{rpc:'Helius standard Solana JSON-RPC getEpochSchedule, getBlockTime, getBlocks, getBlock, getAccountInfo', rawEvidenceCheckpoint:'research/slot-time-300ms-boundary/checkpoint.json', deterministicSamplingPlan:'research/slot-time-300ms-boundary/sampling-plan.json', blockIndexJournal:'research/slot-time-300ms-boundary/block-index.jsonl'}, limitations:['No sender geography, sender/network telemetry, dropped-before-landing transactions, or end-to-end latency are present in ledger data.','Sampled blocks are not a full-population count and cannot establish causality.'] }
  await atomic(REPORT,report)
  const p=report.primary60Minutes
  await writeFile(MARKDOWN,`# Solana 350ms → 300ms ledger-side execution study\n\nBoundary: epoch 1024 / slot ${BOUNDARY_SLOT.toLocaleString()} / ${iso(boundaryTime)}.\n\nThis is a fixed stratified sample of landed blocks, not a network census. Vote-only transactions are deterministically excluded from the sampled transaction population.\n\n| Metric | 60m before | 60m after |\n| --- | ---: | ---: |\n| Sampled blocks | ${p.before.sampledBlocks} | ${p.after.sampledBlocks} |\n| Sampled non-vote transactions | ${p.before.sampledLandedNonVoteTransactions.toLocaleString()} | ${p.after.sampledLandedNonVoteTransactions.toLocaleString()} |\n| Success rate | ${(p.before.success.rate!*100).toFixed(2)}% | ${(p.after.success.rate!*100).toFixed(2)}% |\n| Failure rate | ${(p.before.failure.rate!*100).toFixed(2)}% | ${(p.after.failure.rate!*100).toFixed(2)}% |\n| Failed CU share | ${(p.before.computeUnits.failedCuShare!*100).toFixed(2)}% | ${(p.after.computeUnits.failedCuShare!*100).toFixed(2)}% |\n| Median non-vote CUs/tx | ${p.before.computeUnits.distribution.median?.toLocaleString()} | ${p.after.computeUnits.distribution.median?.toLocaleString()} |\n| Median non-vote tx/block | ${p.before.perBlock.transactions.median?.toLocaleString()} | ${p.after.perBlock.transactions.median?.toLocaleString()} |\n| Median all-landed CU utilization | ${((p.before.perBlock.allLandedCuUtilization.median??0)*100).toFixed(2)}% | ${((p.after.perBlock.allLandedCuUtilization.median??0)*100).toFixed(2)}% |\n\nSee analysis.json for bucket data, distributions, availability, and limits.\n`)
  console.log(`Wrote ${REPORT}`)
  await heartbeat('complete', { sampledSlots: selected.length }, true)
  } finally { await releaseCollectorLock() }
}
void main()
