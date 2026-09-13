# Where does a V1 transaction's compute budget come from?

**Pre-registered probe protocol — v0**
**Declared:** 2026-09-11, before any data was collected.
**Status:** Protocol only. No transaction has been sent. No result is recorded here.

## Why now

Anza published that V1 mainnet moved to epoch 1035 (~15 Sep 2026 01:20 UTC), that V1 is on devnet
now, and that **Compute Budget instructions are a no-op on V1** — the budget lives in the new
transaction config.

That creates one specific way for a receipt to lie. `collectComputeBudget` reads Compute Budget
instructions and reports a limit and price. On a V1 transaction those instructions may still be
present in the message and still parse cleanly, while having had no effect on execution. A parser
that reads them reports a budget the runtime never applied, and every derived value — the priority
fee, the `feeResidualLamports`, the compute headroom — inherits that error silently.

## The failure this is looking for

Breadlines already fails closed on `version: 1` and on any payload carrying `transactionConfig` or
`config`. Those two guards are the current protection and they are strict.

**The hypothesis worth testing is the gap between them:** a node serving a V1 transaction in a shape
that trips neither guard — version absent, or reported as `0`/`legacy`, with no config key — while
the message still carries no-op Compute Budget instructions. In that case the existing parser does
not reject, reads the no-op instructions, and reports a budget that did not apply.

> **H1.** There exists at least one RPC response shape for a V1 transaction in which
> `normalizeReceipt` accepts the receipt and `collectComputeBudget` returns a non-null
> `computeUnitLimit` or `computeUnitPriceMicroLamports` sourced from instructions that did not
> govern execution.

H1 being false is a real and publishable result: it would mean the version guard alone is
sufficient, and no budget-source field is needed.

## Phase 1 — read-only (no send, no key, no spend)

Cluster: **devnet**, public endpoint `https://api.devnet.solana.com`. No Helius key, no paid RPC,
no mainnet call. Read-only `getBlock` / `getTransaction`.

Sample: walk back from the current devnet slot, take every transaction whose served `version` is
not `legacy`/`0`, up to 200 transactions or 500 blocks, whichever comes first. Selection is by slot
position only. No program, signer, success state, or fee influences inclusion.

For each sampled transaction record, verbatim as served:

| Column | Meaning |
| --- | --- |
| `servedVersion` | the `version` field exactly as returned, including absent |
| `configKeys` | any top-level or message key that looks like a transaction config, by exact name |
| `computeBudgetIxCount` | Compute Budget instructions present in the message |
| `parserDisposition` | `REJECTED_VERSION` / `REJECTED_CONFIG` / `ACCEPTED` |
| `budgetIfAccepted` | what `collectComputeBudget` returns when the receipt is accepted |
| `h1Triggered` | `ACCEPTED` **and** a non-null limit or price **and** ≥1 Compute Budget instruction |

Report: the count of sampled V1 transactions, the distinct served shapes, and every `h1Triggered`
row in full. If zero V1 transactions are found on devnet, report that and stop — do not widen the
window, change cluster, or substitute a mainnet sample.

## Phase 2 — A/B by construction (NOT AUTHORIZED YET)

Phase 1 observes whatever devnet happens to contain. It cannot guarantee both arms exist. The
controlled version is two V1 transactions from a throwaway devnet keypair:

- **Arm A:** V1 transaction carrying only Compute Budget instructions, no config budget.
- **Arm B:** V1 transaction carrying a config budget, no Compute Budget instructions.

Then compare what `getTransaction` returns for limit and price in each arm.

This requires **sending transactions**, which every other Breadlines research artifact explicitly
does not do. Devnet with a throwaway key costs nothing and touches no mainnet state, but it is a
deliberate departure from that standing rule and needs an explicit decision before it runs. It is
recorded here so the protocol is complete, not because it is approved.

## What this probe cannot establish

- What the runtime actually charged. The probe compares what an RPC **reports** against where the
  budget is **declared**. Proving the applied budget needs runtime or validator evidence.
- Anything about mainnet V1 before epoch 1035.
- That any particular node implementation is wrong. A shape that trips H1 is a parser hazard on
  Breadlines' side first; calling it an RPC defect needs the server's own documentation.
- Whether Compute Budget instructions are a no-op on V1. That is Anza's published statement and is
  taken as given here; this probe tests what receipts *look like*, not the runtime rule.

## Committed disposition if H1 holds

`ComputeUnitPriceStatus` already declares an `unknown` member that nothing currently emits. If H1
holds, that is the value to emit — budget source unresolved — rather than inheriting a no-op
instruction. A `budgetSource` field (`COMPUTE_BUDGET_IX` / `TRANSACTION_CONFIG` / `UNKNOWN`) is the
minimum honest representation, and no priority fee may be derived from an `UNKNOWN` source.
