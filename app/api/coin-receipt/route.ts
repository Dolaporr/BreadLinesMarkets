import { NextResponse } from 'next/server'

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const BASE_FEE_LAMPORTS_PER_SIGNATURE = 5000

type CoinConfidence = 'observed' | 'estimated' | 'conceptual' | 'unclear'

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
  if (priorityFee && priorityFee > 20_000) signals.push('priority fee paid')
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

  return {
    signature: seed.signature,
    shortSignature: shortAddress(seed.signature),
    typeHint: seed.typeHint,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    status: tx.meta?.err ? ('failed' as const) : ('success' as const),
    feePaidLamports: tx.meta?.fee ?? null,
    feePaidSol: typeof tx.meta?.fee === 'number' ? tx.meta.fee / 1_000_000_000 : null,
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
    const result = await heliusRpc<{
      items?: Array<[string, string] | { signature?: string; type?: string }>
      last_indexed_slot?: number
      total?: number
    } | null>('getSignaturesForAsset', {
      id: mint,
      page: 1,
      limit,
    })

    const items = result?.items ?? []
    const seeds = items
      .map((item): SignatureSeed | null => {
        if (Array.isArray(item)) return { signature: item[0], typeHint: item[1] ?? 'asset activity' }
        if (item.signature) return { signature: item.signature, typeHint: item.type ?? 'asset activity' }
        return null
      })
      .filter((seed): seed is SignatureSeed => Boolean(seed?.signature))

    if (seeds.length) {
      return {
        seeds,
        source: 'das' as const,
        lastIndexedSlot: result?.last_indexed_slot ?? null,
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

function buildWalletSignals(timeline: ReturnType<typeof txToActivity>[]) {
  const owners = new Map<string, { owner: string; transactionCount: number; totalAbsUiAmount: number }>()

  for (const tx of timeline) {
    for (const owner of tx.owners) {
      const existing = owners.get(owner) ?? { owner, transactionCount: 0, totalAbsUiAmount: 0 }
      existing.transactionCount += 1
      existing.totalAbsUiAmount += tx.tokenDeltaUiAmount ?? 0
      owners.set(owner, existing)
    }
  }

  return Array.from(owners.values())
    .filter((owner) => owner.transactionCount > 1)
    .sort((a, b) => b.transactionCount - a.transactionCount || b.totalAbsUiAmount - a.totalAbsUiAmount)
    .slice(0, 6)
    .map((owner) => ({ ...owner, confidence: 'estimated' as CoinConfidence }))
}

function buildShareText({
  symbol,
  mint,
  txCount,
  failed,
  highFee,
  largest,
}: {
  symbol: string
  mint: string
  txCount: number
  failed: number
  highFee: number
  largest: number | null
}) {
  return [
    `Breadlines coin activity receipt for ${symbol || shortAddress(mint)}`,
    '',
    `Observed tx sample: ${txCount}`,
    `Failed txs: ${failed}`,
    `High-fee signals: ${highFee}`,
    `Largest observed movement: ${largest == null ? 'unclear' : formatTokenAmount(largest)}`,
    '',
    'Observed onchain activity + estimated execution signals. Not a price call or safety rating.',
    'https://breadlinesmarkets.com',
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
      text: `${failed} failed transaction${failed === 1 ? '' : 's'}, ${highFee} high-fee signal${highFee === 1 ? '' : 's'}, and ${repeatedWallets} repeated-wallet signal${repeatedWallets === 1 ? '' : 's'} were classified with v0 heuristics.`,
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
    const limit = Math.max(5, Math.min(25, Number(body.limit ?? 15)))

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
    const transactions = await Promise.all(uniqueSeeds.map((seed) => getTransaction(seed.signature)))
    const timeline = uniqueSeeds.map((seed, index) => txToActivity(seed, transactions[index], mint))

    const failedTransactions = timeline.filter((tx) => tx.status === 'failed').length
    const highFeeTransactions = timeline.filter((tx) => (tx.feePaidLamports ?? 0) > 25_000).length
    const highComputeTransactions = timeline.filter((tx) => (tx.computeUnitsConsumed ?? 0) > 200_000).length
    const walletSignals = buildWalletSignals(timeline)
    const uniqueWalletsObserved = new Set(timeline.flatMap((tx) => tx.owners)).size
    const largestMovement = timeline
      .map((tx) => tx.tokenDeltaUiAmount)
      .filter((amount): amount is number => typeof amount === 'number')
      .sort((a, b) => b - a)[0] ?? null

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
      txCount: timeline.length,
      failed: failedTransactions,
      highFee: highFeeTransactions,
      largest: largestMovement,
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
        observedTransactions: timeline.length,
        indexedSignatureSource: signatures.source,
        lastIndexedSlot: signatures.lastIndexedSlot,
        confidence: signatures.source === 'das' ? ('observed' as CoinConfidence) : ('unclear' as CoinConfidence),
      },
      stats: {
        failedTransactions,
        highFeeTransactions,
        highComputeTransactions,
        uniqueWalletsObserved,
        repeatedWallets: walletSignals.length,
        largestMovementUiAmount: largestMovement,
        topTokenAccountSupplyPct: topTokenAccounts[0]?.supplyPct ?? null,
      },
      timeline,
      largestMovements: [...timeline]
        .filter((tx) => tx.tokenDeltaUiAmount != null && tx.tokenDeltaUiAmount > 0)
        .sort((a, b) => (b.tokenDeltaUiAmount ?? 0) - (a.tokenDeltaUiAmount ?? 0))
        .slice(0, 5),
      executionSignals: timeline
        .filter((tx) => tx.status === 'failed' || tx.signals.length >= 2 || (tx.feePaidLamports ?? 0) > 25_000)
        .slice(0, 6),
      walletSignals,
      topTokenAccounts,
      whatThisMeans: buildWhatThisMeans({
        symbol,
        txCount: timeline.length,
        failed: failedTransactions,
        highFee: highFeeTransactions,
        repeatedWallets: walletSignals.length,
        source: signatures.source,
      }),
      shareText,
      caveats: [
        'Observed activity comes from available Helius/RPC index responses for this mint.',
        'Execution signals are v0 estimates and should be treated as triage hints.',
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
