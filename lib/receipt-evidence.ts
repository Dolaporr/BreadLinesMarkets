export const BASE_FEE_LAMPORTS_PER_SIGNATURE = 5_000
export const COMPUTE_BUDGET_PROGRAM_ID = 'ComputeBudget111111111111111111111111111111'
export const JUPITER_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
export const HIGH_COMPUTE_UNITS = 750_000

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export type ReceiptEvidence = 'observed' | 'derived' | 'inferred' | 'conceptual'
export type ReceiptExecutionState = 'landed' | 'landed-but-failed' | 'did-not-land'
export type ComputeUnitPriceStatus = 'zero' | 'omitted' | 'set' | 'unknown'

export type ReceiptRpcAccountKey =
  | string
  | {
      pubkey?: string
      signer?: boolean
      writable?: boolean
      source?: string
    }

export type ReceiptRpcInstruction = {
  program?: string
  programId?: string
  programIdIndex?: number
  data?: string
  parsed?: unknown
}

export type ReceiptRpcTransaction = {
  slot: number
  meta?: {
    err?: unknown
    fee?: number
    computeUnitsConsumed?: number
    logMessages?: string[] | null
  } | null
  transaction?: {
    message?: {
      accountKeys?: ReceiptRpcAccountKey[]
      instructions?: ReceiptRpcInstruction[]
    }
    signatures?: string[]
  }
}

export type ComputeBudgetEvidence = {
  computeUnitPriceMicroLamports: number | null
  computeUnitLimit: number | null
  computeUnitPriceStatus: ComputeUnitPriceStatus
}

export type PriorityFeeDerivation = {
  evidence: 'derived'
  method: 'compute-budget'
  computeUnitLimit: number
  computeUnitPriceMicroLamports: number
  formula: string
  feeResidualLamports: number | null
}

export type ExplicitProgramError = {
  program: string
  programId: string | null
  code: number | null
  name: string | null
  message: string
  log: string
  evidence: 'observed'
  quantities?: {
    availableLamports: number
    requiredLamports: number
  }
  technicalError?: {
    program: string
    programId: string | null
    code: number | null
    name: string | null
    message: string
    log: string
    evidence: 'observed'
  }
}

function accountAddress(account: ReceiptRpcAccountKey | undefined) {
  if (!account) return undefined
  return typeof account === 'string' ? account : account.pubkey
}

function getProgramId(instruction: ReceiptRpcInstruction, accountKeys: ReceiptRpcAccountKey[]) {
  if (instruction.programId) return instruction.programId
  if (typeof instruction.programIdIndex === 'number') return accountAddress(accountKeys[instruction.programIdIndex])
  return undefined
}

function maybeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function parsedInstructionInfo(instruction: ReceiptRpcInstruction) {
  if (!instruction.parsed || typeof instruction.parsed !== 'object') return undefined
  return instruction.parsed as { type?: string; info?: Record<string, unknown> }
}

function decodeBase58(value: string) {
  const bytes = [0]

  for (const char of value) {
    const alphabetIndex = BASE58_ALPHABET.indexOf(char)
    if (alphabetIndex < 0) return []

    let carry = alphabetIndex
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58
      bytes[index] = carry & 0xff
      carry >>= 8
    }

    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  for (let index = 0; index < value.length - 1 && value[index] === '1'; index += 1) bytes.push(0)
  return bytes.reverse()
}

function readUInt32LE(bytes: number[], offset: number) {
  if (bytes.length < offset + 4) return undefined
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

function readUInt64LE(bytes: number[], offset: number) {
  if (bytes.length < offset + 8) return undefined

  let value = 0
  for (let index = 0; index < 8; index += 1) value += bytes[offset + index] * 2 ** (8 * index)
  return Number.isSafeInteger(value) ? value : undefined
}

export function collectComputeBudget(tx: ReceiptRpcTransaction): ComputeBudgetEvidence {
  const accountKeys = tx.transaction?.message?.accountKeys ?? []
  const instructions = tx.transaction?.message?.instructions ?? []
  let computeUnitPriceMicroLamports: number | null = null
  let computeUnitLimit: number | null = null
  let priceInstructionSeen = false

  for (const instruction of instructions) {
    if (getProgramId(instruction, accountKeys) !== COMPUTE_BUDGET_PROGRAM_ID) continue

    const parsed = parsedInstructionInfo(instruction)
    const parsedType = parsed?.type?.toLowerCase() ?? ''
    const parsedInfo = parsed?.info ?? {}
    const parsedPrice = maybeNumber(
      parsedInfo.microLamports ?? parsedInfo.microLamportsPerComputeUnit ?? parsedInfo.computeUnitPrice,
    )
    const parsedLimit = maybeNumber(parsedInfo.units ?? parsedInfo.computeUnitLimit ?? parsedInfo.limit)

    if (parsedType.includes('price') && parsedPrice != null) {
      priceInstructionSeen = true
      computeUnitPriceMicroLamports = parsedPrice
    }

    if (parsedType.includes('limit') && parsedLimit != null) computeUnitLimit = parsedLimit
    if (!instruction.data) continue

    const bytes = decodeBase58(instruction.data)

    // Solana Compute Budget: 2 = limit, 3 = price, 4 = loaded-account data limit.
    if (bytes[0] === 2) {
      const units = readUInt32LE(bytes, 1)
      if (units != null) computeUnitLimit = units
    }

    if (bytes[0] === 3) {
      const microLamports = readUInt64LE(bytes, 1)
      priceInstructionSeen = true
      if (microLamports != null) computeUnitPriceMicroLamports = microLamports
    }
  }

  return {
    computeUnitPriceMicroLamports,
    computeUnitLimit,
    computeUnitPriceStatus: priceInstructionSeen
      ? computeUnitPriceMicroLamports === 0
        ? 'zero'
        : 'set'
      : 'omitted',
  }
}

export function derivePriorityFeeLamports(tx: ReceiptRpcTransaction, computeBudget: ComputeBudgetEvidence) {
  const { computeUnitLimit, computeUnitPriceMicroLamports } = computeBudget

  if (
    computeBudget.computeUnitPriceStatus !== 'set' ||
    computeUnitLimit == null ||
    computeUnitPriceMicroLamports == null
  ) {
    return { amountLamports: null, derivation: null }
  }

  const amountLamports = Math.ceil((computeUnitLimit * computeUnitPriceMicroLamports) / 1_000_000)
  const signatureCount = tx.transaction?.signatures?.length ?? 0
  const feeResidualLamports =
    typeof tx.meta?.fee === 'number' && signatureCount > 0
      ? Math.max(0, tx.meta.fee - signatureCount * BASE_FEE_LAMPORTS_PER_SIGNATURE)
      : null

  return {
    amountLamports,
    derivation: {
      evidence: 'derived' as const,
      method: 'compute-budget' as const,
      computeUnitLimit,
      computeUnitPriceMicroLamports,
      formula: `ceil(${computeUnitLimit.toLocaleString()} CU x ${computeUnitPriceMicroLamports.toLocaleString()} micro-lamports/CU / 1,000,000) = ${amountLamports.toLocaleString()} lamports`,
      feeResidualLamports,
    },
  }
}

export function deriveExecutionState(tx: ReceiptRpcTransaction, statusError?: unknown): ReceiptExecutionState {
  if (tx.slot == null) return 'did-not-land'
  return tx.meta?.err || statusError ? 'landed-but-failed' : 'landed'
}

export function findExplicitProgramError(
  tx: ReceiptRpcTransaction,
  getProgramLabel: (programId: string) => string,
): ExplicitProgramError | null {
  const logs = tx.meta?.logMessages ?? []
  let activeProgramId: string | null = null
  const opaqueProgramErrors: Array<NonNullable<ExplicitProgramError['technicalError']>> = []
  const insufficientLamportsLogs: Array<{ log: string; programId: string | null; index: number; availableLamports: number; requiredLamports: number }> = []
  const anchorErrors: ExplicitProgramError[] = []

  for (const [index, log] of logs.entries()) {
    const invokeMatch = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[\d+\]$/)
    if (invokeMatch) {
      activeProgramId = invokeMatch[1]
      continue
    }

    const insufficientLamportsMatch = log.match(/(?:Program log: )?Transfer: insufficient lamports (\d+), need (\d+)/i)
    if (insufficientLamportsMatch) {
      insufficientLamportsLogs.push({
        log,
        programId: activeProgramId,
        index,
        availableLamports: Number(insufficientLamportsMatch[1]),
        requiredLamports: Number(insufficientLamportsMatch[2]),
      })
      continue
    }

    const anchorMatch = log.match(
      /AnchorError thrown .*Error Code: ([^.]+)\. Error Number: (\d+)\. Error Message: (.+?)\.?$/,
    )
    if (anchorMatch) {
      anchorErrors.push({
        program: activeProgramId === JUPITER_PROGRAM_ID ? 'Jupiter' : activeProgramId ? getProgramLabel(activeProgramId) : 'Program',
        programId: activeProgramId,
        code: Number(anchorMatch[2]),
        name: anchorMatch[1],
        message: anchorMatch[3].replace(/\.$/, ''),
        log,
        evidence: 'observed',
      })
    }

    const customErrorMatch = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) failed: custom program error: (0x[0-9a-f]+)$/i)
    if (!customErrorMatch) continue

    const programId = customErrorMatch[1]
    opaqueProgramErrors.push({
      program: programId === JUPITER_PROGRAM_ID ? 'Jupiter' : getProgramLabel(programId),
      programId,
      code: Number.parseInt(customErrorMatch[2], 16),
      name: null,
      message: `Custom program error ${customErrorMatch[2]}`,
      log,
      evidence: 'observed',
    })
  }

  // A quantified failure emitted during the failing instruction is more useful than
  // an opaque custom-error code. It still needs a nearby matching failure record.
  for (const evidence of insufficientLamportsLogs) {
    const technicalError = opaqueProgramErrors.find((error) =>
      error.programId === evidence.programId,
    ) ?? opaqueProgramErrors.find((error) => {
      const errorIndex = logs.indexOf(error.log)
      return errorIndex > evidence.index && errorIndex - evidence.index <= 4
    })

    if (!technicalError) continue

    const programId = technicalError.programId ?? evidence.programId
    return {
      program: technicalError.program,
      programId,
      code: null,
      name: 'InsufficientLamports',
      message: `Transfer: insufficient lamports ${evidence.availableLamports.toLocaleString()}, need ${evidence.requiredLamports.toLocaleString()}`,
      log: evidence.log,
      evidence: 'observed',
      quantities: {
        availableLamports: evidence.availableLamports,
        requiredLamports: evidence.requiredLamports,
      },
      technicalError,
    }
  }

  return anchorErrors[0] ?? opaqueProgramErrors[0] ?? null
}

export function documentedErrorHeadline({
  executionState,
  slot,
  executionError,
}: {
  executionState: ReceiptExecutionState
  slot: number
  executionError: ExplicitProgramError | null
}) {
  if (executionError?.program === 'Jupiter' && executionError.code === 6001 && executionError.name === 'SlippageToleranceExceeded') {
    return "This transaction landed but failed because Jupiter's slippage tolerance was exceeded."
  }

  if (executionError?.name === 'InsufficientLamports' && executionError.quantities) {
    return `This transaction landed but failed because a ${executionError.program} transfer required ${executionError.quantities.requiredLamports.toLocaleString()} lamports while only ${executionError.quantities.availableLamports.toLocaleString()} were available.`
  }

  if (executionState === 'landed-but-failed' && executionError) {
    return `This transaction landed but failed during execution because ${executionError.program} reported: ${executionError.message}.`
  }

  if (executionState === 'landed-but-failed') {
    return 'This transaction landed but failed during execution. RPC did not include a human-readable program error.'
  }

  if (executionState === 'did-not-land') {
    return 'This transaction did not land, so no confirmed execution receipt is available.'
  }

  return `This transaction landed successfully in slot ${slot}.`
}

export function failedReceiptUnknowns({
  executionState,
  executionError,
}: {
  executionState: ReceiptExecutionState
  executionError: ExplicitProgramError | null
}) {
  if (executionState !== 'landed-but-failed') return null

  if (executionError?.program === 'Jupiter' && executionError.code === 6001 && executionError.name === 'SlippageToleranceExceeded') {
    return "This receipt cannot determine whether price moved, Jupiter's route state changed, or execution timing altered the outcome. It only establishes that the transaction landed and Jupiter returned error 6001 (SlippageToleranceExceeded)."
  }

  return null
}

export function failedReceiptFutureText(executionError: ExplicitProgramError | null) {
  if (executionError?.program === 'Jupiter' && executionError.code === 6001 && executionError.name === 'SlippageToleranceExceeded') {
    return 'Before retrying, inspect the documented program error and route parameters. Slot pressure can be useful context, but this receipt does not establish it as the cause.'
  }

  if (executionError?.name === 'InsufficientLamports') {
    return 'Before retrying, make sure the transfer source has enough lamports for the required amount.'
  }

  if (executionError) {
    return 'Before retrying, inspect the documented program error. This receipt does not establish an execution-context cause.'
  }

  return 'Before retrying, inspect the confirmed execution result.'
}

export function buildFailedReceiptShareText({
  shortSignature,
  slot,
  executionError,
  feePaidLamports,
  priorityFeeDerivation,
  slotPressure,
}: {
  shortSignature: string
  slot: number
  executionError: ExplicitProgramError
  feePaidLamports: number | null
  priorityFeeDerivation: PriorityFeeDerivation | null
  slotPressure: { label: string; confidence: ReceiptEvidence; basis: string[] }
}) {
  const headline = documentedErrorHeadline({
    executionState: 'landed-but-failed',
    slot,
    executionError,
  })
  const technicalEvidence = executionError.technicalError
    ? `Technical evidence: ${executionError.technicalError.program}${executionError.technicalError.code != null ? ` error ${executionError.technicalError.code}` : ''}: ${executionError.technicalError.message}.`
    : null
  const priorityFee = priorityFeeDerivation
    ? `Priority fee: ${priorityFeeDerivation.formula} (derived from observed Compute Budget instructions).`
    : 'Priority fee: unavailable (no complete observed Compute Budget price and limit pair).'
  const fee = feePaidLamports == null
    ? 'Fee paid: unavailable.'
    : `Fee paid: ${feePaidLamports.toLocaleString()} lamports.`

  return [
    headline,
    `Breadlines receipt for ${shortSignature}`,
    `Execution: landed but failed | Slot: ${slot.toLocaleString()}`,
    `Observed program evidence: ${executionError.program}${executionError.name ? ` (${executionError.name})` : ''}: ${executionError.message}.`,
    technicalEvidence,
    fee,
    priorityFee,
    `Context only: ${contextualPressureSentence(slotPressure.label, slotPressure.basis)}`,
    'Observed transaction data + derived fee + inferred pressure. Pressure is not asserted as the cause of this failure.',
    'https://breadlinesmarkets.com',
  ].filter((line): line is string => line !== null).join('\n')
}

export function contextualPressureSentence(label: string, basis: string[]) {
  const signalText = basis.length ? `uses ${basis.join(', ')}` : `is ${label}`
  return `Separately, the ${label} slot-pressure inference ${signalText}. It is contextual, not a documented cause of this result.`
}

export function calculateHistoricalPressureScore({
  slotSignatureCount,
  computeUnitsConsumed,
  programsTouched,
  writableAccounts,
}: {
  slotSignatureCount?: number
  computeUnitsConsumed?: number
  programsTouched: number
  writableAccounts: number
}) {
  let score = 12

  // Historical receipts must not depend on live performance samples.
  if (slotSignatureCount != null) score += Math.min(34, slotSignatureCount / 80)
  if (computeUnitsConsumed != null && computeUnitsConsumed > HIGH_COMPUTE_UNITS) score += 16
  if (programsTouched >= 4) score += 10
  if (writableAccounts >= 12) score += 10

  return Math.round(Math.max(0, Math.min(100, score)))
}
