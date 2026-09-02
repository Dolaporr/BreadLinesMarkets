import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildExecutionTrace,
  EXECUTION_TRACE_SCHEMA_VERSION,
  type ExecutionTraceInput,
} from '../scripts/execution-trace-core.ts'

function trace(events: ExecutionTraceInput['events']): ExecutionTraceInput {
  return {
    schemaVersion: EXECUTION_TRACE_SCHEMA_VERSION,
    traceId: 'trace-001',
    attemptId: 'attempt-001',
    events,
  }
}

test('a final receipt with meta.err is a landed failure, even after a provider acknowledgement', () => {
  const result = buildExecutionTrace(trace([
    { sequence: 0, observedAt: '2026-09-01T10:00:00.000Z', source: 'INTEGRATOR_CLIENT', type: 'ATTEMPT_CREATED' },
    { sequence: 1, observedAt: '2026-09-01T10:00:01.000Z', source: 'INTEGRATOR_CLIENT', type: 'SIGNATURE_CREATED', signature: 'sig-a' },
    { sequence: 2, observedAt: '2026-09-01T10:00:02.000Z', source: 'INTEGRATOR_CLIENT', type: 'SUBMISSION_ATTEMPTED', providerLabel: 'provider-a' },
    { sequence: 3, observedAt: '2026-09-01T10:00:02.050Z', source: 'SUBMISSION_PROVIDER', type: 'SUBMISSION_ACKNOWLEDGED', providerLabel: 'provider-a' },
    {
      sequence: 4,
      observedAt: '2026-09-01T10:00:03.000Z',
      source: 'FINAL_RPC',
      type: 'FINAL_RECEIPT_OBSERVED',
      signature: 'sig-a',
      receipt: {
        slot: 442_400_000,
        meta: { err: { InstructionError: [1, { Custom: 1 }] } },
        transaction: { message: { instructions: [] }, signatures: ['sig-a'] },
      },
    },
  ]))

  assert.equal(result.outcome.value, 'LANDED_FAILED')
  assert.equal(result.outcome.evidence, 'DERIVED')
  assert.equal(result.lifecycle.submissionAcknowledgements, 1)
  assert.equal(result.finalReceipt.observed, true)
  assert.equal(result.signature, 'sig-a')
})

test('a preconfirmation alone never becomes a landed outcome', () => {
  const result = buildExecutionTrace(trace([
    { sequence: 0, observedAt: '2026-09-01T10:00:00.000Z', source: 'INTEGRATOR_CLIENT', type: 'ATTEMPT_CREATED' },
    { sequence: 1, observedAt: '2026-09-01T10:00:01.000Z', source: 'INTEGRATOR_CLIENT', type: 'SIGNATURE_CREATED', signature: 'sig-b' },
    { sequence: 2, observedAt: '2026-09-01T10:00:02.000Z', source: 'PRECONFIRMATION_PROVIDER', type: 'PRECONFIRMATION_OBSERVED', signature: 'sig-b', slot: 442_400_001, localExecutionStatus: 'SUCCESS' },
  ]))

  assert.equal(result.outcome.value, 'INCOMPLETE')
  assert.equal(result.lifecycle.preconfirmation.evidence, 'OBSERVED')
  assert.match(result.lifecycle.preconfirmation.finalityWarning ?? '', /not proof that a final block landed/i)
})

test('an observation deadline produces unobserved-by-deadline, never dropped', () => {
  const result = buildExecutionTrace(trace([
    { sequence: 0, observedAt: '2026-09-01T10:00:00.000Z', source: 'INTEGRATOR_CLIENT', type: 'ATTEMPT_CREATED' },
    { sequence: 1, observedAt: '2026-09-01T10:00:01.000Z', source: 'INTEGRATOR_CLIENT', type: 'OBSERVATION_DEADLINE_REACHED', deadline: '2026-09-01T10:01:00.000Z' },
  ]))

  assert.equal(result.outcome.value, 'UNOBSERVED_BY_DEADLINE')
  assert.doesNotMatch(result.outcome.safeDescription, /dropped/i)
})

test('expiry requires evidence beyond the last valid block height', () => {
  const result = buildExecutionTrace(trace([
    { sequence: 0, observedAt: '2026-09-01T10:00:00.000Z', source: 'INTEGRATOR_CLIENT', type: 'ATTEMPT_CREATED' },
    { sequence: 1, observedAt: '2026-09-01T10:00:01.000Z', source: 'FINAL_RPC', type: 'BLOCKHASH_EXPIRED', lastValidBlockHeight: 100, observedBlockHeight: 101 },
  ]))

  assert.equal(result.outcome.value, 'EXPIRED')
  assert.equal(result.outcome.evidence, 'OBSERVED')
})

test('unsafe execution material is rejected rather than retained', () => {
  const unsafe = trace([
    {
      sequence: 0,
      observedAt: '2026-09-01T10:00:00.000Z',
      source: 'INTEGRATOR_CLIENT',
      type: 'ATTEMPT_CREATED',
      rawSignedTransaction: 'do-not-store-this',
    } as unknown as ExecutionTraceInput['events'][number],
  ])

  assert.throws(() => buildExecutionTrace(unsafe), /rawSignedTransaction is prohibited/i)
})

test('unordered events are rejected', () => {
  assert.throws(() => buildExecutionTrace(trace([
    { sequence: 1, observedAt: '2026-09-01T10:00:00.000Z', source: 'INTEGRATOR_CLIENT', type: 'SIGNATURE_CREATED', signature: 'sig-a' },
    { sequence: 0, observedAt: '2026-09-01T10:00:01.000Z', source: 'INTEGRATOR_CLIENT', type: 'SIGNATURE_CREATED', signature: 'sig-b' },
  ])), /strictly increasing sequence order/i)
})

test('a trace cannot silently join events for multiple signatures', () => {
  assert.throws(() => buildExecutionTrace(trace([
    { sequence: 0, observedAt: '2026-09-01T10:00:00.000Z', source: 'INTEGRATOR_CLIENT', type: 'SIGNATURE_CREATED', signature: 'sig-a' },
    { sequence: 1, observedAt: '2026-09-01T10:00:01.000Z', source: 'PRECONFIRMATION_PROVIDER', type: 'PRECONFIRMATION_OBSERVED', signature: 'sig-b', slot: 442_400_002, localExecutionStatus: 'SUCCESS' },
  ])), /multiple signatures/i)
})

test('a trace cannot silently choose between multiple final receipts', () => {
  assert.throws(() => buildExecutionTrace(trace([
    { sequence: 0, observedAt: '2026-09-01T10:00:00.000Z', source: 'INTEGRATOR_CLIENT', type: 'SIGNATURE_CREATED', signature: 'sig-a' },
    {
      sequence: 1,
      observedAt: '2026-09-01T10:00:01.000Z',
      source: 'FINAL_RPC',
      type: 'FINAL_RECEIPT_OBSERVED',
      signature: 'sig-a',
      receipt: { slot: 442_400_003, meta: { err: null } },
    },
    {
      sequence: 2,
      observedAt: '2026-09-01T10:00:02.000Z',
      source: 'FINAL_RPC',
      type: 'FINAL_RECEIPT_OBSERVED',
      signature: 'sig-a',
      receipt: { slot: 442_400_003, meta: { err: null } },
    },
  ])), /multiple final receipt events/i)
})
