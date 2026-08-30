# Methodology integrity audit — epoch 1024 slot-time study

Status: **expanded study paused**. This audit precedes any further collection or interpretation.

## Authoritative boundary

Fresh Helius RPC evidence establishes one boundary only:

- `getEpochSchedule`: `firstNormalEpoch=0`, `firstNormalSlot=0`, `slotsPerEpoch=432,000`, `warmup=false`.
- `floor(442,367,999 / 432,000) = 1023`; `floor(442,368,000 / 432,000) = 1024`.
- `getBlockTime(442367999) = 1787930703` and `getBlockTime(442368000) = 1787930703`.
- Unix time `1787930703` is **2026-08-28T15:25:03.000Z**.

The authoritative epoch-transition point is therefore **slot 442,368,000 at 2026-08-28T15:25:03.000Z**. The apparent `19:25:03Z` value was a status-message presentation error. It does not appear in the collector, checkpoint, analysis JSON, Markdown reports, sample slots, or bucket labels.

## Exact unbuffered windows and selected-block spans

All end times are exclusive. The sampled span is the exact earliest-to-latest selected block evidence inside each declared window; it is not a claim that every intervening block was collected.

| Side | Declared wall-clock window | Selected blocks | Exact selected slot span | Exact selected block-time span |
| --- | --- | ---: | --- | --- |
| 60m before | [2026-08-28T14:25:03Z, 2026-08-28T15:25:03Z) | 60 | 442,358,299–442,367,918 | 2026-08-28T14:25:33Z–15:24:33Z |
| 60m after | [2026-08-28T15:25:03Z, 2026-08-28T16:25:03Z) | 60 | 442,368,093–442,379,107 | 2026-08-28T15:25:33Z–16:24:33Z |
| 3h before | [2026-08-28T12:25:03Z, 2026-08-28T15:25:03Z) | 180 | 442,338,673–442,367,918 | 2026-08-28T12:25:32Z–15:24:33Z |
| 3h after | [2026-08-28T15:25:03Z, 2026-08-28T18:25:03Z) | 180 | 442,368,093–442,401,544 | 2026-08-28T15:25:33Z–18:24:33Z |

The collector obtains `boundaryTime` directly from `getBlockTime(442368000)`, derives all four wall-clock limits from that value, deterministically selects evenly ranked landed blocks, and derives bucket labels from that same value. `analysis.json` and the prior report use the same `15:25:03Z` boundaries. No prior metric used `19:25:03Z`; no re-run of the completed 60-minute or 3-hour evidence is required.

## Vote and failure sanity check

Vote-only exclusion is deterministic: an outer transaction is excluded only if it contains at least one Vote-program instruction and every outer instruction is either Vote or Compute Budget. Every other parseable landed transaction remains in the non-vote population. A landed failure is only a retained transaction with `meta.err != null`.

A fixed, evenly ranked 20-block audit sample (10 blocks from each completed 60-minute side) was re-fetched from Helius. Its recomputed counts matched the saved checkpoint for all 20 blocks exactly:

- 20,198 retained non-vote transactions; 10,666 successes; 9,532 `meta.err` failures (47.19%).
- Zero transaction-message parse-unknown records in the audit sample; the completed 1h and 3h aggregate outputs also record zero parse-unknown records.
- Coarse receipt error categories: 9,530/9,532 (99.98%) were `InstructionError`; one was `InsufficientFundsForRent`; one had an atypical error shape.
- Coarse outer-instruction-context counts are retained only in the internal audit evidence. They are not included in any publishable report because an outer context is not a failing CPI frame or an attribution of responsibility.

This check finds no vote-only contamination or receipt-status misclassification that would explain the high landed non-vote failure rate. It does not, by itself, explain the underlying mix of instruction failures.

Both slots immediately around the epoch boundary resolve to the same estimated `blockTime` second. The exact epoch/slot boundary is established, but that pair does not resolve a sub-second wall-clock instant.

## Buffer pre-registration

The completed results remain the originally declared **unbuffered** comparisons. Before inspecting any buffered results, the extension is now fixed to a **10-minute buffer on each side of the boundary**:

- Unbuffered duration `d`: `[boundary - d, boundary)` versus `[boundary, boundary + d)`.
- Buffered duration `d`: `[boundary - d, boundary - 10m)` versus `[boundary + 10m, boundary + d)`.

The 20-minute central interval is excluded; each retained side remains equal in wall-clock length. No buffered blocks have been selected or analyzed while the study is paused.

## Metadata correction

The raw checkpoint contains an obsolete capacity-denominator note of 52.5M/45M CUs. It does not affect transaction selection or any raw CU/fee/count evidence. The completed `analysis.json` and `final-report.md` use the corrected, documented 87.5M/75M denominators (the active 100M baseline scaled by the 350ms/300ms target ratio). This audit records the discrepancy explicitly so the raw checkpoint is not mistaken for final methodology text.

## Outcome

**Timestamp integrity: passed.** The correct boundary is `15:25:03Z`; the completed unbuffered 1h and 3h results are valid on their stated time windows. The expanded 6h/12h/24h collection remains paused pending authorization to resume with this audit and the pre-registered buffered variant.
