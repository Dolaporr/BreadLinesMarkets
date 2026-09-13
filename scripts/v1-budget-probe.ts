import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collectComputeBudget } from '../lib/receipt-evidence.ts'
import { normalizeReceipt, type Receipt } from '../research/execution-casefile/core.ts'

/**
 * Phase 1 of research/v1-budget-source/preregistration.md — READ ONLY.
 *
 * Walks back from the current devnet slot and records, for every transaction served with a
 * non-legacy/non-0 version, whether Breadlines' existing guards reject it and what the Compute
 * Budget parser would report if they do not. It sends nothing, signs nothing, needs no key and
 * calls no paid RPC.
 *
 *   node --experimental-strip-types scripts/v1-budget-probe.ts
 */
const ENDPOINT = process.env.BREADLINES_DEVNET_RPC ?? 'https://api.devnet.solana.com'
const MAX_BLOCKS = 500
const MAX_SAMPLE = 200
const OUT = 'research/v1-budget-source'
const REQUEST_SPACING_MS = Number(process.env.BREADLINES_PROBE_SPACING_MS ?? 260)
const RATE_LIMIT_BACKOFF_MS = 900
/** Below this share of the declared window actually read, a null result is not reportable. */
const MIN_COVERAGE = 0.6

type Row = {
  signature: string
  slot: number
  servedVersion: string
  configKeys: string[]
  computeBudgetIxCount: number
  parserDisposition: 'REJECTED_VERSION' | 'REJECTED_CONFIG' | 'REJECTED_OTHER' | 'ACCEPTED'
  rejectionMessage: string | null
  budgetIfAccepted: { computeUnitLimit: number | null; computeUnitPriceMicroLamports: number | null; computeUnitPriceStatus: string } | null
  h1Triggered: boolean
}

const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111'
const CONFIG_KEY = /^(?:transactionConfig|config|resourceConfig|budget|transaction_config)$/i

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A throttled call with backoff on rate limiting. Distinguishing "the node refused to answer"
 * from "the block is not there" is the whole point: a run that mostly got rate-limited must not
 * be reported as a clean absence of V1 traffic.
 */
async function rpc(method: string, params: unknown[], attempt = 0): Promise<unknown> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  })
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) throw new RpcRefused(`${method} HTTP ${response.status} after ${attempt + 1} attempts`)
    await sleep(RATE_LIMIT_BACKOFF_MS * 2 ** attempt)
    return rpc(method, params, attempt + 1)
  }
  if (!response.ok) throw new RpcRefused(`${method} returned HTTP ${response.status}`)
  const body = await response.json() as { result?: unknown; error?: { message?: string; code?: number } }
  if (body.error) {
    const message = body.error.message ?? 'RPC error'
    // -32004/-32007/-32009 and "skipped"/"not available" mean the block genuinely is not there.
    if (/skipped|not available|was skipped|cleaned up|does not exist/i.test(message)) throw new BlockAbsent(message)
    throw new RpcRefused(`${method}: ${message}`)
  }
  return body.result
}

class RpcRefused extends Error {}
class BlockAbsent extends Error {}

async function atomic(file: string, value: unknown) {
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temp, file)
}

function configKeysOf(tx: Record<string, unknown>) {
  const message = (tx.transaction as { message?: Record<string, unknown> } | undefined)?.message ?? {}
  return [...Object.keys(tx), ...Object.keys(message)].filter((key) => CONFIG_KEY.test(key)).sort()
}

function computeBudgetIxCount(tx: Record<string, unknown>) {
  const message = (tx.transaction as { message?: { accountKeys?: unknown[]; instructions?: Array<{ programId?: string; programIdIndex?: number }> } } | undefined)?.message
  const keys = message?.accountKeys ?? []
  return (message?.instructions ?? []).filter((ix) => {
    if (ix.programId) return ix.programId === COMPUTE_BUDGET
    const key = typeof ix.programIdIndex === 'number' ? keys[ix.programIdIndex] : undefined
    return (typeof key === 'string' ? key : (key as { pubkey?: string } | undefined)?.pubkey) === COMPUTE_BUDGET
  }).length
}

async function main() {
  const tip = await rpc('getSlot', [{ commitment: 'finalized' }]) as number
  console.log(`devnet tip slot ${tip} · scanning back up to ${MAX_BLOCKS} blocks for non-legacy versions`)

  const rows: Row[] = []
  let blocksRead = 0
  let blocksAbsent = 0
  let blocksRefused = 0
  let transactionsSeen = 0
  const refusalExamples: string[] = []

  for (let slot = tip; slot > tip - MAX_BLOCKS && rows.length < MAX_SAMPLE; slot -= 1) {
    type Block = { transactions?: Array<Record<string, unknown>> }
    let block: Block | null = null
    try {
      block = await rpc('getBlock', [slot, {
        encoding: 'json', transactionDetails: 'full', rewards: false,
        maxSupportedTransactionVersion: 3, commitment: 'finalized',
      }]) as Block | null
    } catch (error) {
      if (error instanceof BlockAbsent) blocksAbsent += 1
      else {
        blocksRefused += 1
        if (refusalExamples.length < 5) refusalExamples.push((error as Error).message)
      }
      await sleep(REQUEST_SPACING_MS)
      continue
    }
    await sleep(REQUEST_SPACING_MS)
    if (!block?.transactions) { blocksAbsent += 1; continue }
    blocksRead += 1

    for (const entry of block.transactions) {
      transactionsSeen += 1
      const version = (entry as { version?: unknown }).version
      // Selection is by served version only. Nothing about the program, signer, fee or
      // success state influences inclusion.
      if (version === undefined || version === 'legacy' || version === 0) continue

      const signature = ((entry.transaction as { signatures?: string[] } | undefined)?.signatures ?? [])[0] ?? '(unavailable)'
      const receipt = { ...entry, slot } as unknown as Receipt

      let disposition: Row['parserDisposition'] = 'ACCEPTED'
      let rejectionMessage: string | null = null
      let budget: Row['budgetIfAccepted'] = null
      try {
        normalizeReceipt(receipt)
        budget = collectComputeBudget(receipt as never)
      } catch (error) {
        rejectionMessage = (error as Error).message
        disposition = /transaction version/i.test(rejectionMessage) ? 'REJECTED_VERSION'
          : /transaction configuration/i.test(rejectionMessage) ? 'REJECTED_CONFIG'
          : 'REJECTED_OTHER'
      }

      const ixCount = computeBudgetIxCount(entry)
      rows.push({
        signature, slot,
        servedVersion: JSON.stringify(version),
        configKeys: configKeysOf(entry),
        computeBudgetIxCount: ixCount,
        parserDisposition: disposition,
        rejectionMessage,
        budgetIfAccepted: budget,
        h1Triggered: disposition === 'ACCEPTED' && ixCount > 0
          && (budget?.computeUnitLimit != null || budget?.computeUnitPriceMicroLamports != null),
      })
      if (rows.length >= MAX_SAMPLE) break
    }
  }

  const triggered = rows.filter((row) => row.h1Triggered)
  const shapes = [...new Set(rows.map((row) => `${row.servedVersion} · config=[${row.configKeys.join(',')}] · ${row.parserDisposition}`))].sort()
  const attempted = blocksRead + blocksAbsent + blocksRefused
  const coverage = attempted ? blocksRead / attempted : 0
  // A null result is only a finding when the window was actually read. Rate-limited runs are
  // inconclusive, and must not be recorded as "no V1 traffic on devnet".
  const reportable = coverage >= MIN_COVERAGE
  const verdict = triggered.length > 0 ? 'H1_HELD'
    : reportable ? 'H1_NOT_OBSERVED_IN_DECLARED_WINDOW'
    : 'INCONCLUSIVE_INSUFFICIENT_COVERAGE'

  await mkdir(OUT, { recursive: true })
  await atomic(path.join(OUT, 'phase1-records.json'), {
    generatedAt: new Date().toISOString(),
    protocol: 'research/v1-budget-source/preregistration.md — Phase 1, read-only',
    endpoint: ENDPOINT,
    selection: 'Every transaction served with a version other than legacy/0, walking back from the finalized devnet tip. Slot position only; no program, signer, fee or success state influenced inclusion.',
    coverage: {
      tipSlot: tip, blocksAttempted: attempted, blocksRead, blocksAbsent, blocksRefused,
      readShare: Number(coverage.toFixed(3)), minimumForNullResult: MIN_COVERAGE,
      transactionsSeen, sampled: rows.length, cap: { MAX_BLOCKS, MAX_SAMPLE },
      refusalExamples,
      note: 'blocksRefused counts nodes declining to answer (rate limiting, transport). Those are not evidence that a block held no V1 traffic.',
    },
    h1: {
      statement: 'A V1 receipt that passes both guards and still yields a budget read from Compute Budget instructions.',
      triggeredCount: triggered.length,
      verdict,
      reportableNullResult: reportable,
    },
    distinctServedShapes: shapes,
    rows,
  })

  console.log(`blocks attempted ${attempted}: read ${blocksRead}, absent ${blocksAbsent}, refused ${blocksRefused} (read share ${(coverage * 100).toFixed(1)}%)`)
  console.log(`transactions seen ${transactionsSeen} · non-legacy sampled ${rows.length}`)
  console.log(`verdict: ${verdict}`)
  if (!reportable) {
    console.log(`Coverage below ${MIN_COVERAGE * 100}%. This run does NOT establish that devnet carried no V1 traffic — the node mostly declined to answer.`)
    for (const example of refusalExamples) console.log(`  refusal: ${example}`)
  } else if (!rows.length) {
    console.log('No non-legacy transactions in the declared window. Reporting that and stopping — the protocol forbids widening the window or switching cluster.')
  }
  console.log(`H1 triggered: ${triggered.length}`)
  for (const shape of shapes) console.log(`  shape: ${shape}`)
  for (const row of triggered) console.log(`  H1 ${row.signature} slot ${row.slot} budget=${JSON.stringify(row.budgetIfAccepted)}`)
  console.log(`wrote ${path.join(OUT, 'phase1-records.json')}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
