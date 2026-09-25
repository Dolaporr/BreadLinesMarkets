import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  classifyConsensus, observerSurfaceForHistoricalRead, buildEvidenceSurfaces, INDEPENDENCE,
  type GenesisCertProbe,
} from '../research/execution-casefile/consensus-evidence.ts'

const AT = '2026-09-25T00:00:00.000Z'
const EP = 'https://api.mainnet-beta.solana.com'
const exec = { slot: 447_741_300, blockhash: '8mcSY4mAGP7Gba51zf6YcauKcDXQZ8WVRavniKPYggwQ', rpcReportedCommitment: 'finalized' }

// --- A: TowerBFT on a node that supports the method ---------------------------------------------
test('A — null from a supporting node is positive TowerBFT evidence, and fabricates no certificate', () => {
  const c = classifyConsensus({ outcome: 'NULL_SUPPORTED', endpoint: EP, observedAt: AT, raw: null }, exec)
  assert.equal(c.protocol.value, 'TOWER_BFT')
  assert.equal(c.protocol.state, 'OBSERVED')
  assert.equal(c.migrationState.value, 'NOT_MIGRATED')
  assert.equal(c.capability.value, 'SUPPORTED')
  assert.equal(c.genesisCertificateStatus.value, 'ABSENT')
  // No certificate is invented, and its absence is explained rather than called UNKNOWN.
  assert.equal(c.certificateSlot.value, null)
  assert.equal(c.certificateSlot.state, 'NOT_APPLICABLE')
  assert.equal(c.certificateBlockId.value, null)
  assert.equal(c.certificateBlockId.state, 'NOT_APPLICABLE')
})

// --- B: Alpenglow ---------------------------------------------------------------------------------
test('B — a returned certificate yields ALPENGLOW and preserves slot and block id', () => {
  const raw = { block: { slot: 500_000_000, blockId: [0xab, 0xcd, 0x01] }, signature: { signature: 'x'.repeat(10), bitmap: [1, 2] } }
  const c = classifyConsensus({ outcome: 'CERTIFICATE', endpoint: EP, observedAt: AT, raw }, exec)
  assert.equal(c.protocol.value, 'ALPENGLOW')
  assert.equal(c.migrationState.value, 'MIGRATED')
  assert.equal(c.genesisCertificateStatus.value, 'PRESENT')
  assert.equal(c.certificateSlot.value, 500_000_000)
  assert.equal(c.certificateSlot.state, 'OBSERVED')
  assert.equal(c.certificateBlockId.value, 'abcd01')
  // Retrieved is not verified — v0 performs no cryptography.
  assert.equal(c.certificateVerification.value, 'NOT_VERIFIED')
  assert.match(c.certificateVerification.basis, /no BLS or other cryptographic verification/i)
})

// --- C: node does not implement the method ---------------------------------------------------------
test('C — -32601 is a node property and must never be read as TowerBFT', () => {
  const c = classifyConsensus({ outcome: 'METHOD_NOT_FOUND', endpoint: EP, observedAt: AT, rpcErrorCode: -32601, rpcErrorMessage: 'Method not found' }, exec)
  assert.equal(c.capability.value, 'NOT_SUPPORTED')
  assert.equal(c.capability.state, 'OBSERVED', 'that the node lacks the method is itself observed')
  assert.notEqual(c.protocol.value, 'TOWER_BFT')
  assert.notEqual(c.protocol.value, 'ALPENGLOW')
  assert.equal(c.protocol.value, 'UNKNOWN')
  assert.equal(c.migrationState.value, 'UNKNOWN')
  assert.equal(c.genesisCertificateStatus.state, 'NOT_SUPPORTED')
  assert.match(c.boundary, /NOT evidence of TowerBFT/i)
})

// --- D: transport failure ---------------------------------------------------------------------------
test('D — a transport failure yields UNKNOWN/REFUSED and no migration inference', () => {
  const c = classifyConsensus({ outcome: 'TRANSPORT_FAILURE', endpoint: EP, observedAt: AT, detail: 'ETIMEDOUT' }, exec)
  assert.equal(c.protocol.value, 'UNKNOWN')
  assert.equal(c.migrationState.value, 'UNKNOWN')
  assert.equal(c.capability.state, 'REFUSED')
  assert.equal(c.certificateSlot.state, 'REFUSED')
  assert.match(c.boundary, /Nothing about the protocol/i)
})

// --- E: execution succeeds, consensus evidence unavailable ---------------------------------------
test('E — execution SUCCESS does not produce finality, and nothing implies finalized', () => {
  const c = classifyConsensus({ outcome: 'TRANSPORT_FAILURE', endpoint: EP, observedAt: AT, detail: 'ECONNRESET' },
    { slot: 1, blockhash: 'h', rpcReportedCommitment: null })
  const surfaces = buildEvidenceSurfaces({
    execution: { signature: { value: 'sig', state: 'OBSERVED', basis: 'receipt' }, slot: { value: 1, state: 'OBSERVED', basis: 'receipt' },
      outcome: { value: 'LANDED_SUCCESS', state: 'OBSERVED', basis: 'meta.err is null' },
      failurePath: { value: null, state: 'NOT_APPLICABLE', basis: 'the transaction did not fail' }, evidenceSource: EP },
    consensus: c,
    observer: observerSurfaceForHistoricalRead({ source: EP, observationMethod: 'getTransaction', consensusEvidenceObservedAt: AT }),
  })
  assert.equal(surfaces.execution.outcome.value, 'LANDED_SUCCESS')
  assert.equal(surfaces.consensus.protocol.value, 'UNKNOWN')
  assert.equal(surfaces.consensus.rpcReportedCommitment.value, null)
  // The serialised surfaces must not assert finality anywhere.
  const blob = JSON.stringify(surfaces)
  assert.equal(/"value":"FINALIZED"/.test(blob), false)
  assert.match(surfaces.independence.join(' '), /Execution success is not evidence that the containing block finalized/i)
})

// --- F: the thesis case — execution failed, block finalized ---------------------------------------
test('F — a FAILED execution and a finalized containing block coexist without an error state', () => {
  const c = classifyConsensus({ outcome: 'NULL_SUPPORTED', endpoint: EP, observedAt: AT, raw: null }, exec)
  const surfaces = buildEvidenceSurfaces({
    execution: { signature: { value: 'sig', state: 'OBSERVED', basis: 'receipt' }, slot: { value: exec.slot, state: 'OBSERVED', basis: 'receipt' },
      outcome: { value: 'LANDED_FAILED', state: 'OBSERVED', basis: 'meta.err carries an InstructionError' },
      failurePath: { value: 'Program X failed: custom program error 0x1', state: 'OBSERVED', basis: 'log range' }, evidenceSource: EP },
    consensus: c,
    observer: observerSurfaceForHistoricalRead({ source: EP, observationMethod: 'getTransaction', consensusEvidenceObservedAt: AT }),
  })
  // Both hold at once. Neither is an error, and neither overrides the other.
  assert.equal(surfaces.execution.outcome.value, 'LANDED_FAILED')
  assert.equal(surfaces.consensus.rpcReportedCommitment.value, 'finalized')
  assert.equal(surfaces.consensus.rpcReportedCommitment.state, 'OBSERVED')
  assert.match(surfaces.consensus.rpcReportedCommitment.basis, /provider statement, not certificate verification/i)
  assert.match(surfaces.independence.join(' '), /failed transaction can sit in a finalized block/i)
})

// --- G: historical analysis -------------------------------------------------------------------------
test('G — a historical read yields no observer first-seen time', () => {
  const o = observerSurfaceForHistoricalRead({ source: EP, observationMethod: 'getTransaction (historical)', consensusEvidenceObservedAt: AT })
  assert.equal(o.firstSeenAt.value, null)
  assert.equal(o.firstSeenAt.state, 'UNAVAILABLE')
  assert.match(o.firstSeenAt.basis, /Chain time is not observer time/i)
  assert.equal(o.processedObservedAt.state, 'UNAVAILABLE')
  assert.equal(o.finalizedObservedAt.state, 'UNAVAILABLE')
  // The one timestamp we do own is when this process ran its own probe.
  assert.equal(o.consensusEvidenceObservedAt.value, AT)
  assert.equal(o.consensusEvidenceObservedAt.state, 'OBSERVED')
  // A live observer that genuinely recorded a first-seen time keeps it.
  const live = observerSurfaceForHistoricalRead({ source: EP, observationMethod: 'websocket', consensusEvidenceObservedAt: AT, liveFirstSeenAt: '2026-09-25T00:00:01.000Z' })
  assert.equal(live.firstSeenAt.state, 'OBSERVED')
})

// --- H: certificate slot is never bound to the transaction ------------------------------------------
test('H — certificate slot and transaction slot stay separate and unlinked', () => {
  const raw = { block: { slot: 500_000_000, blockId: 'ff00' }, signature: { signature: 's', bitmap: [] } }
  const c = classifyConsensus({ outcome: 'CERTIFICATE', endpoint: EP, observedAt: AT, raw }, exec)
  assert.equal(c.certificateSlot.value, 500_000_000)
  assert.equal(c.containingBlockSlot.value, 447_741_300)
  assert.notEqual(c.certificateSlot.value, c.containingBlockSlot.value)
  // The refusal to link is structural, not a UI caption.
  assert.equal(c.certificateBoundToTransaction.value, false)
  assert.equal(c.certificateBoundToTransaction.state, 'NOT_APPLICABLE')
  assert.match(c.certificateBoundToTransaction.basis, /one-time, cluster-level migration artifact/i)
})

// --- no hardcoded activation, no date heuristics -----------------------------------------------------
test('no activation slot, date or version heuristic appears in the model', () => {
  const src = readFileSync('research/execution-casefile/consensus-evidence.ts', 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const pattern of [/activationSlot/i, /ACTIVATION_SLOT/, /new Date\(\)/, /Date\.now/, /epoch\s*[><=]/i, /feature-?set/i]) {
    assert.equal(pattern.test(code), false, `the model must not contain ${pattern}`)
  }
  assert.equal(INDEPENDENCE.length, 6)
})

test('the live capability probe recorded a real cluster answer with controls', () => {
  const p = JSON.parse(readFileSync('research/consensus-evidence/capability-probe.json', 'utf8'))
  assert.ok(['NULL_SUPPORTED', 'CERTIFICATE', 'METHOD_NOT_FOUND', 'TRANSPORT_FAILURE'].includes(p.rawProbe.outcome))
  // The controls are what make a null answer meaningful rather than a node that nulls everything.
  for (const m of ['getAGGenesisCert', 'getAlpenglowGenesisCert', 'getGenesisCert']) {
    assert.ok(p.controlProbes[m], `control probe ${m} must be recorded`)
  }
})
