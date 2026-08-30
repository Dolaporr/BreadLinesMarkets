import Link from 'next/link'

export const metadata = {
  title: 'When the Window Determines the Result | Breadlines Research',
  description: 'A landed-ledger methodology note on Solana’s 350ms to 300ms transition.',
}

export default function SlotTimeResearchPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← Breadlines
        </Link>
        <p className="mt-12 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Breadlines Research</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          When the Window Determines the Result
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          A landed-ledger methodology note on Solana’s 350ms → 300ms transition.
        </p>

        <div className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8">
          <p className="text-sm font-medium">Finding</p>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            The measured before/after success-rate difference changed from +0.22 percentage points in a one-hour comparison to −10.65 percentage points in a buffered six-hour comparison. The study does not support a simple causal boundary claim.
          </p>
        </div>

        <section className="mt-10 space-y-4 text-base leading-7 text-muted-foreground">
          <p>
            The paper documents the deterministic sample contract, window and bucket results, stability criteria, a matched prior-day control, and explicit limits of landed-ledger evidence.
          </p>
          <p>
            It does not infer sender geography, dropped traffic, end-to-end latency, identity, intent, or causality.
          </p>
        </section>

        <a
          className="mt-10 inline-flex items-center rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          href="/research/slot-time-300ms/paper.md"
        >
          Read the paper (Markdown)
        </a>
      </article>
    </main>
  )
}
