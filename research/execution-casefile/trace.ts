import { z } from 'zod'

export const TRACE_VERSION = 'breadlines-attempt-trace-v1' as const
const id = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/)
const signature = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/)
const common = { sequence: z.number().int().nonnegative(), observedAt: z.string().datetime(), elapsedMs: z.number().finite().nonnegative() }
const payload = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MESSAGE_BUILT'), revisionId: id, replacesRevisionId: id.optional(), messageHash: z.string().regex(/^[a-f0-9]{64}$/), lastValidBlockHeight: z.number().int().nonnegative().optional() }).strict(),
  z.object({ type: z.literal('SIMULATION_OBSERVED'), revisionId: id, outcome: z.enum(['SUCCESS', 'FAILED']) }).strict(),
  z.object({ type: z.literal('SIGNED'), revisionId: id, signature }).strict(),
  z.object({ type: z.literal('SEND_STARTED'), revisionId: id, sendId: id, providerLabel: id }).strict(),
  z.object({ type: z.literal('SEND_RESPONSE'), sendId: id, response: z.enum(['ACKNOWLEDGED', 'REJECTED', 'TRANSPORT_ERROR']), responseCode: id.optional() }).strict(),
  z.object({ type: z.literal('RECEIPT_OBSERVED'), signature, slot: z.number().int().nonnegative(), commitment: z.enum(['processed', 'confirmed', 'finalized']), outcome: z.enum(['SUCCESS', 'FAILED']) }).strict(),
  z.object({ type: z.literal('EXPIRY_OBSERVED'), revisionId: id, observedBlockHeight: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal('DEADLINE_REACHED') }).strict(),
])
const eventSchema = z.object({ ...common, event: payload }).strict()
const captureIssue = z.enum(['EVENT_NOT_RECORDED', 'SEND_START_NOT_RECORDED', 'SEND_RESPONSE_NOT_RECORDED'])
const traceSchema = z.object({ schemaVersion: z.literal(TRACE_VERSION), attemptId: id, clockDomain: id,
  evidenceSource: z.literal('APPLICATION_OBSERVED'), fixture: z.boolean(), captureIssues: z.array(captureIssue).max(10000).default([]), events: z.array(eventSchema).max(10000) }).strict()
export type TracePayload = z.infer<typeof payload>
export type AttemptTrace = z.infer<typeof traceSchema>

export function validateTrace(value: unknown): AttemptTrace {
  const trace = traceSchema.parse(value)
  const revisions = new Map<string, { signature?: string; lastValidBlockHeight?: number }>()
  const signatures = new Set<string>(), sends = new Map<string, boolean>()
  const finals = new Map<string, { slot: number; outcome: string }>()
  let time = -1, seq = -1
  for (const entry of trace.events) {
    if (entry.sequence !== seq + 1 || entry.elapsedMs < time) throw new Error('Trace sequence or monotonic time is inconsistent.')
    seq = entry.sequence; time = entry.elapsedMs
    const e = entry.event
    if (e.type === 'MESSAGE_BUILT') {
      if (revisions.has(e.revisionId) || (e.replacesRevisionId && !revisions.has(e.replacesRevisionId))) throw new Error('Invalid revision lineage.')
      revisions.set(e.revisionId, { lastValidBlockHeight: e.lastValidBlockHeight })
    } else if ('revisionId' in e) {
      const revision = revisions.get(e.revisionId)
      if (!revision) throw new Error('Unknown message revision.')
      if (e.type === 'SIGNED') {
        if (revision.signature || signatures.has(e.signature)) throw new Error('Signature already bound; rebuilds require a new revision.')
        revision.signature = e.signature; signatures.add(e.signature)
      } else if (e.type === 'SEND_STARTED') {
        if (!revision.signature || sends.has(e.sendId)) throw new Error('A send requires a signed revision and a unique send ID.')
        sends.set(e.sendId, false)
      } else if (e.type === 'EXPIRY_OBSERVED') {
        if (revision.lastValidBlockHeight == null || e.observedBlockHeight <= revision.lastValidBlockHeight) throw new Error('Expiry requires a block height beyond lastValidBlockHeight.')
      }
    } else if (e.type === 'SEND_RESPONSE') {
      if (!sends.has(e.sendId) || sends.get(e.sendId)) throw new Error('Response requires an unresolved send ID.')
      sends.set(e.sendId, true)
    } else if (e.type === 'RECEIPT_OBSERVED') {
      if (!signatures.has(e.signature)) throw new Error('Receipt signature does not belong to this attempt.')
      const final = finals.get(e.signature)
      if (final && (final.slot !== e.slot || final.outcome !== e.outcome)) throw new Error('Receipt conflicts with an observed finalized result.')
      if (e.commitment === 'finalized') finals.set(e.signature, e)
    }
  }
  return trace
}

export function summarizeTrace(value: unknown) {
  const trace = validateTrace(value)
  const revisions = trace.events.filter(e => e.event.type === 'MESSAGE_BUILT').map(entry => {
    const built = entry.event as Extract<TracePayload, { type: 'MESSAGE_BUILT' }>
    const signed = trace.events.map(x => x.event).find(e => e.type === 'SIGNED' && e.revisionId === built.revisionId) as Extract<TracePayload, { type: 'SIGNED' }> | undefined
    const observed = trace.events.map(x => x.event).filter(e => e.type === 'RECEIPT_OBSERVED' && e.signature === signed?.signature) as Extract<TracePayload, { type: 'RECEIPT_OBSERVED' }>[]
    const final = observed.find(e => e.commitment === 'finalized')
    const sends = trace.events.filter(e => e.event.type === 'SEND_STARTED' && e.event.revisionId === built.revisionId)
    const expired = trace.events.some(e => e.event.type === 'EXPIRY_OBSERVED' && e.event.revisionId === built.revisionId)
    const deadline = trace.events.some(e => e.event.type === 'DEADLINE_REACHED')
    return { ...built, signature: signed?.signature ?? null, sends: sends.length,
      outcome: final ? `FINALIZED_${final.outcome}` : expired ? 'VALIDITY_ELAPSED_FINAL_RECEIPT_UNOBSERVED' : deadline ? 'UNOBSERVED_FINAL_BY_DEADLINE' : 'INCOMPLETE',
      receipts: observed }
  })
  return { trace, revisions, captureIssuesReported: trace.captureIssues.length > 0, sends: trace.events.filter(e => e.event.type === 'SEND_STARTED').length,
    retries: revisions.reduce((n, r) => n + Math.max(0, r.sends - 1), 0),
    durations: trace.events.filter(e => e.event.type === 'SEND_RESPONSE').map(response => {
      const event = response.event as Extract<TracePayload, { type: 'SEND_RESPONSE' }>
      const start = trace.events.find(e => e.event.type === 'SEND_STARTED' && e.event.sendId === event.sendId)!
      return { sendId: event.sendId, elapsedMs: response.elapsedMs - start.elapsedMs }
    }),
    boundary: 'Times measure this application’s observations in one clock domain. Responses do not attest leader arrival. Missing final receipts do not prove a drop. Multiple finalized signatures may belong to one attempt; do not collapse them into one result.' }
}

export function traceMatchesReceipt(trace: AttemptTrace, receipt: { signature: string; slot: number; state: string }) {
  validateTrace(trace)
  if (trace.fixture) throw new Error('Illustrative traces cannot be attached to real archived cases.')
  if (!trace.events.some(e => e.event.type === 'SIGNED' && e.event.signature === receipt.signature)) throw new Error('This trace does not contain the selected signature.')
  const matches = trace.events.filter(e => e.event.type === 'RECEIPT_OBSERVED' && e.event.signature === receipt.signature && e.event.commitment === 'finalized')
  for (const m of matches) {
    const e = m.event as Extract<TracePayload, { type: 'RECEIPT_OBSERVED' }>
    if (e.slot !== receipt.slot || `LANDED_${e.outcome}` !== receipt.state) throw new Error('Trace finalized result and case receipt disagree.')
  }
}

/** In-memory recorder. Caller owns sending, persistence and clocks. No automatic retries or network calls. */
export function createTraceRecorder(options: { attemptId: string; clockDomain: string; fixture?: boolean;
  monotonicNow?: () => number; wallNow?: () => string }) {
  const mono = options.monotonicNow ?? (() => performance.now()), wall = options.wallNow ?? (() => new Date().toISOString())
  const origin = mono()
  const issues: z.infer<typeof captureIssue>[] = []
  const issue = (code: z.infer<typeof captureIssue>) => { if (issues.length < 10000) issues.push(code) }
  let trace: AttemptTrace = validateTrace({ schemaVersion: TRACE_VERSION, attemptId: options.attemptId, clockDomain: options.clockDomain,
    evidenceSource: 'APPLICATION_OBSERVED', fixture: options.fixture ?? false, events: [] })
  function record(event: TracePayload) {
    try { trace = validateTrace({ ...trace, events: [...trace.events, { sequence: trace.events.length, elapsedMs: mono() - origin, observedAt: wall(), event }] }) }
    catch (error) { issue('EVENT_NOT_RECORDED'); throw error }
  }
  return { record, snapshot: () => structuredClone({ ...trace, captureIssues: issues }),
    async observeSend<T>(input: Extract<TracePayload, { type: 'SEND_STARTED' }>, send: () => Promise<T>,
      classify: (response: T) => { response: 'ACKNOWLEDGED' | 'REJECTED'; responseCode?: string }) {
      // Logging failures must never block sending, trigger a retry, or hide a successful response.
      let telemetryError: string | null = null
      try { record(input) } catch { telemetryError = 'SEND_START_NOT_RECORDED'; issue('SEND_START_NOT_RECORDED') }
      let result: T
      try { result = await send() } catch (error) {
        try { record({ type: 'SEND_RESPONSE', sendId: input.sendId, response: 'TRANSPORT_ERROR' }) } catch { issue('SEND_RESPONSE_NOT_RECORDED') }
        throw error // preserve the application's original error; never persist arbitrary error text
      }
      if (!telemetryError) {
        try { record({ type: 'SEND_RESPONSE', sendId: input.sendId, ...classify(result) }) } catch { telemetryError = 'SEND_RESPONSE_NOT_RECORDED'; issue('SEND_RESPONSE_NOT_RECORDED') }
      }
      return { result, telemetryError }
    },
  }
}

/** Standalone, explicitly synthetic demonstration. Never attach to archived signatures. */
export function demoTrace() {
  let elapsed = 0
  const r = createTraceRecorder({ attemptId: 'fixture-rebuild', clockDomain: 'fixture-clock', fixture: true,
    monotonicNow: () => elapsed, wallNow: () => new Date(Date.UTC(2026, 0, 1) + elapsed).toISOString() })
  const add = (ms: number, e: TracePayload) => { elapsed = ms; r.record(e) }
  add(0, { type: 'MESSAGE_BUILT', revisionId: 'r1', messageHash: 'a'.repeat(64), lastValidBlockHeight: 100 })
  add(12, { type: 'SIMULATION_OBSERVED', revisionId: 'r1', outcome: 'SUCCESS' })
  add(20, { type: 'SIGNED', revisionId: 'r1', signature: '1'.repeat(88) })
  add(25, { type: 'SEND_STARTED', revisionId: 'r1', sendId: 'send1', providerLabel: 'configured-rpc' })
  add(160, { type: 'SEND_RESPONSE', sendId: 'send1', response: 'TRANSPORT_ERROR' })
  add(400, { type: 'SEND_STARTED', revisionId: 'r1', sendId: 'send2', providerLabel: 'configured-rpc' })
  add(460, { type: 'SEND_RESPONSE', sendId: 'send2', response: 'ACKNOWLEDGED' })
  add(1000, { type: 'EXPIRY_OBSERVED', revisionId: 'r1', observedBlockHeight: 101 })
  add(1010, { type: 'MESSAGE_BUILT', revisionId: 'r2', replacesRevisionId: 'r1', messageHash: 'b'.repeat(64), lastValidBlockHeight: 250 })
  add(1020, { type: 'SIGNED', revisionId: 'r2', signature: '2'.repeat(88) })
  add(1030, { type: 'SEND_STARTED', revisionId: 'r2', sendId: 'send3', providerLabel: 'configured-rpc' })
  add(1090, { type: 'SEND_RESPONSE', sendId: 'send3', response: 'ACKNOWLEDGED' })
  add(1600, { type: 'RECEIPT_OBSERVED', signature: '2'.repeat(88), slot: 12345, commitment: 'processed', outcome: 'FAILED' })
  add(14000, { type: 'RECEIPT_OBSERVED', signature: '2'.repeat(88), slot: 12345, commitment: 'finalized', outcome: 'FAILED' })
  add(15000, { type: 'DEADLINE_REACHED' })
  return r.snapshot()
}
