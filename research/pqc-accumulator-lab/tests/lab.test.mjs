import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureIntent } from '../../pqc-v1-wallet-lab/src/protocol.mjs';
import { createSigner } from '../../pqc-v1-wallet-lab/src/verifier.mjs';
import { createWallet, createPendingAction, makeApproval, submitApproval, executeOnce } from '../src/accumulator.mjs';
import { actionHash, approvalInstruction, PENDING_ACCOUNT_BYTES, walletAccountBytes } from '../src/protocol.mjs';
import { encodeApprovalEnvelope } from '../src/envelope.mjs';

function fixture() {
  const intent = fixtureIntent();
  const signers = [createSigner(1, 0), createSigner(2, 1), createSigner(1, 2)];
  let wallet = createWallet({ wallet: intent.wallet, domain: intent.domain, threshold: 2, slots: signers });
  wallet = createPendingAction(wallet, intent);
  return { intent, signers, wallet };
}

test('2-of-3 separately accumulates A then B and executes exactly once', () => {
  const { intent, signers, wallet } = fixture();
  const A = makeApproval(wallet.pending, signers[0]);
  const B = makeApproval(wallet.pending, signers[1]);
  const afterA = submitApproval(wallet, A);
  assert.equal(afterA.pending.approvalBitmap, 1);
  assert.throws(() => executeOnce(afterA, intent), /Threshold/);
  const afterB = submitApproval(afterA, B);
  const executed = executeOnce(afterB, intent);
  assert.equal(executed.pending.executed, true);
  assert.equal(executed.nonce, 1n);
  assert.throws(() => submitApproval(executed, A), /executed/);
  assert.throws(() => executeOnce(executed, intent), /executed/);
});

test('the signature binds the complete canonical action via its hash', () => {
  const { intent, signers, wallet } = fixture();
  const approval = makeApproval(wallet.pending, signers[0]);
  const alteredAmount = { ...intent, actionData: Buffer.from(intent.actionData) }; alteredAmount.actionData[4] ^= 1;
  const alteredDestination = { ...intent, accounts: intent.accounts.map((account, i) => i === 1 ? { ...account, address: Buffer.alloc(32, 9) } : account) };
  assert.notDeepEqual(actionHash(intent), actionHash(alteredAmount));
  assert.notDeepEqual(actionHash(intent), actionHash(alteredDestination));
  assert.throws(() => executeOnce(submitApproval(wallet, approval), alteredAmount), /Different action/);
  assert.throws(() => executeOnce(submitApproval(wallet, approval), alteredDestination), /Different action/);
});

test('wrong nonce, duplicate, inactive slot, wrong slot, scheme and malformed signatures reject', () => {
  const { signers, wallet } = fixture();
  const A = makeApproval(wallet.pending, signers[0]);
  assert.throws(() => submitApproval(wallet, { ...A, nonce: 1n }), /nonce/);
  const afterA = submitApproval(wallet, A);
  assert.throws(() => submitApproval(afterA, A), /Duplicate/);
  assert.throws(() => submitApproval(wallet, { ...A, signerId: 99 }), /slot/);
  // Slot 2 has the same ML-DSA-44 parameter set as slot 0, so this reaches crypto and proves
  // the signer-slot binding rather than merely failing the scheme check.
  assert.throws(() => submitApproval(wallet, { ...A, signerId: 2 }), /Malformed/);
  assert.throws(() => submitApproval(wallet, { ...A, signerId: 1 }), /scheme/);
  assert.throws(() => submitApproval(wallet, { ...A, scheme: 2 }), /scheme/);
  assert.throws(() => submitApproval(wallet, { ...A, schemeVersion: 2 }), /scheme/);
  assert.throws(() => submitApproval(wallet, { ...A, signature: Buffer.alloc(1) }), /Malformed/);
  const inactive = { ...wallet, slots: wallet.slots.map((s, i) => i ? s : { ...s, slot: { ...s.slot, active: false } }) };
  assert.throws(() => submitApproval(inactive, A), /Inactive/);
});

test('approval transaction serialization isolates a single ML-DSA signature under v1 limit', () => {
  const { signers, wallet } = fixture();
  for (const signer of signers.slice(0, 2)) {
    const approval = makeApproval(wallet.pending, signer);
    const data = approvalInstruction(approval);
    const tx = encodeApprovalEnvelope(data);
    assert.equal(tx.nativeSignatureValid, true);
    assert.equal(tx.configMask, 12);
    assert.ok(tx.bytes.length <= 4096);
    assert.equal(data.length, approval.signature.length + 80);
  }
});

test('compact accumulator state stores results not signatures', () => {
  const { signers } = fixture();
  assert.equal(PENDING_ACCOUNT_BYTES, 91);
  assert.equal(walletAccountBytes(signers), 4755);
});
