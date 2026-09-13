import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { reconcile } from '../research/execution-casefile/reconciliation.ts'
import { preconfirmation, receipt, rebuiltTrace } from '../research/execution-casefile/audit/bam-cases.ts'

/**
 * Synthetic fixtures exist to prove the model survives adversarial cases. They must never reach a
 * surface that reads as evidence.
 */

test('the generated case library contains no synthetic or fixture records', () => {
  const library = readFileSync('research/execution-casefile/generated/library.json', 'utf8')
  const parsed = JSON.parse(library) as { cases: Array<{ receipt: unknown; provenance: { source: string } }> }
  for (const entry of parsed.cases) {
    assert.equal(/synthetic|fixture/i.test(entry.provenance.source), false,
      `a generated case cites a synthetic source: ${entry.provenance.source}`)
  }
  // The fixture signatures used by the BAM and audit corpora must not appear in the library.
  for (const fixtureSignature of ['1'.repeat(88), '2'.repeat(88), '3'.repeat(88), '5'.repeat(88)]) {
    assert.equal(library.includes(fixtureSignature), false, 'a fixture signature leaked into the library')
  }
})

test('synthetic fixture modules are imported only by tests and the audit harness', () => {
  const offenders: string[] = []
  for (const file of [...globSync('app/**/*.tsx'), ...globSync('app/**/*.ts'), ...globSync('lib/**/*.ts'),
    ...globSync('scripts/**/*.ts'), ...globSync('research/execution-casefile/*.ts')]) {
    const source = readFileSync(file, 'utf8')
    if (/audit\/(bam-)?cases/.test(source)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], `synthetic fixtures must not be imported by product or script code: ${offenders.join(', ')}`)
})

test('a fixture anywhere in a reconciliation marks the whole result synthetic', () => {
  const fromPreconfirmation = reconcile({ preconfirmation: preconfirmation(), receipt: receipt() })
  assert.equal(fromPreconfirmation.synthetic, true)

  const fromTrace = reconcile({ attemptTrace: rebuiltTrace(), receipt: receipt({ signature: '2'.repeat(88) }) })
  assert.equal(fromTrace.synthetic, true)
  assert.match(fromTrace.syntheticReason!, /must not be presented as product evidence/i)
})

test('the viewer surfaces the synthetic marking rather than hiding it', () => {
  const component = readFileSync('app/research/xray/preinclusion-evidence.tsx', 'utf8')
  assert.match(component, /result\.synthetic &&/, 'the synthetic banner must be rendered')
  assert.match(component, /syntheticBanner/)
})

test('the memo states that no preconfirmation data has been collected', () => {
  const memo = readFileSync('docs/bam-preconfirmation-evidence-study.md', 'utf8')
  assert.match(memo, /No preconfirmation data has been collected/i)
  assert.match(memo, /never presented as results/i)
})
