import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { scheme, hash, authorizationMessage } from './protocol.mjs';

// REAL OpenSSL-backed host verification. No SBF adapter or hash-comparison substitute.
export const ADAPTER_STATUS = 'HOST_ONLY';
export function createSigner(schemeId, signerId) {
  const s = scheme(schemeId);
  const { publicKey, privateKey } = generateKeyPairSync(s.node);
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return { publicKey, privateKey, publicKeyDer: der,
    slot: { signerId, scheme: schemeId, schemeVersion: 1, generation: 0n, active: true, keyFingerprint: hash(der) } };
}
export function signAuthorization(intent, signer) {
  return sign(null, authorizationMessage(intent, signer.slot), signer.privateKey);
}
export function verifyAuthorization(intent, slot, publicKey, signature) {
  const s = scheme(slot.scheme);
  if (!slot.active || publicKey.asymmetricKeyType !== s.node || signature.length !== s.signatureBytes) return false;
  if (!hash(publicKey.export({ format: 'der', type: 'spki' })).equals(slot.keyFingerprint)) return false;
  try { return verify(null, authorizationMessage(intent, slot), publicKey, signature); }
  catch { return false; }
}
export function verifyOnchain() {
  throw new Error('TOOLCHAIN_BLOCKED: no SBF verifier or local validator; host verification is not on-chain evidence');
}
