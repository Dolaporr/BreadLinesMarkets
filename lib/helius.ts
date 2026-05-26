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

export async function getLiveData(): Promise<{ spamVolume: number; priorityFee: number }> {
  const res = await fetch('/api/helius')
  if (!res.ok) throw new Error('Helius API route failed')
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
