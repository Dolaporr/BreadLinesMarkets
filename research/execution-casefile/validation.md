# X-Ray v1 validation — 2026-09-09

## v1.2.0 adversarial semantic audit — 2026-09-11

- Built a nine-case synthetic corpus and probed every surface independently: case-file JSON, the
  Markdown report, Episode JSON, and the viewer's verdict, invocation-path, outer-position, atlas,
  case-list, accounts and missing-telemetry panels. Findings and fixes are in
  [`audit/README.md`](audit/README.md). Five real gaps were found (F1-F5); all are fixed and the
  audit now reports 0 violations.
- Two of the five were viewer-only: the verdict panel never stated what committed on a failed
  transaction, and the invocation-path frame list rendered bare `success` inside failed
  transactions. The JSON, report and Episode surfaces passed from the start.
- Two were representational: the per-root commitment question never reached the viewer, and its
  trigger counted outer instructions only — missing CPI routes, which is the shape it was written
  for. Both surfaces now count programs observed to be invoked and agree on all nine cases.
- One was in the bot: the v1.2.0 claim guards leaked six unsupported claims from this corpus. They
  were rebuilt as a two-tier, clause-aware check in the bot repo.
- 70/70 tests pass, production build passes. The two pre-existing `structuredEvidence` typecheck
  errors in the JTX and 0x study scripts remain and are untouched; no new error was introduced.
- The generated library was re-derived again (23 cases, all recomputed from their retained
  receipts, all agreeing on identity, outcome, explanation and failure path). 14 of the 23 now
  carry the per-root commitment question. No collection, reselection or RPC call.
- All audit fixtures are synthetic and are not part of the calibration corpus.
- Outstanding, unchanged: browser click-through, accessibility and mobile QA, and independent
  held-out engineer review. The audit is a semantic check on rendered strings, not a browser or
  comprehension study — it establishes that no surface *states* a partial commitment, not that no
  reader ever infers one.


## v1.2 atomic cross-root update — 2026-09-10

- 64/64 automated tests passed across the full `test/` suite, including new coverage for: a failed
  transaction reporting `NONE_COMMITTED` with no outer position labelled completed while its frame
  still logs `SUCCESS`; a successful transaction committing as one unit and stating so in the
  exported report; the v1 guard failing closed for cross-root commitment rather than resource
  configuration alone; a multi-program route raising `PER_ROOT_STATE_COMMITMENT` while a
  single-program transaction does not; and an assertion that no Episode claim statement asserts
  lateness or ordering.
- TypeScript compilation is unchanged: the same two pre-existing `structuredEvidence` errors in
  `scripts/jtx-execution-study.ts` and `scripts/zerox-settler-study.ts` remain, and no new error was
  introduced. Those files were not edited. The production build passed.
- The generated library was re-derived by `scripts/execution-casefile-relibrary.ts`, not regenerated
  from the corpus: the corpus source artifacts are not retained in this repository. Each case was
  recomputed from its own retained raw receipt, aborting on any disagreement in identity, outcome,
  explanation, or failure path; all 23 agreed. Saved neighbouring context was re-attached unchanged
  because it came from the Episode artifact and is not recomputable from a receipt. Selection was not
  changed and no data was collected. All 23 cases are landed-failed, so all now report
  `NONE_COMMITTED`, and none retains a `COMPLETED` outer label.
- Case-file schema moved to `breadlines-casefile-v1.2.0`. Bundle import accepts v1.0.0, v1.1.0 and
  v1.2.0; because import recomputes from the retained receipt, older exports gain the commitment
  fields when reopened rather than breaking.
- Outstanding, unchanged: browser click-through, accessibility and mobile QA, and independent
  held-out engineer review. No deployment, paid RPC call, send or outreach occurred.


## v1.1 workflow update — 2026-09-09

- 51/51 automated tests passed across case-file workflow, case-file core, receipt, X-Ray and trace suites. The additional workflow tests cover version guards, exact balances, incomplete token rows, conservative priority derivation, all 23 export/import round trips, forged saved narratives, checksum mismatches, inconsistent context, trace opt-in and deterministic graph projection.
- Full TypeScript compilation passed. The production build passed (42-second compilation); this is validation, not a deployment.
- Refreshed the same 23 generated cases from existing saved source artifacts, without changing their selection or gathering data. The real demo still shows DFlow → System and both later JTX instructions not reached.
- Local page and two distinct saved-case query URLs returned 200. Unknown-case query returned 404. All 23 evidence endpoints returned matching signatures and slots.
- Sequential local development HTTP checks of those 23 evidence endpoints measured median 80.79 ms and p95 123.82 ms (nearest-rank p95). These are warmed local HTTP request-to-JSON timings, not production performance, browser rendering time or investigation-speed evidence.
- Existing regression and production parsing files were not edited in this update. No dependencies, paid RPC calls, sends, deployment or outreach were added.
- Outstanding: actual browser click-through/accessibility/mobile QA and independent held-out engineer review. Responsive styles, keyboard graph controls and unit tests are implemented; these do not constitute browser or user validation. No claim of public-launch readiness is made.

The earlier validation below is retained as the preceding milestone, not a claim that browser testing subsequently occurred.

## Completed

- Generated 23 cases entirely from retained evidence: the unchanged 22-case X-Ray corpus plus one deterministic selection from the completed insufficient-lamports anatomy.
- 40/40 automated tests passed across the new case-file/recorder suite and existing receipt, X-Ray and trace suites.
- Full repository TypeScript check passed separately. This matters because the existing Next configuration skips type errors during the production build.
- Final `npm run build` passed.
- Local research page returned HTTP 200.
- All 23 evidence endpoints returned the requested signature and slot; an unknown signature returned HTTP 404.
- The built production server, started separately with the preview flag unset, returned HTTP 404 for both the research page and its evidence endpoint. The temporary gate-test process was stopped afterward.
- Standalone recorder example ran without network or signing. Its mocked acknowledgement remained unobserved at the final-receipt deadline.
- Focused secret-pattern scan of added source and generated evidence found no API-key query values, bearer credentials or private-key blocks.

## Regression safeguards exercised

Caught child errors; a different parent error after a child rejection; a handler log between same-code failures; terminal propagated failure; custom-code conflict with `meta.err`; invalid instruction position; runtime compute failure; opaque semantics; missing metadata; truncated logs; compiled address-header and lookup-table resolution; real DFlow/System transfer-account recovery; stable original-receipt hashes; multiple revisions/signatures; repeated sends; explicit commitments; expiry evidence; clock reversal; unsupported input fields; fixture/real-signature separation; inconsistent trace receipts; and instrumentation failures that do not change the sender response or trigger a retry.

Capture health records missing-event issues. Counts are counts of captured events, not proof that the application observed its entire lifecycle. The existing `retries` summary field counts repeated sends of a revision; the interface calls these repeated sends because intent (retry versus hedged submission) is not established by repetition alone.

## Limits of this validation

This was unit/regression, compiler, production-build and local HTTP verification. It was not a browser interaction/accessibility audit or a user-comprehension study. No application integration or partner telemetry was obtained. No improvement in investigation speed or explanation accuracy over another product has been measured.

The first sandboxed compiler/preview attempt encountered memory/dependency-resolution failures. Validation succeeded outside the restricted process environment using the installed dependencies; no dependency versions or production code were changed to work around that failure.

## Delivery state

Local preview: `http://127.0.0.1:3210/research/xray`.

New work is confined to `app/research/xray/`, `research/execution-casefile/`, two research scripts and the new test file. The pre-existing dirty production files were preserved. No production deployment, paid collection, transaction send or outreach occurred. The private preview switch must be deliberately enabled to expose the new route.

Next external gate: one opted-in application supplies real traces, and 3–5 engineers participate in the held-out comparison described in README.md. These are pending, not prerequisites to inspecting the completed local software.
