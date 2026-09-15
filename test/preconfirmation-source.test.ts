import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  HELIUS_EXECUTED_STATUS_CODES, deriveSourceFromStatus, describeAttribution, validatePreconfirmation,
} from '../research/execution-casefile/preconfirmation.ts'
import { BAM_PATH, HELIUS_PATH, pathFor, unknownStageCount } from '../research/execution-casefile/preconfirmation-map.ts'
import { reconcile } from '../research/execution-casefile/reconciliation.ts'
import { preconfirmation, receipt } from '../research/execution-casefile/audit/bam-cases.ts'

const ERR = { InstructionError: [0, { Custom: 6001 }] }

// 1. Generic preconfirmed=true cannot collapse the two semantics.
test('a record cannot exist without retaining which issuer it came from', () => {
  const record = preconfirmation({ statusCode: 0 })
  assert.ok(record.sourceAttribution, 'source attribution is a required field')
  // Helius and BAM are not interchangeable variants: they differ in emission order.
  assert.equal(HELIUS_PATH.emission, 'POST_EXECUTION')
  assert.equal(BAM_PATH.emission, 'COMMIT_TO_EXECUTE')
  assert.notDeepEqual(HELIUS_PATH.stages.map((s) => s.evidence), BAM_PATH.stages.map((s) => s.evidence))
})

// 2. A Helius status-bearing message derives HELIUS / DERIVED.
test('status 0 or 1 derives HELIUS with a DERIVED basis', () => {
  for (const code of HELIUS_EXECUTED_STATUS_CODES) {
    const attribution = deriveSourceFromStatus(code)
    assert.equal(attribution.source, 'HELIUS')
    assert.equal(attribution.basis, 'DERIVED')
    assert.match(attribution.rationale, /no source field/i)
  }
  const result = reconcile({ preconfirmation: preconfirmation({ statusCode: 1 }), receipt: receipt() })
  assert.equal(result.preconfirmationState!.source, 'HELIUS')
  assert.equal(result.preconfirmationState!.sourceBasis, 'DERIVED')
})

// 3. Derived provenance is never rendered as explicit payload provenance.
test('derived attribution is never described as stated by the payload', () => {
  const derived = deriveSourceFromStatus(0)
  assert.match(describeAttribution(derived), /derived from status semantics, not stated by the payload/i)
  // The explicit wording is reserved for an explicit basis and must not describe a derived one.
  const explicitWording = describeAttribution({ ...derived, basis: 'EXPLICIT' })
  assert.match(explicitWording, /— stated by the payload$/)
  assert.notEqual(describeAttribution(derived), explicitWording)
  assert.equal(/— stated by the payload$/.test(describeAttribution(derived)), false)

  // An EXPLICIT basis must carry the field that stated it, or the record is refused.
  const fake = preconfirmation({
    attribution: { source: 'HELIUS', basis: 'EXPLICIT', rationale: 'claimed explicit', provenance: { attestation: 'PROVIDER_REPORTED', source: 'x', method: 'PROVIDER_API_RESPONSE' } },
  })
  assert.throws(() => validatePreconfirmation(fake), /EXPLICIT source basis requires the payload field/i)
})

// 4. A Helius post-execution preconfirmation is never chain-proven or finalized.
test('a Helius preconfirmation is never chain-proven, finalized or ledger-confirmed', () => {
  const result = reconcile({ preconfirmation: preconfirmation({ statusCode: 0 }) })
  assert.equal(result.execution, null, 'no receipt was supplied, so no chain evidence exists')

  const emission = HELIUS_PATH.stages.find((s) => s.stage === 'PRECONFIRMATION_EMISSION')!
  assert.equal(emission.evidence, 'PROVIDER_REPORTED')
  assert.notEqual(emission.evidence, 'CHAIN_PROVEN')
  const execution = HELIUS_PATH.stages.find((s) => s.stage === 'EXECUTION')!
  assert.equal(execution.evidence, 'PROVIDER_REPORTED')
  // Only the ledger stage may be chain-proven.
  for (const stage of HELIUS_PATH.stages) {
    if (stage.evidence === 'CHAIN_PROVEN') assert.equal(stage.stage, 'LEDGER_RECEIPT')
  }
  // A record may not declare chain-proven provenance on any field.
  const bogus = preconfirmation({ statusCode: 0 })
  bogus.signature.provenance.attestation = 'CHAIN_PROVEN'
  assert.throws(() => validatePreconfirmation(bogus), /cannot be CHAIN_PROVEN/i)
})

// 5. BAM ordering and attestation semantics remain UNKNOWN.
test('BAM leader commitment and attestation semantics stay UNKNOWN', () => {
  // SCHEDULER moved off UNKNOWN when Eric described what sequence_id means — but only to
  // PROVIDER_REPORTED, and its authentication is still unestablished (asserted separately below).
  // Everything he did not speak to stays UNKNOWN.
  for (const stage of ['LEADER_COMMITMENT', 'PRECONFIRMATION_EMISSION'] as const) {
    assert.equal(BAM_PATH.stages.find((s) => s.stage === stage)!.evidence, 'UNKNOWN', `${stage} must stay UNKNOWN`)
  }
  assert.equal(BAM_PATH.stages.find((s) => s.stage === 'SCHEDULER')!.evidence, 'PROVIDER_REPORTED')
  const emission = BAM_PATH.stages.find((s) => s.stage === 'PRECONFIRMATION_EMISSION')!
  assert.match(emission.notEstablished, /TEE ordering attestation/i)
  assert.match(emission.notEstablished, /clock domain/i)
  assert.ok(unknownStageCount(BAM_PATH) >= 4, 'most of the BAM path is still not established')
  // The open questions must be asked, not answered.
  assert.ok(BAM_PATH.openQuestions.length >= 8)
  for (const question of BAM_PATH.openQuestions) assert.match(question, /\?$/)
})

// 6. Missing status does NOT imply BAM.
test('absence of the Helius status identifies nothing', () => {
  for (const value of [null, undefined, 2, 7, -1]) {
    const attribution = deriveSourceFromStatus(value as number | null | undefined)
    assert.equal(attribution.source, 'UNKNOWN', `status ${String(value)} must not name an issuer`)
    assert.equal(attribution.basis, 'UNKNOWN')
    assert.equal(attribution.source === 'BAM', false, 'never assigned to BAM by elimination')
  }
  assert.match(deriveSourceFromStatus(null).rationale, /does not identify the issuer/i)
  assert.equal(pathFor('UNKNOWN').source, 'UNKNOWN')
})

// 7. Preconfirmed + missing receipt stays UNRESOLVED by default.
test('a preconfirmation with no receipt is UNRESOLVED, and PENDING only with live deadline semantics', () => {
  const bare = reconcile({ preconfirmation: preconfirmation({ statusCode: 0 }) })
  assert.equal(bare.reconciliation.state, 'UNRESOLVED')
  assert.match(bare.reconciliation.basis, /not evidence the transaction failed to land/i)

  const future = new Date(Date.now() + 3_600_000).toISOString()
  const pending = reconcile({ preconfirmation: preconfirmation({ statusCode: 0, expiresAt: future }) })
  assert.equal(pending.reconciliation.state, 'PENDING')

  const past = new Date(Date.now() - 3_600_000).toISOString()
  const lapsed = reconcile({ preconfirmation: preconfirmation({ statusCode: 0, expiresAt: past }) })
  assert.equal(lapsed.reconciliation.state, 'UNRESOLVED', 'a lapsed deadline is not a mismatch')
  assert.match(lapsed.reconciliation.basis, /not proof the transaction failed to land/i)
})

test('MISMATCH requires a verified commitment contradicted by chain evidence', () => {
  // Unverified assertion + different slot is a discrepancy, not a contradiction.
  const unverified = reconcile({
    preconfirmation: preconfirmation({ statusCode: 0, targetSlot: 4999 }),
    receipt: receipt({ slot: 5000 }), receiptCommitment: 'finalized',
  })
  assert.equal(unverified.reconciliation.state, 'MATCHED')
  assert.notEqual(unverified.reconciliation.state, 'MISMATCH')

  const verified = reconcile({
    preconfirmation: preconfirmation({ statusCode: 0, targetSlot: 4999, proofVerification: 'VERIFIED' }),
    receipt: receipt({ slot: 5000 }), receiptCommitment: 'finalized',
  })
  assert.equal(verified.reconciliation.state, 'MISMATCH')
  assert.match(verified.reconciliation.basis, /verified commitment/i)

  const matched = reconcile({
    preconfirmation: preconfirmation({ statusCode: 0, targetSlot: 5000 }),
    receipt: receipt({ slot: 5000, err: ERR }), receiptCommitment: 'finalized',
  })
  assert.equal(matched.reconciliation.state, 'MATCHED', 'a failed execution is still a matched reconciliation')
  assert.equal(matched.execution!.stateCommitment.outcome, 'NONE_COMMITTED')
})

// 8. UI copy cannot claim verification that does not exist.
test('UI copy never claims verified scheduling, ordering, attestation or signed leader commitment', () => {
  const component = readFileSync('app/research/xray/preinclusion-evidence.tsx', 'utf8')
  const forbidden = [
    /scheduler position is verified/i,
    /ordering is cryptographically proven/i,
    /leader commitment is signed/i,
    /confirmed onchain/i,
    /\bfinalized by the provider\b/i,
  ]
  for (const pattern of forbidden) {
    assert.equal(pattern.test(component), false, `UI copy must not contain ${pattern}`)
  }
  // And it must surface the basis rather than only the source.
  assert.match(component, /sourceBasis/)
  assert.match(component, /sourceDescription/)
})

// 9. Attribution is never lifted to validator-attested or chain-proven.
test('source attribution cannot be recorded as validator-attested or chain-proven', () => {
  for (const attestation of ['VALIDATOR_ATTESTED', 'CHAIN_PROVEN'] as const) {
    const record = preconfirmation({ statusCode: 0 })
    record.sourceAttribution.provenance.attestation = attestation
    assert.throws(() => validatePreconfirmation(record), /cannot be VALIDATOR_ATTESTED or CHAIN_PROVEN/i)
  }
  const contradiction = preconfirmation({
    attribution: { source: 'HELIUS', basis: 'UNKNOWN', rationale: 'x', provenance: { attestation: 'PROVIDER_REPORTED', source: 'y', method: 'PROVIDER_API_RESPONSE' } },
  })
  assert.throws(() => validatePreconfirmation(contradiction), /A named source requires a basis/i)
})

test('the evidence classes are not presented as a confidence ranking', async () => {
  const { MAP_BOUNDARY } = await import('../research/execution-casefile/preconfirmation-map.ts')
  assert.match(MAP_BOUNDARY, /provenance, not a confidence ranking/i)
  assert.match(MAP_BOUNDARY, /UNKNOWN means not established/i)
})

// --- Eric (@gzalz_sol) ordering clarification, 2026-09 ------------------------------------------
// He established what sequence_id describes and a block constraint it implies. He did NOT
// establish that any of it is authenticated. These tests exist to keep those apart.

test('BAM ordering is modelled as protocol-enforced scheduler ordering', async () => {
  const { BAM_ORDERING_EVIDENCE, BAM_PATH } = await import('../research/execution-casefile/preconfirmation-map.ts')
  assert.equal(BAM_ORDERING_EVIDENCE.kind, 'PROTOCOL_ENFORCED_SCHEDULER_ORDERING')
  assert.equal(BAM_PATH.ordering, BAM_ORDERING_EVIDENCE)

  // The claim is a provider statement; only the thing it is checked against is chain-proven.
  assert.equal(BAM_ORDERING_EVIDENCE.claim.evidence, 'PROVIDER_REPORTED')
  assert.equal(BAM_ORDERING_EVIDENCE.check.checkedAgainst, 'CHAIN_PROVEN')
  assert.deepEqual(BAM_ORDERING_EVIDENCE.claim.fields, ['sequence_id', 'bundle_id', 'bundle metadata'])
  assert.match(BAM_ORDERING_EVIDENCE.check.direction, /ex post/i)

  // Eric's second clarification: the ordering is a protocol requirement, not a description.
  assert.match(BAM_ORDERING_EVIDENCE.claim.describes, /originates from the BAM node/i)
  assert.match(BAM_ORDERING_EVIDENCE.claim.describes, /match scheduler-assigned IDs/i)
  assert.match(BAM_ORDERING_EVIDENCE.enforcement.mechanism, /disconnected from BAM/i)
})

// --- enforcement is not verification -----------------------------------------------------------
// The second clarification added a real property (a protocol requirement with a penalty) that is
// easy to over-read as an attestation. These tests hold the two axes apart.

test('enforcement by disconnection is recorded as enforcement, never as verification', async () => {
  const { BAM_ORDERING_EVIDENCE } = await import('../research/execution-casefile/preconfirmation-map.ts')
  const { enforcement } = BAM_ORDERING_EVIDENCE

  // Who enforces, and by what means. Not a check a third party can run.
  assert.match(enforcement.enforcedBy, /BAM itself/i)
  assert.match(enforcement.enforcedBy, /Not by a cryptographic check a third party can run/i)

  // Each limit the model is required to carry.
  const limits = enforcement.limits.join(' ')
  assert.match(limits, /deters violation; it does not verify any particular claim/i)
  assert.match(limits, /only as strong as BAM's own detection/i)
  assert.match(limits, /after the fact/i, 'disconnection does not undo an ordering already in a block')
  assert.match(limits, /does not undo an ordering that already reached a block/i)
  assert.match(limits, /signed, attested, or attributable to a key/i)

  // And the refusal list must say so in its own right.
  const refusals = BAM_ORDERING_EVIDENCE.doesNotEstablish.join(' ')
  assert.match(refusals, /enforcement is verification/i)
})

test('the enforcement clarification does not lift authentication or any stage class', async () => {
  const { BAM_ORDERING_EVIDENCE, BAM_PATH, PATHS } = await import('../research/execution-casefile/preconfirmation-map.ts')
  // The user's explicit constraint: no VALIDATOR_ATTESTED, no "independently verified", until the
  // verification mechanism itself is evidenced.
  assert.equal(BAM_ORDERING_EVIDENCE.authentication, 'NOT_ESTABLISHED')
  for (const path of PATHS) {
    for (const stage of path.stages) {
      assert.notEqual(stage.evidence, 'VALIDATOR_ATTESTED', `${path.source}/${stage.stage} must not be validator-attested`)
    }
  }
  // The open question asking for such a mechanism must still be open.
  const open = BAM_PATH.openQuestions.join(' ')
  assert.match(open, /verification a third party can run against a single preconfirmation/i)
  assert.match(open, /as opposed to the operational enforcement of disconnection/i)
})

// --- BAM semantics render only after positive BAM attribution ----------------------------------

test('BAM semantics are reachable only through a positive BAM attribution', async () => {
  const map = await import('../research/execution-casefile/preconfirmation-map.ts')
  const { pathFor, BAM_PATH, BAM_ORDERING_EVIDENCE } = map

  // The precondition is stated on the evidence itself, not left implicit.
  assert.match(BAM_ORDERING_EVIDENCE.precondition, /POSITIVELY IDENTIFIED BAM preconfirmation/)
  assert.match(BAM_ORDERING_EVIDENCE.precondition, /never reached by elimination/i)

  // Positive attribution is the only input that yields them.
  assert.equal(pathFor('BAM'), BAM_PATH)
  assert.ok(BAM_PATH.ordering)

  // Every other source value yields a path carrying none of it.
  for (const source of ['HELIUS', 'UNKNOWN'] as const) {
    const path = pathFor(source)
    assert.notEqual(path, BAM_PATH)
    assert.equal(path.ordering, undefined, `${source} must carry no ordering evidence`)
    const rendered = JSON.stringify(path)
    for (const pattern of [
      /\bBAM\b/, /sequence_id/i, /bundle_id/i, /bundle metadata/i, /dispatch order/i,
      /scheduler-assigned/i, /disconnect/i, /commit[- ]to[- ]execute/i,
    ]) {
      assert.equal(pattern.test(rendered), false, `${source} path must not contain ${pattern}`)
    }
  }
})

test('enforcement vocabulary never reaches an unattributed record', async () => {
  const { UNATTRIBUTED_PATH, pathFor } = await import('../research/execution-casefile/preconfirmation-map.ts')
  const rendered = JSON.stringify(pathFor('UNKNOWN'))
  assert.equal(JSON.stringify(UNATTRIBUTED_PATH), rendered)
  // Specific to the second clarification: none of its vocabulary may leak by resemblance.
  for (const pattern of [
    /disconnected/i, /protocol[- ]enforced/i, /scheduler-assigned/i, /violating leaders/i,
    /produced[- ]block/i, /ascending/i, /atomically bundled/i,
  ]) {
    assert.equal(pattern.test(rendered), false, `unattributed path must not contain ${pattern}`)
  }
  // The unattributed path says only that no scheduling semantics are established.
  const scheduler = UNATTRIBUTED_PATH.stages.find((s) => s.stage === 'SCHEDULER')!
  assert.equal(scheduler.evidence, 'UNKNOWN')
  assert.match(scheduler.known, /No scheduling semantics are established/i)
})

test('verifiable-by-reconciliation is never collapsed into cryptographically attested', async () => {
  const { BAM_ORDERING_EVIDENCE, BAM_PATH } = await import('../research/execution-casefile/preconfirmation-map.ts')

  // Authentication is a separate axis and stays open.
  assert.equal(BAM_ORDERING_EVIDENCE.authentication, 'NOT_ESTABLISHED')
  assert.notEqual(BAM_ORDERING_EVIDENCE.claim.evidence, 'VALIDATOR_ATTESTED')
  assert.notEqual(BAM_ORDERING_EVIDENCE.claim.evidence, 'CHAIN_PROVEN')

  // The refusals must name each thing Eric did not establish.
  const refusals = BAM_ORDERING_EVIDENCE.doesNotEstablish.join(' ')
  assert.match(refusals, /cryptographically authenticated, signed, or attributable to a key/i)
  assert.match(refusals, /validator attestation/i)
  assert.match(refusals, /TEE ordering attestation/i)
  assert.match(refusals, /clock or slot semantics/i)
  // Consistency is not authenticity: the trap this whole model exists to avoid.
  assert.match(refusals, /consistency is not authenticity/i)

  // No stage may be lifted to an attested class by the ordering clarification.
  for (const stage of BAM_PATH.stages) {
    if (stage.evidence === 'VALIDATOR_ATTESTED') assert.fail(`${stage.stage} must not be validator-attested`)
    if (stage.evidence === 'CHAIN_PROVEN') assert.equal(stage.stage, 'LEDGER_RECEIPT')
  }
})

test('the block check falsifies but does not authenticate, and only binds same-account writers', async () => {
  const { BAM_ORDERING_EVIDENCE } = await import('../research/execution-casefile/preconfirmation-map.ts')
  assert.match(BAM_ORDERING_EVIDENCE.check.scope, /same account/i)
  assert.match(BAM_ORDERING_EVIDENCE.check.scope, /unfalsifiable/i, 'the unconstrained case must be stated')
  assert.match(BAM_ORDERING_EVIDENCE.check.method, /ascending sequence_id/i)
  // What it does establish is real and must not be understated either.
  const establishes = BAM_ORDERING_EVIDENCE.establishes.join(' ')
  assert.match(establishes, /falsifiable against chain data/i)
  assert.match(establishes, /atomically bundled/i)
})

test('the scheduler stage reports the claim without asserting it is authenticated', async () => {
  const { BAM_PATH } = await import('../research/execution-casefile/preconfirmation-map.ts')
  const scheduler = BAM_PATH.stages.find((s) => s.stage === 'SCHEDULER')!
  assert.equal(scheduler.evidence, 'PROVIDER_REPORTED', 'no longer UNKNOWN, and not attested either')
  assert.match(scheduler.known, /dispatch ordering/i)
  assert.match(scheduler.notEstablished, /authenticated, signed, or attributable to any key/i)
  assert.match(scheduler.notEstablished, /does not establish who made it/i)

  // Emission stays UNKNOWN: knowing what a field means is not knowing it is signed.
  const emission = BAM_PATH.stages.find((s) => s.stage === 'PRECONFIRMATION_EMISSION')!
  assert.equal(emission.evidence, 'UNKNOWN')
  assert.match(emission.notEstablished, /what key or signature would authenticate them/i)
})

test('no surface describes BAM ordering with attestation vocabulary', async () => {
  const map = readFileSync('research/execution-casefile/preconfirmation-map.ts', 'utf8')
  const memo = readFileSync('docs/preconfirmation-evidence-map-v0.md', 'utf8')
  // Phrases that would overstate Eric's clarification, in any assertive form.
  const forbidden = [
    /sequence_id is (?:cryptographically )?(?:signed|attested|authenticated)/i,
    /bundle (?:id|metadata) is (?:cryptographically )?(?:signed|attested|authenticated)/i,
    /cryptographically attested ordering/i,
    /ordering is proven/i,
    /TEE[- ]attested (?:sequence|ordering|bundle)/i,
  ]
  for (const pattern of forbidden) {
    assert.equal(pattern.test(map), false, `map must not contain ${pattern}`)
    assert.equal(pattern.test(memo), false, `memo must not contain ${pattern}`)
  }
})

// --- an unattributed record must not inherit any issuer's semantics ----------------------------

test('an UNKNOWN source never renders BAM-specific lifecycle semantics', async () => {
  const { UNATTRIBUTED_PATH, pathFor } = await import('../research/execution-casefile/preconfirmation-map.ts')
  const path = pathFor('UNKNOWN')
  assert.equal(path, UNATTRIBUTED_PATH)

  // Everything the unattributed path would render, as one blob.
  const rendered = JSON.stringify(path)
  const bamSpecific = [
    /BAM node/i,
    /commit[- ]to[- ]execute/i,
    /sequence_id/i,
    /bundle metadata/i,
    /bundle position/i,
    /atomically bundled/i,
    /dispatch order/i,
    /ascending/i,
    /scheduler to leader/i,
    /\bBAM\b/,
  ]
  for (const pattern of bamSpecific) {
    assert.equal(pattern.test(rendered), false, `unattributed path must not contain ${pattern}`)
  }
  // And it carries no ordering evidence, since none is established for it.
  assert.equal(path.ordering, undefined)
})

test('the unattributed path shares no stage prose with the BAM path', async () => {
  const { BAM_PATH, UNATTRIBUTED_PATH } = await import('../research/execution-casefile/preconfirmation-map.ts')
  // Guards against the original defect: deriving the unattributed stages from BAM_PATH and
  // overriding only the evidence class, which left BAM's wording behind.
  //
  // Only the issuer-SPECIFIC stages must differ. Submission, block inclusion and the ledger receipt
  // are issuer-neutral — "that any packet left the machine" is equally true whoever issued the
  // message — so identical wording there is correct rather than inherited. The exemption is
  // checked below rather than assumed, so it cannot become a hiding place.
  const ISSUER_SPECIFIC = ['SCHEDULER', 'LEADER_COMMITMENT', 'PRECONFIRMATION_EMISSION', 'EXECUTION'] as const
  for (const stage of UNATTRIBUTED_PATH.stages) {
    const bam = BAM_PATH.stages.find((entry) => entry.stage === stage.stage)
    if (!bam) continue
    if ((ISSUER_SPECIFIC as readonly string[]).includes(stage.stage)) {
      assert.notEqual(stage.known, bam.known, `${stage.stage} known text is inherited from BAM`)
      assert.notEqual(stage.notEstablished, bam.notEstablished, `${stage.stage} notEstablished is inherited from BAM`)
    } else {
      // Exempt stages may match, but only because they name no issuer and no mechanism.
      const text = `${stage.known} ${stage.notEstablished}`
      for (const pattern of [/\bBAM\b/, /sequence_id/i, /bundle/i, /dispatch/i, /commit[- ]to[- ]execute/i, /post[- ]execution/i]) {
        assert.equal(pattern.test(text), false, `${stage.stage} is exempt but contains issuer vocabulary ${pattern}`)
      }
    }
  }
})

test('each unattributed stage states what is not established rather than describing a mechanism', async () => {
  const { UNATTRIBUTED_PATH } = await import('../research/execution-casefile/preconfirmation-map.ts')
  const byStage = Object.fromEntries(UNATTRIBUTED_PATH.stages.map((s) => [s.stage, s]))

  assert.match(byStage.SCHEDULER.known, /No scheduling semantics are established/i)
  assert.match(byStage.SCHEDULER.known, /do not identify an issuer or prove ordering/i)
  assert.match(byStage.LEADER_COMMITMENT.known, /No leader commitment is established/i)
  assert.match(byStage.PRECONFIRMATION_EMISSION.known, /issuer, emission boundary and cryptographic commitment semantics are not established/i)
  assert.match(byStage.EXECUTION.known, /relationship between this message and transaction execution is not established/i)
  assert.match(byStage.BLOCK_INCLUSION.known, /until reconciled against a receipt/i)

  // The ledger stage stays chain-proven; the client's own submission stays client-observed.
  assert.equal(byStage.LEDGER_RECEIPT.evidence, 'CHAIN_PROVEN')
  assert.equal(byStage.SUBMISSION.evidence, 'CLIENT_OBSERVED')
  for (const stage of ['SCHEDULER', 'LEADER_COMMITMENT', 'PRECONFIRMATION_EMISSION', 'EXECUTION', 'BLOCK_INCLUSION'] as const) {
    assert.equal(byStage[stage].evidence, 'UNKNOWN', `${stage} must be UNKNOWN on an unattributed record`)
  }
})

test('Eric\'s BAM semantics remain available on the positively identified BAM path', async () => {
  const { BAM_PATH, pathFor } = await import('../research/execution-casefile/preconfirmation-map.ts')
  assert.equal(pathFor('BAM'), BAM_PATH)
  const scheduler = BAM_PATH.stages.find((s) => s.stage === 'SCHEDULER')!
  assert.match(scheduler.known, /BAM node's dispatch ordering/i)
  assert.equal(scheduler.evidence, 'PROVIDER_REPORTED')
  assert.ok(BAM_PATH.ordering, 'ordering evidence stays attached to the identified BAM path')
})

test('the Helius path is unchanged by the unattributed fix', async () => {
  const { HELIUS_PATH, pathFor } = await import('../research/execution-casefile/preconfirmation-map.ts')
  assert.equal(pathFor('HELIUS'), HELIUS_PATH)
  assert.equal(HELIUS_PATH.emission, 'POST_EXECUTION')
  const byStage = Object.fromEntries(HELIUS_PATH.stages.map((s) => [s.stage, s]))
  assert.equal(byStage.EXECUTION.evidence, 'PROVIDER_REPORTED')
  assert.equal(byStage.PRECONFIRMATION_EMISSION.evidence, 'PROVIDER_REPORTED')
  assert.equal(byStage.SCHEDULER.evidence, 'UNKNOWN')
  assert.equal(byStage.LEDGER_RECEIPT.evidence, 'CHAIN_PROVEN')
  assert.equal(HELIUS_PATH.ordering, undefined)
})

// --- rendering gate: what a viewer would actually see ------------------------------------------
// The tests above check the map. These check the reconciler output the UI renders from, because
// that is the surface a reader sees and the place a leak would actually reach them.

test('the rendered evidence map carries BAM semantics only for a positively attributed record', () => {
  // A record that positively names BAM, with the explicit field that basis requires.
  const attributed = reconcile({
    preconfirmation: preconfirmation({
      attribution: {
        source: 'BAM', basis: 'EXPLICIT', explicitField: { key: 'source', value: 'bam' },
        rationale: 'The payload named its own source.',
        provenance: { attestation: 'PROVIDER_REPORTED', source: 'payload', method: 'PROVIDER_API_RESPONSE' },
      },
    }),
    receipt: receipt(),
  })
  assert.equal(attributed.evidenceMap!.source, 'BAM')
  assert.ok(attributed.evidenceMap!.ordering, 'the ordering block renders for an attributed record')
  assert.match(attributed.evidenceMap!.ordering!.headline, /Protocol-enforced scheduler ordering/i)
  assert.match(attributed.evidenceMap!.ordering!.boundary, /Enforced is not verified/i)
  assert.ok(attributed.evidenceMap!.ordering!.enforcement.limits.length >= 4)
  assert.equal(attributed.evidenceMap!.ordering!.authentication, 'NOT_ESTABLISHED')

  // The same shape of record with no established issuer renders none of it.
  const unattributed = reconcile({ preconfirmation: preconfirmation({ statusCode: 7 }), receipt: receipt() })
  assert.equal(unattributed.evidenceMap!.source, 'UNKNOWN')
  assert.equal(unattributed.evidenceMap!.ordering, undefined)
  const rendered = JSON.stringify(unattributed.evidenceMap)
  for (const pattern of [
    /\bBAM\b/, /sequence_id/i, /bundle_id/i, /protocol[- ]enforced/i, /disconnect/i,
    /scheduler-assigned/i, /commit[- ]to[- ]execute/i, /atomically bundled/i,
  ]) {
    assert.equal(pattern.test(rendered), false, `an unattributed render must not contain ${pattern}`)
  }

  // And a Helius record renders its own semantics, not BAM's.
  const helius = reconcile({ preconfirmation: preconfirmation({ statusCode: 0 }), receipt: receipt() })
  assert.equal(helius.evidenceMap!.source, 'HELIUS')
  assert.equal(helius.evidenceMap!.ordering, undefined)
  assert.equal(/\bBAM\b/.test(JSON.stringify(helius.evidenceMap)), false)
})
