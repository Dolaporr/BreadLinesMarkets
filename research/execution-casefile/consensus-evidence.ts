/**
 * Consensus Evidence v0 — three evidence surfaces that must never be read as one chain.
 *
 *   EXECUTION  what the SVM did.
 *   CONSENSUS  what the network can establish about the block containing that execution.
 *   OBSERVER   what this observer knew, from which source, and when.
 *
 * None of the three proves another. A transaction executing successfully is not evidence that its
 * block finalized; a transaction failing is not evidence that consensus failed; a processed
 * observation is not finality evidence. Those boundaries are encoded here rather than left to UI
 * copy, so a caller cannot read one surface's value as another's.
 *
 * Protocol detection reads the CLUSTER, never a calendar, a version string, an epoch guess or a
 * hardcoded activation slot. `getAgGenesisCert` is the probe, per first-party documentation:
 * https://solana.com/docs/rpc/http/getaggenesiscert — see research/consensus-evidence/sources.md.
 */

/** Positive evidence classes, reusing the vocabulary already in this repo. */
export const EVIDENCE_CLASSES = ['OBSERVED', 'DERIVED', 'INFERRED', 'SIMULATED', 'UNKNOWN'] as const
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number]

/**
 * Absence states. Kept OUT of UNKNOWN on purpose: "we know why this is missing" is a different
 * epistemic position from "we do not know". Collapsing them discards the reason.
 */
export const ABSENCE_STATES = ['UNAVAILABLE', 'NOT_SUPPORTED', 'NOT_APPLICABLE', 'REFUSED'] as const
export type AbsenceState = (typeof ABSENCE_STATES)[number]

export type FieldState = EvidenceClass | AbsenceState
export const FIELD_STATES = [...EVIDENCE_CLASSES, ...ABSENCE_STATES] as const

/** Every value carries its own state and the basis for that state. No bare values anywhere. */
export type Claim<T> = { value: T | null; state: FieldState; basis: string }
export const claim = <T>(value: T | null, state: FieldState, basis: string): Claim<T> => ({ value, state, basis })
const absent = <T>(state: AbsenceState, basis: string): Claim<T> => ({ value: null, state, basis })

// --- capability probe ---------------------------------------------------------------------------

/**
 * The four distinguishable outcomes of asking a node for the Alpenglow genesis certificate.
 * They are four, not two, because "the node does not implement this" and "the cluster has not
 * migrated" are different facts, and a transport failure is neither.
 */
export type GenesisCertProbe =
  | { outcome: 'CERTIFICATE'; endpoint: string; observedAt: string; raw: unknown }
  | { outcome: 'NULL_SUPPORTED'; endpoint: string; observedAt: string; raw: null }
  | { outcome: 'METHOD_NOT_FOUND'; endpoint: string; observedAt: string; rpcErrorCode: number; rpcErrorMessage: string }
  | { outcome: 'TRANSPORT_FAILURE'; endpoint: string; observedAt: string; detail: string }

export const CONSENSUS_PROTOCOLS = ['TOWER_BFT', 'ALPENGLOW', 'UNKNOWN'] as const
export type ConsensusProtocol = (typeof CONSENSUS_PROTOCOLS)[number]
export const MIGRATION_STATES = ['NOT_MIGRATED', 'MIGRATED', 'UNKNOWN'] as const
export type MigrationState = (typeof MIGRATION_STATES)[number]
export const CAPABILITY_STATES = ['SUPPORTED', 'NOT_SUPPORTED', 'UNKNOWN'] as const
export type CapabilityState = (typeof CAPABILITY_STATES)[number]

/** Shape documented for the certificate. Parsed defensively: a missing field stays absent. */
type CertificateFields = {
  certificateSlot: Claim<number>
  certificateBlockId: Claim<string>
  aggregateSignaturePresent: Claim<boolean>
}

function parseCertificate(raw: unknown): CertificateFields {
  const r = raw as { block?: { slot?: unknown; blockId?: unknown }; signature?: { signature?: unknown; bitmap?: unknown } } | null
  const slot = typeof r?.block?.slot === 'number' ? r.block.slot : null
  const blockIdRaw = r?.block?.blockId
  const blockId = typeof blockIdRaw === 'string' ? blockIdRaw
    : Array.isArray(blockIdRaw) ? blockIdRaw.map((b) => Number(b).toString(16).padStart(2, '0')).join('') : null
  const sig = r?.signature?.signature
  return {
    certificateSlot: slot == null
      ? absent('UNAVAILABLE', 'The certificate payload carried no block.slot.')
      : claim(slot, 'OBSERVED', 'Read from the certificate payload returned by getAgGenesisCert.'),
    certificateBlockId: blockId == null
      ? absent('UNAVAILABLE', 'The certificate payload carried no block.blockId.')
      : claim(blockId, 'OBSERVED', 'Read from the certificate payload returned by getAgGenesisCert.'),
    aggregateSignaturePresent: sig == null
      ? absent('UNAVAILABLE', 'The certificate payload carried no aggregate signature.')
      : claim(true, 'OBSERVED', 'An aggregate signature field was present in the payload. It was NOT verified — see certificateVerification.'),
  }
}

// --- consensus surface --------------------------------------------------------------------------

export type ConsensusSurface = {
  protocol: Claim<ConsensusProtocol>
  migrationState: Claim<MigrationState>
  capability: Claim<CapabilityState>
  genesisCertificateStatus: Claim<'PRESENT' | 'ABSENT'>
  certificateSlot: Claim<number>
  certificateBlockId: Claim<string>
  /** Whether Breadlines cryptographically verified anything. v0 never does. */
  certificateVerification: Claim<'NOT_VERIFIED'>
  /** The slot the transaction landed in, restated here so the two are visibly separate values. */
  containingBlockSlot: Claim<number>
  containingBlockhash: Claim<string>
  /** Commitment a provider REPORTED. Never presented as certificate verification. */
  rpcReportedCommitment: Claim<string>
  /**
   * Whether the genesis certificate says anything about THIS transaction. It does not: the genesis
   * certificate covers the first block produced under Alpenglow, a cluster-level one-time artifact.
   * Binding it to an arbitrary transaction would be a category error, so the binding is refused
   * structurally rather than by UI wording.
   */
  certificateBoundToTransaction: Claim<false>
  evidenceSource: string
  observedAt: string
  boundary: string
}

const CLUSTER_ONLY =
  'The Alpenglow genesis certificate covers the first block produced under Alpenglow. It is a one-time, cluster-level migration artifact and says nothing about the block containing this transaction. No linkage is asserted.'

export function classifyConsensus(probe: GenesisCertProbe, execution: {
  slot: number | null; blockhash: string | null; rpcReportedCommitment?: string | null
}): ConsensusSurface {
  const containing = {
    containingBlockSlot: execution.slot == null
      ? absent<number>('UNAVAILABLE', 'No landed slot was supplied.')
      : claim(execution.slot, 'OBSERVED' as const, 'Slot carried by the supplied receipt.'),
    containingBlockhash: execution.blockhash == null
      ? absent<string>('UNAVAILABLE', 'The supplied receipt carried no block identity.')
      : claim(execution.blockhash, 'OBSERVED' as const, 'Block identity carried by the supplied receipt.'),
    rpcReportedCommitment: execution.rpcReportedCommitment == null
      ? absent<string>('UNAVAILABLE', 'No commitment was reported by any source for this read.')
      : claim(execution.rpcReportedCommitment, 'OBSERVED' as const,
        'A provider REPORTED this commitment. This is a provider statement, not certificate verification.'),
    certificateBoundToTransaction: claim(false as const, 'NOT_APPLICABLE' as const, CLUSTER_ONLY),
    certificateVerification: claim('NOT_VERIFIED' as const, 'NOT_APPLICABLE' as const,
      'Breadlines v0 retrieves certificate-shaped data. It performs no BLS or other cryptographic verification, so nothing here is a verified certificate.'),
    evidenceSource: probe.endpoint,
    observedAt: probe.observedAt,
  }

  if (probe.outcome === 'NULL_SUPPORTED') {
    return {
      ...containing,
      protocol: claim('TOWER_BFT', 'OBSERVED', 'The node understood getAgGenesisCert and answered null, which the method defines as "the cluster has not migrated to Alpenglow".'),
      migrationState: claim('NOT_MIGRATED', 'OBSERVED', 'A null answer from a node that implements the method is positive evidence of non-migration, not an absence of evidence.'),
      capability: claim('SUPPORTED', 'OBSERVED', 'The method returned a result rather than -32601.'),
      genesisCertificateStatus: claim('ABSENT', 'OBSERVED', 'No genesis certificate exists while the cluster runs TowerBFT.'),
      certificateSlot: absent('NOT_APPLICABLE', 'There is no genesis certificate under TowerBFT, so there is no certificate slot to report.'),
      certificateBlockId: absent('NOT_APPLICABLE', 'There is no genesis certificate under TowerBFT, so there is no certificate block id to report.'),
      boundary: 'TowerBFT is active on the probed cluster. Nothing here establishes anything about the finality of this transaction\'s block beyond what a provider reported.',
    }
  }

  if (probe.outcome === 'CERTIFICATE') {
    const cert = parseCertificate(probe.raw)
    return {
      ...containing,
      protocol: claim('ALPENGLOW', 'OBSERVED', 'The node returned an Alpenglow genesis certificate.'),
      migrationState: claim('MIGRATED', 'OBSERVED', 'A genesis certificate exists, which the method defines as the cluster having migrated.'),
      capability: claim('SUPPORTED', 'OBSERVED', 'The method returned a result rather than -32601.'),
      genesisCertificateStatus: claim('PRESENT', 'OBSERVED', 'A certificate payload was returned and retained verbatim.'),
      certificateSlot: cert.certificateSlot,
      certificateBlockId: cert.certificateBlockId,
      boundary: CLUSTER_ONLY,
    }
  }

  if (probe.outcome === 'METHOD_NOT_FOUND') {
    const why = `This endpoint answered ${probe.rpcErrorCode} ${probe.rpcErrorMessage}. That is a property of the node, not of the cluster: a node older than Agave v4.3 does not implement the method regardless of whether the cluster has migrated.`
    return {
      ...containing,
      protocol: claim('UNKNOWN', 'UNKNOWN', why),
      migrationState: claim('UNKNOWN', 'UNKNOWN', why),
      capability: claim('NOT_SUPPORTED', 'OBSERVED', why),
      genesisCertificateStatus: absent('NOT_SUPPORTED', 'This endpoint cannot answer the question. No inference about the cluster follows.'),
      certificateSlot: absent('NOT_SUPPORTED', 'This endpoint cannot answer the question.'),
      certificateBlockId: absent('NOT_SUPPORTED', 'This endpoint cannot answer the question.'),
      boundary: 'A method-not-found answer is NOT evidence of TowerBFT. Use a node running Agave v4.3 or later to establish the protocol.',
    }
  }

  const why = `The probe did not complete: ${probe.detail}. A transport failure is not a protocol state.`
  return {
    ...containing,
    protocol: claim('UNKNOWN', 'UNKNOWN', why),
    migrationState: claim('UNKNOWN', 'UNKNOWN', why),
    capability: claim('UNKNOWN', 'REFUSED', why),
    genesisCertificateStatus: absent('REFUSED', why),
    certificateSlot: absent('REFUSED', why),
    certificateBlockId: absent('REFUSED', why),
    boundary: 'No answer was obtained. Nothing about the protocol, the migration, or this transaction follows from a failed request.',
  }
}

// --- observer surface ---------------------------------------------------------------------------

export type ObserverSurface = {
  source: Claim<string>
  observationMethod: Claim<string>
  firstSeenAt: Claim<string>
  processedObservedAt: Claim<string>
  consensusEvidenceObservedAt: Claim<string>
  finalizedObservedAt: Claim<string>
  boundary: string
}

/**
 * Observation time is not event time. A historical read tells us when THIS process asked, never
 * when any observer first learned of the transaction, and `blockTime` is a cluster timestamp
 * estimate rather than an observation. Those stay unavailable rather than being filled in.
 */
export function observerSurfaceForHistoricalRead(input: {
  source: string; observationMethod: string; consensusEvidenceObservedAt: string | null
  liveFirstSeenAt?: string | null; liveProcessedObservedAt?: string | null; liveFinalizedObservedAt?: string | null
}): ObserverSurface {
  const historical = (what: string) =>
    absent<string>('UNAVAILABLE', `${what} is not recoverable from a historical read. Chain time is not observer time, and this process did not witness the transaction live.`)
  return {
    source: claim(input.source, 'OBSERVED', 'The endpoint this process actually queried.'),
    observationMethod: claim(input.observationMethod, 'OBSERVED', 'How this process obtained the record.'),
    firstSeenAt: input.liveFirstSeenAt
      ? claim(input.liveFirstSeenAt, 'OBSERVED', 'Recorded by this observer at the moment it first saw the transaction.')
      : historical('First-seen time'),
    processedObservedAt: input.liveProcessedObservedAt
      ? claim(input.liveProcessedObservedAt, 'OBSERVED', 'Recorded by this observer when it saw a processed status.')
      : historical('Processed-observation time'),
    consensusEvidenceObservedAt: input.consensusEvidenceObservedAt
      ? claim(input.consensusEvidenceObservedAt, 'OBSERVED', 'The wall-clock time at which this process ran the consensus capability probe.')
      : absent('UNAVAILABLE', 'No consensus probe was run for this casefile.'),
    finalizedObservedAt: input.liveFinalizedObservedAt
      ? claim(input.liveFinalizedObservedAt, 'OBSERVED', 'Recorded by this observer when it saw a finalized status.')
      : historical('Finalized-observation time'),
    boundary: 'Event time and observation time are different events. Absent entries mean this observer has no defensible timestamp, not that nothing happened.',
  }
}

// --- the three surfaces together ------------------------------------------------------------------

export type ExecutionSurface = {
  signature: Claim<string>
  slot: Claim<number>
  outcome: Claim<'LANDED_SUCCESS' | 'LANDED_FAILED'>
  failurePath: Claim<string>
  evidenceSource: string
}

export type EvidenceSurfaces = {
  version: 'breadlines-consensus-evidence-v0'
  execution: ExecutionSurface
  consensus: ConsensusSurface
  observer: ObserverSurface
  /** Stated once, structurally, rather than relying on layout to imply it. */
  independence: string[]
}

export const INDEPENDENCE: string[] = [
  'Execution success is not evidence that the containing block finalized.',
  'Execution failure is not evidence that consensus failed. A failed transaction can sit in a finalized block.',
  'A processed observation is not finality evidence.',
  'A provider reporting "finalized" is a provider statement, not a verified certificate.',
  'The Alpenglow genesis certificate is cluster-level migration evidence and is not bound to this transaction.',
  'Observation time is not event time.',
]

export function buildEvidenceSurfaces(input: {
  execution: ExecutionSurface; consensus: ConsensusSurface; observer: ObserverSurface
}): EvidenceSurfaces {
  return { version: 'breadlines-consensus-evidence-v0', ...input, independence: INDEPENDENCE }
}
