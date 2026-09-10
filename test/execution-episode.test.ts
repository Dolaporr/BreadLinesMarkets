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

test('a multi-program route is one atomic commitment, not a per-program or per-root one', () => {
  const RAYDIUM = 'Raydium111111111111111111111111111111111111'
  const episode = buildExecutionEpisode({
    schemaVersion: EXECUTION_EPISODE_SCHEMA_VERSION,
    xray: {
      schemaVersion: EXECUTION_XRAY_SCHEMA_VERSION,
      target: {
        signature: 'routed-signature',
        blockTransactionIndex: 0,
        receipt: {
          slot: 900,
          meta: {
            err: { InstructionError: [2, { Custom: 6001 }] },
            logMessages: [
              `Program ${RAYDIUM} invoke [1]`, `Program ${RAYDIUM} success`,
              `Program ${JUPITER_PROGRAM_ID} invoke [1]`, `Program ${JUPITER_PROGRAM_ID} failed: custom program error: 0x1771`,
            ],
          },
          transaction: {
            message: {
              accountKeys: [{ pubkey: 'signer', signer: true, writable: true }],
              instructions: [
                { programId: 'ComputeBudget111111111111111111111111111111' },
                { programId: RAYDIUM },
                { programId: JUPITER_PROGRAM_ID },
              ],
            },
          },
        },
      },
      context: { transactions: [], slotRange: { start: 900, end: 900 }, coverage: 'COMPLETE', sourceDescription: 'fixture' },
    },
  })

  const commitment = episode.claims.chainProven.find((claim) => claim.statement.includes('committed nothing'))
  assert.ok(commitment, 'a failed routed transaction must state that it committed nothing')
  assert.match(commitment.prohibitedExpansion!, /per-program, per-market, or per-state-root commitment/)
  assert.match(commitment.prohibitedExpansion!, /partially executed route as a partially committed state transition/)

  // Routing through more than one program is what makes a per-root reading tempting.
  const perRoot = episode.telemetryRequirements.find((requirement) => requirement.id === 'PER_ROOT_STATE_COMMITMENT')
  assert.ok(perRoot, 'a multi-program route must record what per-root commitment evidence would require')

  // The receipt locates a rejection. It never grades delivery timing or ordering.
  assert.equal(episode.claims.supportedInferences.length, 0)
  assert.equal(episode.claims.hypotheses.length, 0)
  assert.equal(episode.fingerprint.causality, 'UNDETERMINED')
  // Lateness may only appear as something forbidden, never as an asserted claim.
  const statements = Object.values(episode.claims).flat().map((claim) => claim.statement)
  assert.equal(statements.some((statement) => /\blate\b|\bordered behind\b|\bout of order\b/i.test(statement)), false)
  assert.ok(episode.limitations.some((limitation) => /never a partially committed state transition/.test(limitation)))
  assert.ok(episode.limitations.some((limitation) => /not a delivery-timing or sequencing fact/.test(limitation)))
})

test('a single-program transaction does not raise a per-root commitment requirement', () => {
  const episode = buildExecutionEpisode({
    schemaVersion: EXECUTION_EPISODE_SCHEMA_VERSION,
    xray: {
      schemaVersion: EXECUTION_XRAY_SCHEMA_VERSION,
      target: {
        signature: 'single-signature',
        blockTransactionIndex: 0,
        receipt: {
          slot: 900,
          meta: { err: null, logMessages: [] },
          transaction: {
            message: {
              accountKeys: [{ pubkey: 'signer', signer: true, writable: true }],
              instructions: [{ programId: 'ComputeBudget111111111111111111111111111111' }, { programId: JUPITER_PROGRAM_ID }],
            },
          },
        },
      },
      context: { transactions: [], slotRange: { start: 900, end: 900 }, coverage: 'COMPLETE', sourceDescription: 'fixture' },
    },
  })
  assert.equal(episode.telemetryRequirements.some((r) => r.id === 'PER_ROOT_STATE_COMMITMENT'), false)
  assert.ok(episode.claims.chainProven.some((claim) => claim.statement.includes('committed as one atomic unit')))
})
