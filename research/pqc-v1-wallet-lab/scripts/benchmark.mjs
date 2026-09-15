import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createPublicKey } from 'node:crypto';
import { VersionedTransaction } from '@solana/web3.js';
import { SCHEMES, fixtureIntent, authorizationMessage, authorizationPayload, hash } from '../src/protocol.mjs';
import { createSigner, signAuthorization, verifyAuthorization } from '../src/verifier.mjs';
import { encodeEnvelope, modeledEnvelopeBytes, newNativePayer, RESOURCES } from '../src/envelope.mjs';

const root = new URL('../', import.meta.url);
const write = (name, value) => writeFileSync(new URL(name, root), JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
mkdirSync(new URL('evidence/', root), { recursive: true });
const intent = fixtureIntent();
const signers = SCHEMES.map((s, i) => createSigner(s.id, i));
const host = [];
const entries = signers.map((signer, i) => {
  const s = SCHEMES[i];
  const message = authorizationMessage(intent, signer.slot);
  const startSign = performance.now();
  const signature = signAuthorization(intent, signer);
  const signMs = performance.now() - startSign;
  const startVerify = performance.now();
  const accepted = verifyAuthorization(intent, signer.slot, signer.publicKey, signature);
  const verifyMs = performance.now() - startVerify;
  const changed = Buffer.from(signature); changed[changed.length - 1] ^= 1;
  const wrongKey = createSigner(s.id, i);
  const negatives = {
    altered_message_rejected: !verifyAuthorization({ ...intent, nonce: 1n }, signer.slot, signer.publicKey, signature),
    altered_signature_rejected: !verifyAuthorization(intent, signer.slot, signer.publicKey, changed),
    wrong_public_key_rejected: !verifyAuthorization(intent, { ...signer.slot, keyFingerprint: wrongKey.slot.keyFingerprint }, wrongKey.publicKey, signature),
  };
  assert.equal(accepted, true); assert.ok(Object.values(negatives).every(Boolean));
  assert.equal(signature.length, s.signatureBytes);
  // Public evidence only. Raw keys are not inferred by subtracting ASN.1 overhead; their standard
  // byte counts are separate from the SPKI representation observed here.
  const evidence = { synthetic: true, scheme: s.name, adapter: `Node ${process.version} / OpenSSL ${process.versions.openssl}`,
    public_key_spki_der_base64: signer.publicKeyDer.toString('base64'),
    authorization_message_base64: message.toString('base64'), signature_base64: signature.toString('base64'),
    signature_sha256: hash(signature).toString('hex'), private_key_persisted: false };
  // Re-import exported public key: ensures saved public artifact is independently usable.
  assert.equal(verifyAuthorization(intent, signer.slot, createPublicKey({ key: signer.publicKeyDer, format: 'der', type: 'spki' }), signature), true);
  write(`evidence/${s.node}-host.json`, evidence);
  host.push({ scheme: s.name, status: 'HOST_ONLY', public_key_bytes: s.publicKeyBytes,
    public_key_spki_der_bytes: signer.publicKeyDer.length, signature_bytes: signature.length,
    canonical_authorization_message_bytes: message.length, valid_signature_accepted: accepted, ...negatives,
    host_sign_ms: signMs, host_verify_ms: verifyMs, timing_sample_size: 1, compute_units_consumed: null,
    evidence: `evidence/${s.node}-host.json` });
  return { slot: signer.slot, signature, rawPublicKey: Buffer.alloc(s.publicKeyBytes) };
});

const nativePayer = newNativePayer();
const rows = [];
for (let mask = 1; mask < 8; mask++) {
  const selected = entries.filter((_, i) => mask & (1 << i));
  const ids = SCHEMES.filter((_, i) => mask & (1 << i));
  const payload = authorizationPayload(intent, selected);
  const inlinePayload = authorizationPayload(intent, selected, true);
  const encoded = {};
  for (const version of ['legacy', 0, 1]) {
    const tx = encodeEnvelope(payload, version, true, nativePayer);
    assert.equal(tx.bytes.length, modeledEnvelopeBytes(payload.length, version));
    assert.equal(tx.nativeSignatureValid, true);
    const bare = encodeEnvelope(payload, version, false);
    assert.equal(bare.bytes.length, modeledEnvelopeBytes(payload.length, version, false));
    encoded[String(version)] = { bytes: tx.bytes.length, bare_envelope_bytes: bare.bytes.length,
      encoder_succeeded: true, native_signature_verified_on_host: true, round_trip: tx.roundTrip };
  }
  const v1 = encodeEnvelope(payload, 1, true, nativePayer);
  const inlineV1 = encodeEnvelope(inlinePayload, 1);
  assert.equal(inlineV1.bytes.length, modeledEnvelopeBytes(inlinePayload.length, 1));
  const row = {
    combination: ids.map((_, i) => 'ABC'[SCHEMES.indexOf(ids[i])]).join('+'), schemes: ids.map(s => s.name),
    selected_signatures: selected.length, registered_signer_slots: 3,
    public_key_bytes: ids.reduce((sum, s) => sum + s.publicKeyBytes, 0), public_key_bytes_carried: 0,
    signature_bytes: ids.reduce((sum, s) => sum + s.signatureBytes, 0),
    canonical_authorization_message_bytes_per_signer: authorizationMessage(intent, selected[0].slot).length,
    authorization_payload_bytes: payload.length, transaction_bytes: v1.bytes.length,
    bytes_remaining_under_4096: 4096 - v1.bytes.length, fits_v1: v1.bytes.length <= 4096,
    fits_legacy_1232: encoded.legacy.bytes <= 1232, fits_v0_1232: encoded['0'].bytes <= 1232,
    encodings: encoded, inline_key_v1_bytes: inlineV1.bytes.length, inline_key_fits_v1: inlineV1.bytes.length <= 4096,
    inline_key_evidence: 'SIZE_ONLY_ZERO_PLACEHOLDER_RAW_KEYS; not cryptographically verified inline-key execution',
    onchain_verify: 'NOT_RUN_TOOLCHAIN_BLOCKED', compute_units_consumed: null, loaded_accounts_data_size: null,
    result: v1.bytes.length <= 4096 ? 'HOST_ONLY_ONCHAIN_TOOLCHAIN_BLOCKED' : 'SIZE_BLOCKED',
  };
  rows.push(row);
  write(`evidence/${row.combination.replaceAll('+', '')}-v1-envelope.json`, {
    synthetic: true, deployed: false, submitted: false, valid_runtime_lifetime: false,
    native_signature_verified_on_host: true, bytes: v1.bytes.length, encoding: 'base64',
    transaction_base64: v1.base64, sha256: hash(v1.bytes).toString('hex'),
    config_mask: v1.configMask, config_values: v1.configValues,
    runtime_size_valid: row.fits_v1,
  });
}
const thresholds = [1, 2, 3].map(threshold => {
  const subsets = rows.filter(r => r.selected_signatures === threshold);
  return { policy: `${threshold}-of-3`, threshold, registered_slots: 3,
    exact_threshold_subsets: subsets.map(r => ({ combination: r.combination, fits_v1: r.fits_v1 })),
    fitting_subsets: subsets.filter(r => r.fits_v1).map(r => r.combination),
    every_threshold_subset_fits: subsets.every(r => r.fits_v1),
    any_threshold_subset_fits: subsets.some(r => r.fits_v1),
    onchain_feasibility: 'NOT_DEMONSTRATED' };
});
const first = encodeEnvelope(authorizationPayload(intent, entries.slice(0, 1)), 1, true, nativePayer);
let web3;
try {
  const decoded = VersionedTransaction.deserialize(first.bytes);
  try { decoded.serialize(); web3 = { read: true, serialize: true }; }
  catch (e) { web3 = { read: true, serialize: false, error: e.message }; }
} catch(e) { web3 = { read: false, serialize: false, error: e.message }; }
const environment = JSON.parse(readFileSync(new URL('environment.json', root)));
const result = { schema: 'breadlines-pqc-v1-lab-v0', generated_at_utc: new Date().toISOString(),
  scope: 'SYNTHETIC_OFFLINE_PAYLOADS_REAL_HOST_CRYPTOGRAPHY_NO_ONCHAIN_VERIFICATION',
  thresholds, schemes: host, combinations: rows, resources: RESOURCES,
  sdk: { kit: '8.3.0', v1_serialization: 'OBSERVED', independent_size_formula_matches: true, web3_version: '1.99.0', web3 },
  mainnet_feature_status: environment.rpc.status, feature_activation_slot: environment.rpc.activation_slot,
  registered_raw_public_keys_bytes: SCHEMES.reduce((n, s) => n + s.publicKeyBytes, 0),
  negative_control: { scheme: 'ML-DSA-87', public_key_bytes: 2592, signature_bytes: 4627,
    evidence: 'FIPS_204_SIZE_ONLY', fits_v1_signature_alone: false, onchain_verify: null, compute_units_consumed: null },
  onchain: { status: 'TOOLCHAIN_BLOCKED', transactions_sent: 0, deploys: 0, transfers: 0,
    simulation: 'NOT_RUN', compute_units_consumed: null, logs: null, failure_frame: null,
    heap_stack_issues: 'UNKNOWN_NOT_COMPILED', smart_account_program: 'DEFERRED_COMPUTE_GATE_NOT_REACHED' } };
write('benchmark.json', result);
write('scheme-matrix.json', { scheme_rows: host, combinations: rows, thresholds });
const yes = value => value ? 'yes' : 'no';
const table = ['| Scheme / subset | Signature bytes | v1 tx bytes | Legacy tx bytes | v0 tx bytes | Fits 1232 | Fits 4096 | On-chain verify | CU | Result |',
  '|---|---:|---:|---:|---:|---|---|---|---|---|',
  ...rows.map(r => `| ${r.combination}: ${r.schemes.join(' + ')} | ${r.signature_bytes} | ${r.transaction_bytes} | ${r.encodings.legacy.bytes} | ${r.encodings['0'].bytes} | ${yes(r.fits_legacy_1232)} | ${yes(r.fits_v1)} | not run | null | ${r.result} |`)];
writeFileSync(new URL('size-table.md', root), '# Serialized envelope measurements\n\nKeys pre-registered; signatures inline. All are synthetic offline transactions, with real host PQ signatures and a host-verified Ed25519 fee-payer signature. None submitted.\n\n' + table.join('\n') + '\n');
console.log(table.join('\n'));
console.log(JSON.stringify({ host: host.map(h => ({ scheme: h.scheme, verified: h.valid_signature_accepted, verify_ms: h.host_verify_ms })), thresholds, sdk: result.sdk }, null, 2));
