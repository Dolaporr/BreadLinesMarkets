import {
  collectComputeBudget,
  deriveExecutionState,
  derivePriorityFeeLamports,
  documentedErrorHeadline,
  failedReceiptUnknowns,
  findExplicitProgramError,
  type ReceiptRpcAccountKey,
  type ReceiptRpcInstruction,
  type ReceiptRpcTransaction,
} from '../lib/receipt-evidence.ts'

/**
 * Research-only, ledger-side evidence map for one landed transaction.
 *
 * It intentionally maps observable receipt and block-context facts. It does
 * not infer submission time, actor identity, state changes, causality, or a
 * probability that another delivery path would have landed the transaction.
 */
export const EXECUTION_XRAY_SCHEMA_VERSION = 'breadlines-execution-xray-v0' as const

export type XrayContextCoverage = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE'

export type XrayContextTransaction = {
  signature: string
  receipt: ReceiptRpcTransaction
  /** Position in the RPC block transaction list, not a timestamp or execution-order claim. */
  blockTransactionIndex: number | null
}

export type ExecutionXrayInput = {
  schemaVersion: typeof EXECUTION_XRAY_SCHEMA_VERSION
  target: XrayContextTransaction
  context: {
    transactions: XrayContextTransaction[]
    slotRange: { start: number; end: number }
    coverage: XrayContextCoverage
    sourceDescription: string
  }
}

type ProgramName = (programId: string) => string

type AccountWithMetadata = Exclude<ReceiptRpcAccountKey, string>

function accountAddress(account: ReceiptRpcAccountKey | undefined) {
  return typeof account === 'string' ? account : account?.pubkey
}

function writableAccounts(receipt: ReceiptRpcTransaction) {
  const accountKeys = receipt.transaction?.message?.accountKeys
  if (!accountKeys?.some((account) => typeof account !== 'string')) return null

  return [...new Set(
    accountKeys
      .filter((account): account is AccountWithMetadata => typeof account !== 'string')
      .filter((account) => account.writable)
      .map((account) => account.pubkey)
      .filter((address): address is string => Boolean(address)),
  )].sort()
}

function signerAddresses(receipt: ReceiptRpcTransaction) {
  const accountKeys = receipt.transaction?.message?.accountKeys
  if (!accountKeys?.some((account) => typeof account !== 'string')) return null

  return [...new Set(
    accountKeys
      .filter((account): account is AccountWithMetadata => typeof account !== 'string')
      .filter((account) => account.signer)
      .map((account) => account.pubkey)
      .filter((address): address is string => Boolean(address)),
  )].sort()
}

function programId(instruction: ReceiptRpcInstruction, accountKeys: ReceiptRpcAccountKey[]) {
  if (instruction.programId) return instruction.programId
  if (typeof instruction.programIdIndex === 'number') return accountAddress(accountKeys[instruction.programIdIndex])
  return undefined
}

function outerProgramIds(receipt: ReceiptRpcTransaction) {
  const accountKeys = receipt.transaction?.message?.accountKeys ?? []
  return [...new Set(
    (receipt.transaction?.message?.instructions ?? [])
      .map((instruction) => programId(instruction, accountKeys))
      .filter((value): value is string => Boolean(value)),
  )].sort()
}

function assertContextTransaction(transaction: XrayContextTransaction, label: string) {
  if (!transaction.signature) throw new Error(`${label} requires a signature`)
  if (!Number.isInteger(transaction.receipt.slot) || transaction.receipt.slot < 0) {
    throw new Error(`${label} requires a landed receipt slot`)
  }
  if (
    transaction.blockTransactionIndex != null
    && (!Number.isInteger(transaction.blockTransactionIndex) || transaction.blockTransactionIndex < 0)
  ) {
    throw new Error(`${label} blockTransactionIndex must be a non-negative integer or null`)
  }
}

function contextRelation(target: XrayContextTransaction, candidate: XrayContextTransaction) {
  if (candidate.receipt.slot < target.receipt.slot) return 'EARLIER_SLOT' as const
  if (candidate.receipt.slot > target.receipt.slot) return 'LATER_SLOT' as const
  if (candidate.blockTransactionIndex == null || target.blockTransactionIndex == null) {
    return 'SAME_SLOT_NO_BLOCK_LIST_POSITION' as const
  }
  if (candidate.blockTransactionIndex < target.blockTransactionIndex) return 'EARLIER_IN_BLOCK_LIST' as const
  if (candidate.blockTransactionIndex > target.blockTransactionIndex) return 'LATER_IN_BLOCK_LIST' as const
  return 'SAME_BLOCK_LIST_POSITION' as const
}

function stableContextOrder(a: XrayContextTransaction, b: XrayContextTransaction) {
  if (a.receipt.slot !== b.receipt.slot) return a.receipt.slot - b.receipt.slot
  const aIndex = a.blockTransactionIndex ?? Number.MAX_SAFE_INTEGER
  const bIndex = b.blockTransactionIndex ?? Number.MAX_SAFE_INTEGER
  if (aIndex !== bIndex) return aIndex - bIndex
  return a.signature.localeCompare(b.signature)
}

export function buildExecutionXray(
  input: ExecutionXrayInput,
  programName: ProgramName = (programId) => programId,
) {
  if (input.schemaVersion !== EXECUTION_XRAY_SCHEMA_VERSION) {
    throw new Error(`Unsupported Execution X-Ray schema: ${input.schemaVersion}`)
  }
  assertContextTransaction(input.target, 'Target transaction')
  if (!input.context.sourceDescription) throw new Error('Context requires a sourceDescription')
  if (!Number.isInteger(input.context.slotRange.start) || !Number.isInteger(input.context.slotRange.end)) {
    throw new Error('Context slot range must contain integer slots')
  }
  if (input.context.slotRange.start > input.context.slotRange.end) {
    throw new Error('Context slot range start cannot exceed end')
  }
  if (
    input.target.receipt.slot < input.context.slotRange.start
    || input.target.receipt.slot > input.context.slotRange.end
  ) {
    throw new Error('Context slot range must include the target slot')
  }

  const contextSignatures = new Set<string>()
  for (const transaction of input.context.transactions) {
    assertContextTransaction(transaction, 'Context transaction')
    if (transaction.signature === input.target.signature) {
      throw new Error('Context must not repeat the target transaction')
    }
    if (contextSignatures.has(transaction.signature)) {
      throw new Error(`Context contains duplicate signature ${transaction.signature}`)
    }
    if (
      transaction.receipt.slot < input.context.slotRange.start
      || transaction.receipt.slot > input.context.slotRange.end
    ) {
      throw new Error(`Context transaction ${transaction.signature} falls outside the declared slot range`)
    }
    contextSignatures.add(transaction.signature)
  }

  const targetState = deriveExecutionState(input.target.receipt)
  if (targetState === 'did-not-land') throw new Error('Execution X-Ray v0 requires a landed target receipt')

  const targetWritableAccounts = writableAccounts(input.target.receipt)
  const targetPrograms = outerProgramIds(input.target.receipt)
  const targetComputeBudget = collectComputeBudget(input.target.receipt)
  const targetPriorityFee = derivePriorityFeeLamports(input.target.receipt, targetComputeBudget)
  const executionError = targetState === 'landed-but-failed'
    ? findExplicitProgramError(input.target.receipt, programName)
    : null

  const unresolvedContextWritableMetadata = input.context.transactions.filter(
    (transaction) => writableAccounts(transaction.receipt) == null,
  ).length
  const targetWritableSet = new Set(targetWritableAccounts ?? [])
  const overlaps = targetWritableAccounts == null
    ? []
    : input.context.transactions
      .map((transaction) => {
        const candidateWritableAccounts = writableAccounts(transaction.receipt)
        const sharedWritableAccounts = (candidateWritableAccounts ?? [])
          .filter((address) => targetWritableSet.has(address))
          .sort()
        return { transaction, candidateWritableAccounts, sharedWritableAccounts }
      })
      .filter(({ sharedWritableAccounts }) => sharedWritableAccounts.length > 0)
      .sort((a, b) => stableContextOrder(a.transaction, b.transaction))
      .map(({ transaction, sharedWritableAccounts }) => ({
        signature: transaction.signature,
        slot: transaction.receipt.slot,
        blockTransactionIndex: transaction.blockTransactionIndex,
        slotRelation: contextRelation(input.target, transaction),
        executionState: deriveExecutionState(transaction.receipt),
        signerAddresses: signerAddresses(transaction.receipt),
        sharedWritableAccounts,
        outerProgramIds: outerProgramIds(transaction.receipt),
        evidence: 'OBSERVED' as const,
      }))

  const overlapDescription = targetWritableAccounts == null
    ? 'Writable-account metadata is unavailable for the target receipt, so shared writable-account activity cannot be calculated.'
    : input.context.coverage === 'COMPLETE'
      ? `${overlaps.length} context transaction(s) in the declared slot range shared at least one writable account with the target.`
      : `At least ${overlaps.length} sampled context transaction(s) in the declared slot range shared at least one writable account with the target.`

  const overlapEvidence = targetWritableAccounts == null
    ? 'UNAVAILABLE' as const
    : input.context.coverage === 'UNAVAILABLE'
      ? 'UNAVAILABLE' as const
      : 'DERIVED' as const

  const overlapSignerCounts = new Map<string, number>()
  let overlappingRecordsWithoutSignerMetadata = 0
  for (const record of overlaps) {
    if (record.signerAddresses == null) {
      overlappingRecordsWithoutSignerMetadata += 1
      continue
    }
    for (const signer of record.signerAddresses) {
      overlapSignerCounts.set(signer, (overlapSignerCounts.get(signer) ?? 0) + 1)
    }
  }
  const repeatedSignerAddresses = [...overlapSignerCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort(([firstAddress, firstCount], [secondAddress, secondCount]) => secondCount - firstCount || firstAddress.localeCompare(secondAddress))
    .map(([address, count]) => ({ address, observedOverlappingTransactionCount: count }))

  return {
    schemaVersion: EXECUTION_XRAY_SCHEMA_VERSION,
    target: {
      signature: input.target.signature,
      slot: input.target.receipt.slot,
      blockTransactionIndex: input.target.blockTransactionIndex,
      blockTransactionIndexEvidence: input.target.blockTransactionIndex == null ? 'UNAVAILABLE' as const : 'OBSERVED' as const,
      executionState: targetState,
      headline: documentedErrorHeadline({
        executionState: targetState,
        slot: input.target.receipt.slot,
        executionError,
      }),
      executionError,
      failureUnknowns: failedReceiptUnknowns({ executionState: targetState, executionError }),
      outerProgramIds: targetPrograms,
      totalFeeLamports: typeof input.target.receipt.meta?.fee === 'number' ? input.target.receipt.meta.fee : null,
      computeUnitsConsumed: typeof input.target.receipt.meta?.computeUnitsConsumed === 'number'
        ? input.target.receipt.meta.computeUnitsConsumed
        : null,
      computeBudget: targetComputeBudget,
      priorityFeeLamports: targetPriorityFee.amountLamports,
      priorityFeeDerivation: targetPriorityFee.derivation,
      writableAccounts: targetWritableAccounts,
      writableAccountEvidence: targetWritableAccounts == null ? 'UNAVAILABLE' as const : 'OBSERVED' as const,
      signerAddresses: signerAddresses(input.target.receipt),
      signerEvidence: signerAddresses(input.target.receipt) == null ? 'UNAVAILABLE' as const : 'OBSERVED' as const,
    },
    context: {
      slotRange: input.context.slotRange,
      coverage: input.context.coverage,
      sourceDescription: input.context.sourceDescription,
      observedTransactionCount: input.context.transactions.length,
      contextTransactionsWithoutWritableMetadata: unresolvedContextWritableMetadata,
      sharedWritableActivity: {
        records: overlaps,
        count: overlaps.length,
        evidence: overlapEvidence,
        safeDescription: overlapDescription,
        prohibitedInterpretations: [
          'A shared writable account proves that another transaction caused the target result.',
          'The context addresses are bots, competitors, or a coordinated group.',
          'The target transaction arrived before or after another transaction at a particular millisecond.',
          'A transaction-list position proves serial execution time.',
          'The target result would have changed under a different RPC, route, fee, or scheduler.',
        ],
      },
      overlappingSignerRecurrence: {
        repeatedSignerAddresses,
        uniqueObservedSignerAddressCount: overlapSignerCounts.size,
        recordsWithoutSignerMetadata: overlappingRecordsWithoutSignerMetadata,
        evidence: targetWritableAccounts == null || input.context.coverage === 'UNAVAILABLE'
          ? 'UNAVAILABLE' as const
          : 'DERIVED' as const,
        safeDescription: repeatedSignerAddresses.length
          ? `${repeatedSignerAddresses.length} signer address(es) appeared in more than one observed overlapping context transaction.`
          : 'No signer address appeared in more than one observed overlapping context transaction with available signer metadata.',
        prohibitedInterpretations: [
          'Repeated signer addresses identify a person, bot, market maker, organisation, or coordinated group.',
          'Repeated signer activity caused the target transaction result.',
        ],
      },
    },
    limitations: [
      'Ledger receipts do not reveal original submission time, sender path, dropped-before-landing traffic, or a complete pending queue.',
      'Same-slot block transaction-list position is not a wall-clock timestamp and is not presented as proof of execution order.',
      'A shared writable account is an observed account overlap, not proof of state change, contention causality, or an avoidable failure.',
      'Outer program IDs do not identify an address, organisation, trading strategy, or transaction intent.',
    ],
  }
}
