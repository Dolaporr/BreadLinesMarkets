import type { Metadata } from 'next'
import Link from 'next/link'

const pageUrl = 'https://breadlinesmarkets.com/research/bam-preconfirmation-evidence'
const socialImage = 'https://breadlinesmarkets.com/execution-evidence-boundaries-og-v2.png'
const memoUrl = 'https://github.com/Dolaporr/BreadLinesMarkets/blob/main/docs/bam-preconfirmation-evidence-study.md'
const schemaUrl = 'https://github.com/Dolaporr/BreadLinesMarkets/blob/main/research/execution-casefile/preconfirmation.ts'
const matrixUrl = 'https://github.com/Dolaporr/BreadLinesMarkets/blob/main/research/execution-casefile/evidence-matrix.ts'
const reconcileUrl = 'https://github.com/Dolaporr/BreadLinesMarkets/blob/main/research/execution-casefile/reconciliation.ts'

const title = 'What a preconfirmation proves'
const description =
  'A preconfirmation is not an early receipt. It is the only artifact in the Solana execution stack with an author and a timestamp before the fact — and that difference decides what it can be used for.'

export const metadata: Metadata = {
  title: 'What a Preconfirmation Proves | Breadlines Research',
  description,
  alternates: { canonical: pageUrl },
  openGraph: {
    type: 'article',
    url: pageUrl,
    siteName: 'Breadlines',
    title,
    description,
    images: [{ url: socialImage, width: 1200, height: 630, alt: 'Breadlines — what landed, what failed, what it cost' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: [socialImage] },
}

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

const rungs = [
  {
    name: 'Client observed',
    body: 'This application measured it. Nothing outside the sending process confirms it happened at all.',
  },
  {
    name: 'Provider reported',
    body: 'A named party asserted it. An assertion, not an authenticated fact. An attestation being present does not lift a field above this rung.',
  },
  {
    name: 'Validator attested',
    body: 'A signature over a described payload was verified against a named key. Only a verified signature reaches this rung.',
  },
  {
    name: 'Chain proven',
    body: 'Recorded in the ledger. No pre-inclusion evidence can occupy this rung, and the schema refuses a record that claims it.',
  },
]

const matrix = [
  {
    layer: 'Simulation',
    ceiling: 'Client observed',
    proves: 'How a transaction executed against one node’s chosen state, at that moment.',
    refuses: 'That the same result occurs on chain. The state has already moved on.',
  },
  {
    layer: 'Sender trace',
    ceiling: 'Client observed',
    proves: 'That this application built, signed and attempted to send a message, on one named clock.',
    refuses: 'That any packet left the machine, or that an unobserved receipt means a drop.',
  },
  {
    layer: 'Preconfirmation',
    ceiling: 'Validator attested',
    proves: 'That an identified party made a specific statement at a time on a stated clock — and with a verified signature, that a named key committed to it.',
    refuses: 'That the transaction landed, executed, or committed anything. It is a statement about the future.',
  },
  {
    layer: 'Landed receipt',
    ceiling: 'Chain proven',
    proves: 'Inclusion in a specific slot, whether execution succeeded, and that it committed atomically or committed nothing but its fee.',
    refuses: 'When it was submitted, when a leader received it, its scheduler position, or that it was late.',
  },
  {
    layer: 'Finalized',
    ceiling: 'Chain proven',
    proves: 'That the outcome is settled and will not be reorganised.',
    refuses: 'Anything the receipt could not prove. Finalization settles the outcome, not its causes.',
  },
]

const refusals = [
  'When a transaction was submitted, and when any leader received it.',
  'Its position in any scheduler or queue, absent a verified attestation describing position.',
  'Whether any provider delayed, dropped, reordered or deprioritised it.',
  'Whether a different fee, route or provider would have changed the outcome.',
  'Whether nearby transactions sharing writable accounts contended with it.',
  'That a preconfirmation with no matching receipt was broken — it is unresolved, and may have landed unobserved.',
  'That a preconfirmation matching a receipt caused the inclusion.',
]

const telemetry = [
  'A preconfirmation retrievable after the fact, by signature. Real-time-only delivery makes post-mortem work impossible.',
  'A clock domain identifier on every timestamp, stable across a deployment.',
  'An issue timestamp distinct from an observation timestamp.',
  'An attestation with a machine-readable description of what the signature covers, and a published key.',
  'The expiry attached to the assertion, separating a lapsed promise from a broken one.',
  'An identifier surviving a sender rebuild, such as a message hash.',
  'Where ordering is claimed: an attested position and the ruleset it was determined under.',
]

const questions = [
  'What exactly does a BAM attestation’s signature cover — inclusion, ordering, both?',
  'Is there a documented public key and verification procedure, so a third party can check an attestation without trusting the API that served it?',
  'Is a preconfirmation retrievable after the fact by signature, and for how long?',
  'Which timestamps are BAM-side observations, and which are relayed? Do any share a clock domain?',
  'What is the documented meaning of each reported state, and which are final versus provisional?',
  'When a preconfirmation never resolves to a landed transaction, is there a record on the BAM side?',
  'Does plugin or maker enrolment change what evidence a sender can obtain?',
  'Is there a supported way to obtain a bounded, pre-registered research sample?',
  'What would Jito consider a misuse of BAM evidence in a published study? Breadlines would adopt that list.',
]

export default function BamPreconfirmationEvidencePage() {
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
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">What a preconfirmation proves</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            A ledger receipt records an outcome that nobody promised in advance. A preconfirmation is the only artifact in
            the execution stack with an author and a timestamp before the fact. That difference — not earliness — is what
            it contributes.
          </p>
          <p className="mt-5 text-sm text-muted-foreground">13 September 2026 · Evidence model and open questions</p>
        </header>

        <section className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Please read first</p>
          <p className="mt-3 text-base leading-7 text-foreground">
            Breadlines has no relationship with Jito. BAM is discussed from public material only, nothing here was
            reviewed by them, and <span className="font-medium">no preconfirmation data has been collected</span>. This is
            an evidence model and a set of questions — not a measurement of any provider, and not a comparison between
            providers.
          </p>
        </section>

        <section className="mt-12 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
          <p className="text-sm font-semibold text-primary">The short version</p>
          <p className="mt-3 text-base leading-7 text-foreground">
            A receipt is authorless: it records what happened, but no party is identifiable as having undertaken it. A
            preconfirmation, with a verified signature, is the only pre-inclusion statement that survives its issuer later
            declining to stand behind it. The useful metric is therefore not how early it arrives — it is how often the
            commitment matched the ledger, and what the record preserves when it did not.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">How strongly is a single field evidenced?</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Every field in the <ExternalLink href={schemaUrl}>schema</ExternalLink> sits on exactly one rung, and nothing
            is promoted between them.
          </p>
          <div className="mt-6 overflow-hidden rounded-xl border border-border">
            {rungs.map((rung, index) => (
              <div
                key={rung.name}
                className={`grid px-5 py-4 sm:grid-cols-[0.85fr_1.25fr] sm:gap-8 ${
                  index < rungs.length - 1 ? 'border-b border-border' : ''
                } ${index % 2 === 0 ? 'bg-card' : ''}`}
              >
                <p className="font-medium">{rung.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-0">{rung.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">The evidence matrix</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Five layers. The preconfirmation layer tops out below the ledger, and the receipt layer’s refusals do not
            shrink when a preconfirmation is added to it. The{' '}
            <ExternalLink href={matrixUrl}>matrix module</ExternalLink> is the single source of truth — the memo renders
            its table from it, and a test fails if the two drift apart.
          </p>
          <div className="mt-6 space-y-4">
            {matrix.map((row) => (
              <div key={row.layer} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-medium">{row.layer}</p>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{row.ceiling}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">Can prove. </span>
                  {row.proves}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">Cannot prove. </span>
                  {row.refuses}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Worked example · synthetic
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">One reconciliation, four discrepancies</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Every value below is produced by the{' '}
              <ExternalLink href={reconcileUrl}>reconciliation module</ExternalLink> from invented fixtures. No real
              provider, preconfirmation or transaction is described. The module marks any result derived from a fixture as
              synthetic and that marking propagates to every surface, so a fixture cannot be mistaken for evidence.
            </p>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              A preconfirmation was issued for one signature. The sender then rebuilt its message, and a different
              signature landed — one slot later — and failed during execution. A naive reading produces at least three
              wrong conclusions. What the model records instead:
            </p>
            <dl className="mt-6 space-y-4">
              <div className="rounded-lg border border-border p-5">
                <dt className="font-mono text-xs text-primary">PRECONFIRMATION_FOR_SUPERSEDED_REVISION</dt>
                <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                  The assertion was about a message that did not land. That is not a failure by the issuer — the sender
                  rebuilt.
                </dd>
              </div>
              <div className="rounded-lg border border-border p-5">
                <dt className="font-mono text-xs text-primary">SLOT_ASSERTION_NOT_MET</dt>
                <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                  The issuer named one slot; the transaction landed in another. Nothing here establishes why, or whether
                  the issuer controlled that outcome.
                </dd>
              </div>
              <div className="rounded-lg border border-border p-5">
                <dt className="font-mono text-xs text-primary">MULTIPLE_CLOCK_DOMAINS</dt>
                <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                  Timestamps span two clock domains, so no duration between them is computed. The offset is unrecoverable
                  from the readings — a property of the evidence, not a fault of any party.
                </dd>
              </div>
              <div className="rounded-lg border border-border p-5">
                <dt className="font-mono text-xs text-primary">RECEIPT_NOT_FINALIZED</dt>
                <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                  The receipt was read at confirmed commitment, which can still be reorganised. A limit on the receipt,
                  not a discrepancy with the preconfirmation.
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-base leading-7 text-muted-foreground">
              Three invocations were observed, and one of them returned success before the outer rejection. The
              transaction still committed nothing but its fee. Execution reach and state commitment are different
              questions, and a route that got partway is never a partly committed state transition.
            </p>
          </div>
        </section>

        <section className="mt-14 space-y-5 text-base leading-7 text-muted-foreground">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Timestamps cannot reconstruct order</h2>
          <p>
            A sender’s clock and a provider’s clock are different domains. The offset between them is unbounded and
            unrecoverable from the readings alone, so the difference between a sender timestamp and a provider timestamp
            is not a latency, a delay, or a queue time. The schema refuses to return a duration across domains rather than
            computing a misleading one.
          </p>
          <p>
            It follows that ordering cannot be reconstructed from timestamps at all — not ours, not a provider’s, not both
            together. An honest ordering reconstruction has exactly one source: an attestation whose signed payload itself
            describes the ordering, verified against a named key.
          </p>
          <p className="text-foreground">
            That yields the single most useful thing a sequencing layer can expose for post-mortem work:{' '}
            <span className="font-medium">sign the ordering claim, not just the inclusion claim.</span> An attested
            statement of the form <em>this transaction was sequenced at position N within batch B under ruleset R</em> is
            checkable. A timestamp is not.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">What still cannot be claimed</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Adding preconfirmation evidence to a receipt does not unlock any of the following, and the reconciliation
            module prints them on every output it produces.
          </p>
          <ul className="mt-6 space-y-3">
            {refusals.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                <span aria-hidden="true" className="mt-1 text-primary">
                  ✕
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">What would make a rigorous study possible</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Breadlines can build the analysis. The inputs below are what the ledger cannot supply. The questions are
            questions — not assertions about what BAM does today.
          </p>

          <div className="mt-7 rounded-xl border border-border bg-card p-6 sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight">Telemetry that would need to exist</h3>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
              {telemetry.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-card p-6 sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight">Open questions for Jito engineers</h3>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
              {questions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>

          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
            <p className="text-sm font-semibold text-primary">What Breadlines would commit to in return</p>
            <p className="mt-3 text-sm leading-6 text-foreground">
              A pre-registered protocol published before collection; a declared population and window; no provider
              comparison from a sample not designed for it; no causal claim from co-occurrence; and a correction published
              if any statement about BAM is shown to be wrong.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-8">
          <h2 className="text-2xl font-semibold tracking-tight">The work behind this</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The schema, evidence matrix, reconciliation module and adversarial cases are open. Every prose claim in the
            full memo is machine-checked by the same assertion tests the adversarial audit applies to rendered surfaces.
          </p>
          <ul className="mt-5 space-y-2 text-sm leading-6">
            <li>
              <ExternalLink href={memoUrl}>Full research memo ↗</ExternalLink>
            </li>
            <li>
              <ExternalLink href={schemaUrl}>Preconfirmation evidence schema ↗</ExternalLink>
            </li>
            <li>
              <ExternalLink href={matrixUrl}>Evidence matrix ↗</ExternalLink>
            </li>
            <li>
              <ExternalLink href={reconcileUrl}>Reconciliation module ↗</ExternalLink>
            </li>
          </ul>
          <p className="mt-8 text-sm leading-6 text-muted-foreground">
            If any statement here about BAM, Jito, or any other system has been misread, Breadlines wants the correction
            more than the note.
          </p>
        </section>
      </article>
    </main>
  )
}
