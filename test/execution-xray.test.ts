import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildExecutionXray,
  EXECUTION_XRAY_SCHEMA_VERSION,
  type ExecutionXrayInput,
} from '../scripts/execution-xray-core.ts'

const JUPITER_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'

function receipt(slot: number, failed = false, writableAccounts = ['payer', 'pool']) {
  return {
    slot,
    meta: {
      err: failed ? { InstructionError: [1, { Custom: 1 }] } : null,
      fee: 5_500,
      computeUnitsConsumed: 110_000,
      logMessages: failed ? [`Program ${JUPITER_PROGRAM_ID} invoke [1]`, `Program ${JUPITER_PROGRAM_ID} failed: custom program error: 0x1`] : [],
    },
    transaction: {
      signatures: ['placeholder'],
      message: {
        accountKeys: writableAccounts.map((pubkey, index) => ({ pubkey, writable: index < 2, signer: index === 0 })),
        instructions: [{ programId: JUPITER_PROGRAM_ID }],
      },
    },
  }
}

function input(overrides: Partial<ExecutionXrayInput> = {}): ExecutionXrayInput {
  return {
    schemaVersion: EXECUTION_XRAY_SCHEMA_VERSION,
    target: {
      signature: 'target',
      blockTransactionIndex: 4,
      receipt: receipt(100, true),
    },
    context: {
      coverage: 'COMPLETE',
      sourceDescription: 'Complete getBlock responses for slots 99 through 101.',
      slotRange: { start: 99, end: 101 },
      transactions: [
        { signature: 'same-slot-shared', blockTransactionIndex: 2, receipt: receipt(100, false, ['other-payer', 'pool']) },
        { signature: 'prior-slot-shared', blockTransactionIndex: 1, receipt: receipt(99, false, ['third-payer', 'pool']) },
        { signature: 'non-overlap', blockTransactionIndex: 6, receipt: receipt(100, false, ['fourth-payer', 'other-account']) },
      ],
    },
    ...overrides,
  }
}

test('X-Ray maps a landed failed receipt and shared writable-account activity without asserting causality', () => {
  const result = buildExecutionXray(input())

  assert.equal(result.target.executionState, 'landed-but-failed')
  assert.equal(result.target.slot, 100)
  assert.equal(result.context.sharedWritableActivity.count, 2)
  assert.deepEqual(
    result.context.sharedWritableActivity.records.map((record) => record.slotRelation),
    ['EARLIER_SLOT', 'EARLIER_IN_BLOCK_LIST'],
  )
  assert.match(result.context.sharedWritableActivity.safeDescription, /^2 context transaction/i)
  assert.equal(result.context.overlappingSignerRecurrence.uniqueObservedSignerAddressCount, 2)
  assert.ok(result.context.sharedWritableActivity.prohibitedInterpretations.some((claim) => /caused/i.test(claim)))
  assert.ok(result.limitations.some((claim) => /submission time/i.test(claim)))
})

test('partial context is expressed as at least, rather than complete coverage', () => {
  const original = input()
  const result = buildExecutionXray({
    ...original,
    context: { ...original.context, coverage: 'PARTIAL' },
  })

  assert.match(result.context.sharedWritableActivity.safeDescription, /^At least 2 sampled/i)
  assert.equal(result.context.sharedWritableActivity.evidence, 'DERIVED')
})

test('missing writable metadata remains unavailable and does not fabricate an overlap count', () => {
  const original = input()
  const result = buildExecutionXray({
    ...original,
    target: {
      ...original.target,
      receipt: {
        ...original.target.receipt,
        transaction: { message: { accountKeys: ['payer', 'pool'], instructions: [] } },
      },
    },
  })

  assert.equal(result.target.writableAccountEvidence, 'UNAVAILABLE')
  assert.equal(result.context.sharedWritableActivity.evidence, 'UNAVAILABLE')
  assert.equal(result.context.sharedWritableActivity.count, 0)
})

test('X-Ray rejects a context that silently repeats the target signature', () => {
  const original = input()
  assert.throws(() => buildExecutionXray({
    ...original,
    context: {
      ...original.context,
      transactions: [{ signature: 'target', blockTransactionIndex: 2, receipt: receipt(100) }],
    },
  }), /must not repeat the target/i)
})
