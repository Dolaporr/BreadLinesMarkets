import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Json = Record<string, any>
const root = path.resolve('research/market-structure/full-cohort')
const universePath = path.resolve('research/market-structure/token-universe.json')
async function json(file: string): Promise<Json | null> { return readFile(file, 'utf8').then(JSON.parse).catch(() => null) }
async function atomic(file: string, value: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); await rename(temp, file) }
function median(values: number[]) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b), i = Math.floor((sorted.length - 1) / 2); return sorted.length % 2 ? sorted[i] : (sorted[i] + sorted[i + 1]) / 2 }

async function main() {
  const universe = (await json(universePath))?.graduations ?? []
  const operations: Json[] = []
  for (const row of universe) { const value = await json(path.join(root, row.mint, 'operations.json')); if (value) operations.push(value) }
  const complete = operations.filter((row) => row.complete), incomplete = operations.filter((row) => !row.complete)
  const errors = operations.flatMap((row) => Array.isArray(row.errors) ? row.errors : [])
  const byError = [...new Set(errors.map((error: Json) => error.message ?? 'unknown'))].map((message) => ({ message, count: errors.filter((error: Json) => (error.message ?? 'unknown') === message).length })).sort((a, b) => b.count - a.count || a.message.localeCompare(b.message))
  const runtimes = complete.map((row) => row.runtimeSecondsThisRun).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const credits = complete.map((row) => row.heliusCredits).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const terminal = operations.length, remaining = Math.max(0, universe.length - terminal)
  const data = {
    generatedAt: new Date().toISOString(), frozenUniverseSize: universe.length, progress: `${terminal} / ${universe.length}`,
    statuses: { complete: complete.length, incomplete: incomplete.length, pending: remaining },
    transport: { retryAttempts: operations.reduce((sum, row) => sum + (row.retries ?? 0), 0), helius429Events: errors.filter((error: Json) => /HTTP 429/i.test(error.message ?? '')).length, fetchFailures: errors.filter((error: Json) => /fetch failed/i.test(error.message ?? '')).length, errorMessages: byError },
    observedPerCompleteEpisode: { medianRuntimeSeconds: median(runtimes), medianEstimatedCredits: median(credits) },
    linearProjectionFromCompleteEpisodes: { remainingEpisodes: remaining, runtimeSeconds: median(runtimes) == null ? null : median(runtimes)! * remaining, estimatedCredits: median(credits) == null ? null : median(credits)! * remaining, note: 'Operational extrapolation only. It does not affect sampling, eligibility, metric definitions, or token treatment.' },
    methodologyIntegrity: { samplingChanged: false, sparseTokenHandlingChanged: false, outcomeDataIncluded: false, note: 'Sparse or incomplete Episodes remain present with explicit status/reason. No adaptive resampling is permitted.' },
  }
  await atomic(path.join(root, 'operational-watch.json'), data)
  await writeFile(path.join(root, 'operational-watch.md'), [
    '# Market Structure operational watch', '', `Generated: ${data.generatedAt}`, `Progress: ${data.progress}`, '', '## Transport and completeness', '', `- Complete: ${complete.length}`, `- Incomplete/retryable: ${incomplete.length}`, `- Pending: ${remaining}`, `- Helius 429 events: ${data.transport.helius429Events}`, `- Transport fetch failures: ${data.transport.fetchFailures}`, `- Retry attempts: ${data.transport.retryAttempts}`, '', '## Methodology integrity', '', '- Sampling contract changed: no', '- Sparse-token treatment changed: no', '- Outcome data included: no', '', '## Projection', '', `- Median runtime per completed Episode: ${data.observedPerCompleteEpisode.medianRuntimeSeconds ?? 'insufficient completed Episodes'} seconds`, `- Median estimated credits per completed Episode: ${data.observedPerCompleteEpisode.medianEstimatedCredits ?? 'insufficient completed Episodes'}`, `- Linear remaining runtime/credits: ${JSON.stringify(data.linearProjectionFromCompleteEpisodes)}`, '', 'This is an operational log only. It does not interpret market structure or use token outcomes.', ''
  ].join('\n'))
  console.log(`Operational watch: ${data.progress}; ${data.transport.helius429Events} 429 events; ${data.transport.fetchFailures} transport failures`)
}
void main()
