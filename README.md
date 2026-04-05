# BreadLinesMarkets

BreadLinesMarkets is an interactive simulator that compares three transaction-ordering regimes:

- FCFS
- Single-proposer batching
- MCP + FBO with replay priority

The app is built to make one idea obvious: queueing rules shape markets. Under spam, FCFS starts to look like a bread line. Under MCP, oracle updates land earlier, useful flow gets blocked less often, and market conditions stay more stable.

## What It Shows

- Wait time
- Txs blocked
- Oracle edge
- Market cost

## Tech

- Next.js
- TypeScript
- Recharts
- Framer Motion

## Local Dev

```bash
npm install
npm run dev
```

## Live App

https://v0-ui-xi-five.vercel.app
