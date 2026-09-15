import { createHash } from 'node:crypto';
import { encodeIntent, hash, scheme, slotMetadata, uint } from '../../pqc-v1-wallet-lab/src/protocol.mjs';

export { encodeIntent, hash, scheme };

export const APPROVAL_VERSION = 1;
export const APPROVAL_TAG = 1;
export const EXECUTE_TAG = 2;
export const actionHash = intent => hash(encodeIntent(intent));

// The action is canonically encoded before hashing. The approval signature binds that hash,
// so a program can verify approvals from compact pending state and later hash the supplied
// execution action again before invoking it.
export function approvalMessage(pending, slot) {
  return Buffer.concat([
    Buffer.from('BL-PQC-ACCUMULATOR-v1\0'),
    Buffer.from(pending.wallet), Buffer.from(pending.domain),
    uint(pending.nonce, 8), uint(pending.policyRevision, 8),
    Buffer.from(pending.actionHash), slotMetadata(slot), Buffer.from(slot.keyFingerprint),
  ]);
}

export function approvalInstruction(approval) {
  const expected = scheme(approval.scheme);
  if (!(approval.wallet instanceof Uint8Array) || approval.wallet.length !== 32) throw new Error('Malformed wallet');
  if (!(approval.actionHash instanceof Uint8Array) || approval.actionHash.length !== 32) throw new Error('Malformed action hash');
  if (!(approval.signature instanceof Uint8Array) || approval.signature.length !== expected.signatureBytes) throw new Error('Malformed signature');
  return Buffer.concat([
    uint(APPROVAL_TAG, 1), uint(APPROVAL_VERSION, 2), uint(approval.scheme, 2), uint(approval.signerId, 1),
    uint(approval.nonce, 8), Buffer.from(approval.wallet), Buffer.from(approval.actionHash),
    uint(approval.signature.length, 2), Buffer.from(approval.signature),
  ]);
}

// Borsh-like fixed account layouts. Pending stores only verification results; it never stores PQ signatures.
export const PENDING_ACCOUNT_BYTES = 8 + 32 + 32 + 8 + 8 + 1 + 1 + 1;
export function walletAccountBytes(slots) {
  const slotBytes = slots.reduce((total, slot) => total + 1 + 1 + 2 + 2 + 8 + 32 + 4 + scheme(slot.slot.scheme).publicKeyBytes, 0);
  return 8 + 1 + 8 + 8 + 4 + slotBytes;
}
