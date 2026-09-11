/**
 * Adversarial semantic audit corpus for X-Ray v1.2.0.
 *
 * Every fixture here is SYNTHETIC and constructed to stress one specific way that execution
 * reach, execution success, transaction outcome and state commitment could be confused. None of
 * these is a real signature, none was collected, and none may be presented as chain evidence or
 * added to the calibration corpus.
 */
import type { Receipt } from '../core.ts'

export const JUP = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
export const SYS = '11111111111111111111111111111111'
export const CB = 'ComputeBudget111111111111111111111111111111'
export const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
export const PAMM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'
/** Stand-ins for ZKP-root-bearing markets. Not real programs. */
export const ROOT_A = 'zkRootAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
export const ROOT_B = 'zkRootBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function tx(programIds: string[], logs: string[], err: unknown, signature = '5'.repeat(88)): Receipt {
  return {
    slot: 1000,
    meta: { err, fee: 5000, computeUnitsConsumed: 40000, logMessages: logs },
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [
          { pubkey: 'Signer1111111111111111111111111111111111111', signer: true, writable: true },
          { pubkey: 'Pool11111111111111111111111111111111111111', signer: false, writable: true },
        ],
        instructions: programIds.map((programId) => ({ programId })),
      },
    },
  }
}

export type AuditCase = {
  id: string
  label: string
  question: string
  receipt: Receipt
  /** Set when the model is expected to refuse the input outright. */
  expectRejection?: RegExp
}

export const auditCases: AuditCase[] = [
  {
    id: 'success-multi',
    label: 'Successful multi-instruction transaction',
    question: 'Does a success read as one commitment rather than several independent ones?',
    receipt: tx([CB, PAMM, JUP], [
      `Program ${PAMM} invoke [1]`, 'Program log: Instruction: Swap', `Program ${PAMM} success`,
      `Program ${JUP} invoke [1]`, 'Program log: Instruction: Route', `Program ${JUP} success`,
    ], null, '1'.repeat(88)),
  },
  {
    id: 'early-failure',
    label: 'Early failure at the first outer instruction',
    question: 'With nothing executed before it, is the absence of commitment still stated?',
    receipt: tx([JUP, PAMM], [
      `Program ${JUP} invoke [1]`, 'Program log: Instruction: Route',
      `Program ${JUP} failed: custom program error: 0x1771`,
    ], { InstructionError: [0, { Custom: 6001 }] }, '2'.repeat(88)),
  },
  {
    id: 'deep-cpi-failure',
    label: 'Deep CPI failure after several successful frames',
    question: 'Do four frames logging success before a depth-3 rejection imply four committed legs?',
    receipt: tx([CB, JUP], [
      `Program ${JUP} invoke [1]`, 'Program log: Instruction: Route',
      `Program ${PAMM} invoke [2]`, 'Program log: Instruction: Swap', `Program ${PAMM} success`,
      `Program ${TOKEN} invoke [2]`, 'Program log: Instruction: Transfer', `Program ${TOKEN} success`,
      `Program ${PAMM} invoke [2]`, 'Program log: Instruction: Swap',
      `Program ${SYS} invoke [3]`, 'Transfer: insufficient lamports 2, need 10',
      `Program ${SYS} failed: custom program error: 0x1`,
      `Program ${PAMM} failed: custom program error: 0x1`,
      `Program ${JUP} failed: custom program error: 0x1`,
    ], { InstructionError: [1, { Custom: 1 }] }, '3'.repeat(88)),
  },
  {
    id: 'child-success-parent-fails',
    label: 'Child logs success, parent later fails',
    question: 'Does a frame that returned success inside a failed transaction read as a kept result?',
    receipt: tx([JUP], [
      `Program ${JUP} invoke [1]`, 'Program log: Instruction: Route',
      `Program ${TOKEN} invoke [2]`, 'Program log: Instruction: Transfer', `Program ${TOKEN} success`,
      'Program log: Error: SlippageToleranceExceeded',
      `Program ${JUP} failed: custom program error: 0x1771`,
    ], { InstructionError: [0, { Custom: 6001 }] }, '4'.repeat(88)),
  },
  {
    id: 'sibling-cpis-one-fails',
    label: 'Several sibling CPIs, one fails',
    question: 'Do the sibling CPIs that succeeded read as partially applied?',
    receipt: tx([JUP], [
      `Program ${JUP} invoke [1]`, 'Program log: Instruction: Route',
      `Program ${PAMM} invoke [2]`, `Program ${PAMM} success`,
      `Program ${TOKEN} invoke [2]`, `Program ${TOKEN} success`,
      `Program ${ROOT_A} invoke [2]`, `Program ${ROOT_A} failed: custom program error: 0x2`,
      `Program ${JUP} failed: custom program error: 0x2`,
    ], { InstructionError: [0, { Custom: 2 }] }, '6'.repeat(88)),
  },
  {
    id: 'later-outers-not-reached',
    label: 'Later outer instructions never reached',
    question: 'Are reached-and-rolled-back and never-executed kept distinct without implying either committed?',
    receipt: tx([CB, PAMM, JUP, TOKEN], [
      `Program ${PAMM} invoke [1]`, `Program ${PAMM} success`,
      `Program ${JUP} invoke [1]`, `Program ${JUP} failed: custom program error: 0x3`,
    ], { InstructionError: [2, { Custom: 3 }] }, '7'.repeat(88)),
  },
  {
    id: 'truncated-logs',
    label: 'Missing / truncated logs',
    question: 'With attribution unknown, does any surface still assert reach or commitment?',
    receipt: tx([JUP, PAMM], [
      `Program ${JUP} invoke [1]`, 'Program log: Instruction: Route', 'Log truncated',
    ], { InstructionError: [0, { Custom: 9 }] }, '8'.repeat(88)),
  },
  {
    id: 'v1-unsupported',
    label: 'Unsupported transaction v1',
    question: 'Does v1 fail closed naming cross-root commitment, not just resource configuration?',
    receipt: { ...tx([JUP], [], null, '9'.repeat(88)), version: 1 } as Receipt,
    expectRejection: /state-root transitions it may commit atomically/,
  },
  {
    id: 'multi-root-atomic-synthetic',
    label: 'SYNTHETIC hypothetical multi-root atomic transaction',
    question: 'Routing through two root-bearing markets: is per-root commitment implied anywhere?',
    receipt: tx([CB, ROOT_A, ROOT_B], [
      `Program ${ROOT_A} invoke [1]`, 'Program log: Instruction: ApplyRootTransition', `Program ${ROOT_A} success`,
      `Program ${ROOT_B} invoke [1]`, 'Program log: Instruction: ApplyRootTransition',
      'Program log: Error: RootMismatch',
      `Program ${ROOT_B} failed: custom program error: 0x7`,
    ], { InstructionError: [2, { Custom: 7 }] }, 'A'.repeat(88)),
  },
]
