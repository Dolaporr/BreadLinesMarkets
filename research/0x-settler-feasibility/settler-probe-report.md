# 0x Solana Settler attribution feasibility probe

## A. Settler fingerprint

- Program: `Sett1erwx2eqT5A8uvu8GBxDFT2W5TNnhirL7hLmb8m`
- The program account is executable and active.
- Fixed bounded sample: the first 100 recent Settler address-history results, ordered chronologically for output.
- All 100 / 100 locally contain an **outer** Settler instruction.
- Population: 53 successful, 47 landed-but-failed (47.0%).

This validates a reliable **0x Settler execution** population. It does not validate a population of 0x Swap API executions.

## B. API-origin attribution

| Marker | Assessment | Boundary |
| --- | --- | --- |
| Optional Dashboard onchain tagging for an integrator's own app | CONFIRMED API-SPECIFIC when configured | Not observed in this public sample; not a public all-API marker. |
| Outer Settler instruction | SETTLER-SPECIFIC BUT NOT API-SPECIFIC | All API swaps use it, but Settler includes non-API activity. |
| Instruction data, accounts, ALTs, fee patterns | POSSIBLE | Observed, but no canonical API-origin rule exists. |
| `zid` as public onchain attribution | REJECTED | It is an API request identifier; no canonical onchain API-origin tag exists. |
| Generic DEX routes / Compute Budget | REJECTED | Shared Solana transaction components. |

## C. 0x-parser boundary

The first-party `@0x/0x-parser` repository describes an EVM transaction parser. This probe found no first-party evidence of Solana support, so no Solana capability is established for final amounts, failure state, CPI attribution, named failing instructions, decoded errors, or fee/CU analysis.

## D. Failure-side evidence

The population contains 47 landed failures. The deterministic ten-receipt forensic subset is selected only by signature:

- 8 fail in downstream program `proVF4…CX3u`: seven opaque custom `6010` / `0x177a`, one with no human-readable program error.
- 2 fail in the Settler frame: opaque custom `7001` / `0x1b59`.

For each retained forensic receipt, the raw evidence preserves: outer Settler involvement, active failing frame, logs, reason where deterministically available, and the attribution boundary. No receipt claims Settler caused a downstream failure.

## E. Verdict

**GO.** A larger, unchanged-methodology study is justified for the 0x Settler execution population. It should explicitly test whether Breadlines can attribute Settler versus downstream failures, because first-party parser support for Solana failure diagnosis was not established here.

Any future study must preserve the critical limitation: monitoring Settler cannot prove an execution originated from the public 0x Swap API.
