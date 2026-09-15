# Preconfirmation Evidence Map v0

**Breadlines research note — v0**
**Date:** 2026-09-14
**Status:** Evidence model. One issuer's semantics are established from a direct clarification; the other's are largely open and recorded as such.

## Why this exists

A preconfirmation stream can merge issuers whose preconfirmations differ **in kind**. One is emitted
after execution and reports a result. Another is a commitment made before execution. Recording both
as `preconfirmed: true` destroys the only property that decides what the record is worth.

This map keeps them apart, and keeps what is not established visible rather than filled in.

## What Helius told us

Ichigo at Helius clarified directly (2026-09):

1. Helius-native preconfirmations are emitted **post-execution** and include status.
2. The stream merges two sources with different semantics: Helius post-execution, and BAM
   commit-to-execute.
3. There is **no explicit per-message `source` field** in the payload today.
4. Status can currently identify the Helius path: status `0`/`1` means Helius, executed.
5. Helius has opened a documentation PR arising from this ambiguity.

Two consequences follow, and both are enforced in code rather than left to discipline.

**Attribution is DERIVED, not EXPLICIT.** Because no field names the source, identifying Helius is
an inference over status semantics. The inference rule can change without any message changing.
`describeAttribution` renders it as *derived from status semantics, not stated by the payload*, and
the schema refuses an `EXPLICIT` basis that cannot produce the field that stated it.

**The rule is one-directional.** Status `0`/`1` identifies Helius. The *absence* of that status
identifies nothing. Helius said nothing establishing that a message without it comes from BAM, so
`deriveSourceFromStatus` returns `UNKNOWN` rather than completing the dichotomy. A test asserts the
result is never `BAM` by elimination.

## The lifecycle

```
SUBMISSION → SCHEDULER → LEADER COMMITMENT → EXECUTION
           → PRECONFIRMATION EMISSION → BLOCK INCLUSION → LEDGER RECEIPT
```

Every stage carries one of: `CLIENT_OBSERVED`, `PROVIDER_OBSERVED`, `VALIDATOR_ATTESTED`,
`CHAIN_PROVEN`, `UNKNOWN`.

These name **where evidence came from**. They are not a monotonic confidence ladder. A
provider-observed execution result can be more informative than a validator-attested inclusion
promise, because they answer different questions. Ranking them by strength would reintroduce the
collapse this map exists to prevent.

## Helius path — post-execution

| Stage | Evidence | Established | Not established |
| --- | --- | --- | --- |
| Submission | Client-observed | This application built, signed and attempted to send, on its own clock | That any packet left the machine or reached a leader |
| Scheduling | **Unknown** | Nothing | Whether a scheduler was involved, what it did, or in what order |
| Leader commitment | **Unknown** | Nothing | Whether any leader committed before execution |
| Execution | Provider-observed | That execution occurred — the preconfirmation follows it and reports a result | That the reported result is what the ledger will record |
| Preconfirmation emitted | Provider-observed | That Helius emitted a message carrying a status, on its own clock | That the message is authenticated, or that its origin is stated rather than inferred |
| Block inclusion | **Unknown** | Nothing, until a receipt is observed | Which slot it appears in, or that it appears |
| Ledger receipt | Chain-proven | Slot, outcome, fee, atomic commitment | Submission time, ingress, scheduler position, ordering, contention |

Helius described **what its preconfirmation is**, not how the transaction was scheduled before
execution. Everything upstream of execution is therefore `UNKNOWN` — not because Helius has no
scheduler, but because nothing about it has been established here.

## BAM path — commit-to-execute

Public material describes the **shape** as a commitment made before execution. Its evidence
properties are not established, and are recorded as `UNKNOWN` rather than guessed.

| Stage | Evidence | Not established |
| --- | --- | --- |
| Submission | Client-observed | That any packet left the machine |
| Scheduling | Provider-observed | Whether `sequence_id` or `bundle_id` are authenticated, signed, or attributable to any key; enforcement by disconnection deters violation but verifies no particular claim — see below |
| Leader commitment | **Unknown** | Whether the commitment is cryptographically attributable to an identified key, and what it binds the committer to |
| Preconfirmation emitted | **Unknown** | What the object commits to; whether it is authenticated; where a TEE ordering attestation sits relative to it; what slot or clock domain accompanies it; whether it is validator-attested |
| Execution | **Unknown** | Whether execution occurred, and what it returned — a commit-to-execute preconfirmation precedes execution and reports no result |
| Block inclusion | **Unknown** | Which slot it appears in, or that it appears |
| Ledger receipt | Chain-proven | Submission time, ingress, scheduler position, ordering, contention |

Nothing in that table describes what BAM does, except where a clarification is cited. Elsewhere it
describes what Breadlines has verified, which at every remaining point is: not this.

### Ordering: what Eric established, and what he did not

Eric (@gzalz_sol) clarified directly across two exchanges (2026-09).

**First clarification.**

- `sequence_id` describes the BAM node's dispatch ordering.
- Transactions are forwarded from scheduler to leader in ascending dispatch order.
- For a set of transactions writing to the same account, their order in the produced block must
  follow ascending `sequence_id`.
- Transactions sharing a sequence id have been atomically bundled, with intended intra-bundle
  ordering carried in the bundle metadata.

**Second clarification.** For a *positively identified* BAM preconfirmation:

- The payload originates from the BAM node.
- `sequence_id` and `bundle_id` match scheduler-assigned IDs.
- The produced block's ordering must satisfy the constraints above — a protocol requirement, not a
  description of typical behaviour.
- A leader that violates it is **disconnected from BAM**.

That second clarification strengthens the property: the ordering is enforced rather than merely
described. The model records the result as **protocol-enforced scheduler ordering**
(`PROTOCOL_ENFORCED_SCHEDULER_ORDERING`) — not as attested ordering. The distinction is the whole
point, and it separates two different questions:

| Question | Answer |
| --- | --- |
| Is the claim **consistent** with what the chain recorded? | Checkable, ex post, against the produced block |
| Did the claimed party **actually make** the claim? | Not established by any check available here |

Four limits follow, and each is enforced in code rather than left to prose:

**Consistency is not authenticity.** A reconciliation against the block can *falsify* an ordering
claim. It cannot *authenticate* one — a fabricated `sequence_id` that happens to be consistent with
the block passes exactly the same check.

**The constraint only binds same-account writers.** Where two transactions share no writable
account, the block imposes no ordering constraint between them, and the claim is unfalsifiable for
that pair.

**The check is ex post.** It runs only once the block exists, so it cannot validate a
preconfirmation at the moment it is issued — which is precisely when a preconfirmation is supposed
to be worth something.

**Enforcement is not verification.** This is the limit the second clarification makes necessary.
Disconnecting a violating leader is a real consequence and it deters violation. It is not a
mechanism by which a third party can check whether a *particular* `sequence_id` is genuine. It is
enforced by BAM itself, operationally, by withdrawing a connection — not by a cryptographic check
anyone else can run. Three further things follow from that: the guarantee is only as strong as
BAM's own detection of violations and its willingness to act, neither of which is observable from
here; disconnection is after the fact and does not undo an ordering that already reached a block;
and none of it makes the fields signed, attested, or attributable to a key.

So the model keeps **enforcement** and **verification** on separate axes, and `authentication`
stays `NOT_ESTABLISHED`. Nothing on the BAM path is labelled `VALIDATOR_ATTESTED`, and nothing is
described as independently cryptographically verified, because no verification mechanism has been
evidenced — only a penalty for violating the requirement.

**Everything above is conditional on identification.** These semantics apply *only* to a positively
identified BAM preconfirmation. No rule for identifying one in the merged stream has been
established, so they are unreachable for a message whose issuer is unknown — and they are never
reached by elimination. An unattributed record renders none of this vocabulary, which is a test,
not a convention.

Still `UNKNOWN`, and explicitly not implied by the above: whether the sequence or bundle fields are
authenticated inside the preconfirmation object; what key or signature would authenticate them;
whether the preconfirmation constitutes a validator attestation; where a TEE ordering attestation
sits; the exact clock and slot semantics; and whether any verification — as opposed to enforcement
— exists that a third party could run against a single preconfirmation.

## Provenance rules

- `source` is one of `HELIUS`, `BAM`, `UNKNOWN`. `UNKNOWN` is a value, not a gap to be filled.
- `sourceBasis` is one of `EXPLICIT`, `DERIVED`, `UNKNOWN`.
- `EXPLICIT` requires the payload field that stated the source. Without it the record is refused.
- A named source with an `UNKNOWN` basis is refused — it asserts more than the record establishes.
- Source attribution may never be recorded as `VALIDATOR_ATTESTED` or `CHAIN_PROVEN`. It describes
  how a payload was read, not something a validator signed or the ledger recorded.
- A derived attribution is never rendered with the wording reserved for an explicit one.

## Reconciliation rules

| State | When |
| --- | --- |
| `PENDING` | No receipt yet, and the issuer's own deadline has not passed |
| `MATCHED` | A receipt was found for the message the preconfirmation named |
| `UNRESOLVED` | No receipt, and nothing establishes what that means — **the default** |
| `MISMATCH` | A **verified** commitment contradicted by chain evidence |

`MISMATCH` is deliberately hard to reach. An unverified assertion naming a different slot than the
one the transaction landed in is a *discrepancy*, not a contradiction: the issuer never
authenticated the claim, so there is nothing to contradict. A lapsed deadline with no receipt stays
`UNRESOLVED` — it is not proof the transaction failed to land, and does not establish that the
issuer defaulted.

## Open questions for BAM implementers

These are questions. None is answered here, and none should be answered without evidence.

1. What exactly does a BAM preconfirmation commit to?
2. Is the preconfirmation object itself cryptographically authenticated?
3. Are the sequence and bundle fields authenticated inside the preconfirmation object, and by what
   key or signature?
4. Beyond the ex-post block constraint, can a third party verify that a sequencing claim originated
   from the party it names?
5. Where does the TEE ordering attestation sit relative to the preconfirmation?
6. What slot or clock domain accompanies the commitment?
7. What constitutes expiry, and what would constitute a genuinely broken commitment?
8. How should a preconfirmation be reconciled against the eventual ledger outcome?

### And for the merged stream

9. Will a per-message `source` field be added, so attribution can move from `DERIVED` to `EXPLICIT`?
10. What is the complete set of status values, and what does each mean?
11. Is there a rule that identifies a BAM message positively, rather than by the absence of a
    Helius marker?

## What would change in the model

| If we learn | The model changes to |
| --- | --- |
| A per-message source field ships | `sourceBasis` becomes `EXPLICIT`, carrying the field that stated it |
| A positive BAM identification rule exists | A derivation for BAM, alongside the Helius one; absence still identifies nothing |
| The BAM preconfirmation object is authenticated against a published key | Its emission stage can move from `UNKNOWN` toward `VALIDATOR_ATTESTED`, once verification actually runs |
| The sequence and bundle fields are authenticated against a published key | Ordering moves from an ex-post block constraint to attested ordering, and becomes reconstructable from the payload itself rather than only checkable after the block |
| Expiry semantics are defined | `PENDING` and `UNRESOLVED` separate on evidence rather than on the presence of a deadline field |

## Boundaries preserved

Execution reach is not state commitment. Account overlap is not contention. A timestamp is not an
ordering proof. A preconfirmation is not a receipt. A provider observation is not a validator
attestation, and a validator attestation is not chain proof. Unknown means unknown.
