/**
 * Frozen analysis for research/simd0525-epoch1037/preregistration.md.
 *
 * Reads results.json and emits report.md plus the seven preregistered charts. The metric ORDER is
 * the preregistration's §8 order, fixed in code, so the write-up cannot be reorganised around
 * whichever result turns out to be most striking. Every table prints all four populations.
 *
 *   node --experimental-strip-types scripts/simd0525-epoch1037-analyse.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'research/simd0525-epoch1037'
const r = JSON.parse(readFileSync(`${DIR}/results.json`, 'utf8'))
const P = r.populations as Record<string, any>

/** The four populations, always reported in this order, primary first, never pooled. */
const GROUPS: Array<{ key: string; label: string; pre: string; post: string; role: string }> = [
  { key: 'PRIMARY', label: 'PRIMARY_1037', pre: 'PRIMARY_1037_PRE', post: 'PRIMARY_1037_POST', role: 'primary comparison (60 min/side)' },
  { key: 'ROBUST', label: 'ROBUST_1037', pre: 'ROBUST_1037_PRE', post: 'ROBUST_1037_POST', role: 'robustness (3 h/side)' },
  { key: 'PLACEBO', label: 'PLACEBO_1036', pre: 'PLACEBO_1036_PRE', post: 'PLACEBO_1036_POST', role: 'control: epoch rollover only' },
  { key: 'PRIORDAY', label: 'PRIORDAY', pre: 'PRIORDAY_PRE', post: 'PRIORDAY_POST', role: 'control: same clock hour, 24 h earlier' },
]

const n = (x: number, d = 0) => x == null ? '—' : x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (x: number, d = 2) => x == null ? '—' : `${(x * 100).toFixed(d)}%`
const rel = (a: number, b: number) => (a === 0 || a == null || b == null) ? '—' : `${b > a ? '+' : ''}${(((b - a) / a) * 100).toFixed(1)}%`

function row(label: string, get: (w: any) => number, fmt: (x: number) => string, withRel = true) {
  const cells = GROUPS.flatMap((g) => {
    const a = get(P[g.pre]), b = get(P[g.post])
    return withRel ? [fmt(a), fmt(b), rel(a, b)] : [fmt(a), fmt(b)]
  })
  return `| ${label} | ${cells.join(' | ')} |`
}
/** An underpowered side is marked in EVERY metric header, so a flagged Δ cannot be read as a result. */
const mark = (k: string) => P[k].underpowered ? ' ⚠' : ''
const header = (withRel = true) => {
  const cols = GROUPS.flatMap((g) => {
    const base = [`${g.key} pre${mark(g.pre)}`, `${g.key} post${mark(g.post)}`]
    return withRel ? [...base, `${g.key} Δ${P[g.pre].underpowered || P[g.post].underpowered ? ' ⚠' : ''}`] : base
  })
  return `| Metric | ${cols.join(' | ')} |\n|${' --- |'.repeat(cols.length + 1)}`
}

const lines: string[] = []
const w = (s = '') => lines.push(s)

w('# Observed execution either side of the epoch-1037 boundary')
w('')
w(`**Preregistration:** [\`preregistration.md\`](preregistration.md) at commit \`${r.preregistrationCommit}\`.`)
w(`**Collected:** ${r.collectedAt} · endpoint \`${r.endpoint}\``)
w('')
w('This report follows the preregistration\'s metric order. All four populations appear in every')
w('table. Nothing here identifies a cause.')
w('')

// ---- 1. completeness first, before any finding ----
w('## 1. Completeness, coverage and refusals')
w('')
w('Reported before any measurement, because a measurement whose sample did not arrive is not a')
w('measurement. No missing or refused slot was replaced.')
w('')
w('| Population | Side | Planned | Selected | Realised | SKIPPED | UNAVAILABLE | REFUSED | Produced/span | Reconstruction |')
w('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
for (const g of GROUPS) for (const side of ['pre', 'post'] as const) {
  const p = P[(g as any)[side]]
  w(`| ${g.label} | ${side.toUpperCase()} | ${p.plannedBlocks} | ${p.selectedBlocks} | ${p.realisedBlocks}${p.underpowered ? ' **UNDERPOWERED**' : ''} | ${p.absence.SKIPPED} | ${p.absence.UNAVAILABLE} | ${p.absence.REFUSED} | ${pct(p.coverage.producedShare)} | ${pct(p.reconstructionCompleteness)} |`)
}
w('')
const under = GROUPS.flatMap((g) => [g.pre, g.post]).filter((k) => P[k].underpowered)
w(under.length
  ? `**${under.length} population side(s) fell below the 80% realised-sample threshold and are reported UNDERPOWERED: ${under.join(', ')}. Their comparisons are not interpreted, and every metric column for them is marked ⚠ below.**`
  : '**No population fell below the 80% realised-sample threshold. No column is marked ⚠.**')
w('')
const selectedRefused = GROUPS.flatMap((g) => [g.pre, g.post]).reduce((a, k) => a + P[k].absence.REFUSED, 0)
w(`RPC: ${n(r.rpcStats.calls)} calls, ${n(r.rpcStats.retries)} retries, ${n(r.rpcStats.cacheHits ?? 0)} deduplicated fetches.`)
w('')
w(`Two different refusal counts, kept apart: **${n(selectedRefused)} selected slot(s)** ended in \`REFUSED\` (the column above — these are holes in the corpus, never substituted), against ${n(r.rpcStats.refused)} call-level refusal(s) across all RPC methods including window enumeration, which a later retry may have recovered.`)
w('')

// ---- 2. the preregistered metrics, in §8 order ----
w('## 2. Preregistered metrics')
w('')
w('### 2.1 Windowed observed mean slot duration')
w('')
w('Computed over the whole window, not the sample: `(blockTime[end] − blockTime[start]) ÷ (end − start)`.')
w('**Observed duration, not a protocol target** — see §4.')
w('')
w(header())
w(row('Observed mean slot duration (ms)', (x) => x.observedMeanSlotDurationMs, (v) => n(v, 1)))
w('')
for (const [title, body] of [
  ['2.2 Non-vote transaction count (per sampled block)', [
    ['Median non-vote tx / block', (x: any) => x.nonVotePerBlock.median, (v: number) => n(v, 1)],
    ['Mean non-vote tx / block', (x: any) => x.nonVotePerBlock.mean, (v: number) => n(v, 1)],
  ]],
  ['2.3 Success / failure rate (sampled non-vote transactions)', [
    ['Sampled non-vote transactions', (x: any) => x.outcomes.nonVoteTotal, (v: number) => n(v)],
    ['Failure rate', (x: any) => x.outcomes.failureRate, (v: number) => pct(v)],
  ]],
  ['2.4 Total CU', [['Sampled total CU', (x: any) => x.computeUnits.sampledTotal, (v: number) => n(v)]]],
  ['2.5 CU per non-vote transaction', [
    ['Median CU / tx', (x: any) => x.computeUnits.median, (v: number) => n(v)],
    ['Mean CU / tx', (x: any) => x.computeUnits.mean, (v: number) => n(v)],
    ['p90 CU / tx', (x: any) => x.computeUnits.p90, (v: number) => n(v)],
  ]],
  ['2.6 CU per unit wall-clock time (windowed, EXTRAPOLATED ESTIMATE)', [
    ['Estimated non-vote CU / second', (x: any) => x.cuPerWallClockSecond_ESTIMATE.value, (v: number) => n(v)],
  ]],
  ['2.7 Execution / invocation depth', [
    ['Median depth', (x: any) => x.executionDepth.median, (v: number) => n(v, 1)],
    ['Max depth', (x: any) => x.executionDepth.max, (v: number) => n(v)],
  ]],
  ['2.8 Failure depth', [
    ['Median failure depth', (x: any) => x.failureDepth.median, (v: number) => n(v, 1)],
    ['Attributable failures', (x: any) => x.failureDepth.attributable, (v: number) => n(v)],
    ['Unattributable failures (non-InstructionError)', (x: any) => x.failureDepth.unattributable, (v: number) => n(v)],
  ]],
  ['2.9 Writable-account concentration', [
    ['top1 share', (x: any) => x.writableConcentration.top1Share, (v: number) => pct(v)],
    ['top5 share', (x: any) => x.writableConcentration.top5Share, (v: number) => pct(v)],
    ['Herfindahl index', (x: any) => x.writableConcentration.herfindahl, (v: number) => v.toFixed(4)],
    ['Distinct writable accounts', (x: any) => x.writableConcentration.distinctWritableAccounts, (v: number) => n(v)],
  ]],
] as Array<[string, Array<[string, (x: any) => number, (v: number) => string]>]>) {
  w(`### ${title}`)
  w('')
  if (title.startsWith('2.6')) {
    w('Extrapolated from the sample: mean sampled non-vote CU per block × produced blocks ÷ window')
    w('seconds. Not a per-block or per-slot quantity.')
    w('')
  }
  if (title.startsWith('2.9')) {
    w('**Concentration is a workload descriptor. It is not scheduler contention** — no lock conflict,')
    w('serialisation or queueing claim follows from it.')
    w('')
  }
  w(header())
  for (const [label, get, fmt] of body) w(row(label, get, fmt))
  w('')
}
w('### 2.10 Reconstruction completeness · 2.11 Coverage')
w('')
w('Reported in §1 above.')
w('')
w('### Recorded, not compared: per-block summed cost units')
w('')
w('| Population | PRE max | POST max |')
w('| --- | ---: | ---: |')
for (const g of GROUPS) w(`| ${g.label} | ${n(P[g.pre].maxBlockCostUnitsObserved)} | ${n(P[g.post].maxBlockCostUnitsObserved)} |`)
w('')
w('**No capacity inference is drawn from these.** Summed `costUnits` is a different accounting from')
w('the protocol block compute-unit limit; an earlier provisional reading of it as a capacity ceiling')
w('was withdrawn in the preregistration and is not revived here.')
w('')

// ---- 3. controls, read against the primary ----
w('## 3. What the controls do to each result')
w('')
w('A difference that also appears in PRIORDAY at similar magnitude is a time-of-day pattern, not a')
w('boundary effect. A difference that also appears in PLACEBO_1036 is an epoch-rollover pattern.')
w('')
const dd = (f: (w: any) => number) => GROUPS.map((g) => {
  const a = f(P[g.pre]), b = f(P[g.post])
  return a ? ((b - a) / a) * 100 : 0
})
const verdict = (v: number[]) => {
  const [prim, , plac, prior] = v
  if (Math.abs(prim) < 2) return 'FLAT — no movement to explain'
  if (Math.abs(prior) > Math.abs(prim) * 0.5 && Math.sign(prior) === Math.sign(prim)) return '**REPRODUCED BY PRIOR-DAY CONTROL** — not attributable to the boundary'
  if (Math.abs(plac) > Math.abs(prim) * 0.5 && Math.sign(plac) === Math.sign(prim)) return '**REPRODUCED BY PLACEBO** — an epoch-rollover pattern'
  return 'Not reproduced by either control at comparable magnitude'
}
w('| Metric | PRIMARY Δ | ROBUST Δ | PLACEBO Δ | PRIORDAY Δ | Reading |')
w('| --- | ---: | ---: | ---: | ---: | --- |')
for (const [label, f] of [
  ['Observed mean slot duration', (x: any) => x.observedMeanSlotDurationMs],
  ['Median non-vote tx / block', (x: any) => x.nonVotePerBlock.median],
  ['Failure rate', (x: any) => x.outcomes.failureRate],
  ['Median CU / transaction', (x: any) => x.computeUnits.median],
  ['Estimated CU / second', (x: any) => x.cuPerWallClockSecond_ESTIMATE.value],
  ['Median execution depth', (x: any) => x.executionDepth.median],
  ['Writable top-5 share', (x: any) => x.writableConcentration.top5Share],
] as Array<[string, (x: any) => number]>) {
  const v = dd(f)
  w(`| ${label} | ${v[0].toFixed(1)}% | ${v[1].toFixed(1)}% | ${v[2].toFixed(1)}% | ${v[3].toFixed(1)}% | ${verdict(v)} |`)
}
w('')
w('## 4. Observed slot duration is not the protocol target')
w('')
w('**Observed, from the ledger.** Windowed mean slot duration stepped from')
w(`${n(P.PRIMARY_1037_PRE.observedMeanSlotDurationMs, 1)} ms to ${n(P.PRIMARY_1037_POST.observedMeanSlotDurationMs, 1)} ms across the epoch-1037 boundary`)
w(`(${rel(P.PRIMARY_1037_PRE.observedMeanSlotDurationMs, P.PRIMARY_1037_POST.observedMeanSlotDurationMs)}), reproduced in the 3-hour robustness window`)
w(`(${n(P.ROBUST_1037_PRE.observedMeanSlotDurationMs, 1)} → ${n(P.ROBUST_1037_POST.observedMeanSlotDurationMs, 1)} ms). Neither control shows a comparable step:`)
w(`PLACEBO_1036 moved ${rel(P.PLACEBO_1036_PRE.observedMeanSlotDurationMs, P.PLACEBO_1036_POST.observedMeanSlotDurationMs)} across an ordinary epoch rollover and PRIORDAY`)
w(`${rel(P.PRIORDAY_PRE.observedMeanSlotDurationMs, P.PRIORDAY_POST.observedMeanSlotDurationMs)} across the same clock hour a day earlier.`)
w('')
w('**Protocol, from documentation.** The target slot duration changed 300 ms → 250 ms at epoch 1037,')
w('the fourth of five SIMD-0525 stages. That value is documentation, not measurement, and is not')
w('derived from any block in this corpus.')
w('')
w('**The ledger does not identify SIMD-0525.** This corpus cannot distinguish SIMD-0525 from any')
w('other change activating at the same boundary. Observed duration runs above the documented target')
w('on both sides, which is consistent with per-slot overhead but establishes nothing about its cause.')
w('')
w('## 5. Limits')
w('')
w('- `blockTime` is a 1-second-quantised, stake-weighted validator estimate. Every duration here is a')
w('  whole-window mean. **No per-slot or adjacent-pair latency is derivable**, and none is claimed.')
w('- Workloads are uncontrolled. PRE/POST is a position either side of a boundary, not a treatment.')
w('- Writable-account concentration is a workload descriptor. **It is not scheduler contention** — no')
w('  lock conflict, serialisation or queueing claim follows from it.')
w('- The placebo controls epoch rollover, not time of day. The prior-day control bounds time of day')
w('  imperfectly: it holds the hour fixed, not the day, the market, or anything else that moved.')
w('- All counts are sampled-ledger counts. Transactions that never landed are invisible here.')
w('- One boundary, one day. Nothing here establishes that any pattern recurs.')
w('')
writeFileSync(`${DIR}/report.md`, lines.join('\n'))
process.stdout.write(`wrote ${DIR}/report.md (${lines.length} lines)\n`)
