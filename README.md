# BreadLinesMarkets

BreadLinesMarkets is an interactive Solana market-structure simulator for the FCFS versus MCP debate.

The app is built to make one idea obvious: queueing rules shape markets. Under spam, FCFS starts to look like a bread line. Under MCP, oracle updates land earlier, useful flow gets blocked less often, and market conditions stay more stable.

## Modes

- Normal Tx Simulator: paste a Solana transaction signature and generate a shareable breadline versus MCP receipt.
- Perps in the Breadline: paste or quick-test a perp route and compare FCFS queue pain against an MCP-style fill path.
- Protocol Comparison: compare FCFS, single-proposer batching, and MCP + FBO with replay priority.

## What It Shows

- Wait time
- Txs blocked
- Oracle edge
- Market cost
- Spam pressure
- Perp slippage exposure
- Liquidation-risk pressure
- Funding exposure

## UX

- Quick Test buttons for normal swaps and perp routes.
- Perps examples for Drift, Jupiter Perps, and Phoenix-style fills.
- Open Sprint popup for community flywheel context without cluttering the simulator.
- Live Solana context via Helius data when enabled.

## Tech

- Next.js
- TypeScript
- Recharts
- Framer Motion
- Helius

## Local Dev

```bash
npm install
npm run dev
```

## Live App

https://breadlinesmarkets.com
