import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildCaseFile, normalizeReceipt, type Receipt } from '../research/execution-casefile/core.ts'
import { reconcile } from '../research/execution-casefile/reconciliation.ts'
import { collectComputeBudget, derivePriorityFeeLamports } from '../lib/receipt-evidence.ts'

/**
 * Transaction v1 compatibility QA.
 *
 * This is not a v1 feature. It is the gate that keeps X-Ray from displaying a legacy reading of a
 * transaction that does not have legacy semantics. Everything here is pinned against a REAL
 * mainnet v1 receipt rather than a hand-built fixture, because the failure mode being guarded
 * against is one where a synthetic case would agree with the code and the chain would not.
 *
 * Captured 2026-09-17 from api.mainnet-beta.solana.com — see fixtures/README.md.
 */
const RECEIPT = JSON.parse(
  readFileSync(new URL('../research/execution-casefile/fixtures/mainnet-v1-receipt.json', import.meta.url), 'utf8'),
) as Receipt & { transaction: { message: { transactionConfig: Record<string, number | null> } } }

const CONFIG = RECEIPT.transaction.message.transactionConfig
const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111'
const UNSUPPORTED_VERSION = /Unsupported transaction version/i
const UNSUPPORTED_CONFIG = /Unsupported transaction configuration/i

// 0. The fixture is only worth anything while it still has the dangerous shape.
test('the fixture is a real mainnet v1 receipt whose budget lives only in transactionConfig', () => {
  assert.equal(RECEIPT.version, 1, 'the fixture must be served as version 1')
  assert.ok(Number.isSafeInteger(RECEIPT.slot) && RECEIPT.slot > 0)
  assert.ok(RECEIPT.transaction.signatures?.[0], 'a real receipt carries its signature')

  // The budget is declared in the v1 config...
  assert.equal(CONFIG.computeUnitLimit, 2100)
  assert.equal(CONFIG.priorityFee, 1050)
  assert.equal(CONFIG.loadedAccountsDataSizeLimit, 393216)
  assert.equal(CONFIG.heapSize, null)

  // ...and NOWHERE else. Zero ComputeBudget instructions is what makes a legacy reading wrong
  // rather than merely incomplete: there is nothing for the legacy parser to find.
  const message = RECEIPT.transaction!.message!
  const keys = message.accountKeys!.map((k) => (typeof k === 'string' ? k : k.pubkey))
  const budgetIxs = message.instructions!.filter((ix) => keys[(ix as { programIdIndex: number }).programIdIndex] === COMPUTE_BUDGET)
  assert.equal(budgetIxs.length, 0, 'the fixture must carry no ComputeBudget instruction')
})

// 1. Every surface that parses a receipt refuses it.
test('a real mainnet v1 receipt is refused by the casefile parser', () => {
  assert.throws(() => normalizeReceipt(RECEIPT), UNSUPPORTED_VERSION)
  assert.throws(() => buildCaseFile(RECEIPT, { source: 'mainnet RPC', sha256: null }), UNSUPPORTED_VERSION)
})

test('a v1 receipt cannot enter the pre-inclusion evidence path either', () => {
  // reconcile() builds a casefile from the supplied receipt, so the gate has to hold here too.
  // If it ever stops holding, an uploaded v1 receipt would be reconciled against a preconfirmation
  // using resource semantics that do not apply to it.
  assert.throws(() => reconcile({ receipt: RECEIPT }), UNSUPPORTED_VERSION)
})

// 2. The two guards are independent, so neither is load-bearing alone.
test('stripping the version field does not get a v1 receipt past the gate', () => {
  const noVersion = structuredClone(RECEIPT) as Record<string, unknown>
  delete noVersion.version
  // The version guard cannot fire. The configuration guard must, on its own.
  assert.throws(() => normalizeReceipt(noVersion), UNSUPPORTED_CONFIG)
})

test('a legacy receipt is still accepted, so the gate is not simply refusing everything', () => {
  const legacy = structuredClone(RECEIPT) as Record<string, any>
  legacy.version = 'legacy'
  delete legacy.transaction.message.transactionConfig
  const parsed = normalizeReceipt(legacy)
  assert.equal(parsed.version, 'legacy')
  assert.equal(parsed.slot, RECEIPT.slot)
})

// 3. Why the gate exists, stated as a number rather than a worry.
test('the legacy budget reading of this receipt is wrong, which is what the gate prevents', () => {
  // This is what X-Ray would have displayed had the receipt reached the legacy parser.
  const budget = collectComputeBudget(RECEIPT as never)
  const priority = derivePriorityFeeLamports(RECEIPT as never, budget)

  // It finds nothing, and "nothing" here is not "unset" — it is a wrong answer about a real field.
  assert.equal(budget.computeUnitLimit, null)
  assert.equal(budget.computeUnitPriceMicroLamports, null)
  assert.equal(budget.computeUnitPriceStatus, 'omitted')
  assert.equal(priority.amountLamports, null)

  // The chain says otherwise, and the receipt's own fee arithmetic confirms it: base fee for one
  // signature plus the configured priority fee, to the lamport.
  const signatures = RECEIPT.transaction!.message!.header!.numRequiredSignatures
  assert.equal(signatures, 1)
  assert.equal(RECEIPT.meta!.fee, 5_000 * signatures + (CONFIG.priorityFee as number))
  assert.equal(RECEIPT.meta!.fee, 6050)

  // And the legacy formula does not merely miss the value, it computes a different one: v1's
  // priorityFee is a flat lamport amount, not micro-lamports per compute unit.
  const legacyFormula = Math.ceil(((CONFIG.computeUnitLimit as number) * (CONFIG.priorityFee as number)) / 1_000_000)
  assert.equal(legacyFormula, 3)
  assert.notEqual(legacyFormula, CONFIG.priorityFee)
})

// 4. The refusal is a refusal, not a degraded render.
test('the refusal names v1 and produces no casefile to display', () => {
  let message = ''
  try { buildCaseFile(RECEIPT, { source: 'mainnet RPC', sha256: null }) } catch (error) { message = (error as Error).message }
  assert.match(message, /Transaction v1 is not decoded/i)
  assert.match(message, /supports legacy and v0 JSON/i)
  // It must not offer a partial interpretation as a consolation prize.
  assert.doesNotMatch(message, /compute unit|priority fee|estimated|approximate/i)
})

// 5. The live RPC surface refuses in Breadlines' own words, not the node's.
test('the receipt route pins the transaction version and fails closed on the RPC refusal', () => {
  const route = readFileSync(new URL('../app/api/receipt/route.ts', import.meta.url), 'utf8')

  // The request stays pinned at v0. Widening it would deliver a v1 body to a legacy reader.
  // Checked against code only: comments and the refusal message legitimately name v1.
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.match(code, /maxSupportedTransactionVersion: 0/)
  assert.equal(/maxSupportedTransactionVersion: [1-9]/.test(code), false, 'the route must not ask for v1 bodies')

  // The node's verbatim refusal, as mainnet-beta returns it (captured 2026-09-17). The route's
  // pattern has to match this exact wording or the 415 branch is dead code.
  const rpcRefusal = 'Transaction version (1) is not supported by the requesting client. Please try the request again with the following configuration parameter: "maxSupportedTransactionVersion": 1'
  const pattern = /Transaction version \((\d+)\) is not supported/i
  assert.match(route, /UNSUPPORTED_VERSION_PATTERN/)
  assert.ok(pattern.test(rpcRefusal), 'the route pattern must match the refusal the RPC actually sends')
  assert.match(route, /status: 415/)

  // And the reply must not pass the node's "retry with maxSupportedTransactionVersion: 1" advice
  // through to the reader as an instruction, since following it is exactly the wrong move.
  const message = /const UNSUPPORTED_VERSION_MESSAGE =\s*\n?\s*'([^']+)'/.exec(route)?.[1] ?? ''
  assert.ok(message.length > 0, 'the unsupported-version message must exist')
  assert.match(message, /legacy and v0/i)
  assert.match(message, /transactionConfig/)
  assert.equal(/try the request again|maxSupportedTransactionVersion/i.test(message), false)
})
