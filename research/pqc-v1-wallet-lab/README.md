# Breadlines PQC / Transaction v1 wallet lab

**EXPERIMENTAL RESEARCH. Not a wallet, custody system, deployment, or security certification.**

Start with [results.md](results.md). The question is whether application-level PQ authorization fits and can be verified, not whether Solana's native signature scheme can be replaced.

## Result in one sentence

With registered keys, real ML-DSA-44/65 authorization signatures fit the measured v1 envelope individually, but **none of the tested two-signature subsets fit**; all three schemes verify on the host, while Solana-target compilation/execution and CU remain unmeasured because this machine lacks the toolchain.

## Reproduce offline

Use Node 24.15.0 / OpenSSL 3.5.5 or a compatible build supporting all three signature algorithms. From this directory:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm run environment
npm run benchmark
npm test
```

The install needs public npm access; tests and benchmark are offline. `npm run environment` preserves an existing dated RPC observation and does not refresh it. Only the explicit `npm run environment:rpc` command uses the free public mainnet endpoint, for read-only node/epoch/feature/block-time queries. It never sends, simulates, requests funds or uses Helius. Do not equate a retained RPC snapshot with a fresh check.

Benchmark regeneration replaces generated public fixtures/results. Random keys/signatures and wall-clock timings will change; deterministic payload lengths, byte formulas and fitting subsets must not. No private key is saved. Persisted native signatures use an inert blockhash and undeployed program address: do not submit them.

## Files

- [methodology.md](methodology.md): fixed layouts, evidence labels, gates and sources.
- [benchmark.json](benchmark.json), [scheme-matrix.json](scheme-matrix.json), [size-table.md](size-table.md): measured envelopes and host cryptography; derived threshold combinations.
- [environment.json](environment.json): installed tools and dated read-only feature observation.
- [verifier-candidates.json](verifier-candidates.json): Rust candidates, exact versions/licenses and honest blockers.
- `src/protocol.mjs`: canonical authorization encoding.
- `src/envelope.mjs`: actual Solana Kit serialization plus independent byte formulas.
- `src/verifier.mjs`: actual OpenSSL host crypto; on-chain entry deliberately refuses.
- `src/policy-reference.mjs`: **host test oracle only** for threshold, replay and rotation semantics. Its rotation helper does not authorize a real management operation.
- `scripts/benchmark.mjs`: real public cryptographic fixtures, native envelope signatures, tables and JSON.
- `tests/lab.test.mjs`: 19 tests including crypto-negative cases, replay, rotation, byte boundaries, config and evidence consistency.
- `evidence/`: public keys, messages, PQ signatures and serialized envelopes. All synthetic, never funded or submitted.

There is deliberately no `program/` directory. The compute gate was not reached. `initialize_wallet`, `add_signer`, `disable_signer`, `rotate_signer_scheme` and `execute` are **not on-chain implementations**. A host policy test is not completion of those operations.

Everything is isolated under this directory. No production routes, X-Ray files, root package manifests, existing research methodology or deployment settings are changed. No branch merge or deployment is performed.
