# Phase 2 — blocked on tooling, not on funding or permission

**Protocol:** [`preregistration.md`](preregistration.md), Phase 2
**Attempted:** 2026-09-12, devnet
**Script:** [`scripts/v1-budget-phase2.ts`](../../scripts/v1-budget-phase2.ts) (written, typechecked, gated)
**Status:** Cannot run. No transaction was sent.

## The arms

Phase 1 found V1 on devnet but in a shape that could not test the hypothesis: the single organic V1
transaction carried zero Compute Budget instructions. Arm A is exactly the missing shape.

- **Arm A** — V1, Compute Budget instructions only, `transactionConfig` all null.
- **Arm B** — V1, `transactionConfig` budget set, no Compute Budget instructions.

Both carry the same trivial payload, a 0-lamport self transfer, so the only difference between them
is where the budget is declared.

## Why it cannot run

`@solana/web3.js@1.99.0` (published 2026-09-08) **deserializes** V1 but cannot **serialize** it:

```
MessageV1.serialize() → Error: Serialization of version 1 transaction messages is not supported
```

That is an unconditional throw in the released build, not a configuration or feature flag. V1
support in the SDK is read-only: enough to parse a V1 receipt returned by `getTransaction`, which
is how Phase 1 read one, and not enough to construct one. `@solana/kit@8.3.0` shows no V1
serialization either.

So neither arm can be built, by this script or any other consumer of the released SDK. The gate is
tooling, and it sits upstream of everything else.

A second, separate blocker was also hit: the public devnet faucet refused every airdrop with
`429 — You've either reached your airdrop limit today or the airdrop faucet has run dry`. That one
is transient and routable — the script now accepts a caller-supplied funded devnet key via
`BREADLINES_PHASE2_SECRET_KEY` — but it does not matter while serialization is unavailable.

The script checks serialization support **before** touching the network, so a faucet failure can
never be mistaken for the real blocker. It exits 3 when construction is impossible and 4 when
funding fails, and sends nothing in either case.

## What this does and does not establish

**Does:** as of 2026-09-12, three days before V1 is scheduled to reach mainnet at epoch 1035, the
current released Solana JavaScript SDK can read a V1 transaction but cannot build one. Anything
that needs to construct V1 — a test, a probe, a wallet, an integration — has no released path in
JavaScript.

**Does not:** say anything about the Rust SDK, about unreleased or canary builds, or about whether
construction is available through another toolchain. Only the two published JavaScript packages
were checked, at the versions named. It also does not establish that V1 mainnet timing is at risk;
client tooling and runtime readiness are different things.

**H1 remains untested.** Phase 1 could not test it because organic devnet traffic did not produce
the shape. Phase 2 cannot test it because the shape cannot be constructed. The hypothesis — that a
V1 receipt could pass both guards and still yield a budget read from no-op Compute Budget
instructions — is open, and the parser hazard it describes is unresolved.

## What would unblock it

1. An SDK release that serializes a V1 message, or
2. a hand-rolled V1 wire encoder, which needs the V1 message format specified rather than inferred —
   guessing the encoding produces a malformed transaction, and a node rejecting it would say
   nothing about the hypothesis, or
3. an organically occurring V1 transaction that carries Compute Budget instructions, which Phase 1
   can detect if it appears: re-running the Phase 1 probe costs nothing and needs no funding.

Option 3 is the cheapest standing watch and requires no new capability. Options 1 and 2 are both
upstream of Breadlines.
