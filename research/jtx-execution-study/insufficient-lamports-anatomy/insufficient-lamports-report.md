# JTX sample — InsufficientLamports anatomy

## What the chain proves

- All 159 failures are quantified System Program transfer rejections: the log gives both available and required lamports.
- Every failure shares one structural fingerprint: `DFlow → System Program` at invocation depths 1 → 2. The System transfer is a CPI, not an outer instruction.
- The uniquely recovered System transfer is outer instruction **2** in every transaction. The two outer JTX instructions occur later, at positions **3** and **5**. Thus no JTX instruction is an ancestor of this failure frame.
- One signing fee-payer/source address generated all 159 failures. The source and destination accounts are each also constant across all 159 receipts.
- Requested transfers fall into four amounts (3.131B–8.527B lamports); observed available source lamports are 1.465B–1.468B. Every attempt therefore has a quantified shortfall (1.663B–7.062B lamports).
- The source is also the sole signer and fee payer. This supports a statement about that signing source account's insufficient lamports; it does not identify a person, wallet application, or account owner.

## Actor concentration

| Measure | Result |
| --- | ---: |
| InsufficientLamports failures | 159 |
| Unique signers | 1 |
| Unique fee payers | 1 |
| Top-1 / top-5 / top-10 signer share | 100% / 100% / 100% |
| Same fee payer with successful executions in the frozen 500 | 114 successful executions |

This is Scenario A: a single recurring address, not a broad multi-address population.

## Structural fingerprint

- Parent program: DFlow in 159 / 159.
- Invocation path: `DF1ow...7QBH → 1111...1111` in 159 / 159.
- Outer instruction shape: two JTX instructions at positions 3 and 5 in 159 / 159; failing DFlow outer instruction at position 2 in 159 / 159.
- Recovered transfer source and destination: each one recurring account across all 159, recovered uniquely from parsed inner instructions.
- Compute Budget: 1,400,000 CU limit and 3,571 micro-lamports/CU price in 159 / 159. Transaction fee: 10,000 lamports in 159 / 159. CU consumed: 22,079 in 159 / 159.
- Time spacing after chronological ordering: 0–2,700 seconds, mean about 200 seconds.

## Success comparison

The same signing source address has 114 successful transactions in the fixed 500-execution sample. Seven have the exact outer shape: DFlow at index 2 and JTX at indices 3 and 5.

Those seven successfully transfer between the same recovered source/destination pair at outer instruction 2, but their observed transfer amounts are 177,281–3,752,214 lamports, versus 3.131B–8.527B in the failed set. Their observed source pre-balances are roughly 1.467B lamports. This establishes an observed structural and amount contrast only; it does not establish intent or a product-level cause.

## Attribution boundary

| Statement | Status |
| --- | --- |
| A. The wallet did not have enough SOL | **SUPPORTED BUT INCOMPLETE** — the signing source account lacks enough lamports; no person, wallet app, or owner is identified. |
| B. A System Program transfer did not have enough lamports available | **PROVEN** — exact logged available and requested amounts. |
| C. A JTX-controlled account did not have enough lamports | **NOT ESTABLISHED** — control/ownership is not proven. |
| D. A JTX instruction caused this CPI | **FALSE for this cluster** — DFlow is the parent, and the transfer is outer instruction 2 before JTX instructions 3 and 5. |
| E. The user attempted to trade more SOL than available | **NOT ESTABLISHED** — transfer semantics and user intent are not proven. |
| F. JTX order architecture produced the condition | **NOT ESTABLISHED** — the deterministically failing frame is DFlow, not JTX. |

## Is this plausibly a JTX product problem?

**NO for this 159-failure cluster.** It is one address and the failure deterministically belongs to a DFlow → System Program path that precedes the outer JTX instructions. This does not rule out a general execution-explanation integration.

An evidence-backed receipt could nevertheless convey materially more than a generic `failed` state: the shortfall, source-account boundary, DFlow parent frame, and the fact that JTX was not the failing frame. What JTX currently shows users remains **UNKNOWN**.
