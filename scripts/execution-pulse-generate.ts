import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renderPulseMarkdown, transformMarketStructureEpisode } from './execution-pulse-core.ts'

async function main() {
  const sourcePath = path.resolve(process.argv[2] ?? 'research/toad-market-structure-episode.json')
  const outputDirectory = path.resolve(process.argv[3] ?? 'research/execution-pulse/toad')
  const label = process.argv[4] ?? 'TOAD'
  const source = JSON.parse(await readFile(sourcePath, 'utf8'))
  const pulse = transformMarketStructureEpisode(source, { sourceArtifact: path.relative(process.cwd(), sourcePath).replaceAll('\\', '/'), label })
  await mkdir(outputDirectory, { recursive: true })
  await Promise.all([
    writeFile(path.join(outputDirectory, 'execution-pulse.json'), `${JSON.stringify(pulse, null, 2)}\n`),
    writeFile(path.join(outputDirectory, 'execution-pulse.md'), renderPulseMarkdown(pulse)),
    writeFile(path.join(outputDirectory, 'share-card.json'), `${JSON.stringify({ schemaVersion: pulse.schemaVersion, token: pulse.token, observationWindow: pulse.observationWindow, candidates: pulse.shareCardCandidates }, null, 2)}\n`),
  ])
  console.log(`Wrote Execution Pulse artifacts to ${outputDirectory}`)
}
void main()
