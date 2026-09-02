import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

const pageUrl = 'https://breadlinesmarkets.com/research/execution-evidence-boundaries'
const socialImage = 'https://breadlinesmarkets.com/execution-evidence-boundaries-og.jpg'
const workedExampleSignature = '11AFoW5L6v7vgMoomdC23nDKTSYD66Qn7BxB7UgrS25Son7ABJZ174NVg8Qc64rR4osEWGHhBWb98NKSAeueRSP'
const workedExampleExplorerUrl = `https://explorer.solana.com/tx/${workedExampleSignature}?cluster=mainnet-beta`

export const metadata: Metadata = {
  title: 'Execution Evidence Boundaries on Solana | Breadlines Research',
  description:
    'A source-cited Breadlines research note on what Solana ledger data, delivery providers, and sequencing systems can establish after a transaction.',
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    type: 'article',
    url: pageUrl,
    siteName: 'Breadlines',
    title: 'Execution Evidence Boundaries on Solana',
    description:
      'What the ledger proves, what execution providers can prove, and where an honest receipt must say “unknown.”',
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: 'Breadlines — what landed, what failed, what it cost',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Execution Evidence Boundaries on Solana',
    description:
      'What the ledger proves, what execution providers can prove, and where an honest receipt must say “unknown.”',
    images: [socialImage],
  },
}

const sourceLinks = [
  { label: 'Anza26 — Brennan Watt, CEO', href: 'https://www.anza.xyz/blog/anza26' },
  { label: 'Anza: Solana Constellation', href: 'https://www.anza.xyz/blog/constellation' },
  { label: 'Jito BAM overview', href: 'https://www.jito.network/bam/' },
  { label: 'Raiku: Determinism for Payments', href: 'https://raiku.com/blog/raiku-determinism-for-payments' },
  { label: 'Triton Cascade', href: 'https://docs.triton.one/chains/solana/cascade' },
  { label: 'Triton transaction-sending advice', href: 'https://docs.triton.one/chains/solana/cascade/sending-txs' },
  { label: 'Helius Sender API', href: 'https://www.helius.dev/docs/api-reference/sender/sendtransaction' },
  { label: 'Helius transaction-sending overview', href: 'https://helius.mintlify.app/sending-transactions/overview' },
]

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-foreground"
    >
      {children}
    </a>
  )
}

export default function ExecutionEvidenceBoundariesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
        <nav aria-label="Research navigation" className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← Back to Breadlines
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Research note</span>
        </nav>

        <header className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Breadlines Research · v0.1</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Execution Evidence Boundaries on Solana
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            What a final ledger receipt can establish, what requires delivery or sequencing telemetry, and where an honest explanation must stop.
          </p>
          <p className="mt-5 text-sm text-muted-foreground">2 September 2026 · Public discussion draft · Updated with a worked receipt and open technical questions</p>
        </header>

        <figure className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <Image
            src="/execution-evidence-boundaries-og.jpg"
            alt="Breadlines visual identity: a breadline joining an execution path, with the words What landed, what failed, what it cost."
            width={1280}
            height={720}
            priority
            className="h-auto w-full"
          />
          <figcaption className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground">
            Breadlines is an evidence-first execution research project. This image is illustrative; factual claims below link to their sources.
          </figcaption>
        </figure>

        <section className="mt-12 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
          <p className="text-sm font-semibold text-primary">The short version</p>
          <p className="mt-3 text-base leading-7 text-foreground">
            Delivery, ordering, final ledger inclusion, and program execution are different layers. A useful receipt should say which layer its conclusion comes from instead of turning an inference into a fact.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">Four distinct execution questions</h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-border">
            <div className="grid border-b border-border bg-card px-5 py-4 sm:grid-cols-[0.85fr_1.25fr] sm:gap-8">
              <p className="font-medium">Final execution</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-0">A finalized ledger transaction can establish landed success or failure, fees, compute consumed, and sometimes the failing program frame.</p>
            </div>
            <div className="grid border-b border-border px-5 py-4 sm:grid-cols-[0.85fr_1.25fr] sm:gap-8">
              <p className="font-medium">Delivery</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-0">Opt-in client or provider events can establish attempted submission, acknowledgement, and retry history.</p>
            </div>
            <div className="grid border-b border-border bg-card px-5 py-4 sm:grid-cols-[0.85fr_1.25fr] sm:gap-8">
              <p className="font-medium">Ordering</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-0">Sequencer-specific attestations can establish claims within the system that issued them—not a universal ordering story.</p>
            </div>
            <div className="grid px-5 py-4 sm:grid-cols-[0.85fr_1.25fr] sm:gap-8">
              <p className="font-medium">Application rejection</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-0">Logs, invocation frames, documented errors, and relevant state evidence can sometimes establish a deterministic failure class.</p>
            </div>
          </div>
        </section>

        <section className="mt-14 space-y-5 text-base leading-7 text-muted-foreground">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">What the ledger does not establish alone</h2>
          <p>
            A final receipt does not, by itself, establish when a transaction was first submitted, which provider path carried it, whether it was dropped before landing, its arrival order at a leader, or whether nearby activity caused its outcome.
          </p>
          <p>
            Those unknowns are not a defect in the ledger. They are a boundary. The problem begins when a product silently crosses it and presents a confident causal story.
          </p>
        </section>

        <section className="mt-14 rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Worked receipt</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">A real failed transaction, without an invented story</h2>
            </div>
            <ExternalLink href={workedExampleExplorerUrl}>View public signature ↗</ExternalLink>
          </div>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            This public transaction is deliberately an example of restraint. It demonstrates that full same-slot context can add direct observations, while still not proving why the transaction failed or who caused it.
          </p>

          <div className="mt-7 grid gap-4">
            <section className="rounded-lg border border-primary/30 bg-primary/5 p-5">
              <p className="text-sm font-semibold text-primary">Chain-proven</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Signature <span className="font-mono text-xs text-foreground">{workedExampleSignature.slice(0, 12)}…{workedExampleSignature.slice(-8)}</span> landed in slot <span className="font-medium text-foreground">438,137,374</span> and failed. Its final logs identify program <span className="font-mono text-xs text-foreground">NA247…pnHTUV</span> returning custom error <span className="font-medium text-foreground">60 (0x3c)</span>. The receipt records an 8,234-lamport fee and 93,689 compute units consumed.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-background/40 p-5">
              <p className="text-sm font-semibold text-foreground">Directly observed</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A declared target-slot-only context was acquired from a full public <span className="font-mono text-xs text-foreground">getBlock</span> response: 1,247 transactions including the target. Of the 1,246 other records, <span className="font-medium text-foreground">40</span> shared at least one writable account with it. Nine public signer addresses recurred among those overlapping records.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-background/40 p-5">
              <p className="text-sm font-semibold text-foreground">Unknown — and intentionally left unknown</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The available logs do not decode what custom error 60 means. The evidence does not establish original submission time, provider path, leader arrival order, identity, a state change, or that any overlapping transaction caused the failure. It also does not establish that another fee, route, provider, or scheduler would have changed the result.
              </p>
            </section>
          </div>
        </section>

        <section className="mt-14 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Adjacent infrastructure, different evidence</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Breadlines is not trying to replace the teams improving execution. Their work makes clearer evidence possible; the complementary question is how an application presents that evidence honestly after the attempt.
            </p>
          </div>

          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Anza / Solana core</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Anza works on protocol performance, scheduling, runtime, validator software, and fair market-structure proposals. Breadlines’ complementary question is methodological: which landed-ledger observations are stable enough to discuss around a protocol change, and which remain confounded by workload or unavailable sender-side evidence?
              </p>
              <p className="mt-3 text-sm"><ExternalLink href="https://www.anza.xyz/blog/anza26">Read Anza26</ExternalLink> · <ExternalLink href="https://www.anza.xyz/blog/constellation">Read Constellation</ExternalLink></p>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Jito / BAM</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Jito describes BAM as transparent and verifiable sequencing, including signed attestations that ordering followed its rules. Breadlines’ complementary question is how an application receipt can expose final execution and available sequencing evidence without extrapolating beyond the system that produced it.
              </p>
              <p className="mt-3 text-sm"><ExternalLink href="https://www.jito.network/bam/">Read the Jito BAM overview</ExternalLink></p>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Raiku</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Raiku describes Ahead-of-Time reservations, Just-in-Time execution, and signed pre-confirmations as a deterministic-inclusion layer. Those source-specific reservation and pre-confirmation records sit directly on the boundary Breadlines cares about: they can support a stronger receipt only when they are attached to the final ledger outcome and clearly labelled as Raiku evidence.
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                A generic Solana ledger transaction alone does not establish that Raiku reserved, scheduled, or guaranteed it. Breadlines should preserve that distinction rather than infer Raiku participation from a final signature.
              </p>
              <p className="mt-3 text-sm"><ExternalLink href="https://raiku.com/blog/raiku-determinism-for-payments">Read Raiku’s deterministic-execution description</ExternalLink></p>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Triton / Cascade</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Triton describes Cascade as a SWQoS-backed delivery network and publishes client-side guidance on retries, compute budgets, and priority fees. Breadlines’ complementary question is how an opt-in trace can join attempts and retries to the final ledger receipt without calling a delivery path the cause of a later program failure.
              </p>
              <p className="mt-3 text-sm"><ExternalLink href="https://docs.triton.one/chains/solana/cascade">Read about Cascade</ExternalLink> · <ExternalLink href="https://docs.triton.one/chains/solana/cascade/sending-txs">Read transaction-sending advice</ExternalLink></p>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Helius / Sender</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Helius describes Sender as low-latency submission through validator and Jito infrastructure. Breadlines’ complementary question is what minimal opt-in event model can connect an attempted submission, acknowledgement, retries, and final ledger receipt without storing keys or asserting that an unobserved transaction was dropped.
              </p>
              <p className="mt-3 text-sm"><ExternalLink href="https://www.helius.dev/docs/api-reference/sender/sendtransaction">Read Sender API documentation</ExternalLink> · <ExternalLink href="https://helius.mintlify.app/sending-transactions/overview">Read transaction-sending overview</ExternalLink></p>
            </section>
          </div>
        </section>

        <section id="technical-questions" className="mt-14 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">The ask</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Five technical questions for the ecosystem</h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            These are questions, not claims that any provider lacks a feature. Public corrections, documentation, and counterexamples are useful.
          </p>
          <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm leading-6 text-muted-foreground">
            <li>What receipt or attestation fields can a provider expose so an application can correlate a submission attempt with a final ledger signature?</li>
            <li>Which provider states are final, which are provisional, and what are their documented retention and uniqueness guarantees?</li>
            <li>What event schema would let an application preserve retries and expiry without retaining raw signed transactions or private keys?</li>
            <li>Which ordering evidence is system-specific, and how should applications prevent it from being misread as a global Solana ordering claim?</li>
            <li>What is the minimum public evidence required before describing a failed transaction as a delivery issue, a sequencing issue, or an application-program rejection?</li>
          </ol>
        </section>

        <section className="mt-14 rounded-xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">The Breadlines standard</h2>
          <ol className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
            <li><span className="font-medium text-foreground">Chain-proven:</span> finalized landed state, fees, compute, raw errors, and failing frames where recoverable.</li>
            <li><span className="font-medium text-foreground">Directly observed:</span> declared context samples and other disclosed evidence.</li>
            <li><span className="font-medium text-foreground">Supported inference:</span> explicitly labeled and used only where the methodology supports it.</li>
            <li><span className="font-medium text-foreground">Unknown:</span> facts requiring missing telemetry, including ingress, unlanded attempts, arrival order, identity, and causal counterfactuals.</li>
          </ol>
        </section>

        <section className="mt-14 space-y-5 text-base leading-7 text-muted-foreground">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">What Breadlines is not proposing</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>A transaction router, sequencer, scheduler, custody system, or landing guarantee.</li>
            <li>Sender geography, identity, human/bot labels, or dropped-traffic claims derived from block data.</li>
            <li>Automatic blame of an integrator or execution provider when a downstream program fails.</li>
            <li>A token ranking, prediction model, or trading recommendation.</li>
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">Sources</h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
            {sourceLinks.map((source) => (
              <li key={source.href}><ExternalLink href={source.href}>{source.label}</ExternalLink></li>
            ))}
            <li><Link href="/research/slot-time-300ms" className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-foreground">Breadlines: When the Window Determines the Result</Link></li>
          </ul>
        </section>

        <footer className="mt-16 border-t border-border pt-8">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            This note is intentionally conservative. If a source-specific state, receipt, attestation, or telemetry guarantee has been misstated or omitted, Breadlines welcomes a correction with public documentation.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Return to Breadlines home
          </Link>
        </footer>
      </article>
    </main>
  )
}
