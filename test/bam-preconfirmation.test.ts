import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcile } from '../research/execution-casefile/reconciliation.ts'
import { PRECONFIRMATION_VERSION, durationBetween, effectiveAttestation, validatePreconfirmation } from '../research/execution-casefile/preconfirmation.ts'
import { EVIDENCE_MATRIX, layer } from '../research/execution-casefile/evidence-matrix.ts'
import {
  FAILED_WITH_SUCCESSFUL_CPI, JUP, PAMM, SIG_A, SIG_B, SIG_C,
  preconfirmation, receipt, rebuiltTrace,
} from '../research/execution-casefile/audit/bam-cases.ts'

const ERR = { InstructionError: [0, { Custom: 6001 }] }

test('preconfirmed then landed successfully: identity matches and commitment is stated', () => {
  const result = reconcile({
    preconfirmation: preconfirmation({ targetSlot: 5000 }),
    receipt: receipt({ slot: 5000 }),
    receiptCommitment: 'finalized',
  })
  assert.equal(result.identity.match, 'MATCHED')
  assert.equal(result.execution!.outcome, 'LANDED_SUCCESS')
  assert.equal(result.execution!.stateCommitment.outcome, 'ALL_COMMITTED')
  assert.equal(result.execution!.finality, 'FINALIZED')
  // A matching preconfirmation never becomes evidence that it caused the outcome.
  assert.ok(result.limitations.some((line) => /does not prove the statement caused the outcome/i.test(line)))
  assert.equal(result.discrepancies.some((d) => d.code === 'SLOT_ASSERTION_NOT_MET'), false)
})

test('preconfirmed then failed execution: the promise held, the transaction still committed nothing', () => {
  const result = reconcile({
    preconfirmation: preconfirmation({ targetSlot: 5000 }),
    receipt: receipt({ slot: 5000, err: ERR, logs: FAILED_WITH_SUCCESSFUL_CPI }),
    receiptCommitment: 'finalized',
  })
  assert.equal(result.identity.match, 'MATCHED')
  assert.equal(result.execution!.outcome, 'LANDED_FAILED')
  assert.equal(result.execution!.stateCommitment.outcome, 'NONE_COMMITTED')
  // Inclusion was delivered; execution still failed. Neither fact contradicts the other.
  assert.equal(result.discrepancies.some((d) => d.code === 'IDENTITY_UNMATCHED'), false)
})

test('successful CPI frame inside a failed atomic tx commits nothing', () => {
  const result = reconcile({ receipt: receipt({ err: ERR, logs: FAILED_WITH_SUCCESSFUL_CPI }), receiptCommitment: 'finalized' })
  assert.equal(result.execution!.stateCommitment.outcome, 'NONE_COMMITTED')
  assert.ok(result.execution!.reach.framesObserved >= 3, 'inner frames were observed')
  assert.match(result.execution!.reach.boundary, /does not establish provider fault/i)
  assert.match(result.execution!.stateCommitment.statement, /committed nothing/i)
})

test('preconfirmed but no landed receipt is unresolved, never a broken promise', () => {
  const result = reconcile({ preconfirmation: preconfirmation({ targetSlot: 5000 }) })
  assert.equal(result.identity.match, 'RECEIPT_NOT_SUPPLIED')
  const unresolved = result.discrepancies.find((d) => d.code === 'PRECONFIRMATION_UNRESOLVED')
  assert.ok(unresolved)
  assert.match(unresolved.boundary, /Unresolved, not broken/i)
  assert.match(unresolved.boundary, /not evidence the transaction failed to land/i)
  assert.equal(result.execution, null)
})

test('rebuilt signatures: the preconfirmation is tied to a superseded revision, not substituted', () => {
  const result = reconcile({
    preconfirmation: preconfirmation({ signature: SIG_A }),
    attemptTrace: rebuiltTrace(),
    receipt: receipt({ signature: SIG_B }),
    receiptCommitment: 'finalized',
  })
  assert.equal(result.identity.match, 'MATCHED_VIA_REBUILT_REVISION')
  const found = result.discrepancies.find((d) => d.code === 'PRECONFIRMATION_FOR_SUPERSEDED_REVISION')
  assert.ok(found)
  assert.match(found.boundary, /not a failure by the issuer/i)
  assert.equal(result.attemptSummary!.revisions, 2)
  assert.equal(result.attemptSummary!.sends, 2)
})

test('stale or mismatched preconfirmation without a linking trace stays unmatched', () => {
  const result = reconcile({
    preconfirmation: preconfirmation({ signature: SIG_C, targetSlot: 4000 }),
    receipt: receipt({ signature: SIG_A, slot: 5000 }),
    receiptCommitment: 'finalized',
  })
  assert.equal(result.identity.match, 'UNMATCHED')
  const unmatched = result.discrepancies.find((d) => d.code === 'IDENTITY_UNMATCHED')
  assert.match(unmatched!.boundary, /two unrelated records, not evidence that anything was substituted/i)
  const slot = result.discrepancies.find((d) => d.code === 'SLOT_ASSERTION_NOT_MET')
  assert.match(slot!.boundary, /Nothing here establishes why/i)
})

test('missing timestamps degrade to unavailable rather than being inferred', () => {
  const result = reconcile({
    preconfirmation: preconfirmation({ senderClock: null, providerClock: null }),
    receipt: receipt(),
    receiptCommitment: 'finalized',
  })
  assert.equal(result.timing.senderLocalObservedAt, null)
  assert.equal(result.timing.providerObservedAt, null)
  assert.equal(result.timing.senderToProviderDuration, null)
  assert.equal(result.timing.distinctClockDomainCount, 0)
})

test('clock-domain mismatch refuses a duration instead of computing one', () => {
  const result = reconcile({
    preconfirmation: preconfirmation({ senderClock: 'sender-a', providerClock: 'provider-b' }),
    receipt: receipt(),
    receiptCommitment: 'finalized',
  })
  const duration = result.timing.senderToProviderDuration!
  assert.equal(duration.comparable, false)
  assert.equal(duration.ms, null)
  assert.match(duration.reason, /different clock domains/i)
  assert.ok(result.discrepancies.some((d) => d.code === 'MULTIPLE_CLOCK_DOMAINS'))
  assert.match(result.timing.boundary, /No duration here measures network latency, provider delay, or leader ingress/i)
})

test('same-domain readings do produce a duration, and it is still not a latency claim', () => {
  const same = durationBetween(
    { value: '2026-09-13T00:00:00.000Z', clockDomain: 'one-clock' },
    { value: '2026-09-13T00:00:00.250Z', clockDomain: 'one-clock' },
  )
  assert.equal(same.comparable, true)
  assert.equal(same.ms, 250)
})

test('shared writable accounts alone never become contention', () => {
  const shared = ['PoolAccount11111111111111111111111111111111']
  const result = reconcile({
    receipt: receipt({ err: ERR, logs: FAILED_WITH_SUCCESSFUL_CPI, writable: shared, programIds: [JUP, PAMM] }),
    receiptCommitment: 'finalized',
  })
  const serialized = JSON.stringify(result)
  assert.equal(/\bcontention\b/i.test(serialized) && !/does not|cannot|never|whether/i.test(serialized), false)
  assert.ok(result.unknowable.some((line) => /contended/i.test(line)),
    'contention must be listed as unknowable')
})

test('an unverified attestation never reaches VALIDATOR_ATTESTED', () => {
  const unverified = validatePreconfirmation(preconfirmation({ proofVerification: 'NOT_VERIFIED' }))
  assert.equal(effectiveAttestation(unverified), 'PROVIDER_REPORTED')

  const verified = validatePreconfirmation(preconfirmation({ proofVerification: 'VERIFIED' }))
  assert.equal(effectiveAttestation(verified), 'VALIDATOR_ATTESTED')

  const failed = validatePreconfirmation(preconfirmation({ proofVerification: 'VERIFICATION_FAILED' }))
  assert.equal(effectiveAttestation(failed), 'PROVIDER_REPORTED')

  const result = reconcile({ preconfirmation: preconfirmation({ proofVerification: 'NOT_VERIFIED' }), receipt: receipt() })
  const flagged = result.discrepancies.find((d) => d.code === 'ATTESTATION_UNVERIFIED')
  assert.match(flagged!.boundary, /carries no more weight than the provider's unsigned word/i)
})

test('pre-inclusion evidence may not claim CHAIN_PROVEN, and VALIDATOR_ATTESTED needs a verified key', () => {
  const chainClaim = preconfirmation()
  chainClaim.signature.provenance.attestation = 'CHAIN_PROVEN'
  assert.throws(() => validatePreconfirmation(chainClaim), /cannot be CHAIN_PROVEN/i)

  const bogus = preconfirmation()
  bogus.assertedLevel.provenance.attestation = 'VALIDATOR_ATTESTED'
  assert.throws(() => validatePreconfirmation(bogus), /requires an attestationProof/i)
})

test('a shared clock domain across sender and provider must be explained', () => {
  const collapsed = preconfirmation({ senderClock: 'same-clock', providerClock: 'same-clock' })
  assert.throws(() => validatePreconfirmation(collapsed), /share a clock domain without explanation/i)

  collapsed.senderLocalObservedAt!.provenance.note = 'Sender and provider are the same process in this fixture.'
  assert.equal(validatePreconfirmation(collapsed).schemaVersion, PRECONFIRMATION_VERSION)
})

test('synthetic inputs mark the whole reconciliation synthetic', () => {
  const result = reconcile({ preconfirmation: preconfirmation(), attemptTrace: rebuiltTrace(), receipt: receipt() })
  assert.equal(result.synthetic, true)
  assert.match(result.syntheticReason!, /must not be presented as product evidence/i)

  const realOnly = reconcile({ receipt: receipt(), receiptCommitment: 'finalized' })
  assert.equal(realOnly.synthetic, false)
  assert.equal(realOnly.syntheticReason, null)
})

test('the evidence matrix covers five layers and no layer over-claims', () => {
  assert.equal(EVIDENCE_MATRIX.length, 5)
  assert.equal(layer('PRECONFIRMATION').ceiling, 'VALIDATOR_ATTESTED')
  assert.equal(layer('SIMULATION').ceiling, 'CLIENT_OBSERVED')
  assert.equal(layer('SENDER_TRACE').ceiling, 'CLIENT_OBSERVED')
  // Only the chain layers may be CHAIN_PROVEN.
  for (const entry of EVIDENCE_MATRIX) {
    if (entry.ceiling === 'CHAIN_PROVEN') assert.ok(['LANDED_RECEIPT', 'FINALIZED_OUTCOME'].includes(entry.id))
    assert.ok(entry.canProve.length > 0 && entry.cannotProve.length > 0 && entry.supersededBy.length > 0)
  }
  // The receipt layer must refuse ingress, ordering and lateness.
  const receiptLayer = layer('LANDED_RECEIPT').cannotProve.join(' ')
  assert.match(receiptLayer, /when any leader received it/i)
  assert.match(receiptLayer, /position in any scheduler/i)
  assert.match(receiptLayer, /late/i)
})
