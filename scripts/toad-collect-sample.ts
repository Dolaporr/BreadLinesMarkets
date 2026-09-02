import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TARGET_MINT = 'A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump'
const START_SLOT = 438060926
const END_SLOT = 438067458
const SLICE_COUNT = 12
const RECORDS_PER_SLICE = 40

type BlockTransaction = {
  transaction?: {
    signatures?: string[]
    message?: { accountKeys?: Array<string | { pubkey?: string }> }
  }
}

type BlockResult = { transactions?: BlockTransaction[] } | null

function signatureHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mentionsMint(transaction: BlockTransaction) {
  return transaction.transaction?.message?.accountKeys?.some((account) =>
    (typeof account === 'string' ? account : account.pubkey) === TARGET_MINT,
  ) ?? false
}

async function rpc(method: string, params: unknown[], apiKey: string) {
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await response.json() as { error?: { message?: string }; result?: BlockResult }
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `RPC request failed (${response.status})`)
  return body.result
}

async function blockForSlice(center: number, apiKey: string) {
  for (let distance = 0; distance <= 4; distance += 1) {
    const candidates = distance === 0 ? [center] : [center - distance, center + distance]
    for (const slot of candidates) {
      if (slot < START_SLOT || slot > END_SLOT) continue
      try {
        const block = await rpc('getBlock', [slot, { encoding: 'jsonParsed', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 0 }], apiKey)
        if (block?.transactions) return { slot, block }
      } catch (error) {
        if (!(error instanceof Error) || !/skipped|not available|Slot .+ was skipped/i.test(error.message)) throw error
      }
    }
  }
  throw new Error(`No available block within four slots of ${center}.`)
}

async function main() {
  const outputPath = path.resolve(process.argv[2] ?? 'research/toad-systematic-signatures.json')
  const env = await readFile('.env.local', 'utf8')
  const apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim()
  if (!apiKey) throw new Error('HELIUS_API_KEY is required in .env.local.')

  const transactions: Array<{ signature: string; metadata: Record<string, unknown> }> = []
  const slices: Array<Record<string, unknown>> = []
  let candidatesInspected = 0

  for (let index = 0; index < SLICE_COUNT; index += 1) {
    const center = Math.round(START_SLOT + ((END_SLOT - START_SLOT) * (index + 0.5)) / SLICE_COUNT)
    const { slot, block } = await blockForSlice(center, apiKey)
    const candidates = (block.transactions ?? [])
      .filter(mentionsMint)
      .map((transaction) => transaction.transaction?.signatures?.[0])
      .filter((signature): signature is string => Boolean(signature))
      .sort((left, right) => signatureHash(left) - signatureHash(right) || left.localeCompare(right))
    const retained = candidates.slice(0, RECORDS_PER_SLICE)
    candidatesInspected += candidates.length
    slices.push({ slice: index + 1, requestedCenterSlot: center, sampledBlockSlot: slot, mintReferenceCandidates: candidates.length, retained: retained.length })
    for (const signature of retained) {
      transactions.push({ signature, metadata: { samplingSlice: index + 1, sampledBlockSlot: slot, collection: 'stratified-block-sample' } })
    }
    console.log(`Slice ${index + 1}/${SLICE_COUNT}: block ${slot}, ${candidates.length} mint references, ${retained.length} retained.`)
  }

  const output = {
    sampling: {
      method: '12 evenly spaced full-block slices; mint-reference filter; stable signature-hash quota per slice',
      targetMint: TARGET_MINT,
      targetSlotStart: START_SLOT,
      targetSlotEnd: END_SLOT,
      sliceCount: SLICE_COUNT,
      recordsPerSlice: RECORDS_PER_SLICE,
      candidateSignaturesInspected: candidatesInspected,
      transactionsRetained: transactions.length,
      selection: 'For each independently selected block, all mint-reference candidates were enumerated and ordered by stable FNV-1a signature hash. The first 40 were retained. Status, error, fee, compute, signer, program, and log data were not used for selection.',
      slices,
    },
    transactions,
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`Wrote ${outputPath}`)
}

void main()
