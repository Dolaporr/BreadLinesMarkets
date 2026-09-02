import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

type UniverseRow = { mint: string; graduation_slot: number; graduation_timestamp_utc: string; observation_end_utc: string }
type Json = Record<string, any>
const root = path.resolve('research/market-structure')
const universePath = path.join(root, 'token-universe.json')
const fullRoot = path.join(root, 'full-cohort')
const pilotRoot = path.join(root, 'pilot-50')

async function readJson(file: string): Promise<Json | null> { return readFile(file, 'utf8').then(JSON.parse).catch(() => null) }
async function atomicJson(file: string, value: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); await rename(temp, file) }
function csv(value: unknown) { const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text }
function percentile(values: number[], p: number) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b), i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo) }
function distributionSummary(values: number[]) { return { count: values.length, min: values.length ? Math.min(...values) : null, p25: percentile(values, .25), median: percentile(values, .5), p95: percentile(values, .95), max: values.length ? Math.max(...values) : null } }
function metric(metrics: Json, pathParts: string[]) { let value: any = metrics; for (const part of pathParts) value = value?.[part]; return value ?? null }
function availability(rows: Json[], column: string) { return rows.filter((row) => row.episode_status === 'COMPLETE' && row[column] != null).length }

async function sourceFor(mint: string) {
  for (const directory of [path.join(fullRoot, mint), path.join(pilotRoot, mint)]) {
    const episode = await readJson(path.join(directory, 'episode.json'))
    const operations = await readJson(path.join(directory, 'operations.json'))
    if (episode || operations) return { directory, episode, operations }
  }
  return { directory: null, episode: null, operations: null }
}

function featureRow(universe: UniverseRow, episode: Json | null, operations: Json | null, directory: string | null) {
  const metrics = episode?.metrics ?? {}
  const failures = Number(metrics.failures ?? 0)
  const failureClasses = metrics.failureClasses ?? []
  const classCount = (name: string) => failureClasses.find((row: Json) => row.value === name)?.count ?? 0
  let episodeStatus = 'FAILED', statusReason: string | null = 'no persisted collection state'
  if (episode && operations?.complete) { episodeStatus = operations.fetchFailures > 0 ? 'PARTIAL' : 'COMPLETE'; statusReason = operations.fetchFailures > 0 ? `${operations.fetchFailures} sampled receipt fetch failure(s)` : null }
  else if (operations && !operations.complete) statusReason = operations.incompleteReason ?? 'collection did not complete'
  else if (episode) { episodeStatus = 'PARTIAL'; statusReason = 'Episode evidence exists without a COMPLETE operations record' }
  const d = (name: string, group = 'all') => metric(metrics, ['distributions', name, group])
  return {
    mint: universe.mint, graduation_timestamp: universe.graduation_timestamp_utc, observation_end: universe.observation_end_utc, graduation_slot: universe.graduation_slot,
    episode_status: episodeStatus, status_reason: statusReason, episode_source: directory ? path.relative(process.cwd(), path.join(directory, 'episode.json')) : null,
    methodology_version: episode?.methodologyVersion ?? null, transactions_sampled: metrics.transactions ?? null, successes: metrics.successes ?? null, failures: metrics.failures ?? null,
    successful_execution_rate: metrics.successRate ?? null, failure_rate: metrics.transactions ? failures / metrics.transactions : null,
    unique_primary_signers: metrics.uniquePrimarySigners ?? null, new_to_observation_successful_signers: metrics.successfulNewSigners ?? null,
    returning_successful_signers: metrics.successfulReturningSigners ?? null, new_to_sample_signers: metrics.newToSampleSigners ?? null, returning_signers: metrics.returningSigners ?? null,
    successful_execution_top1: metric(metrics, ['successfulExecutionConcentration', 'top1']), successful_execution_top5: metric(metrics, ['successfulExecutionConcentration', 'top5']), successful_execution_top10: metric(metrics, ['successfulExecutionConcentration', 'top10']), successful_execution_hhi: metric(metrics, ['successfulExecutionConcentration', 'hhi']),
    failure_signer_hhi: metric(metrics, ['failureConcentration', 'bySigner', 'hhi']), failure_program_hhi: metric(metrics, ['failureConcentration', 'byProgram', 'hhi']),
    explicit_no_profit_or_route_share: failures ? classCount('explicit-no-profit-or-route') / failures : null,
    opaque_error_share: failures ? (classCount('opaque-custom-error') + classCount('undocumented')) / failures : null,
    failure_classes: failureClasses, failure_signer_concentration: metric(metrics, ['failureConcentration', 'bySigner']), failure_program_concentration: metric(metrics, ['failureConcentration', 'byProgram']),
    fee_lamports_all: d('feeLamports'), priority_fee_lamports_all: d('priorityFeeLamports'), requested_cu_all: d('requestedCU'), consumed_cu_all: d('consumedCU'),
    normalized_slices: episode?.slices ?? null,
    candidate_transactions_encountered: operations?.candidateTransactionsEncountered ?? null, transactions_retained: operations?.transactionsRetained ?? null, successful_fetches: operations?.transactionsFetched ?? null,
    fetch_failures: operations?.fetchFailures ?? null, retries: operations?.retries ?? null, rpc_method_calls: operations?.rpcMethodCalls ?? null, http_requests: operations?.httpRequests ?? null,
    helius_credits: operations?.heliusCredits ?? null, helius_credits_measurement: operations?.heliusCreditsMeasurement ?? null, runtime_seconds: operations?.runtimeSecondsThisRun ?? null, operation_errors: operations?.errors ?? [], reused_from_pilot: operations?.reusedFromPilot === true,
  }
}

async function main() {
  const input = await readJson(universePath) as { graduations?: UniverseRow[] } | null
  const universe = input?.graduations ?? []
  if (universe.length !== 2508) throw new Error(`Frozen universe expected 2,508 graduations; found ${universe.length}`)
  await mkdir(root, { recursive: true })
  const rows: Json[] = []
  for (const graduation of universe) { const source = await sourceFor(graduation.mint); rows.push(featureRow(graduation, source.episode, source.operations, source.directory)) }
  const complete = rows.filter((row) => row.episode_status === 'COMPLETE'), partial = rows.filter((row) => row.episode_status === 'PARTIAL'), failed = rows.filter((row) => row.episode_status === 'FAILED')
  await atomicJson(path.join(root, 'full-cohort-episodes.json'), { generatedAt: new Date().toISOString(), frozenUniversePath: 'research/market-structure/token-universe.json', frozenUniverseSize: universe.length, outcomeDataIncluded: false, temporalBoundary: 'Each Episode uses only graduation_timestamp through graduation_timestamp + 2 hours.', rows })
  const columns = Object.keys(rows[0] ?? {})
  await writeFile(path.join(root, 'full-cohort-features.csv'), `${columns.join(',')}\n${rows.map((row) => columns.map((column) => csv(row[column])).join(',')).join('\n')}\n`)
  const numeric = (key: string) => complete.map((row) => row[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const errorMessages = rows.flatMap((row) => row.episode_status === 'FAILED' ? [row.status_reason] : []).filter(Boolean)
  const throttles = rows.reduce((sum, row) => sum + (Array.isArray(row.operation_errors) ? row.operation_errors.filter((error: Json) => /HTTP 429/i.test(error.message ?? '')).length : 0), 0)
  const metricColumns = ['transactions_sampled', 'successful_execution_rate', 'unique_primary_signers', 'new_to_observation_successful_signers', 'returning_successful_signers', 'successful_execution_top1', 'successful_execution_top5', 'successful_execution_top10', 'successful_execution_hhi', 'failure_rate', 'explicit_no_profit_or_route_share', 'opaque_error_share', 'fee_lamports_all', 'priority_fee_lamports_all', 'requested_cu_all', 'consumed_cu_all']
  const audit = [
    '# Full-cohort Market Structure audit', '', `Generated: ${new Date().toISOString()}`, '', '## Cohort status', '', `- Frozen universe size: ${universe.length}`, `- COMPLETE: ${complete.length}`, `- PARTIAL: ${partial.length}`, `- FAILED: ${failed.length}`, `- Total transactions processed: ${numeric('successful_fetches').reduce((a, b) => a + b, 0)}`, `- RPC method calls: ${numeric('rpc_method_calls').reduce((a, b) => a + b, 0)}`, `- HTTP requests: ${numeric('http_requests').reduce((a, b) => a + b, 0)}`, `- Retry attempts: ${numeric('retries').reduce((a, b) => a + b, 0)}`, `- Helius throttling events recorded: ${throttles}`, `- Estimated Helius credits: ${numeric('helius_credits').reduce((a, b) => a + b, 0)} (estimated where recorded)`, `- Aggregate per-token runtime: ${numeric('runtime_seconds').reduce((a, b) => a + b, 0).toFixed(1)} seconds`, '', '## Observation distribution (COMPLETE Episodes)', '', `- Transactions sampled/retained: ${JSON.stringify(distributionSummary(numeric('transactions_sampled')))}`, `- Successful receipt fetches: ${JSON.stringify(distributionSummary(numeric('successful_fetches')))}`, `- Runtime seconds: ${JSON.stringify(distributionSummary(numeric('runtime_seconds')))}`, '', '## Metric availability (COMPLETE Episodes)', '', ...metricColumns.map((column) => `- ${column}: ${availability(rows, column)} / ${complete.length}`), '', '## Systematic missingness', '', '- Null metrics are retained for sparse samples, absent successful or failed executions, absent signer identities, or absent fee/compute fields; no token was excluded for missing or undefined metrics.', `- Failed/incomplete status reasons: ${errorMessages.length ? JSON.stringify([...new Set(errorMessages)].slice(0, 50)) : 'none'}`, '- No outcome, price, liquidity, volume, survival, holder, social, or post-observation-window information was fetched or used.', ''
  ].join('\n')
  await writeFile(path.join(root, 'full-cohort-audit.md'), audit)
  console.log(`Full cohort aggregation: ${complete.length} COMPLETE, ${partial.length} PARTIAL, ${failed.length} FAILED / ${universe.length}`)
}
void main()
