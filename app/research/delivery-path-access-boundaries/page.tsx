import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

const pageUrl = 'https://breadlinesmarkets.com/research/delivery-path-access-boundaries'
const socialImage = 'https://breadlinesmarkets.com/execution-evidence-boundaries-og-v2.png'

export const metadata: Metadata = {
  title: 'Why a Controlled Solana Delivery-Path Study Is Not Yet Runnable | Breadlines Research',
  description: 'A source-cited Breadlines negative result: documented access, transaction equivalence, and scheduler boundaries stopped a proposed delivery-path study before data collection.',
  alternates: { canonical: pageUrl },
  openGraph: {
    type: 'article',
    url: pageUrl,
    siteName: 'Breadlines',
    title: 'Why a Controlled Solana Delivery-Path Study Is Not Yet Runnable',
    description: 'The study stopped before data collection: access documentation and transaction equivalence are part of execution methodology.',
    images: [{ url: socialImage, width: 1200, height: 630, alt: 'Breadlines — what landed, what failed, what it cost' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why a Controlled Solana Delivery-Path Study Is Not Yet Runnable',
    description: 'The study stopped before data collection: access documentation and transaction equivalence are part of execution methodology.',
    images: [socialImage],
  },
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-foreground">{children}</a>
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mt-14 space-y-5 text-base leading-7 text-muted-foreground">{children}</section>
}

export default function DeliveryPathAccessBoundariesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
        <nav aria-label="Research navigation" className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">← Back to Breadlines</Link>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Research note</span>
        </nav>

        <header className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Breadlines Research · v0</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Why a Controlled Solana Delivery-Path Study Is Not Yet Runnable</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">A preregistered comparison stopped before collection because the supposed paths were not equivalent, independently observable study arms.</p>
          <p className="mt-5 text-sm text-muted-foreground">6 September 2026 · No study transaction was sent · Not a delivery-path performance claim</p>
        </header>

        <figure className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <Image src="/execution-evidence-boundaries-og-v2.png" alt="Breadlines visual identity: a breadline joining an execution path." width={1280} height={720} priority className="h-auto w-full" />
          <figcaption className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground">Illustrative brand image only. Every factual claim below links to source documentation.</figcaption>
        </figure>

        <section className="mt-12 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
          <p className="text-sm font-semibold text-primary">The short version</p>
          <p className="mt-3 text-base leading-7 text-foreground">A delivery-path comparison only means something when every arm is reachable and can receive functionally equivalent transactions. This proposed four-path study failed that test before it generated a chart.</p>
        </section>

        <Section>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">The proposed question</h2>
          <p>Do delivery paths differ in finalized landed outcomes for functionally equivalent Breadlines-controlled transactions, under predefined conditions?</p>
          <p>It was never intended to measure general path quality, third-party flow, sender geography, dropped traffic, trading execution, or the cause of a difference.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5"><p className="font-medium text-foreground">Reachability</p><p className="mt-2 text-sm leading-6">Breadlines must be able to submit through a documented public or granted interface.</p></div>
            <div className="rounded-xl border border-border bg-card p-5"><p className="font-medium text-foreground">Equivalence</p><p className="mt-2 text-sm leading-6">Each arm must receive the same functional transaction shape and compute settings, except fresh blockhash and inert trial-ID fields.</p></div>
          </div>
        </Section>

        <Section>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">1. Axiom does not document a public sender surface we could find</h2>
          <p>Axiom’s public Solana materials describe user-facing priority-fee, bribe, and MEV settings. That is useful product documentation, but it is not an external raw-transaction submission interface for an independent controlled study. <ExternalLink href="https://docs.axiom.trade/getting-started/fees/solana-fees">Axiom: Solana Fees</ExternalLink></p>
          <p>Breadlines did not find public documentation for a raw signed-transaction endpoint, developer authentication procedure, rate limit, or developer pricing. This does not claim that Axiom cannot submit transactions. It means Breadlines cannot treat Axiom as an independently callable study arm without an Axiom-provided integration surface.</p>
        </Section>

        <Section>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">2. Nozomi changes transaction shape unless every arm carries its tip</h2>
          <p>Nozomi publishes an API-keyed <code className="rounded bg-card px-1.5 py-0.5 text-sm text-foreground">sendTransaction</code> surface with auto-routed and regional endpoints. It only handles submission, requiring a separate RPC for blockhashes and final receipt observation. <ExternalLink href="https://use.temporal.xyz/nozomi/transaction-submission-json-rpc">Nozomi: Transaction Submission</ExternalLink></p>
          <p>Its documentation requires a System Program transfer to a Nozomi tip address, with a minimum tip of <strong className="text-foreground">0.001 SOL</strong>. A Nozomi-only tip changes the instruction list, writable accounts, balance requirement, and economics; it cannot be silently called a path-only treatment. <ExternalLink href="https://use.temporal.xyz/nozomi/tipping-and-faq">Nozomi: Tipping & FAQ</ExternalLink></p>
          <p>A later two-arm study could include the same required tip in both Nozomi and Direct-TPU transactions. That would be a different, explicitly tipped mechanism study—not a benchmark of normal transactions.</p>
        </Section>

        <Section>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">3. RPC and Direct TPU are not clean non-BAM controls on a BAM-connected leader</h2>
          <p>Direct TPU is client-managed leader submission and forwarding, not a hosted vendor endpoint. It needs a controlled client, leader discovery, outbound QUIC, a receipt RPC, and a declared rebroadcast policy. <ExternalLink href="https://solana.com/developers/cookbook/transactions/retry">Solana: Retrying Transactions</ExternalLink></p>
          <blockquote className="rounded-xl border-l-4 border-primary bg-primary/5 px-5 py-4 text-sm leading-6 text-foreground">“RPC flow: If your validator is connected to BAM and scheduled to be a leader soon, transactions submitted via RPC are routed through BAM.”<br /><br />“Direct TPU flow: Transactions sent directly to your TPU port are processed through BAM before execution.”<span className="mt-3 block text-muted-foreground">— <ExternalLink href="https://bam.dev/docs/bam/bam-overview/">BAM Documentation</ExternalLink></span></blockquote>
          <p>On a BAM-connected leader, neither generic RPC nor Direct TPU is a reliable non-BAM control. The client’s ingress choice cannot establish that the trial bypassed BAM.</p>
        </Section>

        <Section>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">4. BAM documents an enrolled Maker Priority Plugin, not a general research sender</h2>
          <p>The Maker Priority Plugin is a documented priority ingress path for enrolled market makers. Its Plugin TPU accepts raw wire-format Solana transactions as UDP datagrams on default port <code className="rounded bg-card px-1.5 py-0.5 text-sm text-foreground">5012</code>, subject to operator confirmation. Its canonical structure requires an enrolled signer, Compute Budget instructions, an enrolled market-update program, a writable enrolled market account, and an 8-byte sequence number. <ExternalLink href="https://bam.dev/docs/bam/maker-plugin/getting-started/">BAM Maker Plugin: Getting Started</ExternalLink></p>
          <p>Enrollment is configured by the node operator before startup: signer public keys, programs, markets, sequence-number offsets, and fee floors are static. BAM says there is no runtime registration API. <ExternalLink href="https://bam.dev/docs/bam/maker-plugin/how-it-works/">BAM Maker Plugin: How It Works</ExternalLink></p>
          <p>Breadlines is not an enrolled market maker with an enrolled market-update program and market account. Its harmless study transfer would not satisfy the documented plugin validation rules. That—not a lack of documentation—is why the Maker Priority Plugin cannot currently be a study arm.</p>
          <p>The difference is structural: Phase 1 drains enrolled maker-plugin traffic before bundles and regular transactions, and BAM says higher fees or tips cannot change that ordering. The meaningful open question is whether enrollment is strictly market-maker scoped or whether a deliberately bounded research-sender path exists.</p>
        </Section>

        <Section>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">What this establishes—and what it does not</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-5"><p className="font-medium text-primary">Established</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6"><li>Nozomi has an API-keyed sender and a minimum-tip rule.</li><li>BAM documents a statically enrolled Maker Priority Plugin with strict validation rules.</li><li>BAM documents both RPC and Direct-TPU routing through a connected BAM leader.</li><li>Direct TPU is client-managed leader submission.</li></ul></section>
            <section className="rounded-xl border border-border bg-card p-5"><p className="font-medium text-foreground">Not established</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6"><li>Relative quality, latency, reliability, privacy, or cost-effectiveness of any path.</li><li>Why a particular transaction would land or fail elsewhere.</li><li>Provider responsibility for a final outcome.</li><li>Third-party flow, sender geography, dropped traffic, or leader-arrival timing.</li></ul></section>
          </div>
          <p className="font-medium text-foreground">No study transaction was sent. There are no performance results to interpret.</p>
        </Section>

        <Section>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">What would make a later study possible</h2>
          <ol className="list-decimal space-y-3 pl-5"><li>A documented equivalent interface that accepts the same signed transaction shape in every included arm; or</li><li>A separately preregistered two-arm mechanism study, such as Nozomi versus self-operated Direct TPU with the same mandatory Nozomi tip in both arms.</li></ol>
          <p>For BAM, that means an enrollment that genuinely fits the study or a documented research-sender path, plus a way to join scheduler evidence to a final ledger receipt. For Axiom, it means a documented external submission interface if it is to be independently measured.</p>
        </Section>

        <Section>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Why stopping here is useful</h2>
          <p>The easy failure mode is to send through whatever happens to be available and call the columns “paths.” That would hide product-internal routing, a mandatory tip instruction, and a scheduler already processing a supposed control flow.</p>
          <p>Access documentation and transaction equivalence are part of execution methodology—not administrative details to fix after results arrive.</p>
        </Section>

        <section className="mt-14 rounded-xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Sources</h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
            <li><ExternalLink href="https://docs.axiom.trade/getting-started/fees/solana-fees">Axiom: Solana Fees</ExternalLink></li>
            <li><ExternalLink href="https://use.temporal.xyz/nozomi/transaction-submission-json-rpc">Nozomi: Transaction Submission</ExternalLink> · <ExternalLink href="https://use.temporal.xyz/nozomi/tipping-and-faq">Tipping & FAQ</ExternalLink></li>
            <li><ExternalLink href="https://bam.dev/docs/bam/bam-overview/">BAM Documentation</ExternalLink> · <ExternalLink href="https://bam.dev/docs/bam/maker-plugin/getting-started/">Maker Plugin: Getting Started</ExternalLink> · <ExternalLink href="https://bam.dev/docs/bam/maker-plugin/how-it-works/">Maker Plugin: How It Works</ExternalLink></li>
            <li><ExternalLink href="https://solana.com/developers/cookbook/transactions/retry">Solana: Retrying Transactions</ExternalLink></li>
          </ul>
        </section>

        <footer className="mt-16 border-t border-border pt-8">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">If a source-specific state, access path, or requirement has been misstated or omitted, Breadlines welcomes a correction with public documentation.</p>
          <Link href="/" className="mt-7 inline-flex rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90">Return to Breadlines home</Link>
        </footer>
      </article>
    </main>
  )
}
