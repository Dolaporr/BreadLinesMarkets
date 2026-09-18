# Preregistration — observed execution either side of the epoch-1037 boundary

**Status:** FROZEN BEFORE COLLECTION. Committed prior to retrieving the corpus.
**Registered:** 2026-09-18
**Planning-time finalized tip:** slot 448,156,915

This document fixes the methodology, the exact windows, the selection rule, the metric
definitions, the refusal rules, the controls, the planned charts and the claim boundaries. Nothing
here may be revised on the basis of collected results. Any metric or cut introduced after results
are seen must be labelled **EXPLORATORY** in the report and reported separately from the
preregistered set.

## 1. Question

Does ledger-visible execution differ either side of the Solana epoch-1037 boundary, and how much of
any difference survives two controls that do not involve the feature?

This study measures. It does not identify a cause.

## 2. Boundaries

The epoch boundary is exact in **slot** space. `blockTime` is a 1-second-quantised estimate, and
slots 447,983,999 and 447,984,000 both report `1789708003` — so a window defined by `blockTime`
would pull a pre-boundary slot into the post side. Every boundary below is therefore anchored on
the slot, and `blockTime` is used only to locate the far edge of each window.

| Anchor | Slot | blockTime | UTC |
| --- | ---: | ---: | --- |
| Epoch 1037 boundary (target) | 447,984,000 | 1789708003 | 2026-09-18T05:06:43Z |
| Epoch 1036 boundary (placebo) | 447,552,000 | 1789571004 | 2026-09-16T15:03:24Z |
| Prior-day anchor (T_1037 − 86,400s) | 447,711,426 | 1789621603 | 2026-09-17T05:06:43Z |

## 3. Populations — four, kept separate, never pooled

Windows are matched on **wall-clock duration**, not slot count. Because slot duration differs
across the target boundary, equal hours contain unequal slot counts; this is a property of the
phenomenon, not a defect, and per-block statistics are reported per block while rate statistics are
reported per second.

| Population | Side | Slots (inclusive) | Slot span | Wall-clock | Epoch | Blocks to sample |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| PRIMARY_1037 | PRE | 447,972,718 – 447,983,999 | 11,282 | 3600 s | 1036 | 60 |
| PRIMARY_1037 | POST | 447,984,000 – 447,997,508 | 13,509 | 3599 s | 1037 | 60 |
| ROBUST_1037 | PRE | 447,949,989 – 447,983,999 | 34,011 | 10800 s | 1036 | 180 |
| ROBUST_1037 | POST | 447,984,000 – 448,024,603 | 40,604 | 10799 s | 1037 | 180 |
| PLACEBO_1036 | PRE | 447,540,641 – 447,551,999 | 11,359 | 3600 s | 1035 | 60 |
| PLACEBO_1036 | POST | 447,552,000 – 447,563,376 | 11,377 | 3599 s | 1036 | 60 |
| PRIORDAY | PRE | 447,700,066 – 447,711,425 | 11,360 | 3599 s | 1036 | 60 |
| PRIORDAY | POST | 447,711,426 – 447,722,842 | 11,417 | 3599 s | 1036 | 60 |

Total: **720 blocks**. Exact bounds are machine-readable in [`windows.json`](windows.json).

## 4. Deterministic block-selection rule

Fixed in advance and implemented in
[`scripts/simd0525-epoch1037-collect.ts`](../../scripts/simd0525-epoch1037-collect.ts):

1. Enumerate produced slots in the window with `getBlocks(startSlot, endSlotInclusive)`. Call the
   resulting ascending array `S`, with `M = S.length`.
2. Select `N` blocks by even rank: for `k = 0 … N−1`, take `S[round(k × (M−1) / (N−1))]`.
   Deduplicate while preserving order. If `M < N`, take all of `S` and record the shortfall.
3. Selection uses **position only**. Success state, failure type, error class, fee, compute units,
   cost units, program identity, writable accounts, transaction version, signer identity and every
   other post-retrieval property play no role. Ranks are computed before any block is fetched.

## 5. RPC parameters

- Endpoint: `https://api.mainnet-beta.solana.com`. No keyed endpoint is configured in this
  environment; none is used, and no credential appears in any artifact or log.
- `getBlock(slot, { encoding: "json", transactionDetails: "full", rewards: false,
  maxSupportedTransactionVersion: 1 })`. Identical on every side of every population.
- `transactionDetails: "accounts"` is **not** usable: it omits `computeUnitsConsumed` and
  `costUnits`. Verified before registration.
- Throttle: ≥250 ms between block requests, with exponential backoff (1.2 s × 2^attempt, 8
  attempts) on transport errors and rate limiting.

## 6. Absence and refusal rules — three separate states, never merged

| State | Trigger | Handling |
| --- | --- | --- |
| `SKIPPED` | RPC error −32007 / −32009 | Slot had no block. Not an observation. Never replaced. |
| `UNAVAILABLE` | RPC error −32004 | Node holds no block for the slot. Never replaced. |
| `REFUSED` | Transport failure or rate limiting surviving all 8 retries | Endpoint would not answer. Never replaced, never counted as absence. |

A selected block that lands in any of these states is recorded with its state and **left as a hole**.
It is not swapped for a neighbour, because substituting the next produced block would make
selection depend on retrieval outcome. Every population reports its realised sample size, and a
population whose realised size falls below **80%** of its planned size is reported as
**UNDERPOWERED** and its comparisons are not interpreted.

## 7. Exclusions

- **Vote transactions**, excluded from all per-transaction metrics: a transaction is vote-only when
  every outer instruction's program is `Vote111111111111111111111111111111111111111` or
  `ComputeBudget111111111111111111111111111111` **and** at least one is the Vote program.
- Nothing else is excluded. No outlier trimming, no failure-class filtering, no program filtering.

## 8. Preregistered metrics — exactly these eleven

Computed identically for every population and side.

1. **Windowed observed mean slot duration** = `(blockTime[endSlot] − blockTime[startSlot]) ÷
   (endSlot − startSlot)`, in ms. Computed over the **whole window**, not the sample.
2. **Non-vote transaction count** — per sampled block: median, mean, IQR.
3. **Success / failure rate** — over sampled non-vote transactions; `meta.err === null` is success.
4. **Total CU** — summed `computeUnitsConsumed` over sampled non-vote transactions.
5. **CU per non-vote transaction** — median, mean, p90.
6. **CU per unit wall-clock time (windowed only)** = `mean sampled non-vote CU per block ×
   produced blocks in window ÷ window wall-clock seconds`. An **extrapolated estimate**; labelled as
   such wherever it appears. Never computed per block or per slot.
7. **Execution / invocation depth** — per non-vote transaction, the maximum `stackHeight` across
   `meta.innerInstructions`; outer instructions are depth 1. Reported as median and max.
8. **Failure depth** — for a failed transaction whose `meta.err` is `InstructionError [i, …]`, the
   maximum `stackHeight` within the inner-instruction group at index `i`, else 1. Failures whose
   error is not an `InstructionError` are recorded as `UNATTRIBUTABLE` and excluded from the depth
   distribution while remaining in the failure count.
9. **Writable-account concentration** — over sampled non-vote transactions, the writable set is the
   header-derived static writable accounts plus `meta.loadedAddresses.writable`. Reported as
   `top1Share` (share of sampled non-vote transactions whose writable set contains the single
   most-frequently-written account), `top5Share` (share touching any of the top five), and the
   Herfindahl index of per-account touch counts.
10. **Reconstruction completeness** — share of sampled non-vote transactions carrying all of
    `computeUnitsConsumed`, `costUnits`, `err`, `innerInstructions` and a resolvable writable set.
11. **Produced / skipped block coverage** — `produced ÷ slotSpan` per window, with the absolute
    skipped count and the three absence states above reported separately.

One additional quantity is recorded but is **not** a comparison metric and carries **no capacity
inference**: per-block summed `costUnits` across all transactions. During gate work this was
provisionally described as comparable to a block CU cap. That was wrong and is corrected here:
pre-registration sampling observed per-block summed `costUnits` of 53.4M (300 ms side) and 59.2M
(250 ms side), both **above** the block compute-unit maxima the activation announcement states
(45M at 300 ms, 37.5M at 250 ms). Summed `costUnits` is therefore a different accounting from the
protocol block CU limit, and no ceiling, cap or utilisation claim is drawn from it here.

## 9. Controls

1. **Epoch-1036 rollover placebo.** Same relative windows around a boundary where no feature change
   is claimed. It controls for **epoch rollover** — leader-schedule rotation, stake activation — and
   for nothing else. It does **not** control time-of-day: its boundary is 15:03 UTC against the
   target's 05:06 UTC.
2. **Prior-day same-hour control.** The same clock hour, 24 hours earlier, with the same
   construction. It bounds time-of-day and diurnal workload effects **imperfectly**: it holds the
   hour fixed, not the day, the market, or anything else that moved between the two dates.

Neither control converts a difference into a cause. Together they narrow what a difference cannot
be, and nothing more.

## 10. Evidence boundaries — binding on every output

- `blockTime` supports **windowed** duration estimates. It does not support per-slot latency, and
  no per-slot or adjacent-pair timing claim will be made. It is a stake-weighted validator-reported
  estimate quantised to one second, not a measured clock.
- **Target slot duration is protocol metadata.** It is not derived from the ledger and will not be
  presented as a measurement. Any statement of a target value must carry an external citation to the
  authoritative Anza / Solana activation announcement.
- **Writable overlap and concentration are not scheduler contention.** No lock conflict,
  serialisation, queueing or contention claim follows from them.
- **Before/after workload differences are not automatically caused by SIMD-0525.** Transaction mix,
  leader set, fee conditions, time of day and concurrent feature changes are uncontrolled.
- The epoch-1036 placebo controls **rollover, not time-of-day**.
- The prior-day control bounds **workload timing imperfectly**, not all confounders.
- `SKIPPED`, `UNAVAILABLE` and `REFUSED` remain distinct states in raw output and report.
- All counts are **sampled-ledger counts**, not network totals. Transactions that never landed are
  invisible to this method.

## 11. Claim boundaries — two claims, kept apart

**Claim A — observed, from the ledger.** A step in windowed observed mean slot duration from
≈318 ms to ≈266 ms at the epoch-1037 boundary, with the epoch-1036 placebo flat across its own
boundary. This is what the measurement supports.

**Claim B — protocol, from documentation. SOURCED.** The target slot duration changed from
300 ms to 250 ms at epoch 1037, the fourth of five stages in SIMD-0525's reduction from a 400 ms
baseline toward a 200 ms target. Each stage proportionally scales per-slot resource limits so the
per-second execution budget stays approximately constant; block compute-unit maximum at 250 ms is
37.5M, against 60M at the 400 ms baseline. Reported activation: 2026-09-18, 05:06 UTC — which
matches the independently measured boundary blockTime of `1789708003` (2026-09-18T05:06:43Z).

Source: [Solana Compass — 250ms slot time live at epoch 1037, SIMD-0525 step
four](https://solanacompass.com/news/solana-activates-250ms-slot-time-at-epoch-1037-fourth-step-of-simd-0525).
This is secondary reporting of an Anza announcement, not a primary Anza document, and is labelled
as such. Claim B rests on it entirely. **No part of Claim B is derived from the ledger**, and the
agreement between the reported activation time and the measured boundary is a consistency
observation, not an identification.

**The ledger does not independently identify SIMD-0525.** This study cannot distinguish SIMD-0525
from any other change activating at the same epoch boundary. It will not claim otherwise.

## 12. Planned charts

Registered in advance. No chart may present the primary comparison without its controls adjacent.

1. Windowed observed mean slot duration, all four populations, PRE vs POST — grouped bars.
2. Non-vote transactions per sampled block, PRE vs POST, all four populations — box plot.
3. CU per non-vote transaction (median, p90), PRE vs POST, all four populations — grouped bars.
4. Failure rate, PRE vs POST, all four populations — grouped bars.
5. Execution-depth distribution, PRE vs POST, primary and prior-day — histogram.
6. Writable `top1Share`, PRE vs POST, all four populations — grouped bars.
7. Coverage and realised sample size per population — table, always printed.

## 13. Hypotheses

- **H1 (duration).** Windowed observed mean slot duration is lower in PRIMARY_1037 POST than PRE,
  while PLACEBO_1036 shows no comparable step. *Directional, preregistered.*
- **H2 (workload).** No directional hypothesis. Note that the announcement states the intent is an
  approximately constant per-second execution budget; this is recorded as context, and metric 6 is
  **not** treated as a test of that intent, because it is an extrapolated sample estimate and the
  workload is uncontrolled. Transaction counts, CU, failure rates, depth and
  concentration are reported descriptively for all four populations. A difference in PRIMARY_1037
  that is matched in PRIORDAY or PLACEBO_1036 is **not** evidence of a boundary effect.

There is no significance test. Sample sizes are fixed in advance, nothing is stopped early, and no
threshold decides a conclusion.

## 14. Outputs

- `results.json` — machine-readable: per-block rows, per-window aggregates, absence ledger, RPC
  statistics, and this preregistration's commit SHA.
- `report.md` — compact public report, structured to mirror §8 in order, with controls beside the
  primary throughout. Metric order is fixed here so the write-up cannot be reorganised around
  whichever result turns out to be most striking.
