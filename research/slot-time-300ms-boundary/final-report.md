# Solana 350ms → 300ms: landed non-vote execution

## Boundary and scope

- **Effective boundary:** epoch 1024, slot 442,368,000, `2026-08-28T15:25:03.000Z`.
- **Pre side:** epoch 1023 at the 350ms stage; **post side:** epoch 1024 at the 300ms stage.
- **Population:** landed transactions in deterministic sampled blocks; vote-only transactions are excluded when every outer instruction is Vote or Compute Budget and at least one is Vote.
- **Sampling coverage at the transition:** there was no predeclared exclusion in the eligible windows, but the closest independently selected blocks leave an implicit observed-evidence gap: pre slot 442,367,918 (`15:24:33Z`) to post slot 442,368,093 (`15:25:33Z`). That is 174 unsampled slots between the selected blocks, or about 60 seconds; it is not represented as a zero-width buffer.
- **Capacity denominator:** 87.5M CUs before and 75M after: the active 100M baseline scaled by SIMD-0525.

## Methodology

The primary comparison uses two symmetric 60-minute wall-clock windows. Each side contains 60 deterministically selected, evenly ranked landed blocks. The robustness comparison uses two 3-hour windows and 180 blocks per side. Selection used only block position; success state, fee, compute, programs, signers, and all post-landing information played no role.

Methodology integrity has been audited separately in [methodology-integrity-audit.md](methodology-integrity-audit.md). It confirms the authoritative boundary timestamp and all completed window labels use `2026-08-28T15:25:03.000Z`; no completed metric used the erroneous `19:25:03Z` status-message timestamp.

Both adjacent boundary slots resolve to the same estimated `blockTime` second (`15:25:03Z`). The ledger therefore establishes the epoch/slot boundary exactly, but not a sub-second boundary instant from that pair alone.

All counts below are **sampled-ledger counts**, not network totals. A transaction is either landed-success or landed-failed based on its receipt. This study cannot see transactions that never landed.

## Primary 60-minute comparison

| Observed dimension | Before | After | Relative difference |
| --- | ---: | ---: | ---: |
| Sampled blocks | 60 | 60 | 0.0% |
| Sampled landed non-vote transactions | 65,459 | 58,701 | -10.3% |
| Success rate | 53.09% | 53.31% | 0.4% |
| Failure rate | 46.91% | 46.69% | -0.5% |
| Total consumed CUs | 2,969,720,866 | 2,552,090,044 | -14.1% |
| Failed-CU share | 38.85% | 37.46% | -3.6% |
| Median CUs / transaction | 11,726 | 7,487 | -36.2% |
| Median cost units / transaction | 17,768 | 14,142 | -20.4% |
| Total fees (lamports) | 6,883,036,598 | 2,518,012,379 | -63.4% |
| Median native priority fee (reconstructable subset) | 1,437 | 1,000 | -30.4% |
| Median non-vote transactions / block | 1,060 | 880 | -17.0% |
| Median non-vote CUs / block | 50,634,891 | 40,758,771 | -19.5% |
| Median all-landed CU utilization | 35.66% | 33.74% | -5.4% |

Priority fees were reconstructable for 78.11% before and 76.86% after. Cost units were available for all sampled non-vote transactions. Cost units and consumed CUs remain distinct runtime measures; no causal or ratio meaning is assigned to their relationship, despite observed correlation.

## 10-minute chronological buckets

### Before

| Bucket | Blocks | Sampled non-vote tx | Success rate | Failed-CU share | Median CU/tx | Median tx/block | Median all-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 10 | 10,839 | 54.31% | 34.35% | 7,735 | 1,122 | 30.54% |
| 2 | 10 | 13,134 | 50.53% | 36.32% | 7,487 | 1,248 | 36.66% |
| 3 | 10 | 10,404 | 50.80% | 44.41% | 11,017 | 1,104 | 27.36% |
| 4 | 10 | 9,939 | 54.06% | 36.04% | 15,138 | 990 | 34.09% |
| 5 | 10 | 9,429 | 61.86% | 29.03% | 21,817 | 952 | 30.98% |
| 6 | 10 | 11,714 | 48.96% | 50.06% | 19,240 | 997 | 39.58% |

### After

| Bucket | Blocks | Sampled non-vote tx | Success rate | Failed-CU share | Median CU/tx | Median tx/block | Median all-landed CU utilization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 10 | 8,267 | 51.81% | 39.38% | 7,919 | 703 | 29.69% |
| 2 | 10 | 11,040 | 52.07% | 37.98% | 7,501 | 1,004 | 35.09% |
| 3 | 10 | 9,571 | 52.34% | 32.92% | 5,623 | 829 | 29.46% |
| 4 | 10 | 9,204 | 59.28% | 34.54% | 7,735 | 789 | 28.67% |
| 5 | 10 | 10,047 | 51.76% | 41.76% | 7,170 | 880 | 30.80% |
| 6 | 10 | 10,572 | 52.91% | 37.32% | 7,487 | 989 | 37.62% |

## 3-hour robustness check

The 3-hour sample changes direction on several aggregate measures: success rate is 56.58% before versus 54.72% after; sampled fee total is 6,669,427,910 versus 7,352,368,306; median transaction CUs are 12,368 versus 7,735. This is evidence against calling the 60-minute fee or success-rate differences a stable boundary effect.

## What the ledger establishes

It establishes receipt outcomes, consumed CUs, cost units, fees, reconstructed native priority fees where the relevant Compute Budget instructions are present, and their sampled block-level distribution around the boundary. It also exposes meaningful variation across short chronological buckets that a single aggregate would hide.

## What it does not establish

It does not establish sender geography, network path, sender targeting, dropped traffic, end-to-end submission latency, application class, address identity, or why any measured dimension moved. Differences may reflect changing transaction mix, leaders, fee-market conditions, time-of-day, concurrent feature changes, or sample variation.

## Verdict

**INTERESTING — NEED MORE WINDOW.** The sample shows changes in ledger-visible execution mix and resource use, but the short-window fee and success movements do not persist in the same direction in the three-hour robustness check. This is not strong enough to send back publicly as a slot-time causal result.
