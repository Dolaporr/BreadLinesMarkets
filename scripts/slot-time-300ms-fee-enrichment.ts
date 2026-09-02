import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('research/slot-time-300ms-boundary')
const PLAN = path.join(OUT, 'sampling-plan.json')
const OUTPUT = path.join(OUT, 'fee-enrichment.json')
const VOTE = 'Vote111111111111111111111111111111111111111'
const COMPUTE = 'ComputeBudget111111111111111111111111111111'
// 5 RPS was clean over 100 full getBlock calls; use a 20% safety margin.
const RPS = 4

type RpcTransaction = { transaction?: { message?: { accountKeys?: string[]; instructions?: Array<{ programIdIndex?: number }> } }; meta?: { err?: unknown; fee?: number } }
type Block = { transactions?: RpcTransaction[] }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function atomic(file: string, value: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); for (let attempt = 0; attempt < 4; attempt++) try { await rename(temp, file); return } catch (error) { if (attempt === 3) throw error; await sleep(100 * (attempt + 1)) } }
async function apiKey() { const text = await readFile('.env.local', 'utf8'), key = text.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim(); if (!key) throw new Error('HELIUS_API_KEY is required'); return key }
let nextRequestAt = 0
async function rpc<T>(key: string, method: string, params: unknown[]): Promise<T> { for (let attempt = 0; attempt < 8; attempt++) { const wait = Math.max(0, nextRequestAt - Date.now()); if (wait) await sleep(wait); nextRequestAt = Math.max(nextRequestAt, Date.now()) + 1_000 / RPS; let retryAfterMs = 0; try { const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(60_000) }); const body = await response.json() as { result?: T; error?: { message?: string } }; if (response.ok && !body.error && body.result !== undefined) return body.result; if (response.status !== 429 && response.status < 500) throw new Error(body.error?.message ?? `HTTP ${response.status}`); const seconds = Number(response.headers.get('retry-after')); retryAfterMs = Number.isFinite(seconds) ? seconds * 1_000 : 0 } catch (error) { if (attempt === 7) throw error } const retryDelay = Math.max(retryAfterMs, Math.min(60_000, 1_000 * 2 ** attempt + Math.floor(Math.random() * 500))); nextRequestAt = Math.max(nextRequestAt, Date.now() + retryDelay); await sleep(retryDelay) } throw new Error(`${method} exhausted retries`) }
function nonVote(tx: RpcTransaction) { const keys = tx.transaction?.message?.accountKeys, instructions = tx.transaction?.message?.instructions; if (!keys || !instructions) return false; const programs = instructions.map(ix => keys[ix.programIdIndex ?? -1]); return !(programs.includes(VOTE) && programs.every(program => program === VOTE || program === COMPUTE)) }
function aggregate(block: Block) { const all: number[] = [], success: number[] = [], failure: number[] = []; for (const tx of block.transactions ?? []) { if (!nonVote(tx) || !Number.isFinite(tx.meta?.fee)) continue; const fee = tx.meta!.fee!; all.push(fee); (tx.meta?.err == null ? success : failure).push(fee) } return { all, success, failure } }
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const sign = (value: number | null) => value == null || value === 0 ? null : value > 0 ? 1 : -1
function trimmed(values: number[]) { const sorted = [...values].sort((a, b) => a - b), keep = Math.max(1, Math.ceil(sorted.length * .99)); return sorted.slice(0, keep) }
function comparison(before: number[], after: number[]) { const rawBefore = mean(before), rawAfter = mean(after), trimmedBefore = mean(trimmed(before)), trimmedAfter = mean(trimmed(after)); const rawDelta = rawBefore == null || rawAfter == null ? null : rawAfter - rawBefore, trimmedDelta = trimmedBefore == null || trimmedAfter == null ? null : trimmedAfter - trimmedBefore; return { observations: { before: before.length, after: after.length }, rawMean: { before: rawBefore, after: rawAfter, delta: rawDelta, sign: sign(rawDelta) }, topOnePercentTrimmedMean: { before: trimmedBefore, after: trimmedAfter, delta: trimmedDelta, sign: sign(trimmedDelta) }, signFlipsAfterTrim: sign(rawDelta) != null && sign(trimmedDelta) != null && sign(rawDelta) !== sign(trimmedDelta) }
}
async function main() {
  await mkdir(OUT, { recursive: true })
  const plan = JSON.parse(await readFile(PLAN, 'utf8')) as { windows: Record<string, { slots: number[] }> }
  const windows = Object.entries(plan.windows).filter(([name]) => ['before_60m', 'after_60m', 'before_3h', 'after_3h', 'before_6h', 'after_6h', 'before_6h_buffered', 'after_6h_buffered'].includes(name))
  const slots = [...new Set(windows.flatMap(([, item]) => item.slots))].sort((a, b) => a - b)
  const key = await apiKey(), evidence: Record<number, { all: number[]; success: number[]; failure: number[] }> = {}
  for (let index = 0; index < slots.length; index++) { const slot = slots[index], block = await rpc<Block | null>(key, 'getBlock', [slot, { encoding: 'json', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 1 }]); if (!block) throw new Error(`Selected block ${slot} unavailable`); evidence[slot] = aggregate(block); await atomic(OUTPUT, { schemaVersion: 1, completed: false, phase: 'fetching-fixed-selected-blocks', completedSlots: index + 1, totalSlots: slots.length, updatedAt: new Date().toISOString() }) }
  const vectors = (name: string, field: 'all' | 'success' | 'failure') => plan.windows[name].slots.flatMap(slot => evidence[slot][field])
  const pairs: Array<[string, string, string]> = [['unbuffered_1h', 'before_60m', 'after_60m'], ['unbuffered_3h', 'before_3h', 'after_3h'], ['unbuffered_6h', 'before_6h', 'after_6h'], ['buffered_6h', 'before_6h_buffered', 'after_6h_buffered']]
  const sensitivity = Object.fromEntries(pairs.map(([label, before, after]) => [label, Object.fromEntries((['all', 'success', 'failure'] as const).map(field => [field, comparison(vectors(before, field), vectors(after, field))]))]))
  await atomic(OUTPUT, { schemaVersion: 1, completed: true, scope: 'Deterministic transaction-fee-vector enrichment of the existing fixed selected blocks only; no block or transaction inclusion changes.', sourceSamplingPlan: PLAN, uniqueSelectedBlocks: slots.length, completedSlots: slots.length, sensitivity, updatedAt: new Date().toISOString() })
}
void main()
