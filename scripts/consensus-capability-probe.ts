/**
 * Live capability probe for Consensus Evidence v0 — READ ONLY.
 *
 * Asks a cluster for the Alpenglow genesis certificate and records the verbatim answer. It sends
 * nothing, signs nothing and needs no key. Protocol state is read from the cluster's answer only:
 * no date, version string, epoch guess or hardcoded activation slot is consulted anywhere.
 *
 *   node --experimental-strip-types scripts/consensus-capability-probe.ts [--endpoint URL]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { classifyConsensus, type GenesisCertProbe } from '../research/execution-casefile/consensus-evidence.ts'

const argEndpoint = process.argv.includes('--endpoint') ? process.argv[process.argv.indexOf('--endpoint') + 1] : null
const ENDPOINT = argEndpoint ?? process.env.BREADLINES_MAINNET_RPC ?? 'https://api.mainnet-beta.solana.com'
const OUT = 'research/consensus-evidence'

async function rpc(method: string, params: unknown[] = []) {
  const res = await fetch(ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(60_000),
  })
  return { httpStatus: res.status, body: await res.json() as { result?: unknown; error?: { code: number; message: string } } }
}

export async function probeGenesisCert(endpoint = ENDPOINT): Promise<GenesisCertProbe> {
  const observedAt = new Date().toISOString()
  try {
    const { body } = await rpc('getAgGenesisCert')
    if (body.error) {
      return { outcome: 'METHOD_NOT_FOUND', endpoint, observedAt, rpcErrorCode: body.error.code, rpcErrorMessage: body.error.message }
    }
    if (body.result == null) return { outcome: 'NULL_SUPPORTED', endpoint, observedAt, raw: null }
    return { outcome: 'CERTIFICATE', endpoint, observedAt, raw: body.result }
  } catch (error) {
    return { outcome: 'TRANSPORT_FAILURE', endpoint, observedAt, detail: (error as Error).message || String(error) }
  }
}

async function main() {
  const probe = await probeGenesisCert()
  // Control probes: three method names the node should NOT know. Without them a null answer could
  // just be a node that returns null for anything, which would not be evidence of non-migration.
  const controls: Record<string, unknown> = {}
  for (const m of ['getAGGenesisCert', 'getAlpenglowGenesisCert', 'getGenesisCert']) {
    try { const { body } = await rpc(m); controls[m] = body.error ? { error: body.error } : { result: body.result } }
    catch (e) { controls[m] = { transportFailure: (e as Error).message } }
  }
  let version: unknown = null
  try { version = (await rpc('getVersion')).body.result } catch { /* version is context, not evidence */ }

  const surface = classifyConsensus(probe, { slot: null, blockhash: null, rpcReportedCommitment: null })
  mkdirSync(OUT, { recursive: true })
  writeFileSync(`${OUT}/capability-probe.json`, JSON.stringify({
    probedAt: probe.observedAt, endpoint: probe.endpoint, nodeVersion: version,
    rawProbe: probe, controlProbes: controls,
    classification: {
      protocol: surface.protocol, migrationState: surface.migrationState, capability: surface.capability,
      genesisCertificateStatus: surface.genesisCertificateStatus, certificateVerification: surface.certificateVerification,
    },
  }, null, 1))
  process.stdout.write(`outcome ${probe.outcome} · protocol ${surface.protocol.value} · migration ${surface.migrationState.value} · capability ${surface.capability.value}\n`)
  process.stdout.write(`wrote ${OUT}/capability-probe.json\n`)
}
const entry = process.argv[1] ?? ''
if (entry && import.meta.url.endsWith(entry.split('/').pop() ?? '\u0000')) void main()
