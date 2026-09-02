# JTX execution study — chain-only Phase 2

## Frozen sampling contract

- Confirmed inclusion fingerprint: `JTXJTXfr1wVRMEzqiPhXUr69zJtfGuLh5qEiXG772Zj` in an **outer** instruction.
- Fixed observation interval: `2026-08-15T05:30:41.000Z` through `2026-08-15T14:46:32.982Z`.
- Deterministic order: Helius address-history pages descending from the fixed end; retain the first 500 local outer-JTX matches; write the retained sample ascending chronologically.
- No success, error, signer, fee, route, token, order-type, or behavioural filter was used.

## Population

| Measure | Value |
| --- | ---: |
| Retained outer-JTX executions | 500 |
| Successful | 333 |
| Landed-but-failed | 167 |
| Failure rate | 33.40% |
| Documented actionable failures | 159 |
| Documented technical failures | 1 |
| Insufficient evidence | 7 |
| Useful deterministic evidence beyond generic/raw-custom state | 159 / 167 (95.21%) |

The useful-evidence numerator is deliberately the `DOCUMENTED_ACTIONABLE` subset. A named but semantically undecoded custom error is kept in `DOCUMENTED_TECHNICAL`, not counted as useful plain-language evidence.

## Failure ecology and execution resources

- Failing program frames: System Program 159; JTX 7; DFlow 1.
- Documented classes: `InsufficientLamports` 159; custom error `15001` 1. The remaining seven failures carried no reliable human-readable program error.
- Fees paid by failed transactions: 1,831,403 lamports total; p50 10,000; p95 10,000.
- CU consumed, successful: p50 74,066; p95 269,500. Failed: p50 22,079; p95 22,079.
- Eight fee-payer addresses recur in this bounded sample; the largest recurrence count is 274. This is an execution-pattern observation only and is not an identity or bot attribution.

## Method and provenance

- Five Helius `getTransactionsForAddress` full-result pages were read. The requested billing assumption is 50 credits per page, yielding an estimated 250 credits.
- All 500 retained rows locally contain at least one outer JTX instruction. No address-query result that lacked this condition was retained.
- The machine-readable sample preserves raw logs, observed program stack, outer programs, exact failure logs, failing frame where available, and receipt-evidence classification. Representative failures use one lexicographically earliest signature per deterministic category/class/failing-program group.

## Scope boundary

On-chain evidence does **not** establish what JTX currently shows users. JTX UI visibility remains **UNKNOWN**. This study makes no claim that JTX caused a failure unless its failing invocation frame is JTX itself.
