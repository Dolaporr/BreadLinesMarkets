import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildExecutionEpisode,
  EXECUTION_EPISODE_SCHEMA_VERSION,
} from '../scripts/execution-episode-core.ts'
import { EXECUTION_XRAY_SCHEMA_VERSION } from '../scripts/execution-xray-core.ts'

const JUPITER_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'

test('an Execution Episode emits chain-proven, observed, and unknown claims without inventing inference', () => {
  const result = buildExecutionEpisode({
    schemaVersion: EXECUTION_EPISODE_SCHEMA_VERSION,
    xray: {
      schemaVersion: EXECUTION_XRAY_SCHEMA_VERSION,
      target: {
        signature: 'target-signature',
        blockTransactionIndex: 3,
        receipt: {
          slot: 500,
          meta: {
            err: { InstructionError: [1, { Custom: 1 }] },
            logMessages: [`Program ${JUPITER_PROGRAM_ID} invoke [1]`, `Program ${JUPITER_PROGRAM_ID} failed: custom program error: 0x1`],
          },
          transaction: {
            message: {
              accountKeys: [{ pubkey: 'target-signer', signer: true, writable: true }, { pubkey: 'pool', writable: true }],
              instructions: [{ programId: JUPITER_PROGRAM_ID }],
            },
          },
        },
      },
      context: {
        coverage: 'PARTIAL',
        sourceDescription: 'Partial retained context for the target slot.',
        slotRange: { start: 500, end: 500 },
        transactions: [{
          signature: 'context-signature',
          blockTransactionIndex: 1,
          receipt: {
            slot: 500,
            meta: { err: null },
            transaction: {
              message: {
                accountKeys: [{ pubkey: 'context-signer', signer: true, writable: true }, { pubkey: 'pool', writable: true }],
                instructions: [{ programId: JUPITER_PROGRAM_ID }],
              },
            },
          },
        }],
      },
    },
  })

  assert.equal(result.claims.chainProven[0].grade, 'A_CHAIN_PROVEN')
  assert.equal(result.claims.directlyObserved[0].grade, 'B_DIRECTLY_OBSERVED')
  assert.equal(result.claims.supportedInferences.length, 0)
  assert.equal(result.claims.hypotheses.length, 0)
  assert.ok(result.claims.unknown.some((claim) => /submitted/i.test(claim.statement)))
  assert.ok(result.telemetryRequirements.some((requirement) => requirement.id === 'COMPLETE_BLOCK_CONTEXT'))
  assert.equal(result.fingerprint.causality, 'UNDETERMINED')
})
