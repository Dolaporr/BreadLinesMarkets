# Fixtures

Real chain data, captured verbatim, used to pin behaviour that only a real receipt can establish.

## `mainnet-v1-receipt.json`

A Transaction v1 receipt from Solana **mainnet-beta**, captured 2026-09-17 from
`https://api.mainnet-beta.solana.com` with `getTransaction(..., { encoding: 'json',
maxSupportedTransactionVersion: 1 })`. It is the verbatim `result`, unedited.

```
signature  h5wK3vNzjYYPTLu6ipTf6BCofe9UYgMX8q4xqyWpyKEwHnUmkrej2MEsQkajcnrv5ZMeqEQSdYzpx1S9PLjwgzz
slot       447,741,300
version    1
```

It is kept because of the shape it has, not because of what it does. It carries
`transaction.message.transactionConfig` with `computeUnitLimit` and `priorityFee` set, and **zero
Compute Budget instructions**. That is precisely the shape in which a legacy/v0 reading is silently
wrong rather than loudly broken: the legacy parser finds no ComputeBudget instruction, concludes no
limit and no priority fee were set, and reports that as fact while the chain says otherwise.

`test/transaction-v1-compatibility.test.ts` asserts that Breadlines refuses it, and asserts the
fixture still has that shape — so a future edit cannot quietly replace it with a receipt that would
pass the gate for uninteresting reasons.

Do not "fix" this file to make a test pass. It is a chain record; it is what it is.
