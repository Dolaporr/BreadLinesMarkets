import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPublicKey, verify } from 'node:crypto';
import { SCHEMES, fixtureIntent, encodeIntent, authorizationMessage, authorizationPayload, assertEnvelopeSize, uint, hash } from '../src/protocol.mjs';
import { encodeEnvelope, modeledEnvelopeBytes, newNativePayer } from '../src/envelope.mjs';
import { createSigner, signAuthorization, verifyAuthorization, verifyOnchain } from '../src/verifier.mjs';
import { authorizeHostFixture, rotatedFixture } from '../src/policy-reference.mjs';
const intent = fixtureIntent();
const signers = SCHEMES.map((s, i) => createSigner(s.id, i));
const approvals = signers.map(s => ({ signerId: s.slot.signerId, scheme: s.slot.scheme,
  schemeVersion: 1, signature: signAuthorization(intent, s) }));
const state = threshold => ({ wallet: intent.wallet, domain: intent.domain, nonce: 0n, policyRevision: 0n,
  threshold, slots: signers });
const entries = approvals.map((a, i) => ({ slot: signers[i].slot, signature: a.signature, rawPublicKey: Buffer.alloc(SCHEMES[i].publicKeyBytes) }));

test('canonical encoding is deterministic, property-order independent, and has fixed golden lengths', () => {
  assert.deepEqual(encodeIntent(intent), encodeIntent({ actionData: intent.actionData, ...intent }));
  assert.equal(encodeIntent(intent).length, 208);
  assert.equal(authorizationMessage(intent, signers[0].slot).length, 253);
  assert.equal(authorizationPayload(intent, entries.slice(0, 1)).length, 2647);
  assert.deepEqual(authorizationPayload(intent, entries), authorizationPayload(intent, entries));
});

for (const [i, s] of SCHEMES.entries()) {
  test(`${s.name}: real host valid accepted; modified message/signature/key rejected`, () => {
    const signer = signers[i]; const sig = approvals[i].signature;
    assert.equal(sig.length, s.signatureBytes);
    assert.equal(verifyAuthorization(intent, signer.slot, signer.publicKey, sig), true);
    assert.equal(verifyAuthorization({ ...intent, nonce: 1n }, signer.slot, signer.publicKey, sig), false);
    const changed = Buffer.from(sig); changed[0] ^= 1;
    assert.equal(verifyAuthorization(intent, signer.slot, signer.publicKey, changed), false);
    const other = createSigner(s.id, i);
    assert.equal(verifyAuthorization(intent, { ...signer.slot, keyFingerprint: other.slot.keyFingerprint }, other.publicKey, sig), false);
  });
  test(`${s.name}: persisted public evidence verifies independently without a private key`, () => {
    const artifact = JSON.parse(readFileSync(new URL(`../evidence/${s.node}-host.json`, import.meta.url)));
    const key = createPublicKey({ key: Buffer.from(artifact.public_key_spki_der_base64, 'base64'), format: 'der', type: 'spki' });
    assert.equal(verify(null, Buffer.from(artifact.authorization_message_base64, 'base64'), key, Buffer.from(artifact.signature_base64, 'base64')), true);
    assert.equal(artifact.private_key_persisted, false);
  });
}

test('authorization binds every requested domain/action field and signer context', () => {
  const signer = signers[0], sig = approvals[0].signature;
  const mutations = [
    { ...intent, wallet: Buffer.alloc(32, 8) }, { ...intent, domain: Buffer.alloc(32, 9) },
    { ...intent, policyRevision: 1n }, { ...intent, actionProgram: Buffer.alloc(32, 10) },
    { ...intent, accounts: [...intent.accounts].reverse() },
    { ...intent, accounts: intent.accounts.map((a, i) => i ? { ...a, writable: false } : a) },
    { ...intent, actionData: Buffer.concat([uint(2, 4), uint(2n, 8)]) },
  ];
  for (const altered of mutations) assert.equal(verifyAuthorization(altered, signer.slot, signer.publicKey, sig), false);
  assert.equal(verifyAuthorization(intent, { ...signer.slot, signerId: 2 }, signer.publicKey, sig), false);
  assert.equal(verifyAuthorization(intent, { ...signer.slot, generation: 1n }, signer.publicKey, sig), false);
});

test('nonce is consumed only after valid threshold; replay rejected by HOST policy oracle', () => {
  const original = state(2);
  assert.throws(() => authorizeHostFixture(original, intent, approvals.slice(0, 1)), /Threshold/);
  assert.equal(original.nonce, 0n);
  const next = authorizeHostFixture(original, intent, approvals.slice(0, 2));
  assert.equal(next.nonce, 1n);
  assert.throws(() => authorizeHostFixture(next, intent, approvals.slice(0, 2)), /Nonce\/replay/);
  assert.equal(next.result, 'HOST_AUTHORIZATION_ONLY_NO_ACTION_EXECUTED');
});

test('1/2/3-of-3 host policies require unique valid active slots, not bytes fitting', () => {
  for (const threshold of [1, 2, 3]) {
    assert.equal(authorizeHostFixture(state(threshold), intent, approvals.slice(0, threshold)).nonce, 1n);
    assert.throws(() => authorizeHostFixture(state(threshold), intent, approvals.slice(0, threshold - 1)), /Threshold/);
  }
  assert.throws(() => authorizeHostFixture(state(2), intent, [approvals[0], approvals[0]]), /Duplicate/);
  assert.throws(() => authorizeHostFixture({ ...state(1), threshold: 0 }, intent, [approvals[0]]), /Invalid threshold/);
  const disabled = { ...state(1), slots: signers.map((s, i) => i ? s : { ...s, slot: { ...s.slot, active: false } }) };
  assert.throws(() => authorizeHostFixture(disabled, intent, [approvals[0]]), /disabled/);
});

test('wrong slot, wrong scheme/version, malformed signatures rejected', () => {
  for (const change of [{ signerId: 99 }, { scheme: 2 }, { schemeVersion: 2 }, { signature: Buffer.alloc(2420) }, { signature: Buffer.alloc(2419) }]) {
    assert.throws(() => authorizeHostFixture(state(1), intent, [{ ...approvals[0], ...change }]));
  }
  assert.throws(() => authorizationPayload(intent, [{ slot: signers[0].slot, signature: Buffer.alloc(2419) }]), /length/);
  assert.throws(() => authorizationPayload(intent, [entries[0], entries[0]]), /Duplicate/);
  assert.throws(() => authorizationPayload(intent, [entries[1], entries[0]]), /order/);
});

test('rotation oracle retains wallet/slot identity but invalidates old revision and authorization', () => {
  const replacement = createSigner(2, 77);
  const rotated = rotatedFixture(state(1), 0, replacement);
  assert.deepEqual(rotated.wallet, intent.wallet);
  assert.equal(rotated.slots[0].slot.signerId, 0);
  assert.equal(rotated.slots[0].slot.scheme, 2);
  assert.equal(rotated.slots[0].slot.generation, 1n);
  assert.throws(() => authorizeHostFixture(rotated, intent, [approvals[0]]), /Stale/);
  const newIntent = { ...intent, policyRevision: 1n };
  assert.throws(() => authorizeHostFixture(rotated, newIntent, [approvals[0]]), /Wrong scheme/);
  const updatedSigner = rotated.slots[0];
  const approval = { signerId: 0, scheme: 2, schemeVersion: 1, signature: signAuthorization(newIntent, updatedSigner) };
  assert.equal(authorizeHostFixture(rotated, newIntent, [approval]).nonce, 1n);
});

test('integer bounds and malformed account roles cannot alter the encoding silently', () => {
  for (const n of [-1, 256, 1.1, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => uint(n, 1));
  assert.throws(() => encodeIntent({ ...intent, wallet: Buffer.alloc(31) }));
  assert.throws(() => encodeIntent({ ...intent, accounts: [intent.accounts[0], intent.accounts[0]] }), /Duplicate/);
  assert.throws(() => encodeIntent({ ...intent, accounts: [{ ...intent.accounts[0], writable: 'true' }] }));
});

test('independent formulas match actual SDK full envelopes for all subsets, bare and configured', () => {
  for (let mask = 1; mask < 8; mask++) {
    const payload = authorizationPayload(intent, entries.filter((_, i) => mask & (1 << i)));
    for (const version of ['legacy', 0, 1]) for (const configured of [false, true]) {
      const encoded = encodeEnvelope(payload, version, configured);
      assert.equal(encoded.bytes.length, modeledEnvelopeBytes(payload.length, version, configured));
      assert.equal(encoded.roundTrip, true);
      assert.equal(Buffer.from(encoded.base64, 'base64').length, encoded.bytes.length);
    }
  }
});

test('v1 config explicit; one ordinary native signature; no ALT or ComputeBudget instruction', () => {
  const payload = authorizationPayload(intent, entries.slice(0, 1));
  const encoded = encodeEnvelope(payload, 1, true, newNativePayer());
  assert.equal(encoded.nativeSignatureValid, true);
  assert.equal(encoded.bytes[0], 0x81);
  assert.equal(encoded.decodedMessage.header.numSignerAccounts, 1);
  assert.equal(encoded.configMask, 12);
  assert.deepEqual(encoded.configValues, [{ kind: 'u32', value: 1400000 }, { kind: 'u32', value: 65536 }]);
  assert.equal(encoded.decodedMessage.numInstructions, 1);
  assert.equal(encoded.decodedMessage.staticAccounts.length, 5);
  assert.equal('addressTableLookups' in encoded.decodedMessage, false);
});

test('4096 exact boundary admitted; 4097 rejected even if SDK encodes it', () => {
  const exact = encodeEnvelope(Buffer.alloc(4096 - 281), 1);
  assert.equal(exact.bytes.length, 4096);
  assertEnvelopeSize(exact.bytes, 1);
  const oversized = encodeEnvelope(Buffer.alloc(4097 - 281), 1);
  assert.throws(() => assertEnvelopeSize(oversized.bytes, 1), /SIZE_BLOCKED/);
});

test('legacy 1232 boundary independent of v1; smallest real signature cannot fit', () => {
  const exact = encodeEnvelope(Buffer.alloc(1232 - 317), 'legacy');
  assert.equal(exact.bytes.length, 1232);
  assertEnvelopeSize(exact.bytes, 'legacy');
  assert.throws(() => assertEnvelopeSize(Buffer.alloc(1233), 0), /SIZE_BLOCKED/);
  assert.throws(() => assertEnvelopeSize(encodeEnvelope(authorizationPayload(intent, entries.slice(0, 1)), 'legacy').bytes, 'legacy'), /SIZE_BLOCKED/);
});

test('persisted results agree with SDK and every tested pair is size-blocked', () => {
  const report = JSON.parse(readFileSync(new URL('../benchmark.json', import.meta.url)));
  assert.equal(report.onchain.compute_units_consumed, null);
  assert.equal(report.onchain.transactions_sent, 0);
  for (const row of report.combinations) {
    assert.equal(row.transaction_bytes, modeledEnvelopeBytes(row.authorization_payload_bytes));
    assert.equal(row.bytes_remaining_under_4096, 4096 - row.transaction_bytes);
    if (row.selected_signatures >= 2) assert.equal(row.fits_v1, false);
    assert.equal(row.inline_key_fits_v1, false);
    const artifact = JSON.parse(readFileSync(new URL(`../evidence/${row.combination.replaceAll('+', '')}-v1-envelope.json`, import.meta.url)));
    assert.equal(hash(Buffer.from(artifact.transaction_base64, 'base64')).toString('hex'), artifact.sha256);
    assert.equal(Buffer.from(artifact.transaction_base64, 'base64').length, row.transaction_bytes);
  }
});

test('host-only verification cannot be called an on-chain verifier', () => {
  assert.throws(() => verifyOnchain(), /TOOLCHAIN_BLOCKED/);
});
