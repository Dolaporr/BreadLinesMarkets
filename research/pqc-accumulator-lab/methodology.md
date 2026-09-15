# Methodology

## Scope and evidence labels

This is a synthetic offline experiment. It uses Node 24.15.0/OpenSSL 3.5.5 to generate ML-DSA keys and create/verify real ML-DSA-44 and ML-DSA-65 signatures. It uses `@solana/kit@8.3.0` to serialize Transaction v1 bytes and round-trip decode them. Inert addresses and blockhashes make these unsuitable for submission. No transaction was sent or simulated.

`HOST_CRYPTO` means Node/OpenSSL accepted the signature. `SERIALIZED_V1` means Kit encoded and decoded the transaction. Neither label means SBF execution, local-validator execution, or public-network acceptance.

## Canonical action and signature binding

The canonical action comes from the prior lab's `BL-PQC-AUTH-v1` encoding. It commits to wallet address, cluster/domain, nonce, policy revision, destination through ordered account metas, amount/instruction data, invoked program, every relevant account's address and role, and instruction data. Its SHA-256 hash becomes the action identifier.

Each approval signs this fixed, reconstructable message:

```text
BL-PQC-ACCUMULATOR-v1 || wallet || domain || nonce || policyRevision ||
SHA-256(canonicalAction) || signerSlot || scheme || schemeVersion || generation || keyFingerprint
```

The program model verifies a submitted signature against that message and its registered key, then records only a signer bit. `execute_once` recomputes the canonical-action hash from the supplied execution action, compares it with `PendingAction.actionHash`, checks the nonce and policy revision, requires the threshold, advances the wallet nonce, and marks the pending action executed. This treats SHA-256 collision resistance as part of the binding assumption.

## Serialized approval layout

The measured `submit_approval` instruction has: tag (1), protocol version (2), scheme (2), signer slot (1), nonce (8), wallet (32), action hash (32), signature length (2), and signature. It is carried in an actual Kit v1 transaction with one native Ed25519 fee payer signature; program, wallet PDA and pending-action PDA are the static accounts. V1 resource configuration is explicit: 1,400,000 CU and 65,536 loaded-account-data bytes (mask 12). Those settings request limits; they do not measure required compute.

`PendingAction` is 91 bytes: 8-byte discriminator, wallet, action hash, nonce, policy revision, bitmap, executed flag and bump. It intentionally does not retain PQ signatures after they verify. The 44/65/44 registered-key wallet layout is 4,755 bytes under the documented fixed layout; this is state-size evidence, not rent or account-creation evidence.

## SBF attempt and hard boundary

At start, `rustc`, `cargo`, `solana`, `agave-validator`, `solana-test-validator`, and `cargo-build-sbf` were absent. Rustup was installed and its stable toolchain repair was attempted. The installer first produced a partial toolchain; direct repair remained stalled and `rustc --version` reported `missing manifest in toolchain stable-x86_64-pc-windows-msvc`. The process was stopped after this was confirmed. No Solana/SBF executable was installed or found.

Therefore no SBF verifier source was compiled, no local validator started, and no real on-chain verifier/CU/stack/heap result exists. The RustCrypto `ml-dsa` crate documents `no_std` and `VerifyingKey` verification APIs, so it is a real candidate, not a claimed successful SBF verifier. Its SBF compatibility still needs a working Solana toolchain and a local-validator measurement.

## Comparison discipline

The adjacent PR #4 research measured a 6,252-byte v1 transaction for an inline ML-DSA-44 + ML-DSA-65 pair. This lab compares that exact inline result with individual approval transactions. It does not claim three independent cryptographic families: ML-DSA-44 and ML-DSA-65 are parameter sets of ML-DSA, and no hardware signer was tested.

Sources: [FIPS 204](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf), [RustCrypto ml-dsa API](https://docs.rs/ml-dsa/0.1.1/ml_dsa/), and [Solana program build documentation](https://solana.com/docs/programs/deploying).
