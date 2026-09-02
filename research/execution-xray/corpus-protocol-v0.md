# Execution X-Ray Adversarial Corpus v0

## Purpose

Stress-test the X-Ray evidence model against **approximately 24 public, landed-but-failed transactions**. This is a deliberately varied calibration corpus, not a representative failure-rate study and not a performance benchmark.

## Fixed selection contract

Select targets from public, landed transactions only. Each target must have `meta.err` and a retained raw receipt. Choose by deterministic receipt evidence, not by a narrative about MEV, bots, a provider, or token outcome.

Target strata, recorded before collection:

| Stratum | Target count | Minimum inclusion evidence |
| --- | ---: | --- |
| Documented compute-budget / compute-limit failure | 4 | Final receipt log or runtime error identifies compute exhaustion/limit. |
| Documented slippage or program-state rejection | 4 | Exact program/error evidence; do not infer slippage from a generic custom error. |
| Insufficient lamports/funds | 4 | System/program log quantifies or names the insufficient-funds condition. |
| Opaque custom error | 4 | Failing program and exact custom code are observable, semantic meaning remains unproven. |
| Outer-context diversity: Jupiter, Raydium, Meteora, Pump | 4–8 | Outer instruction/program context is deterministically present; context is not blame attribution. |
| Context acquisition edge cases | Across all targets | At least 6 complete same-block contexts and at least 6 declared partial/unavailable contexts. |

Strata overlap. If a quota cannot be met with valid public evidence, record the shortfall; do not substitute an anecdotal “interesting” transaction.

## Per-target artefact

Every selected target produces one `ExecutionEpisode`:

```text
Target receipt
  → Execution X-Ray evidence map
  → Evidence claims: A chain-proven / B directly observed / C inference / D hypothesis / unknown
  → Missing-telemetry requirements
  → BL-XR raw fingerprint
```

For v0, the reducer generates only A, B, and UNKNOWN claims. C and D are deliberately empty unless a later, separately reviewed methodology establishes them.

## Context rules

1. Declare the slot window before fetching its context.
2. A same-block count is complete only when a verified full block response covers the target slot.
3. Neighbouring-slot history may be labelled partial. All resulting counts must read “at least.”
4. A block transaction-list index is never reported as a millisecond timestamp or proof of execution order.
5. Writable-account overlap is not described as causation, a state change, competition, front-running, or avoidability.

## Output questions

At the end of the corpus, report only:

- Which failure semantics were chain-proven versus opaque.
- How often account-context evidence was complete, partial, or unavailable.
- Which telemetry requirements recur.
- Whether the raw fingerprint can be populated consistently across diverse receipts.
- The number of episodes where the tempting causal story remained unproven.

Do not publish rankings, landing probabilities, provider comparisons, “MEV victim” labels, or a live pressure claim from this corpus.
