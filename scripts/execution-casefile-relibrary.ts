import { readFile, writeFile } from 'node:fs/promises'
import { buildCaseFile, CASEFILE_VERSION, type CaseFile } from '../research/execution-casefile/core.ts'

/**
 * Re-derives the generated case library from each case's own retained raw receipt.
 *
 * The corpus source artifacts are not retained in this repository, so the full generator
 * cannot run here. Every receipt-derived claim is recomputed rather than carried over, which
 * is the same rule bundle imports already follow. Saved neighbouring context came from the
 * Episode artifact and is not recomputable from a receipt, so it is re-attached unchanged.
 *
 * This selects nothing, collects nothing, and calls no RPC. It aborts if any recomputed
 * identity, explanation, or failure path disagrees with what the library recorded.
 */
const PATH = 'research/execution-casefile/generated/library.json'

async function main() {
  const library = JSON.parse(await readFile(PATH, 'utf8')) as {
    schemaVersion: string; selection: string; cases: CaseFile[]; sourceHashes: Record<string, string>
  }

  const cases = library.cases.map((saved) => {
    const rebuilt = buildCaseFile(saved.receipt as Parameters<typeof buildCaseFile>[0], saved.provenance)
    if (rebuilt.signature !== saved.signature || rebuilt.slot !== saved.slot) {
      throw new Error(`Recomputed identity disagrees with the library for ${saved.signature}`)
    }
    if (rebuilt.state !== saved.state || rebuilt.explanation !== saved.explanation) {
      throw new Error(`Recomputed outcome disagrees with the library for ${saved.signature}`)
    }
    if (JSON.stringify(rebuilt.execution.failurePath) !== JSON.stringify(saved.execution.failurePath)) {
      throw new Error(`Recomputed failure path disagrees with the library for ${saved.signature}`)
    }
    // Neighbouring context is supplied Episode evidence, not a receipt derivation.
    return { ...rebuilt, context: saved.context }
  })

  const changed = cases.filter((c, i) =>
    JSON.stringify(c.execution.outers) !== JSON.stringify(library.cases[i].execution.outers))

  await writeFile(PATH, JSON.stringify({
    ...library,
    cases,
    rederivation: `Case files recomputed from their retained raw receipts for ${CASEFILE_VERSION}. Selection, receipts, and saved neighbouring context are unchanged. No collection, RPC call, or reselection occurred.`,
  }))

  console.log(JSON.stringify({
    cases: cases.length,
    caseSchema: CASEFILE_VERSION,
    outerStatesRelabelled: changed.length,
    committedNone: cases.filter((c) => c.execution.stateCommitment.outcome === 'NONE_COMMITTED').length,
    committedAll: cases.filter((c) => c.execution.stateCommitment.outcome === 'ALL_COMMITTED').length,
    stillLabelledCompleted: cases.filter((c) => JSON.stringify(c.execution.outers).includes('COMPLETED')).length,
  }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
