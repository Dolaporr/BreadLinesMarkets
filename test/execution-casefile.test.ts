import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildCaseFile, normalizeReceipt, parseFrames, type Receipt } from '../research/execution-casefile/core.ts'
import { createTraceRecorder, demoTrace, summarizeTrace, traceMatchesReceipt, validateTrace } from '../research/execution-casefile/trace.ts'

const P = 'JTXJTXfr1wVRMEzqiPhXUr69zJtfGuLh5qEiXG772Zj', S = '11111111111111111111111111111111'
function receipt(logs: string[], err: unknown = { InstructionError: [0, { Custom: 1 }] }): Receipt {
  return { slot: 42, meta: { err, logMessages: logs }, transaction: { signatures: ['3'.repeat(88)], message: {
    accountKeys: [{ pubkey: P, writable: true, signer: true }], instructions: [{ programId: P }, { programId: S }] } } }
}
const provenance = { source: 'test fixture', sha256: null }
test('caught child failure is not promoted to final failure on a successful transaction', () => {
  const c = buildCaseFile(receipt([`Program ${P} invoke [1]`, `Program ${S} invoke [2]`, `Program ${S} failed: custom program error: 0x1`, `Program ${P} success`], null), provenance)
  assert.equal(c.execution.failureFrameId, null); assert.equal(c.state, 'LANDED_SUCCESS')
})
test('a later different parent error does not inherit a caught child explanation', () => {
  const c = buildCaseFile(receipt([`Program ${P} invoke [1]`, `Program ${S} invoke [2]`, 'Transfer: insufficient lamports 2, need 10', `Program ${S} failed: custom program error: 0x1`, `Program ${P} failed: custom program error: 0x2`], { InstructionError: [0, { Custom: 2 }] }), provenance)
  assert.deepEqual(c.execution.failurePath, [0]); assert.equal(c.execution.semantic, null); assert.equal(c.execution.customError?.decimal, 2)
})
test('propagated error identifies System frame and instructions not reached without provider blame', () => {
  const c = buildCaseFile(receipt([`Program ${P} invoke [1]`, `Program ${S} invoke [2]`, 'Transfer: insufficient lamports 2, need 10', `Program ${S} failed: custom program error: 0x1`, `Program ${P} failed: custom program error: 0x1`]), provenance)
  assert.deepEqual(c.execution.failurePath, [0, 1]); assert.equal(c.execution.semantic?.quantities?.requiredLamports, 10)
  assert.equal(c.execution.outers[1].state, 'NOT_REACHED'); assert.equal(c.context.count, null)
})
test('missing meta.err fails closed and truncated paths retain unknown attribution', () => {
  const r = receipt([]); delete r.meta!.err
  assert.throws(() => buildCaseFile(r, provenance), /meta.err/)
  assert.equal(buildCaseFile(receipt([`Program ${P} invoke [1]`, 'Log truncated']), provenance).execution.failureFrameId, null)
  assert.equal(parseFrames([`Program ${P} invoke [2]`, `Program ${P} success`]).complete, false)
})
test('conflicting custom codes and invalid positions cannot produce confident paths', () => {
  const c = buildCaseFile(receipt([`Program ${P} invoke [1]`, `Program ${P} failed: custom program error: 0x2`]), provenance)
  assert.equal(c.execution.failureFrameId, null)
  assert.throws(() => buildCaseFile(receipt([], { InstructionError: [4, { Custom: 1 }] }), provenance), /position/)
})
test('a handler log stops automatic attribution to an earlier child with the same code', () => {
  const c = buildCaseFile(receipt([`Program ${P} invoke [1]`, `Program ${S} invoke [2]`, `Program ${S} failed: custom program error: 0x1`, 'Program log: handling child error', `Program ${P} failed: custom program error: 0x1`]), provenance)
  assert.deepEqual(c.execution.failurePath, [0])
})
test('unknown custom codes remain opaque and compute failure uses exact runtime text', () => {
  const opaque = buildCaseFile(receipt([`Program ${P} invoke [1]`, `Program ${P} failed: custom program error: 0x177a`], { InstructionError: [0, { Custom: 6010 }] }), provenance)
  assert.equal(opaque.execution.semantic, null); assert.match(opaque.explanation, /unavailable/)
  const compute = buildCaseFile(receipt([`Program ${P} invoke [1]`, `Program ${P} failed: Computational budget exceeded`], { InstructionError: [0, 'ComputationalBudgetExceeded'] }), provenance)
  assert.match(compute.explanation, /compute budget/)
})
test('compiled account layout includes loaded writable accounts without duplicating parsed accounts', () => {
  const r = receipt([])
  r.transaction!.message!.accountKeys = [P, S]
  r.transaction!.message!.header = { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 1 }
  r.transaction!.message!.addressTableLookups = [{}]
  r.meta!.loadedAddresses = { writable: ['loaded'], readonly: ['readonly'] }
  assert.deepEqual(normalizeReceipt(r).transaction!.message!.accountKeys!.map(k => typeof k === 'string' ? null : k.writable), [true, false, true, false])
  delete r.meta!.loadedAddresses
  assert.equal(buildCaseFile(r, provenance).metrics.writableAccounts, null)
  assert.equal(normalizeReceipt(normalizeReceipt(receipt([]))).transaction!.message!.accountKeys!.length, 1)
})
test('real retained corpus transforms deterministically, preserving selection and null context', () => {
  const library = JSON.parse(readFileSync('research/execution-casefile/generated/library.json', 'utf8'))
  assert.equal(library.cases.length, 23)
  assert.equal(new Set(library.cases.map((c: { signature: string }) => c.signature)).size, 23)
  const c = library.cases[0]
  assert.deepEqual(c.execution.failurePath.map((id: number) => c.execution.frames[id].programId), ['DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH', S])
  assert.equal(c.context.count, null)
  assert.equal(c.execution.systemTransfer.source, '23zyeKyn8wpF8VyWSGHTGvTVEGi5SPyziGSs9pGKr5ta')
  assert.equal(c.execution.systemTransfer.lamports, 3915945163)
  assert.equal(c.execution.outers.filter((i: { programId: string; state: string }) => i.programId === P && i.state === 'NOT_REACHED').length, 2)
  assert.equal(createHash('sha256').update(JSON.stringify(c.receipt)).digest('hex'), c.provenance.sha256)
  assert.deepEqual(buildCaseFile(c.receipt, c.provenance), buildCaseFile(c.receipt, c.provenance))
})
test('trace preserves rebuilds, retries, commitment and local durations', () => {
  const s = summarizeTrace(demoTrace())
  assert.equal(s.revisions.length, 2); assert.equal(s.sends, 3); assert.equal(s.retries, 1)
  assert.equal(s.revisions[0].outcome, 'VALIDITY_ELAPSED_FINAL_RECEIPT_UNOBSERVED')
  assert.equal(s.revisions[1].outcome, 'FINALIZED_FAILED'); assert.equal(s.durations[0].elapsedMs, 135)
  assert.deepEqual(validateTrace(s.trace), s.trace)
})
test('trace rejects secrets, signature mismatches, fabricated expiry and clock reversals', () => {
  const t = demoTrace()
  assert.throws(() => validateTrace({ ...t, apiKey: 'secret' }))
  const bad = structuredClone(t); bad.events[1].elapsedMs = -1
  assert.throws(() => validateTrace(bad))
  const expiry = structuredClone(t); (expiry.events[7].event as { observedBlockHeight: number }).observedBlockHeight = 99
  assert.throws(() => validateTrace(expiry), /Expiry/)
  assert.throws(() => traceMatchesReceipt(t, { signature: '2'.repeat(88), slot: 12345, state: 'LANDED_FAILED' }), /Illustrative/)
  const real = { ...t, fixture: false }
  assert.throws(() => traceMatchesReceipt(real, { signature: '3'.repeat(88), slot: 12345, state: 'LANDED_FAILED' }), /signature/)
  assert.throws(() => traceMatchesReceipt(real, { signature: '2'.repeat(88), slot: 12346, state: 'LANDED_FAILED' }), /disagree/)
})
test('a processed receipt never becomes final, and multiple final signatures are retained', () => {
  const t = demoTrace(); t.events = t.events.filter(e => !(e.event.type === 'RECEIPT_OBSERVED' && e.event.commitment === 'finalized')).map((e, sequence) => ({ ...e, sequence }))
  assert.equal(summarizeTrace(t).revisions[1].outcome, 'UNOBSERVED_FINAL_BY_DEADLINE')
  const full = demoTrace(); full.events.push({ sequence: full.events.length, observedAt: '2026-01-01T00:00:16.000Z', elapsedMs: 16000,
    event: { type: 'RECEIPT_OBSERVED', signature: '1'.repeat(88), slot: 12344, commitment: 'finalized', outcome: 'SUCCESS' } })
  assert.equal(summarizeTrace(full).revisions[0].outcome, 'FINALIZED_SUCCESS')
  assert.equal(summarizeTrace(full).revisions[1].outcome, 'FINALIZED_FAILED')
})
test('send instrumentation calls the existing sender once, preserves response and error, never retries', async () => {
  const r = createTraceRecorder({ attemptId: 'test', clockDomain: 'clock' })
  r.record({ type: 'MESSAGE_BUILT', revisionId: 'r', messageHash: 'a'.repeat(64) })
  r.record({ type: 'SIGNED', revisionId: 'r', signature: '1'.repeat(88) })
  let calls = 0
  const result = { signature: 'private-result-not-stored' }
  const observed = await r.observeSend({ type: 'SEND_STARTED', revisionId: 'r', sendId: 's', providerLabel: 'rpc' }, async () => { calls++; return result }, () => ({ response: 'ACKNOWLEDGED' }))
  assert.equal(calls, 1); assert.equal(observed.result, result); assert.equal(observed.telemetryError, null)
  assert.equal(JSON.stringify(r.snapshot()).includes('private-result-not-stored'), false)
  const original = new Error('sensitive-provider-url')
  await assert.rejects(r.observeSend({ type: 'SEND_STARTED', revisionId: 'r', sendId: 's2', providerLabel: 'rpc' }, async () => { throw original }, () => ({ response: 'ACKNOWLEDGED' })), e => e === original)
  assert.equal(JSON.stringify(r.snapshot()).includes('sensitive-provider-url'), false)
  const telemetryBroken = await r.observeSend({ type: 'SEND_STARTED', revisionId: 'missing', sendId: 's3', providerLabel: 'rpc' }, async () => { calls++; return result }, () => ({ response: 'ACKNOWLEDGED' }))
  assert.equal(telemetryBroken.result, result); assert.equal(telemetryBroken.telemetryError, 'SEND_START_NOT_RECORDED'); assert.equal(calls, 2)
  assert.equal(summarizeTrace(r.snapshot()).captureIssuesReported, true)
  assert.ok(r.snapshot().captureIssues.includes('SEND_START_NOT_RECORDED'))
  const classified = await r.observeSend({ type: 'SEND_STARTED', revisionId: 'r', sendId: 's4', providerLabel: 'rpc' }, async () => result, () => { throw new Error('unsafe-response') })
  assert.equal(classified.result, result); assert.equal(classified.telemetryError, 'SEND_RESPONSE_NOT_RECORDED')
  assert.equal(JSON.stringify(r.snapshot()).includes('unsafe-response'), false)
})
