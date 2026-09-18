/**
 * Renders the seven preregistered charts from results.json into one self-contained HTML page.
 * Chart order and content are fixed by the preregistration; this script chooses no cuts of its own.
 */
import { readFileSync, writeFileSync } from 'node:fs'
const DIR = 'research/simd0525-epoch1037'
const r = JSON.parse(readFileSync(`${DIR}/results.json`, 'utf8'))
const P = r.populations as Record<string, any>
const G = [
  { k: 'PRIMARY_1037', pre: 'PRIMARY_1037_PRE', post: 'PRIMARY_1037_POST', note: 'primary · 60 min/side' },
  { k: 'ROBUST_1037', pre: 'ROBUST_1037_PRE', post: 'ROBUST_1037_POST', note: 'robustness · 3 h/side' },
  { k: 'PLACEBO_1036', pre: 'PLACEBO_1036_PRE', post: 'PLACEBO_1036_POST', note: 'control · rollover only' },
  { k: 'PRIORDAY', pre: 'PRIORDAY_PRE', post: 'PRIORDAY_POST', note: 'control · same hour, −24 h' },
]
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
const fmt = (v: number, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Grouped bars: one group per population, two marks (PRE, POST). One axis, always. */
function grouped(id: string, title: string, sub: string, get: (w: any) => number, unit: string, dp = 0) {
  const vals = G.map((g) => ({ g, pre: get(P[g.pre]), post: get(P[g.post]) }))
  const max = Math.max(...vals.flatMap((v) => [v.pre, v.post])) || 1
  const H = 190, BW = 34, GAP = 8, GW = BW * 2 + GAP, PAD = 64
  const bars = vals.map((v, i) => {
    const x = PAD + i * (GW + 46)
    const h1 = Math.max(2, (v.pre / max) * H), h2 = Math.max(2, (v.post / max) * H)
    return `
      <g>
        <rect class="mk s1" x="${x}" y="${H - h1 + 20}" width="${BW}" height="${h1}" rx="4"/>
        <rect class="mk s2" x="${x + BW + GAP}" y="${H - h2 + 20}" width="${BW}" height="${h2}" rx="4"/>
        <text class="vl" x="${x + BW / 2}" y="${H - h1 + 14}">${fmt(v.pre, dp)}</text>
        <text class="vl" x="${x + BW + GAP + BW / 2}" y="${H - h2 + 14}">${fmt(v.post, dp)}</text>
        <text class="ax" x="${x + GW / 2}" y="${H + 38}">${v.g.k.replace('_', ' ')}</text>
        <text class="axs" x="${x + GW / 2}" y="${H + 52}">${esc(v.g.note)}</text>
      </g>`
  }).join('')
  return `<figure class="card"><figcaption><h3>${esc(title)}</h3><p>${esc(sub)}</p></figcaption>
  <div class="legend"><span><i class="s1"></i>PRE</span><span><i class="s2"></i>POST</span><span class="u">${esc(unit)}</span></div>
  <div class="scroll"><svg viewBox="0 0 ${PAD + G.length * (GW + 46)} ${H + 64}" role="img" aria-label="${esc(title)}">
    <line class="grid" x1="${PAD - 12}" y1="${H + 20}" x2="${PAD + G.length * (GW + 46) - 30}" y2="${H + 20}"/>${bars}
  </svg></div></figure>`
}

/** Box plot over per-block values: min–max whisker, p25–p75 box, median rule. */
function box(id: string, title: string, sub: string, pick: (row: any) => number | undefined, unit: string) {
  const series = G.flatMap((g) => [{ lab: `${g.k}\nPRE`, key: g.pre }, { lab: `${g.k}\nPOST`, key: g.post }])
  const data = series.map((s) => {
    const vs = (P[s.key].perBlock as any[]).filter((b) => b.state === 'OK').map(pick).filter((v): v is number => v != null).sort((a, b) => a - b)
    const q = (p: number) => vs.length ? vs[Math.min(vs.length - 1, Math.round(p * (vs.length - 1)))] : 0
    return { ...s, min: vs[0] ?? 0, max: vs.at(-1) ?? 0, p25: q(0.25), p50: q(0.5), p75: q(0.75), n: vs.length }
  })
  // Boxes encode position and spread, not magnitude-by-length, so the scale is data-driven with
  // an explicit labelled axis rather than forced to zero. Every box also carries its median value,
  // so a number is recoverable without reading against the axis.
  const lo = Math.min(...data.map((d) => d.min)), hi = Math.max(...data.map((d) => d.max))
  const padv = (hi - lo) * 0.12 || 1
  const y0 = Math.max(0, lo - padv), y1 = hi + padv
  const H = 200, PAD = 78, SP = 74
  const y = (v: number) => 20 + H - ((v - y0) / (y1 - y0 || 1)) * H
  const ticks = [y0, (y0 + y1) / 2, y1].map((t) =>
    `<g><line class="grid" x1="${PAD - 26}" y1="${y(t)}" x2="${PAD + data.length * SP - 40}" y2="${y(t)}"/>` +
    `<text class="tick" x="${PAD - 32}" y="${y(t) + 3}">${fmt(t, (y1 - y0) < 10 ? 1 : 0)}</text></g>`).join('')
  const marks = data.map((d, i) => {
    const x = PAD + i * SP, cls = i % 2 ? 's2' : 's1'
    return `<g>
      <line class="wh ${cls}" x1="${x}" y1="${y(d.min)}" x2="${x}" y2="${y(d.max)}"/>
      <rect class="mk ${cls}" x="${x - 15}" y="${y(d.p75)}" width="30" height="${Math.max(3, y(d.p25) - y(d.p75))}" rx="4"/>
      <line class="med" x1="${x - 15}" y1="${y(d.p50)}" x2="${x + 15}" y2="${y(d.p50)}"/>
      <text class="vl" x="${x}" y="${y(d.max) - 7}">${fmt(d.p50, (y1 - y0) < 10 ? 1 : 0)}</text>
      <text class="ax" x="${x}" y="${H + 40}">${esc(d.lab.split('\n')[1])}</text>
      <text class="axs" x="${x}" y="${H + 54}">n=${d.n}</text>
    </g>`
  }).join('')
  const grp = G.map((g, i) => `<text class="axg" x="${PAD + (i * 2) * SP + SP / 2}" y="${H + 72}">${g.k.replace('_', ' ')}</text>`).join('')
  return `<figure class="card"><figcaption><h3>${esc(title)}</h3><p>${esc(sub)}</p></figcaption>
  <div class="legend"><span><i class="s1"></i>PRE</span><span><i class="s2"></i>POST</span><span class="u">${esc(unit)} · box p25–p75, rule median, whisker min–max · number = median</span></div>
  <div class="scroll"><svg viewBox="0 0 ${PAD + series.length * SP} ${H + 84}" role="img" aria-label="${esc(title)}">
    ${ticks}${marks}${grp}
  </svg></div></figure>`
}

const covRows = G.flatMap((g) => [g.pre, g.post]).map((k) => {
  const p = P[k]
  return `<tr><td>${esc(k)}</td><td>${p.plannedBlocks}</td><td>${p.selectedBlocks}</td><td>${p.realisedBlocks}${p.underpowered ? ' ⚠' : ''}</td><td>${p.absence.SKIPPED}</td><td>${p.absence.UNAVAILABLE}</td><td>${p.absence.REFUSED}</td><td>${(p.coverage.producedShare * 100).toFixed(2)}%</td><td>${(p.reconstructionCompleteness * 100).toFixed(2)}%</td></tr>`
}).join('')

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Epoch-1037 boundary — preregistered charts</title><style>
.viz-root{color-scheme:light;--surface-1:#fcfcfb;--surface-2:#f4f4f1;--text-primary:#0b0b0b;--text-secondary:#52514e;--text-muted:#77766f;--grid:#dedcd4;--s1:#2a78d6;--s2:#eb6834}
@media(prefers-color-scheme:dark){:root:where(:not([data-theme="light"])) .viz-root{color-scheme:dark;--surface-1:#1a1a19;--surface-2:#232321;--text-primary:#fff;--text-secondary:#c3c2b7;--text-muted:#8e8d84;--grid:#3a3a37;--s1:#3987e5;--s2:#d95926}}
:root[data-theme="dark"] .viz-root{color-scheme:dark;--surface-1:#1a1a19;--surface-2:#232321;--text-primary:#fff;--text-secondary:#c3c2b7;--text-muted:#8e8d84;--grid:#3a3a37;--s1:#3987e5;--s2:#d95926}
*{box-sizing:border-box}body{margin:0;background:var(--surface-2,#f4f4f1)}
.viz-root{background:var(--surface-2);color:var(--text-primary);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px 16px 64px}
.wrap{max-width:1040px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-.01em}
.sub{color:var(--text-secondary);margin:0 0 6px}
.prov{color:var(--text-muted);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0 0 24px;word-break:break-all}
.card{background:var(--surface-1);border:1px solid var(--grid);border-radius:12px;margin:0 0 18px;padding:16px}
figcaption h3{font-size:15px;margin:0 0 2px}figcaption p{margin:0 0 10px;color:var(--text-secondary);font-size:13px}
.legend{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:12px;color:var(--text-secondary);margin-bottom:6px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.legend i.s1{background:var(--s1)}.legend i.s2{background:var(--s2)}.legend .u{color:var(--text-muted)}
.scroll{overflow-x:auto}svg{width:100%;height:auto;min-width:520px;display:block}
.mk.s1{fill:var(--s1)}.mk.s2{fill:var(--s2)}
.wh{stroke-width:2}.wh.s1{stroke:var(--s1)}.wh.s2{stroke:var(--s2)}
.med{stroke:var(--surface-1);stroke-width:2}
.grid{stroke:var(--grid);stroke-width:1}
text{font:11px ui-sans-serif,system-ui,sans-serif}
.vl{fill:var(--text-secondary);text-anchor:middle;font-size:10px}
.tick{fill:var(--text-muted);text-anchor:end;font-size:9px}
.ax{fill:var(--text-secondary);text-anchor:middle;font-size:10px}
.axs{fill:var(--text-muted);text-anchor:middle;font-size:9px}
.axg{fill:var(--text-primary);text-anchor:middle;font-size:11px;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{text-align:right;padding:6px 8px;border-bottom:1px solid var(--grid)}th:first-child,td:first-child{text-align:left}
th{color:var(--text-secondary);font-weight:600}
.note{background:var(--surface-1);border:1px solid var(--grid);border-left:3px solid var(--s2);border-radius:8px;padding:12px 14px;margin:0 0 18px;font-size:13px;color:var(--text-secondary)}
.note strong{color:var(--text-primary)}
</style><div class="viz-root"><div class="wrap">
<h1>Observed execution either side of the epoch-1037 boundary</h1>
<p class="sub">Seven preregistered charts. Every chart shows the primary comparison beside both controls.</p>
<p class="prov">preregistration ${esc(r.preregistrationCommit)} · collected ${esc(r.collectedAt)} · ${esc(r.endpoint)}</p>
<div class="note"><strong>Reading these charts.</strong> PRE/POST is a position either side of a boundary, not a treatment assignment. Workloads are uncontrolled, so a difference that also appears in PRIORDAY or PLACEBO is not a boundary effect. Observed slot duration is measured from <code>blockTime</code>; the protocol target is documentation, not measurement. Writable-account concentration is a workload descriptor and is <strong>not</strong> scheduler contention.</div>
${grouped('c1', '1. Windowed observed mean slot duration', 'Whole-window measure: Δ blockTime ÷ Δ slot. Not a per-slot latency.', (w) => w.observedMeanSlotDurationMs, 'milliseconds', 1)}
${box('c2', '2. Non-vote transactions per sampled block', 'Distribution across sampled blocks in each window.', (b) => b.nonVote, 'transactions / block')}
${grouped('c3a', '3. CU per non-vote transaction — median', 'Median consumed compute units per sampled non-vote transaction.', (w) => w.computeUnits.median, 'compute units')}
${grouped('c3b', '3b. CU per non-vote transaction — p90', 'Ninetieth percentile of the same population.', (w) => w.computeUnits.p90, 'compute units')}
${grouped('c4', '4. Failure rate', 'Share of sampled non-vote transactions whose receipt carries an error.', (w) => w.outcomes.failureRate * 100, 'percent', 2)}
${box('c5', '5. Execution depth (per-block median)', 'Rendered over per-block median depth: per-transaction depth vectors were not retained, so this differs from the preregistered histogram. The window-level median and max in the report are unaffected.', (b) => b.medianDepth, 'invocation depth')}
${grouped('c6', '6. Writable-account concentration — top-1 share', 'Share of sampled non-vote transactions writing the single most-written account. NOT contention.', (w) => w.writableConcentration.top1Share * 100, 'percent', 2)}
<figure class="card"><figcaption><h3>7. Coverage and realised sample</h3><p>Printed always, before any finding is read. ⚠ marks a population below the 80% realised-sample threshold.</p></figcaption>
<div class="scroll"><table><thead><tr><th>Population</th><th>Planned</th><th>Selected</th><th>Realised</th><th>SKIPPED</th><th>UNAVAIL</th><th>REFUSED</th><th>Produced</th><th>Reconstruction</th></tr></thead><tbody>${covRows}</tbody></table></div></figure>
</div></div>`
writeFileSync(`${DIR}/charts.html`, html)
process.stdout.write(`wrote ${DIR}/charts.html\n`)
