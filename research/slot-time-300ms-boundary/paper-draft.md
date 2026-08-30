# When the window determines the result

## A landed-ledger methodology note on Solana’s 350ms → 300ms transition

### Abstract

The landed success-rate answer at Solana’s 350ms → 300ms boundary moves from **+0.22 percentage points** in an unbuffered one-hour comparison to **−10.65 percentage points** in a buffered six-hour comparison, based on window width alone. Solana epoch 1024 began at slot 442,368,000 (`2026-08-28T15:25:03Z`); we examined deterministic samples of landed non-vote transactions in symmetric wall-clock windows around that boundary. A matched same-hour sample from the previous day reproduces the key pre-boundary pattern: more landed non-vote activity in the final two hours and lower success rates. The evidence is consistent with recurring execution-composition variation, potentially time-of-day-related, rather than an isolated transition-date effect. It does not identify the source of that variation or establish causality.

## 1. The question

The narrow question was: what changed in *landed* non-vote execution immediately around the epoch-1024 slot-time transition?

This paper does not attempt to estimate sender geography, network latency, dropped traffic, transaction intent, or the causal effect of the slot-time reduction. It asks a smaller methodological question: does a deterministic ledger-side before/after comparison yield a stable descriptive result at this boundary?

The answer is no.

## 2. Boundary and sample contract

- **Boundary:** epoch 1024, slot 442,368,000, `2026-08-28T15:25:03Z`.
- **Population:** landed transactions in deterministically selected full blocks.
- **Vote-only exclusion:** a transaction is excluded only when its outer instructions are exclusively Vote and Compute Budget and include at least one Vote instruction.
- **Windows:** unbuffered 1h, 3h, and 6h wall-clock windows; plus a 6h sensitivity window excluding the fixed ten minutes immediately adjacent to the boundary.
- **Block selection:** evenly ranked landed blocks within each fixed window. Success state, fees, compute use, signer, program, and later information do not affect selection.
- **Stability gate:** a metric must have the same direction in the 1h, 3h, 6h, and buffered-6h comparisons; fee measures additionally undergo a fixed 1% upper-tail trimming sensitivity; and the before/after difference must exceed within-window bucket variation in every comparison.

No metric passed that gate.

## 3. Window width changes the answer

The landed success-rate comparison is sufficient to illustrate the problem.

| Symmetric wall-clock comparison | Sampled non-vote tx, before | Sampled non-vote tx, after | Success rate, before | Success rate, after | After − before |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1h, unbuffered | 65,459 | 58,701 | 53.09% | 53.31% | +0.22 pp |
| 3h, unbuffered | 177,414 | 167,503 | 56.58% | 54.72% | −1.86 pp |
| 6h, unbuffered | 97,002 | 104,425 | 61.80% | 54.12% | −7.69 pp |
| 6h, 10-minute buffer | 91,673 | 107,514 | 63.34% | 52.69% | −10.65 pp |

The one-hour comparison is essentially flat. The longer comparisons show lower post-boundary success, with the largest gap in the buffered six-hour sensitivity. Those are not competing estimates of a single stable boundary effect: they describe different mixtures of landed execution.

The same result appears in the preregistered stability read. The 10-minute pre-boundary success-rate buckets alone span a much larger range than the one-hour before/after difference. Under the fixed rule, success rate, failure rate, failed-CU share, compute distributions, cost-unit distributions, reconstructed priority fees, transactions per block, consumed CU per block, and utilization are all unstable or outlier-sensitive rather than stable signals.

## 4. The composition was moving before the boundary

The six-hour pre-boundary sample contains twenty deterministic blocks per one-hour bucket.

| Bucket | UTC | Sampled landed non-vote tx | Landed success rate |
| --- | --- | ---: | ---: |
| 1 | 09:25–10:25 | 10,222 | 74.83% |
| 2 | 10:25–11:25 | 11,267 | 75.76% |
| 3 | 11:25–12:25 | 13,367 | 65.53% |
| 4 | 12:25–13:25 | 14,119 | 64.93% |
| 5 | 13:25–14:25 | 24,999 | 52.51% |
| 6 | 14:25–15:25 | 23,028 | 55.20% |

The final two pre-boundary buckets contain substantially more sampled landed non-vote transactions and lower success rates than the first four. That movement precedes the epoch boundary; any longer before/after window inherits it.

## 5. Matched same-hour control

To test the simplest alternative explanation, we sampled the same six UTC hours exactly one day earlier (`2026-08-27T09:25:03Z`–`2026-08-27T15:25:03Z`) with the same 120-block, six-bucket, vote-exclusion contract.

| Bucket | Transition-day pre-window tx | Prior-day same-hour tx | Transition-day success | Prior-day same-hour success |
| --- | ---: | ---: | ---: | ---: |
| 1 | 10,222 | 13,014 | 74.83% | 71.85% |
| 2 | 11,267 | 11,253 | 75.76% | 66.44% |
| 3 | 13,367 | 13,055 | 65.53% | 68.51% |
| 4 | 14,119 | 14,124 | 64.93% | 66.67% |
| 5 | 24,999 | 21,529 | 52.51% | 54.26% |
| 6 | 23,028 | 21,052 | 55.20% | 50.69% |

The matched day reproduces the qualitative shape: higher sampled activity in buckets five and six and lower success in those same late buckets. This strengthens the case that the transition-day pre-window was not a stationary baseline.

This control is **n=1 day**. Multiple matched prior days would be materially stronger and are required to assess whether the pattern is consistently time-of-day-related rather than driven by recurring market composition, leader effects, fee-market conditions, or other unobserved changes. The present control does not prove a diurnal mechanism, but it makes a transition-only narrative untenable on the present evidence.

## 6. A rejected candidate confounder

The documented `svmgov` program (`govYkyQ3ePtGULAtY6V75qjWE8UH4vCUVQ1W4HdCAZU`) was verified executable on-chain and matched exactly as an outer instruction across all 120 fixed transition-day pre-boundary blocks. It appeared zero times. Direct outer `svmgov` activity therefore does not explain this sample’s ramp, though this does not rule out indirect invocation paths or other governance-related activity.

## 7. Independent block-fullness observation

This result is separate from the window-comparison analysis. Across the sampled blocks, the maximum summed cost units per block reached **85.36M** against the **87.5M** applicable pre-boundary cap and **72.81M** against the **75M** applicable post-boundary cap, without exceeding either limit. These near-ceiling observations support the applied capacity denominators and independently show that sampled blocks approached their respective ledger-visible ceilings; they do not identify a before/after effect or establish why blocks were full.

## 8. What the ledger can and cannot establish

For the sampled landed population, the ledger establishes receipt success/failure, consumed compute units, cost units when present, fees, reconstructable Compute Budget settings, and per-block execution composition.

It cannot establish:

- sender geography, ingress point, network path, or validator targeting;
- dropped-before-landing transactions or complete attempted traffic;
- end-to-end latency, forwarding, mempool residence, or client retries;
- address identity, human/bot labels, transaction intent, or application ownership;
- price, fill quality, profitability, or post-event market outcomes;
- why the time-adjacent composition changed; or
- that the 350ms → 300ms transition caused any observed movement.

## 9. Implication

The useful result is methodological, not a performance headline:

> At this boundary, landed execution composition was already changing before epoch 1024, and a matched prior-day same-hour sample shows a similar late-window pattern. Window width therefore determines the observed before/after answer. The available ledger evidence does not isolate a stable effect of the 350ms → 300ms transition.

For a future 250ms study, the minimum design should pre-register multiple matched same-hour control days, retain bucketed composition data, separate landed-ledger metrics from sender-side telemetry, and avoid treating a single immediate pre-window as stationary by default.

## Evidence and reproducibility

- [Full window tables and bucket data](full-window-report.md)
- [Stability preregistration](stability-preregistration.md) and [classification](stability-analysis.md)
- [Prior-day same-hour control](prior-day-same-hour-control.md)
- [svmgov candidate check](svmgov-prewindow-sample.md)
- [Methodology integrity audit](methodology-integrity-audit.md)
