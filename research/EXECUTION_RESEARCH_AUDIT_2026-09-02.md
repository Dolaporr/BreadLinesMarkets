# Breadlines Research Audit

**Snapshot date:** 2026-09-02
**Purpose:** One honest view of what Breadlines has completed, what is paused, and what has deliberately not been built.

## Executive summary

Breadlines has made meaningful progress in evidence-first Solana execution research. The strongest work so far is not a product claim: it is a record of two attractive narratives that the data did **not** support.

1. A JTX sample initially appeared to show a large JTX failure problem. Forensic analysis showed the dominant failure cluster happened in a DFlow-to-System-Program path **before** outer JTX execution and came from one recurring signer. Breadlines correctly prevented false blame.
2. A ledger-side study of Solana's 350ms to 300ms transition initially showed short-window differences. Those differences moved or reversed as the observation window widened, so the ledger does **not** support a stable causal claim about the slot-time change.

That restraint is an asset. The project is not yet an execution control plane, routing system, or prediction engine. It is building a defensible foundation for execution evidence, attribution, and later opt-in sender-side telemetry.

## 1. Completed research

### A. Solana 350ms to 300ms ledger-side methodology study

**Status:** Complete and published to `main`.

The authoritative transition is epoch 1024 at slot `442,368,000`, with RPC-estimated block time `2026-08-28T15:25:03.000Z`. The methodology audit confirmed that the wrong `19:25:03Z` timestamp was not used in completed calculations. Both adjacent boundary slots returning the same second is an RPC-estimation limitation, not a contradiction.

The main result is methodological: the observed before/after landed-success answer changes substantially with window width. A simple ledger-side before/after is therefore not a defensible causal estimate of the slot-time transition.

Additional durable observation: sampled per-block `costUnits` maxima reached **85.36M / 87.5M (97.6%)** before and **72.81M / 75M (97.1%)** after, without exceeding either ceiling. This is direct ledger evidence that the sampled blocks approached their applicable caps; it does not depend on the before/after comparison.

The study does **not** claim sender geography, dropped-before-landing transactions, submission latency, user identity, or causality. A targeted check found zero `svmgov` transactions across the inspected pre-window sample, so governance traffic did not explain that specific observed ramp.

Primary artifacts:

- [Final report](slot-time-300ms-boundary/final-report.md)
- [Methodology integrity audit](slot-time-300ms-boundary/methodology-integrity-audit.md)
- [Stability analysis](slot-time-300ms-boundary/stability-analysis.md)
- [Ledger ceiling observation](slot-time-300ms-boundary/ledger-ceiling-observation.md)

### B. Frozen Pump.fun to PumpSwap graduation universe

**Status:** Complete and frozen.

The neutral universe contains **2,508** deterministic Pump.fun-to-PumpSwap graduations from 2025-09-01 through 2025-09-15. Inclusion used on-chain migration evidence only:

- 48,321 migration-authority transactions scanned
- 4,663 successful Pump migrate instructions found
- 2,508 actual PumpSwap `CreatePool` migrations retained
- 2,155 successful idempotent/no-op migrations excluded
- 0 duplicates and 0 malformed layouts retained

No price, return, survival, popularity, or later market outcome influenced inclusion. The universe must not be regenerated, filtered, ranked, or altered.

- [Universe audit](market-structure/token-universe-audit.md)
- [Frozen universe](market-structure/token-universe.json)

### C. Generalized Market Structure framework and TOAD Execution Pulse v0

**Status:** Framework built; TOAD transformation complete.

The Market Structure research framework was generalized to accept an arbitrary mint, a fixed observation start/end, and an optional label while preserving its sampling/evidence contract. It supports participation, recurrence, successful-execution concentration, HHI, failure ecology, fees, compute units, and relative chronological slices.

TOAD was then transformed into an evidence-bounded, token-agnostic **Execution Pulse v0**. It is a research report, not a price signal or token score. Its public-facing language deliberately avoids unsupported terms such as users, traders, whales, bots, control, manipulation, or bullishness.

TOAD Pulse highlights from the existing sample:

- 8,770 sampled token-touching transactions represented
- 333 observed primary signer addresses
- 69.1% sampled execution success rate
- Top-1 observed successful-execution share: 23.8%
- Top-5 observed successful-execution share: 49.2%
- 2,711 observed failures

These are sample-bound execution observations, not claims about holders, people, adoption, token quality, or future performance.

- [TOAD Execution Pulse](execution-pulse/toad/execution-pulse.md)
- [TOAD share-card payload](execution-pulse/toad/share-card.json)

### D. JTX execution attribution study

**Status:** Complete; no product or outreach built from it.

The study used 500 consecutive transactions with a locally verified outer invocation of the confirmed JTX program.

- 333 successful executions
- 167 landed-but-failed executions
- 159 failures exposed a deterministic `InsufficientLamports` rejection

The headline interpretation was tested and rejected. All 159 dominant failures shared one signer/fee payer and a repeated DFlow to System Program path; the System failure happened before the outer JTX instruction. The evidence does **not** support saying JTX caused those failures.

The commercially useful finding is narrower: a receipt can correctly say that a failure occurred in a downstream path before JTX execution, rather than falsely blaming JTX. The remaining seven JTX-frame failures and one DFlow failure did not establish a strong enough, semantically decoded failure wedge to justify a demo.

- [JTX report](jtx-execution-study/jtx-execution-report.md)

### E. 0x Settler execution study

**Status:** Complete; verdict: **WEAK WEDGE**.

The sample is correctly called **0x Settler executions**, not 0x Swap API executions. The Settler program is an on-chain fingerprint, but it does not prove a transaction came from the public Swap API.

From 500 consecutive outer-Settler executions:

- 271 successful; 229 landed-but-failed
- 211 failures occurred in downstream programs
- 14 occurred in the Settler frame
- 2 occurred in System/Token Program frames
- 2 had unknown attribution
- 99.1% of failures could be assigned to the correct execution layer
- 0% had a proved useful plain-language semantic explanation
- 11 signer/fee-payer addresses accounted for the failure population; the top address accounted for 92.1%

Breadlines can provide correct layer attribution here, but the sample did not demonstrate enough multi-actor, semantically explainable failure diversity for an integrator-facing micro-product.

- [0x Settler 500-execution report](0x-settler-study/settler-500-report.md)

### F. Execution Trace v0

**Status:** Research-only core and tests complete.

Execution Trace is the bridge from what the chain proves to what only a sender/provider can observe. It models an opt-in sequence from transaction construction through simulation, signing, submission attempts, provider acknowledgements, final receipt, and expiry.

It has strict evidence rules:

- preconfirmation is never treated as final landing;
- no receipt by a deadline is `UNOBSERVED_BY_DEADLINE`, never silently called “dropped”;
- no raw signed transaction, private key, API key, or provider URL is accepted by default.

This is not connected to Helius or any paid service, does not send transactions, and does not modify production behavior.

- [Execution Trace readme](execution-trace/README.md)

### G. Execution X-Ray and normalized Execution Episode v0

**Status:** Core schema/reducer/tests complete locally; real corpus not yet collected.

X-Ray turns a landed target receipt plus a declared local context sample into an evidence object. It records direct receipt facts, shared writable-account context, coverage/completeness, signer recurrence as address recurrence only, and explicit evidence grades:

- **A — chain-proven**
- **B — directly observed**
- **C — supported inference**
- **D — hypothesis**
- **UNKNOWN**

The current implementation produces only A/B/UNKNOWN automatically. It does not invent causality, bots, submission ordering, state changes, avoidability, or better routing choices.

The associated `BL-XR-v0` fingerprint is a comparison primitive, not a predictive model. It intentionally marks causality as `UNDETERMINED`.

- [X-Ray readme](execution-xray/README.md)
- [20–30 receipt calibration corpus protocol](execution-xray/corpus-protocol-v0.md)

## 2. Paused or incomplete work

### Full 2,508-token Episode collection

**Status:** Paused after reliability problems. Current persisted progress: **10 / 2,508 complete**.

The frozen cohort itself is intact. Collection is not being silently broadened, filtered, or retuned for sparse tokens. Earlier archival transport problems included throttling and transient failures; a shared scheduler and checkpointing were added, but the pilot remained operationally too slow/unreliable to justify blindly grinding through the entire cohort.

This is an operational reliability issue, not a reason to alter the scientific contract.

### X-Ray calibration corpus

**Status:** Not yet started as a real 20–30 public-signature corpus.

The protocol, evidence schema, and tests exist. The next meaningful research task is to collect its fixed, deliberately varied set of landed failed transactions and determine how often context adds genuine explanatory value beyond the receipt.

### Provider-specific Execution Trace semantics

**Status:** Needs external documentation/telemetry validation.

The generic trace model is ready, but provider terms such as “preconfirmation” must be mapped conservatively per source. This requires public documentation or opt-in sender/provider data—not inference from ledger data.

## 3. Explicitly not built or claimed

Breadlines has **not** built:

- Execution Weather
- Execution Time Machine
- Counterfactual Engine
- Autopilot, routing, or transaction execution
- Three.js X-Ray renderer
- Public X-Ray user interface
- A token score, bullish/bearish classifier, prediction model, or outcome analysis
- A claim to observe sender geography, dropped transactions, sender arrival time, leader ingress, or end-to-end latency from chain data

Breadlines has also not used the frozen cohort to inspect post-observation outcomes, and has not spent money on Helius for this work.

## 4. Research conduct that is working

The important discipline is visible in the record:

- Attractive claims were tested rather than repeated.
- The JTX result was narrowed when the chain contradicted the initial headline.
- The 300ms result was narrowed when wider windows contradicted the short-window narrative.
- Evidence boundaries are first-class data, not footnotes.
- The research distinguishes what is observed from what would require sender-side telemetry.

This is the basis for credibility with protocol and infrastructure builders.

## 5. Operational and publishing debt

The newest research artifacts are currently local and uncommitted, while the worktree also contains unrelated uncommitted production changes. This is the immediate organizational risk: useful work can become hard to audit, review, publish, or safely continue.

The slot-time paper is confirmed on `main`. The newer X-Ray, Execution Trace, and related research artifacts should be separated into a clean research-only commit before more scope is added. Existing production edits must remain isolated and should not be swept into that commit.

## 6. Recommended next sequence

1. Create a clean research-only commit for the local X-Ray, Execution Episode, Execution Trace, and this audit; exclude existing production changes.
2. Run the fixed 20–30 public failed-transaction X-Ray calibration corpus exactly as pre-registered.
3. Produce a failure taxonomy and a list of telemetry that would have been required to answer each obvious question conclusively.
4. Publish one carefully selected **negative-result** X-Ray if it demonstrates the evidence standard clearly.
5. Only after the corpus, decide whether a 2D evidence card is valuable enough to earn a public X-Ray renderer. Do not build Weather, routing, or 3D visuals first.

## Bottom line

Breadlines is not yet a product company with an execution-control plane. It is becoming something more credible first: an evidence-first execution research practice that knows the boundary between what Solana proves and what people merely infer.

The next proof is not a grand platform claim. It is whether 20–30 real X-Ray Episodes repeatedly uncover useful, accurately bounded context that a normal explorer receipt does not provide.
