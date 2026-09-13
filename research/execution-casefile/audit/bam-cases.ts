/**
 * SYNTHETIC fixtures for the BAM / preconfirmation adversarial cases.
 *
 * Every record here is invented. None describes a real provider, a real preconfirmation, or a real
 * transaction, and none may appear in a published result, the calibration corpus, or any
 * product-facing surface. Each carries `synthetic: true` / `fixture: true`, which the
 * reconciliation module propagates so a fixture can never be mistaken for evidence.
 *
 * The provider label is a deliberately fictional stand-in. Naming a real product on invented data
 * would misrepresent that product.
 */
import { PRECONFIRMATION_VERSION, type PreconfirmationRecord } from '../preconfirmation.ts'
import { TRACE_VERSION, type AttemptTrace } from '../trace.ts'
import type { Receipt } from '../core.ts'

export const JUP = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
export const SYS = '11111111111111111111111111111111'
export const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
export const PAMM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'

export const SIG_A = '1'.repeat(88)
export const SIG_B = '2'.repeat(88)
export const SIG_C = '3'.repeat(88)

/** A fictional issuer. Not a real product. */
const PROVIDER = 'fixture-sequencer'

const prov = (attestation: PreconfirmationRecord['signature']['provenance']['attestation'], method: PreconfirmationRecord['signature']['provenance']['method'] = 'PROVIDER_API_RESPONSE') =>
  ({ attestation, source: PROVIDER, method })

export function preconfirmation(options: {
  signature?: string
  targetSlot?: number | null
  senderClock?: string | null
  providerClock?: string | null
  senderAt?: string
  providerAt?: string
  level?: string
  proofVerification?: 'NOT_VERIFIED' | 'VERIFIED' | 'VERIFICATION_FAILED'
  attemptId?: string
} = {}): PreconfirmationRecord {
  const record: PreconfirmationRecord = {
    schemaVersion: PRECONFIRMATION_VERSION,
    synthetic: true,
    signature: { value: options.signature ?? SIG_A, provenance: prov('PROVIDER_REPORTED') },
    provider: { label: PROVIDER, productName: 'Fixture Preconfirmation Service', provenance: prov('PROVIDER_REPORTED') },
    assertedLevel: { value: options.level ?? 'preconfirmed', provenance: prov('PROVIDER_REPORTED') },
    unmodelledFields: [],
  }
  if (options.attemptId) record.attemptId = { value: options.attemptId, provenance: prov('CLIENT_OBSERVED', 'LOCAL_MEASUREMENT') }
  if (options.targetSlot != null) record.targetSlot = { value: options.targetSlot, provenance: prov('PROVIDER_REPORTED') }
  if (options.senderClock !== null) {
    record.senderLocalObservedAt = {
      value: options.senderAt ?? '2026-09-13T00:00:00.000Z',
      clockDomain: options.senderClock ?? 'fixture-sender-clock',
      provenance: prov('CLIENT_OBSERVED', 'LOCAL_MEASUREMENT'),
    }
  }
  if (options.providerClock !== null) {
    record.providerObservedAt = {
      value: options.providerAt ?? '2026-09-13T00:00:00.200Z',
      clockDomain: options.providerClock ?? 'fixture-provider-clock',
      provenance: prov('PROVIDER_REPORTED'),
    }
  }
  if (options.proofVerification) {
    record.attestationProof = {
      scheme: 'ed25519',
      signature: 'ZmljdGlvbmFsLXNpZ25hdHVyZS1ieXRlcw==',
      claimedSignerKey: 'FixtureSequencerKey1111111111111111111111111',
      signedPayloadDescription: 'Fixture payload: signature, asserted level and target slot.',
      verification: options.proofVerification,
      verifiedAgainstKey: options.proofVerification === 'VERIFIED' ? 'FixtureSequencerKey1111111111111111111111111' : null,
      provenance: prov(options.proofVerification === 'VERIFIED' ? 'VALIDATOR_ATTESTED' : 'PROVIDER_REPORTED', 'SIGNED_DOCUMENT'),
    }
  }
  return record
}

export function receipt(options: {
  signature?: string
  slot?: number
  logs?: string[]
  err?: unknown
  programIds?: string[]
  writable?: string[]
} = {}): Receipt {
  const writable = options.writable ?? ['PoolAccount11111111111111111111111111111111']
  return {
    slot: options.slot ?? 5000,
    blockTime: 1789000000,
    meta: { err: options.err ?? null, fee: 5000, computeUnitsConsumed: 42000, logMessages: options.logs ?? [`Program ${JUP} invoke [1]`, `Program ${JUP} success`] },
    transaction: {
      signatures: [options.signature ?? SIG_A],
      message: {
        accountKeys: [
          { pubkey: 'FixtureSigner1111111111111111111111111111111', signer: true, writable: true },
          ...writable.map((pubkey) => ({ pubkey, signer: false, writable: true })),
        ],
        instructions: (options.programIds ?? [JUP]).map((programId) => ({ programId })),
      },
    },
  } as Receipt
}

/** An attempt that rebuilt its message: SIG_A was replaced by SIG_B, and SIG_B landed. */
export function rebuiltTrace(): AttemptTrace {
  const at = (elapsedMs: number, event: AttemptTrace['events'][number]['event']) => ({
    sequence: 0, elapsedMs, observedAt: new Date(Date.UTC(2026, 8, 13) + elapsedMs).toISOString(), event,
  })
  const events = [
    at(0, { type: 'MESSAGE_BUILT', revisionId: 'r1', messageHash: 'a'.repeat(64), lastValidBlockHeight: 100 }),
    at(10, { type: 'SIGNED', revisionId: 'r1', signature: SIG_A }),
    at(20, { type: 'SEND_STARTED', revisionId: 'r1', sendId: 's1', providerLabel: PROVIDER }),
    at(60, { type: 'SEND_RESPONSE', sendId: 's1', response: 'ACKNOWLEDGED' }),
    at(900, { type: 'EXPIRY_OBSERVED', revisionId: 'r1', observedBlockHeight: 101 }),
    at(910, { type: 'MESSAGE_BUILT', revisionId: 'r2', replacesRevisionId: 'r1', messageHash: 'b'.repeat(64), lastValidBlockHeight: 250 }),
    at(920, { type: 'SIGNED', revisionId: 'r2', signature: SIG_B }),
    at(930, { type: 'SEND_STARTED', revisionId: 'r2', sendId: 's2', providerLabel: PROVIDER }),
    at(980, { type: 'SEND_RESPONSE', sendId: 's2', response: 'ACKNOWLEDGED' }),
  ].map((entry, index) => ({ ...entry, sequence: index }))
  return { schemaVersion: TRACE_VERSION, attemptId: 'fixture-attempt', clockDomain: 'fixture-sender-clock', evidenceSource: 'APPLICATION_OBSERVED', fixture: true, captureIssues: [], events } as AttemptTrace
}

/** A failed atomic transaction whose inner Token frame logged success before the outer rejection. */
export const FAILED_WITH_SUCCESSFUL_CPI = [
  `Program ${JUP} invoke [1]`, 'Program log: Instruction: Route',
  `Program ${TOKEN} invoke [2]`, 'Program log: Instruction: Transfer', `Program ${TOKEN} success`,
  `Program ${PAMM} invoke [2]`, `Program ${PAMM} success`,
  'Program log: Error: SlippageToleranceExceeded',
  `Program ${JUP} failed: custom program error: 0x1771`,
]
