'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Copy, Download, FileJson, Fingerprint, Search, ShieldCheck, Upload, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { caseReport, frameStatusLabel, programName, short, type CaseFile } from '../../../research/execution-casefile/core'
import { evidenceBundle, openEvidence } from '../../../research/execution-casefile/bundle'
import { inspectAccounts } from '../../../research/execution-casefile/inspection'
import ExecutionAtlas from './execution-atlas'
import AccountInspector from './account-inspector'
import PreInclusionEvidence from './preinclusion-evidence'
import { demoTrace, summarizeTrace, traceMatchesReceipt, validateTrace, type AttemptTrace } from '../../../research/execution-casefile/trace'
import styles from './workspace.module.css'

type Summary = Pick<CaseFile, 'signature' | 'slot' | 'explanation' | 'state'> & { coverage: string }
const number = (value: number | null | undefined) => value == null ? 'Unavailable' : value.toLocaleString('en-US')
function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a')
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function Workspace({ initial, cases, selection }: { initial: CaseFile; cases: Summary[]; selection: string }) {
  const [current, setCurrent] = useState(initial), [query, setQuery] = useState(''), [tab, setTab] = useState('execution')
  const [frame, setFrame] = useState<number | null>(initial.execution.failureFrameId), [account, setAccount] = useState<string | null>(null)
  const [trace, setTrace] = useState<AttemptTrace | null>(null), [fixture, setFixture] = useState(false)
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const [includeTrace, setIncludeTrace] = useState(false)
  const receiptInput = useRef<HTMLInputElement>(null), traceInput = useRef<HTMLInputElement>(null), selectionEpoch = useRef(0)
  const visible = cases.filter(c => `${c.signature} ${c.explanation} ${c.slot}`.toLowerCase().includes(query.toLowerCase()))
  const activeFrame = frame == null ? null : current.execution.frames[frame]
  const shownLogs = activeFrame ? current.execution.logs.map((line, index) => ({ line, index })).filter(l => l.index >= activeFrame.start && l.index <= (activeFrame.end ?? current.execution.logs.length - 1))
    : current.execution.logs.map((line, index) => ({ line, index }))
  const selectedAccount = current.context.accounts.find(a => a.address === account) ?? current.context.accounts[0]
  const shownTrace = fixture ? demoTrace() : trace
  const traceSummary = shownTrace ? summarizeTrace(shownTrace) : null
  const compatibility = inspectAccounts(current)
  function showCase(c: CaseFile) { setCurrent(c); setFrame(c.execution.failureFrameId); setAccount(null); setTrace(null); setIncludeTrace(false); setFixture(false); setNotice(''); setTab('execution') }
  useEffect(() => {
    const back = () => { const signature = new URL(window.location.href).searchParams.get('signature') ?? cases[0].signature; void select(signature, false) }
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])
  async function select(signature: string, writeHistory = true) {
    const epoch = ++selectionEpoch.current
    setBusy(true)
    try {
      const response = await fetch(`/research/xray/evidence/${signature}`)
      if (!response.ok) throw new Error('The archived case could not be loaded.')
      const c = await response.json()
      if (epoch === selectionEpoch.current) {
        showCase(c)
        if (writeHistory) { const url = new URL(window.location.href); url.searchParams.set('signature', signature); window.history.pushState(null, '', url) }
      }
    } catch { if (epoch === selectionEpoch.current) setNotice('Could not load this case. Your current evidence remains open.') }
    finally { if (epoch === selectionEpoch.current) setBusy(false) }
  }
  async function importFile(file: File | undefined, kind: 'receipt' | 'trace') {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setNotice('Choose a JSON file smaller than 10 MB.'); return }
    const epoch = ++selectionEpoch.current
    setBusy(true)
    try {
      const data = JSON.parse(await file.text())
      if (kind === 'trace') {
        const t = validateTrace(data); traceMatchesReceipt(t, current)
        if (epoch !== selectionEpoch.current) return
        setTrace(t); setFixture(false); setTab('trace'); setNotice('Trace attached locally. Application-reported evidence; no provider attestation implied.')
      } else {
        const opened = await openEvidence(data)
        if (epoch === selectionEpoch.current) {
          showCase(opened.caseFile); setTrace(opened.trace)
          const url = new URL(window.location.href); url.searchParams.delete('signature'); window.history.replaceState(null, '', url)
          setNotice('Evidence opened locally. Receipt conclusions recomputed; supplied provenance and context are not independently authenticated. Nothing uploaded.')
        }
      }
    } catch (error) { if (epoch === selectionEpoch.current) setNotice(kind === 'trace' ? 'Trace rejected: check the schema, signature, event sequence and receipt consistency. Fixtures cannot attach to real cases.' : `Could not open evidence. ${error instanceof Error && !('issues' in error) ? error.message : 'The evidence structure is invalid or inconsistent.'}`) }
    finally { if (epoch === selectionEpoch.current) setBusy(false) }
  }
  async function copyReport() {
    const text = caseReport(current) + (trace && includeTrace ? `\n\n## Attached application trace\n${JSON.stringify(summarizeTrace(trace), null, 2)}` : '\n\nSender trace: not included in this export.')
    try { await navigator.clipboard.writeText(text); setNotice('Engineering report copied.') } catch { download('breadlines-case-report.md', text, 'text/markdown'); setNotice('Clipboard unavailable. The report was downloaded instead.') }
  }
  async function copyLink() {
    const url = new URL(window.location.href); url.searchParams.set('signature', current.signature)
    try { await navigator.clipboard.writeText(url.toString()); setNotice('Saved-case link copied. It requires access to this preview and contains no local imports or sender traces.') }
    catch { setNotice(`Copy this saved-case link: ${url.toString()}`) }
  }
  return <div className={styles.workspace}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><Fingerprint size={25} strokeWidth={1.3} /><span>BREADLINES</span></Link>
      <span className={styles.research}>RESEARCH WORKSPACE <span> / </span> X-RAY v1</span>
      <Link href="/" className={styles.home}><ArrowLeft size={14} /> Home</Link>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Case library">
        <div className={styles.sidebarHeading}><span>CASE LIBRARY</span><span>{cases.length.toString().padStart(2, '0')}</span></div>
        <h1>The execution<br />casebook.</h1>
        <label className={styles.search}><Search size={16} /><input aria-label="Search saved cases" placeholder="Signature, error or slot" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <p className={styles.caption}>Saved research evidence. No live collection.</p>
        <div className={styles.caseList}>
          {visible.map((c, index) => <button key={c.signature} onClick={() => select(c.signature)} className={`${styles.caseButton} ${current.signature === c.signature ? styles.selected : ''}`} aria-current={current.signature === c.signature ? 'true' : undefined}>
            <span className={styles.caseNumber}>{(index + 1).toString().padStart(2, '0')}</span><span><strong>{short(c.signature)}</strong><span>{c.explanation}</span><small>SLOT {number(c.slot)} · {c.coverage.toLowerCase()} context</small></span>
          </button>)}
          {!visible.length && <p className={styles.empty}>No saved case matches. You can open a receipt JSON below.</p>}
        </div>
        <button className={styles.secondary} onClick={() => receiptInput.current?.click()} disabled={busy}><Upload size={16} /> Open evidence JSON</button>
        <p className={styles.caption}>Saved cases + local imports. No live RPC lookup. Legacy / v0 JSON supported; v1 explicitly unsupported.</p>
        <input ref={receiptInput} type="file" accept=".json,application/json" hidden onChange={e => { void importFile(e.target.files?.[0], 'receipt'); e.target.value = '' }} />
        <details className={styles.selection}><summary>How these cases were selected</summary><p>{selection}</p></details>
      </aside>
      <main className={styles.main} aria-busy={busy}>
        <div className={styles.toolbar}><div><span className={styles.eyebrow}>EXECUTION CASE FILE</span><p title={current.signature}>{short(current.signature)} <a aria-label="Open signature in Solana Explorer" href={`https://explorer.solana.com/tx/${current.signature}`} target="_blank" rel="noreferrer"><ArrowUpRight size={14} /></a></p></div>
          <div className={styles.actions}><button onClick={copyReport}><Copy size={15} /> Copy report</button><button onClick={() => download(`breadlines-${current.signature.slice(0, 8)}.json`, JSON.stringify(evidenceBundle(current, trace, includeTrace), null, 2))}><Download size={15} /> Export evidence</button><button onClick={copyLink} disabled={!cases.some(c => c.signature === current.signature)}>Copy case link</button></div></div>
        {trace && <label className={styles.privacyChoice}><input type="checkbox" checked={includeTrace} onChange={e => setIncludeTrace(e.target.checked)} /> Include application trace in exports (off by default)</label>}
        <div role="status" className={styles.notice}>{busy ? 'Opening evidence…' : notice}</div>
        <section className={styles.verdict}>
          <div className={styles.verdictTop}><span className={styles.failureBadge}>{current.state.replaceAll('_', ' ')}</span><span className={styles.sourceGrade}><ShieldCheck size={14} /> RECEIPT EVIDENCE</span></div>
          <h2>{current.execution.semantic?.quantities ? 'The transfer stopped here.' : current.execution.semantic?.name ?? (current.execution.customError ? `Custom error ${current.execution.customError.decimal}` : current.state === 'LANDED_SUCCESS' ? 'Execution completed.' : 'Execution stopped.')}</h2>
          <p>{current.explanation}</p>
          <p className={styles.boundary}>{current.execution.stateCommitment.statement}</p>
          {current.execution.failurePath.length > 0 && <button className={styles.pathLink} onClick={() => { setTab('execution'); setFrame(current.execution.failureFrameId) }}>{current.execution.failurePath.map(id => programName(current.execution.frames[id].programId)).join(' → ')} <ChevronRight size={15} /><span>Inspect evidence</span></button>}
          <div className={styles.numbers}><Metric label="Landed slot" value={number(current.slot)} /><Metric label="Transaction fee · lamports" value={number(current.metrics.feeLamports)} /><Metric label="Compute used" value={number(current.metrics.consumedCU)} /><Metric label="Compute limit · observed" value={number(current.metrics.computeBudget.computeUnitLimit)} /></div>
        </section>
        <Tabs value={tab} onValueChange={setTab} className={styles.tabs}>
          <TabsList className={styles.tabList} aria-label="Investigation views"><TabsTrigger value="execution">01 / Execution</TabsTrigger><TabsTrigger value="balances">02 / Accounts & balances</TabsTrigger><TabsTrigger value="context">03 / Neighbors</TabsTrigger><TabsTrigger value="trace">04 / Attempt history</TabsTrigger><TabsTrigger value="preinclusion">05 / Pre-inclusion evidence</TabsTrigger></TabsList>
          <TabsContent value="execution">
            <ExecutionAtlas key={current.signature} current={current} selected={frame} onSelect={setFrame} />
            <div className={styles.evidenceGrid}>
              <section className={styles.panel}><div className={styles.panelTitle}><h3>Invocation path</h3><span>{current.execution.logsComplete ? 'Closed log frames' : 'Incomplete logs'}</span></div>
                <p className={styles.caption}>Select an invocation to inspect its exact log range. {current.execution.stateCommitment.statement}</p>
                {current.execution.frames.map(f => <button key={f.id} className={`${styles.frame} ${frame === f.id ? styles.activeFrame : ''}`} style={{ marginLeft: `${Math.min(f.depth - 1, 5) * 12}px` }} onClick={() => setFrame(f.id)} aria-pressed={frame === f.id}>
                  <span className={f.status === 'FAILED' ? styles.redDot : styles.dot} /><span><strong>{programName(f.programId)}</strong><small>{f.instruction ?? 'Instruction name unavailable'} · depth {f.depth}</small></span><span className={styles.frameStatus}>{frameStatusLabel(f.status, current.state)}</span>
                </button>)}
                {!current.execution.frames.length && <p className={styles.empty}>No invocation frames can be recovered from these logs.</p>}
                <div className={styles.divider} /><h3>Outer instruction positions</h3><p className={styles.caption}>Receipt positions, starting at 1. {current.execution.stateCommitment.statement} A position reached before the rejection is execution, not commitment.</p>
                {current.execution.outers.map(ix => <div key={ix.index} className={styles.outer}><span>{ix.index + 1}</span><strong title={ix.programId}>{programName(ix.programId)}</strong><small>{ix.state.replaceAll('_', ' ').toLowerCase()}</small></div>)}
                <p className={styles.boundary}>{current.execution.attributionBoundary}</p>
                {current.execution.systemTransfer && <details className={styles.details}><summary>Recovered transfer accounts</summary><dl className={styles.data}><dt>Source account</dt><dd>{current.execution.systemTransfer.source}</dd><dt>Destination account</dt><dd>{current.execution.systemTransfer.destination}</dd><dt>Requested lamports</dt><dd>{number(current.execution.systemTransfer.lamports)}</dd><dt>Shortfall · derived lamports</dt><dd>{number(current.execution.semantic?.quantities ? current.execution.semantic.quantities.requiredLamports - current.execution.semantic.quantities.availableLamports : null)}</dd></dl><p className={styles.caption}>{current.execution.systemTransfer.basis}</p><p className={styles.caption}>Outer instruction {current.execution.systemTransfer.outerIndex + 1}, inner instruction {current.execution.systemTransfer.innerIndex + 1}. No account ownership or intent is inferred.</p></details>}
              </section>
              <section className={styles.logPanel}><div className={styles.panelTitle}><h3>Evidence drawer</h3><button onClick={() => setFrame(null)}>All logs</button></div>
                <p className={styles.caption}>{activeFrame ? `${programName(activeFrame.programId)} · logs ${activeFrame.start + 1}–${(activeFrame.end ?? current.execution.logs.length - 1) + 1}` : `${current.execution.logs.length} recorded log lines`}</p>
                {activeFrame && <p className={styles.address}>{activeFrame.programId}</p>}
                <div className={styles.logs}>{shownLogs.map(({ line, index }) => <div key={index} className={current.execution.explanationEvidence.includes(index) ? styles.highlightLog : ''}><span>{index + 1}</span><code>{line}</code></div>)}{!shownLogs.length && <p>Logs unavailable.</p>}</div>
                {current.execution.customError && <p className={styles.caption}>Observed custom error: {current.execution.customError.decimal} / {current.execution.customError.hex}. Numeric codes are scoped to the failing program.</p>}
              </section>
            </div>
            <details className={styles.details}><summary>Fees, signers and raw receipt</summary><p className={styles.caption}>{compatibility.version} · {compatibility.resourceSource}</p><dl className={styles.data}><dt>Priority fee · derived lamports</dt><dd>{number(current.metrics.priority.amountLamports)}</dd><dt>Requested price · micro-lamports/CU</dt><dd>{number(current.metrics.computeBudget.computeUnitPriceMicroLamports)}</dd><dt>Fee payer</dt><dd>{typeof current.receipt.transaction?.message?.accountKeys?.[0] === 'string' ? String(current.receipt.transaction.message.accountKeys[0]) : (current.receipt.transaction?.message?.accountKeys?.[0] as { pubkey?: string })?.pubkey ?? 'Unavailable'}</dd><dt>Signer addresses</dt><dd>{current.metrics.signerAddresses?.join(', ') ?? 'Unavailable'}</dd><dt>Declared writable accounts</dt><dd>{number(current.metrics.writableAccounts?.length)}</dd></dl><p className={styles.caption}>{current.metrics.priority.derivation?.formula ?? 'Priority fee cannot be reconstructed from supported observed fields.'}</p><pre>{JSON.stringify(current.receipt, null, 2)}</pre></details>
          </TabsContent>
          <TabsContent value="balances"><AccountInspector key={current.signature} current={current} /></TabsContent>
          <TabsContent value="context">
            <section className={styles.panel}><div className={styles.panelTitle}><h3>Shared writable accounts</h3><span>{current.context.coverage}</span></div>
              <div className={styles.numbers}><Metric label="Neighboring transactions examined" value={number(current.context.examined)} /><Metric label={current.context.coverage === 'PARTIAL' ? 'At least this many observed overlaps' : 'Observed overlapping transactions'} value={number(current.context.count)} /><Metric label="Shared accounts" value={current.context.count == null ? 'Unavailable' : number(current.context.accounts.length)} /></div>
              <p className={styles.boundary}>{current.context.limitation}</p><p className={styles.caption}>Slots {number(current.context.slotRange.start)}–{number(current.context.slotRange.end)} · {current.context.source}</p>
              {!current.context.accounts.length ? <p className={styles.empty}>{current.context.count === 0 ? 'No shared writable accounts were found in the examined evidence.' : 'No usable neighboring evidence is attached. This does not mean there was no overlap.'}</p> : <div className={styles.accountGrid}>
                <div><span className={styles.eyebrow}>TARGET ↔ SHARED ACCOUNT</span>{current.context.accounts.map(a => <button key={a.address} className={`${styles.account} ${selectedAccount?.address === a.address ? styles.activeFrame : ''}`} onClick={() => setAccount(a.address)}><Fingerprint size={18} /><span title={a.address}>{short(a.address)}</span><strong>{a.signatures.length}</strong></button>)}</div>
                <div><span className={styles.eyebrow}>ACCOUNT ↔ OBSERVED TRANSACTIONS</span><p className={styles.address}>{selectedAccount?.address}</p><p className={styles.caption}>Links show shared account declarations. No causal arrows or arrival-time ordering.</p><div className={styles.neighbors}>{selectedAccount?.signatures.map(sig => { const record = current.context.overlaps.find(r => r.signature === sig)!; return <details key={sig}><summary>{short(sig)} <small>{record.executionState}</small></summary><p className={styles.address}>{sig}</p><p>Slot {number(record.slot)} · block-list position {record.blockTransactionIndex == null ? 'unavailable' : record.blockTransactionIndex + 1}</p><p>Shared accounts: {record.sharedWritableAccounts.map(short).join(', ')}</p><a href={`https://explorer.solana.com/tx/${sig}`} target="_blank" rel="noreferrer">Open chain receipt ↗</a></details> })}</div></div>
              </div>}
            </section>
          </TabsContent>
          <TabsContent value="trace">
            <section className={styles.panel}><div className={styles.panelTitle}><h3>Attempt history</h3><span>{fixture ? 'ILLUSTRATIVE FIXTURE' : trace ? 'APPLICATION OBSERVED' : 'UNAVAILABLE'}</span></div>
              <div className={styles.actions}><button onClick={() => traceInput.current?.click()} disabled={busy}><Upload size={15} /> Attach trace JSON</button><button onClick={() => { setFixture(!fixture); setNotice('') }}>{fixture ? 'Return to case' : 'Explore standalone demo'}</button>{trace && <button onClick={() => setTrace(null)}><X size={15} /> Detach</button>}</div>
              <input ref={traceInput} type="file" accept=".json,application/json" hidden onChange={e => { void importFile(e.target.files?.[0], 'trace'); e.target.value = '' }} />
              {fixture && <p className={styles.fixture}>Synthetic lifecycle example. Separate from the real signature open in this workspace. No transactions were sent.</p>}
              {!traceSummary ? <div className={styles.empty}><h3>The ledger cannot fill in this timeline.</h3><p>Attach an opt-in application trace to examine submission attempts and receipt observations. Files stay in this browser session.</p><p>An absent trace says nothing about whether a provider received, retried or dropped this transaction.</p></div> : <>
                <div className={styles.numbers}><Metric label="Captured message revisions" value={number(traceSummary.revisions.length)} /><Metric label="Captured submission attempts" value={number(traceSummary.sends)} /><Metric label="Captured repeated sends" value={number(traceSummary.retries)} /></div>
                {traceSummary.captureIssuesReported && <p className={styles.fixture}>Capture gaps were recorded: {traceSummary.trace.captureIssues.join(', ')}. Counts describe captured events only; the timeline is incomplete.</p>}
                <p className={styles.boundary}>{traceSummary.boundary}</p>
                <div className={styles.revisions}>{traceSummary.revisions.map(r => <div key={r.revisionId}><strong>{r.revisionId}{r.replacesRevisionId ? ` · rebuild of ${r.replacesRevisionId}` : ''}</strong><p>{r.outcome.replaceAll('_', ' ').toLowerCase()}</p><small>{r.signature ? short(r.signature) : 'Unsigned'} · {r.sends} send(s)</small></div>)}</div>
                <ol className={styles.timeline}>{traceSummary.trace.events.map(entry => <li key={entry.sequence}><time>+{number(entry.elapsedMs)} ms</time><span className={styles.dot} /><div><strong>{entry.event.type.replaceAll('_', ' ').toLowerCase()}</strong><p>{Object.entries(entry.event).filter(([k]) => k !== 'type' && k !== 'messageHash').map(([k, v]) => `${k}: ${short(String(v))}`).join(' · ')}</p><details><summary>Source event</summary><pre>{JSON.stringify(entry, null, 2)}</pre></details></div></li>)}</ol>
                <button className={styles.secondary} onClick={() => download(fixture ? 'illustrative-trace.json' : 'application-trace.json', JSON.stringify(shownTrace, null, 2))}><FileJson size={16} /> Export {fixture ? 'fixture' : 'trace'}</button>
              </>}
            </section>
          </TabsContent>
          <TabsContent value="preinclusion">
            <PreInclusionEvidence key={current.signature} current={current} trace={trace} />
          </TabsContent>
        </Tabs>
        <section className={styles.unknowns}><div><span className={styles.eyebrow}>THE NEXT EVIDENCE</span><h3>What would we need to know?</h3></div><div>{current.missingTelemetry.map(m => <details key={m.question}><summary>{m.question}<ChevronRight size={16} /></summary><p>{m.required}</p></details>)}</div></section>
        <footer className={styles.footer}><Check size={15} /><span>{current.provenance.parserVersion} · {current.provenance.source}<br />{current.provenance.sha256 && `Receipt SHA-256: ${current.provenance.sha256}`}<br />{current.provenance.verification}</span></footer>
      </main>
    </div>
  </div>
}
function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
