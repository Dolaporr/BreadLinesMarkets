export async function getLiveData(): Promise<{ spamVolume: number; priorityFee: number }> {
  const res = await fetch('/api/helius')
  if (!res.ok) throw new Error('Helius API route failed')
  return res.json()
}
