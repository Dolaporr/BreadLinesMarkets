# X-Ray v1.2.0 adversarial semantic audit

Run: `node --experimental-strip-types research/execution-casefile/audit/run-audit.ts`
(also gated by `test/execution-semantic-audit.test.ts`; exits non-zero on any violation)

## What it checks

Whether **execution reach**, **execution success**, **transaction outcome** and **state commitment**
can still be confused by a human viewer, an exported-JSON consumer, or the bot.

Every surface is checked **independently**. A boundary printed in the viewer does not excuse an
export that reads as partial commitment, and a correct JSON field does not excuse a panel that
renders `success` beside a route with nothing to qualify it. Surfaces covered: case-file JSON
(the evidence endpoint and export bundle), the Markdown report, Episode JSON, and five viewer
panels — verdict, invocation path, outer positions, execution atlas, case list — plus the accounts
tab and the "what would we need to know?" panel.

Two probe rules keep it honest rather than merely quiet:

- **Assertion, not vocabulary.** A prohibition necessarily contains the phrase it forbids. The scan
  skips sentences carrying negation or refusal markers, and skips fields whose contract is refusal
  (`prohibitedInterpretations`, `limitations`, `boundary`, `neededToAnswer`, …). A claim smuggled
  into one of those would be a real defect, so that list is deliberately short.
- **Chain transcription is not a Breadlines claim.** Raw receipts and verbatim program logs are
  excluded from claim scanning. `Program X success` is what the log says.

## Corpus

All fixtures are SYNTHETIC. None is a real signature, none was collected, and none may be added to
the calibration corpus or presented as chain evidence.

| Case | Stresses |
| --- | --- |
| `success-multi` | Does a success read as one commitment rather than several? |
| `early-failure` | With nothing executed before it, is absence of commitment still stated? |
| `deep-cpi-failure` | Four frames logging success before a depth-3 rejection |
| `child-success-parent-fails` | A frame returns success, the parent then fails |
| `sibling-cpis-one-fails` | Three sibling CPIs, one rejects |
| `later-outers-not-reached` | Reached-and-rolled-back vs never-executed |
| `truncated-logs` | Attribution unknown — does any surface still assert reach? |
| `v1-unsupported` | Does v1 fail closed naming cross-root commitment? |
| `multi-root-atomic-synthetic` | Two root-bearing markets: is per-root commitment implied? |

## Findings (2026-09-11) and fixes

| # | Finding | Surfaces | Fix |
| --- | --- | --- | --- |
| F1 | The **verdict panel** — the first thing a reader sees — never stated what committed on any failed transaction. It showed the badge, the error and the `A → B → C` failure path, and an arrow chain reads as stages of a journey. | 7/7 failed cases | Verdict renders `stateCommitment.statement`. |
| F2 | The **invocation path panel** listed each frame's status as bare `success` inside failed transactions, with no qualification — directly beside the atlas, which did carry the warning. | 5/7 failed cases | Panel renders the commitment statement; frame status renders through a shared `frameStatusLabel`, so a SUCCESS frame in a failed transaction reads `returned success · rolled back`. Also applied to atlas tooltips and screen-reader labels. |
| F3 | The viewer **never asked the per-root question**. `PER_ROOT_STATE_COMMITMENT` existed only on the Episode, so the case where a reader is most tempted to ask "what did each root commit?" did not surface it in the UI. | case-file `missingTelemetry` | Case file carries the question. |
| F4 | The per-root trigger counted **outer instructions only**, so it missed the shape it was written for: a route reaches its markets through CPI. A Jupiter route through PumpSwap → Token → System did not raise it, while a ComputeBudget-plus-two-outers transaction did. The case file and Episode also counted differently, so the two surfaces could disagree. | Episode + case file | Both now count distinct non-ComputeBudget programs **observed to be invoked** (logs lead, declared outers as fallback). A program never reached is not part of the route. Verified to agree on all nine cases. |
| F5 | **Bot guards leaked.** The v1.2.0 patterns were shape-matched to the examples they were written against, not to the claim space. Six unsupported claims passed, including "Two of the three CPIs went through", "Root A settled and Root B did not", and "it timed out and got there too late". | bot `isSafeText` | Rebuilt as a two-tier sentence/clause-aware check. See the bot repo's README. |

A probe flaw found and fixed during the audit: the first pass flagged `prohibitedInterpretations`
entries and the word "completed" on the *successful* case. Both were artifacts — the field name
carries the prohibition, and on a committed transaction reach and commitment coincide — so the
probes were corrected rather than the code.

## Drift guard

The audit models the viewer's rendered strings. `test/xray-ui-contract.test.ts` pins those
expressions to the actual TSX, so a UI edit that drops a commitment disclosure fails there instead
of silently passing an audit checking a stale copy of the UI.
