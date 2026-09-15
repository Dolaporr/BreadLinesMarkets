# PQC accumulator lab

Research-only test of this proposed authorization sequence:

```text
create_pending_action -> submit_approval(A) -> submit_approval(B) -> execute_once
```

It measures the byte effect of moving one real ML-DSA authorization into each transaction. It is not a deployed Solana program, wallet, hardware-signer experiment, or custody system.

Run from this directory after the adjacent `pqc-v1-wallet-lab` dependencies have been installed:

```text
npm test
npm run benchmark
```

See [results.md](results.md), [methodology.md](methodology.md), and [benchmark.json](benchmark.json). The previous inline experiment is unchanged in `../pqc-v1-wallet-lab/`.
