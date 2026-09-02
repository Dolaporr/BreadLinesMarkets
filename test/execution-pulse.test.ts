import assert from 'node:assert/strict'
import test from 'node:test'
import { renderPulseMarkdown, transformMarketStructureEpisode } from '../scripts/execution-pulse-core.ts'

const episode = {
  methodologyVersion: 'breadlines-market-structure-v1', token: { mint: 'mint-1', label: 'Example' }, observationWindow: { startSlot: 10, endSlot: 20 }, evidenceBoundary: 'Fixed window only.', sampling: { methodology: 'Fixed deterministic sample', selection: 'Slot-only selection' },
  metrics: { transactions: 4, successes: 3, failures: 1, successRate: .75, uniquePrimarySigners: 2, successfulExecutionConcentration: { top1: 2 / 3, top5: 1, top10: 1, hhi: 5 / 9 }, failureClasses: [{ value: 'Documented', count: 1 }] },
  slices: [{ relativeSlice: 2, relativeStart: .5, relativeEnd: 1, transactions: 2, successes: 1, failures: 1, successRate: .5, uniquePrimarySigners: 1, newToSampleSigners: 0, returningSigners: 1, successfulNewSigners: 0, successfulReturningSigners: 1 }, { relativeSlice: 1, relativeStart: 0, relativeEnd: .5, transactions: 2, successes: 2, failures: 0, successRate: 1, uniquePrimarySigners: 2, newToSampleSigners: 2, returningSigners: 0, successfulNewSigners: 2, successfulReturningSigners: 0 }],
}

test('transforms generic episodes deterministically without fabricating a benchmark', () => {
  const a = transformMarketStructureEpisode(episode, { sourceArtifact: 'fixture.json', generatedAt: '2025-01-01T00:00:00.000Z' })
  const b = transformMarketStructureEpisode(episode, { sourceArtifact: 'fixture.json', generatedAt: '2025-01-01T00:00:00.000Z' })
  assert.deepEqual(a, b)
  assert.equal(a.chronologicalSlices[0].index, 2)
  assert.equal(a.historicalBenchmark.status, 'UNAVAILABLE')
  assert.equal(a.coreMetrics.find((x) => x.id === 'successful_execution_concentration')?.value instanceof Object, true)
  assert.equal(a.methodology.coverage, 'SAMPLED')
  assert.equal(a.provenance.sourceArtifact, 'fixture.json')
})

test('preserves missing fields and keeps public language free of identity labels', () => {
  const pulse = transformMarketStructureEpisode({ ...episode, metrics: { ...episode.metrics, successfulExecutionConcentration: { top1: null, top5: null, top10: null, hhi: null } } }, { sourceArtifact: 'fixture.json', generatedAt: '2025-01-01T00:00:00.000Z' })
  const concentration = pulse.coreMetrics.find((x) => x.id === 'successful_execution_concentration')!
  assert.equal(concentration.evidenceStatus, 'UNAVAILABLE')
  assert.equal(concentration.value, null)
  const publicText = renderPulseMarkdown(pulse).toLowerCase()
  for (const forbidden of [' buyer', ' user', ' bot', ' whale', ' trader']) assert.equal(publicText.includes(forbidden), false)
})

test('share-card numbers exactly correspond to observations', () => {
  const pulse = transformMarketStructureEpisode(episode, { sourceArtifact: 'fixture.json', generatedAt: '2025-01-01T00:00:00.000Z' })
  const card = pulse.shareCardCandidates.find((x) => x.headline === 'Observed execution success rate')!
  assert.equal(card.primaryValue, '75%')
  assert.match(String(card.evidenceStatement), /75%/)
})
