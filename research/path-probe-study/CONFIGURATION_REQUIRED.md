# Path-probe harness — configuration required before live use

The committed preregistration does **not** authorize transaction transmission. The current harness only produces a deterministic, append-only dry-run plan.

Before any live adapter is implemented or used, record and independently review:

1. Axiom's documented raw-transaction endpoint, authentication method, and whether it mutates or adds a tip/bundle rule.
2. Nozomi's documented raw-transaction endpoint, authentication method, and whether it mutates or adds a tip/bundle rule.
3. Jito BAM access/endpoint and whether it accepts the same signed transaction without a path-specific instruction or rule.
4. A direct-TPU client configuration that can submit the same signed bytes, plus a public finalized-receipt RPC endpoint.
5. A dedicated, funded study signer and its custody boundary. No private key belongs in this repository or its research journals.
6. The exact public source and calculation procedure for the p75 priority-fee observation.

If any path requires a different transaction shape, a path-specific transfer/tip, a bundle, or a mutation, it is unavailable under preregistration v1.0. Do not “fix” the comparison in code; write and commit a new preregistration first.
