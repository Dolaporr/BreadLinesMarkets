# What a preconfirmation proves, and where the receipt takes over

**Breadlines research memo — v0.1**
**Date:** 2026-09-13
**Status:** Research design and evidence model. Not a product claim, not a measurement, and not a study result — no preconfirmation data has been collected.

## Standing disclosures

Breadlines has no relationship with Jito. Nothing here was reviewed by them, and BAM is discussed
from public material only. This memo proposes no router, scheduler, or sender, and makes no
comparison between providers. Every fixture in the supporting code is synthetic and labelled as
such; none of it appears in any result.

## 1. The thesis: a preconfirmation is not a faster receipt

The tempting reading of a preconfirmation is that it is an early receipt — the same information,
sooner. On the evidence that reading is backwards, and it is worth being precise about why.

A ledger receipt is **authorless**. It records that a transaction was included and what execution
returned, but nobody signed up to that outcome in advance and no party is identifiable as having
promised it. It is an excellent record of *what occurred* and carries no information about *who
undertook what*.

A preconfirmation is the only artifact in the execution stack that has **an author and a timestamp
before the fact**. That is its distinctive contribution, and it is not a timing contribution. With a
verified signature over a described payload, a preconfirmation is the only pre-inclusion statement
that survives its issuer later declining to stand behind it. Everything else available before
inclusion is either the sender's own word about its own process, or nothing.

So the useful framing is not *earlier information*. It is **attributable commitment**: a named party,
at a stated time, on a stated clock, committing to a described outcome, in a form that can be
checked later against what the ledger recorded.

This distinction decides everything downstream. If a preconfirmation is an early receipt, the
interesting metric is how early. If it is an attributable commitment, the interesting metric is how
often the commitment matched the ledger, and what the record preserves when it did not.

## 2. The evidence matrix

Five layers, weakest to strongest. This table is generated from
`research/execution-casefile/evidence-matrix.ts`, which the viewer and the reconciliation module
read from the same source, so the boundaries here cannot drift from the ones the code enforces.

<!-- BEGIN GENERATED MATRIX -->
| Layer | Strongest class | Can prove | Cannot prove | Superseded by |
| --- | --- | --- | --- | --- |
| Simulation | `CLIENT_OBSERVED` | - That the transaction executed a particular way against one node's chosen state, at the moment that node ran it.<br>- That a program returned a specific error under those conditions, which is often enough to find a construction bug.<br>- An approximate compute consumption under that state. | - That the same result will occur on chain. Simulation runs against a state that has already moved on.<br>- That the transaction will be included, or included in any particular slot.<br>- Anything about fees actually charged, or about commitment. | - Any landed receipt. A receipt showing a different outcome does not make the simulation wrong; it makes it stale, and only the receipt describes what happened. |
| Sender submission trace | `CLIENT_OBSERVED` | - That this application built, signed and attempted to send a specific message, in a specific order, on one named clock domain.<br>- How many send attempts it made and what each call returned to it.<br>- That a message was rebuilt, and which revision replaced which. | - That any packet left the machine, reached a provider, or reached a leader.<br>- That a response time measures anything about the network rather than the local process.<br>- That an unobserved receipt means the transaction was dropped. Unobserved is unobserved. | - A landed receipt, which can show a signature the sender never observed a response for.<br>- A finalized receipt for a different revision, which retires the assumption that the last attempt is the one that mattered. |
| Preconfirmation / pre-inclusion evidence | `VALIDATOR_ATTESTED` | - That an identified party made a specific statement about this transaction at a time on a stated clock.<br>- With a VERIFIED signature over a described payload: that the holder of a named key committed to that statement. This is the only pre-inclusion fact that survives the issuer denying it later.<br>- What the issuer said it would do, and the deadline it attached. | - That the transaction landed, executed, or committed anything. It is a statement about the future.<br>- That the named slot is where the transaction will appear.<br>- That the issuer had the ability to keep the promise, or that any other party was bound by it.<br>- Anything about position relative to other transactions, unless the attested payload itself describes ordering and is verified.<br>- Latency or delay of any party, from any difference between its timestamps and the sender's. | - A landed receipt, which is the only thing that converts the promise into an outcome. A preconfirmation followed by no receipt is not a broken promise on the evidence alone — it is an unresolved one.<br>- A receipt in a different slot than the one asserted, which contradicts the slot claim while leaving the statement itself accurately recorded. |
| Landed transaction receipt | `CHAIN_PROVEN` | - That the transaction was included in a specific slot, and whether execution succeeded or was rejected.<br>- The fee charged, compute consumed, and the program frame that returned the rejection where logs establish one.<br>- That the transaction committed as one atomic unit, or committed nothing but its fee. | - When it was submitted, which path carried it, or when any leader received it.<br>- Its position in any scheduler, or that it was late, early, or ordered behind anything.<br>- That nearby transactions sharing writable accounts contended with it, or caused its result.<br>- That a different fee, route or provider would have changed the outcome.<br>- That an instruction reached before the rejection committed anything. | - Finalization. A receipt read at processed or confirmed commitment can still be reorganised away. |
| Finalized ledger outcome | `CHAIN_PROVEN` | - That the recorded outcome is settled and will not be reorganised.<br>- Everything the landed receipt proves, now durable. | - Anything the landed receipt could not prove. Finalization settles the outcome, not its causes.<br>- That the path taken was good, bad, fast or slow. | - Nothing on the ledger. This is the terminal layer; later evidence can only add context around it, never overturn it. |
<!-- END GENERATED MATRIX -->

Two features of that table carry most of the weight.

**The preconfirmation layer has a ceiling of `VALIDATOR_ATTESTED`, not `CHAIN_PROVEN`.** No
pre-inclusion evidence is on the ledger, and the schema refuses a record that claims otherwise.

**The receipt layer's `cannot prove` column is long and does not shrink when a preconfirmation is
added.** Ingress time, scheduler position, lateness, and contention are absent from both layers.
Combining them does not produce a fact that neither contains.

## 3. What must be preserved for post-mortem analysis

A preconfirmation that is thrown away after it resolves is worth very little. The fields below are
what make one reconstructable months later, and each earns its place by closing a specific way the
record becomes unreadable.

| Field | Why a post-mortem fails without it |
| --- | --- |
| Signature, and message hash | A sender that rebuilds produces a new signature. Without the hash, a preconfirmation for a superseded revision looks like a mismatch rather than a rebuild. |
| Issuer identity | An unattributed promise cannot be reconciled, aggregated, or followed up. |
| Asserted level, verbatim | Normalising the issuer's own word onto Solana commitment levels destroys what was actually said. |
| Sender-local time **and its clock domain** | A timestamp without its clock is not a measurement. |
| Provider-observed time **and its clock domain** | Same, and it is a different clock. |
| Target slot, if named | The only pre-inclusion claim the ledger can later contradict directly. |
| Expiry or deadline | Separates a promise that lapsed from one that was broken. |
| Attestation, payload description, and verification state | A signature blob without a description of what it covers proves nothing, and one that was never verified is worth no more than the unsigned assertion. |
| Provenance per field | Without it, a provider's assertion and a local measurement become indistinguishable one week later. |

The schema at `research/execution-casefile/preconfirmation.ts` makes the last row structural rather
than advisory: a value cannot be recorded without its provenance, and the record is rejected if any
field claims `CHAIN_PROVEN` or claims `VALIDATOR_ATTESTED` without a verification result and a
verifying key.

## 4. Reconstructing ordering and timing responsibly

This section is the one most likely to be got wrong, including by us, so it is stated as a
constraint rather than a method.

**Timestamps from different parties are not comparable.** A sender's clock and a provider's clock
are different domains, and the offset between them is unbounded and unrecoverable from the readings
alone. The difference between a sender timestamp and a provider timestamp is therefore not a
latency, a delay, or a queue time. `durationBetween` refuses to return a number across domains, and
the reconciliation module records the domains rather than subtracting across them.

**It follows that ordering cannot be reconstructed from timestamps at all** — not from ours, not
from a provider's, not from both together. Any honest ordering reconstruction has exactly one
source: an attestation whose *signed payload itself describes the ordering*, verified against a
named key. If the payload commits only to inclusion, then inclusion is the only thing the signature
establishes, no matter how many timestamps accompany it.

That yields the single most useful thing a sequencing layer can expose for post-mortem work: **sign
the ordering claim, not just the inclusion claim.** An attested statement of the form "this
transaction was sequenced at position N within batch B, under ruleset R" is checkable. A timestamp
is not.

The minimum field set for responsible reconstruction is therefore: a stable transaction identity, a
clock domain attached to every time value, an attestation over a payload that explicitly describes
its scope, and a verification result for that attestation. Anything less supports recording what
happened, but not reconstructing order.

## 5. Claims that still cannot be made

Adding preconfirmation evidence to a receipt does not unlock any of these, and the reconciliation
module lists them on every output:

- When a transaction was submitted, and when any leader received it.
- Its position in any scheduler or queue relative to any other transaction, absent a verified
  attestation that describes position.
- Whether any provider delayed, dropped, reordered, or deprioritised it.
- Whether a different fee, route, provider, or reservation would have changed the outcome.
- Whether nearby transactions sharing writable accounts contended with it.
- Whether the issuer of a preconfirmation had the ability to keep it.

Three additional boundaries hold specifically at the preconfirmation-to-receipt seam:

- **A preconfirmation with no matching receipt is unresolved, not broken.** No receipt in hand is
  not evidence that a transaction failed to land, was dropped, or that an issuer defaulted. It may
  have landed unobserved.
- **A preconfirmation that matches a receipt is not evidence that it caused the inclusion.** Two
  records agreeing shows a statement was made and an outcome occurred.
- **A preconfirmed transaction that lands and then fails execution is not a contradiction.**
  Inclusion and execution are different questions, and a failed transaction commits nothing but its
  fee however it was included.

## 6. What Breadlines would need to produce a rigorous execution-quality study

A study worth publishing requires a pre-registered population, a declared collection window, and
evidence that survives an adversarial reading. Breadlines can build the analysis; the inputs below
are what it cannot obtain from the ledger.

### Telemetry

1. **A preconfirmation record retrievable after the fact, by signature.** Real-time-only delivery
   makes post-mortem work impossible: the interesting cases are found days later.
2. **A clock domain identifier on every timestamp**, stable across a deployment, so readings are
   known-comparable or known-incomparable rather than assumed.
3. **An issue timestamp distinct from an observation timestamp**, so provider-side and
   client-side readings are not conflated.
4. **An attestation with an explicit description of the signed payload's scope**, and a published
   key for verification.
5. **The expiry or deadline attached to the assertion**, so a lapsed promise is separable from a
   broken one.
6. **A stable identifier that survives a sender rebuild**, such as a message hash, so a
   preconfirmation for a superseded revision is recognisable as such.
7. **Where ordering is claimed, an attested position and the ruleset it was determined under.**

### Questions for Jito engineers

These are questions, not assertions about what BAM does or does not do today.

1. What exactly does a BAM attestation's signature cover? Inclusion, ordering, both, or a broader
   statement — and is that scope described in a machine-readable field?
2. Is there a documented public key and verification procedure, so a third party can check an
   attestation without trusting the API that served it?
3. Is a preconfirmation retrievable after the fact by signature, and for how long?
4. Which timestamps in a BAM response are BAM-side observations, and which are relayed from
   elsewhere? Do any share a clock domain?
5. What is the documented meaning of each state a transaction can be reported in, and which states
   are final versus provisional?
6. When a preconfirmation does not resolve to a landed transaction, is there any record on the BAM
   side, and is it retrievable?
7. Does a plugin or maker enrolment change what evidence is available to the sender, and is that
   difference documented?
8. What ordering guarantees are expressed in the attested payload itself, as opposed to described
   in documentation?
9. Is there a supported way to obtain a bounded, pre-registered sample for research, rather than
   collecting opportunistically?
10. What would Jito consider a misuse of BAM evidence in a published study? A list of readings they
    regard as unsupported would be directly useful, and Breadlines would adopt it.

### What Breadlines would commit to in return

A pre-registered protocol published before collection; a declared population and window; no
provider comparison from a sample not designed for it; no causal claim from co-occurrence; and a
correction published if any statement about BAM is shown to be wrong.

## 7. Status and honesty about this document

No preconfirmation data has been collected. The schema, matrix, reconciliation module and viewer
section are built and tested against synthetic fixtures, which exist to prove the model handles
adversarial cases and are never presented as results. The reconciliation module marks any output
derived from a fixture as synthetic, and that marking propagates to every surface.

What exists today is a place to put the evidence, a specification of what would make it useful, and
a machine-checked record of the claims it would not support. What does not exist is any measurement
of any provider, and this memo should not be read as one.

Every prose claim in this memo is checked by `scripts/claim-lint.ts`, which runs the same assertion
tests the adversarial audit applies to rendered surfaces.
