import { buildCaseFile, type CaseFile, type Receipt } from './core.ts'
import { describeAttribution, effectiveAttestation, durationBetween, validatePreconfirmation, type PreconfirmationRecord } from './preconfirmation.ts'
import { evidenceLabel, pathFor, unknownStageCount } from './preconfirmation-map.ts'
import { summarizeTrace, validateTrace, type AttemptTrace, type TracePayload } from './trace.ts'

/**
 * Offline reconciliation of pre-inclusion evidence against what the ledger actually recorded.
 *
 * Pure and local: no RPC, no network, no clock of its own. It compares what was promised with what
 * happened and, just as importantly, enumerates what the combination still cannot answer.
 */
export const RECONCILIATION_VERSION = 'breadlines-reconciliation-v1' as const

/**
 * How a preconfirmation stands against the ledger.
 *
 *  PENDING    — no receipt yet, and the issuer's own deadline has not passed. Still in flight.
 *  MATCHED    — a receipt was found for the message the preconfirmation named.
 *  UNRESOLVED — no receipt, and nothing establishes what that means. The default.
 *  MISMATCH   — the evidence establishes a contradiction. Reserved, and rare: it requires a
 *               VERIFIED commitment and chain evidence contradicting it. A slot that differs from
 *               an unverified assertion is a discrepancy, not a contradiction.
 */
export type ReconciliationState = 'PENDING' | 'MATCHED' | 'UNRESOLVED' | 'MISMATCH'

export type IdentityMatch =
  | 'MATCHED'
  | 'MATCHED_VIA_REBUILT_REVISION'
  | 'UNMATCHED'
  | 'PRECONFIRMATION_NOT_SUPPLIED'
  | 'RECEIPT_NOT_SUPPLIED'

export type ReconciliationInput = {
  preconfirmation?: unknown
  attemptTrace?: unknown
  /** The landed receipt. Absent when a preconfirmation never resolved to one. */
  receipt?: Receipt
  receiptProvenance?: { source: string; sha256: string | null }
  /** Commitment at which the receipt was READ. A processed read can still be reorganised. */
  receiptCommitment?: 'processed' | 'confirmed' | 'finalized'
}

const UNKNOWABLE = [
  'When the transaction was submitted, and when any leader received it.',
  'The transaction\'s position in any scheduler or queue, relative to any other transaction.',
  'Whether any provider delayed, dropped, reordered, or deprioritised it.',
  'Whether a different fee, route, provider or reservation would have changed the outcome.',
  'Whether nearby transactions sharing writable accounts contended with this one.',
  'Whether the issuer of a preconfirmation had the ability to keep it.',
]

export function reconcile(input: ReconciliationInput) {
  const preconfirmation: PreconfirmationRecord | null = input.preconfirmation == null
    ? null : validatePreconfirmation(input.preconfirmation)
  const trace: AttemptTrace | null = input.attemptTrace == null
    ? null : validateTrace(input.attemptTrace)
  const caseFile: CaseFile | null = input.receipt == null ? null : buildCaseFile(
    input.receipt,
    input.receiptProvenance ?? { source: 'Supplied receipt (origin unverified)', sha256: null },
  )

  // Any synthetic component makes the whole reconciliation synthetic. A fixture preconfirmation
  // beside a real receipt is still a fixture result and may never be shown as product evidence.
  const synthetic = Boolean(preconfirmation?.synthetic) || Boolean(trace?.fixture)

  // --- identity -------------------------------------------------------------------------------
  const traceSignatures = new Set(
    (trace?.events ?? [])
      .map((entry) => entry.event)
      .filter((event): event is Extract<TracePayload, { type: 'SIGNED' }> => event.type === 'SIGNED')
      .map((event) => event.signature),
  )
  const preSignature = preconfirmation?.signature.value ?? null
  const receiptSignature = caseFile?.signature ?? null

  let identity: IdentityMatch
  if (!preconfirmation) identity = 'PRECONFIRMATION_NOT_SUPPLIED'
  else if (!caseFile) identity = 'RECEIPT_NOT_SUPPLIED'
  else if (preSignature === receiptSignature) identity = 'MATCHED'
  else if (preSignature && receiptSignature && traceSignatures.has(preSignature) && traceSignatures.has(receiptSignature)) {
    // Both signatures belong to the same attempt: the preconfirmation names a revision the sender
    // later replaced. The promise was about a message that is not the one that landed.
    identity = 'MATCHED_VIA_REBUILT_REVISION'
  } else identity = 'UNMATCHED'

  // --- timing availability (never cross-domain arithmetic) ------------------------------------
  const clockDomains = [...new Set([
    preconfirmation?.senderLocalObservedAt?.clockDomain,
    preconfirmation?.senderLocalElapsed?.clockDomain,
    preconfirmation?.providerObservedAt?.clockDomain,
    preconfirmation?.providerIssuedAt?.clockDomain,
    preconfirmation?.slotTimestamp?.clockDomain,
    trace?.clockDomain,
  ].filter(Boolean) as string[])]

  const senderToProvider = preconfirmation?.senderLocalObservedAt && preconfirmation.providerObservedAt
    ? durationBetween(preconfirmation.senderLocalObservedAt, preconfirmation.providerObservedAt)
    : null

  const timing = {
    clockDomains,
    distinctClockDomainCount: clockDomains.length,
    senderLocalObservedAt: preconfirmation?.senderLocalObservedAt?.value ?? null,
    providerObservedAt: preconfirmation?.providerObservedAt?.value ?? null,
    providerIssuedAt: preconfirmation?.providerIssuedAt?.value ?? null,
    blockTime: caseFile?.blockTime ?? null,
    senderToProviderDuration: senderToProvider,
    boundary: 'Timestamps are recorded per clock domain. A duration is reported only between readings on the same domain; across domains the offset is unknown and unrecoverable, so none is computed. No duration here measures network latency, provider delay, or leader ingress.',
  }

  // --- what was asserted, and what happened ---------------------------------------------------
  const preconfirmationState = preconfirmation && {
    source: preconfirmation.sourceAttribution.source,
    sourceBasis: preconfirmation.sourceAttribution.basis,
    sourceRationale: preconfirmation.sourceAttribution.rationale,
    sourceDescription: describeAttribution(preconfirmation.sourceAttribution),
    statusCode: preconfirmation.statusCode?.value ?? null,
    assertedLevel: preconfirmation.assertedLevel.value,
    assertedLevelIsVerbatim: true,
    schedulingStatus: preconfirmation.schedulingStatus?.value ?? null,
    targetSlot: preconfirmation.targetSlot?.value ?? null,
    provider: preconfirmation.provider.label,
    effectiveAttestation: effectiveAttestation(preconfirmation),
    attestationProofSupplied: Boolean(preconfirmation.attestationProof),
    attestationVerification: preconfirmation.attestationProof?.verification ?? 'NONE_SUPPLIED',
    boundary: 'The asserted level is the issuer\'s own word, kept verbatim. It is not mapped onto Solana commitment levels, and it is not evidence the transaction landed.',
  }

  const execution = caseFile && {
    landedSlot: caseFile.slot,
    outcome: caseFile.state,
    reach: {
      framesObserved: caseFile.execution.frames.length,
      rejectionLocated: caseFile.execution.failureFrameId != null,
      failurePath: caseFile.execution.failurePath.map((id) => caseFile.execution.frames[id].programId),
      boundary: caseFile.execution.attributionBoundary,
    },
    stateCommitment: caseFile.execution.stateCommitment,
    readAtCommitment: input.receiptCommitment ?? 'UNSPECIFIED',
    finality: input.receiptCommitment === 'finalized'
      ? 'FINALIZED'
      : 'NOT_ESTABLISHED_AS_FINAL',
  }

  // --- discrepancies --------------------------------------------------------------------------
  const discrepancies: Array<{ code: string; statement: string; boundary: string }> = []

  if (identity === 'UNMATCHED') {
    discrepancies.push({
      code: 'IDENTITY_UNMATCHED',
      statement: `The preconfirmation names ${preSignature} and the receipt is for ${receiptSignature}.`,
      boundary: 'Without a trace linking both to one attempt, this is two unrelated records, not evidence that anything was substituted.',
    })
  }
  if (identity === 'MATCHED_VIA_REBUILT_REVISION') {
    discrepancies.push({
      code: 'PRECONFIRMATION_FOR_SUPERSEDED_REVISION',
      statement: `The preconfirmation is for ${preSignature}, which the sender replaced; ${receiptSignature} is what landed.`,
      boundary: 'The assertion was about a message that did not land. That is not a failure by the issuer: the sender rebuilt.',
    })
  }
  if (preconfirmation && !caseFile) {
    discrepancies.push({
      code: 'PRECONFIRMATION_UNRESOLVED',
      statement: 'A preconfirmation was recorded and no landed receipt was supplied for it.',
      boundary: 'Unresolved, not broken. No receipt in hand is not evidence the transaction failed to land, was dropped, or that the issuer defaulted — it may have landed unobserved, or not yet.',
    })
  }
  const assertedSlot = preconfirmation?.targetSlot?.value
  if (assertedSlot != null && caseFile && assertedSlot !== caseFile.slot) {
    discrepancies.push({
      code: 'SLOT_ASSERTION_NOT_MET',
      statement: `The issuer named slot ${assertedSlot}; the transaction landed in ${caseFile.slot}.`,
      boundary: 'The slot claim was not met. Nothing here establishes why, whose decision moved it, or whether the issuer controlled that outcome.',
    })
  }
  if (preconfirmation?.attestationProof && preconfirmation.attestationProof.verification !== 'VERIFIED') {
    discrepancies.push({
      code: 'ATTESTATION_UNVERIFIED',
      statement: `An attestation was supplied but its verification state is ${preconfirmation.attestationProof.verification}.`,
      boundary: 'An unverified signature carries no more weight than the provider\'s unsigned word. It is not evidence the named signer produced it.',
    })
  }
  if (caseFile && input.receiptCommitment !== 'finalized') {
    discrepancies.push({
      code: 'RECEIPT_NOT_FINALIZED',
      statement: `The receipt was read at ${input.receiptCommitment ?? 'an unspecified'} commitment.`,
      boundary: 'A result below finalized can still be reorganised. This is a limit on the receipt, not a discrepancy with the preconfirmation.',
    })
  }
  if (timing.distinctClockDomainCount > 1) {
    discrepancies.push({
      code: 'MULTIPLE_CLOCK_DOMAINS',
      statement: `Timestamps span ${timing.distinctClockDomainCount} clock domains: ${clockDomains.join(', ')}.`,
      boundary: 'Readings across domains are not comparable and no duration between them is computed. This is a property of the evidence, not a fault of any party.',
    })
  }

  const traceSummary = trace ? summarizeTrace(trace) : null

  // --- reconciliation state --------------------------------------------------------------------
  // MISMATCH is deliberately hard to reach. A preconfirmation is a statement; only a VERIFIED
  // commitment contradicted by chain evidence is a contradiction rather than a difference.
  const verifiedCommitment = preconfirmation?.attestationProof?.verification === 'VERIFIED'
  const slotContradicted = verifiedCommitment
    && preconfirmation?.targetSlot?.value != null
    && caseFile != null
    && preconfirmation.targetSlot.value !== caseFile.slot

  const deadlinePassed = preconfirmation?.expiresAt != null
    && Date.parse(preconfirmation.expiresAt.value) < Date.now()

  let reconciliationState: ReconciliationState
  let reconciliationBasis: string
  if (!preconfirmation) {
    reconciliationState = 'UNRESOLVED'
    reconciliationBasis = 'No preconfirmation was supplied, so there is nothing to reconcile against the receipt.'
  } else if (slotContradicted) {
    reconciliationState = 'MISMATCH'
    reconciliationBasis = `A verified commitment named slot ${preconfirmation.targetSlot!.value} and the ledger recorded ${caseFile!.slot}. The commitment was authenticated, so this is a contradiction rather than a difference between a claim and an outcome.`
  } else if (caseFile && (identity === 'MATCHED' || identity === 'MATCHED_VIA_REBUILT_REVISION')) {
    reconciliationState = 'MATCHED'
    reconciliationBasis = identity === 'MATCHED'
      ? 'A receipt was found for the message the preconfirmation named.'
      : 'A receipt was found for a later revision of the same attempt. The preconfirmation named a message the sender replaced.'
  } else if (caseFile) {
    reconciliationState = 'UNRESOLVED'
    reconciliationBasis = 'A receipt was supplied but nothing links it to the preconfirmation. Two unrelated records are not a contradiction.'
  } else if (preconfirmation.expiresAt && !deadlinePassed) {
    reconciliationState = 'PENDING'
    reconciliationBasis = `No receipt yet, and the issuer's own deadline (${preconfirmation.expiresAt.value}) has not passed. Still in flight.`
  } else {
    reconciliationState = 'UNRESOLVED'
    reconciliationBasis = deadlinePassed
      ? 'The issuer\'s deadline passed with no receipt supplied. A lapsed deadline is not proof the transaction failed to land — it may have landed unobserved, and nothing here establishes that the issuer defaulted.'
      : 'No receipt was supplied and no deadline semantics are available. No receipt in hand is not evidence the transaction failed to land.'
  }

  const path = preconfirmation ? pathFor(preconfirmation.sourceAttribution.source) : null

  return {
    schemaVersion: RECONCILIATION_VERSION,
    synthetic,
    syntheticReason: synthetic
      ? 'At least one input is a fixture. This reconciliation is illustrative only and must not be presented as product evidence.'
      : null,
    inputsSupplied: {
      preconfirmation: Boolean(preconfirmation),
      attemptTrace: Boolean(trace),
      receipt: Boolean(caseFile),
    },
    identity: {
      match: identity,
      preconfirmationSignature: preSignature,
      receiptSignature,
      traceSignatureCount: traceSignatures.size,
    },
    timing,
    preconfirmationState,
    execution,
    attemptSummary: traceSummary && {
      revisions: traceSummary.revisions.length,
      sends: traceSummary.sends,
      repeatedSends: traceSummary.retries,
      captureIssuesReported: traceSummary.captureIssuesReported,
      boundary: traceSummary.boundary,
    },
    reconciliation: {
      state: reconciliationState,
      basis: reconciliationBasis,
      boundary: 'MISMATCH requires a verified commitment contradicted by chain evidence. Everything weaker is a difference between a statement and an outcome, not a broken promise.',
    },
    evidenceMap: path && {
      source: path.source,
      name: path.name,
      character: path.character,
      emission: path.emission,
      basisToday: path.basisToday,
      stages: path.stages.map((entry) => ({ ...entry, evidenceLabel: evidenceLabel[entry.evidence] })),
      unknownStageCount: unknownStageCount(path),
      ordering: path.ordering && {
        ...path.ordering,
        headline: 'Scheduler dispatch ordering with ex-post block-verifiable constraints',
        boundary: 'Checkable against the produced block is not the same as attested. The check can falsify an ordering claim; it cannot establish who made it.',
      },
      openQuestions: path.openQuestions,
    },
    discrepancies,
    unknowable: UNKNOWABLE,
    limitations: [
      'This module compares records. It does not verify signatures, contact any node, or establish that a supplied record is authentic.',
      'A preconfirmation and a receipt agreeing proves that a statement was made and an outcome occurred. It does not prove the statement caused the outcome.',
      'Nothing here grades a provider. Establishing execution quality needs a pre-registered population and a controlled comparison, neither of which one reconciliation provides.',
    ],
  }
}

export type Reconciliation = ReturnType<typeof reconcile>
