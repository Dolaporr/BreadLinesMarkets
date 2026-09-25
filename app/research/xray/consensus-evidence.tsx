'use client'

import type { CaseFile } from '../../../research/execution-casefile/core'
import {
  classifyConsensus, observerSurfaceForHistoricalRead, buildEvidenceSurfaces,
  type Claim, type FieldState, type GenesisCertProbe,
} from '../../../research/execution-casefile/consensus-evidence'
import styles from './workspace.module.css'

/**
 * Three parallel evidence surfaces. Deliberately NOT drawn as execution -> consensus -> observer:
 * an arrow would read as a proof chain, which is the exact inference this panel exists to refuse.
 * The three sit side by side because they answer different questions from different sources.
 */
const TONE: Record<FieldState, string> = {
  OBSERVED: styles.evChain, DERIVED: styles.evProvider, INFERRED: styles.evClient,
  SIMULATED: styles.evUnknown, UNKNOWN: styles.evUnknown,
  UNAVAILABLE: styles.evUnknown, NOT_SUPPORTED: styles.evUnknown,
  NOT_APPLICABLE: styles.evUnknown, REFUSED: styles.evUnknown,
}

function Row({ label, c }: { label: string; c: Claim<unknown> }) {
  const shown = c.value == null ? c.state : String(c.value)
  return (
    <div className={styles.ceRow}>
      <dt>{label}</dt>
      <dd>
        <span className={`${styles.ceValue} ${c.value == null ? styles.ceAbsent : ''}`}>{shown}</span>
        <span className={`${styles.stageEvidence} ${TONE[c.state]}`}>{c.state.replaceAll('_', ' ')}</span>
        <details className={styles.ceWhy}><summary>Why this state</summary><p>{c.basis}</p></details>
      </dd>
    </div>
  )
}

export default function ConsensusEvidence({ current, probe }: { current: CaseFile; probe: GenesisCertProbe }) {
  const consensus = classifyConsensus(probe, {
    slot: current.slot,
    blockhash: (current.receipt as { transaction?: { message?: { recentBlockhash?: string } } })?.transaction?.message?.recentBlockhash ?? null,
    // Commitment is only reported when the archived record actually carried one.
    rpcReportedCommitment: (current.provenance as { readCommitment?: string })?.readCommitment ?? null,
  })
  const observer = observerSurfaceForHistoricalRead({
    source: probe.endpoint,
    observationMethod: 'Archived RPC receipt, re-read after the fact',
    consensusEvidenceObservedAt: probe.observedAt,
  })
  const surfaces = buildEvidenceSurfaces({
    execution: {
      signature: { value: current.signature, state: 'OBSERVED', basis: 'Carried by the supplied receipt.' },
      slot: { value: current.slot, state: 'OBSERVED', basis: 'Carried by the supplied receipt.' },
      outcome: { value: current.state, state: 'OBSERVED', basis: 'Derived from meta.err on the receipt.' },
      failurePath: current.state === 'LANDED_FAILED'
        ? { value: current.explanation, state: 'OBSERVED', basis: 'Reconstructed from the recorded log range.' }
        : { value: null, state: 'NOT_APPLICABLE', basis: 'The transaction did not fail, so there is no failure path.' },
      evidenceSource: current.provenance.source,
    },
    consensus, observer,
  })

  return (
    <div className={styles.ceWrap}>
      <div className={styles.ceMap} aria-label="Evidence map">
        {[
          { k: 'EXECUTION', q: 'WHAT HAPPENED', rows: ['SVM outcome', 'instruction path', 'failure evidence'] },
          { k: 'CONSENSUS', q: 'WHAT THE NETWORK ESTABLISHED', rows: ['protocol', 'block identity', 'finality evidence'] },
          { k: 'OBSERVER', q: 'WHAT THIS OBSERVER KNEW + WHEN', rows: ['source', 'first seen', 'evidence received'] },
        ].map((b) => (
          <div key={b.k} className={styles.ceMapCard}>
            <span className={styles.ceMapQ}>{b.q}</span>
            <strong>{b.k}</strong>
            <ul>{b.rows.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className={styles.caption}>
        Three surfaces, not three steps. Each answers a different question from a different source, and
        none of them proves another.
      </p>

      <div className={styles.ceCards}>
        <section className={styles.ceCard}>
          <span className={styles.ceMapQ}>WHAT HAPPENED</span><h3>Execution</h3>
          <dl>
            <Row label="Signature" c={surfaces.execution.signature} />
            <Row label="Slot" c={surfaces.execution.slot} />
            <Row label="Outcome" c={surfaces.execution.outcome} />
            <Row label="Failure path" c={surfaces.execution.failurePath} />
          </dl>
          <p className={styles.boundary}>Execution describes what the SVM did. It says nothing about whether the containing block finalized.</p>
        </section>

        <section className={styles.ceCard}>
          <span className={styles.ceMapQ}>WHAT THE NETWORK ESTABLISHED</span><h3>Consensus</h3>
          <dl>
            <Row label="Protocol" c={consensus.protocol} />
            <Row label="Migration state" c={consensus.migrationState} />
            <Row label="Probe capability" c={consensus.capability} />
            <Row label="Execution slot" c={consensus.containingBlockSlot} />
            <Row label="Execution block identity" c={consensus.containingBlockhash} />
            <Row label="Finality evidence (RPC reported)" c={consensus.rpcReportedCommitment} />
            <Row label="Genesis certificate" c={consensus.genesisCertificateStatus} />
            <Row label="Certificate slot" c={consensus.certificateSlot} />
            <Row label="Certificate block ID" c={consensus.certificateBlockId} />
            <Row label="Certificate verification" c={consensus.certificateVerification} />
            <Row label="Certificate bound to this transaction" c={consensus.certificateBoundToTransaction} />
          </dl>
          <p className={styles.ceSource}>Evidence source: {consensus.evidenceSource} · probed {consensus.observedAt}</p>
          <p className={styles.boundary}>{consensus.boundary}</p>
        </section>

        <section className={styles.ceCard}>
          <span className={styles.ceMapQ}>WHAT THIS OBSERVER KNEW + WHEN</span><h3>Observer</h3>
          <dl>
            <Row label="Source" c={observer.source} />
            <Row label="Observation method" c={observer.observationMethod} />
            <Row label="First seen" c={observer.firstSeenAt} />
            <Row label="Processed observed" c={observer.processedObservedAt} />
            <Row label="Consensus evidence observed" c={observer.consensusEvidenceObservedAt} />
            <Row label="Finalized observed" c={observer.finalizedObservedAt} />
          </dl>
          <p className={styles.boundary}>{observer.boundary}</p>
        </section>
      </div>

      <div className={styles.discrepancy}>
        <strong>WHAT THIS PANEL REFUSES TO CLAIM</strong>
        <ul className={styles.unknowableList}>{surfaces.independence.map((line) => <li key={line}>{line}</li>)}</ul>
      </div>
    </div>
  )
}
