# TOAD — Breadlines Execution Pulse

**Observation window:** slots 438061664–438429195

**Transactions represented:** 8,770 sampled token-touching transactions
**Methodology note:** Two interleaved sets of 250 evenly spaced full-block slices; TOAD-mint account-key filter; stable signature-hash quota per slice; signature deduplication across phases

## Participation

333 observed primary signer addresses appeared in the sample; successful-address-only coverage is unavailable in this source projection.

## Successful Execution Concentration

The five most active observed signer addresses accounted for 49.2% of sampled successful executions. Top address share: 23.8%.

## Participation Through Time

New-to-sample successful signer addresses appeared in every chronological slice. The source recorded 249 slice-level new-successful-address observations and 507 slice-level returning-successful-address observations; these are address observations, not counts of real-world entities.

## Failure Ecology

2,711 observed executions failed; the leading recorded failure class is opaque-custom-error (1,863). 728 had explicit no-profit/no-route evidence across 27 observed primary signer addresses.

## Execution Reliability

69.1% of sampled executions succeeded; slice-level rates are shown without causal explanation.

## What Breadlines Can Say

This report describes receipt-derived execution and address-participation patterns within the sampled observation window. It keeps transaction outcomes, signer recurrence, concentration, and documented failure evidence separate from speculation.

## What Breadlines Cannot Say

It cannot identify real-world entities, establish intent or coordination, explain why a rate changed, measure the complete market, or make claims about price, token quality, or future performance.

## Methodology and Provenance

Coverage is **sampled**. Selection: Each phase is selected solely by slot position. Within each sampled block, all transactions whose account keys contain the TOAD mint are eligible and the first 32 after stable FNV-1a signature-hash ordering are retained. Receipt facts are not used for selection.. Source: research/toad-market-structure-episode.json. Historical comparison is unavailable in v0.
