import { z } from 'zod'

/**
 * Pre-inclusion evidence: what was known about a transaction BEFORE a ledger receipt existed.
 *
 * The organising rule is that nothing here is chain-proven. A preconfirmation is a statement made
 * by some party at some time, and the schema's job is to keep who said it, when, and on whose
 * clock inseparable from the value itself. Two collapses are structurally prevented:
 *
 *  1. A provider's assertion is never recorded as a validator-authenticated fact. An attestation
 *     blob being PRESENT is not attestation — only a signature verified against an identified key
 *     earns VALIDATOR_ATTESTED, and this module performs no verification, so nothing it produces
 *     reaches that class on its own.
 *  2. A timestamp is meaningless without its clock. Every time field carries a clock domain, and
 *     durations across domains are refused rather than computed.
 */
export const PRECONFIRMATION_VERSION = 'breadlines-preconfirmation-v1' as const

/**
 * How strongly a single field is evidenced. Ordered weakest to strongest; nothing in this module
 * promotes a field up this ladder.
 */
export const ATTESTATION_CLASSES = ['CLIENT_OBSERVED', 'PROVIDER_REPORTED', 'VALIDATOR_ATTESTED', 'CHAIN_PROVEN'] as const
export type AttestationClass = (typeof ATTESTATION_CLASSES)[number]

const id = z.string().regex(/^[a-zA-Z0-9_.:\-]{1,100}$/)
const signature = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/)
const attestationClass = z.enum(ATTESTATION_CLASSES)

/** Provenance travels with every field. A value without one cannot be recorded. */
const provenance = z.object({
  attestation: attestationClass,
  /** Who asserted this. A stable non-secret label, never an endpoint URL or credential. */
  source: id,
  /** How this reached us: an API response, a local measurement, a signed document. */
  method: z.enum(['LOCAL_MEASUREMENT', 'PROVIDER_API_RESPONSE', 'SIGNED_DOCUMENT', 'LEDGER_QUERY']),
  /** Free-text note for anything a reader needs in order to not over-read the value. */
  note: z.string().max(500).optional(),
}).strict()

/**
 * A timestamp is a value plus the clock it came from. Domains are opaque labels: two readings are
 * comparable only when their domain strings are identical.
 */
const timestamp = z.object({
  value: z.string().datetime(),
  clockDomain: id,
  provenance,
}).strict()

const monotonic = z.object({
  elapsedMs: z.number().finite().nonnegative(),
  clockDomain: id,
  provenance,
}).strict()

const field = <T extends z.ZodTypeAny>(inner: T) => z.object({ value: inner, provenance }).strict()

/**
 * A cryptographic attestation as SUPPLIED. `verification` is the only thing that decides whether
 * it counts, and it starts at NOT_VERIFIED: this module has no key material and verifies nothing.
 * A caller that genuinely verifies a signature sets VERIFIED and records the verifying key.
 */
const attestationProof = z.object({
  scheme: id,
  /** Base64 signature bytes as supplied. Never parsed or trusted here. */
  signature: z.string().min(1).max(4096),
  /** The key the issuer claims signed it. A claim, not a verified identity. */
  claimedSignerKey: z.string().min(1).max(200),
  /** Exactly what the signature is said to cover. Without this the blob proves nothing. */
  signedPayloadDescription: z.string().min(1).max(1000),
  verification: z.enum(['NOT_VERIFIED', 'VERIFIED', 'VERIFICATION_FAILED']).default('NOT_VERIFIED'),
  verifiedAgainstKey: z.string().max(200).nullable().default(null),
  provenance,
}).strict()

const preconfirmationSchema = z.object({
  schemaVersion: z.literal(PRECONFIRMATION_VERSION),
  /** True marks a fixture. Fixtures are for tests and demonstrations and are never product evidence. */
  synthetic: z.boolean(),

  // --- identity -------------------------------------------------------------------------------
  /** The signature the preconfirmation is ABOUT. A provider asserting it is not proof it exists. */
  signature: field(signature),
  /** Optional message hash, which survives a rebuild that changes the signature. */
  messageHash: field(z.string().regex(/^[a-f0-9]{64}$/)).optional(),
  /** The sender's own attempt id, for joining to an attempt trace. */
  attemptId: field(id).optional(),

  // --- who said it ----------------------------------------------------------------------------
  provider: z.object({
    label: id,
    /** The product or protocol named by the provider, verbatim. Not interpreted. */
    productName: z.string().max(200).optional(),
    provenance,
  }).strict(),

  // --- when, on whose clock -------------------------------------------------------------------
  senderLocalObservedAt: timestamp.optional(),
  senderLocalElapsed: monotonic.optional(),
  providerObservedAt: timestamp.optional(),
  /** The provider's own stated issue time, which may differ from when we observed it. */
  providerIssuedAt: timestamp.optional(),

  // --- ledger clock, if the issuer exposed one ------------------------------------------------
  /** The slot the issuer names. An assertion until a receipt lands. */
  targetSlot: field(z.number().int().nonnegative()).optional(),
  /** A block time the issuer names. Ledger block time is an estimate, not a wall clock. */
  slotTimestamp: timestamp.optional(),

  // --- what was asserted ----------------------------------------------------------------------
  /**
   * The issuer's own level string, kept VERBATIM. Deliberately not mapped onto Solana's
   * processed/confirmed/finalized: a provider's "preconfirmed" is not a commitment level, and
   * normalising it here would manufacture the equivalence this schema exists to prevent.
   */
  assertedLevel: field(z.string().min(1).max(100)),
  /** Scheduling or acceptance status, verbatim, if exposed. */
  schedulingStatus: field(z.string().min(1).max(200)).optional(),
  /** A deadline the issuer exposed, after which it no longer stands behind the assertion. */
  expiresAt: timestamp.optional(),
  expiryBlockHeight: field(z.number().int().nonnegative()).optional(),

  // --- proof, if any --------------------------------------------------------------------------
  attestationProof: attestationProof.optional(),

  /** Anything the issuer returned that this schema does not model, kept as opaque strings. */
  unmodelledFields: z.array(z.object({ key: id, value: z.string().max(1000) }).strict()).max(50).default([]),
}).strict()

export type PreconfirmationRecord = z.infer<typeof preconfirmationSchema>

/** The strongest class this record actually earns. Never higher than what is present and verified. */
export function effectiveAttestation(record: PreconfirmationRecord): AttestationClass {
  const proof = record.attestationProof
  if (proof && proof.verification === 'VERIFIED') return 'VALIDATOR_ATTESTED'
  // An unverified or failed proof does not raise the record above what the provider merely said.
  return 'PROVIDER_REPORTED'
}

export function validatePreconfirmation(value: unknown): PreconfirmationRecord {
  const record = preconfirmationSchema.parse(value)

  // A record may not claim chain-proven status. Nothing pre-inclusion is on the ledger.
  const declared = [
    record.signature.provenance, record.provider.provenance, record.assertedLevel.provenance,
    record.messageHash?.provenance, record.attemptId?.provenance, record.targetSlot?.provenance,
    record.schedulingStatus?.provenance, record.expiryBlockHeight?.provenance,
    record.senderLocalObservedAt?.provenance, record.providerObservedAt?.provenance,
    record.providerIssuedAt?.provenance, record.slotTimestamp?.provenance,
    record.expiresAt?.provenance, record.attestationProof?.provenance,
  ].filter(Boolean) as Array<z.infer<typeof provenance>>
  if (declared.some((entry) => entry.attestation === 'CHAIN_PROVEN')) {
    throw new Error('Pre-inclusion evidence cannot be CHAIN_PROVEN. Nothing before a receipt is on the ledger.')
  }

  // VALIDATOR_ATTESTED requires a proof that was actually verified against a named key.
  const proof = record.attestationProof
  const claimsAttested = declared.some((entry) => entry.attestation === 'VALIDATOR_ATTESTED')
  if (claimsAttested && !(proof && proof.verification === 'VERIFIED' && proof.verifiedAgainstKey)) {
    throw new Error('VALIDATOR_ATTESTED requires an attestationProof with verification VERIFIED and a verifiedAgainstKey. A supplied signature is not a verified one.')
  }
  if (proof?.verification === 'VERIFIED' && !proof.verifiedAgainstKey) {
    throw new Error('A VERIFIED attestation must name the key it was verified against.')
  }

  // A sender-local reading and a provider reading are different clocks unless the caller says
  // otherwise. Sharing a domain label across both is almost always a mistake, so it must be
  // deliberate: the note field is where a caller explains a genuinely shared clock.
  const senderDomain = record.senderLocalObservedAt?.clockDomain ?? record.senderLocalElapsed?.clockDomain
  const providerDomain = record.providerObservedAt?.clockDomain ?? record.providerIssuedAt?.clockDomain
  if (senderDomain && providerDomain && senderDomain === providerDomain
    && !record.senderLocalObservedAt?.provenance.note && !record.senderLocalElapsed?.provenance.note) {
    throw new Error('Sender and provider timestamps share a clock domain without explanation. Record separate domains, or use the provenance note to state why one clock genuinely covers both.')
  }
  return record
}

/**
 * A duration between two readings, refused unless they share a clock domain.
 *
 * This is the guard that keeps "the provider saw it 40ms after we sent it" from being computed out
 * of two unrelated clocks. Cross-domain skew is unbounded and unmeasurable from the readings alone.
 */
export function durationBetween(
  from: { value: string; clockDomain: string },
  to: { value: string; clockDomain: string },
): { ms: number; comparable: true } | { ms: null; comparable: false; reason: string } {
  if (from.clockDomain !== to.clockDomain) {
    return {
      ms: null, comparable: false,
      reason: `Readings are on different clock domains (${from.clockDomain} vs ${to.clockDomain}). The offset between them is unknown and is not recoverable from the readings, so no duration is reported.`,
    }
  }
  return { ms: new Date(to.value).getTime() - new Date(from.value).getTime(), comparable: true }
}

/** What a preconfirmation record may never be read as, regardless of what it contains. */
export const PRECONFIRMATION_PROHIBITED_READINGS = [
  'The transaction landed. A preconfirmation is an assertion about the future, and only a receipt shows a result.',
  'The transaction will land in the named slot, or in any slot.',
  'The transaction executed, or that any state changed.',
  'A provider-reported timestamp records when a leader received the transaction.',
  'A gap between a sender timestamp and a provider timestamp measures network latency, provider delay, or queueing.',
  'A supplied attestation signature has been verified, or that the named signer produced it.',
  'The absence of a preconfirmation means the transaction was dropped, delayed, or deprioritised.',
  'A scheduling status names a position in any queue relative to other transactions.',
] as const
