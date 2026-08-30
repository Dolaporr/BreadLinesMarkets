# Stability-read preregistration

Written before inspecting the 6-hour and 12-hour results.

## Stable signal

A metric may be called a stable sampled-ledger signal in the active 6-hour study only if all of the following hold:

1. Its before-to-after direction is the same in the unbuffered 1h, 3h, and 6h windows and in the buffered 6h variant.
2. For a fee-derived metric, removing the highest 1% of observed transaction-fee values independently on each side does not reverse its before-to-after sign. The same check is retained as a sensitivity output for the raw fee totals, which are not eligible for a stable-signal label because they also reflect sampled transaction count.
3. In **each** active comparison, the absolute before/after difference is larger than the greater of the before-side and after-side chronological bucket ranges for that same metric. A bucket range is `max(bucket values) - min(bucket values)` across the six deterministic buckets. This is a deliberately conservative within-window variation gate, not an uncertainty interval.
4. The movement clears the predeclared reporting floor in every window: 1 percentage point for success/failure/failed-CU shares, or 5% for distributional and per-block medians.
5. The result is a ledger composition observation only. It is not evidence that the slot-time change caused the movement.

## Unstable/noisy

A metric is unstable/noisy if its sign reverses in any active comparison, falls below the reporting floor in any active comparison, fails the within-window bucket-variation gate, or (for a fee-derived metric) fails the 1% trimming sensitivity test. A future 12h window remains a stretch robustness check; if collected, it must agree before any public claim is expanded beyond the 6h study.

## Fee treatment

Sampled total fees, success fees, and failure fees cannot alone qualify as stable signals. Transaction-level fee arrays are retained or deterministically enriched for the selected blocks solely to run the fixed 1% trimming sensitivity test; this does not change block or transaction inclusion. Priority-fee distribution results remain separately reportable only where reconstruction coverage is stated; they are not a substitute for a total-fee outlier test.

## Ceiling observation

The per-block cost-unit ceiling check is reported separately from the before/after event study. It needs no directional comparison and is not subject to this stability rule.
