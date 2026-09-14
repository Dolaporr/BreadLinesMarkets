import { ATTESTATION_CLASSES, type AttestationClass, type PreconfirmationSource } from './preconfirmation.ts'

/**
 * Preconfirmation Evidence Map v0.
 *
 * Where evidence about a transaction comes from at each stage of its life, for each issuer whose
 * semantics Breadlines has actually established. The map exists because a single preconfirmation
 * stream can merge issuers that differ in kind, and a model that flattens them to `preconfirmed`
 * has thrown away the only thing that decides what the record is worth.
 *
 * The classes are NOT a monotonic confidence ladder. They name where evidence came from. A
 * provider-observed execution result can be more informative than a validator-attested inclusion
 * promise, because they answer different questions. Ordering them by strength would reintroduce
 * exactly the collapse this map prevents.
 */
export const PRECONFIRMATION_MAP_VERSION = 'breadlines-preconfirmation-map-v0' as const

/**
 * Reuses the field-level attestation vocabulary plus UNKNOWN, rather than defining a parallel one.
 * PROVIDER_REPORTED is the same concept as "provider-observed" at stage granularity, and is
 * labelled that way for display by `evidenceLabel`.
 */
export const STAGE_EVIDENCE_CLASSES = [...ATTESTATION_CLASSES, 'UNKNOWN'] as const
export type StageEvidence = AttestationClass | 'UNKNOWN'

export const evidenceLabel: Record<StageEvidence, string> = {
  CLIENT_OBSERVED: 'Client-observed',
  PROVIDER_REPORTED: 'Provider-observed',
  VALIDATOR_ATTESTED: 'Validator-attested',
  CHAIN_PROVEN: 'Chain-proven',
  UNKNOWN: 'Unknown',
}

export const LIFECYCLE_STAGES = [
  'SUBMISSION', 'SCHEDULER', 'LEADER_COMMITMENT', 'EXECUTION',
  'PRECONFIRMATION_EMISSION', 'BLOCK_INCLUSION', 'LEDGER_RECEIPT',
] as const
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

export type StageEntry = {
  stage: LifecycleStage
  label: string
  evidence: StageEvidence
  /** What this stage establishes, when it establishes anything. */
  known: string
  /** What remains open at this stage. Never empty — every stage has a boundary. */
  notEstablished: string
}

export type PathMap = {
  source: PreconfirmationSource
  name: string
  /** One line on what this issuer's preconfirmation IS. */
  character: string
  /** When the preconfirmation is emitted relative to execution. */
  emission: 'POST_EXECUTION' | 'COMMIT_TO_EXECUTE' | 'UNKNOWN'
  basisToday: string
  stages: StageEntry[]
  openQuestions: string[]
}

/**
 * The Helius path, as Helius described it (Ichigo, 2026-09).
 *
 * Confirmed: preconfirmations are emitted post-execution and carry a status; status 0/1 identifies
 * this path. Not confirmed, and therefore UNKNOWN here: everything between submission and
 * execution. Helius described what its preconfirmation is, not how the transaction got scheduled.
 */
export const HELIUS_PATH: PathMap = {
  source: 'HELIUS',
  name: 'Helius post-execution preconfirmation',
  character: 'Emitted after execution and capable of carrying an execution result. It reports an outcome earlier than the ledger does; it is not the ledger.',
  emission: 'POST_EXECUTION',
  basisToday: 'Source is DERIVED from status semantics. The payload carries no per-message source field today, so nothing in the message states its own origin.',
  stages: [
    {
      stage: 'SUBMISSION', label: 'Submission', evidence: 'CLIENT_OBSERVED',
      known: 'That this application built, signed and attempted to send a message, on its own clock.',
      notEstablished: 'That any packet left the machine, or reached a provider or leader.',
    },
    {
      stage: 'SCHEDULER', label: 'Scheduling', evidence: 'UNKNOWN',
      known: 'Nothing. Helius described its preconfirmation, not how the transaction was scheduled before execution.',
      notEstablished: 'Whether a scheduler was involved, what it did, when, or in what order relative to other transactions.',
    },
    {
      stage: 'LEADER_COMMITMENT', label: 'Leader commitment', evidence: 'UNKNOWN',
      known: 'Nothing. No leader commitment step is established for this path.',
      notEstablished: 'Whether any leader committed to this transaction before execution, or when.',
    },
    {
      stage: 'EXECUTION', label: 'Execution', evidence: 'PROVIDER_REPORTED',
      known: 'That execution occurred, because the preconfirmation is emitted after it and reports a result.',
      notEstablished: 'That the reported result is what the ledger will record. It is the provider\'s report of an outcome, not the outcome itself.',
    },
    {
      stage: 'PRECONFIRMATION_EMISSION', label: 'Preconfirmation emitted', evidence: 'PROVIDER_REPORTED',
      known: 'That Helius emitted a message carrying a status, at a time on its own clock.',
      notEstablished: 'That the message is cryptographically authenticated, or that its origin is stated rather than inferred from status.',
    },
    {
      stage: 'BLOCK_INCLUSION', label: 'Block inclusion', evidence: 'UNKNOWN',
      known: 'Nothing, until a receipt is observed. A post-execution preconfirmation precedes the receipt.',
      notEstablished: 'Which slot the transaction appears in, or that it appears at all.',
    },
    {
      stage: 'LEDGER_RECEIPT', label: 'Ledger receipt', evidence: 'CHAIN_PROVEN',
      known: 'Inclusion in a specific slot, the execution outcome, the fee, and that the transaction committed atomically or committed nothing but its fee.',
      notEstablished: 'Submission time, leader ingress, scheduler position, ordering, or contention. A receipt read below finalized can still be reorganised.',
    },
  ],
  openQuestions: [
    'Will a per-message source field be added, so attribution can move from DERIVED to EXPLICIT?',
    'What is the complete set of status values, and what does each mean?',
    'Is the preconfirmation message authenticated in any way a third party can verify?',
  ],
}

/**
 * The BAM path. Its SHAPE is described in public material as commit-to-execute — a commitment made
 * before execution rather than a report after it. Its EVIDENCE PROPERTIES are not established, and
 * are recorded as UNKNOWN rather than guessed.
 *
 * Nothing in this entry should be read as a description of what BAM does. It is a description of
 * what Breadlines has verified, which at every point below is: not this.
 */
export const BAM_PATH: PathMap = {
  source: 'BAM',
  name: 'BAM commit-to-execute preconfirmation',
  character: 'Described in public material as a commitment made before execution. What it commits to, and whether that commitment is independently checkable, is not established.',
  emission: 'COMMIT_TO_EXECUTE',
  basisToday: 'Source basis is UNKNOWN. No rule has been established for identifying a BAM message in the merged stream, and the absence of the Helius status does not identify one.',
  stages: [
    {
      stage: 'SUBMISSION', label: 'Submission', evidence: 'CLIENT_OBSERVED',
      known: 'That this application built, signed and attempted to send a message, on its own clock.',
      notEstablished: 'That any packet left the machine, or reached a provider or leader.',
    },
    {
      stage: 'SCHEDULER', label: 'Scheduling', evidence: 'UNKNOWN',
      known: 'Nothing is established about what scheduler evidence exists or what it covers.',
      notEstablished: 'Whether a scheduler sequence is authenticated or is stream metadata; whether bundle position is authenticated; whether a third party can verify either.',
    },
    {
      stage: 'LEADER_COMMITMENT', label: 'Leader commitment', evidence: 'UNKNOWN',
      known: 'Nothing is established about whether a leader commitment is signed, or by whom.',
      notEstablished: 'Whether the commitment is cryptographically attributable to an identified key, and what it binds the committer to.',
    },
    {
      stage: 'PRECONFIRMATION_EMISSION', label: 'Preconfirmation emitted', evidence: 'UNKNOWN',
      known: 'Nothing is established about what the preconfirmation object cryptographically commits to.',
      notEstablished: 'Whether the object is authenticated; where a TEE ordering attestation sits relative to it; what slot or clock domain accompanies it; whether it is validator-attested.',
    },
    {
      stage: 'EXECUTION', label: 'Execution', evidence: 'UNKNOWN',
      known: 'Nothing. A commit-to-execute preconfirmation precedes execution, so it reports no result.',
      notEstablished: 'Whether execution occurred, and what it returned.',
    },
    {
      stage: 'BLOCK_INCLUSION', label: 'Block inclusion', evidence: 'UNKNOWN',
      known: 'Nothing, until a receipt is observed.',
      notEstablished: 'Which slot the transaction appears in, or that it appears at all.',
    },
    {
      stage: 'LEDGER_RECEIPT', label: 'Ledger receipt', evidence: 'CHAIN_PROVEN',
      known: 'Inclusion in a specific slot, the execution outcome, the fee, and that the transaction committed atomically or committed nothing but its fee.',
      notEstablished: 'Submission time, leader ingress, scheduler position, ordering, or contention.',
    },
  ],
  openQuestions: [
    'What exactly does a BAM preconfirmation commit to?',
    'Is the preconfirmation object itself cryptographically authenticated?',
    'Are scheduler sequence and bundle position authenticated, or informational stream metadata?',
    'Can a third party independently verify the sequencing claim?',
    'Where does the TEE ordering attestation sit relative to the preconfirmation?',
    'What slot or clock domain accompanies the commitment?',
    'What constitutes expiry, and what would constitute a genuinely broken commitment?',
    'How should a preconfirmation be reconciled against the eventual ledger outcome?',
  ],
}

/** A path with no established issuer. Not a third product — the absence of an attribution. */
export const UNATTRIBUTED_PATH: PathMap = {
  source: 'UNKNOWN',
  name: 'Unattributed preconfirmation',
  character: 'A message whose issuer is not established. It is not assigned to an issuer by elimination.',
  emission: 'UNKNOWN',
  basisToday: 'No attribution rule matched. Absence of a known marker identifies nothing.',
  stages: BAM_PATH.stages.map((entry) =>
    entry.stage === 'LEDGER_RECEIPT' ? entry : { ...entry, evidence: 'UNKNOWN' as const }),
  openQuestions: ['Which issuer emitted this message, and what field would establish that?'],
}

export function pathFor(source: PreconfirmationSource): PathMap {
  if (source === 'HELIUS') return HELIUS_PATH
  if (source === 'BAM') return BAM_PATH
  return UNATTRIBUTED_PATH
}

export const PATHS = [HELIUS_PATH, BAM_PATH] as const

/** Counts of what each path leaves open, for a reader deciding how much a path is worth. */
export function unknownStageCount(path: PathMap) {
  return path.stages.filter((entry) => entry.evidence === 'UNKNOWN').length
}

export const MAP_BOUNDARY =
  'This map records where evidence comes from at each stage, for issuers whose semantics Breadlines has established. UNKNOWN means not established — it is never a placeholder for an assumed value, and never an invitation to fill the stage in by elimination. The classes describe provenance, not a confidence ranking.'
