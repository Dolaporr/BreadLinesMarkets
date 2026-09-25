# Consensus Evidence v0 — sources and verification

Protocol semantics were verified against first-party documentation **before** being encoded, as the
brief requires. No tweet or secondary article was used as protocol truth.

## Primary source

**`getAgGenesisCert`** — <https://solana.com/docs/rpc/http/getaggenesiscert>

What it establishes, and what this repo encodes from it:

| Documented | Encoded in `consensus-evidence.ts` |
| --- | --- |
| Returns the Alpenglow genesis certificate, or `null` if the cluster has not migrated | `NULL_SUPPORTED` → `TOWER_BFT` / `NOT_MIGRATED`, evidence `OBSERVED` |
| Available from Agave v4.3; an older node answers `-32601`, which is **not** the same as `null` | `METHOD_NOT_FOUND` → protocol `UNKNOWN`, capability `NOT_SUPPORTED` |
| Takes no parameters; reads from the finalized bank | Probe sends no params |
| Response carries `block.slot`, `block.blockId` (32-byte), `signature.signature` (192-byte aggregate BLS), `signature.bitmap` | `certificateSlot`, `certificateBlockId`, `aggregateSignaturePresent` |
| The certificate covers **the first block produced under Alpenglow** | `certificateBoundToTransaction: false`, state `NOT_APPLICABLE` |
| CLI equivalent: `solana alpenglow-genesis-info` | Not used; the probe calls JSON-RPC directly |

## No contradiction with the brief

The brief's interpretation table matches the documentation on every point checked. Nothing was
encoded that the documentation does not support.

## One clarification the brief did not spell out

The documentation makes the genesis certificate a **one-time, cluster-level migration artifact**:
it covers the first block produced under Alpenglow, not the block containing any particular
transaction. The brief's §5 warns against assuming `certificate slot == transaction slot`; the
documentation makes the stronger statement that for this certificate the two are *unrelated* except
in the single case where a transaction happens to sit in the very first Alpenglow block.

So this implementation refuses the linkage structurally — `certificateBoundToTransaction` is a typed
`false` with state `NOT_APPLICABLE` — rather than relying on UI wording. Treating the genesis
certificate as per-transaction finality evidence would be a category error, and the panel says so.

## Live capability result used for the demonstration

Recorded verbatim in [`capability-probe.json`](capability-probe.json). Summary:

```
endpoint     https://api.mainnet-beta.solana.com
node         solana-core 4.3.0
getAgGenesisCert      -> {"result": null}          method understood, cluster not migrated
getAGGenesisCert      -> -32601 Method not found   control
getAlpenglowGenesisCert -> -32601 Method not found control
getGenesisCert        -> -32601 Method not found   control
```

The three controls matter. Without them, a `null` answer could equally be a node that returns
`null` for any unknown method, which would make the reading worthless. Because the node answers
`-32601` for three near-miss names and `null` only for the documented one, the `null` is a real
answer about the cluster rather than a generic fallthrough.

## What Breadlines could not obtain

- **No cryptographic verification.** v0 retrieves certificate-shaped data and never verifies a BLS
  aggregate signature. `certificateVerification` is a typed `NOT_VERIFIED`. BLS verification is
  future work and was not added to make the product sound stronger.
- **No Alpenglow certificate on mainnet**, because the cluster has not migrated. Case B is covered
  by a deterministic test against a documented payload shape, not by live mainnet data.
- **No observer first-seen time** for any archived case. Historical reads cannot recover when an
  independent observer learned of a transaction, and `blockTime` is not an observation.
