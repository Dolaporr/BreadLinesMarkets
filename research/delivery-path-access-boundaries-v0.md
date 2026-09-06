# Why a Controlled Solana Delivery-Path Study Is Not Yet Runnable

**Breadlines research note — v0**  
**Date:** 2026-09-05  
**Status:** Pre-publication draft. No study transaction has been sent, and this is not a delivery-path performance claim.

## Summary

Breadlines preregistered a proposed controlled comparison of four proposed transaction-delivery paths: Axiom, Nozomi, Jito BAM, and Direct TPU.

Before collecting data, we checked whether the four paths were publicly reachable and whether they could accept equivalent transactions. That access check stopped the study.

Three findings matter:

1. **Axiom:** the public Axiom materials we could locate document trading-product settings, but do not document an external raw-transaction submission endpoint, authentication method, rate limit, or developer pricing surface for this experiment.
2. **Nozomi:** its public submission service requires every transaction to include a minimum 0.001 SOL System Program tip. A comparison in which only the Nozomi arm contains that instruction is not a transaction-shape-controlled path comparison.
3. **BAM and generic ingress:** BAM documents a specialised Maker Priority Plugin sender for statically enrolled market makers. Separately, it says both RPC and Direct-TPU flow are routed through BAM on a connected leader. The plugin is not a general research sender surface, and generic ingress does not provide a clean non-BAM control there.

This is a negative access result, not evidence that any path is better or worse. It is exactly the kind of result a preregistration should surface before a measurement creates a misleading chart.

## 1. The proposed question

The intended question was deliberately narrow:

> Do delivery paths differ in finalized landed outcomes for functionally equivalent Breadlines-controlled transactions, under predefined conditions?

It was never intended to measure general path quality, third-party flow, sender geography, dropping before landing, trading execution, or the cause of a difference.

For that question to be meaningful, each arm needs two properties:

1. **Reachability:** Breadlines can submit through the documented public or granted interface.
2. **Equivalence:** each arm can receive the same functional transaction shape and fixed compute settings, apart from unavoidable fresh blockhash and inert trial-ID fields.

The access check found that neither condition currently holds across the proposed four-path set.

## 2. Finding: Axiom does not document a public sender surface we could find

Axiom’s public Solana documentation describes user-facing trading settings such as priority fees, bribes, and MEV modes. It describes, for example, an MEV-off mode as broadcasting to Jito and standard leaders, and an MEV-enabled mode as using Jito. [Axiom: Solana Fees](https://docs.axiom.trade/getting-started/fees/solana-fees)

That is useful product documentation. It is not a documented external transaction-submission interface for an independent controlled study.

Breadlines did not find public Axiom documentation specifying a raw signed-transaction endpoint, developer authentication procedure, rate limit, or developer pricing for a third-party harness. The correct conclusion is not “Axiom cannot submit transactions.” The correct conclusion is narrower: **Breadlines cannot treat Axiom as a documented independently callable study arm without an Axiom-provided integration surface.**

## 3. Finding: Nozomi changes the transaction shape unless every arm carries its tip

Nozomi publishes a transaction-submission JSON-RPC surface. It supports `sendTransaction`, requires an API key, and publishes auto-routed and regional endpoints. It also states that Nozomi only supports transaction submission, so a separate Solana RPC endpoint is needed for blockhash retrieval and receipt observation. [Nozomi: Transaction Submission](https://use.temporal.xyz/nozomi/transaction-submission-json-rpc)

Its FAQ further states that every transaction must include a System Program transfer to a Nozomi tip account, with a minimum tip of **0.001 SOL**. It says API-key limits are associated with each key, but does not publish a universal numeric rate limit. [Nozomi: Tipping & FAQ](https://use.temporal.xyz/nozomi/tipping-and-faq)

That mandatory transfer is not a cosmetic implementation detail. It changes the instruction list, writable accounts, fee payer balance requirement, and transaction economics.

If only the Nozomi arm contained that transfer, any observed difference would combine delivery path with transaction shape. Calling that a controlled path comparison would be wrong.

A later two-arm design could, in principle, put the identical Nozomi tip instruction into both the Nozomi and Direct-TPU arms. That would make the transaction shape comparable between those two arms, but it would be a study of **Nozomi submission versus a self-operated direct-TPU submission for the same tipped transaction**—not a general “normal transaction” benchmark. That is a different design and would need a separately reviewed preregistration.

## 4. Finding: RPC and Direct TPU are not clean non-BAM controls on a BAM-connected leader

Solana distinguishes submission through an RPC server from direct submission to leaders through a TPU client. In the direct case, client software owns leader forwarding and rebroadcast behavior. [Solana: Retrying Transactions](https://solana.com/developers/cookbook/transactions/retry)

Direct TPU is therefore not a hosted vendor endpoint that Breadlines can simply compare beside an HTTP API. It requires a controlled client, leader discovery, outbound QUIC connectivity, an RPC source for blockhashes and finalization checks, and a specified rebroadcast policy.

More importantly, BAM’s public documentation states:

> “RPC flow: If your validator is connected to BAM and scheduled to be a leader soon, transactions submitted via RPC are routed through BAM.”
>
> “Direct TPU flow: Transactions sent directly to your TPU port are processed through BAM before execution.” [BAM Documentation](https://bam.dev/docs/bam/bam-overview/)

Those statements apply when the receiving validator is connected to BAM. They mean neither an RPC attempt nor a Direct-TPU attempt is a reliable non-BAM control on such a leader: both may enter BAM’s processing path before execution.

This does not make RPC or Direct TPU invalid. It makes the originally proposed **BAM versus Direct TPU** contrast ambiguous. A valid future BAM study would need an explicit plan for determining what execution environment each trial actually reached, not an assumption based on the client’s ingress choice.

## 5. Finding: BAM documents an enrolled Maker Priority Plugin, not a general research sender

The BAM Maker Priority Plugin is a documented transaction ingress path for **enrolled market makers**. Its Plugin TPU accepts raw wire-format Solana transactions as UDP datagrams on default port `5012` (with the operator asked to confirm the port). The documentation specifies a canonical transaction structure, including an enrolled signing key, Compute Budget instructions, an enrolled market-update program, a writable enrolled market account, and a configured 8-byte sequence number. [BAM Maker Plugin: Getting Started](https://bam.dev/docs/bam/maker-plugin/getting-started/)

This is not an open sender interface. The BAM node operator configures enrollment before the node starts; authorised signers, programs, markets, sequence-number offsets, and fee floors are static. BAM explicitly says there is no runtime registration API. [BAM Maker Plugin: How It Works](https://bam.dev/docs/bam/maker-plugin/how-it-works/)

Breadlines is not an enrolled market maker with an enrolled market-update program and market account. Its proposed harmless study transaction therefore cannot satisfy the documented plugin transaction and validation rules. That—not an absence of documentation—is the reason BAM cannot currently be a study arm.

The distinction matters because the plugin is structurally different from ordinary traffic. BAM says Phase 1 drains enrolled maker-plugin transactions before bundles and regular transactions, and that this ordering cannot be changed by higher fees or tips. The correct future question is whether enrollment is strictly market-maker scoped or whether BAM supports a deliberately bounded research-sender path; it is not whether BAM has documented a sender interface at all.

## 6. What this note establishes—and what it does not

### Established by public documentation

- Nozomi has a documented API-keyed `sendTransaction` service and a minimum-tip requirement.
- BAM documents a UDP Maker Priority Plugin with static market-maker enrollment and strict transaction validation rules.
- BAM documents that both RPC and Direct-TPU flow through a BAM-connected validator are processed through BAM before execution.
- Solana documents Direct TPU as client-managed leader submission and forwarding, rather than a single hosted sender product.
- Breadlines did not find a documented public Axiom sender integration for this exact experiment.

### Not established

- relative quality, latency, reliability, privacy, ordering quality, or cost-effectiveness of Axiom, Nozomi, BAM, or Direct TPU;
- whether a particular transaction would have landed through another path;
- whether a provider’s internal system is responsible for a landed outcome;
- whether any provider is unwilling to support a controlled study;
- sender geography, third-party submission behavior, dropped traffic, or leader-arrival timing.

No transaction was sent. There are no performance results to interpret.

## 7. What would make a later study possible

A credible later study needs one of two routes:

1. **A documented, equivalent public interface:** each included arm accepts the same signed transaction shape, with published auth, cost, and rate-limit terms; or
2. **A declared two-arm mechanism study:** for example, Nozomi versus self-operated Direct TPU, with the mandatory Nozomi tip transfer deliberately included in both arms and all remaining client behavior fixed in advance.

BAM would require a market-maker enrollment that genuinely fits the study, or a separately documented research-sender enrollment path, plus a way to join scheduler evidence to a final ledger receipt. Axiom would require a documented external submission interface, if it intends to be a separately measurable arm.

Until then, the honest result is that the original four-path comparison is **not runnable as a controlled study**.

## 8. Why stopping here is useful

The easy failure mode would have been to send transactions through whatever interfaces happened to be available, produce a chart, and call the columns “paths.”

That would have hidden at least three different mechanisms: a product’s undocumented internal routing, a mandatory tip instruction, and the scheduler already processing a supposed control flow.

Stopping before collection preserves the useful question for later. It also draws a necessary boundary: access documentation and transaction equivalence are part of execution methodology, not administrative details to fix after results arrive.

## Sources

- [Axiom: Solana Fees](https://docs.axiom.trade/getting-started/fees/solana-fees)
- [Nozomi: Transaction Submission (JSON-RPC)](https://use.temporal.xyz/nozomi/transaction-submission-json-rpc)
- [Nozomi: Tipping & FAQ](https://use.temporal.xyz/nozomi/tipping-and-faq)
- [Jito BAM](https://www.jito.network/bam/)
- [BAM Documentation](https://bam.dev/docs/bam/bam-overview/)
- [BAM Maker Priority Plugin: Getting Started](https://bam.dev/docs/bam/maker-plugin/getting-started/)
- [BAM Maker Priority Plugin: How It Works](https://bam.dev/docs/bam/maker-plugin/how-it-works/)
- [Solana: Retrying Transactions](https://solana.com/developers/cookbook/transactions/retry)
