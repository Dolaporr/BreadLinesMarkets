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

test('BAM ordering is modelled as dispatch ordering with an ex-post block constraint', async () => {
  const { BAM_ORDERING_EVIDENCE, BAM_PATH } = await import('../research/execution-casefile/preconfirmation-map.ts')
  assert.equal(BAM_ORDERING_EVIDENCE.kind, 'SCHEDULER_DISPATCH_WITH_EX_POST_BLOCK_CONSTRAINT')
  assert.equal(BAM_PATH.ordering, BAM_ORDERING_EVIDENCE)

  // The claim is a provider statement; only the thing it is checked against is chain-proven.
  assert.equal(BAM_ORDERING_EVIDENCE.claim.evidence, 'PROVIDER_REPORTED')
  assert.equal(BAM_ORDERING_EVIDENCE.check.checkedAgainst, 'CHAIN_PROVEN')
  assert.deepEqual(BAM_ORDERING_EVIDENCE.claim.fields, ['sequence_id', 'bundle metadata'])
  assert.match(BAM_ORDERING_EVIDENCE.check.direction, /ex post/i)
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
