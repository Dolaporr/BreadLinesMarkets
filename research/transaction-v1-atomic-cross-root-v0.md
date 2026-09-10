# Transaction v1: atomic cross-root state transitions

**Breadlines research note — v0**
**Date:** 2026-09-10
**Status:** Research assumption update and a model audit. Not a product claim, a v1 decoder, or a performance claim.

## Why this note exists

Breadlines' Transaction v1 research assumptions were revised after a public clarification from
Solana co-founder Anatoly Yakovenko ([@toly](https://x.com/toly)). Discussing what is interesting
about transaction v1 — a smart wallet doing everything onchain with large PQC signatures, two ZKP
root state transitions in one atomic transaction, and routing to many markets at once — he
corrected the reading that matters most to this work:

> The point is atomic change in both roots. Not batching 2 updates into fewer txs

and, on what that enables:

> Imagine each root is a zkp amm or order book and the tx routes a trade through each one. So you
> can use liquidity in each zkp for one atomic trade.
>
> This basically means there is no difference between a "roll up" and a native program
> implementation of a market.

The distinction is not a detail. A batch is several state transitions that happen to share a
transaction. An atomic cross-root transition is **one** state transition spanning several roots.
Every downstream evidence claim depends on which of those two a receipt is describing.

## 1. The assumption that changed

| | Superseded assumption | Current assumption |
|---|---|---|
| What multiple roots in one v1 transaction are | Independent root updates packed into one transaction for efficiency | One atomic state transition across all participating roots |
| Commitment granularity | Potentially per-root; a root could conceivably commit while another did not | The transaction. All roots commit together or none do |
| What a mid-route failure means | A prefix of the route may have taken effect | Nothing took effect. The whole transition is rolled back |
| What "routing through N markets" is | N executions to be attributed separately | One execution whose trace passes through N programs, attributed to one commitment |
| What a rollup boundary means for evidence | A ZKP root is a separate settlement domain with its own outcome | For the atomic unit, a ZKP-backed market and a native program market are the same kind of participant |

The last row is the one with the longest reach. If there is no evidence difference between a
"rollup" market and a native program market inside one atomic transaction, then Breadlines must not
build a receipt vocabulary that grades them differently, or that implies one settled while another
did not.

**Status of this assumption.** It is a stated design intent from a primary source about a
transaction format Breadlines has not observed on chain. It is not a measurement, and this note
does not treat it as one. Its role here is to set what the evidence model must be *able to*
represent, and — more importantly — what it must refuse to say.

## 2. The failure mode this creates

The receipt model already resists the obvious temptations: causality, identity, submission time,
counterfactual routing. Atomic cross-root execution introduces a new one, and it is subtle because
it is a *reasonable* misreading of accurate data:

> The trace shows the transaction executed through Raydium, then Meteora, then failed at Jupiter.
> So the first two legs went through and the last one didn't.

Every clause before "so" is supportable. The clause after it is false. The execution trace records
how far the runtime got. It does not record what the ledger kept. In a failed transaction the
ledger kept nothing but the fee.

Three things must stay separate, and the rest of this note is about keeping them separate:

1. **Execution trace** — which programs were invoked, in what nesting, and what each returned.
   A frame can log `success` and still commit nothing.
2. **Failure location** — where in that trace the rejection was observed. A position, not a cause,
   not a timing fact, and not a commitment boundary.
3. **Atomic state commitment** — what the ledger kept. Scoped to the whole transaction, all or
   nothing, regardless of how many programs, markets, or roots the route touched.

## 3. Audit: can the X-Ray model represent this?

Audited: `research/execution-casefile/core.ts` (case file, frames, outer positions, failure path),
`scripts/execution-xray-core.ts` (evidence map), `scripts/execution-episode-core.ts` (claims and
telemetry requirements), and the `/research/xray` viewer.

**Verdict: the model's structure holds. Its labels did not.** The execution trace, the failure
location, and the account/context layers were already separate and correctly bounded. But the model
had no representation of commitment at all, and in its absence two labels were doing that job
incorrectly.

### Finding 1 — `COMPLETED` asserted commitment that never happened (fixed)

Outer instruction positions before the failing index were labelled `COMPLETED` on failed
transactions. That word states the exact thing the atomicity rule forbids. The prose disclaimers
were correct — the README and the viewer caption both said completed instructions do not imply
committed state — but a disclaimer beside a field does not travel with the field. `library.json`,
the evidence endpoint, and every JSON export carried `"state": "COMPLETED"` on transactions that
committed nothing.

Fixed: `state` now reports how far execution got without asserting commitment
(`EXECUTED_NOT_COMMITTED`, `FAILED`, `NOT_REACHED`, `UNKNOWN`, or `COMMITTED` only when the
transaction actually committed), and a separate `commitment` field carries the ledger outcome. All
23 generated cases were re-derived; none retains a `COMPLETED` label.

### Finding 2 — no transaction-level commitment fact existed (fixed)

The case file recorded `LANDED_SUCCESS` / `LANDED_FAILED` — an outcome, not a commitment scope.
Nothing in the model said what the unit of commitment *was*. That is precisely the fact a
multi-root, multi-market route makes load-bearing.

Fixed: `execution.stateCommitment` now states the unit (`ATOMIC_TRANSACTION`), the outcome
(`ALL_COMMITTED` / `NONE_COMMITTED`), its basis, and its boundary: a route through several programs
is one commitment, not one commitment per program. It appears in the exported Markdown report, and
the Episode carries the matching chain-proven claim.

Note the basis honestly: this applies the runtime's all-or-nothing rule to the observed `meta.err`.
It is not a separate per-instruction observation, and it does not enumerate which roots
participated. The receipt does not decompose the commitment, and neither does this field.

### Finding 3 — a frame logging `success` inside a failed transaction (fixed in presentation)

`parseFrames` marks a frame `SUCCESS` when its log says `Program X success`. That transcription is
correct and was left alone: it is what the log says. But the execution atlas rendered those frames
in the same success colour on failed transactions, so a five-hop route reads visually as five
things that worked and one that didn't. On a failed transaction the viewer now states plainly that
a call marked SUCCESS returned success and was still rolled back.

### Finding 4 — the v1 guard was right, for an incomplete reason (fixed)

`normalizeReceipt` already fails closed on version 1 and on configuration-bearing payloads. That
abstention is correct and was the model's best existing property here. But it recorded the reason
as undecoded *resource configuration* only. Under the current assumption that reason is incomplete:
decoding v1's configuration would not give the model any way to represent a commitment spanning
multiple roots. The guard's message now names both, so implementing the first does not read as
licence to lift the gate.

### Finding 5 — no per-root telemetry requirement existed (fixed)

The Episode's `telemetryRequirements` name what would be needed to answer each question the receipt
cannot. Nothing named the per-root question. A transaction routing through more than one
non-ComputeBudget program now records `PER_ROOT_STATE_COMMITMENT`: saying what each root committed
would require program-specific state-root decoding and observed pre/post root evidence, because the
receipt records one commitment for the whole transaction and does not decompose it.

### Finding 6 — no "late" or ordering inference was found (preserved, and now guarded)

The audit looked specifically for lateness and ordering claims and found none. `contextRelation`
emits slot and block-list relations that are explicitly labelled as positions rather than times,
and the prohibited-interpretation lists already refused millisecond arrival claims and race
narratives.

Atomic routing introduces a new route into that error, though: *the transaction failed at the last
hop, so it got there too late*. A rejection late in a route is a position in the execution trace.
It is not a delivery-timing fact and not a sequencing fact. Explicit prohibitions on reading
lateness or ordering out of a route position were added to the X-Ray's context interpretations and
limitations and to the Episode's failure-frame claim, and a regression test asserts that no
Episode claim statement asserts lateness.

## 4. What Breadlines still cannot do, and is not claiming

- **Decode a v1 transaction.** The model fails closed on v1 and this note does not change that.
- **Observe a ZKP root, a root transition, or a per-root outcome.** Nothing in the receipt evidence
  layer decodes state roots. Naming the requirement is not implementing it.
- **Distinguish a ZKP-backed market from a native program market** in a receipt. Under the current
  assumption this may be correct rather than a gap, but Breadlines has not established it from
  observation.
- **Say which market in a route "worked."** Inside one atomic unit that question has no answer the
  ledger will give.
- **Attribute a route failure to timing, ordering, or a provider.** Unchanged, and now explicitly
  guarded against the route-position phrasing.

## 5. What would change these assumptions

1. Public v1 transaction specification or observable v1 receipts on a reachable cluster. Until
   then the commitment model here is applied doctrine, not measurement.
2. Evidence that a v1 transaction can commit a subset of its roots. That would contradict the
   atomicity assumption and would require the commitment field to become per-root, not
   per-transaction.
3. Receipt-observable evidence identifying which roots participated in a transition. That is the
   minimum for anything per-root, and `PER_ROOT_STATE_COMMITMENT` records what it would take.
4. A correction from a primary source. This note is built on a public clarification; if it has been
   misread, Breadlines wants the correction more than the note.

## 6. Bottom line

The X-Ray model can represent an atomic transaction routing through multiple programs and markets:
its trace, failure-location, and context layers were already the right shape, and it correctly
refuses to decode the transaction version that will carry this.

What it could not do was say what committed — and in that gap, one field label was quietly claiming
that a partially executed route was a partially committed state transition. That claim is now gone
from the data model, the exports, the generated library, and the viewer, and the distinction
between execution trace, failure location, and atomic state commitment is enforced by tests rather
than by prose beside the field.
