# PQC authorization fits differently from PQC multisig

Breadlines research v0 · 2026-09-15 · **HOST / SERIALIZATION STUDY, NOT AN ON-CHAIN WALLET**

## Finding

Under the declared one-instruction layout, **ML-DSA-44 fits at 2,928 bytes and ML-DSA-65 at 3,817 bytes** with their public keys already registered. Both exceed the old 1,232-byte envelope. Their smallest tested pair is **6,252 bytes**, so no tested 2-of-3 subset fits the 4,096-byte v1 envelope. A+B+C is 14,123 bytes.

This is not a compute bottleneck result. **Compute is unknown.** Real host verification worked for all three candidates, but Rust/SBF/local-validator tooling is absent. No claim about SBF compilation success, on-chain verification or CU is justified.

## Environment and v1 capability

Observed locally: Node **24.15.0**, OpenSSL **3.5.5**, Windows x64. `rustc`, `cargo`, `solana`, `agave-validator`, `solana-test-validator` and `cargo-build-sbf` returned command-not-found in the recorded probe. Conventional user Rust/Solana install paths were also checked without finding executables. This establishes an available-toolchain blocker, not a universal impossibility of building a verifier.

The free public RPC returned Solana core **4.3.0-rc.0**, finalized epoch **1035**, and the feature-owned `txv1` account containing active slot **447120000**. Its `getBlockTime` result was **2026-09-15T01:04:23Z**. Block time is a ledger estimate, not an exact activation wall clock. Four read-only calls were made at roughly 16:11 UTC; requests, results, account owner and base64 data are retained in [environment.json](environment.json). No simulation, airdrop, send or deploy was made. The initial capture parsed JSON rather than retaining raw HTTP text; the irrelevant u64 `rentEpoch` loses precision in JavaScript, while activation slot is decoded directly from the preserved account bytes as u64. The script now also retains raw response text on future explicit RPC runs.

`@solana/kit@8.3.0` **did serialize and round-trip v1** in this isolated install. `@solana/web3.js@1.99.0` decoded the same envelope but its v1 serialization threw `Serialization of version 1 transaction messages is not supported`. The earlier repository note dated September 12 reported no Kit serialization; that historical note is unchanged, but its broad present-tense conclusion must not be reused for this measured installation. Package lock integrity and executable tests anchor this result, rather than a version number alone.

The v1 envelope uses configuration mask 12: explicit 1,400,000 CU and 65,536 loaded-account-data bytes; no Compute Budget instruction or ALT. Base64 encoding round-trips. Resource settings are untested requests, **not measured requirements**. The benchmark generated and verified a normal Ed25519 fee-payer signature on each envelope, distinct from application-level PQ signatures.

## Standard parameter sizes

| Candidate | Algorithm family | Raw public key | Signature | Host result |
|---|---|---:|---:|---|
| A: ML-DSA-44 | ML-DSA | 1,312 | 2,420 | Real verification passed |
| B: ML-DSA-65 | ML-DSA | 1,952 | 3,309 | Real verification passed |
| C: SLH-DSA-SHA2-128s | SLH-DSA | 32 | 7,856 | Real verification passed |
| ML-DSA-87 control | ML-DSA | 2,592 | 4,627 | Size-only; not exercised |

Sizes: [FIPS 204 Table 2](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf), [FIPS 205 Table 2](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf). Observed host SPKI encodings were 1,334 / 1,974 / 50 bytes; **SPKI is not the raw key format** used for the size sensitivity arm. Raw standard key lengths and measured DER lengths are kept separate.

A and B are **not independently designed schemes**: they are ML-DSA parameter sets. This minimum candidate set therefore represents only two cryptographic families, not the proposed three-family hedge.

## Full serialization matrix

Keys pre-registered, one ordinary native signer, shared 208-byte intent plus 45-byte signer-specific signed suffix. Each signer signs 253 bytes. The suffix binds signer ID, scheme, version, generation and key fingerprint. The transaction carries the intent once, 15 metadata/length bytes per selected signature, and the signatures themselves. The key fingerprint is reconstructed from registered state, not redundantly carried. v1 fixed overhead is 281 bytes. Full methodology: [methodology.md](methodology.md).

| Scheme / combination | Signature bytes | Serialized v1 tx bytes | Remaining | Fits 1232 | Fits 4096 | On-chain verify | CU | Result |
|---|---:|---:|---:|---|---|---|---|---|
| A | 2,420 | 2,928 | 1,168 | No | Yes | Not run | null | HOST_ONLY; TOOLCHAIN_BLOCKED |
| B | 3,309 | 3,817 | 279 | No | Yes | Not run | null | HOST_ONLY; TOOLCHAIN_BLOCKED |
| C | 7,856 | 8,364 | −4,268 | No | No | Not run | null | SIZE_BLOCKED |
| A+B | 5,729 | 6,252 | −2,156 | No | No | Not run | null | SIZE_BLOCKED |
| A+C | 10,276 | 10,799 | −6,703 | No | No | Not run | null | SIZE_BLOCKED |
| B+C | 11,165 | 11,688 | −7,592 | No | No | Not run | null | SIZE_BLOCKED |
| A+B+C | 13,585 | 14,123 | −10,027 | No | No | Not run | null | SIZE_BLOCKED |

The SDK can encode oversized bytes. That **does not** mean runtime acceptance: the separate envelope validator rejects oversize payloads, and 4,096/4,097 boundaries are tested. These transactions have an inert lifetime token and undeployed program, and have never executed.

Configured legacy/v0 sizes are respectively 2,964/2,966 for A and 3,853/3,855 for B. The same payload is used; each has two explicit resource-setting instructions. Even bare legacy envelopes are 2,916 and 3,805 bytes. See [size-table.md](size-table.md) for every comparison.

## Registered keys vs carried keys; threshold policies

The three raw registered keys total **3,296 bytes**, before wallet metadata. Registering three slots is not the same as placing three signatures into one transaction.

If selected raw keys are carried inline in this particular layout, A becomes **4,240 bytes**, B **5,769**, C **8,396**. All fail the v1 cap. This inline arm measures fixed-length placeholder keys only; it is not a verified key-registration protocol. A's inline failure is **layout-specific**—a more compact intent can save bytes—whereas any tested pair's signatures alone exceed the cap.

- **1-of-3:** A-only and B-only fit; C-only does not. Not every eligible signer can independently execute inline under this policy.
- **2-of-3:** no exact-threshold subset fits. Even two ML-DSA-44 signatures would already be 4,840 bytes before transaction overhead.
- **3-of-3:** does not fit.

The host policy oracle accepts valid distinct signers and rejects replay, wrong slots/schemes, disabled slots, malformed signatures, altered actions and stale rotations. This demonstrates logic with real host verification, **not atomic Solana execution**. It does not authorize or implement wallet-management operations.

## Verification and compute

All three real host adapters accepted valid signatures and rejected modified messages, modified signatures and wrong public keys. Saved public artifacts can be re-verified without private keys. One observed host verification call per scheme took approximately 0.880 / 0.969 / 1.735 ms respectively. These are single-run host observations, include adapter overhead, and are **not CU estimates or a throughput benchmark**.

Candidate Rust libraries were identified: **RustCrypto `ml-dsa` 0.1.1** and **`fips205` 0.4.1**, both Apache-2.0 OR MIT. They document no_std support; fips205 additionally documents no heap allocation. RustCrypto explicitly warns that its implementation has not been independently audited. No Rust code was copied or replaced with a fake verifier. Their SBF compilation, stack/heap behavior and execution cost remain **UNKNOWN**. See [verifier-candidates.json](verifier-candidates.json).

**On-chain verification: none demonstrated. CU: null for every scheme.** No verifier reached `REAL_ONCHAIN_VERIFY`; none is labeled `COMPUTE_BLOCKED`, because compute exhaustion was never observed. The blocker is the missing available toolchain, not an observed library compile failure. No `program/` was built; wallet initialization, signer management, authorized transfer and on-chain rotation are deferred rather than represented by mocks.

## What Transaction v1 solved

For this payload, the larger envelope admits one inline ML-DSA authorization that legacy/v0 cannot carry. Actual SDK serialization and native host signing work. Configuration is explicit and verified by decoding the encoded message.

## What Transaction v1 did not solve

It did not compress signatures, create a verifier, supply an SBF toolchain, demonstrate affordable CU, establish initialization/key-upload feasibility, or provide three independent algorithm families. It does not establish any improvement in scheduling, inclusion probability, contention, priority, finality or wallet security.

## What is currently impossible / unknown

**Impossible within the literal tested inline construction:** SLH-DSA-SHA2-128s alone, any pair from A/B/C, or all three, regardless of how fast verification becomes. This is a byte-count impossibility, not a universal statement about all PQ schemes or all smart-wallet constructions.

**Unknown:** practical SBF verification cost for a fitting ML-DSA authorization; verifier runtime compatibility; how many verifications fit a compute budget; program account loading and memory needs; deployed threshold/rotation security.

## What requires native/precompile/runtime support

A verifier precompile could reduce verification cost, but an **inline-only precompile would not make the oversized signatures fit**. A minimally plausible different construction is registered keys plus application-owned, nonce/domain/policy-bound authorization buffers populated before execution. A native/runtime verifier that can read those account buffers could check the selected signatures during one final atomic action. That requires authenticated immutable inputs, offsets/length checks, expiry, replay protection and measured CU. It is a proposed architecture, not a built or proven capability.

Alternatively, prepare verified per-signer approvals in separate transactions, then atomically consume approvals and execute once. That changes the temporal/security model: the authorization process is no longer a single transaction, even though the final action can be atomic. A software verifier might suffice if SBF benchmarks show it works; a precompile is not proven necessary. Compact proof aggregation is another research direction, not a free compression trick or an assumed quantum-safe substitute.

## What a real production PQC wallet would still need

- Authenticated initialization and signer-key registration; current threshold authorization of every add/disable/rotation; safe threshold changes and recovery.
- Program/PDA ownership, CPI privilege restrictions, reentrancy protections, canonical account ordering and complete action binding; atomic nonce/state updates on successful execution.
- Audited cryptography, standard test vectors, independent cross-implementation tests, entropy/side-channel review, stack/heap limits and denial-of-service budgeting.
- Explicit threat model for scheme diversity and compromise. A 1-of-3 policy is not a hedge that requires multiple independent breaks.
- Audit of upgrade/admin authority, key migration and recovery so classical credentials cannot bypass PQ authorization. Normal Ed25519 fee payment and Solana's existing consensus remain in place; this is not an end-to-end post-quantum-secure chain claim.
- Real SBF/local-validator tests, then explicitly authorized devnet tests, covering malformed inputs and hostile account state. No mainnet experiment is needed for this research gate.

## Validation and scope

**19/19 tests passed** on the recorded machine. Tests independently re-verify public host signatures, compare SDK sizes with formulas, test configuration/layout, all subsets and exact bounds, and exercise the host-only replay/threshold/rotation oracle. No frontend or production build is involved; only an isolated `.mjs` research package and lockfile were added. No production files changed, no funds used, no branch merged.

## Public-safe finding

> In our offline, SDK-serialized test layout, Solana v1 fits one ML-DSA-44 authorization at 2,928 bytes or ML-DSA-65 at 3,817 bytes with registered keys. But the smallest tested pair is 6,252 bytes. The first blocker for this inline heterogeneous multisig is bytes; on-chain verification cost is still unmeasured.

Do not turn this into “PQC wallets work on Solana,” “three independent schemes tested,” or “v1 moved the bottleneck to compute.” We have not established any of those.
