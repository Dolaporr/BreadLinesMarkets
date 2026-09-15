import { createHash, sign, verify } from 'node:crypto';
import { actionHash, approvalMessage, scheme } from './protocol.mjs';

const same = (a, b) => Buffer.from(a).equals(Buffer.from(b));

export function createWallet({ wallet, domain, threshold, slots, nonce = 0n, policyRevision = 0n }) {
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > slots.filter(s => s.slot.active).length) throw new Error('Invalid threshold');
  if (new Set(slots.map(s => s.slot.signerId)).size !== slots.length) throw new Error('Duplicate slot');
  return { wallet: Buffer.from(wallet), domain: Buffer.from(domain), threshold, slots, nonce, policyRevision, pending: null };
}

export function createPendingAction(wallet, intent) {
  if (wallet.pending && !wallet.pending.executed) throw new Error('Pending action already exists');
  if (!same(wallet.wallet, intent.wallet) || !same(wallet.domain, intent.domain)) throw new Error('Wrong wallet/domain');
  if (intent.nonce !== wallet.nonce) throw new Error('Wrong nonce');
  if (intent.policyRevision !== wallet.policyRevision) throw new Error('Wrong policy revision');
  const pending = { wallet: Buffer.from(wallet.wallet), domain: Buffer.from(wallet.domain), nonce: wallet.nonce,
    policyRevision: wallet.policyRevision, actionHash: actionHash(intent), approvalBitmap: 0, executed: false };
  return { ...wallet, pending };
}

export function makeApproval(pending, signer) {
  const signature = sign(null, approvalMessage(pending, signer.slot), signer.privateKey);
  return { wallet: Buffer.from(pending.wallet), actionHash: Buffer.from(pending.actionHash), nonce: pending.nonce,
    signerId: signer.slot.signerId, scheme: signer.slot.scheme, schemeVersion: signer.slot.schemeVersion, signature };
}

export function submitApproval(wallet, approval) {
  const pending = wallet.pending;
  if (!pending) throw new Error('No pending action');
  if (pending.executed) throw new Error('Action already executed');
  if (!same(approval.wallet, pending.wallet) || !same(approval.actionHash, pending.actionHash)) throw new Error('Different action');
  if (approval.nonce !== pending.nonce) throw new Error('Wrong nonce');
  const registered = wallet.slots.find(s => s.slot.signerId === approval.signerId);
  if (!registered) throw new Error('Wrong signer slot');
  if (!registered.slot.active) throw new Error('Inactive signer');
  if (approval.scheme !== registered.slot.scheme || approval.schemeVersion !== registered.slot.schemeVersion) throw new Error('Wrong scheme/version');
  const bit = 1 << registered.slot.signerId;
  if (pending.approvalBitmap & bit) throw new Error('Duplicate approval');
  const expected = scheme(registered.slot.scheme);
  if (!(approval.signature instanceof Uint8Array) || approval.signature.length !== expected.signatureBytes) throw new Error('Malformed signature');
  const actualFingerprint = createHash('sha256').update(registered.publicKey.export({ format: 'der', type: 'spki' })).digest();
  if (!Buffer.from(registered.slot.keyFingerprint).equals(actualFingerprint)) throw new Error('Key fingerprint mismatch');
  let accepted = false;
  try { accepted = verify(null, approvalMessage(pending, registered.slot), registered.publicKey, approval.signature); } catch { accepted = false; }
  if (!accepted) throw new Error('Malformed signature');
  return { ...wallet, pending: { ...pending, approvalBitmap: pending.approvalBitmap | bit } };
}

export function approvalCount(bitmap) {
  let count = 0; for (let value = bitmap; value; value >>>= 1) count += value & 1; return count;
}

export function executeOnce(wallet, intent) {
  const pending = wallet.pending;
  if (!pending) throw new Error('No pending action');
  if (pending.executed) throw new Error('Action already executed');
  if (!same(wallet.wallet, intent.wallet) || !same(wallet.domain, intent.domain) || !same(actionHash(intent), pending.actionHash)) throw new Error('Different action');
  if (intent.nonce !== pending.nonce || intent.nonce !== wallet.nonce) throw new Error('Wrong nonce');
  if (intent.policyRevision !== pending.policyRevision || intent.policyRevision !== wallet.policyRevision) throw new Error('Wrong policy revision');
  if (approvalCount(pending.approvalBitmap) < wallet.threshold) throw new Error('Threshold not met');
  return { ...wallet, nonce: wallet.nonce + 1n, pending: { ...pending, executed: true } };
}
