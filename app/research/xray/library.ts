import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CaseFile } from '../../../research/execution-casefile/core'

export async function loadCaseLibrary(): Promise<{ cases: CaseFile[]; selection: string }> {
  return JSON.parse(await readFile(path.join(process.cwd(), 'research/execution-casefile/generated/library.json'), 'utf8'))
}
