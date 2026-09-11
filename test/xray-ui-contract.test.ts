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
