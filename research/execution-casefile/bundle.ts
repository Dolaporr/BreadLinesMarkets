import { z } from 'zod'
import { buildCaseFile, type CaseFile } from './core.ts'
import { validateTrace, traceMatchesReceipt, type AttemptTrace } from './trace.ts'

const num = z.number().int().nonnegative().safe(), text = z.string().min(1).max(300)
const overlap = z.object({ signature: text, slot: num, blockTransactionIndex: num.nullable(),
  slotRelation: z.enum(['EARLIER_SLOT', 'LATER_SLOT', 'SAME_SLOT_NO_BLOCK_LIST_POSITION', 'EARLIER_IN_BLOCK_LIST', 'LATER_IN_BLOCK_LIST', 'SAME_BLOCK_LIST_POSITION']),
  executionState: z.enum(['landed', 'landed-but-failed', 'did-not-land']), signerAddresses: z.array(text).max(256),
  sharedWritableAccounts: z.array(text).min(1).max(256), outerProgramIds: z.array(text).max(256), evidence: z.literal('OBSERVED') }).strict()
const contextSchema = z.object({ coverage: z.enum(['COMPLETE', 'PARTIAL', 'UNAVAILABLE']), slotRange: z.object({ start: num, end: num }).strict(),
  examined: num.nullable(), count: num.nullable(), accounts: z.array(z.object({ address: text, signatures: z.array(text).max(30000) }).strict()).max(256),
  overlaps: z.array(overlap).max(30000), source: z.string().max(3000), limitation: z.string().max(3000) }).strict()

export function evidenceBundle(c: CaseFile, trace: AttemptTrace | null, includeTrace: boolean) {
  if (includeTrace && trace) traceMatchesReceipt(validateTrace(trace), c)
  return { format: 'breadlines-evidence-bundle', version: 1, caseFile: c, applicationTrace: includeTrace ? trace : null }
}

export async function receiptHash(raw: unknown) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(raw)))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}

export async function openEvidence(value: unknown): Promise<{ caseFile: CaseFile; trace: AttemptTrace | null }> {
  if (!value || typeof value !== 'object') throw new Error('Choose a receipt or Breadlines evidence JSON file.')
  const data = value as Record<string, unknown>
  if (!('caseFile' in data) && !('format' in data)) {
    const raw = data.result ?? data
    const c = buildCaseFile(raw as CaseFile['receipt'], { source: 'Local receipt import (unverified RPC origin)', sha256: await receiptHash(raw) })
    return { caseFile: c, trace: null }
  }
  // Versioned bundles and the original unversioned v1.0 export are supported. Earlier case files are
  // recomputed from their retained receipt, so a reopened v1.0/v1.1 export gains the commitment fields.
  if ('format' in data && (data.format !== 'breadlines-evidence-bundle' || data.version !== 1)) throw new Error('Unsupported evidence bundle version.')
  const saved = data.caseFile as CaseFile
  if (!saved || !['breadlines-casefile-v1.0.0', 'breadlines-casefile-v1.1.0', 'breadlines-casefile-v1.2.0'].includes(saved.schemaVersion)) throw new Error('Unsupported case-file schema.')
  const hash = await receiptHash(saved.receipt)
  if (saved.provenance?.sha256 !== hash) throw new Error('Receipt checksum does not match. Reopen the original receipt to investigate changed evidence.')
  if (typeof saved.provenance.source !== 'string' || saved.provenance.source.length > 3000) throw new Error('Source provenance is missing or invalid.')
  // Never trust exported explanations, metrics, frame paths or account recoveries.
  const c = buildCaseFile(saved.receipt, { source: saved.provenance.source, sha256: hash })
  if (c.signature !== saved.signature || c.slot !== saved.slot) throw new Error('Case identity disagrees with its receipt.')
  const context = contextSchema.parse(saved.context)
  const ids = context.overlaps.map(o => o.signature)
  if (context.slotRange.end < context.slotRange.start || context.slotRange.start > c.slot || context.slotRange.end < c.slot
    || new Set(ids).size !== ids.length || ids.includes(c.signature)) throw new Error('Context range or neighbor identities are inconsistent.')
  const writable = new Set(c.metrics.writableAccounts ?? [])
  if (context.overlaps.some(o => o.slot < context.slotRange.start || o.slot > context.slotRange.end || o.executionState === 'did-not-land'
    || new Set(o.sharedWritableAccounts).size !== o.sharedWritableAccounts.length || o.sharedWritableAccounts.some(a => !writable.has(a)))) throw new Error('Invalid shared-account context.')
  if (context.coverage === 'UNAVAILABLE' ? context.count !== null || ids.length !== 0 : context.count !== ids.length || context.examined == null || context.examined < ids.length) throw new Error('Context counts disagree with supplied records.')
  const accounts = [...new Set(context.overlaps.flatMap(o => o.sharedWritableAccounts))].sort().map(address => ({ address, signatures: context.overlaps.filter(o => o.sharedWritableAccounts.includes(address)).map(o => o.signature) }))
  if (JSON.stringify(accounts) !== JSON.stringify(context.accounts)) throw new Error('Context account index disagrees with supplied records.')
  c.context = { ...context, accounts, limitation: c.context.limitation }
  c.provenance.verification = 'Reopened local evidence. Receipt-derived claims were recomputed; neighboring records and source labels are supplied, not independently authenticated. A checksum is not proof of truth.'
  const trace = data.applicationTrace == null ? null : validateTrace(data.applicationTrace)
  if (trace) traceMatchesReceipt(trace, c)
  return { caseFile: c, trace }
}
