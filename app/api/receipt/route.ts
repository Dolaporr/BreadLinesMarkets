import { NextResponse } from 'next/server'
import {
  COMPUTE_BUDGET_PROGRAM_ID,
  HIGH_COMPUTE_UNITS,
  JUPITER_PROGRAM_ID,
  calculateHistoricalPressureScore,
  collectComputeBudget as collectComputeBudgetEvidence,
  deriveExecutionState,
  derivePriorityFeeLamports as derivePriorityFeeEvidence,
  findExplicitProgramError as findLoggedProgramError,
  type ReceiptEvidence,
} from '@/lib/receipt-evidence'

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/
const ACTIVITY_SCAN_LIMIT = 12

type Confidence = ReceiptEvidence
type SensitivityLevel = 'low' | 'medium' | 'high' | 'unknown'
type InclusionConfidence = Confidence | 'needs inspection'
type ExecutionState = 'landed' | 'landed-but-failed' | 'did-not-land'

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
  data?: string
  parsed?: unknown
}

type RpcTransaction = {
  slot: number
  blockTime?: number | null
  meta?: {
    err?: unknown
    fee?: number
    computeUnitsConsumed?: number
    logMessages?: string[] | null
    innerInstructions?: Array<{ instructions?: RpcInstruction[] }>
    preTokenBalances?: unknown[]
    postTokenBalances?: unknown[]
  } | null
  transaction?: {
    message?: {
      accountKeys?: RpcAccountKey[]
      instructions?: RpcInstruction[]
      recentBlockhash?: string
    }
    signatures?: string[]
  }
}

type SignatureStatus = {
  confirmationStatus?: string
  err?: unknown
}

type PerformanceSample = {
  numTransactions?: number
  numNonVoteTransactions?: number
  numSlots?: number
  samplePeriodSecs?: number
}

type RecentSignature = {
  signature?: string
  slot?: number
  blockTime?: number | null
  err?: unknown
  confirmationStatus?: string
}

const PROGRAM_LABELS: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program',
  [COMPUTE_BUDGET_PROGRAM_ID]: 'Compute Budget',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
  TokenzQdBNbLqP5VEhUMLAq5Lx4o2sxb9y5KHK2iHf: 'Token-2022',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'Associated Token Account',
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: 'Memo Program',
  Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo: 'Memo Program',
  AddressLookupTab1e1111111111111111111111111: 'Address Lookup Table',
  [JUPITER_PROGRAM_ID]: 'Jupiter Aggregator',
  whirLbMiicVdio4qvUfM5KAg6CtQonwY6WcAm7A9Xq: 'Orca Whirlpool',
  dRiftyHA39mYBAzirNc3LfgcHftc83mDtvrVQSaVbb: 'Drift Protocol',
  PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY: 'Phoenix',
}

async function heliusRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(HELIUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result as T
}

function accountAddress(account: RpcAccountKey | undefined) {
  if (!account) return undefined
  return typeof account === 'string' ? account : account.pubkey
}

function shortAddress(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function programLabel(programId: string, programName?: string) {
  if (PROGRAM_LABELS[programId]) return PROGRAM_LABELS[programId]
  if (programName) return programName
  return 'Unknown Program'
}

function getProgramId(instruction: RpcInstruction, accountKeys: RpcAccountKey[]) {
  if (instruction.programId) return instruction.programId
  if (typeof instruction.programIdIndex === 'number') {
    return accountAddress(accountKeys[instruction.programIdIndex])
  }
  return undefined
}

function collectPrograms(tx: RpcTransaction) {
  const accountKeys = tx.transaction?.message?.accountKeys ?? []
  const topLevel = tx.transaction?.message?.instructions ?? []
  const inner = tx.meta?.innerInstructions?.flatMap((group) => group.instructions ?? []) ?? []
  const counts = new Map<string, { id: string; label: string; instructionCount: number }>()

  for (const instruction of [...topLevel, ...inner]) {
    const id = getProgramId(instruction, accountKeys)
    if (!id) continue
    const existing = counts.get(id)

    if (existing) {
      existing.instructionCount += 1
      continue
    }

    counts.set(id, {
      id,
      label: programLabel(id, instruction.program),
      instructionCount: 1,
    })
  }

  return Array.from(counts.values()).sort((a, b) => b.instructionCount - a.instructionCount)
}

function collectWritableAccounts(tx: RpcTransaction) {
  return (tx.transaction?.message?.accountKeys ?? [])
    .map((account) => {
      if (typeof account === 'string') {
        return { address: account, signer: false, source: 'unknown', confidence: 'inferred' as Confidence }
      }

      return {
        address: account.pubkey ?? '',
        signer: Boolean(account.signer),
        source: account.source ?? 'transaction',
        confidence: 'observed' as Confidence,
        writable: Boolean(account.writable),
      }
    })
    .filter((account) => account.address && ('writable' in account ? account.writable : false))
}

function collectSignerWallet(tx: RpcTransaction) {
  const accountKeys = tx.transaction?.message?.accountKeys ?? []
  const signer = accountKeys.find((account) => typeof account !== 'string' && account.signer)
  const fallback = accountKeys[0]
  const signerAccount = signer ?? fallback
  const address = accountAddress(signerAccount)

  if (!address) return null

  return {
    address,
    confidence: typeof signerAccount === 'string' ? 'inferred' as Confidence : 'observed' as Confidence,
  }
}

async function getRecentSignaturesForAddress(address: string, limit = ACTIVITY_SCAN_LIMIT) {
  try {
    return await heliusRpc<RecentSignature[]>('getSignaturesForAddress', [
      address,
      { limit },
    ])
  } catch {
    return undefined
  }
}

async function summarizeRecentActivity({
  kind,
  address,
  label,
  currentSignature,
}: {
  kind: 'signer' | 'program' | 'account'
  address: string
  label: string
  currentSignature: string
}) {
  const signatures = await getRecentSignaturesForAddress(address)

  if (!signatures) {
    return {
      kind,
      address,
      label,
      available: false,
      recentSignatureCount: null,
      otherRecentSignatureCount: null,
      sampleSignatures: [],
      confidence: 'needs inspection' as InclusionConfidence,
    }
  }

  const sampleSignatures = signatures
    .filter((item) => item.signature)
    .map((item) => ({
      signature: item.signature ?? '',
      slot: item.slot ?? null,
      blockTime: item.blockTime ?? null,
      status: item.err ? 'failed' as const : 'landed' as const,
    }))

  const otherRecentSignatureCount = sampleSignatures
    .filter((item) => item.signature !== currentSignature)
    .length

  return {
    kind,
    address,
    label,
    available: true,
    recentSignatureCount: sampleSignatures.length,
    otherRecentSignatureCount,
    sampleSignatures: sampleSignatures.slice(0, 4),
    confidence: 'inferred' as InclusionConfidence,
  }
}

async function buildInclusionSymptoms({
  signature,
  tx,
  executionState,
  programs,
  writableAccounts,
  computeBudget,
  priorityFee,
}: {
  signature: string
  tx: RpcTransaction
  executionState: ExecutionState
  programs: Array<{ id: string; label: string; instructionCount: number }>
  writableAccounts: Array<{ address: string; signer?: boolean; source?: string; confidence: Confidence }>
  computeBudget: ReturnType<typeof collectComputeBudgetEvidence>
  priorityFee: ReturnType<typeof derivePriorityFeeEvidence>
}) {
  const signerWallet = collectSignerWallet(tx)
  const mainWritableAccounts = writableAccounts.slice(0, 8)
  const repeatedSignerActivity = signerWallet
    ? await summarizeRecentActivity({
        kind: 'signer',
        address: signerWallet.address,
        label: 'Signer wallet',
        currentSignature: signature,
      })
    : null
  const commonProgramIds = new Set([
    '11111111111111111111111111111111',
    COMPUTE_BUDGET_PROGRAM_ID,
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
    'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
  ])
  const activityTargets = [
    ...programs
      .filter((program) => !commonProgramIds.has(program.id))
      .slice(0, 3)
      .map((program) => ({
        kind: 'program' as const,
        address: program.id,
        label: program.label,
      })),
    ...mainWritableAccounts
      .filter((account) => account.address !== signerWallet?.address)
      .slice(0, 4)
      .map((account) => ({
        kind: 'account' as const,
        address: account.address,
        label: shortAddress(account.address),
      })),
  ]
  const repeatedProgramAccountActivity = await Promise.all(
    activityTargets.map((target) => summarizeRecentActivity({
      ...target,
      currentSignature: signature,
    })),
  )
  const hotProgramOrAccount = repeatedProgramAccountActivity.some(
    (activity) => activity.available && (activity.otherRecentSignatureCount ?? 0) >= 8,
  )
  const symptomBadges: Array<{ label: string; confidence: InclusionConfidence; detail: string }> = []

  if (executionState === 'landed' && priorityFee.amountLamports === 0) {
    symptomBadges.push({
      label: 'landed with zero priority fee',
      confidence: 'inferred',
      detail: 'Total fee matches the base signature fee estimate.',
    })
  }

  if (computeBudget.computeUnitPriceStatus === 'omitted') {
    symptomBadges.push({
      label: 'compute price omitted',
      confidence: 'inferred',
      detail: 'No Compute Budget setComputeUnitPrice instruction was parsed.',
    })
  }

  if (priorityFee.amountLamports == null) {
    symptomBadges.push({
      label: 'priority fee unavailable',
      confidence: 'needs inspection',
      detail: 'Priority fee is only derived when both Compute Budget limit and price instructions are available.',
    })
  }

  if ((tx.meta?.computeUnitsConsumed ?? 0) >= HIGH_COMPUTE_UNITS) {
    symptomBadges.push({
      label: 'high compute usage',
      confidence: 'observed',
      detail: `${tx.meta?.computeUnitsConsumed?.toLocaleString()} compute units consumed.`,
    })
  }

  if (repeatedSignerActivity?.available && (repeatedSignerActivity.otherRecentSignatureCount ?? 0) >= 2) {
    symptomBadges.push({
      label: 'repeat signer activity',
      confidence: 'inferred',
      detail: `${repeatedSignerActivity.otherRecentSignatureCount} other recent signer signatures found.`,
    })
  }

  if (hotProgramOrAccount) {
    symptomBadges.push({
      label: 'hot program/account touched',
      confidence: 'inferred',
      detail: 'A touched program or writable account had many recent signatures in the sampled window.',
    })
  }

  if (
    executionState === 'landed-but-failed' ||
    computeBudget.computeUnitPriceStatus !== 'set' ||
    !repeatedSignerActivity?.available ||
    repeatedProgramAccountActivity.some((activity) => !activity.available)
  ) {
    symptomBadges.push({
      label: 'needs inspection',
      confidence: 'needs inspection',
      detail: 'Tx-level signals are incomplete or ambiguous enough to review manually.',
    })
  }

  return {
    status: executionState,
    totalFeeLamports: tx.meta?.fee ?? null,
    priorityFeeLamportsEstimated: priorityFee.amountLamports,
    priorityFeeDerivation: priorityFee.derivation,
    computeUnitPriceMicroLamports: computeBudget.computeUnitPriceMicroLamports,
    computeUnitLimit: computeBudget.computeUnitLimit,
    computeUnitPriceStatus: computeBudget.computeUnitPriceStatus,
    computeUnitsConsumed: tx.meta?.computeUnitsConsumed ?? null,
    programsTouched: programs,
    signerWallet,
    mainWritableAccounts,
    repeatedSignerActivity,
    repeatedProgramAccountActivity,
    symptomBadges,
    disclaimer: 'Tx-level symptoms only. Not proof of private validator routing.',
    shareText: 'Readable tx receipt for inclusion/MEV inspection.',
  }
}

function pressureLabel(score: number) {
  if (score >= 70) return 'high'
  if (score >= 38) return 'moderate'
  return 'low'
}

function buildPressure({
  tx,
  slotSignatureCount,
  samples,
  programsTouched,
  writableAccounts,
}: {
  tx: RpcTransaction
  slotSignatureCount?: number
  samples: PerformanceSample[]
  programsTouched: number
  writableAccounts: number
}) {
  const sample = samples[0]
  const txPerSlot =
    sample?.numTransactions && sample?.numSlots ? sample.numTransactions / Math.max(1, sample.numSlots) : undefined
  const nonVoteTxPerSlot =
    sample?.numNonVoteTransactions && sample?.numSlots ? sample.numNonVoteTransactions / Math.max(1, sample.numSlots) : undefined
  const avgSlotMs =
    sample?.samplePeriodSecs && sample?.numSlots ? (sample.samplePeriodSecs * 1000) / Math.max(1, sample.numSlots) : undefined

  const basis: string[] = []
  if (slotSignatureCount != null) {
    basis.push(`landed slot carried ${slotSignatureCount} signatures`)
  } else {
    basis.push('landed slot signature count unavailable')
  }

  if (tx.meta?.computeUnitsConsumed && tx.meta.computeUnitsConsumed > HIGH_COMPUTE_UNITS) {
    basis.push('high compute usage')
  }

  if (programsTouched >= 4) {
    basis.push('multi-program execution path')
  }

  if (writableAccounts >= 12) {
    basis.push('many writable accounts')
  }

  const boundedScore = calculateHistoricalPressureScore({
    slotSignatureCount,
    computeUnitsConsumed: tx.meta?.computeUnitsConsumed,
    programsTouched,
    writableAccounts,
  })

  return {
    label: pressureLabel(boundedScore),
    score: boundedScore,
    confidence: 'inferred' as Confidence,
    basis,
    sample: {
      txPerSlot: txPerSlot != null ? Math.round(txPerSlot * 100) / 100 : undefined,
      nonVoteTxPerSlot: nonVoteTxPerSlot != null ? Math.round(nonVoteTxPerSlot * 100) / 100 : undefined,
      avgSlotMs: avgSlotMs != null ? Math.round(avgSlotMs) : undefined,
    },
  }
}

function sensitivity(
  level: SensitivityLevel,
  confidence: Confidence,
  reasons: string[],
) {
  return { level, confidence, reasons }
}

function buildPercolatorLens({
  tx,
  programs,
  writableAccounts,
  pressure,
  priorityFeeLamports,
}: {
  tx: RpcTransaction
  programs: Array<{ id: string; label: string; instructionCount: number }>
  writableAccounts: Array<{ address: string }>
  pressure: ReturnType<typeof buildPressure>
  priorityFeeLamports?: number
}) {
  const programText = programs.map((program) => `${program.label} ${program.id}`.toLowerCase()).join(' ')
  const hasSwapOrPerpHint =
    /jupiter|drift|phoenix|orca|raydium|openbook|perp|amm|market|swap/.test(programText)
  const tokenBalanceTouched =
    (tx.meta?.preTokenBalances?.length ?? 0) > 0 || (tx.meta?.postTokenBalances?.length ?? 0) > 0
  const highPressure = pressure.label === 'high' || pressure.score >= 70
  const mediumPressure = pressure.label === 'moderate' || pressure.score >= 38
  const highWriteSet = writableAccounts.length >= 12
  const highCompute = Boolean(tx.meta?.computeUnitsConsumed && tx.meta.computeUnitsConsumed > HIGH_COMPUTE_UNITS)

  const queueReasons: string[] = []
  if (highPressure) queueReasons.push('landed in a high-pressure slot estimate')
  if (mediumPressure && !highPressure) queueReasons.push('landed in a moderate-pressure slot estimate')
  if (priorityFeeLamports && priorityFeeLamports > 0) queueReasons.push('included a derived priority fee')
  if (highWriteSet) queueReasons.push('large writable account set can increase scheduling sensitivity')

  const priceReasons: string[] = []
  if (hasSwapOrPerpHint) priceReasons.push('program path looks trading or market related')
  if (tokenBalanceTouched) priceReasons.push('token balances changed during execution')
  if (highPressure || mediumPressure) priceReasons.push('contention can matter more for price-sensitive flow')

  const riskReasons: string[] = []
  if (/drift|phoenix|perp|oracle|pyth|switchboard/.test(programText)) {
    riskReasons.push('program path hints at market, perp, or oracle-sensitive logic')
  }
  if (highCompute) riskReasons.push('high compute usage can make risk-state refreshes more fragile under pressure')
  if (tx.meta?.err) riskReasons.push('failed execution is worth inspecting for routing, state, or user-side constraints')

  const queueLevel: SensitivityLevel = queueReasons.length >= 3 || highPressure ? 'high' : queueReasons.length ? 'medium' : 'low'
  const priceLevel: SensitivityLevel = priceReasons.length >= 2 ? 'high' : priceReasons.length ? 'medium' : 'low'
  const riskLevel: SensitivityLevel = riskReasons.length >= 2 ? 'high' : riskReasons.length ? 'medium' : 'low'

  return {
    queueSensitive: sensitivity(queueLevel, 'inferred', queueReasons.length ? queueReasons : ['no strong queue-pressure signal found']),
    priceSensitive: sensitivity(priceLevel, 'inferred', priceReasons.length ? priceReasons : ['no strong price-sensitivity signal found']),
    riskOracleSensitive: sensitivity(riskLevel, 'inferred', riskReasons.length ? riskReasons : ['no strong risk/oracle signal found']),
    whyMarketStructureMayMatter: {
      confidence: 'conceptual' as Confidence,
      text:
        'Percolator-style perps and MCP-style proposer competition are useful to study when execution quality depends on fresh state, bounded risk progress, and fairer ordering under contention. This receipt does not claim what Percolator would have done; it marks where better market structure may matter.',
    },
  }
}

async function getSlotSignatureCount(slot: number) {
  try {
    const block = await heliusRpc<{ signatures?: string[] } | null>('getBlock', [
      slot,
      {
        commitment: 'confirmed',
        transactionDetails: 'signatures',
        rewards: false,
        maxSupportedTransactionVersion: 0,
      },
    ])

    return block?.signatures?.length
  } catch {
    return undefined
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const signature = String(body.signature ?? '').trim()

    if (!process.env.HELIUS_API_KEY) {
      return NextResponse.json({ error: 'HELIUS_API_KEY is not configured.' }, { status: 500 })
    }

    if (!SOLANA_SIGNATURE_PATTERN.test(signature)) {
      return NextResponse.json({ error: 'Paste a valid Solana transaction signature.' }, { status: 400 })
    }

    const [tx, statusResult, samples] = await Promise.all([
      heliusRpc<RpcTransaction | null>('getTransaction', [
        signature,
        {
          encoding: 'jsonParsed',
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        },
      ]),
      heliusRpc<{ value?: SignatureStatus[] }>('getSignatureStatuses', [
        [signature],
        { searchTransactionHistory: true },
      ]),
      heliusRpc<PerformanceSample[]>('getRecentPerformanceSamples', [5]),
    ])

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction was not found by RPC. It may be too new, too old for this node, or invalid.' },
        { status: 404 },
      )
    }

    const programs = collectPrograms(tx)
    const writableAccounts = collectWritableAccounts(tx)
    const slotSignatureCount = await getSlotSignatureCount(tx.slot)
    const computeBudget = collectComputeBudgetEvidence(tx)
    const priorityFee = derivePriorityFeeEvidence(tx, computeBudget)
    const pressure = buildPressure({
      tx,
      slotSignatureCount,
      samples,
      programsTouched: programs.length,
      writableAccounts: writableAccounts.length,
    })
    const status = statusResult.value?.[0]
    const executionState: ExecutionState = deriveExecutionState(tx, status?.err)
    const statusLabel = executionState === 'landed' ? 'success' : 'failed'
    const executionError = findLoggedProgramError(tx, (programId) => programLabel(programId))
    const lens = executionState === 'landed-but-failed'
      ? null
      : buildPercolatorLens({
          tx,
          programs,
          writableAccounts,
          pressure,
          priorityFeeLamports: priorityFee.amountLamports ?? undefined,
        })
    const inclusionSymptoms = await buildInclusionSymptoms({
      signature,
      tx,
      executionState,
      programs,
      writableAccounts,
      computeBudget,
      priorityFee,
    })

    return NextResponse.json({
      signature,
      shortSignature: `${signature.slice(0, 6)}...${signature.slice(-6)}`,
      slot: tx.slot,
      blockTime: tx.blockTime ?? null,
      status: statusLabel,
      executionState,
      confirmationStatus: status?.confirmationStatus ?? 'unknown',
      error: tx.meta?.err ?? status?.err ?? null,
      executionError,
      feePaidLamports: tx.meta?.fee ?? null,
      feePaidSol: typeof tx.meta?.fee === 'number' ? tx.meta.fee / 1_000_000_000 : null,
      priorityFeeLamportsEstimated: priorityFee.amountLamports ?? undefined,
      priorityFeeDerivation: priorityFee.derivation,
      computeUnitsConsumed: tx.meta?.computeUnitsConsumed ?? null,
      recentBlockhash: tx.transaction?.message?.recentBlockhash ?? null,
      signatureCount: tx.transaction?.signatures?.length ?? null,
      instructionCount: tx.transaction?.message?.instructions?.length ?? 0,
      innerInstructionGroupCount: tx.meta?.innerInstructions?.length ?? 0,
      programs,
      writableAccounts,
      writableAccountCount: writableAccounts.length,
      slotPressure: pressure,
      confidence: {
        transaction: 'observed' as Confidence,
        slotPressure: 'inferred' as Confidence,
        percolatorLens: lens ? 'conceptual' as Confidence : null,
      },
      percolatorLens: lens,
      inclusionSymptoms,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to build receipt.' },
      { status: 500 },
    )
  }
}
