# Observed execution either side of the epoch-1037 boundary

**Preregistration:** [`preregistration.md`](preregistration.md) at commit `09e0e83f3954badaf383cc1447e76db8fe21f4c1`.
**Collected:** 2026-09-18T19:43:35.876Z · endpoint `https://api.mainnet-beta.solana.com`

This report follows the preregistration's metric order. All four populations appear in every
table. Nothing here identifies a cause.

## 1. Completeness, coverage and refusals

Reported before any measurement, because a measurement whose sample did not arrive is not a
measurement. No missing or refused slot was replaced.

| Population | Side | Planned | Selected | Realised | SKIPPED | UNAVAILABLE | REFUSED | Produced/span | Reconstruction |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PRIMARY_1037 | PRE | 60 | 60 | 60 | 0 | 0 | 0 | 99.89% | 100.00% |
| PRIMARY_1037 | POST | 60 | 60 | 60 | 0 | 0 | 0 | 100.00% | 99.99% |
| ROBUST_1037 | PRE | 180 | 180 | 180 | 0 | 0 | 0 | 99.90% | 99.99% |
| ROBUST_1037 | POST | 180 | 180 | 180 | 0 | 0 | 0 | 99.95% | 99.98% |
| PLACEBO_1036 | PRE | 60 | 60 | 60 | 0 | 0 | 0 | 99.93% | 99.91% |
| PLACEBO_1036 | POST | 60 | 60 | 60 | 0 | 0 | 0 | 99.96% | 99.95% |
| PRIORDAY | PRE | 60 | 60 | 60 | 0 | 0 | 0 | 99.96% | 99.95% |
| PRIORDAY | POST | 60 | 60 | 60 | 0 | 0 | 0 | 100.00% | 99.98% |

**No population fell below the 80% realised-sample threshold. No column is marked ⚠.**

RPC: 1,100 calls, 374 retries, 2 deduplicated fetches.

Two different refusal counts, kept apart: **0 selected slot(s)** ended in `REFUSED` (the column above — these are holes in the corpus, never substituted), against 0 call-level refusal(s) across all RPC methods including window enumeration, which a later retry may have recovered.

## 2. Preregistered metrics

### 2.1 Windowed observed mean slot duration

Computed over the whole window, not the sample: `(blockTime[end] − blockTime[start]) ÷ (end − start)`.
**Observed duration, not a protocol target** — see §4.

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Observed mean slot duration (ms) | 319.1 | 266.4 | -16.5% | 317.6 | 266.0 | -16.2% | 317.0 | 316.4 | -0.2% | 316.8 | 315.3 | -0.5% |

### 2.2 Non-vote transaction count (per sampled block)

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Median non-vote tx / block | 664.0 | 391.0 | -41.1% | 628.0 | 399.5 | -36.4% | 681.0 | 719.5 | +5.7% | 698.5 | 499.5 | -28.5% |
| Mean non-vote tx / block | 686.2 | 450.2 | -34.4% | 671.1 | 426.1 | -36.5% | 732.4 | 726.2 | -0.8% | 757.4 | 538.9 | -28.8% |

### 2.3 Success / failure rate (sampled non-vote transactions)

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sampled non-vote transactions | 41,170 | 27,011 | -34.4% | 120,799 | 76,701 | -36.5% | 43,941 | 43,571 | -0.8% | 45,442 | 32,336 | -28.8% |
| Failure rate | 37.20% | 31.75% | -14.7% | 36.63% | 28.72% | -21.6% | 35.08% | 33.62% | -4.2% | 41.53% | 30.59% | -26.3% |

### 2.4 Total CU

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sampled total CU | 2,203,159,617 | 1,336,693,127 | -39.3% | 6,392,584,708 | 3,869,981,479 | -39.5% | 2,393,243,519 | 2,428,295,146 | +1.5% | 2,054,669,427 | 1,584,031,488 | -22.9% |

### 2.5 CU per non-vote transaction

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Median CU / tx | 18,591 | 11,023 | -40.7% | 18,390 | 13,018 | -29.2% | 19,778 | 25,374 | +28.3% | 16,999 | 17,979 | +5.8% |
| Mean CU / tx | 53,514 | 49,487 | -7.5% | 52,919 | 50,455 | -4.7% | 54,465 | 55,732 | +2.3% | 45,215 | 48,987 | +8.3% |
| p90 CU / tx | 154,273 | 140,559 | -8.9% | 151,697 | 142,839 | -5.8% | 147,810 | 143,690 | -2.8% | 121,934 | 133,099 | +9.2% |

### 2.6 CU per unit wall-clock time (windowed, EXTRAPOLATED ESTIMATE)

Extrapolated from the sample: mean sampled non-vote CU per block × produced blocks ÷ window
seconds. Not a per-block or per-slot quantity.

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Estimated non-vote CU / second | 114,951,893 | 83,622,244 | -27.3% | 111,728,833 | 80,795,335 | -27.7% | 125,767,163 | 127,892,010 | +1.7% | 108,052,357 | 83,749,595 | -22.5% |

### 2.7 Execution / invocation depth

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Median depth | 1.0 | 1.0 | 0.0% | 1.0 | 1.0 | 0.0% | 1.0 | 1.0 | 0.0% | 1.0 | 1.0 | 0.0% |
| Max depth | 5 | 5 | 0.0% | 5 | 5 | 0.0% | 5 | 5 | 0.0% | 4 | 5 | +25.0% |

### 2.8 Failure depth

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Median failure depth | 1.0 | 1.0 | 0.0% | 1.0 | 1.0 | 0.0% | 1.0 | 1.0 | 0.0% | 1.0 | 1.0 | 0.0% |
| Attributable failures | 15,313 | 8,537 | -44.2% | 44,207 | 21,956 | -50.3% | 15,374 | 14,619 | -4.9% | 18,843 | 9,875 | -47.6% |
| Unattributable failures (non-InstructionError) | 4 | 38 | +850.0% | 40 | 73 | +82.5% | 41 | 30 | -26.8% | 29 | 16 | -44.8% |

### 2.9 Writable-account concentration

**Concentration is a workload descriptor. It is not scheduler contention** — no lock conflict,
serialisation or queueing claim follows from it.

| Metric | PRIMARY pre | PRIMARY post | PRIMARY Δ | ROBUST pre | ROBUST post | ROBUST Δ | PLACEBO pre | PLACEBO post | PLACEBO Δ | PRIORDAY pre | PRIORDAY post | PRIORDAY Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| top1 share | 12.21% | 7.00% | -42.7% | 8.30% | 8.21% | -1.1% | 8.11% | 8.26% | +1.8% | 14.18% | 9.55% | -32.7% |
| top5 share | 58.76% | 30.39% | -48.3% | 35.98% | 30.25% | -15.9% | 37.91% | 32.95% | -13.1% | 68.66% | 38.18% | -44.4% |
| Herfindahl index | 0.0014 | 0.0008 | -40.5% | 0.0009 | 0.0007 | -26.6% | 0.0011 | 0.0008 | -27.7% | 0.0021 | 0.0012 | -40.7% |
| Distinct writable accounts | 58,007 | 46,430 | -20.0% | 146,916 | 111,124 | -24.4% | 62,539 | 70,659 | +13.0% | 55,557 | 48,110 | -13.4% |

### 2.10 Reconstruction completeness · 2.11 Coverage

Reported in §1 above.

### Recorded, not compared: per-block summed cost units

| Population | PRE max | POST max |
| --- | ---: | ---: |
| PRIMARY_1037 | 74,963,267 | 56,974,170 |
| ROBUST_1037 | 74,999,994 | 62,415,942 |
| PLACEBO_1036 | 74,977,081 | 74,770,215 |
| PRIORDAY | 74,982,329 | 74,860,165 |

**No capacity inference is drawn from these.** Summed `costUnits` is a different accounting from
the protocol block compute-unit limit; an earlier provisional reading of it as a capacity ceiling
was withdrawn in the preregistration and is not revived here.

## 3. What the controls do to each result

A difference that also appears in PRIORDAY at similar magnitude is a time-of-day pattern, not a
boundary effect. A difference that also appears in PLACEBO_1036 is an epoch-rollover pattern.

| Metric | PRIMARY Δ | ROBUST Δ | PLACEBO Δ | PRIORDAY Δ | Reading |
| --- | ---: | ---: | ---: | ---: | --- |
| Observed mean slot duration | -16.5% | -16.2% | -0.2% | -0.5% | Not reproduced by either control at comparable magnitude |
| Median non-vote tx / block | -41.1% | -36.4% | 5.7% | -28.5% | **REPRODUCED BY PRIOR-DAY CONTROL** — not attributable to the boundary |
| Failure rate | -14.7% | -21.6% | -4.2% | -26.3% | **REPRODUCED BY PRIOR-DAY CONTROL** — not attributable to the boundary |
| Median CU / transaction | -40.7% | -29.2% | 28.3% | 5.8% | Not reproduced by either control at comparable magnitude |
| Estimated CU / second | -27.3% | -27.7% | 1.7% | -22.5% | **REPRODUCED BY PRIOR-DAY CONTROL** — not attributable to the boundary |
| Median execution depth | 0.0% | 0.0% | 0.0% | 0.0% | FLAT — no movement to explain |
| Writable top-5 share | -48.3% | -15.9% | -13.1% | -44.4% | **REPRODUCED BY PRIOR-DAY CONTROL** — not attributable to the boundary |

## 4. Observed slot duration is not the protocol target

**Observed, from the ledger.** Windowed mean slot duration stepped from
319.1 ms to 266.4 ms across the epoch-1037 boundary
(-16.5%), reproduced in the 3-hour robustness window
(317.6 → 266.0 ms). Neither control shows a comparable step:
PLACEBO_1036 moved -0.2% across an ordinary epoch rollover and PRIORDAY
-0.5% across the same clock hour a day earlier.

**Protocol, from documentation.** The target slot duration changed 300 ms → 250 ms at epoch 1037,
the fourth of five SIMD-0525 stages. That value is documentation, not measurement, and is not
derived from any block in this corpus.

**The ledger does not identify SIMD-0525.** This corpus cannot distinguish SIMD-0525 from any
other change activating at the same boundary. Observed duration runs above the documented target
on both sides, which is consistent with per-slot overhead but establishes nothing about its cause.

## 5. Limits

- `blockTime` is a 1-second-quantised, stake-weighted validator estimate. Every duration here is a
  whole-window mean. **No per-slot or adjacent-pair latency is derivable**, and none is claimed.
- Workloads are uncontrolled. PRE/POST is a position either side of a boundary, not a treatment.
- Writable-account concentration is a workload descriptor. **It is not scheduler contention** — no
  lock conflict, serialisation or queueing claim follows from it.
- The placebo controls epoch rollover, not time of day. The prior-day control bounds time of day
  imperfectly: it holds the hour fixed, not the day, the market, or anything else that moved.
- All counts are sampled-ledger counts. Transactions that never landed are invisible here.
- One boundary, one day. Nothing here establishes that any pattern recurs.
