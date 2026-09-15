# PQC authorization / Transaction v1 — methodology v0

Experimental research; not custody software. No production code, RPC keys, funded keys, sends, airdrops, or deployments. Canonical encoding and byte counts are deterministic; randomly generated host keys/signatures and host timings are not. Base commit: `4e4a21d`. Date: 2026-09-15.

## Gates and ordering

Environment and read-only feature check → published sizes → byte model checked against SDK → real host verification → SBF toolchain gate → compute measurements only if executable → on-chain smart account only after that gate. A missing Rust/Solana toolchain is **TOOLCHAIN_BLOCKED**, not evidence that a Rust verifier cannot compile. No program or CPI demo will be claimed without executing one. The host policy reference is a test oracle only, not a smart account.

## Frozen size contract

- Signer A: ML-DSA-44; B: ML-DSA-65; C: SLH-DSA-SHA2-128s. ML-DSA-87 is a size-only negative control. A and B are different parameter sets of **one algorithm family**, not independent cryptographic families.
- Main arm stores registered public keys in wallet state; execution carries only selected signatures. Sensitivity arm additionally carries selected raw public keys. Registering all three does not mean carrying all three on every execution.
- One ordinary Ed25519 native fee-payer signature, five unique static accounts (fee payer, wallet, recipient, research program, System Program), one authorization instruction referencing wallet, recipient, System Program. No ALT. Distinct deterministic fixture addresses and inert lifetime token; these are not deployed accounts or a usable blockhash.
- Hypothetical action: System transfer of **1 test lamport**, encoded as discriminator u32 + lamports u64. No transfer is sent. Wallet and recipient are writable. Authorization program address is a fixture, not a deployment.
- v1 config explicitly requests 1,400,000 CU and 65,536 loaded-account-data bytes. These are benchmark configuration choices, **not measured requirements**. Heap omitted: default 32,768 bytes. Priority fee omitted: zero. Neither default proves execution viability.
- Legacy/v0 use the exact same authorization payload and equivalent explicit CU/data-size requests via two Compute Budget instructions. Also report bare-envelope lower bounds. v0 comparison uses no ALT, matching account scope; an ALT cannot rescue even the smallest 2,420-byte signature within 1,232 bytes.
- Outer instruction carries a length-prefixed shared intent once, count of selected signers, and fixed-width signer metadata plus length-prefixed signature for each selected slot. Canonical signatures bind wallet, 32-byte cluster domain, nonce, wallet policy revision, program, ordered account addresses/roles, action data, slot ID, scheme/version, slot generation, and public-key fingerprint. Pure signing uses an empty cryptographic context; the application domain tag is in the signed message. No prehash signature variant is substituted.
- Intent ordering is preserved, not sorted. Duplicate accounts/slots, unknown schemes, invalid integer bounds and non-32-byte addresses are rejected. Payload entries must be ascending by signer ID. A signature cannot be counted twice.
- Count complete serialized transactions, including the ordinary 64-byte signature and configuration. SDK byte encoding alone is not runtime validation. Oversized encoding may succeed; the harness separately rejects >4,096 (v1) or >1,232 (legacy/v0).

## Measurements and evidence

`OBSERVED`: host signatures/verification, SDK encoded byte lengths and round trips, read-only RPC responses. `DERIVED`: independent envelope formulas, remaining bytes, threshold feasibility. `UNKNOWN`: SBF compatibility, loaded account footprint, stack/heap demand, on-chain verification and CU. Host milliseconds are never converted to CU.

One keypair per scheme per benchmark run; one valid sign/verify plus altered message, altered signature and wrong-key verification. Timings describe this machine/run only. Persist public keys, messages and signatures, never private keys. The benchmark uses fixed input fields for size comparison, while each slot signs a distinct domain-bound message.

For 1/2/3-of-3, enumerate all exact-threshold subsets plus all seven nonempty carried subsets. `fits` means byte fit only; it is not wallet feasibility. Inline-key sizes exclude initialization rent and key-upload costs. Pre-staging signatures or proofs would be a different protocol and is not silently substituted.

## Sources

- [FIPS 204 Table 2, printed p16](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf): raw public-key/signature sizes.
- [FIPS 205 Table 2, printed p43](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf): SHA2-128s raw public key 32 bytes, signature 7,856 bytes.
- [Solana upgrade guide](https://solana.com/upgrades/larger-transaction-sizes): v1 configuration, no ALT, base64 and release guidance. The feature account is checked independently.
- [SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md): envelope layout. The SDK installed under this module is independently inspected and tested.
- [Node 24 crypto API](https://nodejs.org/docs/latest-v24.x/api/crypto.html): host OpenSSL-backed signatures, not an SBF library.
- [RustCrypto ml-dsa 0.1.1](https://docs.rs/ml-dsa/0.1.1/ml_dsa/), [RustCrypto no_std policy](https://github.com/RustCrypto/signatures), [fips205 0.4.1](https://docs.rs/fips205/0.4.1/fips205/): candidate Rust adapters, not compiled in this environment.

Original prompts' absolute 4,096-byte assumption applies to v1, not legacy/v0. A public documentation statement is not proof a particular installed SDK implements serialization. A precompile reduces verification work; by itself it does not shrink signatures.
