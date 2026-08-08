import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFailedReceiptShareText,
  COMPUTE_BUDGET_PROGRAM_ID,
  JUPITER_PROGRAM_ID,
  calculateHistoricalPressureScore,
  collectComputeBudget,
  contextualPressureSentence,
  deriveExecutionState,
  derivePriorityFeeLamports,
  documentedErrorHeadline,
  failedReceiptFutureText,
  failedReceiptUnknowns,
  findExplicitProgramError,
  type ReceiptRpcInstruction,
  type ReceiptRpcTransaction,
} from '../lib/receipt-evidence.ts'

function encodeBase58(bytes: number[]) {
  let value = 0n
  for (const byte of bytes) value = (value << 8n) + BigInt(byte)

  let encoded = ''
  while (value > 0n) {
    const remainder = Number(value % 58n)
    encoded = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[remainder] + encoded
    value /= 58n
  }

  const leadingZeroes = bytes.findIndex((byte) => byte !== 0)
  return `${'1'.repeat(leadingZeroes < 0 ? bytes.length : leadingZeroes)}${encoded || '1'}`
}

function uint32Bytes(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
}

function uint64Bytes(value: number) {
  let remaining = BigInt(value)
  const bytes: number[] = []

  for (let index = 0; index < 8; index += 1) {
    bytes.push(Number(remaining & 0xffn))
    remaining >>= 8n
  }

  return bytes
}

function computeBudgetInstruction(discriminator: number, data: number[]): ReceiptRpcInstruction {
  return {
    programId: COMPUTE_BUDGET_PROGRAM_ID,
    data: encodeBase58([discriminator, ...data]),
  }
}

function receiptTransaction(instructions: ReceiptRpcInstruction[], meta: ReceiptRpcTransaction['meta'] = null): ReceiptRpcTransaction {
  return {
    slot: 288_721_175,
    meta,
    transaction: {
      message: { instructions },
      signatures: ['signature'],
    },
  }
}

test('Compute Budget discriminator 2 is the observed CU limit', () => {
  const budget = collectComputeBudget(receiptTransaction([
    computeBudgetInstruction(2, uint32Bytes(589_132)),
  ]))

  assert.equal(budget.computeUnitLimit, 589_132)
  assert.equal(budget.computeUnitPriceMicroLamports, null)
  assert.equal(budget.computeUnitPriceStatus, 'omitted')
})

test('Compute Budget discriminator 3 is the observed CU price', () => {
  const budget = collectComputeBudget(receiptTransaction([
    computeBudgetInstruction(3, uint64Bytes(17_112)),
  ]))

  assert.equal(budget.computeUnitLimit, null)
  assert.equal(budget.computeUnitPriceMicroLamports, 17_112)
  assert.equal(budget.computeUnitPriceStatus, 'set')
})

test('Compute Budget discriminator 4 is not parsed as a CU limit or price', () => {
  const budget = collectComputeBudget(receiptTransaction([
    computeBudgetInstruction(4, uint32Bytes(123_456)),
  ]))

  assert.equal(budget.computeUnitLimit, null)
  assert.equal(budget.computeUnitPriceMicroLamports, null)
  assert.equal(budget.computeUnitPriceStatus, 'omitted')
})

test('Case #001 derives a 10,082 lamport priority fee from observed Compute Budget values', () => {
  const tx = receiptTransaction([
    computeBudgetInstruction(2, uint32Bytes(589_132)),
    computeBudgetInstruction(3, uint64Bytes(17_112)),
  ], {
    fee: 15_082,
    computeUnitsConsumed: 512_916,
  })

  const priorityFee = derivePriorityFeeLamports(tx, collectComputeBudget(tx))

  assert.equal(priorityFee.amountLamports, 10_082)
  assert.equal(priorityFee.derivation?.evidence, 'derived')
  assert.equal(priorityFee.derivation?.feeResidualLamports, 10_082)
  assert.equal(
    priorityFee.derivation?.formula,
    'ceil(589,132 CU x 17,112 micro-lamports/CU / 1,000,000) = 10,082 lamports',
  )
})

test('a transaction with a slot and meta.err is landed but failed', () => {
  const state = deriveExecutionState(receiptTransaction([], { err: { InstructionError: [6, { Custom: 6001 }] } }))
  assert.equal(state, 'landed-but-failed')
})

test('Jupiter error 6001 takes narrative precedence over every heuristic', () => {
  const tx = receiptTransaction([], {
    err: { InstructionError: [6, { Custom: 6001 }] },
    logMessages: [
      `Program ${JUPITER_PROGRAM_ID} invoke [1]`,
      'Program log: AnchorError thrown in programs/jupiter/src/lib.rs:337. Error Code: SlippageToleranceExceeded. Error Number: 6001. Error Message: Slippage tolerance exceeded.',
    ],
  })
  const executionError = findExplicitProgramError(tx, (programId) => programId)
  const headline = documentedErrorHeadline({
    executionState: deriveExecutionState(tx),
    slot: tx.slot,
    executionError,
  })

  assert.equal(executionError?.program, 'Jupiter')
  assert.equal(executionError?.code, 6001)
  assert.equal(headline, "This transaction landed but failed because Jupiter's slippage tolerance was exceeded.")
})

test('Case #002 promotes the observed insufficient-lamports log over System Program error 0x1', () => {
  const systemProgramId = '11111111111111111111111111111111'
  const tx = receiptTransaction([], {
    err: { InstructionError: [1, { Custom: 1 }] },
    logMessages: [
      `Program ${systemProgramId} invoke [2]`,
      'Program log: Transfer: insufficient lamports 895600, need 2039280',
      `Program ${systemProgramId} failed: custom program error: 0x1`,
    ],
  })
  const executionError = findExplicitProgramError(tx, (programId) =>
    programId === systemProgramId ? 'System Program' : programId,
  )
  const headline = documentedErrorHeadline({
    executionState: deriveExecutionState(tx),
    slot: tx.slot,
    executionError,
  })
  const unknowns = failedReceiptUnknowns({
    executionState: deriveExecutionState(tx),
    executionError,
  })
  const futureText = failedReceiptFutureText(executionError)

  assert.equal(executionError?.program, 'System Program')
  assert.equal(executionError?.name, 'InsufficientLamports')
  assert.equal(executionError?.message, 'Transfer: insufficient lamports 895,600, need 2,039,280')
  assert.deepEqual(executionError?.quantities, { availableLamports: 895_600, requiredLamports: 2_039_280 })
  assert.equal(executionError?.evidence, 'observed')
  assert.equal(executionError?.technicalError?.code, 1)
  assert.equal(executionError?.technicalError?.message, 'Custom program error 0x1')
  assert.equal(executionError?.technicalError?.evidence, 'observed')
  assert.equal(
    headline,
    'This transaction landed but failed because a System Program transfer required 2,039,280 lamports while only 895,600 were available.',
  )
  assert.equal(unknowns, null)
  assert.equal(futureText, 'Before retrying, make sure the transfer source has enough lamports for the required amount.')
  assert.doesNotMatch(`${headline} ${futureText}`, /price|route|slippage|swap|congestion|mev|contention|priority fee/i)
})

test('Case #003 promotes a structured InvalidStatus log over opaque custom error 0x16', () => {
  const raydiumAmmV4ProgramId = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'
  const tx = receiptTransaction([], {
    err: { InstructionError: [7, { Custom: 22 }] },
    logMessages: [
      `Program ${raydiumAmmV4ProgramId} invoke [1]`,
      'Program log: Error: InvalidStatus',
      `Program ${raydiumAmmV4ProgramId} consumed 12734 of 1364002 compute units`,
      `Program ${raydiumAmmV4ProgramId} failed: custom program error: 0x16`,
    ],
  })
  const executionError = findExplicitProgramError(tx, (programId) =>
    programId === raydiumAmmV4ProgramId ? 'Raydium AMM v4' : 'Unknown Program',
  )
  const headline = documentedErrorHeadline({
    executionState: deriveExecutionState(tx),
    slot: tx.slot,
    executionError,
  })
  const unknowns = failedReceiptUnknowns({
    executionState: deriveExecutionState(tx),
    executionError,
  })
  const futureText = failedReceiptFutureText(executionError)

  assert.equal(executionError?.program, 'Raydium AMM v4')
  assert.equal(executionError?.name, 'InvalidStatus')
  assert.equal(executionError?.message, 'Error: InvalidStatus')
  assert.equal(executionError?.evidence, 'observed')
  assert.equal(executionError?.technicalError?.code, 22)
  assert.equal(executionError?.technicalError?.message, 'Custom program error 0x16')
  assert.equal(
    headline,
    'This transaction landed but failed because the failing program reported InvalidStatus.',
  )
  assert.equal(
    unknowns,
    'The transaction establishes that the program rejected the instruction because its state was invalid, but this receipt has not established which state condition caused InvalidStatus.',
  )
  assert.equal(
    futureText,
    'Before retrying, inspect the program state that produced InvalidStatus. This receipt does not establish which state condition was invalid.',
  )
  assert.doesNotMatch(`${headline} ${unknowns} ${futureText}`, /pool|opening time|congestion|mev|contention|priority fee/i)
})

test('Case #001 unknowns and future guidance remain specific to Jupiter error 6001', () => {
  const tx = receiptTransaction([], {
    err: { InstructionError: [6, { Custom: 6001 }] },
    logMessages: [
      `Program ${JUPITER_PROGRAM_ID} invoke [1]`,
      'Program log: AnchorError thrown in programs/jupiter/src/lib.rs:337. Error Code: SlippageToleranceExceeded. Error Number: 6001. Error Message: Slippage tolerance exceeded.',
    ],
  })
  const executionError = findExplicitProgramError(tx, (programId) => programId)

  assert.equal(
    failedReceiptUnknowns({ executionState: deriveExecutionState(tx), executionError }),
    "This receipt cannot determine whether price moved, Jupiter's route state changed, or execution timing altered the outcome. It only establishes that the transaction landed and Jupiter returned error 6001 (SlippageToleranceExceeded).",
  )
  assert.equal(
    failedReceiptFutureText(executionError),
    'Before retrying, inspect the documented program error and route parameters. Slot pressure can be useful context, but this receipt does not establish it as the cause.',
  )
})

test('Case #001 and Case #002 share text lead with documented failure evidence', () => {
  const systemProgramId = '11111111111111111111111111111111'
  const caseOne = receiptTransaction([], {
    err: { InstructionError: [6, { Custom: 6001 }] },
    logMessages: [
      `Program ${JUPITER_PROGRAM_ID} invoke [1]`,
      'Program log: AnchorError thrown in programs/jupiter/src/lib.rs:337. Error Code: SlippageToleranceExceeded. Error Number: 6001. Error Message: Slippage tolerance exceeded.',
    ],
  })
  const caseTwo = receiptTransaction([], {
    err: { InstructionError: [1, { Custom: 1 }] },
    logMessages: [
      `Program ${systemProgramId} invoke [2]`,
      'Program log: Transfer: insufficient lamports 895600, need 2039280',
      `Program ${systemProgramId} failed: custom program error: 0x1`,
    ],
  })
  const caseOneError = findExplicitProgramError(caseOne, (programId) => programId)
  const caseTwoError = findExplicitProgramError(caseTwo, (programId) =>
    programId === systemProgramId ? 'System Program' : programId,
  )
  const context = {
    label: 'moderate',
    confidence: 'inferred' as const,
    basis: ['landed slot carried 1415 signatures'],
  }

  assert.ok(caseOneError)
  assert.ok(caseTwoError)

  const caseOneShare = buildFailedReceiptShareText({
    shortSignature: 'case001',
    slot: caseOne.slot,
    executionError: caseOneError,
    feePaidLamports: 15_082,
    priorityFeeDerivation: null,
    slotPressure: context,
  })
  const caseTwoShare = buildFailedReceiptShareText({
    shortSignature: 'case002',
    slot: caseTwo.slot,
    executionError: caseTwoError,
    feePaidLamports: 5_000,
    priorityFeeDerivation: null,
    slotPressure: context,
  })

  assert.ok(caseOneShare.startsWith("This transaction landed but failed because Jupiter's slippage tolerance was exceeded."))
  assert.ok(caseTwoShare.startsWith('This transaction landed but failed because a System Program transfer required 2,039,280 lamports while only 895,600 were available.'))

  for (const shareText of [caseOneShare, caseTwoShare]) {
    assert.doesNotMatch(shareText, /inclusion\/?mev|inclusion symptoms|symptom badge/i)
    assert.match(shareText, /context only/i)
    assert.match(shareText, /not a documented cause|not asserted as the cause/i)
  }
})

test('slot pressure stays contextual and is never stated as the failure cause', () => {
  const sentence = contextualPressureSentence('moderate', [
    'landed slot carried 1415 signatures',
    'many writable accounts',
  ])

  assert.match(sentence, /contextual/i)
  assert.match(sentence, /not a documented cause/i)
  assert.doesNotMatch(sentence, /caused the failure|because of slot pressure/i)
})

test('a historical receipt pressure score is stable without live performance samples', () => {
  const caseOneInputs = {
    slotSignatureCount: 1_415,
    computeUnitsConsumed: 512_916,
    programsTouched: 10,
    writableAccounts: 38,
  }

  assert.equal(calculateHistoricalPressureScore(caseOneInputs), 50)
  assert.equal(calculateHistoricalPressureScore({ ...caseOneInputs }), 50)
})
