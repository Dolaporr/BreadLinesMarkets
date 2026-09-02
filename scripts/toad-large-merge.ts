import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Entry = { signature: string; metadata: Record<string, unknown> }
type Input = { sampling?: Record<string, unknown>; transactions?: Entry[] }

async function main() {
  const outputPath = path.resolve(process.argv[2] ?? 'research/toad-large-signatures-merged.json')
  const [base, offset] = await Promise.all(['research/toad-large-signatures.json', 'research/toad-large-signatures-b.json']
    .map(async (file) => JSON.parse(await readFile(file, 'utf8')) as Input))
  const records = new Map<string, Entry>()
  for (const entry of [...(base.transactions ?? []), ...(offset.transactions ?? [])]) {
    if (!records.has(entry.signature)) records.set(entry.signature, entry)
  }
  const output = {
    sampling: {
      method: 'Two interleaved sets of 250 evenly spaced full-block slices; TOAD-mint account-key filter; stable signature-hash quota per slice; signature deduplication across phases',
      targetMint: base.sampling?.targetMint,
      targetSlotStart: base.sampling?.targetSlotStart,
      targetSlotEnd: base.sampling?.targetSlotEnd,
      baseRecords: base.transactions?.length ?? 0,
      offsetRecords: offset.transactions?.length ?? 0,
      transactionsRetained: records.size,
      selection: 'Each phase is selected solely by slot position. Within each sampled block, all transactions whose account keys contain the TOAD mint are eligible and the first 32 after stable FNV-1a signature-hash ordering are retained. Receipt facts are not used for selection.',
      phases: [base.sampling, offset.sampling],
    },
    transactions: [...records.values()],
  }
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`Merged ${base.transactions?.length ?? 0} base and ${offset.transactions?.length ?? 0} offset records into ${records.size} unique signatures.`)
  console.log(`Wrote ${outputPath}`)
}

void main()
