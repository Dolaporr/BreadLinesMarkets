/**
 * Adversarial semantic audit of X-Ray v1.2.0.
 *
 * Each surface is checked INDEPENDENTLY: a boundary printed in the viewer does not excuse an
 * exported JSON that reads as partial commitment, and vice versa. Run:
 *   node --experimental-strip-types research/execution-casefile/audit/run-audit.ts
 */
import { buildCaseFile, caseReport, frameStatusLabel, programName, type CaseFile } from '../core.ts'
import { inspectAccounts } from '../inspection.ts'
import { evidenceBundle } from '../bundle.ts'
import { buildExecutionEpisode, EXECUTION_EPISODE_SCHEMA_VERSION } from '../../../scripts/execution-episode-core.ts'
import { EXECUTION_XRAY_SCHEMA_VERSION } from '../../../scripts/execution-xray-core.ts'
import { auditCases } from './cases.ts'
import { authoredStrings, disclosesCommitment, scanAssertions, type Violation } from './probes.ts'

const provenance = { source: 'SYNTHETIC audit fixture — not chain evidence', sha256: null }

/**
 * Reproduces, verbatim, the strings the viewer renders, grouped by the panel a reader actually
 * looks at. `test/xray-ui-contract.test.ts` asserts these expressions still match the TSX.
 */
function uiPanels(c: CaseFile) {
  const verdict = [
    c.state.replaceAll('_', ' '),
    c.execution.semantic?.quantities ? 'The transfer stopped here.'
      : c.execution.semantic?.name ?? (c.execution.customError ? `Custom error ${c.execution.customError.decimal}`
      : c.state === 'LANDED_SUCCESS' ? 'Execution completed.' : 'Execution stopped.'),
    c.explanation,
    c.execution.stateCommitment.statement,
    c.execution.failurePath.map((id) => programName(c.execution.frames[id].programId)).join(' → '),
  ].filter(Boolean).join('\n')

  const invocationPath = [
    'Invocation path',
    c.execution.logsComplete ? 'Closed log frames' : 'Incomplete logs',
    `Select an invocation to inspect its exact log range. ${c.execution.stateCommitment.statement}`,
    ...c.execution.frames.map((f) => `${programName(f.programId)} · ${f.instruction ?? 'Instruction name unavailable'} · depth ${f.depth} · ${frameStatusLabel(f.status, c.state)}`),
  ].join('\n')

  const outerPositions = [
    'Outer instruction positions',
    `Receipt positions, starting at 1. ${c.execution.stateCommitment.statement} A position reached before the rejection is execution, not commitment.`,
    ...c.execution.outers.map((ix) => `${ix.index + 1} ${programName(ix.programId)} ${ix.state.replaceAll('_', ' ').toLowerCase()}`),
    c.execution.attributionBoundary,
  ].join('\n')

  const atlas = [
    'Follow the call. Open the evidence.',
    ...c.execution.frames.slice(0, 80).map((f) => `Call ${f.id + 1}: ${programName(f.programId)}, depth ${f.depth}, ${frameStatusLabel(f.status, c.state)}. Open logs.`),
    `${c.state === 'LANDED_FAILED' ? 'A call marked SUCCESS returned success and was still rolled back: this transaction committed nothing. ' : ''}Geometry shows log order and call depth—not time, arrival order or causal competition. ${c.execution.logsComplete ? 'Closed log frames.' : 'Incomplete logs: graph may omit calls.'}`,
  ].join('\n')

  const caseListRow = `${c.signature.slice(0, 7)} ${c.explanation} SLOT ${c.slot} · ${c.context.coverage.toLowerCase()} context`

  const accountsTab = [
    'Accounts & balances',
    inspectAccounts(c).balanceCoverage,
    inspectAccounts(c).tokenCoverage,
    inspectAccounts(c).boundary,
  ].join('\n')

  const nextEvidence = ['What would we need to know?', ...c.missingTelemetry.map((m) => `${m.question} ${m.required}`)].join('\n')

  return { verdict, invocationPath, outerPositions, atlas, caseListRow, accountsTab, nextEvidence }
}

function episodeFor(c: CaseFile) {
  return buildExecutionEpisode({
    schemaVersion: EXECUTION_EPISODE_SCHEMA_VERSION,
    xray: {
      schemaVersion: EXECUTION_XRAY_SCHEMA_VERSION,
      target: { signature: c.signature, blockTransactionIndex: 0, receipt: c.receipt as never },
      context: { transactions: [], slotRange: { start: c.slot, end: c.slot }, coverage: 'COMPLETE', sourceDescription: 'SYNTHETIC audit fixture' },
    },
  })
}

const violations: Violation[] = []
const rows: string[] = []

for (const audit of auditCases) {
  if (audit.expectRejection) {
    let message = ''
    try { buildCaseFile(audit.receipt, provenance); message = '(no rejection)' }
    catch (error) { message = (error as Error).message }
    const ok = audit.expectRejection.test(message)
    if (!ok) violations.push({ check: 'REJECTION_REASON', surface: 'normalizeReceipt', detail: audit.id, text: message })
    rows.push(`${ok ? 'PASS' : 'FAIL'}  ${audit.id.padEnd(30)} rejected: ${message.slice(0, 90)}`)
    continue
  }

  const c = buildCaseFile(audit.receipt, provenance)
  const failed = c.state === 'LANDED_FAILED'
  const report = caseReport(c)
  const bundle = evidenceBundle(c, null, false)
  const episode = episodeFor(c)
  const panels = uiPanels(c)

  // Raw receipt and verbatim logs are chain transcription, not Breadlines claims.
  const skip = ['receipt', 'logs', 'log', 'logMessages', 'explanationEvidence', 'ownLogIndices']
  const opts = { commitmentApplies: failed }
  violations.push(...scanAssertions(`${audit.id}/caseFileJson`, authoredStrings(bundle, skip), opts))
  violations.push(...scanAssertions(`${audit.id}/report`, [{ path: 'caseReport', text: report }], opts))
  violations.push(...scanAssertions(`${audit.id}/episodeJson`, authoredStrings(episode, skip), opts))
  for (const [name, text] of Object.entries(panels)) {
    violations.push(...scanAssertions(`${audit.id}/ui.${name}`, [{ path: name, text }], opts))
  }

  // Literal state token that asserts commitment.
  if (failed && JSON.stringify(c.execution.outers).includes('COMPLETED')) {
    violations.push({ check: 'OUTER_STATE_TOKEN', surface: `${audit.id}/caseFileJson`, detail: 'execution.outers', text: JSON.stringify(c.execution.outers) })
  }

  // Independent-surface rule: any surface showing per-frame or per-instruction reach on a failed
  // transaction must disclose commitment on its own.
  if (failed) {
    const reachSurfaces: Array<[string, string]> = [
      ['ui.verdict', panels.verdict],
      ['ui.invocationPath', panels.invocationPath],
      ['ui.outerPositions', panels.outerPositions],
      ['ui.atlas', panels.atlas],
      ['report', report],
    ]
    for (const [name, text] of reachSurfaces) {
      const showsReach = name === 'ui.verdict'
        || /\bsuccess\b/i.test(text) || /\bexecuted\b/i.test(text) || /→/.test(text)
      if (showsReach && !disclosesCommitment(text)) {
        violations.push({ check: 'SURFACE_WITHOUT_COMMITMENT', surface: `${audit.id}/${name}`, detail: name, text: text.slice(0, 160) })
      }
    }
  }

  const caseViolations = violations.filter((v) => v.surface.startsWith(`${audit.id}/`))
  rows.push(`${caseViolations.length ? 'FAIL' : 'PASS'}  ${audit.id.padEnd(30)} ${c.state.padEnd(14)} ${c.execution.stateCommitment.outcome.padEnd(14)} outers=${c.execution.outers.map((o) => o.state).join(',')}`)
}

console.log('# X-Ray v1.2.0 adversarial semantic audit\n')
console.log(rows.join('\n'))
console.log(`\n${violations.length} violation(s)\n`)
const grouped = new Map<string, Violation[]>()
for (const v of violations) grouped.set(v.check, [...(grouped.get(v.check) ?? []), v])
for (const [check, list] of [...grouped].sort()) {
  console.log(`## ${check} (${list.length})`)
  for (const v of list) console.log(`  ${v.surface} :: ${v.detail}\n    ${v.text.replace(/\n/g, ' | ').slice(0, 200)}`)
  console.log()
}
process.exitCode = violations.length ? 1 : 0
