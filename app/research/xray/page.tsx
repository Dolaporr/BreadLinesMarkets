import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Workspace from './workspace'
import { loadCaseLibrary } from './library'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'X-Ray · Breadlines research', robots: { index: false, follow: false } }
export default async function Page({ searchParams }: { searchParams: Promise<{ signature?: string }> }) {
  if (process.env.BREADLINES_XRAY_PREVIEW !== '1') notFound()
  const library = await loadCaseLibrary()
  const { signature } = await searchParams
  const initial = signature ? library.cases.find(c => c.signature === signature) : library.cases[0]
  if (!initial) notFound()
  return <Workspace initial={initial} selection={library.selection} cases={library.cases.map(c => ({ signature: c.signature,
    slot: c.slot, explanation: c.explanation, coverage: c.context.coverage, state: c.state }))} />
}
