# Breadlines X-Ray v1 — execution case files

Research preview. This joins deterministic receipt interpretation, saved account context and optional application-observed traces. It does not submit transactions, collect new chain data, call a paid RPC, rank providers or make routing recommendations.

Release isolation: `receipt-parser.ts` pins the existing evidence helpers used by this research workspace. It is intentionally independent of pending edits to the production parser. The root TypeScript option `allowImportingTsExtensions` supports the research modules' existing Node-compatible imports; it does not change production receipt behavior.

For the recording sequence, see [the 75-second demo runbook](demo-runbook.md).

## Run and reproduce

The preview is isolated at `/research/xray` and requires `BREADLINES_XRAY_PREVIEW=1` in the server process. Without that flag both the page and evidence endpoint return 404. Existing homepage, production receipt logic and public API routes are unchanged. No deployment is part of this milestone.

From the repository root in PowerShell:

```powershell
node --experimental-strip-types scripts/execution-casefile-generate.ts
$env:BREADLINES_XRAY_PREVIEW='1'
npm run dev -- --webpack --hostname 127.0.0.1 --port 3210
```

Open `http://127.0.0.1:3210/research/xray`. The generator uses only saved research files. The generated library is sufficient to run the viewer; regeneration requires the original research artifacts.

```powershell
node --test --experimental-strip-types test/execution-casefile.test.ts test/execution-xray.test.ts test/execution-trace.test.ts test/receipt-evidence.test.ts
npx tsc --noEmit
```

## What is included

### v1.1 investigation workflow

- Cool graphite/cyan research theme and an interactive execution atlas. Projection encodes log-list position and call depth, not time. Rotation, flat fallback, keyboard-selectable calls and a step-through failure path all select the same exact log evidence. Graph rendering is bounded to the first 80 calls and explicitly labels truncation; the underlying list retains all calls. No Three.js/WebGL dependency or generated imagery is required for this evidence geometry.
- Explicit legacy/v0 JSON support. V1, unknown versions and configuration-bearing payloads are rejected before resource interpretation. The v1 gate covers both its undecoded resource configuration and the multiple state roots it may commit atomically; decoding the configuration alone does not lift it. An omitted version is labelled unspecified rather than silently declared legacy. This is safe unsupported handling, not implemented v1 decoding.
- Accounts and balances tab: per-account signer/writable flags, explicit outer account references, exact SOL conversion from lamport integers and raw token balance entries. Missing/unsafe values or missing/inconsistent token decimals remain unavailable. Missing pre/post token entries are not treated as zero; balance changes are not inner-call balances.
- Research-only priority derivation abstains for duplicate limit/price settings, unsafe arithmetic, limits outside the supported 1.4M bound or a derived amount exceeding the observed fee. Production receipt semantics and historical Episode calculations are unchanged. The new case-file parser version records this conservative guard.
- Versioned evidence bundles reopen locally. Receipt-derived explanations are recomputed rather than accepted from an export. Original receipt checksum, signature/slot and context consistency are checked. Saved neighboring records are supplied evidence, not authenticated chain truth. Original unversioned v1.0 exports are also accepted.
- Application traces are excluded from both JSON and report exports by default, with an explicit opt-in checkbox. No upload or browser persistence was added.
- Saved-case URLs use `?signature=...`, with back/forward navigation and a copy-link action. These URLs require access to the local preview; they are not public deployments and contain no imported evidence or sender traces.
- Intake remains saved cases plus local receipt/bundle import. There is deliberately no live RPC lookup, paid collection or automatic fetch on search.

The current tabs are **Execution**, **Accounts & balances**, **Neighbors**, and **Attempt history**. The real insufficient-lamports example remains the opening case. Select the failed System call in the atlas or list, inspect outer positions 3/4/6, then expand recovered transfer accounts. Its neighbor context and application trace remain unavailable.

- All 22 saved adversarial X-Ray cases, unchanged in selection and context window.
- The lexically first signature from the completed JTX insufficient-lamports anatomy, as a separate demonstration. Its neighboring context is unavailable; it is never presented as zero overlap.
- Per-invocation logs, named instructions when emitted, exact error codes and a terminal failure path. Parent and child error propagation is distinguished from caught earlier failures.
- One-based displayed outer positions and not-reached status derived from `meta.err.InstructionError`. Outer positions report how far execution got (`EXECUTED_NOT_COMMITTED`, `FAILED`, `NOT_REACHED`, `UNKNOWN`, or `COMMITTED`) separately from a `commitment` field, and every case carries a transaction-level `stateCommitment`. A failed transaction commits nothing but its fee, so a position reached before the rejection is never reported as completed. See [the atomic cross-root note](../transaction-v1-atomic-cross-root-v0.md).
- System transfer source/destination only when complete inner instructions align with log invocation frames by program/depth and the decoded amount agrees with the quantified rejection.
- Saved overlap relationships, coverage, missing telemetry, raw target receipt and JSON / Markdown exports.
- Receipt JSON import in the browser, with SHA-256 provenance; no server upload or RPC request. Input is `getTransaction` JSON, its `{result: ...}` wrapper, or a supported evidence bundle. Missing `meta.err` is rejected.
- Trace JSON attachment with schema/lineage/signature checks. A synthetic demo is kept separate and cannot be attached to an archival case.

## Evidence boundaries

“Receipt evidence” means the supplied RPC response records the fact. The viewer does not independently verify cluster consensus or authenticate imported JSON. Hashes identify the source object (`SHA-256(JSON.stringify(originalReceipt))`), not its truth. Parsed System instruction fields are RPC-decoded evidence, not a fresh program execution.

The archived corpus context comes from the saved Episode artifact, whose collector previously checked complete `getBlock` membership. Full neighboring raw receipts are not embedded in the new library; the export preserves the saved overlap records and source reference, and does not claim an independent rerun of context acquisition. Missing account metadata downgrades usable coverage. A count over incomplete context is a lower bound. Declared writable access does not prove an actual account write occurred.

The invocation parser checks frame nesting/closure and aligns the terminal outer program and custom code with `meta.err`. A deepest child is included in the terminal path only when its failed error matches the enclosing failed frame and it is the last child. This is a conservative propagation rule, not a proof of business cause. Truncated, inconsistent or missing paths retain unknown attribution. Program-emitted semantics reuse the existing receipt parser within the terminal frame; there is no new numeric error table.

Build output and raw evidence are not ground-truth labels. The 22 cases are adversarial calibration cases, not held-out evaluation data, and neither 23 cases nor successful fixture tests establish population coverage or customer demand.

## Application recorder

`trace.ts` exports `createTraceRecorder`, `validateTrace`, `summarizeTrace`, and `traceMatchesReceipt`. It is a source module for an opt-in integration, not a published npm package or hosted telemetry service. It adds no provider dependency and leaves transaction construction, signing, transmission, confirmation polling and persistence with the host application.

One attempt contains message revisions. Each revision binds one message hash and at most one signature. Repeated sends have distinct send IDs; rebuilt messages refer to the earlier revision. Several signatures may finalize, and all such results remain visible. Validity elapsing does not prove the transaction never landed. A deadline without a finalized observation remains unobserved, never dropped.

Every event has a local sequence, local elapsed milliseconds, a wall-clock observation timestamp and one explicit clock domain. The application must start a new clock domain after process restart; it must not merge server/provider clocks into elapsed time. Response duration is application-observed request duration, not leader arrival latency or exact execution time. Commitment is explicit for receipt observations. Provider acknowledgements in this format are application observations, not provider attestations.

The strict schema has no raw transaction bytes, keys, endpoint URLs, arbitrary response objects, exception text or arbitrary payload fields. Use stable non-secret provider labels and IDs. The recorder retains events in memory and returns a snapshot for host-managed export. The send wrapper calls the existing sender once, never retries, returns the sender result and rethrows its original failure. Recording/classification failures must not change the send outcome; successful sends return `telemetryError` if their trace could not be completed. Applications should also surface their own capture health and preserve rejected-send evidence. This is a prototype for bounded attempts (10,000 events maximum), not a durable production collector.

See `scripts/execution-trace-recorder-example.ts` for an executable no-network example. Real integration still requires an application's explicit opt-in, its existing send function, signature/message metadata and its commitment-aware receipt observations. There are no partner traces in this release.

## Next validation gate

Recruit 3–5 application engineers who already investigate execution incidents. Prepare an independently reviewed held-out set before sessions, including success, caught child failure, propagated failure, opaque errors and missing context. Do not reuse these UI demo cases as held-out cases.

Give equivalent tasks in counterbalanced order with the engineer's usual explorer/workflow and with Breadlines. Measure correct failing-layer identification, evidence-location time, unsupported causal conclusions, and whether they elect to reuse/export the report. Have reviewers adjudicate against raw evidence and exact program/version documentation. Publish sample size, case-selection bias and disagreements; do not imply significance from a handful of sessions. This session work requires people and is not claimed complete by the software build.

Only then expand toward a real opt-in trace integration. No live pressure scores, routing experiments, broad backfills or production rollout are authorized by this milestone.
