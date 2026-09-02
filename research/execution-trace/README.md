# Breadlines Execution Trace v0

## Status

Research-only, provider-neutral lifecycle contract. This first version makes **no network calls**, uses no paid Helius product, sends no transaction, and changes no production Breadlines behavior.

It is designed to connect evidence an opt-in integrator already owns with the final, landed receipt Breadlines can reconstruct:

```text
attempt → build → simulation → signature → submit/retry → provider acknowledgement
        → optional early execution signal → final landed receipt
```

The contract does not claim that every stage is observable. Missing stages remain missing.

## What v0 proves

- A final RPC receipt with `meta.err` is a **landed failure**.
- A final RPC receipt without `meta.err` is a **landed success**.
- A blockhash expiry is recorded only when the observed block height exceeds the documented last-valid block height.
- A deadline without a final receipt is **unobserved by deadline**, never “dropped.”
- An optional early/preconfirmation signal is evidence that an execution provider observed local execution. It is **not** final landing evidence.

## What v0 does not prove

- Original network submission time from a ledger receipt.
- Whether an unobserved transaction was dropped, never broadcast, delayed, or not indexed.
- Provider quality, sender geography, routing quality, congestion causality, or a probability of landing.
- A semantic explanation for an undocumented custom program error.
- Any recommendation to change fees, route value, use a provider, or schedule transactions.

## Data contract

The deterministic reducer is at [`scripts/execution-trace-core.ts`](../../scripts/execution-trace-core.ts). Its events are deliberately small and provider-neutral:

- `ATTEMPT_CREATED`
- `MESSAGE_BUILT`
- `SIMULATION_COMPLETED`
- `SIGNATURE_CREATED`
- `SUBMISSION_ATTEMPTED`
- `SUBMISSION_ACKNOWLEDGED` / `SUBMISSION_REJECTED`
- `PRECONFIRMATION_OBSERVED` (optional)
- `FINAL_RECEIPT_OBSERVED`
- `BLOCKHASH_EXPIRED`
- `OBSERVATION_DEADLINE_REACHED`

Every event has a monotonically increasing local sequence number and an observed timestamp. The reducer never reorders events by timestamp because client, server, and provider clocks are not automatically comparable. A trace may contain only one signature and one final receipt event, so it can never silently join or choose between competing executions.

## Safety and privacy boundaries

The reducer rejects fields for raw signed transactions, private keys, secret keys, API keys, authorization headers, and provider URLs. An actual future integration should also provide tenant isolation, retention/deletion controls, encrypted storage, and auditable access controls before collecting any customer telemetry.

Public transaction signatures are supported once created. They are not equivalent to custody, but they are still execution telemetry and should be handled as customer data in a real integration.

## Helius relationship

Helius is an optional future source of early execution evidence, not a dependency of v0. No Helius plan, API key, preconfirmation subscription, Sender route, or paid credit is used here.

If a future opt-in test becomes affordable and authorised, a Helius `PRECONFIRMATION_OBSERVED` event can be joined to the final receipt while preserving this hard rule:

> Local leader execution is earlier evidence, not proof of final landing.

## Next validation steps

1. Run the deterministic fixtures in `test/execution-trace.test.ts`.
2. Validate the event contract against one local/mock lifecycle—no live transaction required.
3. If an integrator later supplies opt-in lifecycle events, measure trace completeness before making any product claim.
4. Only after high-quality traces exist should Breadlines consider a controlled, provider-neutral delivery comparison.
