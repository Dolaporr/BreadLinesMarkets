# Pre-registered stability classification

This file is generated only after the 6-hour unbuffered and buffered evidence is complete. A metric must have the same non-zero direction across all four comparisons **and**, in each comparison, its absolute raw before/after change must exceed the greater within-side six-bucket range. It applies the fixed criteria in [stability-preregistration.md](stability-preregistration.md).

| Metric | 1h | 3h | 6h | 6h buffered | Direction | Bucket variation | Classification |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Success rate | 0.22 pp | -1.86 pp | -7.69 pp | -10.65 pp | fail | fail | UNSTABLE_NOISY |
| Failure rate | -0.22 pp | 1.86 pp | 7.69 pp | 10.65 pp | fail | fail | UNSTABLE_NOISY |
| Failed-CU share | -1.39 pp | -3.18 pp | 3.96 pp | 3.66 pp | fail | fail | UNSTABLE_NOISY |
| Median CU per transaction | -36.15% | -37.46% | -27.93% | -59.60% | pass | fail | UNSTABLE_NOISY |
| P90 CU per transaction | 3.49% | -3.84% | -5.66% | -10.21% | fail | fail | UNSTABLE_NOISY |
| P95 CU per transaction | 1.81% | -2.28% | -2.75% | -6.22% | fail | fail | UNSTABLE_NOISY |
| Median cost units per transaction | -20.41% | -17.90% | -27.27% | -41.77% | pass | fail | UNSTABLE_NOISY |
| P90 cost units per transaction | 2.90% | -3.39% | -4.91% | -9.48% | fail | fail | UNSTABLE_NOISY |
| P95 cost units per transaction | 1.56% | -2.32% | -2.14% | -5.69% | fail | fail | UNSTABLE_NOISY |
| Median reconstructed priority fee | -30.41% | -12.43% | -2.22% | -1.43% | fail | fail | UNSTABLE_NOISY |
| Median non-vote transactions per block | -16.98% | -7.53% | 22.88% | 35.49% | fail | fail | UNSTABLE_NOISY |
| Median non-vote CU per block | -19.50% | -8.94% | -0.58% | 7.48% | fail | fail | UNSTABLE_NOISY |
| Median all-landed CU utilization | -5.37% | 6.11% | 16.29% | 25.52% | fail | fail | UNSTABLE_NOISY |

Fee totals are never eligible for a stable-signal label. A deterministic transaction-fee enrichment of the same selected blocks supplies the separate top-1% trimming sensitivity check.
