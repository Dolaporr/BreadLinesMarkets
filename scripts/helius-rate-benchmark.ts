import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const requestedRps = Number(process.argv[2])
if (!Number.isFinite(requestedRps) || requestedRps <= 0) throw new Error('Usage: node --experimental-strip-types scripts/helius-rate-benchmark.ts <rps>')
const count = 100
const startSlot = 442_368_000
const out = path.resolve('research/slot-time-300ms-boundary', `helius-rate-benchmark-${requestedRps}rps.json`)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function atomic(file: string, value: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); for (let attempt = 0; attempt < 4; attempt++) try { await rename(temp, file); return } catch (error) { if (attempt === 3) throw error; await sleep(100 * (attempt + 1)) } }
const percentile = (values: number[], p: number) => { const data = [...values].sort((a, b) => a - b); return data.length ? data[Math.floor((data.length - 1) * p)] : null }
async function main() {
  await mkdir(path.dirname(out), { recursive: true })
  const environment = await readFile('.env.local', 'utf8'), apiKey = environment.match(/^HELIUS_API_KEY=(.+)$/m)?.[1]?.trim()
  if (!apiKey) throw new Error('HELIUS_API_KEY is required')
  const intervalMs = 1_000 / requestedRps, startedAt = Date.now(), inFlight = { current: 0, max: 0 }
  const requests = await Promise.all(Array.from({ length: count }, async (_, index) => {
    const target = startedAt + index * intervalMs, wait = target - Date.now(); if (wait > 0) await sleep(wait)
    const beganAt = Date.now(); inFlight.current++; inFlight.max = Math.max(inFlight.max, inFlight.current)
    try {
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: index + 1, method: 'getBlock', params: [startSlot + index, { encoding: 'json', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 1 }] }), signal: AbortSignal.timeout(60_000) })
      await response.arrayBuffer()
      const headers = Object.fromEntries([...response.headers.entries()].map(([name, entry]) => [name, name.toLowerCase() === 'set-cookie' ? '[REDACTED]' : entry]))
      return { index, slot: startSlot + index, beganAt: new Date(beganAt).toISOString(), status: response.status, latencyMs: Date.now() - beganAt, headers }
    } catch (error) { return { index, slot: startSlot + index, beganAt: new Date(beganAt).toISOString(), status: null, latencyMs: Date.now() - beganAt, headers: {}, error: error instanceof Error ? error.message : String(error) } }
    finally { inFlight.current-- }
  }))
  const starts = requests.map(item => Date.parse(item.beganAt)).sort((a, b) => a - b), intervals = starts.slice(1).map((time, index) => time - starts[index])
  const statuses = Object.fromEntries([...new Set(requests.map(item => String(item.status)))].map(status => [status, requests.filter(item => String(item.status) === status).length]))
  const output = { schemaVersion: 1, requestedRps, requestCount: count, method: 'getBlock', transactionDetails: 'full', deterministicSlots: { start: startSlot, end: startSlot + count - 1 }, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, effectiveStartRate: intervals.length ? 1_000 / (intervals.reduce((sum, item) => sum + item, 0) / intervals.length) : null, startIntervalMs: { p50: percentile(intervals, .5), p95: percentile(intervals, .95) }, maxInFlight: inFlight.max, statusCounts: statuses, http429Count: requests.filter(item => item.status === 429).length, transportErrorCount: requests.filter(item => item.status == null).length, latencyMs: { p50: percentile(requests.map(item => item.latencyMs), .5), p95: percentile(requests.map(item => item.latencyMs), .95) }, clean: requests.every(item => item.status === 200), responses: requests }
  await atomic(out, output)
  console.log(JSON.stringify({ requestedRps, clean: output.clean, http429Count: output.http429Count, transportErrorCount: output.transportErrorCount, effectiveStartRate: output.effectiveStartRate, maxInFlight: output.maxInFlight, latencyMs: output.latencyMs, output: path.relative(process.cwd(), out) }))
}
void main()
