# Neutral Pump.fun to PumpSwap Graduation Universe Audit

- Locked window: 2025-09-01T00:00:00.000Z through 2025-09-15T23:59:59.000Z inclusive.
- Primary source: Helius archival RPC `getTransactionsForAddress`, full JSON-parsed finalized results, ascending, succeeded only.
- Migration authority queried: `39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg`.
- Methodology: `pump-migration-authority-universe-v1`.

## Counts

- Total unique migration-authority transactions scanned: 48321.
- Successful Pump migrate instructions found: 4663.
- Actual PumpSwap CreatePool migrations decoded before cohort deduplication: 2508.
- Successful idempotent/no-op migrations excluded: 2155.
- Malformed migrate layouts excluded: 0.
- Duplicates removed: 0 (signature 0, mint 0, pool 0).
- Final cohort size: 2508.

## Pagination and retrieval

- Completed pages: 50.
- Logged retry events: 1.
- Page boundaries monotonic: true.
- Pagination overlaps observed and deterministically deduplicated: 0.
- Opening/closing boundary verification: [{"window":"opening-minute","startUtc":"2025-09-01T00:00:00.000Z","endExclusiveUtc":"2025-09-01T00:01:00.000Z","pagesExhausted":2,"transactionsScanned":2,"decodedGraduations":1,"allPresentInUniverse":true},{"window":"closing-minute","startUtc":"2025-09-15T23:59:00.000Z","endExclusiveUtc":"2025-09-16T00:00:00.000Z","pagesExhausted":1,"transactionsScanned":0,"decodedGraduations":0,"allPresentInUniverse":true}].
- Explicit retry/error log: `research/market-structure/token-universe-fetch-errors.jsonl`.
- Resume checkpoint: `research/market-structure/token-universe-backfill.checkpoint.json`.

## Authority-consistency audit

- Retained migrations using the documented authority: 2508/2508.
- Retained migrations naming the documented PumpSwap program in the official Pump migrate layout: 2508/2508.
- Calendar days in the locked 15-day window with at least one deterministically decoded migration using the documented authority: 15/15.
- Every retained graduation is a successful Pump migrate whose IDL relation account equals the queried authority and whose CPI creates a PumpSwap pool. This proves authority validity at every retained migration; it cannot by itself prove that no undocumented alternate authority was briefly configured between observed migrations.

## Range

- Earliest retained graduation: `3s7Y6aztCy7jXpRhDhK7GCs9pTDSNdAumDcDe5Gpd9ccTu2w4pNsqgG5A6B9wz7YchPihdmBE3uioaDp6mPz3HS6` at slot 363833438, 2025-09-01T00:00:15.000Z.
- Latest retained graduation: `2vWJc7vQPorMWpXYN7Fckozw4J84NRNDEavhp4HUhZrAz4MZyEBNfXuGXzvQU9FL2FPfBNoTLWMSTm6SPBNVV2r8` at slot 367088954, 2025-09-15T23:53:43.000Z.

## False-negative uncertainty

The archival stream and boundary checks were complete for the queried authority. The remaining structural uncertainty is an undocumented temporary change to the Pump Global withdraw authority: the retained on-chain instructions prove the documented authority was valid whenever a graduation was observed, but an address-indexed query cannot discover migrations performed under an unknown alternate authority. No token outcomes or post-graduation market data were consulted. Current pool ownership was not used for inclusion.
