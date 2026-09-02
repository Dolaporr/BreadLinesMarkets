# 0x Settler 500-execution study

## Scope and frozen sample

- Population: **0x Settler executions**, not necessarily public 0x Swap API executions.
- Documented Settler program: `Sett1erwx2eqT5A8uvu8GBxDFT2W5TNnhirL7hLmb8m`.
- Fixed interval: `2026-08-15T03:27:57.000Z` through `2026-08-15T18:15:31.424Z`.
- Five descending Helius full-result pages; first 500 locally verified outer-Settler instructions retained, then written chronologically.
- No success, signer, error, route, fee, token, or behavioural selection.

## Population

| Measure | Result |
| --- | ---: |
| Retained Settler executions | 500 |
| Successful | 271 |
| Landed-but-failed | 229 |
| Failure rate | 45.80% |
| Distinct failure classes | 10 |
| Distinct affected signing fee-payers | 11 |

## Attribution and explanation depth

| Failure execution layer | Count |
| --- | ---: |
| Downstream program | 211 |
| Settler frame | 14 |
| System or Token Program | 2 |
| Unknown attribution | 2 |

- **227 / 229 (99.13%)** landed failures can be attributed to an execution layer.
- **0 / 229 (0%)** has an evidence-backed useful plain-language explanation under the frozen receipt-evidence standard.
- 227 are technical-but-opaque custom/program failures; two have insufficient evidence.

## Recurrence and actor concentration

The dominant class is downstream program `proVF4…CX3u` custom `6010` / `0x177a`: **204 failures**, all from one signer/fee payer. That signer has 48 successful transactions with the closest observed structural score and 204 failures are not ecosystem-wide evidence.

| Recurring class | Count | Unique signers | Top-1 share |
| --- | ---: | ---: | ---: |
| Downstream `proVF4…CX3u`, `6010` | 204 | 1 | 100% |
| Settler, `7001` / `0x1b59` | 8 | 5 | 50% |
| Settler, `7000` / `0x1b58` | 5 | 3 | 60% |

Across the complete failure population, the top signer accounts for **92.14%**; top five account for **97.38%**; top ten account for **99.56%**. Only one affected signing fee-payer also has a successful execution in the frozen population.

## Opaque error investigation

- `6010` / `0x177a`: all 204 instances fail in `proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u`. No structured error was emitted, and no first-party source, verified program source, IDL, or program-specific error table was found. It remains opaque.
- `7001` / `0x1b59`: all eight instances fail in the Settler frame across five signers. No structured error was emitted, and no first-party 0x Settler error table, IDL, or verified client error map was found. It remains opaque.
- `7000` / `0x1b58`: five Settler-frame instances across three signers; likewise opaque.

No numeric mapping was borrowed from a different Anchor/Solana program.

## Structural comparisons

Closest-success comparisons use only observed outer-program order, Settler instruction positions, fee payer, overlapping downstream program, fees/CU, and persisted account keys. They establish similarity, not cause.

- `6010`: 48 successful receipts score 8 / 8 by this observed similarity scheme.
- Settler `7001`: 31 successful receipts score 7 / 8.
- Settler `7000`: 4 successful receipts score 7 / 8.

## Commercial answers

1. Correct layer attribution: **99.13%** of landed failures.
2. Useful evidence-backed plain-language explanations: **0%**.
3. Distinct failure classes: **10**.
4. Distinct affected signers: **11**.
5. Failure activity is highly concentrated: **92.14%** in one signer.
6. Settler is the failing frame in **14 / 229 (6.11%)**; downstream programs in **211 / 229 (92.14%)**.
7. A generic integrator would benefit from correct layer attribution, but this sample does not establish a materially useful human-readable diagnosis layer.
8. Frequency exists, but multi-actor explanatory depth does not.

## Verdict

# WEAK WEDGE

This sample demonstrates strong, non-blaming execution-layer attribution. It does not justify an integrator-facing micro-product yet: the major failure class is one actor and the recurring Settler errors remain opaque. No claim is made about 0x Swap API origin or current 0x UI visibility.
