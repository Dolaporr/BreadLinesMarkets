# Serialized envelope measurements

Keys pre-registered; signatures inline. All are synthetic offline transactions, with real host PQ signatures and a host-verified Ed25519 fee-payer signature. None submitted.

| Scheme / subset | Signature bytes | v1 tx bytes | Legacy tx bytes | v0 tx bytes | Fits 1232 | Fits 4096 | On-chain verify | CU | Result |
|---|---:|---:|---:|---:|---|---|---|---|---|
| A: ML-DSA-44 | 2420 | 2928 | 2964 | 2966 | no | yes | not run | null | HOST_ONLY_ONCHAIN_TOOLCHAIN_BLOCKED |
| B: ML-DSA-65 | 3309 | 3817 | 3853 | 3855 | no | yes | not run | null | HOST_ONLY_ONCHAIN_TOOLCHAIN_BLOCKED |
| A+B: ML-DSA-44 + ML-DSA-65 | 5729 | 6252 | 6288 | 6290 | no | no | not run | null | SIZE_BLOCKED |
| C: SLH-DSA-SHA2-128s | 7856 | 8364 | 8400 | 8402 | no | no | not run | null | SIZE_BLOCKED |
| A+C: ML-DSA-44 + SLH-DSA-SHA2-128s | 10276 | 10799 | 10835 | 10837 | no | no | not run | null | SIZE_BLOCKED |
| B+C: ML-DSA-65 + SLH-DSA-SHA2-128s | 11165 | 11688 | 11724 | 11726 | no | no | not run | null | SIZE_BLOCKED |
| A+B+C: ML-DSA-44 + ML-DSA-65 + SLH-DSA-SHA2-128s | 13585 | 14123 | 14159 | 14161 | no | no | not run | null | SIZE_BLOCKED |
