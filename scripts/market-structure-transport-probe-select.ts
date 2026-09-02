import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Row = { mint: string; graduation_slot: number; graduation_timestamp_utc: string; observation_end_utc: string }
async function atomic(file: string, value: unknown) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); await rename(temp, file) }

async function main() {
  const root = path.resolve('research/market-structure'), universe = JSON.parse(await readFile(path.join(root, 'token-universe.json'), 'utf8')) as { graduations: Row[] }
  const selected: Row[] = []
  for (const row of universe.graduations) {
    const operations = await readFile(path.join(root, 'full-cohort', row.mint, 'operations.json'), 'utf8').then(JSON.parse).catch(() => null)
    if (operations && !operations.complete) selected.push(row)
    if (selected.length === 5) break
  }
  if (selected.length !== 5) throw new Error(`Expected at least five previously incomplete mints; found ${selected.length}`)
  await atomic(path.join(root, 'transport-probe-5.json'), { generatedAt: new Date().toISOString(), selection: 'First five previously incomplete mints in frozen token-universe order. No token attributes, activity, outcomes, or Episode metrics were used.', selected })
  console.log(`Selected ${selected.length} previously incomplete mints for transport probe.`)
}
void main()
