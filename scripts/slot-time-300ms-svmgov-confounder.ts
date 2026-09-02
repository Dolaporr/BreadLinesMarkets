import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('research/slot-time-300ms-boundary')
const PLAN = path.join(OUT, 'sampling-plan.json')
const ANALYSIS = path.join(OUT, 'analysis.json')
const OUTPUT = path.join(OUT, 'svmgov-prewindow-sample.json')
const MARKDOWN = path.join(OUT, 'svmgov-prewindow-sample.md')
const PROGRAM = 'govYkyQ3ePtGULAtY6V75qjWE8UH4vCUVQ1W4HdCAZU'
const VOTE = 'Vote111111111111111111111111111111111111111'
const COMPUTE = 'ComputeBudget111111111111111111111111111111'
const RPS = 4
const MAX_IN_FLIGHT = 4

type Tx = { transaction?: { message?: { accountKeys?: string[]; instructions?: Array<{ programIdIndex?: number }> } } }
type Block = { blockTime?: number | null; transactions?: Tx[] }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function atomic(file: string, value: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); for (let attempt = 0; attempt < 4; attempt++) try { await rename(temp, file); return } catch (error) { if (attempt === 3) throw error; await sleep(100 * (attempt + 1)) } }
async function apiKey() { const text = await readFile('.env.local', 'utf8'), key = text.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim(); if (!key) throw new Error('HELIUS_API_KEY is required'); return key }
let nextRequestAt = 0
async function rpc<T>(key: string, method: string, params: unknown[]): Promise<T> { for (let attempt = 0; attempt < 8; attempt++) { const delay = Math.max(0, nextRequestAt - Date.now()); if (delay) await sleep(delay); nextRequestAt = Math.max(nextRequestAt, Date.now()) + 1_000 / RPS; let retryAfter = 0; try { const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: attempt + 1, method, params }), signal: AbortSignal.timeout(60_000) }); const body = await response.json() as { result?: T; error?: { message?: string } }; if (response.ok && !body.error && body.result !== undefined) return body.result; if (response.status !== 429 && response.status < 500) throw new Error(body.error?.message ?? `HTTP ${response.status}`); const seconds = Number(response.headers.get('retry-after')); retryAfter = Number.isFinite(seconds) ? seconds * 1_000 : 0 } catch (error) { if (attempt === 7) throw error } const backoff = Math.max(retryAfter, Math.min(60_000, 1_000 * 2 ** attempt + Math.floor(Math.random() * 500))); nextRequestAt = Math.max(nextRequestAt, Date.now() + backoff); await sleep(backoff) } throw new Error(`${method} exhausted retries`) }
function outerPrograms(tx: Tx) { const keys = tx.transaction?.message?.accountKeys, instructions = tx.transaction?.message?.instructions; if (!keys || !instructions) return null; return instructions.map(instruction => keys[instruction.programIdIndex ?? -1]) }
function isVoteOnly(programs: string[] | null) { return programs != null && programs.includes(VOTE) && programs.every(program => program === VOTE || program === COMPUTE) }
async function pool<T, R>(items: T[], work: (item: T) => Promise<R>) { const results: R[] = [], queue = [...items]; const workers = Array.from({ length: Math.min(MAX_IN_FLIGHT, items.length) }, async () => { while (queue.length) results.push(await work(queue.shift()!)) }); await Promise.all(workers); return results }
async function main() {
  await mkdir(OUT, { recursive: true })
  const plan = JSON.parse(await readFile(PLAN, 'utf8')) as { windows: Record<string, { slots: number[] }> }, analysis = JSON.parse(await readFile(ANALYSIS, 'utf8'))
  const slots = plan.windows.before_6h?.slots
  if (!slots?.length) throw new Error('Missing fixed before_6h sampling plan')
  const buckets = analysis.extended6Hours.beforeBuckets as Array<{ index: number; startUtc: string; endUtc: string }>
  if (buckets.length !== 6) throw new Error('Expected six fixed pre-window buckets')
  const key = await apiKey(), account = await rpc<{ value?: { executable?: boolean; owner?: string; lamports?: number } | null }>(key, 'getAccountInfo', [PROGRAM, { commitment: 'finalized', encoding: 'base64' }])
  const rows = await pool(slots, async slot => {
    const block = await rpc<Block | null>(key, 'getBlock', [slot, { encoding: 'json', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 1 }]); if (!block?.blockTime) throw new Error(`Sampled block ${slot} unavailable or missing block time`)
    let nonVoteTransactions = 0, svmgovOuterTransactions = 0
    for (const tx of block.transactions ?? []) { const programs = outerPrograms(tx); if (programs == null || isVoteOnly(programs)) continue; nonVoteTransactions++; if (programs.includes(PROGRAM)) svmgovOuterTransactions++ }
    const time = block.blockTime * 1_000, bucket = buckets.find(item => time >= Date.parse(item.startUtc) && time < Date.parse(item.endUtc))?.index
    if (!bucket) throw new Error(`Sampled slot ${slot} is outside its fixed pre-window buckets`)
    return { slot, blockTimeUtc: new Date(time).toISOString(), bucket, nonVoteTransactions, svmgovOuterTransactions }
  })
  const grouped = buckets.map(bucket => { const included = rows.filter(row => row.bucket === bucket.index), transactions = included.reduce((sum, row) => sum + row.nonVoteTransactions, 0), governance = included.reduce((sum, row) => sum + row.svmgovOuterTransactions, 0); return { bucket: bucket.index, startUtc: bucket.startUtc, endUtc: bucket.endUtc, sampledBlocks: included.length, sampledLandedNonVoteTransactions: transactions, svmgovOuterTransactions: governance, sampledBlocksWithSvmgovOuter: included.filter(row => row.svmgovOuterTransactions > 0).length, svmgovShareOfSampledNonVoteTransactions: transactions ? governance / transactions : null, svmgovTransactionsPerSampledBlock: included.length ? governance / included.length : null } })
  const totalTransactions = grouped.reduce((sum, item) => sum + item.sampledLandedNonVoteTransactions, 0), totalGovernance = grouped.reduce((sum, item) => sum + item.svmgovOuterTransactions, 0)
  const output = { schemaVersion: 1, generatedAt: new Date().toISOString(), scope: 'Fixed unbuffered six-hour pre-boundary sample only. An occurrence means an outer instruction program ID exactly equals the documented svmgov program ID; it is not an application, sender, or causal attribution.', program: { id: PROGRAM, accountInfo: account.value ?? null, firstPartyDocumentation: 'https://github.com/solana-foundation/solana-governance/blob/main/docs/src/content/svmgov/index.mdx' }, sampling: { window: 'before_6h', fixedSampledBlocks: slots.length, fixedBuckets: 6, transactionFilter: 'Same deterministic vote-only exclusion used by the slot-time study.' }, total: { sampledLandedNonVoteTransactions: totalTransactions, svmgovOuterTransactions: totalGovernance, sampledBlocksWithSvmgovOuter: rows.filter(row => row.svmgovOuterTransactions > 0).length, svmgovShareOfSampledNonVoteTransactions: totalTransactions ? totalGovernance / totalTransactions : null }, buckets: grouped, rawPerBlockCounts: rows.sort((a, b) => a.slot - b.slot) }
  await atomic(OUTPUT, output)
  await writeFile(MARKDOWN, `# svmgov presence in the fixed pre-boundary sample\n\nProgram: \`${PROGRAM}\`. Presence requires an **outer** instruction matching that ID exactly. This measures only the fixed unbuffered six-hour pre-boundary sample and uses the study's vote-only exclusion.\n\n| Bucket | Sampled blocks | Sampled non-vote tx | svmgov outer tx | Blocks with svmgov | svmgov share of sampled non-vote tx | svmgov tx / sampled block |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${grouped.map(item => `| ${item.bucket} | ${item.sampledBlocks} | ${item.sampledLandedNonVoteTransactions.toLocaleString()} | ${item.svmgovOuterTransactions} | ${item.sampledBlocksWithSvmgovOuter} | ${((item.svmgovShareOfSampledNonVoteTransactions ?? 0) * 100).toFixed(4)}% | ${(item.svmgovTransactionsPerSampledBlock ?? 0).toFixed(4)} |`).join('\n')}\n\nNo result from this table establishes that governance activity caused any boundary-adjacent execution change. It is a deterministic candidate-confounder presence check only.\n`)
}
void main()
