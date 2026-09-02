import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_SAMPLING, METHODOLOGY_VERSION } from './market-structure-core.ts'

type Config = { mint: string; label?: string; startSlot?: number; endSlot?: number; startTimestamp?: string | number; endTimestamp?: string | number; outputDirectory?: string }
type AccountKey = string | { pubkey?: string }
type Block = { transactions?: Array<{ transaction?: { signatures?: string[]; message?: { accountKeys?: AccountKey[] } } }> }

function hash(value: string) { let current = 2166136261; for (let i = 0; i < value.length; i++) { current ^= value.charCodeAt(i); current = Math.imul(current, 16777619) }; return current >>> 0 }
const unix = (value: string | number) => typeof value === 'number' ? value : Math.floor(new Date(value).getTime() / 1000)

async function rpc<T>(method: string, params: unknown[], apiKey: string): Promise<T> {
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const body = await response.json() as { result?: T; error?: { message?: string } }
  if (!response.ok || body.error || body.result === undefined) throw new Error(body.error?.message ?? `RPC ${method} failed (${response.status})`)
  return body.result
}

async function slotForTimestamp(target: number, apiKey: string) {
  let low = 0, high = await rpc<number>('getSlot', [{ commitment: 'finalized' }], apiKey)
  while (low < high) {
    const mid = Math.floor((low + high) / 2), time = await rpc<number | null>('getBlockTime', [mid], apiKey).catch(() => null)
    if (time == null) { low = mid + 1; continue }
    if (time < target) low = mid + 1; else high = mid
  }
  return low
}

async function availableBlock(center: number, start: number, end: number, apiKey: string) {
  for (let distance = 0; distance <= 4; distance++) for (const slot of distance ? [center - distance, center + distance] : [center]) {
    if (slot < start || slot > end) continue
    const block = await rpc<Block | null>('getBlock', [slot, { encoding: 'jsonParsed', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 0 }], apiKey).catch((error) => { if (/skipped|not available/i.test(String(error))) return null; throw error })
    if (block?.transactions) return { slot, block }
  }
  throw new Error(`No available block within four slots of ${center}`)
}

async function main() {
  const configPath = process.argv[2]
  if (!configPath) throw new Error('Usage: npm run research:market:collect -- <config.json>')
  const config = JSON.parse(await readFile(configPath, 'utf8')) as Config
  if (!config.mint) throw new Error('config.mint is required')
  const env = await readFile('.env.local', 'utf8'), apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim()
  if (!apiKey) throw new Error('HELIUS_API_KEY is required in .env.local')
  const usesSlots = Number.isInteger(config.startSlot) && Number.isInteger(config.endSlot), usesTimes = config.startTimestamp != null && config.endTimestamp != null
  if (usesSlots === usesTimes) throw new Error('Supply exactly one complete window: startSlot/endSlot or startTimestamp/endTimestamp')
  const startSlot = usesSlots ? config.startSlot! : await slotForTimestamp(unix(config.startTimestamp!), apiKey)
  const endSlot = usesSlots ? config.endSlot! : await slotForTimestamp(unix(config.endTimestamp!), apiKey)
  if (startSlot >= endSlot) throw new Error('Observation window start must be before end')
  const slug = (config.label ?? config.mint).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const outputDirectory = path.resolve(config.outputDirectory ?? `research/market-structure/${slug}`), records = new Map<string, unknown>(), slices = [] as unknown[]
  for (let phase = 0; phase < DEFAULT_SAMPLING.phases; phase++) for (let index = 0; index < DEFAULT_SAMPLING.slicesPerPhase; index++) {
    const position = phase === 0 ? (index + .5) / DEFAULT_SAMPLING.slicesPerPhase : (index + 1) / (DEFAULT_SAMPLING.slicesPerPhase + 1)
    const center = Math.round(startSlot + (endSlot - startSlot) * position), { slot, block } = await availableBlock(center, startSlot, endSlot, apiKey)
    const candidates = (block.transactions ?? []).filter((item) => item.transaction?.message?.accountKeys?.some((key) => (typeof key === 'string' ? key : key.pubkey) === config.mint)).map((item) => item.transaction?.signatures?.[0]).filter((value): value is string => Boolean(value)).sort((a, b) => hash(a) - hash(b) || a.localeCompare(b))
    const retained = candidates.slice(0, DEFAULT_SAMPLING.quotaPerSlice)
    for (const signature of retained) if (!records.has(signature)) records.set(signature, { signature, metadata: { samplingPhase: phase + 1, samplingSlice: index + 1, sampledBlockSlot: slot } })
    slices.push({ phase: phase + 1, slice: index + 1, requestedCenterSlot: center, sampledBlockSlot: slot, eligible: candidates.length, retained: retained.length })
    console.log(`Phase ${phase + 1}, slice ${index + 1}: ${retained.length} retained`)
  }
  const sampling = { methodologyVersion: METHODOLOGY_VERSION, method: 'Two interleaved sets of 250 evenly spaced full-block slices; mint account-key filter; stable FNV-1a signature-hash quota per slice; signature deduplication across phases', selection: 'Slice position, mint account-key reference, and stable signature hash only. Receipt status, signer, fee, program, compute, balances, logs, and outcome labels are never used for selection.', targetMint: config.mint, tokenLabel: config.label ?? null, requestedWindow: { startSlot, endSlot, startTimestamp: config.startTimestamp ?? null, endTimestamp: config.endTimestamp ?? null }, ...DEFAULT_SAMPLING, slices, transactionsRetained: records.size }
  await mkdir(outputDirectory, { recursive: true }); await writeFile(path.join(outputDirectory, 'sample.json'), JSON.stringify({ sampling, transactions: [...records.values()] }, null, 2) + '\n')
  console.log(`Wrote ${records.size} signatures to ${path.join(outputDirectory, 'sample.json')}`)
}
void main()
