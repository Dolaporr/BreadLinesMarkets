# TOAD Large Execution Study

This is a systematically selected partial transaction study, not a complete record of all TOAD activity, token holders, or market participants.

## Coverage And Method

- Target mint: `A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump`.
- Coverage: slots 438061664 through 438429195.
- 8,770 unique transactions were retained and fetched; no receipt fetches failed.
- Two interleaved sets of 250 evenly spaced block positions were used. A transaction was eligible only when its account keys contained the TOAD mint. Up to 32 eligible signatures per block were retained by stable FNV-1a signature-hash order.
- Selection did not use status, signer, fees, programs, compute, logs, token balances, or errors. The sample is broad across time, but it is not a count of all TOAD transactions because high-activity blocks are capped at 32 records.

## Observed And Derived Summary

- OBSERVED: 6,059 of 8,770 sampled transactions landed successfully; 2,711 landed but failed.
- OBSERVED: 333 distinct primary signer addresses appeared in the study. Primary signer is the first transaction signer, not a proven user identity.
- DERIVED: overall top 1 / 5 / 10 primary-signer transaction shares were 16.4% / 36.2% / 55.2%; HHI was 0.0488.
- DERIVED: top 1 / 5 signer shares of successful sampled transactions were 23.8% / 49.2%.
- DERIVED: this does not support a claim that successful execution was broadly distributed. Successful execution remained materially concentrated among a small address set.

## Participation And Recurrence

- 233 addresses first appeared with a successful sampled transaction. Of those, 26.6% appeared again in a later sampled slice and 24.5% later had another successful sampled transaction.
- 100 addresses first appeared with a failed sampled transaction. Of those, 76.0% appeared again and 34.0% later had a successful sampled transaction.
- Sequence counts across observed primary-address histories: success -> success 5,121; success -> failure -> success 353; failure -> success 705; failure -> failure 1,906.
- These are address-recurrence and sequence observations. They do not establish user retention, retries, trader intent, or causal improvement.

## Time Structure

The 20 chronological slices had 184 to 735 sampled transactions each. Success rate ranged from 60.8% to 79.6%; it finished at 78.4% and 79.6% in the final two slices after 60.9% in slice 18. That is a descriptive recovery in the sample, not proof that network or market conditions caused it.

New primary addresses continued to appear in every later slice, ranging from 3 to 27 per slice after the initial 85. Successful new addresses also appeared in every later slice, ranging from 3 to 19. Returning successful addresses appeared in every slice after the first, ranging from 19 to 41.

## Execution Ecology

- DERIVED: 1,863 failures carried an observed custom program error with no authoritative human-readable meaning and are classified as opaque custom errors.
- OBSERVED: 728 failed transactions emitted explicit no-profit/no-profitable-route-or-pair logs; 79 more had a structured `NoProfit` error name.
- OBSERVED: the 728 explicit log cases were emitted through three failing program IDs: `4Qv3...HSyi` (472), `Prism...F7qv` (230), and `HiPM...Prkf` (26).
- OBSERVED: 27 primary signer addresses account for those 728 explicit no-profit cases. The top 1 / 3 / 5 account for 22.4% / 41.1% / 54.7%.
- PATTERN: explicit no-profit failures are therefore concentrated program behavior and address activity, not evidence that all TOAD participants experienced the same execution problem.

## Potential Market-Health Signals

### Persistent Address Recurrence

- Metric: 26.6% of first-observed successful addresses reappeared later; 24.5% later succeeded again.
- Why it could be interesting: sampled successful execution was not a one-shot-only phenomenon.
- Alternative explanations: address recurrence can represent automated execution, market makers, infrastructure, or one actor operating multiple addresses.
- Confidence: medium for recurrence; low for participant-quality interpretation.
- Breadlines can claim: some sampled signer addresses returned and continued to land successful transactions.
- Breadlines must not claim: user retention, organic adoption, loyalty, or a bullish demand signal.

### Continued New Address Arrival

- Metric: 3 to 27 first-observed addresses appeared in every post-initial slice; 3 to 19 of them landed a success in that slice.
- Why it could be interesting: the sampled address set did not become completely closed after the initial burst.
- Alternative explanations: first-observed means first seen in this sample, not a newly created wallet or first-ever TOAD interaction.
- Confidence: medium for sampled first appearance; low for genuine new-participant interpretation.
- Breadlines can claim: new-to-the-sample signer addresses continued to appear and some successfully executed.
- Breadlines must not claim: ongoing user growth or buying demand.

### Execution Recovery In Later Slices

- Metric: sample success rates were 60.9% in slice 18, then 78.4% and 79.6% in slices 19 and 20.
- Why it could be interesting: the selected transaction set did not remain at its lowest observed success rate.
- Alternative explanations: program mix, signer mix, route mix, and the stratified-block cap all vary; the data does not establish a cause.
- Confidence: medium for the numerical change; low for market-health meaning.
- Breadlines can claim: sampled execution success differed materially over time.
- Breadlines must not claim: congestion improved, liquidity improved, or the token became healthier.

### Concentration Test

- Metric: the top five primary signer addresses produced 36.2% of all sampled transactions and 49.2% of sampled successes.
- Result: this falsifies the strongest version of the earlier breadth thesis. Persistent successful activity is real, but it is substantially concentrated.
- Breadlines can claim: successful sampled execution was not evenly distributed across addresses.
- Breadlines must not claim: the addresses are coordinated, are bots, or control the market.

## Breadlines Conclusion

### A. What occurred beneath the run that a price chart does not show?

The sampled execution layer contained a stable mix of landed successes, opaque custom-program failures, and explicit no-profit route rejections. This is transaction behavior, not a price explanation.

### B-E. Did participation broaden, persist, concentrate; did successful addresses return; did new addresses continue; and were failures market-wide?

Address recurrence and new-to-the-sample entries both persisted. However, activity and especially successful execution were concentrated: the top five primary signers supplied 49.2% of sampled successes. Explicit no-profit failures were especially concentrated in three programs and 27 observed primary signers, so the data does not support calling them market-wide degradation.

### F. Is there a potentially positive market-health signal?

Only a cautious one: sampled new-to-the-study addresses and returning successful addresses both remained present across the period. It is a potentially useful execution-health indicator, not a bullish conclusion.

### G. What would be misleading to call bullish?

High transaction count, address recurrence, no-profit failures, late-slice success recovery, or token-balance movement alone. The sampling cap and missing identity/intent make any price, demand, or adoption claim unsupported.

### H. Metrics Worth Productizing

1. **Successful address recurrence**: first-observed address -> later observed success, explicitly labeled as address recurrence rather than user retention.
2. **Successful execution concentration**: top 1 / 5 / 10 address share plus HHI, segmented by all activity and successes.
3. **Failure ecology**: explicit route/no-profit logs versus opaque program failures, with program and address concentration shown separately.

## What I Would Show Slingor

1. Breadlines examined 8,770 systematically selected TOAD-touching transactions across the available run; 6,059 landed successfully and 2,711 landed but failed.
2. Successful execution persisted throughout the sample, but it was concentrated: five primary addresses accounted for 49.2% of sampled successes.
3. New-to-the-sample addresses continued to appear in every later time slice, and 3 to 19 of them successfully executed per slice.
4. 728 failed transactions had explicit no-profit/no-route logs, but they were concentrated in three programs and 27 observed primary signer addresses; this is not evidence that all participants were blocked.
5. The final two sampled slices had 78.4% and 79.6% success rates after a 60.9% low in slice 18. That is a real execution change, but this study cannot identify its cause.

## One-Sentence TOAD Execution Story

Across 8,770 systematically selected TOAD-touching transactions, successful execution and new-to-the-sample address arrival persisted, while success and explicit no-profit failures remained concentrated among a relatively small set of addresses and programs.

## Tweet-Worthy Breadlines Finding

NOT ENOUGH EVIDENCE FOR A STRONG PUBLIC CLAIM

## Evidence Boundaries

OBSERVED: RPC transaction status, signer keys, program IDs, logs, fees, compute fields, and TOAD pre/post token balance rows. DERIVED: priority-fee calculations, chronological aggregates, recurrence, sequences, shares, and HHI. INFERRED: none presented as fact. UNKNOWN: identity behind an address, user intent, buyer/seller status, causality, price impact, and whether a sequence is a retry.
