# Breadlines Delivery-Path Probe — Preregistration

**Version:** 1.0  
**Date committed:** 2026-09-05  
**Status:** Preregistered before any study transaction is sent. This file is not to be edited after commit. Any later design change requires a new, separately dated preregistration.

## Question

Do delivery paths differ in landed outcomes for functionally identical Breadlines-controlled transactions, and, if so, under what predefined network conditions?

This is explicitly **not** a claim about delivery-path quality in general. It is a bounded comparison of this study's transactions, payload, sender location, connection, configuration, and observation rule.

## Paths

The four delivery paths are:

1. **Axiom**
2. **Nozomi**
3. **Jito BAM**
4. **Direct TPU** — the baseline/control because it is the stated recommended path for this study.

Each adapter must accept the same serialized, signed transaction without adding a path-specific instruction, tip transfer, bundle rule, or transaction mutation. A path that cannot meet that condition is recorded as **UNAVAILABLE UNDER PREREGISTERED DESIGN**; its allocation is not reassigned and no substitute path is introduced.

## Fixed design

The study target is **200 eligible transactions per path, per fee tier, per network-condition window**: 4 paths × 2 fee tiers × 3 conditions × 200 = **4,800 eligible transactions**.

### Transaction equivalence

Every eligible transaction uses the same harmless System Program transfer instruction, the same transfer amount, the same signer/fee payer, and the same Compute Budget limit. The fee tier is the only planned economic treatment.

Independent trials cannot use the same signed bytes: a duplicate signature broadcast through multiple paths would share one ledger outcome, rather than measure two path attempts. Therefore each trial uses a fresh recent blockhash and a unique, inert Memo program trial identifier. These uniqueness fields are not considered a payload treatment. No route, swap, token, price-sensitive state, or third-party application instruction is used.

### Fee tiers

Both values are fixed for the entire study and expressed as micro-lamports per compute unit:

| Tier | Fixed compute-unit price |
| --- | ---: |
| Market-rate reference | **10,000 micro-lamports/CU** |
| Deliberately underpriced | **500 micro-lamports/CU** |

The fixed reference tier is called “market-rate” only as a predeclared reference price for this experiment. It does not claim to equal a live market recommendation at every moment of collection.

### Interleaving and assignment

Eligible sends are assigned in a deterministic round-robin schedule over paths within each fee tier and condition. The scheduler must not wait for a path's prior result before attempting the next assigned path. Paths are never blocked because another path was slower, unavailable, or had an adverse outcome.

### Compute budget

The Compute Budget instructions, including unit limit, are identical within and across paths. The only intended difference between the two fee tiers is the fixed compute-unit price above.

## Windows and network conditions

Collection uses the same UTC clock hours on each collection day: **13:00–16:00 UTC**, for a minimum of **five calendar days**.

Every condition receives the same target allocation. Conditions are classified before an eligible send from the predeclared public priority-fee observation recorded immediately before scheduling the trial:

| Condition | Classification rule |
| --- | --- |
| Quiet | observed 75th-percentile priority fee is below 5,000 micro-lamports/CU |
| Active | observed 75th-percentile priority fee is at least 5,000 and below 25,000 micro-lamports/CU |
| Congested | observed 75th-percentile priority fee is **at least 25,000 micro-lamports/CU** |

The congestion threshold is therefore **25,000 micro-lamports/CU at the observed 75th percentile**. The fee-observation source, timestamp, returned values, and calculation version are retained with each trial. A window is classified before its sends; it is not reclassified after outcomes are known.

## Landed observation

Finalized commitment is the only landed observation. Each send is checked once at a fixed **90-second delay** after the send attempt is recorded. The recorded outcome is one of:

- `LANDED_SUCCESS` — finalized transaction with no `meta.err`;
- `LANDED_FAILURE` — finalized transaction with `meta.err`;
- `NOT_FINALIZED_AT_90_SECONDS` — no finalized receipt at that fixed check.

`NOT_FINALIZED_AT_90_SECONDS` is an observation-state label, not evidence that a transaction was dropped, censored, rejected by a path, or never landed later.

## Disqualification

Disqualification applies to a whole scheduled window, never to individual transactions because of their outcome. A window is disqualified only when one of the following is contemporaneously recorded:

1. a public network-incident or degraded-cluster announcement;
2. a client-side error before submission completed;
3. blockhash expiry before submission completed; or
4. wallet-balance or nonce interference.

An adapter that fails the path-equivalence rule is unavailable under this design, rather than a reason to alter individual transaction payloads. Its scheduled observations remain unavailable; the study does not silently substitute another method.

## Stopping rule

Stop each cell at **N = 200 eligible transactions per path, per fee tier, per network-condition window**. There is no extension, top-up, rerun of a window that appears anomalous, replacement based on outcome, or post-hoc expansion of a cell.

The study ends when every feasible preregistered cell has reached its target or the minimum five-day collection period has ended with the incomplete cells reported as incomplete. Results are not used to alter fee values, hours, thresholds, payload, or allocation.

## Planned reporting

For each preregistered cell, report attempted count, eligible count, the three finalized-observation states, timing records, adapter availability, and all disqualified windows. Any comparison is descriptive unless a later analysis plan is preregistered separately.

## What this study cannot claim

These are Breadlines-controlled transactions from one location and connection. The study cannot make a general statement about path performance, a claim about anyone else's flow, or a causal explanation of any observed difference.

It does not trace third-party transactions end to end, infer dropped traffic, see provider-side ingress/queue/leader arrival, identify sender geography beyond the study environment, or establish why a transaction did or did not land. It does not evaluate trading execution, value extraction, or economic route quality.

## Integrity record

No study send is authorized by this preregistration alone. The implementation must write immutable trial records and preserve raw adapter responses, timestamps, serialized-transaction hashes, fee observations, and finalized receipt lookups. The first data-collection commit must cite this commit hash.
