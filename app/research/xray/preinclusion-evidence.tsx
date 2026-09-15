'use client'

import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import type { CaseFile } from '../../../research/execution-casefile/core'
import { reconcile, type Reconciliation } from '../../../research/execution-casefile/reconciliation'
import { ATTESTATION_CLASSES, PRECONFIRMATION_PROHIBITED_READINGS, validatePreconfirmation, type PreconfirmationRecord } from '../../../research/execution-casefile/preconfirmation'
import { MAP_BOUNDARY, type StageEvidence } from '../../../research/execution-casefile/preconfirmation-map'
import type { AttemptTrace } from '../../../research/execution-casefile/trace'
import styles from './workspace.module.css'

const RUNG: Record<(typeof ATTESTATION_CLASSES)[number], { className: string; label: string; blurb: string }> = {
  CLIENT_OBSERVED: { className: styles.clientObserved, label: 'CLIENT OBSERVED', blurb: 'This application measured it. Nothing outside this process confirms it happened.' },
  PROVIDER_REPORTED: { className: styles.providerReported, label: 'PROVIDER REPORTED', blurb: 'A named party asserted it. An assertion, not an authenticated fact.' },
  VALIDATOR_ATTESTED: { className: styles.validatorAttested, label: 'VALIDATOR ATTESTED', blurb: 'A signature over a described payload was verified against a named key. Only a verified signature reaches this rung.' },
  CHAIN_PROVEN: { className: styles.chainProven, label: 'CHAIN PROVEN', blurb: 'Recorded in the ledger. The only rung a receipt can occupy.' },
}

const EVIDENCE_TONE: Record<StageEvidence, string> = {
  UNKNOWN: styles.evUnknown,
  CLIENT_OBSERVED: styles.evClient,
  PROVIDER_REPORTED: styles.evProvider,
  VALIDATOR_ATTESTED: styles.evValidator,
  CHAIN_PROVEN: styles.evChain,
}

/**
 * The summary shows the evidence class in the stage vocabulary, so a provider assertion reads the
 * same here as it does on the lifecycle. Display only — the underlying class is unchanged.
 */
const SUMMARY_CLASS: Record<StageEvidence, string> = {
  CLIENT_OBSERVED: 'CLIENT_OBSERVED',
  PROVIDER_REPORTED: 'PROVIDER_OBSERVED',
  VALIDATOR_ATTESTED: 'VALIDATOR_ATTESTED',
  CHAIN_PROVEN: 'CHAIN_PROVEN',
  UNKNOWN: 'UNKNOWN',
}

export default function PreInclusionEvidence({ current, trace }: { current: CaseFile; trace: AttemptTrace | null }) {
  const [result, setResult] = useState<Reconciliation | null>(null)
  const [record, setRecord] = useState<PreconfirmationRecord | null>(null)
  const [notice, setNotice] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function attach(file: File | undefined) {
    if (!file) return
    try {
      const parsed = validatePreconfirmation(JSON.parse(await file.text()))
      setRecord(parsed)
      setResult(reconcile({
        preconfirmation: parsed,
        attemptTrace: trace ?? undefined,
        receipt: current.receipt as never,
      }))
      setNotice('Pre-inclusion record attached locally. Supplied evidence; no signature was verified and nothing was uploaded.')
    } catch (error) {
      setResult(null)
      setRecord(null)
      setNotice(`Rejected: ${error instanceof Error ? error.message : 'the record does not match the schema.'}`)
    }
  }

  const clockWarning = result?.discrepancies.find((item) => item.code === 'MULTIPLE_CLOCK_DOMAINS') ?? null

  return <section className={styles.panel} aria-label="Pre-inclusion evidence">
    <div className={styles.panelTitle}>
      <h3>Pre-inclusion evidence</h3>
      <span>{result ? result.identity.match.replaceAll('_', ' ') : 'NONE ATTACHED'}</span>
    </div>
    <p className={styles.caption}>
      What was known before a receipt existed, kept separate from what the ledger proved. Every field
      sits on exactly one rung below and is never promoted between them.
    </p>

    <div className={styles.ladder}>
      {ATTESTATION_CLASSES.map((name) => (
        <div key={name} className={`${styles.rung} ${RUNG[name].className}`}>
          <strong>{RUNG[name].label}</strong><span>{RUNG[name].blurb}</span>
        </div>
      ))}
    </div>

    <div className={styles.actions} style={{ marginTop: 20 }}>
      <button onClick={() => input.current?.click()}><Upload size={15} /> Attach pre-inclusion record</button>
      {result && <button onClick={() => { setResult(null); setRecord(null); setNotice('') }}><X size={15} /> Detach</button>}
    </div>
    <input ref={input} type="file" accept=".json,application/json" hidden
      onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = '' }} />
    {notice && <p className={styles.caption}>{notice}</p>}

    {!result ? <div className={styles.empty}>
      <h3>No pre-inclusion evidence is attached.</h3>
      <p>A preconfirmation would record what an identified party said about this transaction before it landed, and on whose clock.</p>
      <p>Its absence says nothing. It is not evidence that no preconfirmation was issued, that the transaction was deprioritised, or that any provider did anything at all.</p>
    </div> : <>
      {result.synthetic && <p className={styles.syntheticBanner}>{result.syntheticReason}</p>}

      <div className={styles.summaryCard}>
        <div className={styles.summaryTop}>
          <span className={`${styles.summaryHeadline} ${result.preconfirmationState?.source === 'UNKNOWN' ? styles.sourceUnknown : styles.evProvider}`}>
            {result.preconfirmationState?.source === 'UNKNOWN' ? 'SOURCE NOT ESTABLISHED' : result.preconfirmationState?.source}
          </span>
          <span className={`${styles.stateChip} ${styles[`state${result.reconciliation.state}`]}`}>{result.reconciliation.state}</span>
          {result.evidenceMap && <span className={styles.unknownCount}>
            {result.evidenceMap.unknownStageCount} / {result.evidenceMap.stages.length} stages unknown
          </span>}
        </div>
        <dl className={styles.summaryGrid}>
          <div className={styles.summaryItem}><dt>Source basis</dt><dd className={result.preconfirmationState?.sourceBasis === 'UNKNOWN' ? styles.sourceUnknown : ''}>{result.preconfirmationState?.sourceBasis ?? 'UNKNOWN'}</dd></div>
          <div className={styles.summaryItem}><dt>Emission</dt><dd className={result.evidenceMap?.emission === 'UNKNOWN' ? styles.sourceUnknown : ''}>{result.evidenceMap?.emission ?? 'UNKNOWN'}</dd></div>
          <div className={styles.summaryItem}><dt>Evidence class</dt><dd>{SUMMARY_CLASS[(result.preconfirmationState?.effectiveAttestation ?? 'UNKNOWN') as StageEvidence]}</dd></div>
          {result.preconfirmationState?.statusCode != null && <div className={styles.summaryItem}><dt>Status</dt><dd>{result.preconfirmationState.statusCode}</dd></div>}
          <div className={styles.summaryItem}><dt>Reconciliation</dt><dd>{result.reconciliation.state}</dd></div>
          <div className={styles.summaryItem}><dt>Identity</dt><dd>{result.identity.match.replaceAll('_', ' ')}</dd></div>
        </dl>
      </div>

      <details className={styles.details}>
        <summary>Evidence details</summary>
      <dl className={styles.data}>
        <dt>Issuer</dt>
        <dd>{result.preconfirmationState?.sourceDescription ?? 'Source not established'}</dd>
        <dt>Source basis</dt>
        <dd>
          <span className={`${styles.classTag} ${result.preconfirmationState?.sourceBasis === 'EXPLICIT' ? styles.evValidator : styles.evProvider}`}>
            {result.preconfirmationState?.sourceBasis ?? 'UNKNOWN'}
          </span>{' '}
          {result.preconfirmationState?.sourceRationale}
        </dd>
        <dt>Status code</dt>
        <dd>{result.preconfirmationState?.statusCode ?? 'None carried'}</dd>
        <dt>Ledger reconciliation</dt>
        <dd>
          <span className={`${styles.stateChip} ${styles[`state${result.reconciliation.state}`]}`}>{result.reconciliation.state}</span>{' '}
          {result.reconciliation.basis}
        </dd>
        <dt>Identity</dt><dd>{result.identity.match.replaceAll('_', ' ').toLowerCase()}</dd>
        <dt>Asserted level</dt>
        <dd>{result.preconfirmationState?.assertedLevel ?? 'Unavailable'} <span className={`${styles.classTag} ${RUNG[result.preconfirmationState?.effectiveAttestation ?? 'PROVIDER_REPORTED'].className}`}>{result.preconfirmationState?.effectiveAttestation}</span></dd>
        <dt>Issuer</dt><dd>{result.preconfirmationState?.provider ?? 'Unavailable'}</dd>
        <dt>Attestation</dt><dd>{result.preconfirmationState?.attestationVerification}</dd>
        <dt>Execution reach</dt>
        <dd>{result.execution ? `${result.execution.reach.framesObserved} invocation(s) observed; rejection ${result.execution.reach.rejectionLocated ? 'located' : 'not located'}` : 'No receipt supplied'}</dd>
        <dt>State commitment</dt>
        <dd>{result.execution ? <><span className={`${styles.classTag} ${styles.chainProven}`}>{result.execution.stateCommitment.outcome}</span> {result.execution.stateCommitment.statement}</> : 'No receipt supplied'}</dd>
      </dl>
      </details>

      {record && record.unmodelledFields.length > 0 && <div className={styles.opaqueFields}>
        <h4>Uninterpreted fields</h4>
        <p>
          Carried by the payload and retained verbatim. This model does not interpret them. Their
          presence is not evidence that they are authenticated, and a field describing sequence or
          position is not established as authenticated ordering evidence by appearing here.
        </p>
        {record.unmodelledFields.map((entry) => (
          <div key={entry.key} className={styles.opaqueRow}>
            <code>{entry.key}</code><span>{entry.value}</span>
          </div>
        ))}
      </div>}

      {result.evidenceMap && <>
        <div className={styles.divider} />
        <div className={styles.pathHead}>
          <h4>{result.evidenceMap.name}</h4>
          <span className={styles.classTag}>{result.evidenceMap.emission.replaceAll('_', ' ').toLowerCase()}</span>
          <span className={styles.caption}>{result.evidenceMap.unknownStageCount} of {result.evidenceMap.stages.length} stages not established</span>
        </div>
        <p className={styles.caption}>{result.evidenceMap.character}</p>
        <p className={styles.basisNote}>{result.evidenceMap.basisToday}</p>
        <div className={styles.lifecycle}>
          {result.evidenceMap.stages.map((stage) => (
            <div key={stage.stage} className={`${styles.stage} ${stage.evidence === 'UNKNOWN' ? styles.stageUnknown : ''}`}>
              <strong>{stage.label}</strong>
              <small className={EVIDENCE_TONE[stage.evidence as StageEvidence]}>{stage.evidenceLabel}</small>
              <span>
                <small>{stage.known}</small>
                <em>Not established: {stage.notEstablished}</em>
              </span>
            </div>
          ))}
        </div>
        <div className={styles.stageCards}>
          {result.evidenceMap.stages.map((stage) => (
            <div key={stage.stage} className={`${styles.stageCard} ${stage.evidence === 'UNKNOWN' ? styles.stageCardUnknown : ''}`}>
              <div className={styles.stageCardHead}>
                <strong>{stage.label}</strong>
                <small className={EVIDENCE_TONE[stage.evidence as StageEvidence]}>
                  {stage.evidence === 'UNKNOWN' ? 'NOT ESTABLISHED' : stage.evidenceLabel}
                </small>
              </div>
              <p className={styles.stageCardBody}>{stage.known}</p>
              <details className={styles.stageDetails}>
                <summary>Evidence details</summary>
                <p>Not established: {stage.notEstablished}</p>
              </details>
            </div>
          ))}
        </div>
        {result.evidenceMap.ordering && <div className={styles.discrepancy}>
          <strong>ORDERING EVIDENCE · {result.evidenceMap.ordering.authentication.replaceAll('_', ' ')}</strong>
          <p>{result.evidenceMap.ordering.headline}</p>
          <p className={styles.caption}>Claim ({result.evidenceMap.ordering.claim.fields.join(', ')}): {result.evidenceMap.ordering.claim.describes}</p>
          <p className={styles.caption}>Check: {result.evidenceMap.ordering.check.method} {result.evidenceMap.ordering.check.direction}</p>
          <p className={styles.caption}>Scope: {result.evidenceMap.ordering.check.scope}</p>
          <em>{result.evidenceMap.ordering.boundary}</em>
          <ul className={styles.unknowableList}>{result.evidenceMap.ordering.doesNotEstablish.map((line) => <li key={line}>{line}</li>)}</ul>
          <p className={styles.caption}>Source: {result.evidenceMap.ordering.source}</p>
        </div>}
        <p className={styles.boundary}>{MAP_BOUNDARY}</p>
        {result.evidenceMap.openQuestions.length > 0 && <>
          <h3 style={{ marginTop: 22 }}>Open with this issuer</h3>
          <ul className={styles.openQ}>{result.evidenceMap.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
        </>}
      </>}

      <div className={styles.divider} />
      <h3>Timing fields</h3>
      {clockWarning && <div className={styles.clockWarn}>
        <strong>MULTIPLE CLOCKS</strong>
        <span>Readings span {result.timing.distinctClockDomainCount} clock domains, so no duration between them is calculated. The offset is unknown and not recoverable from the readings.</span>
      </div>}
      <dl className={styles.data}>
        <dt>Clock domains</dt><dd>{result.timing.clockDomains.length ? result.timing.clockDomains.join(', ') : 'None recorded'}</dd>
        <dt>Sender-local observed</dt><dd>{result.timing.senderLocalObservedAt ?? 'Unavailable'}</dd>
        <dt>Provider observed</dt><dd>{result.timing.providerObservedAt ?? 'Unavailable'}</dd>
        <dt>Block time</dt><dd>{result.timing.blockTime ?? 'Unavailable'}</dd>
        <dt>Sender → provider</dt>
        <dd>{result.timing.senderToProviderDuration == null ? 'Not calculable — a reading is missing'
          : result.timing.senderToProviderDuration.comparable ? `${result.timing.senderToProviderDuration.ms} ms on one clock`
          : 'Not calculated — readings are on different clocks'}</dd>
      </dl>
      <details className={styles.details}>
        <summary>Raw provenance</summary>
        <p className={styles.caption}>{result.timing.boundary}</p>
        {result.timing.senderToProviderDuration && !result.timing.senderToProviderDuration.comparable
          && <p className={styles.caption}>{result.timing.senderToProviderDuration.reason}</p>}
        <p className={styles.caption}>{result.preconfirmationState?.sourceRationale}</p>
        <p className={styles.caption}>{result.evidenceMap?.basisToday}</p>
      </details>

      {result.discrepancies.length > 0 && <>
        <div className={styles.divider} />
        <h3>Discrepancies</h3>
        {result.discrepancies.map((item) => <div key={item.code} className={styles.discrepancy}>
          <strong>{item.code.replaceAll('_', ' ')}</strong>
          <p>{item.statement}</p>
          <em>{item.boundary}</em>
        </div>)}
      </>}

      <div className={styles.divider} />
      <h3>Still unknowable</h3>
      <p className={styles.caption}>Adding a preconfirmation does not answer these. They need telemetry no party here supplied.</p>
      <ul className={styles.unknowableList}>{result.unknowable.map((line) => <li key={line}>{line}</li>)}</ul>

      <details className={styles.details}>
        <summary>What a preconfirmation may never be read as</summary>
        <ul className={styles.unknowableList}>{PRECONFIRMATION_PROHIBITED_READINGS.map((line) => <li key={line}>{line}</li>)}</ul>
      </details>
    </>}
  </section>
}
