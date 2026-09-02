# Solana 350ms → 300ms ledger-side execution study

Boundary: epoch 1024 / slot 442,368,000 / 2026-08-28T15:25:03.000Z.

This is a fixed stratified sample of landed blocks, not a network census. Vote-only transactions are deterministically excluded from the sampled transaction population.

| Metric | 60m before | 60m after |
| --- | ---: | ---: |
| Sampled blocks | 60 | 60 |
| Sampled non-vote transactions | 65,459 | 58,701 |
| Success rate | 53.09% | 53.31% |
| Failure rate | 46.91% | 46.69% |
| Failed CU share | 38.85% | 37.46% |
| Median non-vote CUs/tx | 11,726 | 7,487 |
| Median non-vote tx/block | 1,060 | 880 |
| Median all-landed CU utilization | 59.43% | 56.24% |

See analysis.json for bucket data, distributions, availability, and limits.
