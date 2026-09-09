# X-Ray v1 validation — 2026-09-09

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
