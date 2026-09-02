# Breadlines Execution X-Ray v0

## Status

Research-only evidence map for **one landed Solana transaction**. It transforms a target receipt and a declared, bounded block-context sample into auditable facts. It makes no RPC calls, spends no Helius credits, changes no production UI or API, and does not send transactions.

The deterministic reducer is at [`scripts/execution-xray-core.ts`](../../scripts/execution-xray-core.ts), with fixtures in [`test/execution-xray.test.ts`](../../test/execution-xray.test.ts).

Each X-Ray can then be reduced into a comparable [`ExecutionEpisode`](../../scripts/execution-episode-core.ts): A/B/unknown evidence claims, a raw `BL-XR-v0` fingerprint, and a list of telemetry that would be needed to answer its unresolved questions. The fixed adversarial-corpus contract is in [`corpus-protocol-v0.md`](corpus-protocol-v0.md).

## The useful, defensible first question

> What did the landed receipt prove, and which transactions in a declared nearby ledger context shared the target's writable accounts?

That is narrower than “what happened around you?” but it is real. The target result can be tied to its final execution frame; nearby account overlap can be shown without inventing identities or a story about causality.

## What v0 shows

- Target signature, landed slot, and final success/failure state.
- Deterministic failure evidence and a plain-language headline where the logs establish one.
- Fee, Compute Budget settings, consumed compute units, and a priority fee only when it is reconstructable.
- Target outer-program IDs.
- Writable accounts exposed by the target receipt, where the RPC supplied writable metadata.
- Context transactions from a declared slot range that share one or more of those writable accounts.
- Recurrence of public signer addresses among those overlapping context records, without naming an identity or actor class.
- Earlier/later **slot** relation and, if supplied, earlier/later **position in the RPC block transaction list**.
- Explicit `COMPLETE`, `PARTIAL`, or `UNAVAILABLE` context coverage.

## What v0 refuses to say

- “You attempted this at slot X.” A slot proves landing, not original attempt time.
- “327ms before you” or any per-transaction elapsed time. Standard ledger block time is not that clock.
- “Bot A,” “competitor,” “front-runner,” “liquidity changed,” or “someone took your opportunity.”
- “The shared account activity caused your transaction to fail.”
- “Your transaction would have landed through another provider, fee, scheduler, or route.”
- A priority percentile, a landing probability, an avoidability verdict, or a recommendation to execute.

## Why this is the first build

The viral X-Ray concept is compelling because it turns a signature into a story. The failure mode is turning a receipt into a story the ledger never proved. v0 earns the right to grow by showing the evidence map first and attaching a prohibited-claims list to every result.

For a public demo, the report must label its context population honestly:

- **Complete same-block context:** all transactions returned by a verified `getBlock` response for the target slot.
- **Partial nearby context:** sampled transactions from neighbouring slots; all counts are “at least.”
- **Unavailable context:** do not imply that zero observed overlap means no overlap existed.

## Gates to a stronger X-Ray

| Proposed future claim | What would be required |
| --- | --- |
| A particular pool/account state changed | Deterministic program-specific account-role decoding plus observed before/after state evidence. |
| A transaction was submitted earlier/later | Opt-in sender/provider trace with clock discipline. |
| Another transaction caused the target outcome | A concrete transaction-level state dependency established by program evidence or a controlled replay; shared writable accounts alone are insufficient. |
| A different route/fee/provider would have changed the outcome | Pre-registered controlled delivery experiments or a validated model with uncertainty. |
| Live “execution weather” | Complete, low-latency, scope-labelled live observation plus validation that the measurement remains stable. |

This is the path from **receipt evidence → X-Ray evidence map → opt-in execution trace → controlled experiments**. It is not yet a router, a forecast, or a control plane.
