import {
  deriveExecutionState,
  documentedErrorHeadline,
  findExplicitProgramError,
  type ExplicitProgramError,
  type ReceiptRpcTransaction,
} from '../lib/receipt-evidence.ts'

/**
 * Research-only execution lifecycle model.
 *
 * It deliberately accepts evidence supplied by an opt-in integrator or provider;
 * it does not submit transactions, store credentials, or infer missing stages.
 */
export const EXECUTION_TRACE_SCHEMA_VERSION = 'breadlines-execution-trace-v0' as const

export type TraceSource =
  | 'INTEGRATOR_CLIENT'
  | 'INTEGRATOR_SERVER'
  | 'SUBMISSION_PROVIDER'
  | 'PRECONFIRMATION_PROVIDER'
  | 'FINAL_RPC'

export type TraceEvent =
  | {
      sequence: number
      observedAt: string
      source: 'INTEGRATOR_CLIENT' | 'INTEGRATOR_SERVER'
      type: 'ATTEMPT_CREATED'
      localCorrelationId?: string
    }
  | {
      sequence: number
      observedAt: string
      source: 'INTEGRATOR_CLIENT' | 'INTEGRATOR_SERVER'
      type: 'MESSAGE_BUILT'
      messageHash: string
      computeUnitLimit?: number
      computeUnitPriceMicroLamports?: number
      lastValidBlockHeight?: number
    }
  | {
      sequence: number
      observedAt: string
      source: 'INTEGRATOR_CLIENT' | 'INTEGRATOR_SERVER'
      type: 'SIMULATION_COMPLETED'
      outcome: 'SUCCESS' | 'FAILED'
      logs?: string[]
    }
  | {
      sequence: number
      observedAt: string
      source: 'INTEGRATOR_CLIENT' | 'INTEGRATOR_SERVER'
      type: 'SIGNATURE_CREATED'
      signature: string
    }
  | {
      sequence: number
      observedAt: string
      source: 'INTEGRATOR_CLIENT' | 'INTEGRATOR_SERVER'
      type: 'SUBMISSION_ATTEMPTED'
      providerLabel: string
      submissionId?: string
    }
  | {
      sequence: number
      observedAt: string
      source: 'SUBMISSION_PROVIDER'
      type: 'SUBMISSION_ACKNOWLEDGED'
      providerLabel: string
      submissionId?: string
      providerRequestId?: string
    }
  | {
      sequence: number
      observedAt: string
      source: 'SUBMISSION_PROVIDER'
      type: 'SUBMISSION_REJECTED'
      providerLabel: string
      rejectionCode?: string
      rejectionMessage?: string
    }
  | {
      sequence: number
      observedAt: string
      source: 'PRECONFIRMATION_PROVIDER'
      type: 'PRECONFIRMATION_OBSERVED'
      signature: string
      slot: number
      localExecutionStatus: 'SUCCESS' | 'FAILED'
    }
  | {
      sequence: number
      observedAt: string
      source: 'FINAL_RPC'
      type: 'FINAL_RECEIPT_OBSERVED'
      signature: string
      receipt: ReceiptRpcTransaction
    }
  | {
      sequence: number
      observedAt: string
      source: 'INTEGRATOR_CLIENT' | 'INTEGRATOR_SERVER' | 'FINAL_RPC'
      type: 'BLOCKHASH_EXPIRED'
      lastValidBlockHeight: number
      observedBlockHeight: number
    }
  | {
      sequence: number
      observedAt: string
      source: 'INTEGRATOR_CLIENT' | 'INTEGRATOR_SERVER'
      type: 'OBSERVATION_DEADLINE_REACHED'
      deadline: string
    }

export type ExecutionTraceInput = {
  schemaVersion: typeof EXECUTION_TRACE_SCHEMA_VERSION
  traceId: string
  attemptId: string
  events: TraceEvent[]
}

export type ExecutionTraceOutcome =
  | 'LANDED_SUCCESS'
  | 'LANDED_FAILED'
  | 'EXPIRED'
  | 'UNOBSERVED_BY_DEADLINE'
  | 'INCOMPLETE'

export type ExecutionTrace = {
  schemaVersion: typeof EXECUTION_TRACE_SCHEMA_VERSION
  traceId: string
  attemptId: string
  signature: string | null
  lifecycle: {
    attemptCreated: boolean
    messageBuilt: boolean
    simulation: 'SUCCESS' | 'FAILED' | 'UNAVAILABLE'
    signatureCreated: boolean
    submissionAttempts: number
    submissionAcknowledgements: number
    submissionRejections: number
    preconfirmation: {
      observed: boolean
      localExecutionStatus: 'SUCCESS' | 'FAILED' | null
      slot: number | null
      evidence: 'OBSERVED' | 'UNAVAILABLE'
      finalityWarning: string | null
    }
  }
  outcome: {
    value: ExecutionTraceOutcome
    evidence: 'OBSERVED' | 'DERIVED' | 'UNAVAILABLE'
    safeDescription: string
    prohibitedInterpretations: string[]
  }
  finalReceipt: {
    observed: boolean
    slot: number | null
    executionError: ExplicitProgramError | null
    headline: string | null
    evidence: 'OBSERVED' | 'UNAVAILABLE'
  }
  retentionWarnings: string[]
  timeline: TraceEvent[]
}

type ProgramName = (programId: string) => string

const prohibitedPayloadKeys = new Set([
  'apiKey',
  'authorization',
  'bearerToken',
  'privateKey',
  'secretKey',
  'rawSignedTransaction',
  'signedTransaction',
  'providerUrl',
  'rawProviderUrl',
  'endpointUrl',
  'rpcUrl',
])

function assertSafeValue(value: unknown, path = 'event') {
  if (!value || typeof value !== 'object') return

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (prohibitedPayloadKeys.has(key)) {
      throw new Error(`${path}.${key} is prohibited in an execution trace`)
    }
    assertSafeValue(nested, `${path}.${key}`)
  }
}

function validateTimeline(events: TraceEvent[]) {
  if (!events.length) throw new Error('Execution Trace requires at least one event')

  let previousSequence = -1
  for (const event of events) {
    if (!Number.isInteger(event.sequence) || event.sequence < 0) {
      throw new Error('Trace event sequence must be a non-negative integer')
    }
    if (event.sequence <= previousSequence) {
      throw new Error('Trace events must be supplied in strictly increasing sequence order')
    }
    if (!Number.isFinite(Date.parse(event.observedAt))) {
      throw new Error(`Trace event ${event.sequence} has an invalid observedAt timestamp`)
    }
    if (event.type === 'BLOCKHASH_EXPIRED' && event.observedBlockHeight <= event.lastValidBlockHeight) {
      throw new Error('BLOCKHASH_EXPIRED requires an observed block height greater than lastValidBlockHeight')
    }
    assertSafeValue(event)
    previousSequence = event.sequence
  }
}

function traceSignatures(events: TraceEvent[]) {
  const signatures = events.flatMap((event) =>
    'signature' in event && event.signature ? [event.signature] : [],
  )
  const distinct = [...new Set(signatures)]
  if (distinct.length > 1) throw new Error('One Execution Trace cannot contain multiple signatures')
  return distinct[0] ?? null
}

function finalReceipt(events: TraceEvent[]) {
  const receipts = events.filter((event): event is Extract<TraceEvent, { type: 'FINAL_RECEIPT_OBSERVED' }> =>
    event.type === 'FINAL_RECEIPT_OBSERVED',
  )
  if (receipts.length > 1) throw new Error('One Execution Trace cannot contain multiple final receipt events')
  return receipts[0] ?? null
}

function outcomeWithoutReceipt(events: TraceEvent[]): ExecutionTrace['outcome'] {
  const expired = events.some((event) => event.type === 'BLOCKHASH_EXPIRED')
  if (expired) {
    return {
      value: 'EXPIRED',
      evidence: 'OBSERVED',
      safeDescription: 'The trace observed a block height beyond the transaction\'s last valid block height; this attempt expired before a final receipt was observed.',
      prohibitedInterpretations: [
        'The provider dropped the transaction.',
        'The transaction was rejected by the network for a particular reason.',
        'A specific provider caused the expiry.',
      ],
    }
  }

  if (events.some((event) => event.type === 'OBSERVATION_DEADLINE_REACHED')) {
    return {
      value: 'UNOBSERVED_BY_DEADLINE',
      evidence: 'OBSERVED',
      safeDescription: 'No final receipt was observed by the declared observation deadline.',
      prohibitedInterpretations: [
        'The transaction was dropped.',
        'The transaction was never submitted.',
        'A provider or the network caused the missing observation.',
      ],
    }
  }

  return {
    value: 'INCOMPLETE',
    evidence: 'UNAVAILABLE',
    safeDescription: 'The trace does not yet contain a final receipt, proven expiry, or declared observation deadline.',
    prohibitedInterpretations: [
      'The transaction landed.',
      'The transaction failed.',
      'The transaction was dropped.',
    ],
  }
}

export function buildExecutionTrace(
  input: ExecutionTraceInput,
  programName: ProgramName = (programId) => programId,
): ExecutionTrace {
  if (input.schemaVersion !== EXECUTION_TRACE_SCHEMA_VERSION) {
    throw new Error(`Unsupported Execution Trace schema: ${input.schemaVersion}`)
  }
  if (!input.traceId || !input.attemptId) throw new Error('Execution Trace requires traceId and attemptId')

  validateTimeline(input.events)
  const signature = traceSignatures(input.events)
  const receiptEvent = finalReceipt(input.events)
  const preconfirmation = input.events.find(
    (event): event is Extract<TraceEvent, { type: 'PRECONFIRMATION_OBSERVED' }> =>
      event.type === 'PRECONFIRMATION_OBSERVED',
  ) ?? null
  const simulation = [...input.events].reverse().find(
    (event): event is Extract<TraceEvent, { type: 'SIMULATION_COMPLETED' }> =>
      event.type === 'SIMULATION_COMPLETED',
  ) ?? null

  let finalReceiptEvidence: ExecutionTrace['finalReceipt'] = {
    observed: false,
    slot: null,
    executionError: null,
    headline: null,
    evidence: 'UNAVAILABLE',
  }
  let outcome: ExecutionTrace['outcome']

  if (receiptEvent) {
    const executionState = deriveExecutionState(receiptEvent.receipt)
    if (executionState === 'did-not-land') {
      throw new Error('FINAL_RECEIPT_OBSERVED requires a landed RPC receipt with a slot')
    }
    const executionError = executionState === 'landed-but-failed'
      ? findExplicitProgramError(receiptEvent.receipt, programName)
      : null
    finalReceiptEvidence = {
      observed: true,
      slot: receiptEvent.receipt.slot,
      executionError,
      headline: documentedErrorHeadline({
        executionState,
        slot: receiptEvent.receipt.slot,
        executionError,
      }),
      evidence: 'OBSERVED',
    }
    outcome = executionState === 'landed-but-failed'
      ? {
          value: 'LANDED_FAILED',
          evidence: 'DERIVED',
          safeDescription: 'A final receipt was observed and its execution metadata records a failure.',
          prohibitedInterpretations: [
            'The failure was caused by submission, routing, congestion, or a provider unless the receipt establishes it.',
            'An earlier preconfirmation is equivalent to finality.',
          ],
        }
      : {
          value: 'LANDED_SUCCESS',
          evidence: 'DERIVED',
          safeDescription: 'A final receipt was observed and its execution metadata does not record an error.',
          prohibitedInterpretations: [
            'The chosen provider caused the success.',
            'An earlier preconfirmation is equivalent to finality.',
          ],
        }
  } else {
    outcome = outcomeWithoutReceipt(input.events)
  }

  const retentionWarnings = [
    'Do not store raw signed transactions, private keys, API keys, authorization headers, or raw provider URLs in this trace.',
    'Client-observed timestamps and server/provider timestamps are distinct clocks; preserve them, but do not subtract them as a network-latency claim without clock discipline.',
    'A preconfirmation is leader-local execution evidence, not final landed evidence.',
  ]

  return {
    schemaVersion: EXECUTION_TRACE_SCHEMA_VERSION,
    traceId: input.traceId,
    attemptId: input.attemptId,
    signature,
    lifecycle: {
      attemptCreated: input.events.some((event) => event.type === 'ATTEMPT_CREATED'),
      messageBuilt: input.events.some((event) => event.type === 'MESSAGE_BUILT'),
      simulation: simulation?.outcome ?? 'UNAVAILABLE',
      signatureCreated: input.events.some((event) => event.type === 'SIGNATURE_CREATED'),
      submissionAttempts: input.events.filter((event) => event.type === 'SUBMISSION_ATTEMPTED').length,
      submissionAcknowledgements: input.events.filter((event) => event.type === 'SUBMISSION_ACKNOWLEDGED').length,
      submissionRejections: input.events.filter((event) => event.type === 'SUBMISSION_REJECTED').length,
      preconfirmation: {
        observed: Boolean(preconfirmation),
        localExecutionStatus: preconfirmation?.localExecutionStatus ?? null,
        slot: preconfirmation?.slot ?? null,
        evidence: preconfirmation ? 'OBSERVED' : 'UNAVAILABLE',
        finalityWarning: preconfirmation
          ? 'This is leader-local execution evidence. It is not proof that a final block landed.'
          : null,
      },
    },
    outcome,
    finalReceipt: finalReceiptEvidence,
    retentionWarnings,
    timeline: input.events,
  }
}
