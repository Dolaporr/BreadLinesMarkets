import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { buildCaseFile, type Receipt, type Episode } from '../research/execution-casefile/core.ts'

async function main() {
const root = 'research/execution-xray/corpus-v0'
const raw: Record<string, Receipt> = JSON.parse(await readFile(`${root}/raw-target-receipts.json`, 'utf8'))
const episodes: Array<{ episode: Episode }> = JSON.parse(await readFile(`${root}/episodes.json`, 'utf8'))
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const cases = episodes.map(({ episode }) => {
  const receipt = raw[episode.target.signature]
  if (!receipt) throw new Error(`Missing retained receipt: ${episode.target.signature}`)
  return buildCaseFile(receipt, { source: `${root}/raw-target-receipts.json`, sha256: hash(receipt) }, episode)
}).sort((a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature))
const anatomyPath = 'research/jtx-execution-study/insufficient-lamports-anatomy/raw-receipts.json'
const anatomy: Record<string, Receipt> = JSON.parse(await readFile(anatomyPath, 'utf8'))
// Fixed lexical selection within the completed anatomy study; no new collection.
const signature = Object.keys(anatomy).sort()[0]
const representative = buildCaseFile(anatomy[signature], { source: anatomyPath, sha256: hash(anatomy[signature]) })
const result = { schemaVersion: 'breadlines-case-library-v1', selection: 'All 22 completed adversarial corpus cases, plus the lexically first signature in the completed insufficient-lamports anatomy. These cases are not a representative population.',
  cases: [representative, ...cases.filter(c => c.signature !== representative.signature)],
  sourceHashes: { receipts: hash(raw), episodes: hash(episodes), anatomy: hash(anatomy) } }
await mkdir('research/execution-casefile/generated', { recursive: true })
await writeFile('research/execution-casefile/generated/library.json', JSON.stringify(result))
console.log(JSON.stringify({ cases: result.cases.length, representative: { signature, explanation: representative.explanation,
  path: representative.execution.failurePath.map(id => representative.execution.frames[id].programId),
  outer: representative.execution.outers }, bytes: Buffer.byteLength(JSON.stringify(result)) }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
