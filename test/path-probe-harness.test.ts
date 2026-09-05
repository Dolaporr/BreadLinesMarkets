import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CONDITION_TARGET, FEE_TIERS, PATHS, buildConditionPlan, classifyCondition, journalDryRun, validateConfig } from '../scripts/path-probe-harness.ts'

test('classifies preregistered fee conditions at fixed boundaries', () => {
  assert.equal(classifyCondition(0), 'quiet')
  assert.equal(classifyCondition(4_999), 'quiet')
  assert.equal(classifyCondition(5_000), 'active')
  assert.equal(classifyCondition(24_999), 'active')
  assert.equal(classifyCondition(25_000), 'congested')
})

test('creates a deterministic balanced plan for one condition', () => {
  const plan = buildConditionPlan('test-run', 'active')
  assert.equal(plan.length, CONDITION_TARGET * FEE_TIERS.length * PATHS.length)
  assert.deepEqual(plan.slice(0, 8).map((trial) => `${trial.feeTier}:${trial.path}`), [
    'market-rate-reference:axiom', 'market-rate-reference:nozomi', 'market-rate-reference:bam', 'market-rate-reference:direct-tpu',
    'deliberately-underpriced:axiom', 'deliberately-underpriced:nozomi', 'deliberately-underpriced:bam', 'deliberately-underpriced:direct-tpu',
  ])
  for (const tier of FEE_TIERS) for (const path of PATHS) assert.equal(plan.filter((trial) => trial.feeTier === tier.id && trial.path === path).length, CONDITION_TARGET)
})

test('rejects a condition declaration inconsistent with its fixed p75 value', () => {
  assert.throws(() => validateConfig({ runId: 'test-run', condition: 'congested', p75MicroLamportsPerCu: 5_001 }))
})

test('dry-run journals a plan without transmission records', () => {
  const directory = mkdtempSync(join(tmpdir(), 'path-probe-'))
  try {
    const { journalPath, plan } = journalDryRun({ runId: 'test-run', condition: 'quiet', p75MicroLamportsPerCu: 1, outputDirectory: directory })
    const lines = readFileSync(journalPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    assert.equal(plan.length, 1_600)
    assert.equal(lines.length, 1_601)
    assert.equal(lines[0].transactionTransmission, 'NOT_ATTEMPTED')
    assert.equal(lines[1].status, 'PLANNED')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
