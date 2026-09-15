import { createHash } from 'node:crypto';

export const SCHEMES = Object.freeze([
  { id: 1, name: 'ML-DSA-44', node: 'ml-dsa-44', family: 'ML-DSA', publicKeyBytes: 1312, signatureBytes: 2420 },
  { id: 2, name: 'ML-DSA-65', node: 'ml-dsa-65', family: 'ML-DSA', publicKeyBytes: 1952, signatureBytes: 3309 },
  { id: 3, name: 'SLH-DSA-SHA2-128s', node: 'slh-dsa-sha2-128s', family: 'SLH-DSA', publicKeyBytes: 32, signatureBytes: 7856 },
]);
export const V1_LIMIT = 4096;
export const LEGACY_LIMIT = 1232;
export const hash = bytes => createHash('sha256').update(bytes).digest();
export function scheme(id) {
  const s = SCHEMES.find(s => s.id === id);
  if (!s) throw new Error('Unsupported scheme');
  return s;
}
export function uint(value, width) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe integer');
  if (!['number', 'bigint'].includes(typeof value)) throw new Error('Integer required');
  const n = BigInt(value);
  if (n < 0n || n >= 1n << BigInt(width * 8)) throw new Error('Integer out of range');
  const b = Buffer.alloc(width);
  let remaining = n;
  for (let i = 0; i < width; i++) { b[i] = Number(remaining & 255n); remaining >>= 8n; }
  return b;
}
export function bytes32(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) throw new Error('Expected 32 bytes');
  return Buffer.from(bytes);
}
export const fixtureAddress = label => hash(Buffer.from(`BREADLINES-NOT-DEPLOYED:${label}`));
export function fixtureIntent() {
  const wallet = fixtureAddress('wallet');
  return {
    wallet, domain: hash(Buffer.from('BREADLINES-LOCAL-ONLY-GENESIS-DOMAIN')), nonce: 0n, policyRevision: 0n,
    actionProgram: Buffer.alloc(32), // System Program base58 111...111.
    accounts: [{ address: wallet, writable: true, signer: true },
      { address: fixtureAddress('recipient'), writable: true, signer: false }],
    actionData: Buffer.concat([uint(2, 4), uint(1n, 8)]),
  };
}
export function encodeIntent(intent) {
  if (intent.accounts.length > 64 || intent.accounts.length === 0) throw new Error('Invalid account count');
  if (new Set(intent.accounts.map(a => bytes32(a.address).toString('hex'))).size !== intent.accounts.length) throw new Error('Duplicate account');
  const metas = intent.accounts.map(a => {
    if (typeof a.writable !== 'boolean' || typeof a.signer !== 'boolean') throw new Error('Invalid account role');
    return Buffer.concat([bytes32(a.address), uint(Number(a.writable) | Number(a.signer) << 1, 1)]);
  });
  if (!(intent.actionData instanceof Uint8Array)) throw new Error('Action bytes required');
  return Buffer.concat([Buffer.from('BL-PQC-AUTH-v1\0'), bytes32(intent.wallet), bytes32(intent.domain),
    uint(intent.nonce, 8), uint(intent.policyRevision, 8), bytes32(intent.actionProgram),
    uint(metas.length, 1), ...metas, uint(intent.actionData.length, 2), intent.actionData]);
}
export function slotMetadata(slot) {
  scheme(slot.scheme);
  if (slot.schemeVersion !== 1) throw new Error('Unsupported scheme version');
  return Buffer.concat([uint(slot.signerId, 1), uint(slot.scheme, 2), uint(slot.schemeVersion, 2), uint(slot.generation, 8)]);
}
export function authorizationMessage(intent, slot) {
  return Buffer.concat([encodeIntent(intent), slotMetadata(slot), bytes32(slot.keyFingerprint)]);
}
export function authorizationPayload(intent, entries, inlineKeys = false) {
  if (!entries.length || entries.length > 3) throw new Error('Invalid selected signer count');
  let last = -1;
  const parts = entries.map(entry => {
    if (entry.slot.signerId <= last) throw new Error('Duplicate or noncanonical signer order');
    last = entry.slot.signerId;
    const s = scheme(entry.slot.scheme);
    if (!(entry.signature instanceof Uint8Array) || entry.signature.length !== s.signatureBytes) throw new Error('Malformed signature length');
    if (inlineKeys && (!(entry.rawPublicKey instanceof Uint8Array) || entry.rawPublicKey.length !== s.publicKeyBytes)) throw new Error('Malformed public key length');
    return Buffer.concat([slotMetadata(entry.slot), uint(entry.signature.length, 2), entry.signature,
      ...(inlineKeys ? [entry.rawPublicKey] : [])]);
  });
  const body = encodeIntent(intent);
  return Buffer.concat([uint(inlineKeys ? 2 : 1, 1), uint(body.length, 2), body, uint(entries.length, 1), ...parts]);
}
export function assertEnvelopeSize(bytes, version) {
  if (![1, 0, 'legacy'].includes(version)) throw new Error('Unsupported transaction version');
  const limit = version === 1 ? V1_LIMIT : LEGACY_LIMIT;
  if (bytes.length > limit) throw new Error(`SIZE_BLOCKED: ${bytes.length} > ${limit}`);
  return true;
}
