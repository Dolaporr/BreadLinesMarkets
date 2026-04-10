const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY ?? ''}`

type RpcResponse<T> = {
  result?: T
  error?: {
    message?: string
  }
}

type PerformanceSample = {
  numTransactions?: number
  numNonVoteTransactions?: number
}

type PriorityFeeEstimateResult = {
  priorityFeeEstimate?: number
  priorityFeeLevels?: {
    medium?: number
  }
}

function assertApiKey() {
  if (!HELIUS_API_KEY) {
    throw new Error('Missing NEXT_PUBLIC_HELIUS_API_KEY')
  }
}

async function heliusRpc<T>(method: string, params: unknown[]): Promise<T> {
  assertApiKey()

  console.log(`[Helius] ${method} -> ${HELIUS_RPC_URL}`)

  const response = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method,
      params,
    }),
  })

  if (!response.ok) {
    const error = new Error(`Helius request failed with status ${response.status}`)
    console.error(`[Helius] ${method} HTTP error`, error)
    throw error
  }

  const payload = (await response.json()) as RpcResponse<T>

  if (payload.error) {
    const error = new Error(payload.error.message ?? `Helius ${method} request failed`)
    console.error(`[Helius] ${method} RPC error`, payload.error)
    throw error
  }

  if (!payload.result) {
    const error = new Error(`Helius ${method} returned no result`)
    console.error(`[Helius] ${method} empty result`, payload)
    throw error
  }

  console.log(`[Helius] ${method} result`, payload.result)

  return payload.result
}

export async function getLiveSpamPercent(): Promise<number> {
  try {
    const samples = await heliusRpc<PerformanceSample[]>('getRecentPerformanceSamples', [5])

    if (!samples.length) {
      console.log('[Helius] getLiveSpamPercent returned 0 (no samples)')
      return 0
    }

    const percentages = samples
      .map((sample) => {
        const totalTransactions = sample.numTransactions ?? 0
        const nonVoteTransactions = sample.numNonVoteTransactions ?? 0

        if (totalTransactions <= 0) {
          return 0
        }

        return (nonVoteTransactions / totalTransactions) * 100
      })
      .filter((value) => Number.isFinite(value))

    if (!percentages.length) {
      console.log('[Helius] getLiveSpamPercent returned 0 (no valid percentages)')
      return 0
    }

    const averagePercent = percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    const spamPercent = Math.max(0, Math.min(100, averagePercent))
    console.log('[Helius] getLiveSpamPercent ->', spamPercent)
    return spamPercent
  } catch (error) {
    console.error('[Helius] getLiveSpamPercent failed', error)
    throw error
  }
}

export async function getLivePriorityFee(): Promise<number> {
  try {
    const result = await heliusRpc<PriorityFeeEstimateResult>('getPriorityFeeEstimate', [
      {
        accountKeys: ['11111111111111111111111111111111'],
        options: {
          priorityLevel: 'Medium',
        },
      },
    ])
    const fee = result?.priorityFeeEstimate ?? 1000
    const inLamports = fee / 1_000_000
    console.log('[Helius] getLivePriorityFee ->', inLamports)
    return inLamports
  } catch (error) {
    console.error('[Helius] getLivePriorityFee failed', error)
    throw error
  }
}
