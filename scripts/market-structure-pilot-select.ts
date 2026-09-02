import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type UniverseRow = { mint: string; graduation_slot: number; graduation_timestamp_utc: string; observation_end_utc: string }

export function stableMintHash(mint: string) {
  let current = 2_166_136_261
  for (let index = 0; index < mint.length; index += 1) {
    current ^= mint.charCodeAt(index)
    current = Math.imul(current, 16_777_619)
  }
  return current >>> 0
}

async function main() {
  const universePath = path.resolve('research/market-structure/token-universe.json')
  const outputPath = path.resolve('research/market-structure/pilot-50.json')
  const universe = JSON.parse(await readFile(universePath, 'utf8')) as { cohort_size?: number; graduations?: UniverseRow[] }
  const rows = universe.graduations ?? []
  if (universe.cohort_size !== 2_508 || rows.length !== 2_508) throw new Error('Frozen universe must contain exactly 2,508 graduations')
  const selected = rows.map((row) => ({ mint: row.mint, stable_hash_fnv1a_32: stableMintHash(row.mint), graduation_slot: row.graduation_slot, graduation_timestamp_utc: row.graduation_timestamp_utc, observation_end_utc: row.observation_end_utc }))
    .sort((left, right) => left.stable_hash_fnv1a_32 - right.stable_hash_fnv1a_32 || left.mint.localeCompare(right.mint)).slice(0, 50)
  const output = { schema_version: 1, frozen_universe_size: 2_508, selection: { input_field: 'mint only', hash: 'FNV-1a 32-bit over UTF-16 code units (all Solana base58 mint characters are single-byte ASCII)', order: 'unsigned hash ascending; mint ascending only as collision tie-breaker', count: 50 }, selected }
  await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`Wrote ${outputPath}`)
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) void main()
