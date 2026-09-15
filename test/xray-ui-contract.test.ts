import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

/**
 * The adversarial audit models the viewer's rendered strings in `audit/run-audit.ts`. That model
 * is only trustworthy while it matches the components. These assertions pin the expressions the
 * audit depends on, so a UI edit that drops a commitment disclosure fails here rather than
 * silently passing an audit that is checking a stale copy of the UI.
 */
const workspace = readFileSync(new URL('../app/research/xray/workspace.tsx', import.meta.url), 'utf8')
const atlas = readFileSync(new URL('../app/research/xray/execution-atlas.tsx', import.meta.url), 'utf8')

test('the verdict panel renders the commitment statement', () => {
  assert.match(workspace, /<p className=\{styles\.boundary\}>\{current\.execution\.stateCommitment\.statement\}<\/p>/)
})

test('the invocation path panel renders the commitment statement and the qualified frame verb', () => {
  assert.match(workspace, /Select an invocation to inspect its exact log range\. \{current\.execution\.stateCommitment\.statement\}/)
  assert.match(workspace, /\{frameStatusLabel\(f\.status, current\.state\)\}/)
  // The raw status must not be rendered as an outcome anywhere in the frame list.
  assert.equal(/\{f\.status\.toLowerCase\(\)\}/.test(workspace), false)
})

test('the outer positions panel renders the commitment statement', () => {
  assert.match(workspace, /\{current\.execution\.stateCommitment\.statement\}\s*A position reached before the rejection is execution, not commitment\./)
})

test('the atlas qualifies frame status in its labels and caption', () => {
  assert.match(atlas, /frameStatusLabel\(f\.status, current\.state\)/)
  assert.match(atlas, /returned success and was still rolled back/)
  assert.equal(/\$\{f\.status\}/.test(atlas), false)
})

const preinclusion = readFileSync(new URL('../app/research/xray/preinclusion-evidence.tsx', import.meta.url), 'utf8')

test('the pre-inclusion section is a distinct tab in the viewer', () => {
  assert.match(workspace, /<TabsTrigger value="preinclusion">05 \/ Pre-inclusion evidence<\/TabsTrigger>/)
  assert.match(workspace, /<PreInclusionEvidence key=\{current\.signature\} current=\{current\} trace=\{trace\} \/>/)
})

test('all four attestation rungs are rendered and visually distinct', () => {
  for (const rung of ['CLIENT_OBSERVED', 'PROVIDER_REPORTED', 'VALIDATOR_ATTESTED', 'CHAIN_PROVEN']) {
    assert.match(preinclusion, new RegExp(`${rung}:\\s*\\{`), `${rung} rung missing`)
  }
  const css = readFileSync(new URL('../app/research/xray/workspace.module.css', import.meta.url), 'utf8')
  for (const cls of ['clientObserved', 'providerReported', 'validatorAttested', 'chainProven']) {
    assert.match(css, new RegExp(`\\.${cls}\\{border-left-color:`), `${cls} needs its own colour`)
  }
})

test('the pre-inclusion section states that absence proves nothing and never infers from timing', () => {
  assert.match(preinclusion, /Its absence says nothing/)
  assert.match(preinclusion, /not evidence that no preconfirmation was issued/)
  // A duration is only ever shown when the readings share a clock.
  assert.match(preinclusion, /comparable \? `\$\{result\.timing\.senderToProviderDuration\.ms\} ms on one clock`/)
  assert.match(preinclusion, /PRECONFIRMATION_PROHIBITED_READINGS/)
})

test('the pre-inclusion section renders issuer, basis and the lifecycle map', () => {
  assert.match(preinclusion, /result\.preconfirmationState\?\.sourceDescription/)
  assert.match(preinclusion, /result\.preconfirmationState\?\.sourceBasis/)
  assert.match(preinclusion, /result\.preconfirmationState\?\.sourceRationale/)
  assert.match(preinclusion, /result\.reconciliation\.state/)
  assert.match(preinclusion, /result\.evidenceMap/)
  // Each stage must render its own evidence class and its own not-established line.
  assert.match(preinclusion, /stage\.evidenceLabel/)
  assert.match(preinclusion, /Not established: \{stage\.notEstablished\}/)
  assert.match(preinclusion, /MAP_BOUNDARY/)
})

test('UNKNOWN stages are visually marked rather than hidden', () => {
  assert.match(preinclusion, /stage\.evidence === 'UNKNOWN' \? styles\.stageUnknown/)
  assert.match(preinclusion, /unknownStageCount\} of \{result\.evidenceMap\.stages\.length\} stages not established/)
  const css = readFileSync(new URL('../app/research/xray/workspace.module.css', import.meta.url), 'utf8')
  assert.match(css, /\.stageUnknown\{/)
  for (const tone of ['evUnknown', 'evClient', 'evProvider', 'evValidator', 'evChain']) {
    assert.match(css, new RegExp(`\\.${tone}\\{color:`), `${tone} needs its own colour`)
  }
})

test('each reconciliation state has a distinct chip colour', () => {
  const css = readFileSync(new URL('../app/research/xray/workspace.module.css', import.meta.url), 'utf8')
  for (const state of ['PENDING', 'MATCHED', 'UNRESOLVED', 'MISMATCH']) {
    assert.match(css, new RegExp(`\\.state${state}\\{color:`), `${state} needs its own colour`)
  }
})

test('the viewer renders ordering evidence without attestation vocabulary', () => {
  assert.match(preinclusion, /result\.evidenceMap\.ordering/)
  assert.match(preinclusion, /ordering\.authentication/)
  assert.match(preinclusion, /ordering\.doesNotEstablish/)
  assert.match(preinclusion, /ordering\.check\.scope/)
  // The claim and the check are rendered as separate things, never merged.
  assert.match(preinclusion, /ordering\.claim\.describes/)
  assert.match(preinclusion, /ordering\.check\.method/)
  for (const pattern of [/cryptographically attested ordering/i, /ordering is proven/i, /signed sequence/i]) {
    assert.equal(pattern.test(preinclusion), false, `UI must not contain ${pattern}`)
  }
})

// --- mobile: summary first, detail on demand ---------------------------------------------------

test('the summary card leads with source, basis, emission, evidence class and unknown count', () => {
  assert.match(preinclusion, /styles\.summaryCard/)
  assert.match(preinclusion, /SOURCE NOT ESTABLISHED/)
  assert.match(preinclusion, /Source basis<\/dt>/)
  assert.match(preinclusion, /Emission<\/dt>/)
  assert.match(preinclusion, /Evidence class<\/dt>/)
  assert.match(preinclusion, /Reconciliation<\/dt>/)
  assert.match(preinclusion, /unknownStageCount\} \/ \{result\.evidenceMap\.stages\.length\} stages unknown/)
  // Status appears only when the payload carried one.
  assert.match(preinclusion, /statusCode != null && <div className=\{styles\.summaryItem\}><dt>Status<\/dt>/)
})

test('an unattributed record reads as not established and never implies BAM', () => {
  // The headline is the explicit phrase, not a bare UNKNOWN that could read as a named issuer.
  assert.match(preinclusion, /source === 'UNKNOWN' \? 'SOURCE NOT ESTABLISHED'/)
  assert.match(preinclusion, /styles\.sourceUnknown/)
  // No BAM literal may appear in the component at all: the path name comes from the model.
  assert.equal(/\bBAM\b/.test(preinclusion), false, 'the component must not hardcode a BAM label')
})

test('an unknown stage is labelled NOT ESTABLISHED rather than left blank', () => {
  assert.match(preinclusion, /stage\.evidence === 'UNKNOWN' \? 'NOT ESTABLISHED' : stage\.evidenceLabel/)
  assert.match(preinclusion, /stage\.evidence === 'UNKNOWN' \? styles\.stageCardUnknown/)
})

test('long rationales and raw provenance sit behind expandable controls', () => {
  assert.match(preinclusion, /<summary>Evidence details<\/summary>/)
  assert.match(preinclusion, /<summary>Raw provenance<\/summary>/)
  // Per-stage detail is collapsed too.
  assert.match(preinclusion, /styles\.stageDetails/)
})

test('uninterpreted fields are labelled and stated to be unauthenticated', () => {
  assert.match(preinclusion, /<h4>Uninterpreted fields<\/h4>/)
  assert.match(preinclusion, /does not interpret them/i)
  assert.match(preinclusion, /not established as authenticated ordering evidence/i)
  assert.match(preinclusion, /record\.unmodelledFields\.map/)
})

test('multiple clock domains warn concisely and no duration is calculated', () => {
  assert.match(preinclusion, /MULTIPLE CLOCKS/)
  assert.match(preinclusion, /no duration between them is calculated/i)
  assert.match(preinclusion, /Not calculated — readings are on different clocks/)
  // A duration string may only be produced on the comparable branch.
  assert.match(preinclusion, /comparable \? `\$\{result\.timing\.senderToProviderDuration\.ms\} ms on one clock`/)
})

test('the mobile breakpoint swaps the wide lifecycle for stacked cards', () => {
  const css = readFileSync(new URL('../app/research/xray/workspace.module.css', import.meta.url), 'utf8')
  assert.match(css, /@media\(max-width:768px\)\{[^}]*\.lifecycle\{display:none\}/)
  assert.match(css, /\.stageCards\{display:none\}/, 'stacked cards are mobile-only by default')
  assert.match(css, /\.stageCards\{display:block/, 'and are shown at the breakpoint')
  for (const cls of ['summaryCard', 'summaryGrid', 'stageCard', 'opaqueFields', 'clockWarn']) {
    assert.match(css, new RegExp(`\\.${cls}\\{`), `${cls} needs styling`)
  }
})

test('the synthetic banner stays above everything else in the attached view', () => {
  const attached = preinclusion.slice(preinclusion.indexOf('</div> : <>'))
  const banner = attached.indexOf('syntheticBanner')
  const summary = attached.indexOf('summaryCard')
  assert.ok(banner > -1 && summary > -1)
  assert.ok(banner < summary, 'the synthetic warning must precede the summary card')
})
