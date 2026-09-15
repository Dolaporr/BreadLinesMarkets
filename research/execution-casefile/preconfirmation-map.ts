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

/**
 * Ordering evidence that is checkable against the produced block without being authenticated.
 *
 * This is a genuinely distinct thing and the model keeps it distinct, because the obvious mistake
 * is to read "verifiable" as "attested". Two different questions:
 *
 *   Is the claim CONSISTENT with what the chain recorded?  — checkable, ex post, against the block.
 *   Did the claimed party actually make the claim?          — not established by any check here.
 *
 * A reconciliation against the block can FALSIFY an ordering claim. It cannot AUTHENTICATE one: a
 * fabricated sequence_id that happens to be consistent with the block passes the same check. So
 * this class of evidence constrains, and the constraint is real, but it says nothing about origin.
 */
export type OrderingEvidence = {
  kind: 'SCHEDULER_DISPATCH_WITH_EX_POST_BLOCK_CONSTRAINT'
  /** The field carrying the claim, and what the issuer says it describes. */
  claim: { fields: string[]; describes: string; evidence: StageEvidence }
  /** How the claim can be checked, and the evidence class of the thing it is checked against. */
  check: { method: string; checkedAgainst: StageEvidence; scope: string; direction: string }
  establishes: string[]
  doesNotEstablish: string[]
  /** Authentication is a separate axis and is not established by the constraint. */
  authentication: 'NOT_ESTABLISHED'
  source: string
}

/**
 * From Eric (@gzalz_sol), 2026-09. Recorded as what he established, and nothing beyond it.
 *
 * He established what the fields DESCRIBE and a structural constraint the produced block must
 * satisfy. He did not establish that any of it is signed, attested, or attributable to a key, and
 * that gap is held open deliberately below.
 */
export const BAM_ORDERING_EVIDENCE: OrderingEvidence = {
  kind: 'SCHEDULER_DISPATCH_WITH_EX_POST_BLOCK_CONSTRAINT',
  claim: {
    fields: ['sequence_id', 'bundle metadata'],
    describes: 'The BAM node\'s dispatch ordering. Transactions are forwarded from scheduler to leader in ascending dispatch order, and transactions sharing a sequence id have been atomically bundled, with intended intra-bundle ordering carried in the bundle metadata.',
    evidence: 'PROVIDER_REPORTED',
  },
  check: {
    method: 'Reconcile the claimed ordering against the produced block: for a set of transactions writing to the same account, their order in the block must follow ascending sequence_id.',
    checkedAgainst: 'CHAIN_PROVEN',
    scope: 'Binds only across transactions that write to the same account. Where two transactions share no writable account, the block imposes no ordering constraint on them and the claim is unfalsifiable for that pair.',
    direction: 'Ex post. The check runs only after the block exists, so it cannot validate a preconfirmation at the moment it is issued.',
  },
  establishes: [
    'What sequence_id and bundle metadata describe, in the issuer\'s own terms.',
    'A structural constraint the produced block must satisfy for same-account writers, which makes an ordering claim falsifiable against chain data.',
    'That transactions sharing a sequence id were atomically bundled, as the issuer describes it.',
  ],
  doesNotEstablish: [
    'That sequence_id or bundle metadata are cryptographically authenticated, signed, or attributable to a key.',
    'That the preconfirmation object constitutes a validator attestation.',
    'Where a TEE ordering attestation sits relative to the preconfirmation, or whether one covers these fields.',
    'The clock or slot semantics accompanying the ordering claim.',
    'That a claim consistent with the block is therefore genuine — consistency is not authenticity, and a fabricated value that happens to fit passes the same check.',
    'Any ordering relationship between transactions that share no writable account.',
  ],
  authentication: 'NOT_ESTABLISHED',
  source: 'Direct clarification from Eric (@gzalz_sol), 2026-09. Not published documentation.',
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
  /** Ordering evidence that is checkable without being authenticated, where any exists. */
  ordering?: OrderingEvidence
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
  character: 'Described in public material as a commitment made before execution. Its dispatch ordering is now described and is checkable against the produced block after the fact; whether any of it is authenticated is not established.',
  emission: 'COMMIT_TO_EXECUTE',
  basisToday: 'Source basis is UNKNOWN. No rule has been established for identifying a BAM message in the merged stream, and the absence of the Helius status does not identify one.',
  stages: [
    {
      stage: 'SUBMISSION', label: 'Submission', evidence: 'CLIENT_OBSERVED',
      known: 'That this application built, signed and attempted to send a message, on its own clock.',
      notEstablished: 'That any packet left the machine, or reached a provider or leader.',
    },
    {
      stage: 'SCHEDULER', label: 'Scheduling', evidence: 'PROVIDER_REPORTED',
      known: 'sequence_id describes the BAM node\'s dispatch ordering, and transactions are forwarded to the leader in ascending dispatch order. Transactions sharing a sequence id were atomically bundled, with intended intra-bundle ordering in the bundle metadata. For same-account writers the produced block must follow ascending sequence_id, so an ordering claim can be checked against the block after the fact.',
      notEstablished: 'Whether sequence_id or bundle metadata are authenticated, signed, or attributable to any key. The block check constrains the claim; it does not establish who made it, and a value consistent with the block is not thereby genuine.',
    },
    {
      stage: 'LEADER_COMMITMENT', label: 'Leader commitment', evidence: 'UNKNOWN',
      known: 'Nothing is established about whether a leader commitment is signed, or by whom.',
      notEstablished: 'Whether the commitment is cryptographically attributable to an identified key, and what it binds the committer to.',
    },
    {
      stage: 'PRECONFIRMATION_EMISSION', label: 'Preconfirmation emitted', evidence: 'UNKNOWN',
      known: 'Nothing is established about what the preconfirmation object cryptographically commits to.',
      notEstablished: 'Whether the object is authenticated; whether the sequence and bundle fields inside it are authenticated; what key or signature would authenticate them; where a TEE ordering attestation sits relative to it; what slot or clock domain accompanies it; whether it is validator-attested.',
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
  ordering: BAM_ORDERING_EVIDENCE,
  openQuestions: [
    'What exactly does a BAM preconfirmation commit to?',
    'Is the preconfirmation object itself cryptographically authenticated?',
    'Are the sequence and bundle fields authenticated inside the preconfirmation object, and by what key or signature?',
    'Beyond the ex-post block constraint, can a third party verify that a sequencing claim originated from the party it names?',
    'Where does the TEE ordering attestation sit relative to the preconfirmation?',
    'What slot or clock domain accompanies the commitment?',
    'What constitutes expiry, and what would constitute a genuinely broken commitment?',
    'How should a preconfirmation be reconciled against the eventual ledger outcome?',
  ],
}

/**
 * A path with no established issuer. Not a third product — the absence of an attribution.
 *
 * Its stages are written out in full, deliberately. An earlier version derived them from
 * BAM_PATH and overrode only the evidence class, which left BAM's prose in place: an unattributed
 * record described its own scheduling in terms of "the BAM node's dispatch ordering" purely
 * because sequencing-shaped fields were present. That is attribution by field-name resemblance,
 * which is the exact inference this model exists to refuse — so there is now no structural
 * relationship between this path and BAM_PATH at all, and a test asserts none is reintroduced.
 *
 * Nothing here describes an issuer, a scheduler, an emission boundary, or a commitment. Every
 * stage says what is not established, because that is the whole content of an unattributed record.
 */
export const UNATTRIBUTED_PATH: PathMap = {
  source: 'UNKNOWN',
  name: 'Unattributed preconfirmation',
  character: 'A message whose issuer is not established. It is not assigned to an issuer by elimination, and no issuer\'s semantics are applied to it.',
  emission: 'UNKNOWN',
  basisToday: 'No attribution rule matched. Absence of a known marker identifies nothing, and sequencing-shaped fields do not identify an issuer.',
  stages: [
    {
      stage: 'SUBMISSION', label: 'Submission', evidence: 'CLIENT_OBSERVED',
      known: 'This application built, signed and attempted to send a message, on its own clock.',
      notEstablished: 'That any packet left the machine, or reached a provider or leader.',
    },
    {
      stage: 'SCHEDULER', label: 'Scheduling', evidence: 'UNKNOWN',
      known: 'No scheduling semantics are established for this message. Sequencing-shaped fields are retained as uninterpreted data and do not identify an issuer or prove ordering.',
      notEstablished: 'Whether any scheduler was involved, what any retained field means, and whether any ordering claim exists at all.',
    },
    {
      stage: 'LEADER_COMMITMENT', label: 'Leader commitment', evidence: 'UNKNOWN',
      known: 'No leader commitment is established for this message.',
      notEstablished: 'Whether any leader committed to this transaction, when, or on what terms.',
    },
    {
      stage: 'PRECONFIRMATION_EMISSION', label: 'Preconfirmation emitted', evidence: 'UNKNOWN',
      known: 'The message was observed, but its issuer, emission boundary and cryptographic commitment semantics are not established.',
      notEstablished: 'Who emitted it, whether it precedes or follows execution, what it commits to, and whether it is authenticated.',
    },
    {
      stage: 'EXECUTION', label: 'Execution', evidence: 'UNKNOWN',
      known: 'The relationship between this message and transaction execution is not established.',
      notEstablished: 'Whether the message reports an execution outcome, precedes execution, or bears on execution at all.',
    },
    {
      stage: 'BLOCK_INCLUSION', label: 'Block inclusion', evidence: 'UNKNOWN',
      known: 'Nothing is established until reconciled against a receipt.',
      notEstablished: 'Which slot the transaction appears in, or that it appears at all.',
    },
    {
      stage: 'LEDGER_RECEIPT', label: 'Ledger receipt', evidence: 'CHAIN_PROVEN',
      known: 'Inclusion in a specific slot, the execution outcome, the fee, and that the transaction committed atomically or committed nothing but its fee.',
      notEstablished: 'Submission time, leader ingress, scheduler position, ordering, or contention. A receipt read below finalized can still be reorganised.',
    },
  ],
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
