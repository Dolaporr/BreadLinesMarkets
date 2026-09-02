import {
  buildExecutionXray,
  EXECUTION_XRAY_SCHEMA_VERSION,
  type ExecutionXrayInput,
} from './execution-xray-core.ts'

/**
 * A comparable, evidence-labelled record generated for every X-Ray.
 * It is intentionally not a prediction, a causal verdict, or a score.
 */
export const EXECUTION_EPISODE_SCHEMA_VERSION = 'breadlines-execution-episode-v0' as const

export type EvidenceGrade =
  | 'A_CHAIN_PROVEN'
  | 'B_DIRECTLY_OBSERVED'
  | 'C_SUPPORTED_INFERENCE'
  | 'D_HYPOTHESIS'
  | 'UNKNOWN'

export type EvidenceClaim = {
  grade: EvidenceGrade
  statement: string
  basis: string[]
  prohibitedExpansion: string | null
}

export type TelemetryRequirement = {
  id:
    | 'SUBMISSION_TIME'
    | 'PROVIDER_INGRESS'
    | 'LEADER_ARRIVAL_OR_SELECTION'
    | 'COMPLETE_BLOCK_CONTEXT'
    | 'PROGRAM_SPECIFIC_STATE'
    | 'ERROR_SEMANTICS'
    | 'CONTROLLED_COUNTERFACTUAL'
  neededToAnswer: string
  minimumEvidence: string
}

export type ExecutionEpisodeInput = {
  schemaVersion: typeof EXECUTION_EPISODE_SCHEMA_VERSION
  xray: ExecutionXrayInput
}

function uniqueRequirements(requirements: TelemetryRequirement[]) {
  const seen = new Set<TelemetryRequirement['id']>()
  return requirements.filter((requirement) => {
    if (seen.has(requirement.id)) return false
    seen.add(requirement.id)
    return true
  })
}

export function buildExecutionEpisode(input: ExecutionEpisodeInput) {
  if (input.schemaVersion !== EXECUTION_EPISODE_SCHEMA_VERSION) {
    throw new Error(`Unsupported Execution Episode schema: ${input.schemaVersion}`)
  }
  if (input.xray.schemaVersion !== EXECUTION_XRAY_SCHEMA_VERSION) {
    throw new Error('Execution Episode requires an Execution X-Ray v0 input')
  }

  const xray = buildExecutionXray(input.xray)
  const chainProven: EvidenceClaim[] = [
    {
      grade: 'A_CHAIN_PROVEN',
      statement: xray.target.headline,
      basis: ['Final landed RPC receipt', xray.target.executionState],
      prohibitedExpansion: xray.target.executionState === 'landed-but-failed'
        ? 'The receipt alone does not establish why the broader execution environment produced that program result.'
        : 'A landed success does not establish that a provider, route, fee, or timing choice caused the success.',
    },
  ]
  if (xray.target.executionError) {
    chainProven.push({
      grade: 'A_CHAIN_PROVEN',
      statement: `The final receipt identifies ${xray.target.executionError.program}${xray.target.executionError.code == null ? '' : ` error ${xray.target.executionError.code}`}.`,
      basis: [xray.target.executionError.log],
      prohibitedExpansion: 'A failing invocation frame does not by itself establish user intent, a root cause outside that frame, or fault by an outer integrator.',
    })
  }

  const directlyObserved: EvidenceClaim[] = []
  if (xray.context.sharedWritableActivity.evidence !== 'UNAVAILABLE') {
    directlyObserved.push({
      grade: 'B_DIRECTLY_OBSERVED',
      statement: xray.context.sharedWritableActivity.safeDescription,
      basis: [
        `Declared slot range ${xray.context.slotRange.start}–${xray.context.slotRange.end}`,
        xray.context.sourceDescription,
      ],
      prohibitedExpansion: 'Shared writable-account activity does not establish a state change, contention causality, or that another transaction took an opportunity from the target.',
    })
  }
  if (xray.context.overlappingSignerRecurrence.evidence !== 'UNAVAILABLE') {
    directlyObserved.push({
      grade: 'B_DIRECTLY_OBSERVED',
      statement: xray.context.overlappingSignerRecurrence.safeDescription,
      basis: ['Public signer metadata on observed overlapping context records'],
      prohibitedExpansion: 'A repeated address does not establish a person, bot, market maker, organisation, or coordinated group.',
    })
  }

  const unknown: EvidenceClaim[] = [
    {
      grade: 'UNKNOWN',
      statement: 'The ledger does not establish when the sender originally submitted this transaction, which provider path it used, or when it reached a leader.',
      basis: ['Landed-ledger receipt limits'],
      prohibitedExpansion: 'Do not label a nearby transaction as earlier/later by milliseconds or claim it won a race against the target.',
    },
    {
      grade: 'UNKNOWN',
      statement: 'The evidence does not establish that a different fee, provider, route, scheduler, or reservation would have changed this result.',
      basis: ['No controlled counterfactual experiment'],
      prohibitedExpansion: 'Do not issue an execution recommendation from this episode.',
    },
  ]
  if (xray.target.failureUnknowns) {
    unknown.push({
      grade: 'UNKNOWN',
      statement: xray.target.failureUnknowns,
      basis: ['Receipt-evidence boundary'],
      prohibitedExpansion: 'Do not replace this missing information with a story about MEV, congestion, a route, or a provider.',
    })
  }

  const telemetryRequirements: TelemetryRequirement[] = [
    {
      id: 'SUBMISSION_TIME',
      neededToAnswer: 'Whether another transaction was observed before or after the target was submitted.',
      minimumEvidence: 'Opt-in client/server monotonic submission timestamp and an explicit clock-domain record.',
    },
    {
      id: 'PROVIDER_INGRESS',
      neededToAnswer: 'Which delivery provider accepted the target and when.',
      minimumEvidence: 'Provider acknowledgement/request identifier plus a provider-side received timestamp.',
    },
    {
      id: 'LEADER_ARRIVAL_OR_SELECTION',
      neededToAnswer: 'Whether the target reached or was selected by the relevant leader before another transaction.',
      minimumEvidence: 'Authenticated leader, relay, or scheduling telemetry that can be joined to the signature.',
    },
    {
      id: 'PROGRAM_SPECIFIC_STATE',
      neededToAnswer: 'Whether a specific account-state transition made the target instruction invalid.',
      minimumEvidence: 'Deterministic account-role decoding and observed pre/post state evidence for the relevant program.',
    },
    {
      id: 'CONTROLLED_COUNTERFACTUAL',
      neededToAnswer: 'Whether another provider, fee, route, or execution mechanism would have changed the outcome.',
      minimumEvidence: 'Pre-registered controlled delivery experiment or a validated model with disclosed uncertainty.',
    },
  ]
  if (xray.context.coverage !== 'COMPLETE') {
    telemetryRequirements.push({
      id: 'COMPLETE_BLOCK_CONTEXT',
      neededToAnswer: 'Whether the observed nearby account overlap was complete for the declared context window.',
      minimumEvidence: 'Verified full block/context acquisition with explicit slot coverage and retry audit.',
    })
  }
  if (xray.target.executionError?.name == null && xray.target.executionError?.code != null) {
    telemetryRequirements.push({
      id: 'ERROR_SEMANTICS',
      neededToAnswer: 'What the documented custom program error means.',
      minimumEvidence: 'Program-emitted semantic logs or a first-party program error table/IDL that maps this exact program and code.',
    })
  }

  return {
    schemaVersion: EXECUTION_EPISODE_SCHEMA_VERSION,
    episodeId: `BL-XR-v0:${xray.target.signature}`,
    target: xray.target,
    context: xray.context,
    claims: {
      chainProven,
      directlyObserved,
      supportedInferences: [] as EvidenceClaim[],
      hypotheses: [] as EvidenceClaim[],
      unknown,
    },
    telemetryRequirements: uniqueRequirements(telemetryRequirements),
    fingerprint: {
      version: 'BL-XR-v0',
      finalExecutionState: xray.target.executionState,
      failure: xray.target.executionError == null
        ? null
        : {
            programId: xray.target.executionError.programId,
            code: xray.target.executionError.code,
            name: xray.target.executionError.name,
            semanticEvidence: xray.target.executionError.name == null ? 'OPAQUE' : 'DOCUMENTED',
          },
      compute: {
        requestedLimit: xray.target.computeBudget.computeUnitLimit,
        requestedPriceMicroLamports: xray.target.computeBudget.computeUnitPriceMicroLamports,
        consumed: xray.target.computeUnitsConsumed,
      },
      fee: {
        totalLamports: xray.target.totalFeeLamports,
        derivedPriorityFeeLamports: xray.target.priorityFeeLamports,
      },
      sharedWritableActivity: {
        observedCount: xray.context.sharedWritableActivity.count,
        coverage: xray.context.coverage,
        signerRecurrenceCount: xray.context.overlappingSignerRecurrence.repeatedSignerAddresses.length,
      },
      causality: 'UNDETERMINED' as const,
    },
    limitations: [
      ...xray.limitations,
      'C_SUPPORTED_INFERENCE and D_HYPOTHESIS are intentionally empty in v0. The reducer does not manufacture an inference or hypothesis from co-occurrence.',
      'Fingerprint fields are comparable raw evidence fields, not normalised pressure scores. A benchmark must be declared before assigning percentiles or bands.',
    ],
  }
}
