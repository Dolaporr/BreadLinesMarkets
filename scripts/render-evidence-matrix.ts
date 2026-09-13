import { readFile, writeFile } from 'node:fs/promises'
import { matrixMarkdown } from '../research/execution-casefile/evidence-matrix.ts'

/**
 * Injects the evidence matrix into the memo between its markers, so the table in prose is
 * generated from the same module the viewer and reconciler read. Run after editing the matrix.
 */
const FILE = 'docs/bam-preconfirmation-evidence-study.md'
const BEGIN = '<!-- BEGIN GENERATED MATRIX -->'
const END = '<!-- END GENERATED MATRIX -->'

export function inject(markdown: string) {
  const start = markdown.indexOf(BEGIN)
  const end = markdown.indexOf(END)
  if (start < 0 || end < 0) throw new Error(`${FILE} is missing its generated-matrix markers.`)
  return `${markdown.slice(0, start)}${BEGIN}\n${matrixMarkdown()}\n${markdown.slice(end)}`
}

async function main() {
  const current = await readFile(FILE, 'utf8')
  const next = inject(current)
  if (next === current) { console.log('matrix already current'); return }
  await writeFile(FILE, next)
  console.log(`matrix rendered into ${FILE}`)
}

if (process.argv[1]?.endsWith('render-evidence-matrix.ts')) void main()
