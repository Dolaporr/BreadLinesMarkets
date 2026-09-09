// Research-only snapshot of existing receipt evidence helpers, pinned 2026-09-09.
// Isolated so shipping X-Ray does not publish pending production parser changes.
export const BASE_FEE_LAMPORTS_PER_SIGNATURE = 5_000
export const COMPUTE_BUDGET_PROGRAM_ID = 'ComputeBudget111111111111111111111111111111'
export const JUPITER_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
export const HIGH_COMPUTE_UNITS = 750_000

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function shortProgramId(programId: string) {
  return `${programId.slice(0, 4)}...${programId.slice(-4)}`
}

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
  structuredEvidence?: Array<{
    label: string
    fields: Array<{ key: string; value: string }>
    log: string
    evidence: 'observed'
  }>
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
  type ProgramFrame = { id: string; depth: number; instance: number }
  type FramedTechnicalError = NonNullable<ExplicitProgramError['technicalError']> & {
    frameInstance: number | null
    index: number
  }
  type FramedStructuredError = {
    log: string
    programId: string | null
    frameInstance: number | null
    index: number
    name: string
  }
  type FramedFailureInfo = {
    label: string
    fields: Array<{ key: string; value: string }>
    log: string
    programId: string | null
    frameInstance: number | null
    index: number
  }
  type FramedFailureStatement = {
    message: string
    log: string
    programId: string | null
    frameInstance: number | null
    index: number
  }

  const stack: ProgramFrame[] = []
  let nextFrameInstance = 0
  const opaqueProgramErrors: FramedTechnicalError[] = []
  const insufficientLamportsLogs: Array<{ log: string; programId: string | null; frameInstance: number | null; index: number; availableLamports: number; requiredLamports: number }> = []
  const anchorErrors: Array<{ error: ExplicitProgramError; frameInstance: number | null; index: number }> = []
  const structuredProgramErrors: FramedStructuredError[] = []
  const failureInfoLogs: FramedFailureInfo[] = []
  const programFailureStatements: FramedFailureStatement[] = []

  const currentFrame = () => stack[stack.length - 1] ?? null
  const programName = (programId: string | null) => {
    if (programId === JUPITER_PROGRAM_ID) return 'Jupiter'
    if (!programId) return 'Program'

    const label = getProgramLabel(programId)
    return label === 'Unknown Program' ? `Program ${shortProgramId(programId)}` : label
  }
  const beginFrame = (id: string, depth: number) => {
    while (stack.length && (stack[stack.length - 1]?.depth ?? 0) >= depth) stack.pop()
    const frame = { id, depth, instance: nextFrameInstance += 1 }
    stack.push(frame)
    return frame
  }
  const closeFrame = (id: string) => {
    for (let position = stack.length - 1; position >= 0; position -= 1) {
      if (stack[position]?.id === id) {
        stack.splice(position)
        return
      }
    }
  }
  const parseFailureInfo = (log: string) => {
    const match = log.match(/^Program log: TXFAILINFO:([^:]+)(?::(.+))?$/)
    if (!match) return null

    const tokens = match[2] ? match[2].split(':') : []
    const fields: Array<{ key: string; value: string }> = []
    for (let position = 0; position + 1 < tokens.length; position += 2) {
      fields.push({ key: tokens[position], value: tokens[position + 1] })
    }

    return { label: match[1], fields }
  }
  const isDeterministicFailureStatement = (message: string) => {
    const hasRejectionSignal = /\b(required|requires|must|missing|invalid|insufficient|exceeds|cannot|can't|rejected|denied|not allowed)\b/i.test(message)
    const identifiesRelevantConstraint = /\b(account|mint|transfer|instruction|token|fee|authority|owner|balance|state|amount|signature|program)\b/i.test(message)
    return hasRejectionSignal && identifiesRelevantConstraint
  }

  for (const [index, log] of logs.entries()) {
    const invokeMatch = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[(\d+)\]$/)
    if (invokeMatch) {
      beginFrame(invokeMatch[1], Number(invokeMatch[2]))
      continue
    }

    const frame = currentFrame()

    const failureInfo = parseFailureInfo(log)
    if (failureInfo) {
      failureInfoLogs.push({
        ...failureInfo,
        log,
        programId: frame?.id ?? null,
        frameInstance: frame?.instance ?? null,
        index,
      })
      continue
    }

    const insufficientLamportsMatch = log.match(/(?:Program log: )?Transfer: insufficient lamports (\d+), need (\d+)/i)
    if (insufficientLamportsMatch) {
      insufficientLamportsLogs.push({
        log,
        programId: frame?.id ?? null,
        frameInstance: frame?.instance ?? null,
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
        error: {
          program: programName(frame?.id ?? null),
          programId: frame?.id ?? null,
          code: Number(anchorMatch[2]),
          name: anchorMatch[1],
          message: anchorMatch[3].replace(/\.$/, ''),
          log,
          evidence: 'observed',
        },
        frameInstance: frame?.instance ?? null,
        index,
      })
    }

    const structuredErrorMatch = log.match(/^(?:Program log: )?Error:\s*([A-Za-z][A-Za-z0-9_]*)\s*$/)
    if (structuredErrorMatch) {
      structuredProgramErrors.push({
        log,
        programId: frame?.id ?? null,
        frameInstance: frame?.instance ?? null,
        index,
        name: structuredErrorMatch[1],
      })
    }

    const programLogMatch = log.match(/^Program log: (.+)$/)
    if (programLogMatch && isDeterministicFailureStatement(programLogMatch[1])) {
      programFailureStatements.push({
        message: programLogMatch[1],
        log,
        programId: frame?.id ?? null,
        frameInstance: frame?.instance ?? null,
        index,
      })
    }

    const successMatch = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) success$/)
    if (successMatch) {
      closeFrame(successMatch[1])
      continue
    }

    const customErrorMatch = log.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) failed: custom program error: (0x[0-9a-f]+)$/i)
    if (!customErrorMatch) continue

    const programId = customErrorMatch[1]
    opaqueProgramErrors.push({
      program: programName(programId),
      programId,
      code: Number.parseInt(customErrorMatch[2], 16),
      name: null,
      message: `Custom program error ${customErrorMatch[2]}`,
      log,
      evidence: 'observed',
      frameInstance: frame?.id === programId ? frame.instance : null,
      index,
    })
    closeFrame(programId)
  }

  function nearbyTechnicalError(programId: string | null, frameInstance: number | null, index: number) {
    return opaqueProgramErrors.find((error) => error.frameInstance === frameInstance && frameInstance != null)
      ?? opaqueProgramErrors.find((error) =>
        error.programId === programId && error.index > index && error.index - index <= 4,
      )
      ?? opaqueProgramErrors.find((error) => {
        return error.index > index && error.index - index <= 4
      })
  }

  function evidenceForFrame(frameInstance: number | null, index: number) {
    return failureInfoLogs
      .filter((evidence) => evidence.frameInstance === frameInstance && evidence.index < index)
      .map(({ label, fields, log }) => ({ label, fields, log, evidence: 'observed' as const }))
  }

  // A quantified failure emitted during the failing instruction is more useful than
  // an opaque custom-error code. It still needs a nearby matching failure record.
  for (const evidence of insufficientLamportsLogs) {
    const technicalError = nearbyTechnicalError(evidence.programId, evidence.frameInstance, evidence.index)

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

  // Program-emitted Error: <Name> logs are structured failure evidence when the
  // same program subsequently returns a custom error. This is semantic and
  // execution-context matching, not a protocol- or code-specific lookup.
  for (const evidence of structuredProgramErrors) {
    const technicalError = nearbyTechnicalError(evidence.programId, evidence.frameInstance, evidence.index)
    if (!technicalError) continue

    return {
      program: technicalError.program,
      programId: technicalError.programId ?? evidence.programId,
      code: null,
      name: evidence.name,
      message: `Error: ${evidence.name}`,
      log: evidence.log,
      evidence: 'observed',
      technicalError,
    }
  }

  for (const candidate of anchorErrors) {
    const technicalError = nearbyTechnicalError(candidate.error.programId, candidate.frameInstance, candidate.index)
    if (!technicalError) continue

    return {
      ...candidate.error,
      structuredEvidence: evidenceForFrame(candidate.frameInstance, candidate.index),
      technicalError,
    }
  }

  // Plain program logs can state a concrete rejection condition without using a
  // framework-specific error shape. Keep them scoped to the frame that later
  // returned the opaque custom error.
  for (const statement of programFailureStatements) {
    const technicalError = nearbyTechnicalError(statement.programId, statement.frameInstance, statement.index)
    if (!technicalError) continue

    return {
      program: technicalError.program,
      programId: technicalError.programId ?? statement.programId,
      code: null,
      name: null,
      message: statement.message,
      log: statement.log,
      evidence: 'observed',
      technicalError,
    }
  }

  return anchorErrors[0]?.error ?? opaqueProgramErrors[0] ?? null
}
