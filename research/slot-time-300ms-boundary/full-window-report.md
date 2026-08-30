# Solana 350ms → 300ms: full sampled-ledger window report

## Boundary and sample contract

- Boundary: epoch 1024, slot 442,368,000, `2026-08-28T15:25:03.000Z`.
- Both adjacent boundary slots resolve to the same estimated block-time second; the ledger does not resolve a finer instant from that pair.
- Population: landed transactions in deterministically selected full blocks. Vote-only transactions are excluded only when every outer instruction is Vote or Compute Budget and at least one is Vote.
- The unbuffered comparisons are wall-clock windows meeting at the epoch boundary. Independent deterministic sampling leaves an observed coverage gap between the closest selected blocks; it is not treated as a zero-width buffer.
- Buffered 6h comparison: fixed 10-minute exclusion on each side of the boundary before selection.
- 12h: deferred, not collected.
- Capacity denominator: 87.5M cost units before and 75M after. The sampled per-block maxima independently approached these ceilings without exceeding them; this supports those denominators but is not a causal before/after result.
- Every count is a sampled-ledger quantity, not a network total.

## Unbuffered 1-hour window

| Sampled-ledger metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Sampled blocks | 60 | 60 | 0.00% |
| Sampled landed non-vote transactions | 65,459 | 58,701 | -10.32% |
| Landed successes | 34,749 | 31,291 | -9.95% |
| Success rate | 53.09% | 53.31% | 0.22 pp |
| Landed failures | 30,710 | 27,410 | -10.75% |
| Failure rate | 46.91% | 46.69% | -0.22 pp |
| Total CU consumed | 2,969,720,866 | 2,552,090,044 | -14.06% |
| Successful CU consumed | 1,815,975,543 | 1,596,071,725 | -12.11% |
| Failed CU consumed | 1,153,745,323 | 956,018,319 | -17.14% |
| Failed-CU share | 38.85% | 37.46% | -1.39 pp |
| CU/tx median | 11,726 | 7,487 | -36.15% |
| CU/tx P90 | 123,071 | 127,368 | 3.49% |
| CU/tx P95 | 165,795 | 168,804 | 1.81% |
| Cost units/tx median | 17,768 | 14,142 | -20.41% |
| Cost units/tx P90 | 131,798 | 135,617 | 2.90% |
| Cost units/tx P95 | 174,014 | 176,725 | 1.56% |
| Cost-unit availability | 100.00% | 100.00% | 0.00 pp |
| Total fees (lamports) | 6,883,036,598 | 2,518,012,379 | -63.42% |
| Success fees (lamports) | 4,586,032,438 | 1,874,003,465 | -59.14% |
| Failure fees (lamports) | 2,297,004,160 | 644,008,914 | -71.96% |
| Reconstructed priority-fee median (lamports) | 1,437 | 1,000 | -30.41% |
| Reconstructed priority-fee P90 (lamports) | 38,875 | 38,940 | 0.17% |
| Reconstructed priority-fee P95 (lamports) | 90,000 | 92,282 | 2.54% |
| Priority-fee reconstruction coverage | 78.11% | 76.86% | -1.25 pp |
| Median non-vote tx/block | 1,060 | 880 | -16.98% |
| Median non-vote CU/block | 50,634,891 | 40,758,771 | -19.50% |
| Median all-landed CU utilization | 59.43% | 56.24% | -3.19 pp |
| Applicable block CU limit | 87,500,000 | 75,000,000 | -14.29% |

## Unbuffered 3-hour window

| Sampled-ledger metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Sampled blocks | 180 | 180 | 0.00% |
| Sampled landed non-vote transactions | 177,414 | 167,503 | -5.59% |
| Landed successes | 100,377 | 91,660 | -8.68% |
| Success rate | 56.58% | 54.72% | -1.86 pp |
| Landed failures | 77,037 | 75,843 | -1.55% |
| Failure rate | 43.42% | 45.28% | 1.86 pp |
| Total CU consumed | 8,127,198,832 | 7,422,589,958 | -8.67% |
| Successful CU consumed | 5,052,548,579 | 4,850,206,192 | -4.00% |
| Failed CU consumed | 3,074,650,253 | 2,572,383,766 | -16.34% |
| Failed-CU share | 37.83% | 34.66% | -3.18 pp |
| CU/tx median | 12,368 | 7,735 | -37.46% |
| CU/tx P90 | 126,350 | 121,502 | -3.84% |
| CU/tx P95 | 167,380 | 163,561 | -2.28% |
| Cost units/tx median | 18,398 | 15,104 | -17.90% |
| Cost units/tx P90 | 134,995 | 130,412 | -3.39% |
| Cost units/tx P95 | 175,743 | 171,672 | -2.32% |
| Cost-unit availability | 100.00% | 100.00% | 0.00 pp |
| Total fees (lamports) | 6,669,427,910 | 7,352,368,306 | 10.24% |
| Success fees (lamports) | 4,243,878,524 | 4,764,570,489 | 12.27% |
| Failure fees (lamports) | 2,425,549,386 | 2,587,797,817 | 6.69% |
| Reconstructed priority-fee median (lamports) | 1,142 | 1,000 | -12.43% |
| Reconstructed priority-fee P90 (lamports) | 37,934 | 42,474 | 11.97% |
| Reconstructed priority-fee P95 (lamports) | 98,430 | 100,000 | 1.60% |
| Priority-fee reconstruction coverage | 76.48% | 77.29% | 0.81 pp |
| Median non-vote tx/block | 969 | 896 | -7.53% |
| Median non-vote CU/block | 41,977,477 | 38,223,347 | -8.94% |
| Median all-landed CU utilization | 49.84% | 52.89% | 3.05 pp |
| Applicable block CU limit | 87,500,000 | 75,000,000 | -14.29% |

## Unbuffered 6-hour window

| Sampled-ledger metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Sampled blocks | 120 | 120 | 0.00% |
| Sampled landed non-vote transactions | 97,002 | 104,425 | 7.65% |
| Landed successes | 59,951 | 56,512 | -5.74% |
| Success rate | 61.80% | 54.12% | -7.69 pp |
| Landed failures | 37,051 | 47,913 | 29.32% |
| Failure rate | 38.20% | 45.88% | 7.69 pp |
| Total CU consumed | 4,727,659,038 | 4,758,015,429 | 0.64% |
| Successful CU consumed | 3,206,753,935 | 3,038,928,733 | -5.23% |
| Failed CU consumed | 1,520,905,103 | 1,719,086,696 | 13.03% |
| Failed-CU share | 32.17% | 36.13% | 3.96 pp |
| CU/tx median | 18,288 | 13,180 | -27.93% |
| CU/tx P90 | 129,243 | 121,928 | -5.66% |
| CU/tx P95 | 167,562 | 162,956 | -2.75% |
| Cost units/tx median | 25,182 | 18,314 | -27.27% |
| Cost units/tx P90 | 138,280 | 131,485 | -4.91% |
| Cost units/tx P95 | 175,173 | 171,429 | -2.14% |
| Cost-unit availability | 100.00% | 100.00% | 0.00 pp |
| Total fees (lamports) | 3,004,320,277 | 4,116,877,716 | 37.03% |
| Success fees (lamports) | 1,938,116,105 | 2,492,583,737 | 28.61% |
| Failure fees (lamports) | 1,066,204,172 | 1,624,293,979 | 52.34% |
| Reconstructed priority-fee median (lamports) | 1,037 | 1,014 | -2.22% |
| Reconstructed priority-fee P90 (lamports) | 30,000 | 44,007 | 46.69% |
| Reconstructed priority-fee P95 (lamports) | 82,822 | 100,000 | 20.74% |
| Priority-fee reconstruction coverage | 73.41% | 77.54% | 4.13 pp |
| Median non-vote tx/block | 695 | 854 | 22.88% |
| Median non-vote CU/block | 35,883,257 | 35,673,482 | -0.58% |
| Median all-landed CU utilization | 42.63% | 49.57% | 6.95 pp |
| Applicable block CU limit | 87,500,000 | 75,000,000 | -14.29% |

## Buffered 6-hour window

| Sampled-ledger metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Sampled blocks | 120 | 120 | 0.00% |
| Sampled landed non-vote transactions | 91,673 | 107,514 | 17.28% |
| Landed successes | 58,063 | 56,647 | -2.44% |
| Success rate | 63.34% | 52.69% | -10.65 pp |
| Landed failures | 33,610 | 50,867 | 51.34% |
| Failure rate | 36.66% | 47.31% | 10.65 pp |
| Total CU consumed | 4,527,567,872 | 4,618,906,175 | 2.02% |
| Successful CU consumed | 3,152,763,791 | 3,047,090,662 | -3.35% |
| Failed CU consumed | 1,374,804,081 | 1,571,815,513 | 14.33% |
| Failed-CU share | 30.37% | 34.03% | 3.66 pp |
| CU/tx median | 19,146 | 7,735 | -59.60% |
| CU/tx P90 | 129,990 | 116,713 | -10.21% |
| CU/tx P95 | 170,487 | 159,890 | -6.22% |
| Cost units/tx median | 25,788 | 15,016 | -41.77% |
| Cost units/tx P90 | 140,316 | 127,014 | -9.48% |
| Cost units/tx P95 | 178,412 | 168,256 | -5.69% |
| Cost-unit availability | 100.00% | 100.00% | 0.00 pp |
| Total fees (lamports) | 2,672,519,330 | 4,377,354,529 | 63.79% |
| Success fees (lamports) | 1,961,253,395 | 3,137,853,680 | 59.99% |
| Failure fees (lamports) | 711,265,935 | 1,239,500,849 | 74.27% |
| Reconstructed priority-fee median (lamports) | 1,052 | 1,037 | -1.43% |
| Reconstructed priority-fee P90 (lamports) | 36,943 | 44,195 | 19.63% |
| Reconstructed priority-fee P95 (lamports) | 100,000 | 100,000 | 0.00% |
| Priority-fee reconstruction coverage | 72.13% | 78.37% | 6.24 pp |
| Median non-vote tx/block | 648 | 878 | 35.49% |
| Median non-vote CU/block | 34,404,209 | 36,979,146 | 7.48% |
| Median all-landed CU utilization | 40.96% | 51.41% | 10.45 pp |
| Applicable block CU limit | 87,500,000 | 75,000,000 | -14.29% |

## Unbuffered 1-hour chronological buckets

### Before

| Bucket | Sampled blocks | Non-vote tx | Success rate | Failure rate | Failed-CU share | Median CU/tx | Median cost units/tx | Median priority fee | Median tx/block | Median CU/block | All-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 10 | 10,839 | 54.31% | 45.69% | 34.35% | 7,735 | 15,269 | 758 | 1,122 | 43,109,247 | 50.90% |
| 2 | 10 | 13,134 | 50.53% | 49.47% | 36.32% | 7,487 | 14,142 | 1,037 | 1,248 | 52,022,928 | 61.09% |
| 3 | 10 | 10,404 | 50.80% | 49.20% | 44.41% | 11,017 | 15,582 | 1,617 | 1,104 | 38,456,752 | 45.60% |
| 4 | 10 | 9,939 | 54.06% | 45.94% | 36.04% | 15,138 | 22,863 | 2,155 | 990 | 48,108,037 | 56.81% |
| 5 | 10 | 9,429 | 61.86% | 38.14% | 29.03% | 21,817 | 31,464 | 1,201 | 952 | 43,699,474 | 51.63% |
| 6 | 10 | 11,714 | 48.96% | 51.04% | 50.06% | 19,240 | 25,293 | 2,130 | 997 | 56,397,005 | 65.97% |

### After

| Bucket | Sampled blocks | Non-vote tx | Success rate | Failure rate | Failed-CU share | Median CU/tx | Median cost units/tx | Median priority fee | Median tx/block | Median CU/block | All-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 10 | 8,267 | 51.81% | 48.19% | 39.38% | 7,919 | 15,269 | 989 | 703 | 35,673,585 | 49.49% |
| 2 | 10 | 11,040 | 52.07% | 47.93% | 37.98% | 7,501 | 14,734 | 671 | 1,004 | 42,422,456 | 58.48% |
| 3 | 10 | 9,571 | 52.34% | 47.66% | 32.92% | 5,623 | 12,553 | 1,000 | 829 | 35,412,101 | 49.10% |
| 4 | 10 | 9,204 | 59.28% | 40.72% | 34.54% | 7,735 | 15,269 | 900 | 789 | 34,413,691 | 47.78% |
| 5 | 10 | 10,047 | 51.76% | 48.24% | 41.76% | 7,170 | 13,907 | 1,037 | 880 | 37,074,836 | 51.33% |
| 6 | 10 | 10,572 | 52.91% | 47.09% | 37.32% | 7,487 | 14,523 | 1,457 | 989 | 45,592,950 | 62.71% |

## Unbuffered 3-hour chronological buckets

### Before

| Bucket | Sampled blocks | Non-vote tx | Success rate | Failure rate | Failed-CU share | Median CU/tx | Median cost units/tx | Median priority fee | Median tx/block | Median CU/block | All-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 30 | 22,210 | 64.97% | 35.03% | 34.44% | 24,010 | 35,175 | 1,623 | 642 | 34,777,645 | 41.40% |
| 2 | 30 | 18,884 | 63.93% | 36.07% | 27.47% | 13,180 | 19,164 | 900 | 589 | 30,014,435 | 36.35% |
| 3 | 30 | 27,996 | 57.46% | 42.54% | 35.16% | 8,459 | 15,269 | 808 | 969 | 39,186,922 | 46.41% |
| 4 | 30 | 39,213 | 54.56% | 45.44% | 41.01% | 7,610 | 14,735 | 1,418 | 1,301 | 57,512,293 | 67.27% |
| 5 | 30 | 36,258 | 50.91% | 49.09% | 41.21% | 8,743 | 15,270 | 1,169 | 1,134 | 50,579,454 | 59.46% |
| 6 | 30 | 32,853 | 54.59% | 45.41% | 41.68% | 19,781 | 27,080 | 1,378 | 1,052 | 51,495,435 | 60.49% |

### After

| Bucket | Sampled blocks | Non-vote tx | Success rate | Failure rate | Failed-CU share | Median CU/tx | Median cost units/tx | Median priority fee | Median tx/block | Median CU/block | All-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 30 | 26,237 | 56.04% | 43.96% | 32.32% | 7,734 | 14,842 | 837 | 791 | 33,889,509 | 47.10% |
| 2 | 30 | 30,246 | 53.67% | 46.33% | 38.89% | 6,688 | 13,263 | 1,072 | 1,032 | 43,427,944 | 59.86% |
| 3 | 30 | 30,502 | 50.89% | 49.11% | 39.44% | 7,487 | 14,142 | 846 | 1,041 | 42,075,068 | 57.62% |
| 4 | 30 | 27,253 | 55.56% | 44.44% | 30.93% | 13,180 | 16,624 | 814 | 932 | 38,243,499 | 52.90% |
| 5 | 30 | 26,060 | 55.87% | 44.13% | 33.28% | 15,895 | 23,376 | 1,087 | 790 | 37,829,214 | 52.44% |
| 6 | 30 | 27,205 | 56.97% | 43.03% | 32.47% | 18,082 | 26,000 | 1,500 | 826 | 39,406,118 | 54.50% |

## Unbuffered 6-hour chronological buckets

### Before

| Bucket | Sampled blocks | Non-vote tx | Success rate | Failure rate | Failed-CU share | Median CU/tx | Median cost units/tx | Median priority fee | Median tx/block | Median CU/block | All-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 20 | 10,222 | 74.83% | 25.17% | 23.17% | 25,966 | 36,153 | 1,037 | 496 | 28,269,067 | 33.93% |
| 2 | 20 | 11,267 | 75.76% | 24.24% | 21.79% | 32,123 | 43,528 | 1,105 | 452 | 26,225,427 | 31.60% |
| 3 | 20 | 13,367 | 65.53% | 34.47% | 33.41% | 21,809 | 30,753 | 1,514 | 627 | 32,483,681 | 38.77% |
| 4 | 20 | 14,119 | 64.93% | 35.07% | 28.36% | 19,724 | 27,567 | 1,149 | 676 | 32,707,380 | 39.02% |
| 5 | 20 | 24,999 | 52.51% | 47.49% | 40.70% | 7,736 | 15,269 | 900 | 1,244 | 54,998,277 | 64.49% |
| 6 | 20 | 23,028 | 55.20% | 44.80% | 36.47% | 11,624 | 16,629 | 973 | 1,139 | 49,298,659 | 58.01% |

### After

| Bucket | Sampled blocks | Non-vote tx | Success rate | Failure rate | Failed-CU share | Median CU/tx | Median cost units/tx | Median priority fee | Median tx/block | Median CU/block | All-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 20 | 19,282 | 53.81% | 46.19% | 43.85% | 10,369 | 15,582 | 1,000 | 914 | 49,095,564 | 67.38% |
| 2 | 20 | 20,788 | 52.76% | 47.24% | 35.73% | 7,487 | 14,142 | 780 | 1,030 | 39,846,457 | 54.88% |
| 3 | 20 | 16,827 | 55.29% | 44.71% | 32.23% | 18,580 | 27,258 | 1,141 | 810 | 32,903,360 | 45.56% |
| 4 | 20 | 16,904 | 58.85% | 41.15% | 34.78% | 23,347 | 35,181 | 1,088 | 864 | 39,931,484 | 55.10% |
| 5 | 20 | 14,878 | 53.01% | 46.99% | 37.00% | 13,251 | 18,948 | 1,260 | 786 | 31,969,142 | 44.54% |
| 6 | 20 | 15,746 | 50.99% | 49.01% | 31.27% | 7,735 | 15,269 | 1,026 | 709 | 30,980,597 | 43.22% |

## Buffered 6-hour chronological buckets

### Before

| Bucket | Sampled blocks | Non-vote tx | Success rate | Failure rate | Failed-CU share | Median CU/tx | Median cost units/tx | Median priority fee | Median tx/block | Median CU/block | All-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 20 | 11,569 | 71.30% | 28.70% | 21.64% | 25,303 | 36,144 | 1,898 | 544 | 30,291,148 | 36.25% |
| 2 | 20 | 10,052 | 73.11% | 26.89% | 23.88% | 31,595 | 43,178 | 1,037 | 433 | 22,464,489 | 27.31% |
| 3 | 20 | 13,263 | 66.46% | 33.54% | 26.81% | 20,327 | 26,582 | 1,258 | 635 | 30,199,946 | 36.16% |
| 4 | 20 | 13,974 | 69.44% | 30.56% | 28.99% | 24,089 | 35,516 | 1,195 | 616 | 35,282,835 | 41.97% |
| 5 | 20 | 21,479 | 55.09% | 44.91% | 33.86% | 7,487 | 14,142 | 817 | 1,041 | 39,861,392 | 47.19% |
| 6 | 20 | 21,336 | 56.78% | 43.22% | 39.57% | 16,368 | 24,950 | 1,086 | 1,002 | 51,488,375 | 60.49% |

### After

| Bucket | Sampled blocks | Non-vote tx | Success rate | Failure rate | Failed-CU share | Median CU/tx | Median cost units/tx | Median priority fee | Median tx/block | Median CU/block | All-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 20 | 17,878 | 52.18% | 47.82% | 36.99% | 7,019 | 13,289 | 881 | 954 | 38,495,684 | 53.24% |
| 2 | 20 | 19,152 | 52.22% | 47.78% | 36.39% | 7,487 | 14,142 | 1,050 | 928 | 40,893,461 | 57.61% |
| 3 | 20 | 20,570 | 52.36% | 47.64% | 35.29% | 13,180 | 18,365 | 1,023 | 1,012 | 45,011,992 | 61.94% |
| 4 | 20 | 17,369 | 55.37% | 44.63% | 31.04% | 10,399 | 15,328 | 1,085 | 845 | 34,162,591 | 47.45% |
| 5 | 20 | 14,327 | 55.25% | 44.75% | 31.80% | 13,180 | 18,220 | 1,247 | 687 | 30,458,422 | 42.53% |
| 6 | 20 | 18,218 | 49.47% | 50.53% | 31.87% | 7,734 | 15,172 | 1,077 | 762 | 35,862,342 | 49.73% |

## Locked stability read

No metric qualified as stable under the preregistered direction, fee-trimming, and within-window bucket-variation gates. See [stability-analysis.md](stability-analysis.md) and [stability-preregistration.md](stability-preregistration.md).

## What is unmeasurable from landed-ledger data

- Sender geography, sender network path, ingress point, validator targeting, or any EU/US/AP comparison. These require sender/network telemetry rather than a block receipt.
- Transactions that were submitted but never landed, including dropped, expired, rejected, or otherwise unseen traffic.
- End-to-end submission latency, leader receipt time, mempool residence, forwarding behaviour, or client-side retry timing.
- Causal impact of the 350ms → 300ms transition. The study records a time-adjacent change in sampled landed execution; transaction mix, leaders, fee-market conditions, time-of-day, concurrent releases, and sampling variation remain alternatives.
- Address identity, human/bot/user classification, application ownership, or sender intent.
- Whether a failure was economically avoidable, whether a trade would have filled, quote quality, price impact, profitability, or post-window market outcome.
- A complete application-class or protocol breakdown unless a program-level attribution rule is separately defined and audited.
- A native priority fee when the relevant Compute Budget instruction data is absent or cannot be deterministically decoded. Reconstruction coverage is reported instead.
- Full-network throughput, full-population success/failure rates, or an exact global utilization census; this report samples deterministically selected landed blocks.

## What the ledger does establish

For the sampled landed population it establishes receipt success/failure, fees, consumed compute units, cost units when present, selected Compute Budget settings when reconstructable, and per-block composition. It can therefore describe execution already included in blocks, but not why it was submitted, how it travelled to a leader, or what traffic failed to appear on-chain.

## Provenance

- Raw sampled aggregates: [analysis.json](analysis.json)
- Deterministic block plan: [sampling-plan.json](sampling-plan.json)
- Append-only index: [block-index.jsonl](block-index.jsonl)
- Fee trimming sensitivity: [fee-enrichment.json](fee-enrichment.json)
- Stability rules and output: [stability-preregistration.md](stability-preregistration.md), [stability-analysis.md](stability-analysis.md)
