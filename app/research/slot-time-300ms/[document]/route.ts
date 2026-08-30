import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

const documents: Record<string, string> = {
  'paper.md': 'paper-draft.md',
  'full-window-report.md': 'full-window-report.md',
  'stability-preregistration.md': 'stability-preregistration.md',
  'stability-analysis.md': 'stability-analysis.md',
  'prior-day-same-hour-control.md': 'prior-day-same-hour-control.md',
  'svmgov-prewindow-sample.md': 'svmgov-prewindow-sample.md',
  'methodology-integrity-audit.md': 'methodology-integrity-audit.md',
}

export async function GET(_: Request, context: { params: Promise<{ document: string }> }) {
  const { document } = await context.params
  const filename = documents[document]
  if (!filename) return new Response('Not found', { status: 404 })

  const body = await readFile(path.join(process.cwd(), 'research', 'slot-time-300ms-boundary', filename), 'utf8')
  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'public, max-age=300',
    },
  })
}
