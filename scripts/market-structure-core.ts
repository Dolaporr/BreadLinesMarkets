export const METHODOLOGY_VERSION = 'breadlines-market-structure-v1'
export const DEFAULT_SAMPLING = { phases: 2, slicesPerPhase: 250, quotaPerSlice: 32, analysisSlices: 20 } as const

export type ExecutionState = 'landed' | 'landed-but-failed' | 'unavailable'
export type Distribution = { count: number; min: number | null; p25: number | null; median: number | null; p75: number | null; mean: number | null; max: number | null }
export type ResearchRecord = {
  signature: string
  slot: number | null
  blockTime: number | null
  primarySigner: string | null
  execution: { state: ExecutionState }
  fees: { totalLamports: number | null; priorityFeeLamports: number | null }
  compute: { requestedCU: number | null; consumedCU: number | null }
  programs: Array<{ id: string }>
  failureClass: string | null
  failingProgram: string | null
}

export function countValues(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }))
}

export function concentration(values: string[]) {
  const rows = countValues(values)
  const share = (limit: number) => values.length ? rows.slice(0, limit).reduce((sum, row) => sum + row.count, 0) / values.length : null
  return { top1: share(1), top5: share(5), top10: share(10), hhi: values.length ? rows.reduce((sum, row) => sum + (row.count / values.length) ** 2, 0) : null }
}

export function distribution(values: Array<number | null>): Distribution {
  const data = values.filter((value): value is number => Number.isFinite(value)).sort((a, b) => a - b)
  const percentile = (p: number) => {
    if (!data.length) return null
    const position = (data.length - 1) * p
    const low = Math.floor(position), high = Math.ceil(position)
    return data[low] + (data[high] - data[low]) * (position - low)
  }
  return { count: data.length, min: data[0] ?? null, p25: percentile(.25), median: percentile(.5), p75: percentile(.75), mean: data.length ? data.reduce((sum, value) => sum + value, 0) / data.length : null, max: data.at(-1) ?? null }
}

function summarize(records: ResearchRecord[], newSet: Set<string>, returningSet: Set<string>) {
  const success = records.filter((record) => record.execution.state === 'landed')
  const failure = records.filter((record) => record.execution.state === 'landed-but-failed')
  const signerValues = records.map((record) => record.primarySigner).filter((value): value is string => Boolean(value))
  const successfulSignerValues = success.map((record) => record.primarySigner).filter((value): value is string => Boolean(value))
  const successfulSignerSet = new Set(successfulSignerValues)
  return {
    transactions: records.length,
    successes: success.length,
    failures: failure.length,
    successRate: records.length ? success.length / records.length : null,
    uniquePrimarySigners: new Set(signerValues).size,
    newToSampleSigners: newSet.size,
    returningSigners: returningSet.size,
    successfulNewSigners: [...newSet].filter((signer) => successfulSignerSet.has(signer)).length,
    successfulReturningSigners: [...returningSet].filter((signer) => successfulSignerSet.has(signer)).length,
    successfulExecutionConcentration: concentration(successfulSignerValues),
    allExecutionConcentration: concentration(signerValues),
    failureClasses: countValues(failure.map((record) => record.failureClass)),
    failureConcentration: {
      bySigner: concentration(failure.map((record) => record.primarySigner).filter((value): value is string => Boolean(value))),
      byProgram: concentration(failure.map((record) => record.failingProgram).filter((value): value is string => Boolean(value))),
      signerCounts: countValues(failure.map((record) => record.primarySigner)),
      programCounts: countValues(failure.map((record) => record.failingProgram)),
    },
    distributions: {
      feeLamports: { all: distribution(records.map((r) => r.fees.totalLamports)), successful: distribution(success.map((r) => r.fees.totalLamports)), failed: distribution(failure.map((r) => r.fees.totalLamports)) },
      priorityFeeLamports: { all: distribution(records.map((r) => r.fees.priorityFeeLamports)), successful: distribution(success.map((r) => r.fees.priorityFeeLamports)), failed: distribution(failure.map((r) => r.fees.priorityFeeLamports)) },
      requestedCU: { all: distribution(records.map((r) => r.compute.requestedCU)), successful: distribution(success.map((r) => r.compute.requestedCU)), failed: distribution(failure.map((r) => r.compute.requestedCU)) },
      consumedCU: { all: distribution(records.map((r) => r.compute.consumedCU)), successful: distribution(success.map((r) => r.compute.consumedCU)), failed: distribution(failure.map((r) => r.compute.consumedCU)) },
    },
  }
}

export function buildEpisode(records: ResearchRecord[], identity: { mint: string; label?: string; observationStartSlot: number; observationEndSlot: number }, sampling: Record<string, unknown>, analysisSlices = DEFAULT_SAMPLING.analysisSlices) {
  const inWindow = records.filter((record) => record.slot != null && record.slot >= identity.observationStartSlot && record.slot <= identity.observationEndSlot).sort((a, b) => a.slot! - b.slot! || a.signature.localeCompare(b.signature))
  const width = Math.max(1, identity.observationEndSlot - identity.observationStartSlot + 1)
  const bins = Array.from({ length: analysisSlices }, (_, index) => [] as ResearchRecord[])
  for (const record of inWindow) bins[Math.min(analysisSlices - 1, Math.floor(((record.slot! - identity.observationStartSlot) / width) * analysisSlices))].push(record)
  const seen = new Set<string>()
  const slices = bins.map((items, index) => {
    const signers = new Set(items.map((record) => record.primarySigner).filter((value): value is string => Boolean(value)))
    const newSet = new Set([...signers].filter((signer) => !seen.has(signer)))
    const returningSet = new Set([...signers].filter((signer) => seen.has(signer)))
    for (const signer of signers) seen.add(signer)
    const slotStart = identity.observationStartSlot + Math.floor(width * index / analysisSlices)
    const slotEnd = identity.observationStartSlot + Math.floor(width * (index + 1) / analysisSlices) - 1
    return { relativeSlice: index + 1, relativeStart: index / analysisSlices, relativeEnd: (index + 1) / analysisSlices, slotStart, slotEnd: Math.min(identity.observationEndSlot, slotEnd), ...summarize(items, newSet, returningSet) }
  })
  const allSigners = new Set(inWindow.map((record) => record.primarySigner).filter((value): value is string => Boolean(value)))
  const signerHistory = new Map<string, ResearchRecord[]>()
  for (const record of inWindow) if (record.primarySigner) signerHistory.set(record.primarySigner, [...(signerHistory.get(record.primarySigner) ?? []), record])
  const overall = summarize(inWindow, allSigners, new Set())
  overall.returningSigners = [...signerHistory.values()].filter((items) => items.length > 1).length
  overall.successfulNewSigners = [...signerHistory.values()].filter((items) => items[0]?.execution.state === 'landed').length
  overall.successfulReturningSigners = [...signerHistory.values()].filter((items) => items.slice(1).some((item) => item.execution.state === 'landed')).length
  return {
    schemaVersion: 1,
    methodologyVersion: METHODOLOGY_VERSION,
    token: { mint: identity.mint, label: identity.label ?? null },
    observationWindow: { startSlot: identity.observationStartSlot, endSlot: identity.observationEndSlot },
    evidenceBoundary: 'Only sampled transactions inside the predetermined observation window are used. Metrics are deterministic receipt-derived aggregates. Identity, intent, causality, and later market outcome are unknown here.',
    sampling,
    metrics: overall,
    slices,
  }
}
