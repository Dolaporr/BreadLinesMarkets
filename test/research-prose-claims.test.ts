import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { lintFiles } from '../scripts/claim-lint.ts'
import { inject } from '../scripts/render-evidence-matrix.ts'
import { matrixMarkdown } from '../research/execution-casefile/evidence-matrix.ts'

const MEMO = 'docs/bam-preconfirmation-evidence-study.md'

test('published research prose makes no claim the evidence cannot support', async () => {
  const files = [
    MEMO,
    ...globSync('research/*.md'),
    ...globSync('research/execution-casefile/*.md'),
    ...globSync('research/execution-casefile/audit/*.md'),
    ...globSync('research/execution-xray/*.md'),
    ...globSync('research/v1-budget-source/*.md'),
  ]
  const findings = await lintFiles(files)
  assert.deepEqual(findings, [], `claim lint findings:\n${findings.map((f) => `${f.file}:${f.line} ${f.check}\n  ${f.sentence}`).join('\n')}`)
})

test('the claim linter still catches the claims it exists to catch', async () => {
  // Guards against the linter being loosened until it passes by accepting anything.
  const { writeFileSync, mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'claimlint-'))
  const file = join(dir, 'violations.md')
  writeFileSync(file, [
    'The route failed at the last hop, so it got there too late.',
    '',
    'Shared writable accounts caused the failure.',
    '',
    'Our provider partnered with them and guarantees inclusion.',
    '',
    'The first leg went through before the transaction failed.',
  ].join('\n'))
  const findings = await lintFiles([file])
  const checks = new Set(findings.map((f) => f.check))
  assert.ok(checks.has('TELEMETRY_CLAIM_LATENESS'), 'lateness must be caught')
  assert.ok(checks.has('PROSE_CAUSED'), 'causation must be caught')
  assert.ok(checks.has('PROSE_PARTNERSHIP'), 'partnership claims must be caught')
  assert.ok(checks.has('PROSE_GUARANTEE'), 'inclusion guarantees must be caught')
  assert.ok(checks.has('COMMITMENT_IMPLIED'), 'partial commitment must be caught')
})

test('the memo matrix is generated from the evidence-matrix module and is current', () => {
  const memo = readFileSync(MEMO, 'utf8')
  assert.equal(inject(memo), memo, 'run scripts/render-evidence-matrix.ts — the memo table is stale')
  assert.ok(memo.includes(matrixMarkdown()), 'the memo must contain the generated matrix verbatim')
})

test('the memo answers every question it was commissioned to answer', () => {
  const memo = readFileSync(MEMO, 'utf8')
  for (const heading of [
    'a preconfirmation is not a faster receipt',
    'The evidence matrix',
    'What must be preserved for post-mortem analysis',
    'Reconstructing ordering and timing responsibly',
    'Claims that still cannot be made',
    'What Breadlines would need to produce a rigorous execution-quality study',
  ]) assert.ok(memo.includes(heading), `memo is missing: ${heading}`)

  // A concrete, numbered ask is the point of the Jito section.
  const questions = memo.slice(memo.indexOf('### Questions for Jito engineers'))
  assert.ok((questions.match(/^\d+\. /gm) ?? []).length >= 8, 'the Jito question list must be concrete and enumerated')
  const telemetry = memo.slice(memo.indexOf('### Telemetry'), memo.indexOf('### Questions for Jito engineers'))
  assert.ok((telemetry.match(/^\d+\. /gm) ?? []).length >= 6, 'the telemetry ask must be concrete and enumerated')

  // No partnership may be implied anywhere.
  assert.match(memo, /Breadlines has no relationship with Jito/)
})
