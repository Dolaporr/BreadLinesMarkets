# SIMD-0553 Tower-Defense Feasibility Probe

## Scope

Internal, devnet-only, deterministic probe. This is not a production Breadlines feature, public claim, price prediction, or policy verdict.

## A. Program Attribution

- Program: `td8VwogVVaauJYMNYWEsagCHiX7P3imLC2kuW23rZkm`
- Cluster: devnet
- Executable account: true
- Selection: most-recent consecutive program-address signature history; retain only transactions where the supplied program is an **outer** instruction. No fee, outcome, signer, compute, or log selection.
- Candidates fetched: 350; outer-program transactions retained: 87; rejected: 263.
- Assessment: Clean enough for a bounded devnet economics probe. This proves outer-program attribution, not application semantics beyond program/log evidence.

## B. Sample

- Range: slots 477,623,324 through 483,826,688 (newest-first collection, records preserved in collection order).
- Block time: 2026-07-20T13:17:39.000Z through 2026-08-14T14:51:35.000Z.
- Landed successes: 85; landed-but-failed: 2.

## C. Current Economics

| Metric | Min | Median | P90 | P95 | Max |
|---|---:|---:|---:|---:|---:|
| Current observed fee (lamports) | 5,000 | 5,000 | 5,000 | 25,000 | 25,000 |
| Derived priority fee (lamports) | 0 | 0 | 0 | 20,000 | 20,000 |
| Requested CU | 200,000 | 1,400,000 | 1,400,000 | 1,400,000 | 1,400,000 |
| Consumed CU | 7,327 | 59,975 | 448,027 | 551,600 | 914,546 |
| Requested / consumed | 1.53 | 15.62 | 49.74 | 85.85 | 104.19 |

## D. SIMD-0553 Formula

- Source: [SIMD-0553 draft @ fc519fb](https://github.com/solana-foundation/solana-improvement-documents/blob/fc519fb3d1ef0f7624b6232bda958438feba09ce/proposals/0553-resource-fee-burn.md).
- Formula: `total_fee = 2,500 base inclusion + unchanged priority fee + ceil(requested_cost_units × rate)`.
- Rates: 1/10, 1/4, and 1/2 lamports per requested cost unit are the draft’s three feature-gated resource-fee rates.
- Requested cost: signature verification + write locks + instruction data + requested CU limit + requested loaded-account data size.
- Source code pin for resource definitions/constants: [Agave @ 29aae88](https://github.com/anza-xyz/agave/blob/29aae881683a7e203d12dfd57812d5be5fe9abc5/cost-model/src/cost_model.rs).

## E. Counterfactual Results

| Rate | Fee median | Fee p90 | Fee p95 | Fee max | Increase median | Increase p90 | Increase max |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1/10 | 144,301 | 144,302 | 144,302 | 144,302 | 2,786% | 2,786% | 2,786% |
| 1/4 | 357,003 | 357,003 | 357,003 | 357,003 | 7,040.1% | 7,040.1% | 7,040.1% |
| 1/2 | 711,505 | 711,506 | 711,506 | 711,506 | 14,130.1% | 14,130.1% | 14,130.1% |

All values in this table are **COUNTERFACTUAL / DERIVED**, not observed fees.

## F. Cost Driver

| Requested-cost term | Median share |
|---|---:|
| signatureCost | 0.05% |
| writeLockCost | 0.06% |
| instructionDataCost | 0% |
| programsExecutionCost | 98.73% |
| loadedAccountsDataSizeCost | 1.16% |

## G. Jonas’s Reported Increase

Classification: **DIRECTIONALLY SUPPORTED**. This probe uses a consecutive devnet sample rather than selecting a reported example. Compare the distribution above, not a single receipt, with the reported range.

## H. Block Fullness

The pinned draft’s fee formula is resource-reservation-dependent: it uses requested transaction cost and the active rate, not block utilization. This report does not treat low utilization as a fee discount input.

## I. Failure Treatment

- Observed landed-but-failed transactions: 2.
- The draft explicitly preserves full total-fee debit for fee-only failures. For each landed failure here, current observed fee and the same counterfactual resource formula are retained; the report does not assert that every runtime failure path has identical handling.

## J. Breadlines Case-Study Value

**PROMISING — NEEDS LARGER SAMPLE**. The program has a clean devnet outer-instruction population and the formula is reconstructible from message-level resource requests. This 87-transaction consecutive feasibility sample directionally supports large increases where transactions reserve 1.4M CU, but it is not a policy conclusion or a full application-history study.

## K. Recommended Next Sample

If this study is extended, collect **250** consecutive outer-program transactions across the next older history pages. That is enough to test whether the 1.4M-CU reservation pattern and its fee distribution persist without jumping prematurely to a broad or selectively assembled study.

## Evidence Boundary

- **OBSERVED:** devnet account executability, signature history, slots/times, outer program instruction, status, total fee, signatures, account keys, Compute Budget instructions, consumed CU, RPC `meta.costUnits`, logs, and failure evidence.
- **DERIVED:** current priority fee, requested resource terms, current distributions, requested/consumed ratios, and all counterfactual SIMD-0553 totals.
- **COUNTERFACTUAL / DERIVED:** every SIMD-0553 total and delta.
- **UNKNOWN:** user/application intent, urgency, congestion, competition, policy outcome, price impact, and why any transaction chose its resource limits.
