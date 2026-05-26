import { NextResponse } from 'next/server'

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

type TransferRow = {
  signature?: string
  type?: string
  fromUserAccount?: string | null
  toUserAccount?: string | null
  feeAmount?: string
}

async function heliusRpc(method: string, params: unknown[]) {
  const res = await fetch(HELIUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result
}

function buildStats(address: string, transfers: TransferRow[]) {
  const normalizedAddress = address.toLowerCase()
  const signatureCounts = new Map<string, number>()

  for (const transfer of transfers) {
    if (!transfer.signature) continue
    signatureCounts.set(transfer.signature, (signatureCounts.get(transfer.signature) ?? 0) + 1)
  }

  return {
    transferRows: transfers.length,
    uniqueTransactions: signatureCounts.size,
    inboundRows: transfers.filter((transfer) => transfer.toUserAccount?.toLowerCase() === normalizedAddress).length,
    outboundRows: transfers.filter((transfer) => transfer.fromUserAccount?.toLowerCase() === normalizedAddress).length,
    mintRows: transfers.filter((transfer) => transfer.type === 'mint').length,
    burnRows: transfers.filter((transfer) => transfer.type === 'burn').length,
    token2022FeeRows: transfers.filter((transfer) => transfer.feeAmount && transfer.feeAmount !== '0').length,
    batchedSignatureRows: Array.from(signatureCounts.values()).filter((count) => count > 1).length,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const address = String(body.address ?? '').trim()
    const limit = Math.max(1, Math.min(100, Number(body.limit ?? 25)))
    const paginationToken = body.paginationToken ? String(body.paginationToken) : undefined

    if (!process.env.HELIUS_API_KEY) {
      return NextResponse.json({ error: 'HELIUS_API_KEY is not configured.' }, { status: 500 })
    }

    if (!SOLANA_ADDRESS_PATTERN.test(address)) {
      return NextResponse.json({ error: 'Paste a valid Solana wallet address.' }, { status: 400 })
    }

    const result = await heliusRpc('getTransfersByAddress', [
      address,
      {
        limit,
        sortOrder: 'desc',
        commitment: 'finalized',
        solMode: 'merged',
        ...(paginationToken ? { paginationToken } : {}),
      },
    ])

    const transfers = Array.isArray(result?.data) ? result.data : []

    return NextResponse.json({
      address,
      transfers,
      paginationToken: result?.paginationToken,
      stats: buildStats(address, transfers),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to scan transfer history.' },
      { status: 500 },
    )
  }
}
