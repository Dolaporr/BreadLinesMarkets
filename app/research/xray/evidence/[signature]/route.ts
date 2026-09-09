import { loadCaseLibrary } from '../../library'

export async function GET(_request: Request, context: { params: Promise<{ signature: string }> }) {
  if (process.env.BREADLINES_XRAY_PREVIEW !== '1') return new Response('Not found', { status: 404 })
  const { signature } = await context.params
  const library = await loadCaseLibrary()
  const item = library.cases.find(c => c.signature === signature)
  return item ? Response.json(item, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } }) : new Response('Unknown archived signature', { status: 404 })
}
