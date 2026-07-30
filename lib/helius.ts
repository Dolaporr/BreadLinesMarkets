export type HeliusTransferRow = {
  signature: string
  slot?: number
  blockTime?: number
  type?: string
  fromUserAccount?: string | null
  toUserAccount?: string | null
  mint?: string
  amount?: string
  decimals?: number
  uiAmount?: string
  feeAmount?: string
  feeUiAmount?: string
  confirmationStatus?: string
  instructionIdx?: number
  innerInstructionIdx?: number
}

export type HeliusTransferSummary = {
  address: string
  transfers: HeliusTransferRow[]
  paginationToken?: string
  stats: {
    transferRows: number
    uniqueTransactions: number
    inboundRows: number
    outboundRows: number
    mintRows: number
    burnRows: number
    token2022FeeRows: number
    batchedSignatureRows: number
  }
}

export type ReceiptConfidence = 'observed' | 'estimated' | 'conceptual'
export type ReceiptEvidenceType = 'observed' | 'derived' | 'inferred' | 'conceptual'
export type ReceiptSensitivityLevel = 'low' | 'medium' | 'high' | 'unknown'
export type ReceiptExecutionState = 'landed' | 'landed-but-failed' | 'did-not-land'
export type InclusionSymptomConfidence = ReceiptEvidenceType | 'needs inspection'
export type ComputeUnitPriceStatus = 'zero' | 'omitted' | 'set' | 'unknown'
export type CoinReceiptConfidence = ReceiptConfidence | 'unclear' | 'needs inspection'

export type CoinActivityInsightLevel = 'low' | 'medium' | 'high' | 'none' | 'needs inspection'

export type CoinActivityInsight = {
  title: string
  label: string
  level: CoinActivityInsightLevel
  confidence: CoinReceiptConfidence
  text: string
  detail?: string
}

export type CoinRepeatedWalletSignal = {
  owner: string
  transactionCount: number
  totalAbsUiAmount: number
  firstSignature?: string
  lastSignature?: string
  confidence: CoinReceiptConfidence
}

export type CoinRetrySignal = {
  failedSignature: string
  landedSignature: string
  owner?: string
  slotDistance: number | null
  confidence: CoinReceiptConfidence
}

export type BreadlinesReceipt = {
  signature: string
  shortSignature: string
  slot: number
  blockTime: number | null
  status: 'success' | 'failed'
  executionState: ReceiptExecutionState
  confirmationStatus: string
  error: unknown
  executionError: {
    program: string
    programId: string | null
    code: number | null
    name: string | null
    message: string
    log: string
    evidence: 'observed'
  } | null
  feePaidLamports: number | null
  feePaidSol: number | null
  priorityFeeLamportsEstimated?: number
  priorityFeeDerivation: {
    evidence: 'derived'
    method: 'compute-budget'
    computeUnitLimit: number
    computeUnitPriceMicroLamports: number
    formula: string
    feeResidualLamports: number | null
  } | null
  computeUnitsConsumed: number | null
  recentBlockhash: string | null
  signatureCount: number | null
  instructionCount: number
  innerInstructionGroupCount: number
  programs: Array<{
    id: string
    label: string
    instructionCount: number
  }>
  writableAccounts: Array<{
    address: string
    signer?: boolean
    source?: string
    confidence: ReceiptEvidenceType
  }>
  writableAccountCount: number
  slotPressure: {
    label: 'low' | 'moderate' | 'high'
    score: number
    confidence: ReceiptEvidenceType
    basis: string[]
    sample: {
      txPerSlot?: number
      nonVoteTxPerSlot?: number
      avgSlotMs?: number
    }
  }
  confidence: {
    transaction: ReceiptEvidenceType
    slotPressure: ReceiptEvidenceType
    percolatorLens: ReceiptEvidenceType | null
  }
  percolatorLens: {
    queueSensitive: {
      level: ReceiptSensitivityLevel
      confidence: ReceiptEvidenceType
      reasons: string[]
    }
    priceSensitive: {
      level: ReceiptSensitivityLevel
      confidence: ReceiptEvidenceType
      reasons: string[]
    }
    riskOracleSensitive: {
      level: ReceiptSensitivityLevel
      confidence: ReceiptEvidenceType
      reasons: string[]
    }
    whyMarketStructureMayMatter: {
      confidence: ReceiptEvidenceType
      text: string
    }
  } | null
  inclusionSymptoms: {
    status: ReceiptExecutionState
    totalFeeLamports: number | null
    priorityFeeLamportsEstimated: number | null
    priorityFeeDerivation: {
      evidence: 'derived'
      method: 'compute-budget'
      computeUnitLimit: number
      computeUnitPriceMicroLamports: number
      formula: string
      feeResidualLamports: number | null
    } | null
    computeUnitPriceMicroLamports: number | null
    computeUnitLimit: number | null
    computeUnitPriceStatus: ComputeUnitPriceStatus
    computeUnitsConsumed: number | null
    programsTouched: Array<{
      id: string
      label: string
      instructionCount: number
    }>
    signerWallet: {
      address: string
      confidence: ReceiptEvidenceType
    } | null
    mainWritableAccounts: Array<{
      address: string
      signer?: boolean
      source?: string
      confidence: ReceiptEvidenceType
    }>
    repeatedSignerActivity: {
      kind: 'signer'
      address: string
      label: string
      available: boolean
      recentSignatureCount: number | null
      otherRecentSignatureCount: number | null
      sampleSignatures: Array<{
        signature: string
        slot: number | null
        blockTime: number | null
        status: 'landed' | 'failed'
      }>
      confidence: InclusionSymptomConfidence
    } | null
    repeatedProgramAccountActivity: Array<{
      kind: 'program' | 'account'
      address: string
      label: string
      available: boolean
      recentSignatureCount: number | null
      otherRecentSignatureCount: number | null
      sampleSignatures: Array<{
        signature: string
        slot: number | null
        blockTime: number | null
        status: 'landed' | 'failed'
      }>
      confidence: InclusionSymptomConfidence
    }>
    symptomBadges: Array<{
      label: string
      confidence: InclusionSymptomConfidence
      detail: string
    }>
    disclaimer: string
    shareText: string
  }
}

export async function getLiveData(): Promise<{ spamVolume: number; priorityFee: number }> {
  const res = await fetch('/api/helius')
  if (!res.ok) throw new Error('Helius API route failed')
  return res.json()
}

export async function getBreadlinesReceipt(signature: string): Promise<BreadlinesReceipt> {
  const res = await fetch('/api/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? 'Breadlines receipt failed')
  }

  return res.json()
}

export async function getTransfersByAddress(
  address: string,
  limit = 25,
  paginationToken?: string,
): Promise<HeliusTransferSummary> {
  const res = await fetch('/api/helius/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, limit, paginationToken }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? 'Helius transfer history scan failed')
  }

  return res.json()
}

export type CoinActivityReceipt = {
  mint: string
  shortMint: string
  token: {
    name: string
    symbol: string
    image?: string
    decimals: number | null
    supply: string | null
    tokenProgram?: string | null
    mintAuthority?: string | null
    freezeAuthority?: string | null
    confidence: CoinReceiptConfidence
  }
  window: {
    requestedLimit: number
    observedTransactions: number
    indexedSignatureSource: 'das' | 'address' | 'none'
    lastIndexedSlot?: number | null
    confidence: CoinReceiptConfidence
  }
  stats: {
    observedTxCount: number
    successCount: number
    failedCount: number
    failureRatePercent: number
    highFeeSignalCount: number
    highFeeRatePercent: number
    uniqueWalletCount: number
    repeatedWalletCount: number
    largestObservedMovement: {
      uiAmount: number | null
      direction: CoinActivityTransaction['tokenDeltaDirection']
      signature: string | null
      confidence: CoinReceiptConfidence
    }
    failedThenLandedRetryCount: number
    failedTransactions: number
    highFeeTransactions: number
    highComputeTransactions: number
    uniqueWalletsObserved: number
    repeatedWallets: number
    largestMovementUiAmount: number | null
    topTokenAccountSupplyPct: number | null
  }
  insights: {
    executionHealth: CoinActivityInsight
    feePressure: CoinActivityInsight
    walletParticipation: CoinActivityInsight
    largestMovement: CoinActivityInsight
    breadlineSignal: CoinActivityInsight
  }
  signalSummary: string
  timeline: CoinActivityTransaction[]
  largestMovements: CoinActivityTransaction[]
  executionSignals: CoinActivityTransaction[]
  repeatedWalletSignals: CoinRepeatedWalletSignal[]
  failedThenLandedRetrySignals: CoinRetrySignal[]
  walletSignals: CoinRepeatedWalletSignal[]
  topTokenAccounts: Array<{
    address: string
    uiAmountString: string
    supplyPct: number | null
    confidence: CoinReceiptConfidence
  }>
  whatThisMeans: Array<{
    confidence: CoinReceiptConfidence
    text: string
  }>
  shareText: string
  caveats: string[]
  confidence: {
    tokenIdentity: CoinReceiptConfidence
    activity: CoinReceiptConfidence
    walletSignals: CoinReceiptConfidence
    executionSignals: CoinReceiptConfidence
  }
}

export type CoinActivityTransaction = {
  signature: string
  shortSignature: string
  typeHint: string
  slot: number | null
  blockTime: number | null
  status: 'success' | 'failed' | 'unknown'
  feePaidLamports: number | null
  feePaidSol: number | null
  priorityFeeLamportsEstimated: number | null
  computeUnitsConsumed: number | null
  tokenDeltaUiAmount: number | null
  tokenDeltaDirection: 'in' | 'out' | 'mixed' | 'none' | 'unknown'
  owners: string[]
  programs: string[]
  signals: string[]
  receiptUrl: string
  confidence: {
    transaction: CoinReceiptConfidence
    tokenMovement: CoinReceiptConfidence
    signals: CoinReceiptConfidence
  }
}

export async function getCoinActivityReceipt(mint: string, limit = 100): Promise<CoinActivityReceipt> {
  const res = await fetch('/api/coin-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mint, limit }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? 'Coin activity receipt failed')
  }

  return res.json()
}
