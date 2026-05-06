export type Regime = "fcfs" | "batching" | "mcp"
export type SimParams = { blockTime: number; enable200ms: boolean; priorityFee: number; replayPriority: number; spamVolume: number; propAMMMode: boolean; liveSolanaData: boolean; txCount?: number; seed?: number }
export type SimResult = { avgInclusionLatency: number; percentCensored: number; oracleLatencyEdge: number; effectiveSpread: number; percentBestOffer: number; oracleStaleness: number }
type Tx = { id: number; type: "oracle" | "taker" | "spam"; arrival: number; priority: number; lane: number; frame: number }
type Scheduled = Tx & { exec: number }

const rnd = (s: number) => () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5), ((s ^ (s >>> 7)) >>> 0) / 4294967296)
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const round = (n: number) => Math.round(n * 100) / 100
const sort = <T,>(xs: T[], f: (a: T, b: T) => number) => [...xs].sort(f)

// MCP aggregation pipeline latency (end-of-batch → execution)
const PIPELINE_MS = 100
const FRAME_MS = 50

const generate = (p: SimParams) => {
  const r = rnd((p.seed ?? 23) + p.blockTime * 3 + p.spamVolume * 7)
  const count = p.txCount ?? 1000
  const oracle = count * 0.2, taker = count * 0.4, txs: Tx[] = []
  for (let i = 0; i < count; i++) {
    const type = i < oracle ? "oracle" : i < oracle + taker ? "taker" : "spam"
    const anchor = ((i % Math.max(1, oracle)) + 0.5) * (p.blockTime / Math.max(1, oracle))
    const arrival = type === "oracle"
      ? Math.max(0, Math.min(p.blockTime - 1, anchor + (r() - 0.5) * 12))
      : type === "taker"
        ? Math.max(0, Math.min(p.blockTime - 1, anchor + 18 + (r() - 0.45) * 26))
        : Math.max(0, Math.min(p.blockTime - 1, Math.pow(r(), 1 + p.spamVolume / 80) * p.blockTime * (0.82 - p.spamVolume / 400)))
    // Symmetric priority assignment — identical for all regimes
    const priority = type === "oracle" ? 7 + Math.floor(r() * 2)
      : type === "taker" ? 2 + Math.floor(r() * 5)
      : Math.min(10, Math.floor(r() * (1.5 + p.spamVolume / 25)))
    txs.push({ id: i, type, arrival, priority, lane: Math.floor(r() * 4), frame: Math.floor(arrival / FRAME_MS) })
  }
  return sort(txs, (a, b) => a.arrival - b.arrival || a.id - b.id)
}

export function simulateBlock(params: SimParams, regime: Regime): SimResult {
  const p = { ...params, blockTime: params.enable200ms ? 200 : params.blockTime }
  const txs = generate(p)
  const out: Scheduled[] = []

  // Symmetric cap — same drop rule across all regimes
  const cap = Math.max(500, Math.round(1000 - p.spamVolume * 4))

  const frames = new Map<number, Tx[]>()
  txs.forEach(tx => frames.set(tx.frame, [...(frames.get(tx.frame) ?? []), tx]))
  const totalFrames = Math.max(1, Math.ceil(p.blockTime / FRAME_MS))
  const avgFrameLoad = txs.length / totalFrames

  if (regime === "fcfs") {
    // Ideal FCFS streaming: sort by priority DESC, then arrival (fee backpressure)
    // High-fee txs get near-zero latency; low-fee txs are first to be dropped at cap
    sort(txs, (a, b) => b.priority - a.priority || a.arrival - b.arrival || a.id - b.id)
      .slice(0, cap)
      .forEach(tx => {
        const frameLoad = frames.get(tx.frame)?.length ?? 0
        // Burstiness: vol spikes cause queue pile-up even for high-priority txs because
        // same-priority spam that arrived first still holds the queue
        const burstRatio = frameLoad / avgFrameLoad
        const burstPenalty = burstRatio > 1.4 ? (burstRatio - 1.4) * p.spamVolume * 0.7 : 0
        // Streaming: latency ≈ arrival + small_delay scaled by priority tier
        const priorityDelay = Math.max(0, (8 - tx.priority) * 2.5)
        out.push({ ...tx, exec: tx.arrival + 2 + priorityDelay + burstPenalty })
      })
  } else {
    sort([...frames.keys()].map(frame => ({ frame, txs: frames.get(frame)! })), (a, b) => a.frame - b.frame)
      .forEach(({ frame, txs: frameTxs }) => {
        const frameEnd = (frame + 1) * FRAME_MS

        if (regime === "batching") {
          sort(frameTxs, (a, b) => b.priority - a.priority || a.arrival - b.arrival || a.id - b.id)
            .forEach((tx, i) => {
              if (out.length >= cap) return
              out.push({ ...tx, exec: frame * FRAME_MS + 10 + i * 1.2 + (p.propAMMMode && tx.type !== "spam" ? -3 : 0) })
            })
        }

        if (regime === "mcp") {
          const lanes = [0, 1, 2, 3].map(lane =>
            sort(frameTxs.filter(tx => tx.lane === lane), (a, b) => {
              const ap = a.priority + (a.type === "oracle" ? p.replayPriority : 0)
              const bp = b.priority + (b.type === "oracle" ? p.replayPriority : 0)
              return bp - ap || a.arrival - b.arrival || a.id - b.id
            })
          )
          for (let rr = frame % 4, pos = 0; out.length < cap; pos++) {
            const heads = lanes.map((q, lane) => ({ tx: q[0], lane })).filter((x): x is { tx: Tx; lane: number } => Boolean(x.tx))
            if (!heads.length) break
            const best = Math.max(...heads.map(({ tx }) => tx.priority + (tx.type === "oracle" ? p.replayPriority : 0)))
            const pick = sort(
              heads.filter(({ tx }) => tx.priority + (tx.type === "oracle" ? p.replayPriority : 0) === best),
              (a, b) => ((a.lane - rr + 4) % 4) - ((b.lane - rr + 4) % 4)
            )[0]
            const tx = lanes[pick.lane].shift()!
            rr = (pick.lane + 1) % 4
            // MCP: end-of-batch + full execution pipeline — no more sub-arrival exec times
            const typeOffset = tx.type === "oracle" ? 0 : tx.type === "taker" ? 5 : 10
            out.push({ ...tx, exec: frameEnd + PIPELINE_MS + pos * 0.5 + typeOffset - (p.propAMMMode && tx.type !== "spam" ? 4 : 0) })
          }
        }
      })
  }

  const scheduled = sort(out, (a, b) => a.exec - b.exec || a.id - b.id)
  const included = new Set(scheduled.map(tx => tx.id))
  const useful = txs.filter(tx => tx.type !== "spam")
  const oracles = scheduled.filter(tx => tx.type === "oracle")
  const takers = scheduled.filter(tx => tx.type === "taker")

  // Oracle freshness: scan execution order, measure oracle→taker gap
  let lastOracleExec = -1, fresh = 0, totalStaleness = 0, spamAhead = 0, spamRun = 0
  scheduled.forEach(tx => {
    if (tx.type === "oracle") { lastOracleExec = tx.exec; spamRun = 0; return }
    if (tx.type === "spam") { spamRun++; return }
    const gap = lastOracleExec < 0 ? p.blockTime * 2 : Math.max(0, tx.exec - lastOracleExec)
    if (gap <= 60) fresh++
    totalStaleness += gap
    spamAhead += spamRun
  })

  const oracleLatency = avg(oracles.map(tx => tx.exec - tx.arrival))
  const takerLatency = avg(takers.map(tx => tx.exec - tx.arrival))
  const avgInclusionLatency = round(avg(scheduled.map(tx => tx.exec - tx.arrival)))

  // Oracle edge: for MCP measure within-batch oracle→taker gap (oracle always first per batch)
  // For FCFS/batching use takerLatency - oracleLatency (positive when oracle has higher fee priority)
  let oracleLatencyEdge: number
  if (regime === "mcp") {
    const frameFirstOracle = new Map<number, number>()
    oracles.forEach(o => {
      if (!frameFirstOracle.has(o.frame) || o.exec < frameFirstOracle.get(o.frame)!) frameFirstOracle.set(o.frame, o.exec)
    })
    const gaps = takers
      .map(t => { const fo = frameFirstOracle.get(t.frame); return fo != null ? Math.max(0, t.exec - fo) : -1 })
      .filter(g => g >= 0)
    oracleLatencyEdge = round(avg(gaps) + (p.priorityFee < 0.1 ? 15 : 0))
  } else {
    oracleLatencyEdge = round(Math.max(0, takerLatency - oracleLatency))
  }

  const oracleStaleness = round(totalStaleness / Math.max(1, takers.length))

  const effectiveSpreadBase = Math.max(1,
    8
    + takerLatency * 0.04
    + oracleStaleness * 0.08
    + spamAhead / Math.max(1, takers.length) * 0.55
    - (regime === "mcp" ? 2.2 : regime === "batching" ? 0.7 : 0)
    - (p.propAMMMode ? 1.4 : 0)
  )
  const effectiveSpread = round(regime === "mcp" && p.priorityFee < 0.1 ? effectiveSpreadBase * 0.6 : effectiveSpreadBase)

  return {
    avgInclusionLatency,
    percentCensored: round((useful.filter(tx => !included.has(tx.id)).length / useful.length) * 100),
    oracleLatencyEdge,
    effectiveSpread,
    percentBestOffer: round((fresh / Math.max(1, takers.length)) * 100),
    oracleStaleness,
  }
}
