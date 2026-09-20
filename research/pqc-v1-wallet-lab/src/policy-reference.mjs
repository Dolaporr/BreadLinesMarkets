// HOST-ONLY TEST ORACLE. No deployable wallet, native authority bypass, CPI or transfer implementation.
import { encodeIntent, bytes32, uint } from './protocol.mjs';
import { verifyAuthorization } from './verifier.mjs';

export function authorizeHostFixture(state, intent, approvals) {
  encodeIntent(intent); // Reject noncanonical/malformed fields before cryptography.
  if (!bytes32(state.wallet).equals(intent.wallet) || !bytes32(state.domain).equals(intent.domain)) throw new Error('Wrong wallet/domain');
  if (intent.nonce !== state.nonce) throw new Error('Nonce/replay rejection');
  if (intent.policyRevision !== state.policyRevision) throw new Error('Stale policy revision');
  if (!Number.isInteger(state.threshold) || state.threshold < 1 || state.threshold > state.slots.filter(s => s.slot.active).length) throw new Error('Invalid threshold');
  if (!Array.isArray(approvals) || new Set(approvals.map(a => a.signerId)).size !== approvals.length) throw new Error('Duplicate signer slot');
  for (const approval of approvals) {
    const registered = state.slots.find(s => s.slot.signerId === approval.signerId);
    if (!registered || !registered.slot.active) throw new Error('Wrong or disabled signer slot');
    if (approval.scheme !== registered.slot.scheme || approval.schemeVersion !== registered.slot.schemeVersion) throw new Error('Wrong scheme/version');
    if (!verifyAuthorization(intent, registered.slot, registered.publicKey, approval.signature)) throw new Error('Invalid authorization');
  }
  if (approvals.length < state.threshold) throw new Error('Threshold not met');
  uint(state.nonce + 1n, 8);
  return { ...state, nonce: state.nonce + 1n, result: 'HOST_AUTHORIZATION_ONLY_NO_ACTION_EXECUTED' };
}
// Configuration transition oracle only. A deployed program MUST authorize this management action
// using the OLD policy and bind the complete replacement key/scheme/version before mutating state.
export function rotatedFixture(state, signerId, replacement) {
  const existing = state.slots.find(s => s.slot.signerId === signerId);
  if (!existing) throw new Error('Unknown signer slot');
  const updated = { ...replacement, slot: { ...replacement.slot, signerId, generation: existing.slot.generation + 1n } };
  uint(updated.slot.generation, 8); uint(state.policyRevision + 1n, 8);
  return { ...state, policyRevision: state.policyRevision + 1n,
    slots: state.slots.map(s => s.slot.signerId === signerId ? updated : s) };
}
