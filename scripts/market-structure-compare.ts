import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { METHODOLOGY_VERSION } from './market-structure-core.ts'

type Episode = { methodologyVersion?: string; token?: { mint?: string; label?: string | null }; observationWindow?: unknown; slices?: Array<Record<string, unknown>>; metrics?: Record<string, unknown>; outcomeDataIncluded?: boolean }
type Manifest = { episodes: string[]; outcomes?: string; output?: string }
type OutcomeRow = { mint: string; outcome: string; [key: string]: unknown }

function changeSummary(slices: Array<Record<string, unknown>>) {
  const paths = ['uniquePrimarySigners', 'newToSampleSigners', 'returningSigners', 'successRate', 'successfulExecutionConcentration.top1', 'successfulExecutionConcentration.top5', 'successfulExecutionConcentration.top10', 'successfulExecutionConcentration.hhi', 'failureConcentration.bySigner.hhi', 'failureConcentration.byProgram.hhi']
  const read = (row: Record<string, unknown>, key: string) => key.split('.').reduce<unknown>((value, part) => value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined, row)
  return Object.fromEntries(paths.map((key) => {
    const values = slices.map((slice) => read(slice, key)).filter((value): value is number => typeof value === 'number')
    const first = values[0] ?? null, last = values.at(-1) ?? null
    return [key, { first, last, absoluteChange: first == null || last == null ? null : last - first }]
  }))
}

async function main() {
  const manifestPath = process.argv[2]
  if (!manifestPath) throw new Error('Usage: npm run research:market:compare -- <comparison-manifest.json>')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest, base = path.dirname(path.resolve(manifestPath))
  if (!Array.isArray(manifest.episodes) || manifest.episodes.length < 2) throw new Error('At least two completed episode paths are required')
  const episodes = await Promise.all(manifest.episodes.map(async (file) => ({ source: file, episode: JSON.parse(await readFile(path.resolve(base, file), 'utf8')) as Episode })))
  for (const { source, episode } of episodes) {
    if (episode.methodologyVersion !== METHODOLOGY_VERSION) throw new Error(`${source} uses an incompatible methodology`)
    if (episode.outcomeDataIncluded !== false) throw new Error(`${source} does not assert outcomeDataIncluded=false`)
    if (!episode.token?.mint || !Array.isArray(episode.slices)) throw new Error(`${source} is not a completed Episode`)
  }
  const sliceCount = episodes[0].episode.slices!.length
  if (episodes.some(({ episode }) => episode.slices!.length !== sliceCount)) throw new Error('Episodes must use the same relative slice count')
  let outcomes: OutcomeRow[] = []
  if (manifest.outcomes) {
    const outcomeFile = JSON.parse(await readFile(path.resolve(base, manifest.outcomes), 'utf8')) as { outcomes?: OutcomeRow[] }
    outcomes = outcomeFile.outcomes ?? []
    if (new Set(outcomes.map((row) => row.mint)).size !== outcomes.length) throw new Error('Outcome dataset contains duplicate mint rows')
  }
  const outcomeByMint = new Map(outcomes.map((row) => [row.mint, row]))
  const comparison = {
    schemaVersion: 1, methodologyVersion: METHODOLOGY_VERSION, generatedAt: new Date().toISOString(),
    leakageControls: { transactionSelectionUsesOutcomes: false, metricCalculationUsesOutcomes: false, joinStage: 'post-episode comparison only', note: 'Outcome labels are annotations only; no classifier, ranking, or token selection is produced.' },
    relativeTime: { sliceCount, normalization: 'Each predetermined observation window is mapped to [0,1] and compared by equal relative slice.' },
    markets: episodes.map(({ source, episode }) => ({ source, mint: episode.token!.mint, label: episode.token!.label ?? null, observationWindow: episode.observationWindow, outcome: outcomeByMint.get(episode.token!.mint!) ?? null, overall: episode.metrics, changesThroughWindow: changeSummary(episode.slices!), slices: episode.slices })),
    byRelativeSlice: Array.from({ length: sliceCount }, (_, index) => ({ relativeSlice: index + 1, relativeStart: index / sliceCount, relativeEnd: (index + 1) / sliceCount, markets: episodes.map(({ episode }) => ({ mint: episode.token!.mint, label: episode.token!.label ?? null, metrics: episode.slices![index] })) })),
  }
  const output = path.resolve(base, manifest.output ?? 'comparison.json'); await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(comparison, null, 2) + '\n'); console.log(`Wrote ${output}`)
}
void main()
