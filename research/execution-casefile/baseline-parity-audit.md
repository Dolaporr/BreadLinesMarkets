# X-Ray v1: baseline parity audit and demo guide

Audit date: 2026-09-09. Scope: the local research workspace, not the separate production receipt page. This is a code/artifact and first-party documentation audit, not a measured competitive benchmark. No production changes, new collection, sends or deployment were performed.

Follow-up: the same-day v1.1 implementation addresses several gaps below. See [current capabilities](README.md#v11-investigation-workflow) and [updated validation](validation.md). This audit is retained as the pre-implementation snapshot; its tab numbers and bundle-import limitation describe that earlier version.

## Decision

The existing workspace is suitable for a guided internal demonstration. It is not yet ready to promise “paste any signature and investigate.” The most useful next work is version-safe decoding, readable accounts/balance changes, and a complete open-investigate-export-reopen workflow. A live pressure score, routing engine or larger visualization would not address those gaps.

The baseline is a transaction investigation workflow, not the union of everything explorers, RPC providers, schedulers and reservation services sell. Delivery infrastructure and validator telemetry are not prerequisites for a useful forensic tool.

## Comparison evidence

[Orb's first-party transaction guide](https://www.helius.dev/docs/orb/explore-transactions) documents signature lookup, summaries, fees, compute, balance changes, inner instructions, logs and raw JSON. These are sensible usability expectations; Breadlines cannot present logs or an invocation tree alone as a unique invention.

[svmScope's author documentation](https://docs.rs/svmscope/latest/svmscope/index.html) describes instruction-tree decoding, balance changes, compute attribution and local replay/mutation. This audit did not run it or verify its coverage. Replay is a specialist capability, not a launch requirement for Breadlines.

[Solana's transaction upgrade guide](https://solana.com/upgrades/larger-transaction-sizes) specifies v1 resource configuration in `transactionConfig`, rather than ComputeBudget instructions. The page currently labels mainnet activation pending; this is a documented compatibility requirement, not a finding that our archival demo is v1 or already misparsed.

No evidence here establishes that competitors lack evidence boundaries, cannot explain this failure, or would explain it incorrectly. That requires a side-by-side evaluation.

## Baseline capabilities and current gaps

| Capability | Current X-Ray | Gap / minimum useful action |
| --- | --- | --- |
| Open a signature | Searches 23 retained cases; arbitrary receipt JSON can be imported locally | No arbitrary-signature RPC lookup in this workspace. Either add a bounded opt-in lookup using an approved existing provider, or explicitly launch as an import-first preview. No payment is authorized. |
| Transaction formats | Parsed and compiled JSON, legacy headers and loaded-address resolution have tests | No explicit version dispatch/unsupported-version guard; no v1 `transactionConfig` support. Guard unsupported versions before displaying resource conclusions, then add version-specific fixtures and parsing. |
| Execution path | Nested log frames, selected-frame exact logs, terminal failure path, outer instruction status | Good internal-demo foundation. Log-derived names are not a broad instruction decoder. Truncated paths must remain incomplete; expand tests, not speculative names. |
| Failure propagation | Checks `meta.err`, terminal frame/code and caught-versus-propagated child failures; later outer instructions marked not reached | Independently review held-out cases, including repeated programs and handled child errors. Do not treat structural matching as proof of business cause. |
| Fees and compute | Total fee, consumed CU, instruction-derived limit/price, conditional priority derivation | Explicit resource-source/version display and boundary fixtures. Do not manufacture an effective limit or priority fee when evidence is insufficient. |
| Programs and accounts | Program IDs, signers, writable count, raw account metadata; uniquely recovered System transfer for the demo | Add a readable account list with signer/writable flags and instruction references. A count plus a raw JSON dump is cumbersome. Unknown names remain addresses. |
| Balances | Original balance fields retained in raw receipt | Add exact pre/post SOL and token balance changes when supplied. Handle missing fields, decimals and account creation/closure. Distinguish attempted transfers from committed changes and fee debits. |
| Exact evidence | Numbered logs, raw receipt, source reference, source-object hash and parser version | Hashes identify supplied data; they do not authenticate the RPC or prove consensus. Keep this boundary visible in exports. |
| Neighbor context | Saved overlap records and explicit complete/partial/unavailable coverage | Not collected for arbitrary imports. Full neighboring raw receipts are not embedded. Declared writable overlap is not proof of writes, contention or timing. |
| Share/export | JSON evidence download and Markdown copy/download | Exported case-file bundles cannot currently be reimported through receipt import. Case selection is not encoded in a stable page URL. Add validated round-trip import and deterministic selection links before claiming shareable investigations. Private traces must not become public implicitly. |
| Integration | Source-level trace recorder, validation, attachment and no-network example | Not a published SDK or durable service. No real app integration yet. A documented local interface is enough for the first opted-in engineer; a hosted API is not a prerequisite. |
| Unsupported data | Missing execution metadata rejected; opaque errors and unavailable context preserved | Version handling and clearer actionable import errors remain gaps. Never silently treat unsupported input as supported. |
| Speed and usability | Local page returns HTTP 200; saved-case endpoint checks passed previously | No measured browser interaction, accessibility, mobile readability or investigation-speed benchmark. HTTP success is not UI validation. |
| Real examples | 23 retained cases, including the real DFlow/System demonstration | Calibration examples are not a representative population or held-out quality benchmark. Do not claim broad coverage from their count. |

Source inspection: `core.ts`, `trace.ts`, `README.md`, `validation.md`, `../../app/research/xray/workspace.tsx`, the generated case library and `../../test/execution-casefile.test.ts`.

## Breadlines-specific direction

Preserve one case file linking receipt evidence, optional application-recorded revisions/sends, multiple signatures, source provenance and unanswered questions. Keep application observations separate from provider attestations. Acknowledgement is not landing; elapsed blockhash validity does not establish never landed; repeated sends do not establish intent.

The software supports this direction, but there are no real sender traces in this release. The illustrative trace is explicitly synthetic and cannot attach to the archival case. Breadlines has not yet demonstrated superior explanation accuracy, faster investigation or customer demand.

Do not copy token price/portfolio surfaces, trading widgets, indiscriminate AI narratives, a universal protocol decoder, BPF replay/profiling, transaction delivery, or execution reservations for parity. Do not add contention percentiles or routing recommendations without suitable evidence and validation. Three-dimensional rendering is not a launch requirement.

## Guided real-case demonstration

On the machine running the preview, open `http://127.0.0.1:3210/research/xray`. It responded HTTP 200 during this audit. This is a local address, not a public phone-accessible deployment. The first case is:

`1uv4TZhkQrUgJhAxSK2KD8qpXRF2yVsi4NQkx5hnb7kitnquYRW6zkDW7DVv7ofYEm6GDH4J33HiSK57nNcESyz`

Landed slot: **439425407**. Original evidence is reused from the completed insufficient-lamports anatomy; no new transaction was fetched. The signature arrow opens an external explorer for independent inspection.

1. In **01 / Execution**, select the failed System Program invocation at depth 2 beneath DFlow. The DFlow frame includes the emitted instruction name `WrapSol`. The observed terminal path is DFlow → System.
2. Under **Outer instruction positions**, position 3 is failed DFlow. Positions 4 and 6 contain JTX and are **not reached**. The display is one-based. Prior completed instructions do not imply committed state in a failed transaction.
3. In the **Evidence drawer**, inspect log 25: `Transfer: insufficient lamports 1466356792, need 3915945163`. The log gives available 1,466,356,792 and requested 3,915,945,163 lamports. Their derived difference is 2,449,588,371 lamports. **All logs** shows surrounding calls and propagated failure.
4. Expand **Recovered transfer accounts**. Source: `23zyeKyn8wpF8VyWSGHTGvTVEGi5SPyziGSs9pGKr5ta`. Destination: `4cPb3ieD57pgrNvsLYPrvXGzSQzeedAR286pDbrbufJh`. Recovery uses RPC-parsed transfer fields, complete program/depth alignment and agreement with the logged amount; it does not infer ownership or user intent.
5. Read the missing-telemetry questions. Submission time, leader receipt and whether another delivery path would help are not established. **02 / Account context** is unavailable for this case, not zero overlap. **03 / Attempt history** has no real attached trace. Do not narrate the synthetic demo as this transaction's history.
6. Use **Copy report** for a text explanation and **Evidence** for the supporting case-file bundle. For now, keep the original receipt separately if you need to reimport it; bundle round-trip import is not implemented.

The public-safe demonstration sentence is: “This transaction contains JTX instructions, but execution stopped in DFlow → System before those JTX instructions were reached. The log quantifies the insufficient transfer. The evidence does not establish submission timing, provider fault or user intent.”

## Minimal table stakes before public launch

- [ ] Explicit supported-version contract; safe rejection/partial handling for everything else; resource-source and priority-fee tests. Either implement v1 correctly or label it unsupported.
- [ ] Honest intake: working bounded signature lookup, or clearly labelled import-only scope; loading/failure/malformed-input cases exercised.
- [ ] Readable full account flags and supplied balance changes, with failed-transaction rollback/fee distinctions.
- [ ] Evidence export can be reopened; saved-case selection survives a link/reload. Sender traces remain opt-in and local/private by default.
- [ ] Desktop/mobile/keyboard walkthrough passes the five questions: what happened, where, evidence, unknowns, and any captured attempt history. Record load-to-evidence timing and repeated-case-switch behavior.
- [ ] Held-out correctness review spanning success, caught/propagated failures, opaque errors, missing logs/accounts and supported formats. Preserve source provenance and document disagreements.

Prior validation recorded 40/40 automated tests, full TypeScript compilation and production build passing. They were not rerun for this documentation-only audit and do not substitute for the outstanding browser and independent review gates. No production files were changed by this audit.
