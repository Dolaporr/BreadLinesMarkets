import { NextResponse } from 'next/server'

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

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

export async function GET() {
  const [perfSamples, feeResult] = await Promise.all([
    heliusRpc('getRecentPerformanceSamples', [5]),
    heliusRpc('getPriorityFeeEstimate', [{
      accountKeys: ['11111111111111111111111111111111'],
      options: { priorityLevel: 'Medium' }
    }])
  ])

  const sample = perfSamples[0]
  const spamVolume = ((sample.numTransactions - sample.numNonVoteTransactions) / sample.numTransactions) * 100
  const priorityFee = (feeResult?.priorityFeeEstimate ?? 1000) / 1_000_000

  return NextResponse.json({ spamVolume, priorityFee })
}
