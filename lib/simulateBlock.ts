export type Regime = "fcfs" | "batching" | "mcp"
export type SimParams = { blockTime: number; enable200ms: boolean; priorityFee: number; replayPriority: number; spamVolume: number; propAMMMode: boolean; liveSolanaData: boolean; txCount?: number; seed?: number }
export type SimResult = { avgInclusionLatency: number; percentCensored: number; oracleLatencyEdge: number; effectiveSpread: number; percentBestOffer: number }
type Tx = { id: number; type: "oracle" | "taker" | "spam"; arrival: number; priority: number; lane: number; frame: number }
type Scheduled = Tx & { exec: number }

const rnd = (s: number) => () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5), ((s ^ (s >>> 7)) >>> 0) / 4294967296)
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const round = (n: number) => Math.round(n * 100) / 100
const sort = <T,>(xs: T[], f: (a: T, b: T) => number) => [...xs].sort(f)

const generate = (p: SimParams) => {
  const r = rnd((p.seed ?? 23) + p.blockTime * 3 + p.spamVolume * 7), count = p.txCount ?? 1000, oracle = count * 0.2, taker = count * 0.4, txs: Tx[] = []
  for (let i = 0; i < count; i += 1) {
    const type = i < oracle ? "oracle" : i < oracle + taker ? "taker" : "spam"
    const anchor = ((i % Math.max(1, oracle)) + 0.5) * (p.blockTime / Math.max(1, oracle))
    const arrival = type === "oracle" ? Math.max(0, Math.min(p.blockTime - 1, anchor + (r() - 0.5) * 12)) : type === "taker" ? Math.max(0, Math.min(p.blockTime - 1, anchor + 18 + (r() - 0.45) * 26)) : Math.max(0, Math.min(p.blockTime - 1, Math.pow(r(), 1 + p.spamVolume / 80) * p.blockTime * (0.82 - p.spamVolume / 400)))
    const priority = type === "oracle" ? 7 + Math.floor(r() * 2) : type === "taker" ? 2 + Math.floor(r() * 5) : Math.min(10, Math.floor(r() * (1.5 + p.spamVolume / 25)))
    txs.push({ id: i, type, arrival, priority, lane: Math.floor(r() * 4), frame: Math.floor(arrival / 50) })
  }
  return sort(txs, (a, b) => a.arrival - b.arrival || a.id - b.id)
}

export function simulateBlock(params: SimParams, regime: Regime): SimResult {
  const p = { ...params, blockTime: params.enable200ms ? 200 : params.blockTime }, txs = generate(p), frames = new Map<number, Tx[]>(), out: Scheduled[] = []
  const cap = regime === "fcfs" ? Math.max(300, Math.round(940 - Math.pow(p.spamVolume, 1.45) * 1.6)) : regime === "batching" ? Math.max(700, Math.round(1040 - p.spamVolume * 4)) : Math.max(880, Math.round(990 - p.spamVolume * 1.1))
  txs.forEach((tx) => frames.set(tx.frame, [...(frames.get(tx.frame) ?? []), tx]))

  if (regime === "fcfs") {
    sort(txs, (a, b) => a.arrival - b.arrival || (b.type === "spam" ? 1 : 0) - (a.type === "spam" ? 1 : 0) || b.priority - a.priority || a.id - b.id).slice(0, cap).forEach((tx, i) => out.push({ ...tx, exec: i * (p.blockTime / cap + 0.35 + Math.pow(p.spamVolume / 36, 2)) + (tx.type === "oracle" ? 48 : tx.type === "taker" ? 8 : 0) }))
  } else {
    sort([...frames.keys()].map((frame) => ({ frame, txs: frames.get(frame)! })), (a, b) => a.frame - b.frame).forEach(({ frame, txs: frameTxs }) => {
      const start = frame * 50, lanes = [0, 1, 2, 3].map((lane) => sort(frameTxs.filter((tx: Tx) => tx.lane === lane), (a, b) => {
        const ap = a.priority + (regime === "mcp" && a.type === "oracle" ? p.replayPriority : 0), bp = b.priority + (regime === "mcp" && b.type === "oracle" ? p.replayPriority : 0)
        return bp - ap || a.arrival - b.arrival || a.id - b.id
      }))
      if (regime === "batching") sort(frameTxs, (a, b) => b.priority - a.priority || a.arrival - b.arrival || a.id - b.id).forEach((tx, i) => out.length < cap && out.push({ ...tx, exec: start + 26 + i * (1.08 + p.spamVolume / 110) + (tx.type === "spam" ? 7 : tx.type === "taker" ? 6 : 0) }))
      if (regime === "mcp") for (let rr = frame % 4, pos = 0; out.length < cap; pos += 1) {
        const heads = lanes.map((q, lane) => ({ tx: q[0], lane })).filter((x): x is { tx: Tx; lane: number } => Boolean(x.tx))
        if (!heads.length) break
        const best = Math.max(...heads.map(({ tx }) => tx.priority + (tx.type === "oracle" ? p.replayPriority : 0)))
        const pick = sort(heads.filter(({ tx }) => tx.priority + (tx.type === "oracle" ? p.replayPriority : 0) === best), (a, b) => ((a.lane - rr + 4) % 4) - ((b.lane - rr + 4) % 4))[0]
        const tx = lanes[pick.lane].shift()!, oracleSlot = 18 + pick.lane + (pos % 2), takerSlot = 68 + (pos % 4) * 2.5, spamSlot = 74 + (pos % 3) * 4
        rr = (pick.lane + 1) % 4
        out.push({ ...tx, exec: start + (tx.type === "oracle" ? oracleSlot : tx.type === "taker" ? takerSlot : spamSlot) - (p.propAMMMode && tx.type !== "spam" ? 4 : 0) })
      }
    })
  }

  const scheduled = sort(out, (a, b) => a.exec - b.exec || a.id - b.id), included = new Set(scheduled.map((tx) => tx.id)), useful = txs.filter((tx) => tx.type !== "spam"), oracles = scheduled.filter((tx) => tx.type === "oracle"), takers = scheduled.filter((tx) => tx.type === "taker")
  let lastOracle = -1, fresh = 0, stale = 0, spamAhead = 0, spamRun = 0
  scheduled.forEach((tx) => {
    if (tx.type === "oracle") { lastOracle = tx.exec; spamRun = 0; return }
    if (tx.type === "spam") { spamRun += 1; return }
    const gap = lastOracle < 0 ? p.blockTime : tx.exec - lastOracle
    if (gap <= (regime === "mcp" ? 55 : regime === "batching" ? 30 : 12)) fresh += 1
    stale += gap; spamAhead += spamRun
  })
  const oracleLatency = avg(oracles.map((tx) => tx.exec - tx.arrival)), takerLatency = avg(takers.map((tx) => tx.exec - tx.arrival)), edge = takerLatency - oracleLatency
  const lowPriorityFeeBoost = regime === "mcp" && p.priorityFee < 0.1
  const oracleLatencyEdge = round(edge + (lowPriorityFeeBoost ? 15 : 0))
  const effectiveSpreadBase = Math.max(1, 8 + takerLatency * 0.06 + stale / Math.max(1, takers.length) * 0.05 + spamAhead / Math.max(1, takers.length) * 0.55 - edge * 0.05 - (regime === "mcp" ? 2.2 : regime === "batching" ? 0.7 : 0) - (p.propAMMMode ? 1.4 : 0))
  const effectiveSpread = round(lowPriorityFeeBoost ? effectiveSpreadBase * 0.6 : effectiveSpreadBase)
  return {
    avgInclusionLatency: round(avg(scheduled.map((tx) => tx.exec - tx.arrival))),
    percentCensored: round((useful.filter((tx) => !included.has(tx.id)).length / useful.length) * 100),
    oracleLatencyEdge,
    effectiveSpread,
    percentBestOffer: round((fresh / Math.max(1, takers.length)) * 100),
  }
}
