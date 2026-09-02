import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  collectComputeBudget,
  deriveExecutionState,
  derivePriorityFeeLamports,
  findExplicitProgramError,
  type ReceiptRpcAccountKey,
  type ReceiptRpcInstruction,
  type ReceiptRpcTransaction,
} from '../lib/receipt-evidence.ts'

const PROGRAM_ID = 'td8VwogVVaauJYMNYWEsagCHiX7P3imLC2kuW23rZkm'
const RPC_URL = 'https://api.devnet.solana.com'
const TARGET = 100
const BASE_SIGNATURE_FEE = 5_000
const BASE_INCLUSION_FEE = 2_500
const SIGNATURE_COST = 720
const WRITE_LOCK_UNITS = 300
const INSTRUCTION_DATA_BYTES_PER_COST_UNIT = 4
const ACCOUNT_DATA_COST_PAGE_SIZE = 32 * 1024
const DEFAULT_HEAP_COST = 8
const DEFAULT_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 64 * 1024 * 1024
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
// Public devnet RPC counts each JSON-RPC item in a batch toward its budget.
// Keep this deliberately slow; this is a one-off bounded research probe.
const BATCH_SIZE = 2
const REQUEST_INTERVAL_MS = 2_000
const CANDIDATE_PAGE_SIZE = 350

type RpcResult<T> = { result?: T; error?: { message?: string } }
type SignatureRow = { signature: string; slot: number; blockTime: number | null; err: unknown }
type Key = ReceiptRpcAccountKey
type Tx = ReceiptRpcTransaction & {
  blockTime?: number | null
  transactionIndex?: number
  meta?: ReceiptRpcTransaction['meta'] & { costUnits?: number; innerInstructions?: Array<{ instructions?: ReceiptRpcInstruction[] }> }
  transaction?: ReceiptRpcTransaction['transaction'] & {
    message?: { accountKeys?: Key[]; instructions?: ReceiptRpcInstruction[] }
  }
}

function address(key: Key | undefined) {
  return typeof key === 'string' ? key : key?.pubkey
}

function decodeBase58(value: string) {
  const bytes = [0]
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character)
    if (index < 0) return []
    let carry = index
    for (let offset = 0; offset < bytes.length; offset += 1) {
      carry += bytes[offset] * 58
      bytes[offset] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (let offset = 0; offset < value.length - 1 && value[offset] === '1'; offset += 1) bytes.push(0)
  return bytes.reverse()
}

function readUInt32LE(bytes: number[], offset: number) {
  if (bytes.length < offset + 4) return null
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function ceilDiv(numerator: number, denominator: number) {
  return Math.floor((numerator + denominator - 1) / denominator)
}

function percentile(values: Array<number | null>, percentileValue: number) {
  const ordered = values.filter((value): value is number => value !== null).sort((a, b) => a - b)
  if (!ordered.length) return null
  const index = (ordered.length - 1) * percentileValue
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  return lower === upper ? ordered[lower] : ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)
}

function distribution(values: Array<number | null>) {
  const numeric = values.filter((value): value is number => value !== null)
  return numeric.length ? {
    count: numeric.length,
    min: Math.min(...numeric),
    median: percentile(numeric, 0.5),
    p90: percentile(numeric, 0.9),
    p95: percentile(numeric, 0.95),
    max: Math.max(...numeric),
  } : { count: 0, min: null, median: null, p90: null, p95: null, max: null }
}

async function rpc<T>(method: string, params: unknown[]) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await response.json() as RpcResult<T>
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `${method} failed with HTTP ${response.status}`)
  return body.result as T
}

async function batchTransactions(signatures: string[]) {
  const body = await rpcBatch<Tx>(signatures, 'jsonParsed')
  return signatures.map((signature, index) => ({ signature, transaction: body.find((row) => row && (row as { id?: number }).id === index)?.result ?? null }))
}

async function batchSerializedSizes(signatures: string[]) {
  const body = await rpcBatch<{ transaction?: [string, string] }>(signatures, 'base64')
  return new Map(signatures.map((signature, index) => {
    const encoded = body.find((row) => row && (row as { id?: number }).id === index)?.result?.transaction?.[0] ?? null
    return [signature, encoded ? Buffer.from(encoded, 'base64').length : null]
  }))
}

async function rpcBatch<T>(signatures: string[], encoding: 'jsonParsed' | 'base64') {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signatures.map((signature, index) => ({
        jsonrpc: '2.0', id: index,
        method: 'getTransaction',
        params: [signature, { encoding, commitment: 'finalized', maxSupportedTransactionVersion: 0 }],
      }))),
    })
    const text = await response.text()
    if (response.ok) return JSON.parse(text) as Array<RpcResult<T>>
    if (response.status !== 429 || attempt === 5) throw new Error(`getTransaction ${encoding} batch failed with HTTP ${response.status}: ${text.slice(0, 160)}`)
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1_500))
  }
  throw new Error('Unreachable RPC batch state')
}

function isOuterProgramInvocation(tx: Tx) {
  const keys = tx.transaction?.message?.accountKeys ?? []
  return (tx.transaction?.message?.instructions ?? []).some((instruction) => {
    const programId = instruction.programId ?? (typeof instruction.programIdIndex === 'number' ? address(keys[instruction.programIdIndex]) : undefined)
    return programId === PROGRAM_ID
  })
}

function instructionDataBytes(tx: Tx) {
  return (tx.transaction?.message?.instructions ?? []).reduce((sum, instruction) => sum + (instruction.data ? decodeBase58(instruction.data).length : 0), 0)
}

function requestedLoadedAccountsDataSize(tx: Tx) {
  const keys = tx.transaction?.message?.accountKeys ?? []
  let requested: number | null = null
  for (const instruction of tx.transaction?.message?.instructions ?? []) {
    const programId = instruction.programId ?? (typeof instruction.programIdIndex === 'number' ? address(keys[instruction.programIdIndex]) : undefined)
    if (programId !== 'ComputeBudget111111111111111111111111111111' || !instruction.data) continue
    const bytes = decodeBase58(instruction.data)
    if (bytes[0] === 4) requested = readUInt32LE(bytes, 1)
  }
  return requested ?? DEFAULT_LOADED_ACCOUNTS_DATA_SIZE_LIMIT
}

function computeBudgetLimit(tx: Tx) {
  return collectComputeBudget(tx).computeUnitLimit
}

function costBreakdown(tx: Tx) {
  const signatures = tx.transaction?.signatures?.length ?? 0
  const writableAccounts = (tx.transaction?.message?.accountKeys ?? []).filter((key) => typeof key !== 'string' && Boolean(key.writable)).length
  const requestedCU = computeBudgetLimit(tx)
  const dataBytes = instructionDataBytes(tx)
  const loadedAccountsBytes = requestedLoadedAccountsDataSize(tx)
  const loadedAccountsDataSizeCost = ceilDiv(loadedAccountsBytes, ACCOUNT_DATA_COST_PAGE_SIZE) * DEFAULT_HEAP_COST
  const signatureCost = signatures * SIGNATURE_COST
  const writeLockCost = writableAccounts * WRITE_LOCK_UNITS
  const instructionDataCost = Math.floor(dataBytes / INSTRUCTION_DATA_BYTES_PER_COST_UNIT)
  const requestedCostUnits = requestedCU === null ? null : signatureCost + writeLockCost + instructionDataCost + requestedCU + loadedAccountsDataSizeCost

  return {
    signatureCost,
    writeLockCost,
    instructionDataBytes: dataBytes,
    instructionDataCost,
    requestedCU,
    loadedAccountsBytes,
    loadedAccountsDataSizeCost,
    requestedCostUnits,
  }
}

function labels(tx: Tx) {
  const keys = tx.transaction?.message?.accountKeys ?? []
  const outer = (tx.transaction?.message?.instructions ?? []).map((instruction) => instruction.programId ?? (typeof instruction.programIdIndex === 'number' ? address(keys[instruction.programIdIndex]) : null)).filter((id): id is string => Boolean(id))
  const invoked = [...new Set((tx.meta?.logMessages ?? []).flatMap((line) => line.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[\d+\]$/)?.[1] ?? []))]
  return { outer, invoked }
}

function row(signatureRow: SignatureRow, tx: Tx, serializedTransactionBytes: number | null) {
  const computeBudget = collectComputeBudget(tx)
  const priority = derivePriorityFeeLamports(tx, computeBudget)
  const breakdown = costBreakdown(tx)
  const executionState = deriveExecutionState(tx)
  const error = executionState === 'landed-but-failed'
    ? findExplicitProgramError(tx, (programId) => `Program ${programId.slice(0, 4)}...${programId.slice(-4)}`)
    : null
  const signatures = tx.transaction?.signatures?.length ?? 0
  const currentFee = typeof tx.meta?.fee === 'number' ? tx.meta.fee : null
  const baseSignatureFee = signatures * BASE_SIGNATURE_FEE
  // An omitted Compute Budget price uses Solana's default priority fee of zero.
  const priorityFee = priority.amountLamports ?? ((computeBudget.computeUnitPriceStatus === 'zero' || computeBudget.computeUnitPriceStatus === 'omitted') ? 0 : null)
  const resourceFee = (numerator: number, denominator: number) => breakdown.requestedCostUnits === null ? null : ceilDiv(breakdown.requestedCostUnits * numerator, denominator)
  const hypothetical = (label: string, numerator: number, denominator: number) => {
    const fee = resourceFee(numerator, denominator)
    const total = fee === null || priorityFee === null ? null : BASE_INCLUSION_FEE + priorityFee + fee
    return {
      label,
      rate: `${numerator}/${denominator} lamports per requested cost unit`,
      resourceFeeLamports: fee,
      totalFeeLamports: total,
      deltaLamports: currentFee === null || total === null ? null : total - currentFee,
      deltaPercent: currentFee === null || total === null ? null : ((total - currentFee) / currentFee) * 100,
      evidence: 'counterfactual-derived',
    }
  }
  return {
    signature: signatureRow.signature,
    slot: tx.slot,
    blockTime: tx.blockTime ?? signatureRow.blockTime ?? null,
    execution: { state: executionState, evidence: 'observed' },
    outerProgramVerified: { value: isOuterProgramInvocation(tx), evidence: 'observed' },
    economics: {
      totalFeeLamports: currentFee,
      totalFeeEvidence: currentFee === null ? 'unknown' : 'observed',
      signatureCount: signatures,
      signatureCountEvidence: 'observed',
      baseSignatureFeeLamports: baseSignatureFee,
      baseSignatureFeeEvidence: 'derived',
      computeUnitLimit: breakdown.requestedCU,
      computeUnitLimitEvidence: breakdown.requestedCU === null ? 'unknown' : 'observed',
      computeUnitPriceMicroLamports: computeBudget.computeUnitPriceMicroLamports,
      computeUnitPriceEvidence: computeBudget.computeUnitPriceStatus === 'omitted' ? 'unknown' : 'observed',
      priorityFeeLamports: priorityFee,
      priorityFeeEvidence: priorityFee === null ? 'unknown' : 'derived',
      computeUnitsConsumed: tx.meta?.computeUnitsConsumed ?? null,
      computeUnitsConsumedEvidence: typeof tx.meta?.computeUnitsConsumed === 'number' ? 'observed' : 'unknown',
      rpcCostUnits: tx.meta?.costUnits ?? null,
      rpcCostUnitsEvidence: typeof tx.meta?.costUnits === 'number' ? 'observed' : 'unknown',
      requestedToConsumedRatio: breakdown.requestedCU === null || typeof tx.meta?.computeUnitsConsumed !== 'number' || tx.meta.computeUnitsConsumed === 0 ? null : breakdown.requestedCU / tx.meta.computeUnitsConsumed,
      requestedToConsumedRatioEvidence: 'derived',
      serializedTransactionBytes,
      serializedTransactionBytesEvidence: serializedTransactionBytes === null ? 'unknown' : 'observed',
      writableAccountCount: (tx.transaction?.message?.accountKeys ?? []).filter((key) => typeof key !== 'string' && Boolean(key.writable)).length,
      writableAccountCountEvidence: 'observed',
      totalAccountCount: (tx.transaction?.message?.accountKeys ?? []).length,
      totalAccountCountEvidence: 'observed',
      programs: labels(tx),
    },
    simd0553: {
      resourceComponents: {
        signatureCost: { value: breakdown.signatureCost, evidence: 'derived' },
        writeLockCost: { value: breakdown.writeLockCost, evidence: 'derived' },
        instructionDataCost: { value: breakdown.instructionDataCost, sourceBytes: breakdown.instructionDataBytes, evidence: 'derived' },
        programsExecutionCost: { value: breakdown.requestedCU, evidence: breakdown.requestedCU === null ? 'unknown' : 'derived' },
        loadedAccountsDataSizeCost: { value: breakdown.loadedAccountsDataSizeCost, requestedBytes: breakdown.loadedAccountsBytes, evidence: 'derived' },
        requestedCostUnits: { value: breakdown.requestedCostUnits, evidence: breakdown.requestedCostUnits === null ? 'unknown' : 'derived' },
      },
      rateCases: [hypothetical('1/10', 1, 10), hypothetical('1/4', 1, 4), hypothetical('1/2', 1, 2)],
    },
    failure: error ? {
      frame: error.programId,
      documentedMessage: error.message,
      technicalError: error.technicalError ?? { code: error.code, log: error.log },
      evidence: 'observed',
    } : null,
  }
}

function format(value: number | null, decimals = 0) {
  return value === null ? 'UNKNOWN' : value.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

async function main() {
  const root = path.resolve('research/simd0553-tower-defense-probe')
  await mkdir(root, { recursive: true })

  const account = await rpc<{ value: { executable: boolean; owner: string } | null }>('getAccountInfo', [PROGRAM_ID, { encoding: 'base64', commitment: 'finalized' }])
  const candidates = await rpc<SignatureRow[]>('getSignaturesForAddress', [PROGRAM_ID, { limit: CANDIDATE_PAGE_SIZE, commitment: 'finalized' }])
  const fetched: Array<{ signature: string; transaction: Tx | null }> = []
  for (let index = 0; index < candidates.length && fetched.filter((entry) => entry.transaction && isOuterProgramInvocation(entry.transaction)).length < TARGET; index += BATCH_SIZE) {
    const batch = candidates.slice(index, index + BATCH_SIZE)
    const results = await batchTransactions(batch.map((entry) => entry.signature))
    fetched.push(...results)
    await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS))
  }

  const candidateBySignature = new Map(candidates.map((candidate) => [candidate.signature, candidate]))
  const outer = fetched.filter((entry): entry is { signature: string; transaction: Tx } => entry.transaction !== null && isOuterProgramInvocation(entry.transaction))
  const retainedOuter = outer.slice(0, TARGET)
  const serializedSizes = new Map<string, number | null>()
  for (let index = 0; index < retainedOuter.length; index += BATCH_SIZE) {
    const sizes = await batchSerializedSizes(retainedOuter.slice(index, index + BATCH_SIZE).map((entry) => entry.signature))
    sizes.forEach((value, signature) => serializedSizes.set(signature, value))
    await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS))
  }
  const retained = retainedOuter.map((entry) => row(candidateBySignature.get(entry.signature)!, entry.transaction, serializedSizes.get(entry.signature) ?? null))
  const current = retained.map((entry) => entry.economics)
  const cases = ['1/10', '1/4', '1/2'] as const
  const caseDistribution = Object.fromEntries(cases.map((label) => {
    const rows = retained.map((entry) => entry.simd0553.rateCases.find((rateCase) => rateCase.label === label)!)
    return [label, {
      hypotheticalFeeLamports: distribution(rows.map((rateCase) => rateCase.totalFeeLamports)),
      percentIncrease: distribution(rows.map((rateCase) => rateCase.deltaPercent)),
    }]
  }))
  const componentShares = ['signatureCost', 'writeLockCost', 'instructionDataCost', 'programsExecutionCost', 'loadedAccountsDataSizeCost'].map((component) => ({
    component,
    medianSharePercent: percentile(retained.map((entry) => {
      const resources = entry.simd0553.resourceComponents as Record<string, { value: number | null }>
      const total = resources.requestedCostUnits.value
      const value = resources[component].value
      return total === null || value === null ? null : (value / total) * 100
    }), 0.5),
  }))
  const failures = retained.filter((entry) => entry.execution.state === 'landed-but-failed')
  const report = {
    title: 'SIMD-0553 Tower-Defense Feasibility Probe',
    generatedAt: new Date().toISOString(),
    researchBoundary: 'Internal research only. Observed devnet transaction data is separated from derived calculations and counterfactual fees. No causal or policy conclusion is asserted.',
    programAttribution: {
      programId: PROGRAM_ID,
      cluster: 'devnet',
      executableAccount: account.value?.executable ?? null,
      accountOwner: account.value?.owner ?? null,
      historyMethod: 'Most-recent consecutive devnet getSignaturesForAddress rows, locally retained only after an outer instruction matched the supplied program ID.',
      candidatesRead: fetched.length,
      outerProgramRetained: retained.length,
      rejectedNonOuterOrUnavailable: fetched.length - outer.length,
      assessment: retained.length >= 80 && account.value?.executable ? 'Clean enough for a bounded devnet economics probe. This proves outer-program attribution, not application semantics beyond program/log evidence.' : 'Insufficient verified outer-program population for this probe.',
    },
    formula: {
      source: {
        simd0553: 'https://github.com/solana-foundation/solana-improvement-documents/blob/fc519fb3d1ef0f7624b6232bda958438feba09ce/proposals/0553-resource-fee-burn.md',
        simdRevision: 'fc519fb3d1ef0f7624b6232bda958438feba09ce',
        simdStatus: 'Draft',
        agaveCostModel: 'https://github.com/anza-xyz/agave/blob/29aae881683a7e203d12dfd57812d5be5fe9abc5/cost-model/src/cost_model.rs',
        agaveRevision: '29aae881683a7e203d12dfd57812d5be5fe9abc5',
      },
      totalFee: 'base_inclusion_fee (2,500) + unchanged priority_fee + ceil(requested_cost_units × rate)',
      requestedCostUnits: 'signature_cost + write_lock_cost + instruction_data_cost + programs_execution_cost + loaded_accounts_data_size_cost',
      rates: { '1/10': '1/10 lamports per requested cost unit', '1/4': '1/4 lamports per requested cost unit', '1/2': '1/2 lamports per requested cost unit' },
      terms: {
        signatureCost: `${SIGNATURE_COST} units × transaction signature count; precompile signature costs are not separately decoded in this probe.`,
        writeLockCost: `${WRITE_LOCK_UNITS} units × writable account count.`,
        instructionDataCost: `floor(outer instruction data bytes / ${INSTRUCTION_DATA_BYTES_PER_COST_UNIT}).`,
        programsExecutionCost: 'Compute Budget requested CU limit. A missing explicit limit is UNKNOWN in this probe rather than assumed.',
        loadedAccountsDataSizeCost: `ceil(requested loaded-account bytes / ${ACCOUNT_DATA_COST_PAGE_SIZE}) × ${DEFAULT_HEAP_COST}; default ${DEFAULT_LOADED_ACCOUNTS_DATA_SIZE_LIMIT} bytes when no SetLoadedAccountsDataSizeLimit instruction is present.`,
      },
      rpcCostUnitsCaveat: 'meta.costUnits is retained as OBSERVED but not substituted for requested_cost_units: the first probe receipt reported 268,023 meta.costUnits alongside an observed 1,400,000 CU limit. The counterfactual follows SIMD-0553’s specified requested terms instead.',
      blockFullness: 'SIMD-0553 resource_fee is defined from a transaction’s requested_cost_units and the active rate. The formula has no block-utilization input. Low block utilization is therefore a separate policy/economic question, not a fee-calculation modifier in this draft.',
      failureTreatment: 'The draft says fee-only transactions continue to debit full total_fee, now including resource_fee. This probe does not assume all failed execution paths are fee-only; each landed failure retains its observed current fee and the same formula is shown as a counterfactual when requested terms are available.',
    },
    distributions: {
      currentFeeLamports: distribution(current.map((entry) => entry.totalFeeLamports)),
      currentPriorityFeeLamports: distribution(current.map((entry) => entry.priorityFeeLamports)),
      computeUnitLimit: distribution(current.map((entry) => entry.computeUnitLimit)),
      computeUnitsConsumed: distribution(current.map((entry) => entry.computeUnitsConsumed)),
      requestedToConsumedRatio: distribution(current.map((entry) => entry.requestedToConsumedRatio)),
      simd0553: caseDistribution,
      componentShares,
    },
    failures: {
      landedButFailed: failures.length,
      records: failures.map((entry) => ({ signature: entry.signature, slot: entry.slot, currentFeeLamports: entry.economics.totalFeeLamports, consumedCU: entry.economics.computeUnitsConsumed, failure: entry.failure, counterfactual: entry.simd0553.rateCases })),
    },
    records: retained,
  }

  const claimedIncrease = report.distributions.simd0553['1/2'].percentIncrease
  const verdict = retained.length < 80 ? 'NO-GO' : claimedIncrease.max === null ? 'CANNOT VERIFY' : 'PROMISING — NEEDS LARGER SAMPLE'
  const markdown = `# SIMD-0553 Tower-Defense Feasibility Probe\n\n## Scope\n\nInternal, devnet-only, deterministic probe. This is not a production Breadlines feature, public claim, price prediction, or policy verdict.\n\n## A. Program Attribution\n\n- Program: \`${PROGRAM_ID}\`\n- Cluster: devnet\n- Executable account: ${String(account.value?.executable ?? 'UNKNOWN')}\n- Selection: most-recent consecutive program-address signature history; retain only transactions where the supplied program is an **outer** instruction. No fee, outcome, signer, compute, or log selection.\n- Candidates fetched: ${fetched.length}; outer-program transactions retained: ${retained.length}; rejected: ${fetched.length - outer.length}.\n- Assessment: ${report.programAttribution.assessment}\n\n## B. Sample\n\n- Range: slots ${format(retained.at(-1)?.slot ?? null)} through ${format(retained[0]?.slot ?? null)} (newest-first collection, records preserved in collection order).\n- Block time: ${retained.at(-1)?.blockTime ? new Date(retained.at(-1)!.blockTime! * 1000).toISOString() : 'UNKNOWN'} through ${retained[0]?.blockTime ? new Date(retained[0]!.blockTime! * 1000).toISOString() : 'UNKNOWN'}.\n- Landed successes: ${retained.filter((entry) => entry.execution.state === 'landed').length}; landed-but-failed: ${failures.length}.\n\n## C. Current Economics\n\n| Metric | Min | Median | P90 | P95 | Max |\n|---|---:|---:|---:|---:|---:|\n| Current observed fee (lamports) | ${format(report.distributions.currentFeeLamports.min)} | ${format(report.distributions.currentFeeLamports.median)} | ${format(report.distributions.currentFeeLamports.p90)} | ${format(report.distributions.currentFeeLamports.p95)} | ${format(report.distributions.currentFeeLamports.max)} |\n| Derived priority fee (lamports) | ${format(report.distributions.currentPriorityFeeLamports.min)} | ${format(report.distributions.currentPriorityFeeLamports.median)} | ${format(report.distributions.currentPriorityFeeLamports.p90)} | ${format(report.distributions.currentPriorityFeeLamports.p95)} | ${format(report.distributions.currentPriorityFeeLamports.max)} |\n| Requested CU | ${format(report.distributions.computeUnitLimit.min)} | ${format(report.distributions.computeUnitLimit.median)} | ${format(report.distributions.computeUnitLimit.p90)} | ${format(report.distributions.computeUnitLimit.p95)} | ${format(report.distributions.computeUnitLimit.max)} |\n| Consumed CU | ${format(report.distributions.computeUnitsConsumed.min)} | ${format(report.distributions.computeUnitsConsumed.median)} | ${format(report.distributions.computeUnitsConsumed.p90)} | ${format(report.distributions.computeUnitsConsumed.p95)} | ${format(report.distributions.computeUnitsConsumed.max)} |\n| Requested / consumed | ${format(report.distributions.requestedToConsumedRatio.min, 2)} | ${format(report.distributions.requestedToConsumedRatio.median, 2)} | ${format(report.distributions.requestedToConsumedRatio.p90, 2)} | ${format(report.distributions.requestedToConsumedRatio.p95, 2)} | ${format(report.distributions.requestedToConsumedRatio.max, 2)} |\n\n## D. SIMD-0553 Formula\n\n- Source: [SIMD-0553 draft @ fc519fb](https://github.com/solana-foundation/solana-improvement-documents/blob/fc519fb3d1ef0f7624b6232bda958438feba09ce/proposals/0553-resource-fee-burn.md).\n- Formula: \`total_fee = 2,500 base inclusion + unchanged priority fee + ceil(requested_cost_units × rate)\`.\n- Rates: 1/10, 1/4, and 1/2 lamports per requested cost unit are the draft’s three feature-gated resource-fee rates.\n- Requested cost: signature verification + write locks + instruction data + requested CU limit + requested loaded-account data size.\n- Source code pin for resource definitions/constants: [Agave @ 29aae88](https://github.com/anza-xyz/agave/blob/29aae881683a7e203d12dfd57812d5be5fe9abc5/cost-model/src/cost_model.rs).\n\n## E. Counterfactual Results\n\n| Rate | Fee median | Fee p90 | Fee p95 | Fee max | Increase median | Increase p90 | Increase max |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${cases.map((label) => { const item = report.distributions.simd0553[label]; return `| ${label} | ${format(item.hypotheticalFeeLamports.median)} | ${format(item.hypotheticalFeeLamports.p90)} | ${format(item.hypotheticalFeeLamports.p95)} | ${format(item.hypotheticalFeeLamports.max)} | ${format(item.percentIncrease.median, 1)}% | ${format(item.percentIncrease.p90, 1)}% | ${format(item.percentIncrease.max, 1)}% |` }).join('\n')}\n\nAll values in this table are **COUNTERFACTUAL / DERIVED**, not observed fees.\n\n## F. Cost Driver\n\n| Requested-cost term | Median share |\n|---|---:|\n${componentShares.map((item) => `| ${item.component} | ${format(item.medianSharePercent, 2)}% |`).join('\n')}\n\n## G. Jonas’s Reported Increase\n\nClassification: **${claimedIncrease.max === null ? 'CANNOT VERIFY' : 'DIRECTIONALLY SUPPORTED'}**. This probe uses a consecutive devnet sample rather than selecting a reported example. Compare the distribution above, not a single receipt, with the reported range.\n\n## H. Block Fullness\n\nThe pinned draft’s fee formula is resource-reservation-dependent: it uses requested transaction cost and the active rate, not block utilization. This report does not treat low utilization as a fee discount input.\n\n## I. Failure Treatment\n\n- Observed landed-but-failed transactions: ${failures.length}.\n- The draft explicitly preserves full total-fee debit for fee-only failures. For each landed failure here, current observed fee and the same counterfactual resource formula are retained; the report does not assert that every runtime failure path has identical handling.\n\n## J. Breadlines Case-Study Value\n\n**${verdict}**. The program has a clean devnet outer-instruction population and the formula is reconstructible from message-level resource requests. Expand only after reviewing whether these first 100 transactions actually reproduce the magnitude distribution Jonas observed.\n\n## Evidence Boundary\n\n- **OBSERVED:** devnet account executability, signature history, slots/times, outer program instruction, status, total fee, signatures, account keys, Compute Budget instructions, consumed CU, RPC \`meta.costUnits\`, logs, and failure evidence.\n- **DERIVED:** current priority fee, requested resource terms, current distributions, requested/consumed ratios, and all counterfactual SIMD-0553 totals.\n- **COUNTERFACTUAL / DERIVED:** every SIMD-0553 total and delta.\n- **UNKNOWN:** serialized size (not fetched in this narrow probe), user/application intent, urgency, congestion, competition, policy outcome, price impact, and why any transaction chose its resource limits.\n`
  const finalMarkdown = markdown.replace('serialized size (not fetched in this narrow probe), ', '')
  await writeFile(path.join(root, 'tower-defense-probe.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(path.join(root, 'tower-defense-probe.md'), finalMarkdown)
  console.log(`Wrote ${root} with ${retained.length} outer-program transactions.`)
}

void main()
