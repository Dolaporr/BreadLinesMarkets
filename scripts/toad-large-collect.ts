import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TOAD_MINT = 'A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump'
const START_SLOT = 438060926
const END_SLOT = 438429933
const SLICE_COUNT = 250
const QUOTA_PER_SLICE = 32

type AccountKey = string | { pubkey?: string }
type Block = { transactions?: Array<{ transaction?: { signatures?: string[]; message?: { accountKeys?: AccountKey[] } } }> }
type InputRecord = { signature: string; metadata: Record<string, unknown> }

function hash(value: string) {
  let current = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index)
    current = Math.imul(current, 16777619)
  }
  return current >>> 0
}

function touchesToad(transaction: NonNullable<Block['transactions']>[number]) {
  return transaction.transaction?.message?.accountKeys?.some((key) =>
    (typeof key === 'string' ? key : key.pubkey) === TOAD_MINT,
  ) ?? false
}

async function rpc(method: string, params: unknown[], apiKey: string) {
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const text = await response.text()
  let body: { error?: { message?: string }; result?: Block | null }
  try { body = JSON.parse(text) } catch { throw new Error(`RPC returned ${response.status}: ${text.slice(0, 120)}`) }
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `RPC request failed (${response.status})`)
  return body.result
}

async function availableBlock(center: number, apiKey: string) {
  for (let distance = 0; distance <= 4; distance += 1) {
    const slots = distance ? [center - distance, center + distance] : [center]
    for (const slot of slots) {
      if (slot < START_SLOT || slot > END_SLOT) continue
      try {
        const block = await rpc('getBlock', [slot, { encoding: 'jsonParsed', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 0 }], apiKey)
        if (block?.transactions) return { slot, block }
      } catch (error) {
        if (!(error instanceof Error) || !/skipped|not available|was skipped/i.test(error.message)) throw error
      }
    }
  }
  throw new Error(`No available block within four slots of ${center}.`)
}

async function readExisting(outputPath: string) {
  try {
    const parsed = JSON.parse(await readFile(outputPath, 'utf8')) as { transactions?: InputRecord[]; sampling?: { slices?: Array<{ slice?: number }> } }
    const slices = parsed.sampling?.slices ?? []
    return { transactions: parsed.transactions ?? [], slices, completeSlices: new Set(slices.map((slice) => slice.slice).filter((slice): slice is number => typeof slice === 'number')) }
  } catch { return { transactions: [] as InputRecord[], slices: [] as Array<{ slice?: number }>, completeSlices: new Set<number>() } }
}

async function main() {
  const outputPath = path.resolve(process.argv[2] ?? 'research/toad-large-signatures.json')
  const phase = process.argv[3] ?? 'A'
  const env = await readFile('.env.local', 'utf8')
  const apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim()
  if (!apiKey) throw new Error('HELIUS_API_KEY is required in .env.local.')

  const existing = await readExisting(outputPath)
  const records = new Map(existing.transactions.map((record) => [record.signature, record]))
  const slices: Array<Record<string, unknown>> = [...existing.slices]

  const save = async () => {
    const output = {
      sampling: {
        method: `250 ${phase === 'B' ? 'offset' : 'base'} full-block slices; TOAD-mint account-key filter; stable signature-hash quota per slice`,
        targetMint: TOAD_MINT,
        targetSlotStart: START_SLOT,
        targetSlotEnd: END_SLOT,
        sliceCount: SLICE_COUNT,
        quotaPerSlice: QUOTA_PER_SLICE,
        targetTransactions: SLICE_COUNT * QUOTA_PER_SLICE,
        transactionsRetained: records.size,
        selection: 'Each slice is chosen only by slot position. Within its block, every transaction whose account keys contain the TOAD mint is eligible; the first 32 after stable FNV-1a signature-hash ordering are retained. Success, failure, signer, fee, programs, compute, token balances, and logs are not used for selection.',
        slices,
      },
      transactions: [...records.values()],
    }
    await mkdir(path.dirname(outputPath), { recursive: true })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
        return
      } catch (error) {
        if (attempt === 4) throw error
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
  }

  for (let index = 0; index < SLICE_COUNT; index += 1) {
    const slice = index + 1
    if (existing.completeSlices.has(slice)) {
      console.log(`Slice ${slice}/${SLICE_COUNT}: already checkpointed.`)
      continue
    }
    const position = phase === 'B' ? (index + 1) / (SLICE_COUNT + 1) : (index + 0.5) / SLICE_COUNT
    const center = Math.round(START_SLOT + ((END_SLOT - START_SLOT) * position))
    const { slot, block } = await availableBlock(center, apiKey)
    const candidates = (block.transactions ?? []).filter(touchesToad)
      .map((transaction) => transaction.transaction?.signatures?.[0])
      .filter((signature): signature is string => Boolean(signature))
      .sort((left, right) => hash(left) - hash(right) || left.localeCompare(right))
    const retained = candidates.slice(0, QUOTA_PER_SLICE)
    for (const signature of retained) {
      records.set(signature, { signature, metadata: { samplingPhase: phase, samplingSlice: slice, sampledBlockSlot: slot, collection: 'large-stratified-block-study' } })
    }
    slices.push({ slice, requestedCenterSlot: center, sampledBlockSlot: slot, mintReferenceCandidates: candidates.length, retained: retained.length })
    await save()
    console.log(`Slice ${slice}/${SLICE_COUNT}: block ${slot}, ${candidates.length} eligible, ${retained.length} retained; total ${records.size}.`)
    if (index + 1 < SLICE_COUNT) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  console.log(`Wrote ${outputPath} with ${records.size} unique signatures.`)
}

void main()
