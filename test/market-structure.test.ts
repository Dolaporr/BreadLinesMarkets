import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEpisode, concentration, distribution, METHODOLOGY_VERSION, type ResearchRecord } from '../scripts/market-structure-core.ts'

const record = (signature: string, slot: number, signer: string, state: 'landed' | 'landed-but-failed', failureClass: string | null = null, failingProgram: string | null = null): ResearchRecord => ({ signature, slot, blockTime: null, primarySigner: signer, execution: { state }, fees: { totalLamports: slot, priorityFeeLamports: slot / 10 }, compute: { requestedCU: 100, consumedCU: 80 }, programs: [], failureClass, failingProgram })

test('concentration and distributions are deterministic', () => {
  assert.deepEqual(concentration(['a', 'a', 'b', 'c']), { top1: .5, top5: 1, top10: 1, hhi: .375 })
  assert.equal(distribution([1, 2, 3, 4]).median, 2.5)
})

test('episode excludes records outside the predetermined window and tracks recurrence by relative slice', () => {
  const episode = buildEpisode([record('before', 9, 'x', 'landed'), record('a', 10, 'x', 'landed'), record('b', 16, 'x', 'landed-but-failed', 'opaque', 'program-a'), record('after', 21, 'z', 'landed')], { mint: 'mint', observationStartSlot: 10, observationEndSlot: 20 }, { methodologyVersion: METHODOLOGY_VERSION }, 2)
  assert.equal(episode.metrics.transactions, 2)
  assert.equal(episode.slices[0].newToSampleSigners, 1)
  assert.equal(episode.slices[1].returningSigners, 1)
  assert.equal(episode.metrics.returningSigners, 1)
  assert.equal(episode.metrics.successfulNewSigners, 1)
  assert.equal(episode.metrics.failureConcentration.byProgram.top1, 1)
})

test('success concentration uses successful executions only', () => {
  const episode = buildEpisode([record('a', 1, 'a', 'landed'), record('b', 2, 'b', 'landed'), record('c', 3, 'b', 'landed-but-failed')], { mint: 'mint', observationStartSlot: 1, observationEndSlot: 3 }, {}, 1)
  assert.equal(episode.metrics.successfulExecutionConcentration.top1, .5)
  assert.equal(episode.metrics.allExecutionConcentration.top1, 2 / 3)
})
