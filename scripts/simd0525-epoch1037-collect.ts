/**
 * Collector for research/simd0525-epoch1037/preregistration.md — READ ONLY.
 *
 * Implements the frozen rules in that document. It sends nothing, signs nothing, needs no key and
 * reads only public RPC. Every selection decision is made from slot position before any block is
 * fetched, so retrieval outcome cannot influence the sample.
 *
 *   node --experimental-strip-types scripts/simd0525-epoch1037-collect.ts [--population NAME]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const ENDPOINT = process.env.BREADLINES_MAINNET_RPC ?? 'https://api.mainnet-beta.solana.com'
const DIR = 'research/simd0525-epoch1037'
const SPACING_MS = Number(process.env.BREADLINES_PROBE_SPACING_MS ?? 260)
const VOTE = 'Vote111111111111111111111111111111111111111'
const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111'
/** §6: three separate absence states. A refusal is never recorded as an absence. */
const SKIPPED_CODES = new Set([-32007, -32009])
const UNAVAILABLE_CODES = new Set([-32004])
/** §6: a population realising under this share of its planned size is reported UNDERPOWERED. */
const MIN_REALISED_SHARE = 0.8

/**
 * Operational only: avoid fetching the same slot twice when preregistered populations overlap
 * (ROBUST contains PRIMARY). The cache is keyed by slot and stores the ANALYSED row, never a
 * substitution. It cannot change which slots are selected — selection runs before any fetch — and
 * a cache miss falls through to a normal fetch. Analysed rows are cached rather than raw blocks
 * because the raw corpus is ~5GB and would exhaust the session disk allowance; the dedup effect is
 * identical.
 */
const CACHE_PATH = `${DIR}/.block-cache.json`
const cache = new Map<number, Row>()
let cacheHits = 0
function loadCache() {
  try {
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Record<string, Row>
    for (const [k, v] of Object.entries(raw)) cache.set(Number(k), v)
  } catch { /* absent or unreadable cache is simply an empty cache */ }
}
function saveCache() {
  const obj: Record<string, Row> = {}
  for (const [k, v] of cache.entries()) if (v.state === 'OK') obj[k] = v
  writeFileSync(CACHE_PATH, JSON.stringify(obj))
}

const PLAN: Record<string, number> = {
  PRIMARY_1037_PRE: 60, PRIMARY_1037_POST: 60,
  ROBUST_1037_PRE: 180, ROBUST_1037_POST: 180,
  PLACEBO_1036_PRE: 60, PLACEBO_1036_POST: 60,
  PRIORDAY_PRE: 60, PRIORDAY_POST: 60,
}

class Refused extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const stats = { calls: 0, retries: 0, skipped: 0, unavailable: 0, refused: 0, bytes: 0 }

async function rpc(method: string, params: unknown[], tries = 8): Promise<unknown | { absent: 'SKIPPED' | 'UNAVAILABLE' }> {
  let last = ''
  for (let a = 0; a < tries; a++) {
    stats.calls++
    if (a) stats.retries++
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(180_000),
      })
      if (res.status === 429 || res.status >= 500) { last = `HTTP ${res.status}`; await sleep(1200 * 2 ** a); continue }
      const text = await res.text()
      stats.bytes += text.length
      const body = JSON.parse(text) as { result?: unknown; error?: { code?: number; message?: string } }
      if (body.error) {
        const code = body.error.code
        if (code != null && SKIPPED_CODES.has(code)) { stats.skipped++; return { absent: 'SKIPPED' } }
        if (code != null && UNAVAILABLE_CODES.has(code)) { stats.unavailable++; return { absent: 'UNAVAILABLE' } }
        last = `rpc ${code} ${body.error.message?.slice(0, 60)}`; await sleep(1200 * 2 ** a); continue
      }
      return body.result
    } catch (error) { last = (error as Error).name; await sleep(1200 * 2 ** a) }
  }
  stats.refused++
  throw new Refused(`${method} exhausted retries: ${last}`)
}
const isAbsent = (v: unknown): v is { absent: 'SKIPPED' | 'UNAVAILABLE' } =>
  typeof v === 'object' && v !== null && 'absent' in v

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]
}
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/** §4 step 2: even-rank selection over produced slots. Position only. */
export function selectByRank(produced: number[], n: number): number[] {
  const M = produced.length
  if (M <= n) return [...produced]
  const out: number[] = []
  for (let k = 0; k < n; k++) {
    const idx = Math.round((k * (M - 1)) / (n - 1))
    const slot = produced[idx]
    if (out.at(-1) !== slot) out.push(slot)
  }
  return out
}

type Row = {
  slot: number; state: 'OK' | 'SKIPPED' | 'UNAVAILABLE' | 'REFUSED'; blockTime?: number
  txTotal?: number; nonVote?: number; success?: number; fail?: number
  cuTotal?: number; cuValues?: number[]; blockCostUnits?: number
  depths?: number[]; failureDepths?: number[]; failureUnattributable?: number
  writableTouch?: [string, number][]; complete?: number
}

function analyseBlock(slot: number, block: any): Row {
  const txs = block.transactions ?? []
  let success = 0, fail = 0, complete = 0, failureUnattributable = 0, blockCostUnits = 0
  const cuValues: number[] = [], depths: number[] = [], failureDepths: number[] = []
  const touch = new Map<string, number>()
  let nonVote = 0
  for (const t of txs) {
    const meta = t.meta ?? {}, msg = t.transaction?.message ?? {}
    blockCostUnits += meta.costUnits ?? 0
    const keys: string[] = (msg.accountKeys ?? []).map((k: any) => typeof k === 'string' ? k : k.pubkey)
    const programs: string[] = (msg.instructions ?? [])
      .map((ix: any) => keys[ix.programIdIndex]).filter(Boolean)
    // §7 exclusion: vote-only transactions.
    if (programs.length && programs.every((p) => p === VOTE || p === COMPUTE_BUDGET) && programs.includes(VOTE)) continue
    nonVote++
    const err = meta.err ?? null
    if (err === null) success++; else fail++
    cuValues.push(meta.computeUnitsConsumed ?? 0)

    // §8.7 execution depth: outer = 1, deepest stackHeight across inner instructions.
    let depth = 1
    for (const g of (meta.innerInstructions ?? [])) {
      for (const ix of (g.instructions ?? [])) if (ix.stackHeight) depth = Math.max(depth, ix.stackHeight)
    }
    depths.push(depth)

    // §8.8 failure depth, only for InstructionError.
    if (err !== null) {
      const ie = (err as any)?.InstructionError
      if (Array.isArray(ie) && typeof ie[0] === 'number') {
        const group = (meta.innerInstructions ?? []).find((g: any) => g.index === ie[0])
        let d = 1
        for (const ix of (group?.instructions ?? [])) if (ix.stackHeight) d = Math.max(d, ix.stackHeight)
        failureDepths.push(d)
      } else failureUnattributable++
    }

    // §8.9 writable set: header-derived static writables plus loaded writable addresses.
    const h = msg.header ?? {}
    const nsig = h.numRequiredSignatures ?? 0, nrs = h.numReadonlySignedAccounts ?? 0, nru = h.numReadonlyUnsignedAccounts ?? 0
    const writable = new Set<string>()
    const objectKeys = (msg.accountKeys ?? []).every((k: any) => typeof k !== 'string')
    keys.forEach((k, i) => {
      const w = objectKeys ? (msg.accountKeys[i].writable === true)
        : (i < nsig ? i < nsig - nrs : i < keys.length - nru)
      if (w) writable.add(k)
    })
    for (const k of (meta.loadedAddresses?.writable ?? [])) writable.add(k)
    for (const k of writable) touch.set(k, (touch.get(k) ?? 0) + 1)

    // §8.10 reconstruction completeness.
    if (meta.computeUnitsConsumed != null && meta.costUnits != null && 'err' in meta
      && meta.innerInstructions != null && (writable.size > 0 || keys.length === 0)) complete++
  }
  return { slot, state: 'OK', blockTime: block.blockTime, txTotal: txs.length, nonVote, success, fail,
    cuTotal: cuValues.reduce((a, b) => a + b, 0), cuValues, blockCostUnits, depths, failureDepths,
    failureUnattributable, writableTouch: [...touch.entries()], complete }
}

async function collectWindow(name: string, w: any) {
  const planned = PLAN[name]
  process.stdout.write(`\n[${name}] slots ${w.startSlot}..${w.endSlotInclusive} (span ${w.slotSpan})\n`)
  const producedRaw = await rpc('getBlocks', [w.startSlot, w.endSlotInclusive])
  const produced = (isAbsent(producedRaw) ? [] : producedRaw) as number[]
  const selected = selectByRank(produced, planned)
  process.stdout.write(`  produced ${produced.length}/${w.slotSpan} · selected ${selected.length}/${planned}\n`)

  const rows: Row[] = []
  for (const [i, slot] of selected.entries()) {
    const cached = cache.get(slot)
    if (cached && cached.state === 'OK') { rows.push(cached); cacheHits++; continue }
    try {
      const b = await rpc('getBlock', [slot, { encoding: 'json', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 1 }])
      const row = isAbsent(b) ? { slot, state: b.absent } as Row : analyseBlock(slot, b)
      if (row.state === 'OK') cache.set(slot, row)
      rows.push(row)
    } catch (error) {
      // A refusal is recorded as a refusal. It is never cached, never retried as absence, and the
      // selected slot is never swapped for another.
      if (error instanceof Refused) rows.push({ slot, state: 'REFUSED' })
      else throw error
    }
    if ((i + 1) % 20 === 0) { process.stdout.write(`  ${i + 1}/${selected.length} (cache ${cacheHits})\n`); saveCache() }
    await sleep(SPACING_MS)
  }
  saveCache()
  const ok = rows.filter((r) => r.state === 'OK')
  const allCu = ok.flatMap((r) => r.cuValues!)
  const allDepth = ok.flatMap((r) => r.depths!)
  const allFailDepth = ok.flatMap((r) => r.failureDepths!)
  const nonVoteTotal = ok.reduce((a, r) => a + r.nonVote!, 0)
  const touch = new Map<string, number>()
  for (const r of ok) for (const [k, c] of r.writableTouch!) touch.set(k, (touch.get(k) ?? 0) + c)
  const ranked = [...touch.values()].sort((a, b) => b - a)
  const totalTouch = ranked.reduce((a, b) => a + b, 0)
  // §8.1 windowed observed mean slot duration, over the WHOLE window, not the sample.
  const durationMs = (w.endBlockTime - w.startBlockTime) / (w.endSlotInclusive - w.startSlot) * 1000
  const meanNonVoteCuPerBlock = mean(ok.map((r) => r.cuTotal!))
  return {
    window: w, plannedBlocks: planned, selectedBlocks: selected.length,
    realisedBlocks: ok.length,
    underpowered: ok.length < planned * MIN_REALISED_SHARE,
    absence: {
      SKIPPED: rows.filter((r) => r.state === 'SKIPPED').length,
      UNAVAILABLE: rows.filter((r) => r.state === 'UNAVAILABLE').length,
      REFUSED: rows.filter((r) => r.state === 'REFUSED').length,
    },
    coverage: { producedBlocks: produced.length, slotSpan: w.slotSpan,
      producedShare: produced.length / w.slotSpan, skippedSlots: w.slotSpan - produced.length },
    observedMeanSlotDurationMs: durationMs,
    nonVotePerBlock: { median: median(ok.map((r) => r.nonVote!)), mean: mean(ok.map((r) => r.nonVote!)),
      p25: quantile(ok.map((r) => r.nonVote!), 0.25), p75: quantile(ok.map((r) => r.nonVote!), 0.75) },
    outcomes: { nonVoteTotal, success: ok.reduce((a, r) => a + r.success!, 0), fail: ok.reduce((a, r) => a + r.fail!, 0),
      failureRate: nonVoteTotal ? ok.reduce((a, r) => a + r.fail!, 0) / nonVoteTotal : 0 },
    computeUnits: { sampledTotal: allCu.reduce((a, b) => a + b, 0), median: median(allCu), mean: mean(allCu), p90: quantile(allCu, 0.9) },
    cuPerWallClockSecond_ESTIMATE: {
      value: (meanNonVoteCuPerBlock * produced.length) / (w.endBlockTime - w.startBlockTime),
      basis: 'EXTRAPOLATED: mean sampled non-vote CU per block x produced blocks in window / window wall-clock seconds',
    },
    executionDepth: { median: median(allDepth), max: allDepth.length ? Math.max(...allDepth) : 0 },
    failureDepth: { median: median(allFailDepth), max: allFailDepth.length ? Math.max(...allFailDepth) : 0,
      attributable: allFailDepth.length, unattributable: ok.reduce((a, r) => a + r.failureUnattributable!, 0) },
    writableConcentration: { top1Share: nonVoteTotal ? (ranked[0] ?? 0) / nonVoteTotal : 0,
      top5Share: nonVoteTotal ? ranked.slice(0, 5).reduce((a, b) => a + b, 0) / nonVoteTotal : 0,
      herfindahl: totalTouch ? ranked.reduce((a, c) => a + (c / totalTouch) ** 2, 0) : 0,
      distinctWritableAccounts: ranked.length },
    reconstructionCompleteness: nonVoteTotal ? ok.reduce((a, r) => a + r.complete!, 0) / nonVoteTotal : 0,
    maxBlockCostUnitsObserved: ok.length ? Math.max(...ok.map((r) => r.blockCostUnits!)) : 0,
    perBlock: rows.map((r) => ({ slot: r.slot, state: r.state, blockTime: r.blockTime, txTotal: r.txTotal,
      nonVote: r.nonVote, success: r.success, fail: r.fail, cuTotal: r.cuTotal, blockCostUnits: r.blockCostUnits,
      medianDepth: r.depths ? median(r.depths) : undefined, complete: r.complete })),
  }
}

async function main() {
  loadCache()
  const bounds = JSON.parse(readFileSync(`${DIR}/windows.json`, 'utf8'))
  const only = process.argv.includes('--population') ? process.argv[process.argv.indexOf('--population') + 1] : null
  const results: Record<string, unknown> = {}
  for (const [name, w] of Object.entries(bounds.windows as Record<string, any>)) {
    if (only && name !== only) continue
    results[name] = await collectWindow(name, w)
  }
  mkdirSync(DIR, { recursive: true })
  const out = {
    preregistrationCommit: process.env.BREADLINES_PREREG_COMMIT ?? 'UNRECORDED',
    collectedAt: new Date().toISOString(), endpoint: ENDPOINT.replace(/\?.*$/, ''),
    boundaries: { b1037: bounds.boundary1037, b1036: bounds.boundary1036, priorDay: bounds.priorDayAnchor },
    rpcStats: { ...stats, cacheHits, cachedBlocks: cache.size }, populations: results,
  }
  writeFileSync(`${DIR}/results${only ? `.${only}` : ''}.json`, JSON.stringify(out, null, 1))
  process.stdout.write(`\nwrote ${DIR}/results${only ? `.${only}` : ''}.json · rpc ${JSON.stringify(stats)}\n`)
}
// Only collect when run directly. Importing this module (tests, analysis) must have no side effect.
const entry = process.argv[1] ?? ''
if (entry && import.meta.url.endsWith(entry.split('/').pop() ?? '\u0000')) void main()
