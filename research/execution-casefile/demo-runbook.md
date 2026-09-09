# X-Ray: a 75-second evidence demonstration

## Purpose

Show a transaction containing JTX instructions without blaming JTX for a failure that occurred before they were reached. Demonstrate the investigation workflow, not a claim that other explorers cannot expose these facts.

The evidence is an existing archived RPC receipt, not a live execution. Do not send a transaction for the recording. No provider credentials, wallet connection or new collection is needed.

## Open this exact case

Local preview on the computer running the server:

http://127.0.0.1:3210/research/xray?signature=1uv4TZhkQrUgJhAxSK2KD8qpXRF2yVsi4NQkx5hnb7kitnquYRW6zkDW7DVv7ofYEm6GDH4J33HiSK57nNcESyz

This is not a phone-accessible or public URL. A hosted deployment additionally needs `BREADLINES_XRAY_PREVIEW=1`; the page and evidence endpoint intentionally return 404 otherwise. Pushing the code alone does not confirm that the hosted preview is enabled.

## Recording preparation

- Use a desktop browser. Hide unrelated tabs, bookmarks and desktop notifications; keep credentials and personal files off-screen.
- Load the saved case before recording, then verify the full signature in its receipt and slot **439425407**. Browser inspection is a rehearsal gate, not something this runbook claims has happened.
- Record the browser window only at a readable resolution, ideally 1920 × 1080. If posting a short clip, use modest zoom so logs survive compression. Do not record a terminal or environment settings.
- Keep the graph still initially. Rotate once to demonstrate exploration; use the flat view if labels are easier to read there. Geometry is not real transaction timing.
- Leave sender-trace export unchecked. Do not open the synthetic lifecycle example during this real-case demonstration.

## Shot list and narration

| Time | Screen action | Say |
| --- | --- | --- |
| 0–10s | Show the signature, slot and failed receipt | “This transaction contains JTX instructions. That alone doesn't tell us where it failed.” |
| 10–25s | In Execution Atlas, step through the failure path: DFlow, then System. Select the red System node and show its logs | “The recorded execution path reaches DFlow, which invokes the System Program. This is where the transfer is rejected.” |
| 25–38s | Scroll to Outer instruction positions; show failed DFlow at 3 and not-reached JTX at 4 and 6 | “The two later JTX instructions were never reached. This receipt does not support attributing this rejection to JTX.” |
| 38–53s | Show the quantified transfer log and expand Recovered transfer accounts | “The log states exactly how many lamports were available and requested. The decoded transfer also identifies its source and destination.” |
| 53–68s | Scroll to the missing-telemetry questions; optionally show Attempt history as unavailable | “We cannot recover submission time, leader arrival, or whether another delivery path would have helped from this receipt.” |
| 68–75s | Return to the evidence view; use Copy report or Export evidence | “Breadlines connects the explanation to the evidence—and keeps the unanswered questions visible.” |

Exact log: `Transfer: insufficient lamports 1466356792, need 3915945163`.

Available: **1,466,356,792 lamports**. Requested: **3,915,945,163 lamports**. Derived shortfall: **2,449,588,371 lamports**.

Source: `23zyeKyn8wpF8VyWSGHTGvTVEGi5SPyziGSs9pGKr5ta`.

Destination: `4cPb3ieD57pgrNvsLYPrvXGzSQzeedAR286pDbrbufJh`.

Account recovery is based on RPC-parsed transfer fields, matching complete inner-instruction/log program-depth sequences and matching the logged amount. It does not prove who controls those accounts or what an end user intended.

## Do not say

- “JTX has a 33% failure problem.”
- “A bot beat this person.”
- “This proves congestion/fees/MEV caused the failure.”
- “This account had this balance when the transaction was submitted.”
- “The graph shows milliseconds between transactions.”
- “Breadlines is the only tool that can explain this.”

Neighbor context for this case is unavailable, not zero. There is no real attached sender trace. The demonstration must retain those boundaries even if they are less visually dramatic.

## Done when

The clip makes five answers clear: what happened, where execution stopped, the exact evidence, what never ran, and what remains unknown. Rehearse once, check small-screen log readability, then record. No posting, outreach or public deployment is performed by this runbook.
