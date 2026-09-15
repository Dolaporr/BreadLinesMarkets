import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fixtureIntent, SCHEMES } from '../../pqc-v1-wallet-lab/src/protocol.mjs';
import { createSigner } from '../../pqc-v1-wallet-lab/src/verifier.mjs';
import { createWallet, createPendingAction, makeApproval, submitApproval, executeOnce } from '../src/accumulator.mjs';
import { approvalInstruction, approvalMessage, PENDING_ACCOUNT_BYTES, walletAccountBytes } from '../src/protocol.mjs';
import { encodeApprovalEnvelope } from '../src/envelope.mjs';

const root = new URL('../', import.meta.url);
const stringify = value => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2) + '\n';
const write = (name, value) => writeFileSync(new URL(name, root), stringify(value));
mkdirSync(new URL('evidence/', root), { recursive: true });

const intent = fixtureIntent();
// Two ML-DSA-44 slots and one ML-DSA-65 slot establish a 2-of-3 threshold example.
const signers = [createSigner(1, 0), createSigner(2, 1), createSigner(1, 2)];
let wallet = createWallet({ wallet: intent.wallet, domain: intent.domain, threshold: 2, slots: signers });
wallet = createPendingAction(wallet, intent);

const approvals = signers.map(signer => {
  const start = performance.now();
  const approval = makeApproval(wallet.pending, signer);
  const hostVerifyStart = performance.now();
  const next = submitApproval({ ...wallet, pending: { ...wallet.pending, approvalBitmap: 0 } }, approval);
  const hostVerifyMs = performance.now() - hostVerifyStart;
  const data = approvalInstruction(approval);
  const tx = encodeApprovalEnvelope(data);
  const scheme = SCHEMES.find(candidate => candidate.id === signer.slot.scheme);
  return { approval, scheme: scheme.name, signature_bytes: approval.signature.length, approval_instruction_bytes: data.length,
    approval_transaction_bytes: tx.bytes.length, fits_v1_4096: tx.bytes.length <= 4096, native_fee_payer_signature_verified_on_host: tx.nativeSignatureValid,
    kit_v1_round_trip: true, config_mask: tx.configMask, host_submit_verify_ms: hostVerifyMs,
    host_signature_created_ms: performance.now() - start, submitted_to_chain: false, onchain_verify: 'NOT_RUN_SBF_TOOLCHAIN_UNAVAILABLE',
    compute_units_consumed: null, approval_bitmap_after_single_submit: next.pending.approvalBitmap };
});

const one = submitApproval(wallet, approvals[0].approval);
const two = submitApproval(one, approvals[1].approval);
const executed = executeOnce(two, intent);
const report = {
  schema: 'breadlines-pqc-accumulator-lab-v1', generated_at_utc: new Date().toISOString(),
  scope: 'SYNTHETIC_OFFLINE_REAL_ML_DSA_HOST_CRYPTO_AND_KIT_V1_SERIALIZATION_NO_ONCHAIN_EXECUTION',
  architecture: '2-of-3 registered ML-DSA signer slots -> separate approval transactions -> compact pending-action accumulator -> execute once',
  prior_inline_comparison: {
    source: '../pqc-v1-wallet-lab/benchmark.json',
    ml_dsa_44_plus_65_inline_transaction_bytes: 6252, v1_limit_bytes: 4096, inline_pair_fits_v1: false,
    interpretation: 'The pair is byte-blocked when carried together; accumulator approvals isolate one PQ signature per transaction.'
  },
  canonical_binding: {
    action_encoding: 'BL-PQC-AUTH-v1 canonical intent from prior lab: wallet, domain, nonce, policy revision, program, ordered account metas and action data.',
    action_hash: wallet.pending.actionHash.toString('hex'), canonical_action_bytes: (await import('../../pqc-v1-wallet-lab/src/protocol.mjs')).encodeIntent(intent).length,
    approval_message_bytes: approvalMessage(wallet.pending, signers[0].slot).length,
    approval_message: 'BL-PQC-ACCUMULATOR-v1 + wallet + domain + nonce + policy revision + SHA-256(canonical action) + signer slot + scheme/version + generation + key fingerprint'
  },
  threshold: { required: 2, slots: signers.map(s => ({ signer_slot: s.slot.signerId, scheme: SCHEMES.find(x => x.id === s.slot.scheme).name, scheme_version: s.slot.schemeVersion })),
    approval_bitmap_after_A: one.pending.approvalBitmap, approval_bitmap_after_B: two.pending.approvalBitmap, executed_after_two: executed.pending.executed,
    wallet_nonce_after_execution: executed.nonce },
  approval_transactions: approvals.map(({ approval, ...measurement }) => measurement),
  account_state: {
    pending_action_bytes: PENDING_ACCOUNT_BYTES,
    pending_layout: '8 discriminator + 32 wallet + 32 actionHash + 8 nonce + 8 policyRevision + 1 approvalBitmap + 1 executed + 1 bump',
    wallet_bytes_for_44_65_44_slots: walletAccountBytes(signers),
    wallet_layout: '8 discriminator + threshold/nonce/policy revision/vector prefix + each slot metadata, fingerprint and raw registered public key',
    pq_signature_bytes_not_retained_in_pending_state: true
  },
  onchain: { sbf_compile: 'NOT_RUN_RUST_TOOLCHAIN_INCOMPLETE', local_validator: 'NOT_RUN_SOLANA_CLI_ABSENT', real_onchain_verification: 'NOT_DEMONSTRATED',
    compute_units_consumed: null, stack_heap_runtime_blockers: 'UNMEASURED; rustup stable toolchain repair stalled after a partial install, and no Solana/SBF binaries were present.' },
  safety: { deployed: false, transactions_sent: 0, transfers: 0, real_funds_used: false, hardware_signers_tested: false,
    parameter_set_note: 'ML-DSA-44 and ML-DSA-65 are parameter sets of ML-DSA, not independent cryptographic families.' }
};
write('benchmark.json', report);
write('evidence/approval-transaction-sizes.json', report.approval_transactions);
console.log(stringify(report));
