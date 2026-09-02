# Why the 350ms → 300ms boundary does not support a simple before/after claim

## Abstract

We examined landed non-vote execution around Solana epoch 1024, the boundary at which the target slot time changed from 350ms to 300ms. A deterministic sampled-ledger study found that the estimated before/after answer changes materially with window width. A fixed same-hour control from the preceding day reproduces the main pre-boundary pattern: sampled non-vote activity rises sharply in the final two hours while the landed success rate falls. This does not identify a cause, but it shows that the pre-boundary composition change was not unique to the transition date. The ledger therefore does not support a simple causal claim about the slot-time change from this boundary alone.

## Question

What changed in *landed* non-vote execution across epoch 1024? The intended result was descriptive rather than causal. The study cannot observe unlanded traffic, sender geography, ingress path, or end-to-end latency.

## Boundary and design

- Effective boundary: epoch 1024, slot 442,368,000, `2026-08-28T15:25:03Z`.
- Population: landed transactions in deterministic sampled blocks.
- Exclusion: vote-only transactions, defined as transactions whose outer instructions are exclusively Vote and Compute Budget and include at least one Vote instruction.
- Windows: unbuffered 1h, 3h, and 6h; plus a 6h variant excluding the fixed 10 minutes immediately adjacent to the boundary.
- Selection: deterministic, evenly ranked landed blocks; neither status, fee, compute, signer, program, nor later outcome affects selection.
- Stability rule: a metric must agree in direction across 1h, 3h, 6h, and buffered 6h, survive the fee sensitivity rule where applicable, and exceed within-window bucket variation in every comparison.

No measured metric met that rule.

## Pre-boundary composition changed before the boundary

The fixed six-hour pre-boundary sample uses 20 deterministic blocks per one-hour bucket.

| Bucket | UTC | Sampled non-vote transactions | Landed success rate |
| --- | --- | ---: | ---: |
| 1 | 09:25–10:25 | 10,222 | 74.83% |
| 2 | 10:25–11:25 | 11,267 | 75.76% |
| 3 | 11:25–12:25 | 13,367 | 65.53% |
| 4 | 12:25–13:25 | 14,119 | 64.93% |
| 5 | 13:25–14:25 | 24,999 | 52.51% |
| 6 | 14:25–15:25 | 23,028 | 55.20% |

The late-window transaction count is materially higher than in the first four buckets, while the landed success rate is materially lower. That variation occurs before the epoch boundary, so a before/after comparison inherits it.

## Same-hour prior-day control

The only added control uses `2026-08-27T09:25:03Z`–`2026-08-27T15:25:03Z`: exactly one day earlier, with the same six one-hour buckets, 120 deterministic blocks, and vote-only exclusion.

| Bucket | Transition-day pre-window tx | Prior-day same-hour tx | Transition-day success rate | Prior-day same-hour success rate |
| --- | ---: | ---: | ---: | ---: |
| 1 | 10,222 | 13,014 | 74.83% | 71.85% |
| 2 | 11,267 | 11,253 | 75.76% | 66.44% |
| 3 | 13,367 | 13,055 | 65.53% | 68.51% |
| 4 | 14,119 | 14,124 | 64.93% | 66.67% |
| 5 | 24,999 | 21,529 | 52.51% | 54.26% |
| 6 | 23,028 | 21,052 | 55.20% | 50.69% |

Both days show a late-window rise in sampled landed non-vote transactions and a lower success rate in the final two buckets. This is consistent with a recurring same-hour composition effect, including a possible time-of-day effect. It does **not** establish that time of day caused the pattern: a one-day matched control cannot separate recurring activity, market conditions, leaders, or other unobserved factors.

## Direct governance candidate check

The documented `svmgov` program, `govYkyQ3ePtGULAtY6V75qjWE8UH4vCUVQ1W4HdCAZU`, was verified executable on-chain and checked as an exact outer-instruction match across all 120 fixed pre-boundary blocks. It appeared zero times. Thus direct outer `svmgov` activity cannot explain the observed ramp in this sample.

## What this supports

The evidence supports a methodological conclusion:

> The landed execution composition near this boundary was already changing across the pre-boundary hours, and a matched prior-day same-hour sample shows a qualitatively similar late-window pattern. Window width therefore changes the observed before/after answer. A simple boundary comparison cannot isolate a stable ledger-side effect of the 350ms → 300ms transition.

## What this does not support

- The 300ms transition caused any specific movement.
- The recurring pattern is definitively diurnal.
- The pattern reflects a particular geography, sender cohort, application, protocol, bot/human category, or governance process.
- The result describes dropped traffic, end-to-end latency, or all attempted transactions.
- The result predicts behavior at a future 250ms transition.

## Implication for future slot-time studies

A future boundary study should pre-register matched same-hour controls across multiple prior days, retain bucketed execution-composition data, and distinguish landed-ledger composition from submission-side telemetry. Public macro TPS or skip-rate views cannot substitute for those controls.

## Evidence

- [Full window tables](full-window-report.md)
- [Stability rules](stability-preregistration.md) and [classification](stability-analysis.md)
- [Prior-day matched control](prior-day-same-hour-control.md) and [raw evidence](prior-day-same-hour-control.json)
- [svmgov exact-match check](svmgov-prewindow-sample.md)
