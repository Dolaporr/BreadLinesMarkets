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
export type ReceiptSensitivityLevel = 'low' | 'medium' | 'high' | 'unknown'

export type BreadlinesReceipt = {
  signature: string
  shortSignature: string
  slot: number
  blockTime: number | null
  status: 'success' | 'failed'
  confirmationStatus: string
  error: unknown
  feePaidLamports: number | null
  feePaidSol: number | null
  priorityFeeLamportsEstimated?: number
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
    confidence: ReceiptConfidence
  }>
  writableAccountCount: number
  slotPressure: {
    label: 'low' | 'moderate' | 'high'
    score: number
    confidence: ReceiptConfidence
    basis: string[]
    sample: {
      txPerSlot?: number
      nonVoteTxPerSlot?: number
      avgSlotMs?: number
    }
  }
  confidence: {
    transaction: ReceiptConfidence
    slotPressure: ReceiptConfidence
    percolatorLens: ReceiptConfidence
  }
  percolatorLens: {
    queueSensitive: {
      level: ReceiptSensitivityLevel
      confidence: ReceiptConfidence
      reasons: string[]
    }
    priceSensitive: {
      level: ReceiptSensitivityLevel
      confidence: ReceiptConfidence
      reasons: string[]
    }
    riskOracleSensitive: {
      level: ReceiptSensitivityLevel
      confidence: ReceiptConfidence
      reasons: string[]
    }
    whyMarketStructureMayMatter: {
      confidence: ReceiptConfidence
      text: string
    }
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
