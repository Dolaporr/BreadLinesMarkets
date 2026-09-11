# Phase 1 result — where a V1 transaction's budget is served

**Protocol:** [`preregistration.md`](preregistration.md), Phase 1 (read-only)
**Run:** 2026-09-11, `https://api.devnet.solana.com`, devnet tip slot 496,894,744
**Records:** [`phase1-records.json`](phase1-records.json) · [`raw-v1-receipt.json`](raw-v1-receipt.json)

## Coverage

500 of 500 declared blocks read. 0 absent, 0 refused, **100% read share**. 11,351 transactions
examined. This clears the 60% threshold the protocol requires before a null result is reportable.

An earlier unthrottled pass read only 18 of 500 blocks — the rest were rate-limited — and would
have reported a clean zero. That run is not a result and is not recorded as one; it is why the
probe now separates a node declining to answer from a block genuinely absent, and refuses to
report a null result below the coverage threshold.

## What was found

**One** non-legacy transaction in 11,351 — roughly 0.009% of sampled devnet traffic.

| Field | Value |
| --- | --- |
| Signature | `4Yo8X2HiMCTaCue1xuBy7EGJD2BgKuc6wKxYwJ8p62fXkmGGhWFzeAeQc3q7L2uwDtAqWkxfhuRDQmBAdgYbv55G` |
| Served `version` | `1` |
| Config location | `transaction.message.transactionConfig` |
| Compute Budget instructions | **0** |
| Breadlines disposition | `REJECTED_VERSION` (the version guard fired first) |

The served config, verbatim:

```json
{
  "computeUnitLimit": 1350000,
  "heapSize": 256000,
  "loadedAccountsDataSizeLimit": 2162688,
  "priorityFee": null
}
```

`meta.fee` was 5,000 lamports — exactly one signature at the base rate — and
`meta.computeUnitsConsumed` was 1,130,800 against the declared 1,350,000 limit.

## H1 was not observed, and was also not tested

The hypothesis was that a node might serve a V1 transaction in a shape tripping neither guard
(version absent or `0`, no config key) while no-op Compute Budget instructions remained in the
message, causing the parser to report a budget that never applied.

The verdict is `H1_NOT_OBSERVED_IN_DECLARED_WINDOW`, and that phrasing is doing real work. The one
V1 transaction observed **carried zero Compute Budget instructions**, so it could not have
triggered H1 under any parser behaviour. Phase 1 therefore does not disconfirm H1 — the hazardous
shape simply did not occur in organic devnet traffic. H1 remains untested.

This strengthens rather than weakens the case for Phase 2: the shape that matters (V1 carrying
Compute Budget instructions) is not something devnet is producing on its own, so observing it
requires constructing it.

## The larger finding: the budget shape itself differs

The no-op-instruction hazard was the question going in. The observed config raises a structurally
bigger one.

Breadlines derives a priority fee as `ceil(computeUnitLimit × computeUnitPriceMicroLamports / 1e6)`
from a **pair** of Compute Budget instructions — a limit and a per-compute-unit price. The observed
V1 config carries `computeUnitLimit` but has **no per-unit price field at all**. It has a single
`priorityFee`.

That is not a renamed field; it is a different shape, and the existing derivation has no defined
meaning against it. Two things follow:

1. `derivePriorityFeeLamports` must not be pointed at a V1 config. Porting it by field-name mapping
   would produce a number with no basis.
2. **The units of `priorityFee` are undetermined by this sample.** The observed value is `null`, so
   whether it denotes lamports outright or a rate needs a non-null sample or first-party
   documentation. Nothing here settles it, and no derivation should be written until it is settled.

`heapSize` and `loadedAccountsDataSizeLimit` have no representation in the current model either.

## Standing limits on this result

- **n = 1.** One transaction, one endpoint, one cluster, one moment. Nothing here establishes how
  other RPC implementations serve V1, which is precisely what H1 was about — a single endpoint
  cannot test cross-node variation.
- Field names are **observed, not documented**. Anza's specification governs; this is what one node
  returned.
- Nothing here establishes what the runtime charged, only what an RPC reported.
- Devnet V1 traffic at 0.009% of sampled transactions is too thin to characterise typical V1 usage,
  and no such characterisation is offered.
