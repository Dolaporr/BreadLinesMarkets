import { normalizeReceipt, type CaseFile, type Frame } from './core.ts'

type TokenBalance = { accountIndex?: number; mint?: string; uiTokenAmount?: { amount?: string; decimals?: number } }
const integer = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null
const tokenInteger = (value: unknown) => typeof value === 'string' && /^\d{1,30}$/.test(value) ? BigInt(value) : null
export function decimalAmount(raw: string | null, decimals: number): string {
  if (raw == null) return 'Unavailable'
  const n = BigInt(raw), abs = (n < BigInt(0) ? -n : n).toString().padStart(decimals + 1, '0')
  const fraction = decimals ? abs.slice(-decimals).replace(/0+$/, '') : ''
  return `${n < BigInt(0) ? '-' : ''}${decimals ? abs.slice(0, -decimals) : abs}${fraction ? `.${fraction}` : ''}`
}

export function inspectAccounts(c: CaseFile) {
  const receipt = normalizeReceipt(c.receipt), keys = receipt.transaction!.message!.accountKeys!
  const meta = receipt.meta as typeof receipt.meta & { preBalances?: unknown[]; postBalances?: unknown[]; preTokenBalances?: TokenBalance[]; postTokenBalances?: TokenBalance[] }
  const before = Array.isArray(meta?.preBalances) ? meta.preBalances : []
  const after = Array.isArray(meta?.postBalances) ? meta.postBalances : []
  const preTokens = Array.isArray(meta?.preTokenBalances) ? meta.preTokenBalances : []
  const postTokens = Array.isArray(meta?.postTokenBalances) ? meta.postTokenBalances : []
  const accounts = keys.map((key, index) => {
    const address = typeof key === 'string' ? key : key.pubkey
    const pre = integer(before[index]), post = integer(after[index])
    const refs = receipt.transaction!.message!.instructions!.flatMap((ix, i) => {
      const accounts = (ix as { accounts?: unknown[] }).accounts
      return Array.isArray(accounts) && accounts.some(a => a === index || a === address) ? [i + 1] : []
    })
    return { index, address, signer: typeof key !== 'string' && typeof key.signer === 'boolean' ? key.signer : null,
      writable: typeof key !== 'string' && typeof key.writable === 'boolean' ? key.writable : null,
      preLamports: pre?.toString() ?? null, postLamports: post?.toString() ?? null,
      deltaLamports: pre != null && post != null ? (post - pre).toString() : null, outerReferences: refs }
  })
  const tokenKeys = [...new Set([...preTokens, ...postTokens].filter(b => Number.isSafeInteger(b.accountIndex) && typeof b.mint === 'string').map(b => `${b.accountIndex}:${b.mint}`))].sort()
  const tokens = tokenKeys.map(id => {
    const [indexString, mint] = id.split(':'), index = Number(indexString)
    const p = preTokens.filter(b => b.accountIndex === index && b.mint === mint)
    const q = postTokens.filter(b => b.accountIndex === index && b.mint === mint)
    const pre = p.length === 1 ? tokenInteger(p[0].uiTokenAmount?.amount) : null
    const post = q.length === 1 ? tokenInteger(q[0].uiTokenAmount?.amount) : null
    const dp = p[0]?.uiTokenAmount?.decimals, dq = q[0]?.uiTokenAmount?.decimals
    const decimals = Number.isInteger(dp) && dp === dq && dp! >= 0 && dp! <= 255 ? dp! : null
    const delta = pre != null && post != null && decimals != null ? (post - pre).toString() : null
    return { index, address: accounts[index]?.address ?? null, mint, preRaw: pre?.toString() ?? null, postRaw: post?.toString() ?? null,
      decimals, deltaRaw: delta, reason: delta == null ? 'Both unique balance entries with matching decimals are required. An absent entry is not assumed zero.' : null }
  })
  return { accounts, tokens, version: receipt.version === undefined ? 'Unspecified · legacy/v0-shaped JSON' : receipt.version === 0 ? 'v0' : 'Legacy',
    resourceSource: 'Compute Budget instructions; unavailable values remain unknown. No v1 support.',
    balanceCoverage: `${accounts.filter(a => a.deltaLamports != null).length} / ${accounts.length} accounts have exact before/after lamport balances`,
    tokenCoverage: `${tokens.filter(t => t.deltaRaw != null).length} / ${tokens.length} token rows have comparable exact balances`,
    boundary: 'Receipt before/after balances are not the balance at each inner call. An instruction can execute and still be rolled back. Fees are separate from attempted transfer amounts.' }
}

// Coordinates encode log-list position and call depth, never elapsed time or actor identity.
export function projectFrames(frames: Frame[], rotation: number, spatial: boolean) {
  const count = frames.length, maxDepth = Math.max(1, ...frames.map(f => f.depth))
  const angle = rotation * Math.PI / 180
  return frames.map((f, i) => {
    const x = count < 2 ? 0 : -310 + i * 620 / (count - 1)
    const z = (f.depth - 1) * 48
    return { id: f.id, x: 450 + (spatial ? x * Math.cos(angle) + z * Math.sin(angle) : x),
      y: spatial ? 100 + (f.depth - 1) * (155 / Math.max(1, maxDepth - 1)) + x * Math.sin(angle) * .16 : 65 + (f.depth - 1) * (190 / maxDepth) }
  })
}
