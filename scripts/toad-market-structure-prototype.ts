import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Count = { value: string; total: number }

type Study = {
  generatedAt: string
  evidenceBoundary: string
  fetchFailures: unknown[]
  records: Array<{ slot: number | null; primarySigner: string | null; execution: { state: string } }>
  study: {
    coverage: { startSlot: number; endSlot: number; sampling: { targetMint: string; transactionsRetained: number; method: string; selection: string } }
    totals: { transactions: number; successes: number; failures: number; uniquePrimarySigners: number }
    concentration: { top1Share: number | null; top5Share: number | null; top10Share: number | null; hhi: number | null; successTop1Share: number | null; successTop5Share: number | null }
    noProfit: { count: number; uniquePrimarySigners: number; topSigners: Count[]; programs: Count[] }
    failureClasses: Count[]
    slices: Array<{
      slice: number
      slotStart: number
      slotEnd: number
      transactions: number
      successes: number
      failures: number
      uniqueSigners: number
      newSigners: number
      returningSigners: number
      successfulNewSigners: number
      successfulReturningSigners: number
      noProfit: number
      opaque: number
      otherDocumented: number
      top1Share: number | null
      top5Share: number | null
      top10Share: number | null
      hhi: number | null
    }>
  }
}

const percentage = (value: number | null) => value === null ? null : Number((value * 100).toFixed(1))
const share = (values: string[], limit: number) => {
  if (!values.length) return null
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.values()].sort((a, b) => b - a).slice(0, limit).reduce((sum, count) => sum + count, 0) / values.length
}
const hhi = (values: string[]) => {
  if (!values.length) return null
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.values()].reduce((sum, count) => sum + (count / values.length) ** 2, 0)
}

async function main() {
  const sourcePath = path.resolve(process.argv[2] ?? 'research/toad-large-study.json')
  const outputPath = path.resolve(process.argv[3] ?? 'research/toad-market-structure-episode.json')
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as Study
  const study = source.study
  const successfulConcentrationBySlice = study.slices.map((slice) => {
    const successfulSigners = source.records
      .filter((record) => record.slot !== null && record.slot >= slice.slotStart && record.slot <= slice.slotEnd && record.execution.state === 'landed')
      .map((record) => record.primarySigner)
      .filter((signer): signer is string => Boolean(signer))

    return {
      slice: slice.slice,
      successfulTransactions: successfulSigners.length,
      top1SuccessSharePercent: percentage(share(successfulSigners, 1)),
      top5SuccessSharePercent: percentage(share(successfulSigners, 5)),
      top10SuccessSharePercent: percentage(share(successfulSigners, 10)),
      successHhi: hhi(successfulSigners),
    }
  })
  const noProfitTotal = study.noProfit.count
  const noProfitShare = (limit: number) => noProfitTotal
    ? Number((study.noProfit.topSigners.slice(0, limit).reduce((sum, entry) => sum + entry.total, 0) / noProfitTotal * 100).toFixed(1))
    : null

  const episode = {
    generatedFrom: 'research/toad-large-study.json',
    generatedAt: source.generatedAt,
    internalOnly: true,
    evidenceBoundary: source.evidenceBoundary,
    sample: {
      mint: study.coverage.sampling.targetMint,
      startSlot: study.coverage.startSlot,
      endSlot: study.coverage.endSlot,
      transactions: study.totals.transactions,
      successes: study.totals.successes,
      failures: study.totals.failures,
      uniquePrimarySigners: study.totals.uniquePrimarySigners,
      fetchFailures: source.fetchFailures.length,
      methodology: study.coverage.sampling.method,
      selection: study.coverage.sampling.selection,
    },
    participation: study.slices.map((slice) => ({
      slice: slice.slice,
      slotStart: slice.slotStart,
      slotEnd: slice.slotEnd,
      uniquePrimarySigners: slice.uniqueSigners,
      newToSample: slice.newSigners,
      returning: slice.returningSigners,
      successfulNewToSample: slice.successfulNewSigners,
      successfulReturning: slice.successfulReturningSigners,
    })),
    concentration: {
      overall: {
        successfulTop1SharePercent: percentage(study.concentration.successTop1Share),
        successfulTop5SharePercent: percentage(study.concentration.successTop5Share),
        transactionTop1SharePercent: percentage(study.concentration.top1Share),
        transactionTop5SharePercent: percentage(study.concentration.top5Share),
        transactionTop10SharePercent: percentage(study.concentration.top10Share),
        hhi: study.concentration.hhi,
      },
      bySlice: study.slices.map((slice) => ({
        slice: slice.slice,
        successfulTransactions: successfulConcentrationBySlice[slice.slice - 1].successfulTransactions,
        top1SuccessSharePercent: successfulConcentrationBySlice[slice.slice - 1].top1SuccessSharePercent,
        top5SuccessSharePercent: successfulConcentrationBySlice[slice.slice - 1].top5SuccessSharePercent,
        top10SuccessSharePercent: successfulConcentrationBySlice[slice.slice - 1].top10SuccessSharePercent,
        successHhi: successfulConcentrationBySlice[slice.slice - 1].successHhi,
      })),
    },
    failureEcology: {
      bySlice: study.slices.map((slice) => ({
        slice: slice.slice,
        failures: slice.failures,
        explicitNoProfitOrRoute: slice.noProfit,
        opaqueCustomErrors: slice.opaque,
        otherDocumentedFailures: slice.otherDocumented,
      })),
      classes: study.failureClasses,
      noProfit: {
        observedCount: study.noProfit.count,
        observedPrimarySignerAddresses: study.noProfit.uniquePrimarySigners,
        observedProgramIds: study.noProfit.programs.length,
        top1PrimarySignerSharePercent: noProfitShare(1),
        top3PrimarySignerSharePercent: noProfitShare(3),
        top5PrimarySignerSharePercent: noProfitShare(5),
        programs: study.noProfit.programs,
      },
    },
    interpretation: {
      text: 'New-to-the-sample primary signer addresses continued appearing and some returning addresses landed successful transactions. Successful execution was materially concentrated among a small address set. Explicit no-profit/no-route failures were concentrated among a smaller observed execution cohort rather than distributed market-wide.',
      evidence: 'derived',
      limits: 'Primary signer addresses are not proven users. This sample does not establish buyer intent, address coordination, causality, price impact, or that repeated activity is a retry.',
    },
  }

  await writeFile(outputPath, `${JSON.stringify(episode, null, 2)}\n`)
  console.log(`Wrote ${outputPath}`)
}

void main()
