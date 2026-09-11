import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'

/**
 * Runs the adversarial semantic audit as a regression gate. The audit exits non-zero on any
 * violation and prints the offending surface and sentence.
 */
test('the adversarial semantic audit reports no violations', () => {
  let output = ''
  try {
    output = execFileSync(process.execPath,
      ['--experimental-strip-types', 'research/execution-casefile/audit/run-audit.ts'],
      { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string }
    assert.fail(`semantic audit reported violations:\n${failure.stdout ?? ''}${failure.stderr ?? ''}`)
  }
  assert.match(output, /0 violation\(s\)/)
  // Every constructed case must actually have been exercised.
  for (const id of ['success-multi', 'early-failure', 'deep-cpi-failure', 'child-success-parent-fails',
    'sibling-cpis-one-fails', 'later-outers-not-reached', 'truncated-logs', 'v1-unsupported',
    'multi-root-atomic-synthetic']) {
    assert.match(output, new RegExp(`PASS\\s+${id}\\b`), `case ${id} did not pass`)
  }
})

test('the per-root commitment question reaches the viewer on a CPI route, not only outer instructions', async () => {
  const { buildCaseFile } = await import('../research/execution-casefile/core.ts')
  const { auditCases } = await import('../research/execution-casefile/audit/cases.ts')
  const provenance = { source: 'synthetic', sha256: null }

  // A Jupiter route reaching PumpSwap, Token and System through CPI has one non-budget outer
  // program. Counting outer instructions alone would miss exactly this shape.
  const deep = auditCases.find((c) => c.id === 'deep-cpi-failure')!
  const routed = buildCaseFile(deep.receipt, provenance)
  assert.ok(routed.missingTelemetry.some((m) => /each market or state root/i.test(m.question)))

  // A transaction that reached exactly one program must not raise it — including when a later
  // outer instruction naming a second program was never reached.
  const single = auditCases.find((c) => c.id === 'early-failure')!
  const simple = buildCaseFile(single.receipt, provenance)
  assert.equal(simple.execution.outers.some((o) => o.state === 'NOT_REACHED'), true)
  assert.equal(simple.missingTelemetry.some((m) => /each market or state root/i.test(m.question)), false)
})
