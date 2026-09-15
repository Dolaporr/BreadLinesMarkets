# Results: accumulator vs. inline PQ multisig

## Answer

1. **Yes, for the tested 2-of-3 flow, separate approvals eliminate the multi-signature transaction byte blocker.** PR #4 measured an inline ML-DSA-44 + ML-DSA-65 pair at 6,252 bytes, above the 4,096-byte v1 cap. This lab measured individual approval transactions at **2,748 bytes** for ML-DSA-44 and **3,637 bytes** for ML-DSA-65. Both Kit-serialized, round-tripped, and fit the v1 limit.

2. **No real PQ verifier has been demonstrated on Solana/SBF.** Real ML-DSA host signatures verified before the approval bit was recorded. SBF compile status is `NOT_RUN_RUST_TOOLCHAIN_INCOMPLETE`; no Solana CLI or local validator was present.

3. **CU is unknown (`null`).** No simulation or execution occurred. The v1 transactions request 1,400,000 CU, which is not a consumption measurement.

4. **The state accumulator is byte-practical in this model.** `PendingAction` is 91 bytes and retains a bitmap rather than PQ signatures. The wallet layout with registered ML-DSA-44/65/44 keys is 4,755 bytes. That says nothing yet about rent, initialization transaction size, verifier compute, contention, or denial-of-service behavior.

5. **Yes in the host model.** A valid A then B approval raises the bitmap from `001` to `011`; `execute_once` succeeds, sets `executed=true`, advances nonce 0 to 1, then rejects any later approval or execution. This is tested host state-machine behavior, not atomic on-chain execution evidence.

6. **The dominant blocker changes from transport bytes to actual verifier/runtime feasibility.** Bytes are no longer the first blocker for these individual approvals. The next gate is an SBF-compatible, audited ML-DSA verifier that fits real Solana compute, stack, heap, account-loading, and transaction scheduling limits. No measured CU exists, so neither feasibility nor failure may be claimed.

7. **Strongest public-safe finding:**

> In an offline Kit-serialized model, splitting ML-DSA-44 and ML-DSA-65 approvals into separate v1 transactions reduced the measured per-approval envelopes to 2,748 and 3,637 bytes, where the same inline pair was 6,252 bytes. A compact 91-byte approval bitmap can gate an exactly-once host execution. This removes the tested multi-signature byte bottleneck, but on-chain ML-DSA verification and compute are still unmeasured.

## Measurements

| Item | ML-DSA-44 | ML-DSA-65 |
|---|---:|---:|
| Signature bytes | 2,420 | 3,309 |
| Approval instruction bytes | 2,500 | 3,389 |
| Serialized v1 approval transaction | 2,748 | 3,637 |
| Fits v1 4,096-byte cap | yes | yes |
| Real host verification | yes | yes |
| SBF verification | not run | not run |
| CU consumed | null | null |

The serialized transaction includes an actual native fee-payer signature verified on the host and v1 config mask 12. It has inert lifetime/address fixtures and was never submitted.

## Rejections tested

The test suite rejects different action, destination, and amount; wrong nonce; duplicate approval; inactive signer; unknown or wrong signer slot; wrong scheme/version; malformed signature; execution below threshold; a post-execution replay; and a second execution.

## Limits

No frontend, deployment, public-network submission, real funds, local validator, SBF compilation, hardware signer, or independent scheme-family test occurred. ML-DSA-44 and ML-DSA-65 are one family with different parameter sets. See [benchmark.json](benchmark.json) for generated machine evidence and [methodology.md](methodology.md) for the toolchain boundary.
