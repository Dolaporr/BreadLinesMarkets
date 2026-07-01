import { NextResponse } from 'next/server'

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const BASE_FEE_LAMPORTS_PER_SIGNATURE = 5000
const COIN_SCAN_WINDOW_OPTIONS = [50, 100, 250] as const
const HIGH_FEE_PRIORITY_LAMPORTS = 20_000

type CoinConfidence = 'observed' | 'estimated' | 'conceptual' | 'unclear' | 'needs inspection'

type RpcAccountKey =
  | string
  | {
      pubkey?: string
      signer?: boolean
      writable?: boolean
      source?: string
    }

type RpcInstruction = {
  program?: string
  programId?: string
  programIdIndex?: number
}

type TokenBalance = {
  accountIndex?: number
  mint?: string
  owner?: string
  uiTokenAmount?: {
    amount?: string
    decimals?: number
    uiAmount?: number | null
    uiAmountString?: string
  }
}

type RpcTransaction = {
  slot: number
  blockTime?: number | null
  meta?: {
    err?: unknown
    fee?: number
    computeUnitsConsumed?: number
    preTokenBalances?: TokenBalance[]
    postTokenBalances?: TokenBalance[]
    innerInstructions?: Array<{ instructions?: RpcInstruction[] }>
  } | null
  transaction?: {
    message?: {
      accountKeys?: RpcAccountKey[]
      instructions?: RpcInstruction[]
    }
    signatures?: string[]
  }
}

type AssetResult = {
  id?: string
  last_indexed_slot?: number
  content?: {
    metadata?: {
      name?: string
      symbol?: string
    }
    links?: {
      image?: string
    }
  }
  token_info?: {
    supply?: number | string
    decimals?: number
    token_program?: string
    mint_authority?: string | null
    freeze_authority?: string | null
  }
}

type TokenSupplyResult = {
  value?: {
    amount?: string
    decimals?: number
    uiAmount?: number | null
    uiAmountString?: string
  }
}

type LargestTokenAccountsResult = {
  value?: Array<{
    address: string
    amount?: string
    decimals?: number
    uiAmount?: number | null
    uiAmountString?: string
  }>
}

type SignatureSeed = {
  signature: string
  typeHint: string
}

const PROGRAM_LABELS: Record<string, string> = {
  '11111111111111111111111111111111': 'System',
  ComputeBudget111111111111111111111111111111: 'Compute Budget',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
  TokenzQdBNbLqP5VEhUMLAq5Lx4o2sxb9y5KHK2iHf: 'Token-2022',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'ATA',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter',
  whirLbMiicVdio4qvUfM5KAg6CtQonwY6WcAm7A9Xq: 'Orca Whirlpool',
  CAMMCzo5YL8w4VFF8KVHrK22GGUQp58Li3Vf7gF4TB34: 'Raydium CLMM',
  CPMMoo8L3F4NbTegBCKVNDFMvS3Z1R1tvqCMeRpi4mp8: 'Raydium CPMM',
  '6EF8rrecthR5DkFhJRPwFhZ7VQJZk3Q3u6x8X5p9pump': 'Pump.fun',
}

async function heliusRpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(HELIUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result as T
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-6)}`
}

function accountAddress(account: RpcAccountKey | undefined) {
  if (!account) return undefined
  return typeof account === 'string' ? account : account.pubkey
}

function programLabel(id: string, parsedProgram?: string) {
  return PROGRAM_LABELS[id] ?? parsedProgram ?? 'Unknown Program'
}

function getProgramId(instruction: RpcInstruction, accountKeys: RpcAccountKey[]) {
  if (instruction.programId) return instruction.programId
  if (typeof instruction.programIdIndex === 'number') return accountAddress(accountKeys[instruction.programIdIndex])
  return undefined
}

function collectProgramLabels(tx: RpcTransaction) {
  const accountKeys = tx.transaction?.message?.accountKeys ?? []
  const topLevel = tx.transaction?.message?.instructions ?? []
  const inner = tx.meta?.innerInstructions?.flatMap((group) => group.instructions ?? []) ?? []
  const labels = new Set<string>()

  for (const instruction of [...topLevel, ...inner]) {
    const id = getProgramId(instruction, accountKeys)
    if (!id) continue
    labels.add(programLabel(id, instruction.program))
  }

  return Array.from(labels).slice(0, 6)
}

function tokenAmount(balance: TokenBalance | undefined) {
  const value = balance?.uiTokenAmount
  if (!value) return 0
  if (typeof value.uiAmount === 'number') return value.uiAmount
  if (value.uiAmountString) {
    const parsed = Number(value.uiAmountString)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value.amount && typeof value.decimals === 'number') {
    const parsed = Number(value.amount)
    return Number.isFinite(parsed) ? parsed / 10 ** value.decimals : 0
  }
  return 0
}

function balanceKey(balance: TokenBalance) {
  return `${balance.accountIndex ?? 'na'}:${balance.owner ?? 'unknown'}`
}

function collectTokenMovement(tx: RpcTransaction, mint: string) {
  const relevant = new Map<string, { pre?: TokenBalance; post?: TokenBalance }>()

  for (const balance of tx.meta?.preTokenBalances ?? []) {
    if (balance.mint !== mint) continue
    const key = balanceKey(balance)
    relevant.set(key, { ...relevant.get(key), pre: balance })
  }

  for (const balance of tx.meta?.postTokenBalances ?? []) {
    if (balance.mint !== mint) continue
    const key = balanceKey(balance)
    relevant.set(key, { ...relevant.get(key), post: balance })
  }

  let positive = 0
  let negative = 0
  const owners = new Set<string>()

  for (const { pre, post } of relevant.values()) {
    const owner = post?.owner ?? pre?.owner
    if (owner) owners.add(owner)

    const delta = tokenAmount(post) - tokenAmount(pre)
    if (delta > 0) positive += delta
    if (delta < 0) negative += Math.abs(delta)
  }

  const movement = Math.max(positive, negative)
  const direction =
    positive > 0 && negative > 0
      ? 'mixed'
      : positive > 0
        ? 'in'
        : negative > 0
          ? 'out'
          : relevant.size
            ? 'none'
            : 'unknown'

  return {
    amount: relevant.size ? movement : null,
    direction: direction as 'in' | 'out' | 'mixed' | 'none' | 'unknown',
    owners: Array.from(owners),
    touchedBalanceRows: relevant.size,
  }
}

function estimatePriorityFee(tx: RpcTransaction) {
  const fee = tx.meta?.fee
  const signatures = tx.transaction?.signatures?.length ?? 0
  if (typeof fee !== 'number' || signatures <= 0) return null
  return Math.max(0, fee - signatures * BASE_FEE_LAMPORTS_PER_SIGNATURE)
}

function buildSignals(tx: RpcTransaction, tokenMovement: ReturnType<typeof collectTokenMovement>) {
  const signals: string[] = []
  const priorityFee = estimatePriorityFee(tx)
  const compute = tx.meta?.computeUnitsConsumed ?? 0

  if (tx.meta?.err) signals.push('failed execution')
  if (priorityFee && priorityFee > HIGH_FEE_PRIORITY_LAMPORTS) signals.push('priority fee paid')
  if (compute > 200_000) signals.push('higher compute path')
  if ((tokenMovement.owners?.length ?? 0) >= 3) signals.push('multiple token owners touched')
  if ((tokenMovement.amount ?? 0) > 0) signals.push('token balance movement observed')

  return signals
}

function txToActivity(seed: SignatureSeed, tx: RpcTransaction | null, mint: string) {
  if (!tx) {
    return {
      signature: seed.signature,
      shortSignature: shortAddress(seed.signature),
      typeHint: seed.typeHint,
      slot: null,
      blockTime: null,
      status: 'unknown' as const,
      feePaidLamports: null,
      feePaidSol: null,
      priorityFeeLamportsEstimated: null,
      computeUnitsConsumed: null,
      tokenDeltaUiAmount: null,
      tokenDeltaDirection: 'unknown' as const,
      owners: [],
      programs: [],
      signals: ['transaction details unavailable'],
      receiptUrl: `/?tx=${seed.signature}`,
      confidence: {
        transaction: 'unclear' as CoinConfidence,
        tokenMovement: 'unclear' as CoinConfidence,
        signals: 'unclear' as CoinConfidence,
      },
    }
  }

  const tokenMovement = collectTokenMovement(tx, mint)
  const signals = buildSignals(tx, tokenMovement)
  const priorityFee = estimatePriorityFee(tx)

  return {
    signature: seed.signature,
    shortSignature: shortAddress(seed.signature),
    typeHint: seed.typeHint,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    status: tx.meta?.err ? ('failed' as const) : ('success' as const),
    feePaidLamports: tx.meta?.fee ?? null,
    feePaidSol: typeof tx.meta?.fee === 'number' ? tx.meta.fee / 1_000_000_000 : null,
    priorityFeeLamportsEstimated: priorityFee,
    computeUnitsConsumed: tx.meta?.computeUnitsConsumed ?? null,
    tokenDeltaUiAmount: tokenMovement.amount,
    tokenDeltaDirection: tokenMovement.direction,
    owners: tokenMovement.owners,
    programs: collectProgramLabels(tx),
    signals,
    receiptUrl: `/?tx=${seed.signature}`,
    confidence: {
      transaction: 'observed' as CoinConfidence,
      tokenMovement: tokenMovement.touchedBalanceRows ? ('observed' as CoinConfidence) : ('unclear' as CoinConfidence),
      signals: 'estimated' as CoinConfidence,
    },
  }
}

async function getAsset(mint: string) {
  try {
    return await heliusRpc<AssetResult | null>('getAsset', {
      id: mint,
      options: { showFungible: true },
    })
  } catch {
    return null
  }
}

async function getTokenSupply(mint: string) {
  try {
    return await heliusRpc<TokenSupplyResult | null>('getTokenSupply', [mint])
  } catch {
    return null
  }
}

async function getLargestTokenAccounts(mint: string) {
  try {
    return await heliusRpc<LargestTokenAccountsResult | null>('getTokenLargestAccounts', [mint])
  } catch {
    return null
  }
}

async function getSignatureSeeds(mint: string, limit: number) {
  try {
    const pageSize = Math.min(limit, 100)
    const allSeeds: SignatureSeed[] = []
    let lastIndexedSlot: number | null = null

    for (let page = 1; allSeeds.length < limit; page += 1) {
      const result = await heliusRpc<{
        items?: Array<[string, string] | { signature?: string; type?: string }>
        last_indexed_slot?: number
        total?: number
      } | null>('getSignaturesForAsset', {
        id: mint,
        page,
        limit: pageSize,
      })

      if (typeof result?.last_indexed_slot === 'number') {
        lastIndexedSlot = result.last_indexed_slot
      }

      const items = result?.items ?? []
      const seeds = items
        .map((item): SignatureSeed | null => {
          if (Array.isArray(item)) return { signature: item[0], typeHint: item[1] ?? 'asset activity' }
          if (item.signature) return { signature: item.signature, typeHint: item.type ?? 'asset activity' }
          return null
        })
        .filter((seed): seed is SignatureSeed => Boolean(seed?.signature))

      allSeeds.push(...seeds)
      if (items.length < pageSize) break
    }

    const uniqueSeeds = Array.from(new Map(allSeeds.map((seed) => [seed.signature, seed])).values()).slice(0, limit)
    if (uniqueSeeds.length) {
      return {
        seeds: uniqueSeeds,
        source: 'das' as const,
        lastIndexedSlot,
      }
    }
  } catch {
    // Fall back below.
  }

  try {
    const result = await heliusRpc<Array<{ signature?: string }> | null>('getSignaturesForAddress', [
      mint,
      { limit },
    ])
    const seeds =
      result
        ?.map((item) => item.signature)
        .filter((signature): signature is string => Boolean(signature))
        .map((signature) => ({ signature, typeHint: 'mint account activity' })) ?? []

    return { seeds, source: seeds.length ? ('address' as const) : ('none' as const), lastIndexedSlot: null }
  } catch {
    return { seeds: [], source: 'none' as const, lastIndexedSlot: null }
  }
}

async function getTransaction(signature: string) {
  try {
    return await heliusRpc<RpcTransaction | null>('getTransaction', [
      signature,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      },
    ])
  } catch {
    return null
  }
}

async function getTransactions(seeds: SignatureSeed[]) {
  const transactions: Array<RpcTransaction | null> = []
  const chunkSize = 25

  for (let index = 0; index < seeds.length; index += chunkSize) {
    const chunk = seeds.slice(index, index + chunkSize)
    const chunkTransactions = await Promise.all(chunk.map((seed) => getTransaction(seed.signature)))
    transactions.push(...chunkTransactions)
  }

  return transactions
}

function buildWalletSignals(timeline: ReturnType<typeof txToActivity>[]) {
  const owners = new Map<
    string,
    {
      owner: string
      transactionCount: number
      totalAbsUiAmount: number
      firstSignature?: string
      lastSignature?: string
    }
  >()

  for (const tx of timeline) {
    for (const owner of tx.owners) {
      const existing = owners.get(owner) ?? { owner, transactionCount: 0, totalAbsUiAmount: 0 }
      existing.transactionCount += 1
      existing.totalAbsUiAmount += tx.tokenDeltaUiAmount ?? 0
      existing.firstSignature ??= tx.signature
      existing.lastSignature = tx.signature
      owners.set(owner, existing)
    }
  }

  const repeatedWalletSignals = Array.from(owners.values())
    .filter((owner) => owner.transactionCount > 1)
    .sort((a, b) => b.transactionCount - a.transactionCount || b.totalAbsUiAmount - a.totalAbsUiAmount)
    .slice(0, 8)
    .map((owner) => ({ ...owner, confidence: 'estimated' as CoinConfidence }))

  return {
    uniqueWalletCount: owners.size,
    repeatedWalletCount: Array.from(owners.values()).filter((owner) => owner.transactionCount > 1).length,
    repeatedWalletSignals,
  }
}

function roundPercent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 10_000) / 100
}

function formatPercent(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

function hasHighFeeSignal(tx: ReturnType<typeof txToActivity>) {
  return (tx.priorityFeeLamportsEstimated ?? 0) > HIGH_FEE_PRIORITY_LAMPORTS || tx.signals.includes('priority fee paid')
}

function getLargestObservedMovement(timeline: ReturnType<typeof txToActivity>[]) {
  const largest = [...timeline]
    .filter((tx) => tx.tokenDeltaUiAmount != null && tx.tokenDeltaUiAmount > 0)
    .sort((a, b) => (b.tokenDeltaUiAmount ?? 0) - (a.tokenDeltaUiAmount ?? 0))[0]

  return {
    uiAmount: largest?.tokenDeltaUiAmount ?? null,
    direction: largest?.tokenDeltaDirection ?? ('unknown' as const),
    signature: largest?.signature ?? null,
    confidence: largest ? ('observed' as CoinConfidence) : ('unclear' as CoinConfidence),
  }
}

function detectFailedThenLandedRetries(timeline: ReturnType<typeof txToActivity>[]) {
  const ordered = [...timeline]
    .filter((tx) => tx.slot != null)
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  const unmatchedFailed: ReturnType<typeof txToActivity>[] = []
  const usedFailed = new Set<string>()
  const retrySignals: Array<{
    failedSignature: string
    landedSignature: string
    owner?: string
    slotDistance: number | null
    confidence: CoinConfidence
  }> = []

  for (const tx of ordered) {
    if (tx.status === 'failed') {
      unmatchedFailed.push(tx)
      continue
    }

    if (tx.status !== 'success' || !tx.owners.length) continue

    const matchedFailed = unmatchedFailed.find((failedTx) => {
      if (usedFailed.has(failedTx.signature)) return false
      return failedTx.owners.some((owner) => tx.owners.includes(owner))
    })

    if (!matchedFailed) continue

    const owner = matchedFailed.owners.find((candidate) => tx.owners.includes(candidate))
    usedFailed.add(matchedFailed.signature)
    retrySignals.push({
      failedSignature: matchedFailed.signature,
      landedSignature: tx.signature,
      owner,
      slotDistance:
        matchedFailed.slot != null && tx.slot != null
          ? Math.max(0, tx.slot - matchedFailed.slot)
          : null,
      confidence: 'needs inspection',
    })
  }

  return retrySignals
}

function classifyFailureRate(rate: number) {
  if (rate >= 15) return 'high' as const
  if (rate >= 5) return 'medium' as const
  return 'low' as const
}

function buildSignalSummary({
  observedTxCount,
  failureRatePercent,
  highFeeSignalCount,
  repeatedWalletCount,
  failedThenLandedRetryCount,
  largestMovement,
}: {
  observedTxCount: number
  failureRatePercent: number
  highFeeSignalCount: number
  repeatedWalletCount: number
  failedThenLandedRetryCount: number
  largestMovement: number | null
}) {
  if (!observedTxCount) {
    return 'Not enough indexed activity was returned to form a useful coin activity signal.'
  }

  if (failedThenLandedRetryCount > 0) {
    return 'This window shows execution pressure: failed txs, fee signals, and repeated wallets trying to get through.'
  }

  if (failureRatePercent >= 15 && highFeeSignalCount > 0) {
    return 'This window shows elevated failures and fee pressure, so the execution story is noisier than the chart alone suggests.'
  }

  if (highFeeSignalCount > 0) {
    return 'Most activity may still land, but fee signals suggest some traders were paying for urgency in this window.'
  }

  if (repeatedWalletCount > 0) {
    return 'Repeated wallets show up in the activity window, so participation is worth reading beyond the candle.'
  }

  if (largestMovement != null) {
    return 'The clearest observed story in this window is the largest token movement rather than visible execution stress.'
  }

  return 'This window looks relatively quiet from an execution-signal perspective, based on available indexed activity.'
}

function buildInsights({
  observedTxCount,
  successCount,
  failedCount,
  failureRatePercent,
  highFeeSignalCount,
  highFeeRatePercent,
  uniqueWalletCount,
  repeatedWalletCount,
  largestMovement,
  failedThenLandedRetryCount,
}: {
  observedTxCount: number
  successCount: number
  failedCount: number
  failureRatePercent: number
  highFeeSignalCount: number
  highFeeRatePercent: number
  uniqueWalletCount: number
  repeatedWalletCount: number
  largestMovement: ReturnType<typeof getLargestObservedMovement>
  failedThenLandedRetryCount: number
}) {
  const failureLevel = classifyFailureRate(failureRatePercent)
  const feeLevel = highFeeRatePercent >= 20 ? 'high' : highFeeRatePercent >= 5 ? 'medium' : highFeeSignalCount > 0 ? 'low' : 'none'
  const walletLevel = repeatedWalletCount >= 5 ? 'high' : repeatedWalletCount > 0 ? 'medium' : 'low'
  const breadlineLevel = failedThenLandedRetryCount > 0 || failureRatePercent >= 15 ? 'high' : failedCount > 0 ? 'medium' : 'low'

  return {
    executionHealth: {
      title: 'Execution health',
      label: `${failureLevel} failure rate`,
      level: failureLevel,
      confidence: 'observed' as CoinConfidence,
      text: `${successCount} successful and ${failedCount} failed transaction${failedCount === 1 ? '' : 's'} were observed in the ${observedTxCount}-tx window.`,
      detail: `Failure rate: ${formatPercent(failureRatePercent)}`,
    },
    feePressure: {
      title: 'Fee pressure',
      label: highFeeSignalCount > 0 ? 'fee signals present' : 'no fee signal',
      level: feeLevel,
      confidence: 'estimated' as CoinConfidence,
      text:
        highFeeSignalCount > 0
          ? `${highFeeSignalCount} transaction${highFeeSignalCount === 1 ? '' : 's'} carried an estimated priority-fee signal.`
          : 'No transaction in this window crossed the v2 high-fee signal threshold.',
      detail: `High-fee rate: ${formatPercent(highFeeRatePercent)}`,
    },
    walletParticipation: {
      title: 'Wallet participation',
      label: `${uniqueWalletCount} unique wallet${uniqueWalletCount === 1 ? '' : 's'}`,
      level: walletLevel,
      confidence: 'estimated' as CoinConfidence,
      text: `${repeatedWalletCount} repeated-wallet signal${repeatedWalletCount === 1 ? '' : 's'} appeared from token-balance owner rows.`,
      detail: 'Owner rows are observed, but repeated-wallet interpretation is a triage signal.',
    },
    largestMovement: {
      title: 'Largest movement',
      label: largestMovement.uiAmount == null ? 'needs inspection' : formatTokenAmount(largestMovement.uiAmount),
      level: largestMovement.uiAmount == null ? 'needs inspection' : 'low',
      confidence: largestMovement.confidence,
      text:
        largestMovement.uiAmount == null
          ? 'No token-balance movement was available from the parsed transaction rows.'
          : `Largest observed token movement was ${formatTokenAmount(largestMovement.uiAmount)} (${largestMovement.direction}).`,
      detail: largestMovement.signature ? `Tx: ${shortAddress(largestMovement.signature)}` : undefined,
    },
    breadlineSignal: {
      title: 'Breadline signal',
      label:
        failedThenLandedRetryCount > 0
          ? `${failedThenLandedRetryCount} retry-like pattern${failedThenLandedRetryCount === 1 ? '' : 's'}`
          : failedCount > 0
            ? `${failedCount} failed tx${failedCount === 1 ? '' : 's'}`
            : 'low stress',
      level: breadlineLevel,
      confidence: failedThenLandedRetryCount > 0 ? ('needs inspection' as CoinConfidence) : ('estimated' as CoinConfidence),
      text:
        failedThenLandedRetryCount > 0
          ? 'At least one failed transaction was followed by a landed transaction from an overlapping owner; inspect before treating it as a proven retry.'
          : failedCount > 0
            ? 'Failures appeared in the window, but no failed-then-landed owner overlap was detected.'
            : 'No failed transaction pattern was detected in this observed window.',
      detail: 'Retry detection is heuristic and intentionally labeled needs inspection when present.',
    },
  }
}

function buildShareText({
  symbol,
  mint,
  observedTxCount,
  failureRatePercent,
  highFeeSignalCount,
  uniqueWalletCount,
  repeatedWalletCount,
  largestMovement,
  signalSummary,
}: {
  symbol: string
  mint: string
  observedTxCount: number
  failureRatePercent: number
  highFeeSignalCount: number
  uniqueWalletCount: number
  repeatedWalletCount: number
  largestMovement: number | null
  signalSummary: string
}) {
  return [
    `Breadlines coin activity receipt for ${symbol || shortAddress(mint)}`,
    `Observed window: ${observedTxCount} recent txs`,
    `Failure rate: ${formatPercent(failureRatePercent)}`,
    `High-fee signals: ${highFeeSignalCount}`,
    `Unique wallets: ${uniqueWalletCount}`,
    `Repeat-wallet signals: ${repeatedWalletCount}`,
    `Largest movement: ${largestMovement == null ? 'unclear' : formatTokenAmount(largestMovement)}`,
    '',
    'Signal:',
    signalSummary,
    '',
    'Observed onchain activity + estimated execution signals. Not a price call or safety rating.',
  ].join('\n')
}

function formatTokenAmount(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: value >= 1 ? 2 : 6 })
}

function buildWhatThisMeans({
  symbol,
  txCount,
  failed,
  highFee,
  repeatedWallets,
  source,
}: {
  symbol: string
  txCount: number
  failed: number
  highFee: number
  repeatedWallets: number
  source: 'das' | 'address' | 'none'
}) {
  const name = symbol || 'this mint'
  return [
    {
      confidence: 'observed' as CoinConfidence,
      text: `Breadlines found ${txCount} recent transaction${txCount === 1 ? '' : 's'} tied to ${name} through ${source === 'das' ? 'Helius asset indexing' : source === 'address' ? 'mint-account signatures' : 'available RPC/index data'}.`,
    },
    {
      confidence: 'estimated' as CoinConfidence,
      text: `${failed} failed transaction${failed === 1 ? '' : 's'}, ${highFee} high-fee signal${highFee === 1 ? '' : 's'}, and ${repeatedWallets} repeated-wallet signal${repeatedWallets === 1 ? '' : 's'} were classified with v2 receipt heuristics.`,
    },
    {
      confidence: 'unclear' as CoinConfidence,
      text: 'This is not full holder analytics, not a price chart, and not a safety rating. Some DEX/pool activity can be missed if the token index does not attach the mint to a signature.',
    },
  ]
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mint = String(body.mint ?? '').trim()
    const requestedLimit = Number(body.limit ?? 100)
    const limit = COIN_SCAN_WINDOW_OPTIONS.includes(requestedLimit as (typeof COIN_SCAN_WINDOW_OPTIONS)[number])
      ? requestedLimit
      : 100

    if (!process.env.HELIUS_API_KEY) {
      return NextResponse.json({ error: 'HELIUS_API_KEY is not configured.' }, { status: 500 })
    }

    if (!SOLANA_ADDRESS_PATTERN.test(mint)) {
      return NextResponse.json({ error: 'Paste a valid Solana coin CA.' }, { status: 400 })
    }

    const [asset, supplyResult, largestAccountsResult, signatures] = await Promise.all([
      getAsset(mint),
      getTokenSupply(mint),
      getLargestTokenAccounts(mint),
      getSignatureSeeds(mint, limit),
    ])

    const uniqueSeeds = Array.from(
      new Map(signatures.seeds.map((seed) => [seed.signature, seed])).values(),
    ).slice(0, limit)
    const transactions = await getTransactions(uniqueSeeds)
    const timeline = uniqueSeeds.map((seed, index) => txToActivity(seed, transactions[index], mint))

    const observedTxCount = timeline.length
    const successCount = timeline.filter((tx) => tx.status === 'success').length
    const failedTransactions = timeline.filter((tx) => tx.status === 'failed').length
    const failedCount = failedTransactions
    const failureRatePercent = roundPercent(failedCount, observedTxCount)
    const highFeeTransactions = timeline.filter(hasHighFeeSignal).length
    const highFeeSignalCount = highFeeTransactions
    const highFeeRatePercent = roundPercent(highFeeSignalCount, observedTxCount)
    const highComputeTransactions = timeline.filter((tx) => (tx.computeUnitsConsumed ?? 0) > 200_000).length
    const walletStats = buildWalletSignals(timeline)
    const walletSignals = walletStats.repeatedWalletSignals
    const uniqueWalletsObserved = walletStats.uniqueWalletCount
    const largestObservedMovement = getLargestObservedMovement(timeline)
    const largestMovement = largestObservedMovement.uiAmount
    const failedThenLandedRetrySignals = detectFailedThenLandedRetries(timeline)
    const failedThenLandedRetryCount = failedThenLandedRetrySignals.length
    const signalSummary = buildSignalSummary({
      observedTxCount,
      failureRatePercent,
      highFeeSignalCount,
      repeatedWalletCount: walletStats.repeatedWalletCount,
      failedThenLandedRetryCount,
      largestMovement,
    })
    const insights = buildInsights({
      observedTxCount,
      successCount,
      failedCount,
      failureRatePercent,
      highFeeSignalCount,
      highFeeRatePercent,
      uniqueWalletCount: uniqueWalletsObserved,
      repeatedWalletCount: walletStats.repeatedWalletCount,
      largestMovement: largestObservedMovement,
      failedThenLandedRetryCount,
    })

    const supply = supplyResult?.value
    const decimals = asset?.token_info?.decimals ?? supply?.decimals ?? null
    const supplyString =
      supply?.uiAmountString ??
      (asset?.token_info?.supply != null ? String(asset.token_info.supply) : null)
    const supplyNumber = supplyString ? Number(supplyString) : null
    const topTokenAccounts =
      largestAccountsResult?.value?.slice(0, 5).map((account) => {
        const amount = account.uiAmountString ?? (account.uiAmount != null ? String(account.uiAmount) : '0')
        const supplyPct =
          supplyNumber && Number.isFinite(Number(amount))
            ? (Number(amount) / supplyNumber) * 100
            : null
        return {
          address: account.address,
          uiAmountString: amount,
          supplyPct: supplyPct != null ? Math.round(supplyPct * 100) / 100 : null,
          confidence: 'observed' as CoinConfidence,
        }
      }) ?? []

    const symbol = asset?.content?.metadata?.symbol ?? 'TOKEN'
    const shareText = buildShareText({
      symbol,
      mint,
      observedTxCount,
      failureRatePercent,
      highFeeSignalCount,
      uniqueWalletCount: uniqueWalletsObserved,
      repeatedWalletCount: walletStats.repeatedWalletCount,
      largestMovement,
      signalSummary,
    })

    return NextResponse.json({
      mint,
      shortMint: shortAddress(mint),
      token: {
        name: asset?.content?.metadata?.name ?? 'Unknown token',
        symbol,
        image: asset?.content?.links?.image,
        decimals,
        supply: supplyString,
        tokenProgram: asset?.token_info?.token_program ?? null,
        mintAuthority: asset?.token_info?.mint_authority ?? null,
        freezeAuthority: asset?.token_info?.freeze_authority ?? null,
        confidence: asset ? ('observed' as CoinConfidence) : ('unclear' as CoinConfidence),
      },
      window: {
        requestedLimit: limit,
        observedTransactions: observedTxCount,
        indexedSignatureSource: signatures.source,
        lastIndexedSlot: signatures.lastIndexedSlot,
        confidence: signatures.source === 'das' ? ('observed' as CoinConfidence) : ('unclear' as CoinConfidence),
      },
      stats: {
        observedTxCount,
        successCount,
        failedCount,
        failureRatePercent,
        highFeeSignalCount,
        highFeeRatePercent,
        uniqueWalletCount: uniqueWalletsObserved,
        repeatedWalletCount: walletStats.repeatedWalletCount,
        largestObservedMovement,
        failedThenLandedRetryCount,
        failedTransactions,
        highFeeTransactions,
        highComputeTransactions,
        uniqueWalletsObserved,
        repeatedWallets: walletStats.repeatedWalletCount,
        largestMovementUiAmount: largestMovement,
        topTokenAccountSupplyPct: topTokenAccounts[0]?.supplyPct ?? null,
      },
      insights,
      signalSummary,
      timeline,
      largestMovements: [...timeline]
        .filter((tx) => tx.tokenDeltaUiAmount != null && tx.tokenDeltaUiAmount > 0)
        .sort((a, b) => (b.tokenDeltaUiAmount ?? 0) - (a.tokenDeltaUiAmount ?? 0))
        .slice(0, 5),
      executionSignals: timeline
        .filter((tx) => tx.status === 'failed' || tx.signals.length >= 2 || hasHighFeeSignal(tx))
        .slice(0, 12),
      repeatedWalletSignals: walletSignals,
      failedThenLandedRetrySignals,
      walletSignals,
      topTokenAccounts,
      whatThisMeans: buildWhatThisMeans({
        symbol,
        txCount: observedTxCount,
        failed: failedTransactions,
        highFee: highFeeTransactions,
        repeatedWallets: walletStats.repeatedWalletCount,
        source: signatures.source,
      }),
      shareText,
      caveats: [
        'Observed activity comes from available Helius/RPC index responses for this mint.',
        'Execution signals are v2 estimates and should be treated as triage hints.',
        'This is not financial advice, not a price call, and not a safety rating.',
      ],
      confidence: {
        tokenIdentity: asset ? ('observed' as CoinConfidence) : ('unclear' as CoinConfidence),
        activity: signatures.source === 'das' ? ('observed' as CoinConfidence) : ('unclear' as CoinConfidence),
        walletSignals: 'estimated' as CoinConfidence,
        executionSignals: 'estimated' as CoinConfidence,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to build coin activity receipt.' },
      { status: 500 },
    )
  }
}
