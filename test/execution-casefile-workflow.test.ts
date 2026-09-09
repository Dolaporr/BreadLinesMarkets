import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCaseFile, type CaseFile, type Receipt } from '../research/execution-casefile/core.ts'
import { inspectAccounts, decimalAmount, projectFrames } from '../research/execution-casefile/inspection.ts'
import { evidenceBundle, openEvidence, receiptHash } from '../research/execution-casefile/bundle.ts'
import { demoTrace } from '../research/execution-casefile/trace.ts'

const library = JSON.parse(readFileSync('research/execution-casefile/generated/library.json', 'utf8')) as { cases: CaseFile[] }
const raw = () => structuredClone(library.cases[0].receipt)
const build = (r: Receipt) => buildCaseFile(r, { source: 'offline test fixture', sha256: null })

test('all retained legacy/v0 receipts remain accepted; v1 and unrecognized versions fail closed', () => {
  for (const c of library.cases) assert.equal(build(c.receipt).signature, c.signature)
  for (const version of [1, 2, -1, '0', null]) {
    assert.throws(() => build({ ...raw(), version } as Receipt), /Unsupported transaction version/)
  }
  const r = raw(); delete r.version
  assert.match(inspectAccounts(build(r)).version, /Unspecified/)
  assert.throws(() => build({ ...r, transactionConfig: {} } as Receipt), /configuration/)
  Object.assign(r.transaction!.message!, { config: {} })
  assert.throws(() => build(r), /configuration/)
})

test('lamport arithmetic is exact; missing or unsafe values never become zero', () => {
  const r = raw()
  Object.assign(r.meta!, { preBalances: [1000000001, 300, Number.MAX_SAFE_INTEGER + 1], postBalances: [999995001, 300, 1] })
  const a = inspectAccounts(build(r)).accounts
  assert.equal(a[0].deltaLamports, '-5000'); assert.equal(decimalAmount(a[0].deltaLamports, 9), '-0.000005')
  assert.equal(a[1].deltaLamports, '0'); assert.equal(a[2].deltaLamports, null); assert.equal(a[3].deltaLamports, null)
  assert.equal(decimalAmount('18446744073709551615', 9), '18446744073.709551615')
  assert.equal(decimalAmount(null, 9), 'Unavailable')
})

test('priority derivation requires unique supported limits/prices and safe arithmetic', () => {
  const r = raw(), programId = 'ComputeBudget111111111111111111111111111111'
  const limit = (units: number) => ({ programId, parsed: { type: 'setComputeUnitLimit', info: { units } } })
  const price = (microLamports: number) => ({ programId, parsed: { type: 'setComputeUnitPrice', info: { microLamports } } })
  r.meta!.err = null; r.meta!.logMessages = []; r.meta!.fee = 5100
  r.transaction!.message!.instructions = [limit(100000), price(1000)]
  assert.equal(build(r).metrics.priority.amountLamports, 100)
  r.transaction!.message!.instructions = [limit(1400001), price(1000)]
  assert.equal(build(r).metrics.priority.amountLamports, null)
  r.transaction!.message!.instructions = [limit(100000), limit(100000), price(1000)]
  assert.equal(build(r).metrics.priority.amountLamports, null)
  r.transaction!.message!.instructions = [limit(100000), price(Number.MAX_SAFE_INTEGER)]
  assert.equal(build(r).metrics.priority.amountLamports, null)
  r.transaction!.message!.instructions = [price(1000)]
  assert.equal(build(r).metrics.priority.amountLamports, null)
})

test('token balances use raw integer strings and matching decimals; absent entries and duplicates abstain', () => {
  const r = raw(), entry = (amount: string, decimals = 6) => ({ accountIndex: 0, mint: 'mint-test', uiTokenAmount: { amount, decimals } })
  Object.assign(r.meta!, { preTokenBalances: [entry('10000000000000000001')], postTokenBalances: [entry('10000000000000000000')] })
  assert.equal(inspectAccounts(build(r)).tokens[0].deltaRaw, '-1')
  Object.assign(r.meta!, { postTokenBalances: [] })
  assert.equal(inspectAccounts(build(r)).tokens[0].deltaRaw, null)
  Object.assign(r.meta!, { postTokenBalances: [entry('1', 9)] })
  assert.equal(inspectAccounts(build(r)).tokens[0].deltaRaw, null)
  Object.assign(r.meta!, { postTokenBalances: [entry('1'), entry('1')] })
  assert.equal(inspectAccounts(build(r)).tokens[0].deltaRaw, null)
})

test('account flags and references are independent from balance availability', () => {
  const r = raw(); r.transaction!.message!.accountKeys = [{ pubkey: 'A', signer: true, writable: true }, { pubkey: 'B', signer: false, writable: false }]
  r.transaction!.message!.instructions = [{ programId: 'B', accounts: [0] } as never]
  r.meta!.err = null; r.meta!.logMessages = []
  const a = inspectAccounts(build(r)).accounts
  assert.equal(a[0].signer, true); assert.equal(a[1].writable, false); assert.deepEqual(a[0].outerReferences, [1]); assert.deepEqual(a[1].outerReferences, [])
})

test('export and reopen all retained cases: preserve raw evidence/context and recompute interpretation', async () => {
  for (const saved of library.cases) {
    const result = await openEvidence(evidenceBundle(saved, null, false))
    assert.equal(result.caseFile.signature, saved.signature)
    assert.deepEqual(result.caseFile.receipt, saved.receipt)
    assert.deepEqual(result.caseFile.context, saved.context)
    assert.equal(result.caseFile.provenance.sha256, saved.provenance.sha256)
    assert.match(result.caseFile.provenance.verification, /not independently authenticated/)
  }
})

test('bundle import never trusts saved narrative or failure paths; receipt tampering is rejected', async () => {
  const b = evidenceBundle(structuredClone(library.cases[0]), null, false)
  b.caseFile.explanation = 'Provider caused the failure'; b.caseFile.execution.failurePath = []
  const result = await openEvidence(b)
  assert.doesNotMatch(result.caseFile.explanation, /Provider/); assert.equal(result.caseFile.execution.failurePath.length, 2)
  b.caseFile.receipt.slot++
  await assert.rejects(openEvidence(b), /checksum/)
})

test('context inconsistencies and unsupported bundles cannot silently enter the workspace', async () => {
  const b = evidenceBundle(structuredClone(library.cases[1]), null, false)
  b.caseFile.context.overlaps.push(b.caseFile.context.overlaps[0])
  await assert.rejects(openEvidence(b), /identities/)
  await assert.rejects(openEvidence({ format: 'breadlines-evidence-bundle', version: 2 }), /version/)
  const bad = evidenceBundle(structuredClone(library.cases[1]), null, false)
  bad.caseFile.context.accounts[0].signatures = []
  await assert.rejects(openEvidence(bad), /index/)
})

test('trace export is opt-in and synthetic traces cannot join a real receipt', async () => {
  assert.equal(evidenceBundle(library.cases[0], demoTrace(), false).applicationTrace, null)
  assert.throws(() => evidenceBundle(library.cases[0], demoTrace(), true))
  const b = evidenceBundle(library.cases[0], null, false)
  await assert.rejects(openEvidence({ ...b, applicationTrace: demoTrace() }))
})

test('plain receipt import hashes original JSON and has no invented neighboring context', async () => {
  const r = raw(), result = await openEvidence({ result: r })
  assert.equal(result.caseFile.context.coverage, 'UNAVAILABLE')
  assert.equal(result.caseFile.context.count, null)
  assert.equal(result.caseFile.provenance.sha256, await receiptHash(r))
})

test('spatial graph changes only coordinates, keeps frame identity and stays deterministic', () => {
  const frames = library.cases[0].execution.frames, before = JSON.stringify(frames)
  const a = projectFrames(frames, -18, true), b = projectFrames(frames, 20, true)
  assert.deepEqual(a, projectFrames(frames, -18, true)); assert.notDeepEqual(a, b)
  assert.deepEqual(a.map(p => p.id), frames.map(f => f.id))
  assert.equal(JSON.stringify(frames), before)
  assert.ok(a.every(p => p.x >= 0 && p.x <= 900 && p.y >= 0 && p.y <= 340))
})
