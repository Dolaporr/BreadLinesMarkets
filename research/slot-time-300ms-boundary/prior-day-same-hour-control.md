# Matched same-hour prior-day control

The control window is `2026-08-27T09:25:03.000Z` to `2026-08-27T15:25:03.000Z`, exactly 24 hours before the fixed pre-boundary window. It uses 120 deterministic evenly ranked landed blocks and the same vote-only exclusion.

| Bucket | Transition-pre non-vote tx | Prior-day non-vote tx | Transition-pre success rate | Prior-day success rate |
| --- | ---: | ---: | ---: | ---: |
| 1 | 10,222 | 13,014 | 74.83% | 71.85% |
| 2 | 11,267 | 11,253 | 75.76% | 66.44% |
| 3 | 13,367 | 13,055 | 65.53% | 68.51% |
| 4 | 14,119 | 14,124 | 64.93% | 66.67% |
| 5 | 24,999 | 21,529 | 52.51% | 54.26% |
| 6 | 23,028 | 21,052 | 55.20% | 50.69% |

Interpretation boundary: similar or different bucket shapes can motivate or weaken a time-of-day hypothesis, but this one matched-day control cannot identify its cause.
