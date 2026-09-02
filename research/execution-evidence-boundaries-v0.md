# Execution Evidence Boundaries on Solana

**Breadlines research note — v0**  
**Date:** 2026-09-02  
**Status:** Public discussion draft; not a product specification or performance claim.

![Illustrative execution evidence boundary](assets/execution-evidence-boundaries-cover-v1.png)

*Illustrative cover only. All factual claims in this note are supported by the cited sources below.*

## Summary

Solana's execution stack is becoming more capable at several distinct layers:

- protocol/runtime execution;
- transaction delivery and leader reachability;
- sequencing and ordering;
- app-level construction, signing, retries, and receipt display.

Those layers should not be collapsed into one vague question: *“Why did my transaction fail?”*

The ledger can establish a final landed outcome and often the program frame that failed. It cannot, by itself, establish when a transaction was first submitted, which provider path carried it, whether it was dropped before landing, its arrival order at a leader, or whether nearby activity caused the outcome.

Breadlines is exploring a complementary evidence layer: a receipt that preserves those boundaries rather than replacing infrastructure providers, inferring missing telemetry, or assigning blame without proof.

## 1. The execution layers are different questions

| Question | Example evidence | What it can establish | What it cannot establish alone |
|---|---|---|---|
| Was it finally executed? | Finalized ledger transaction and metadata | Landed success/failure, fees, compute consumed, and sometimes a failing program frame | Submission time, provider path, dropped attempts, leader arrival order |
| How was it delivered? | Opt-in client/provider send events | Attempt time, provider acknowledgement, retry history, and provider-specific receipt states | Final execution semantics without joining to the ledger receipt |
| How was it ordered? | Sequencer-specific attestations and stated sequencing rules | Whether evidence supports an ordering claim within that system | A universal ordering story for traffic outside that system |
| Why did application logic reject it? | Logs, failing invocation frame, documented error semantics, program state evidence | A deterministic failure class when the program evidence supports it | A human intent story, causality from nearby traffic, or a claim that a particular provider caused it |

The point is not that one layer is more important than another. The point is that a useful receipt should say **which layer its conclusion comes from**.

## 2. What adjacent infrastructure already contributes

### Anza / Solana core

Anza is advancing protocol performance, scheduling, runtime, and validator software. In its 2026 roadmap, CEO Brennan Watt describes continued work on bandwidth, latency, schedulers, block limits, and test-cluster work; Anza's Constellation proposal also discusses fair market structure and proposer behavior. [Anza26](https://www.anza.xyz/blog/anza26) · [Constellation](https://www.anza.xyz/blog/constellation)

**Breadlines’ complementary question:** Which landed-ledger observations are stable enough to discuss around a protocol transition, and which are too confounded by time window, workload composition, or unavailable sender-side data?

Breadlines' own 350ms-to-300ms research reached a deliberately narrow conclusion: a ledger-side before/after result changed materially when the observation window widened. That is a methodology finding, not a causal claim about the protocol change.

### Jito / BAM

Jito describes BAM as a layer for transparent, verifiable sequencing, with cryptographically signed attestations that ordering followed its rules. [Jito BAM](https://www.jito.network/bam/)

**Breadlines’ complementary question:** How should an application receipt expose final execution evidence and any available sequencing evidence without extrapolating beyond the system that produced it?

Breadlines does not claim to reproduce BAM, make ordering decisions, or infer BAM participation merely from a generic Solana transaction.

### Triton / Cascade

Triton describes Cascade as a SWQoS-backed transaction-delivery network and publishes client-side guidance covering retries, compute budgets, and priority fees. [Cascade](https://docs.triton.one/chains/solana/cascade) · [Transaction sending advice](https://docs.triton.one/chains/solana/cascade/sending-txs)

**Breadlines’ complementary question:** Can an opt-in application trace join its delivery attempts and retry history to the final ledger receipt, while keeping delivery-layer evidence separate from later program execution?

Breadlines does not claim to measure Cascade use, delivery quality, or causal landing advantage from public ledger data alone.

### Helius / Sender

Helius describes Sender as a low-latency transaction-submission service with routes through validator and Jito infrastructure, alongside application-controlled transaction settings such as retries and preflight behavior. [Sender documentation](https://www.helius.dev/docs/api-reference/sender/sendtransaction) · [Transaction sending overview](https://helius.mintlify.app/sending-transactions/overview)

**Breadlines’ complementary question:** What minimal opt-in event model would let an application connect an attempted submission, provider acknowledgement, retries, and its final ledger receipt—without storing keys or claiming that an unobserved transaction was dropped?

Breadlines does not claim to see Sender’s internal routing, precise sender geography, leader arrival time, or unlanded traffic without source-specific telemetry.

## 3. The Breadlines proposal: evidence-bounded execution receipts

An evidence-bounded receipt should distinguish:

1. **Chain-proven** — final landed state, fee, compute consumption, raw error, failing invocation frame where recoverable.
2. **Directly observed** — declared local context, such as other transactions sharing writable accounts in a disclosed block/slot sample.
3. **Supported inference** — explicitly labeled and only where methodology supports it.
4. **Unknown** — facts requiring missing telemetry: submission time, ingress, unlanded attempts, arrival order, identity, and causal counterfactuals.

The objective is not to say more than an explorer. It is to prevent a receipt from silently turning an inference into a fact.

## 4. What Breadlines is not proposing

Breadlines is not currently proposing:

- a transaction router, sequencer, scheduler, or custody system;
- a guarantee that a transaction will land;
- a model of dropped-before-landing traffic from ledger data;
- sender-geography, human/bot, or identity classification from block data;
- automatic blame of an integrator, router, or execution provider when a downstream program fails;
- a prediction, token ranking, or trading recommendation.

## 5. Useful technical questions for the ecosystem

These are research questions, not claims that any provider currently lacks a feature:

1. What receipt/attestation fields can providers expose so an app can correlate a submission attempt with a final ledger signature?
2. Which provider states are final, which are provisional, and what is their documented retention/uniqueness contract?
3. What event schema would let an app preserve retries and expiry without retaining raw signed transactions or private keys?
4. Which ordering evidence is system-specific, and how should applications prevent it from being misread as a global Solana ordering claim?
5. What is the minimum public evidence required before describing a failed transaction as a delivery issue, a sequencing issue, or an application-program rejection?

## 6. Invitation to correct the boundaries

This note is intentionally conservative. If any source-specific state, receipt, attestation, or telemetry guarantee has been misstated or omitted, Breadlines welcomes a correction with public documentation.

The goal is a shared vocabulary in which protocol teams, execution providers, applications, and users can talk about execution without making the ledger prove more than it can.

## Sources

- [Anza26 — Brennan Watt, CEO](https://www.anza.xyz/blog/anza26)
- [Anza: Solana Constellation](https://www.anza.xyz/blog/constellation)
- [Jito BAM overview](https://www.jito.network/bam/)
- [Triton Cascade](https://docs.triton.one/chains/solana/cascade)
- [Triton transaction-sending advice](https://docs.triton.one/chains/solana/cascade/sending-txs)
- [Helius Sender API](https://www.helius.dev/docs/api-reference/sender/sendtransaction)
- [Helius transaction-sending overview](https://helius.mintlify.app/sending-transactions/overview)
- [Breadlines 300ms methodology report](slot-time-300ms-boundary/final-report.md)
