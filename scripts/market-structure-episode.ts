import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collectComputeBudget, deriveExecutionState, derivePriorityFeeLamports, findExplicitProgramError, type ReceiptRpcInstruction, type ReceiptRpcTransaction } from '../lib/receipt-evidence.ts'
import { buildEpisode, METHODOLOGY_VERSION, type ResearchRecord } from './market-structure-core.ts'

type Entry = { signature: string; metadata?: Record<string, unknown> }
type Key = string | { pubkey?: string; signer?: boolean }
type RpcTx = ReceiptRpcTransaction & { slot?: number; blockTime?: number | null; meta?: ReceiptRpcTransaction['meta'] & { innerInstructions?: Array<{ instructions?: ReceiptRpcInstruction[] }> }; transaction?: ReceiptRpcTransaction['transaction'] & { message?: { accountKeys?: Key[]; instructions?: ReceiptRpcInstruction[] } } }
type Cache = Record<string, { transaction?: RpcTx; error?: string }>

const keyAddress = (key: Key | undefined) => typeof key === 'string' ? key : key?.pubkey
function extract(entry: Entry, tx: RpcTx): ResearchRecord {
  const keys = tx.transaction?.message?.accountKeys ?? []
  const primarySigner = keys.find((key) => typeof key !== 'string' && key.signer)
  const budget = collectComputeBudget(tx), priority = derivePriorityFeeLamports(tx, budget), receiptState = deriveExecutionState(tx)
  const state = receiptState === 'did-not-land' ? 'unavailable' : receiptState
  const documented = findExplicitProgramError(tx, (id) => id)
  const noProfit = state === 'landed-but-failed' && (tx.meta?.logMessages ?? []).some((line) => /\bno_profit\b|\bno profitable\b.*\b(route|pair)\b/i.test(line))
  const instructions = [...(tx.transaction?.message?.instructions ?? []), ...(tx.meta?.innerInstructions?.flatMap((group) => group.instructions ?? []) ?? [])]
  const programs = [...new Set(instructions.map((instruction) => instruction.programId ?? (typeof instruction.programIdIndex === 'number' ? keyAddress(keys[instruction.programIdIndex]) : undefined)).filter((value): value is string => Boolean(value)))]
  return { signature: entry.signature, slot: tx.slot ?? null, blockTime: tx.blockTime ?? null, primarySigner: typeof primarySigner === 'string' ? primarySigner : primarySigner?.pubkey ?? null, execution: { state }, fees: { totalLamports: typeof tx.meta?.fee === 'number' ? tx.meta.fee : null, priorityFeeLamports: priority.amountLamports }, compute: { requestedCU: budget.computeUnitLimit, consumedCU: tx.meta?.computeUnitsConsumed ?? null }, programs: programs.map((id) => ({ id })), failureClass: state !== 'landed-but-failed' ? null : noProfit ? 'explicit-no-profit-or-route' : documented?.name ?? (documented ? 'opaque-custom-error' : 'undocumented'), failingProgram: state === 'landed-but-failed' ? documented?.programId ?? null : null }
}

async function fetchAll(entries: Entry[], cache: Cache, apiKey: string, cachePath: string) {
  const missing = entries.filter((entry) => !cache[entry.signature])
  for (let offset = 0; offset < missing.length; offset += 10) {
    const batch = missing.slice(offset, offset + 10)
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch.map((entry, id) => ({ jsonrpc: '2.0', id, method: 'getTransaction', params: [entry.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] }))) })
    const body = await response.json() as Array<{ id: number; result?: RpcTx | null; error?: { message?: string } }>
    if (!response.ok || !Array.isArray(body)) throw new Error(`RPC receipt batch failed (${response.status})`)
    for (const item of body) cache[batch[item.id].signature] = item.result ? { transaction: item.result } : { error: item.error?.message ?? 'Transaction unavailable' }
    await writeFile(cachePath, JSON.stringify(cache)); console.log(`Fetched ${Math.min(offset + 10, missing.length)}/${missing.length} receipts`)
  }
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) throw new Error('Usage: npm run research:market:episode -- <sample.json> [output-directory]')
  const input = JSON.parse(await readFile(inputPath, 'utf8')) as { sampling: Record<string, unknown> & { methodologyVersion?: string; targetMint?: string; tokenLabel?: string | null; requestedWindow?: { startSlot?: number; endSlot?: number } }; transactions?: Entry[] }
  if (input.sampling.methodologyVersion !== METHODOLOGY_VERSION) throw new Error(`Sampling methodology must be ${METHODOLOGY_VERSION}`)
  const startSlot = input.sampling.requestedWindow?.startSlot, endSlot = input.sampling.requestedWindow?.endSlot, mint = input.sampling.targetMint
  if (!mint || !Number.isInteger(startSlot) || !Number.isInteger(endSlot)) throw new Error('Sample is missing mint or predetermined slot window')
  const outputDirectory = path.resolve(process.argv[3] ?? path.dirname(inputPath)), cachePath = path.join(outputDirectory, 'rpc-cache.json')
  await mkdir(outputDirectory, { recursive: true }); let cache: Cache = {}; try { cache = JSON.parse(await readFile(cachePath, 'utf8')) } catch {}
  const env = await readFile('.env.local', 'utf8'), apiKey = env.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim(); if (!apiKey) throw new Error('HELIUS_API_KEY is required in .env.local')
  const entries = input.transactions ?? []; await fetchAll(entries, cache, apiKey, cachePath)
  const records = entries.flatMap((entry) => cache[entry.signature]?.transaction ? [extract(entry, cache[entry.signature].transaction!)] : [])
  const outsideWindow = records.filter((record) => record.slot == null || record.slot < startSlot! || record.slot > endSlot!).map((record) => record.signature)
  const episode = { generatedAt: new Date().toISOString(), outcomeDataIncluded: false, fetchFailures: entries.filter((entry) => !cache[entry.signature]?.transaction).map((entry) => ({ signature: entry.signature, error: cache[entry.signature]?.error ?? 'missing' })), excludedOutsideObservationWindow: outsideWindow, records, ...buildEpisode(records, { mint, label: input.sampling.tokenLabel ?? undefined, observationStartSlot: startSlot!, observationEndSlot: endSlot! }, input.sampling) }
  await writeFile(path.join(outputDirectory, 'episode.json'), JSON.stringify(episode, null, 2) + '\n')
  console.log(`Wrote episode for ${records.length - outsideWindow.length} in-window receipts to ${path.join(outputDirectory, 'episode.json')}`)
}
void main()
