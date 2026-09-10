'use client'

import { useState } from 'react'
import { RotateCcw, Layers3, ListTree } from 'lucide-react'
import { programName, type CaseFile } from '../../../research/execution-casefile/core'
import { projectFrames } from '../../../research/execution-casefile/inspection'
import styles from './workspace.module.css'

export default function ExecutionAtlas({ current, selected, onSelect }: { current: CaseFile; selected: number | null; onSelect: (id: number) => void }) {
  const [spatial, setSpatial] = useState(true), [rotation, setRotation] = useState(-18), [step, setStep] = useState(0)
  const frames = current.execution.frames
  // Full data remains in the list. Large graphs are explicitly bounded for legibility.
  const shown = frames.slice(0, 80), points = projectFrames(shown, rotation, spatial)
  const position = new Map(points.map(p => [p.id, p]))
  const failed = new Set(current.execution.failurePath)
  return <section className={styles.atlas} aria-label="Interactive execution call graph">
    <div className={styles.atlasHeader}><div><span className={styles.eyebrow}>EXECUTION ATLAS</span><h3>Follow the call. Open the evidence.</h3></div>
      <div className={styles.actions}><button aria-pressed={spatial} onClick={() => setSpatial(!spatial)}>{spatial ? <ListTree size={15} /> : <Layers3 size={15} />}{spatial ? 'Flat view' : 'Depth view'}</button><button aria-label="Reset graph view" onClick={() => { setRotation(-18); setStep(0) }}><RotateCcw size={15} /></button></div></div>
    {!shown.length ? <p className={styles.empty}>No call graph can be reconstructed from the supplied logs.</p> : <>
      <svg viewBox="0 0 900 340" className={styles.atlasSvg} role="group" aria-label="Observed calls. Lines connect parent and child invocations, not competing transactions.">
        <defs><radialGradient id="atlas-halo"><stop offset="0" stopColor="#68d5df" stopOpacity=".12" /><stop offset="1" stopColor="#68d5df" stopOpacity="0" /></radialGradient></defs>
        <ellipse cx="450" cy="175" rx="430" ry="150" fill="url(#atlas-halo)" />
        {[65, 125, 185, 245, 305].map(y => <path key={y} d={`M40 ${y} H860`} stroke="#ffffff" strokeOpacity=".04" />)}
        {shown.map(f => {
          const p = position.get(f.id)!, parent = f.parentId == null ? null : position.get(f.parentId)
          return parent ? <path key={f.id} d={`M${parent.x},${parent.y} Q${parent.x},${p.y} ${p.x},${p.y}`} fill="none" stroke={failed.has(f.id) && failed.has(f.parentId!) ? '#f5a394' : '#59909a'} strokeOpacity={failed.has(f.id) ? .85 : .45} strokeWidth={failed.has(f.id) ? 2 : 1} /> : null
        })}
        {shown.map(f => { const p = position.get(f.id)!, active = selected === f.id, color = f.status === 'FAILED' ? '#f5a394' : f.status === 'INCOMPLETE' ? '#e6cb89' : '#83d8d3'; return <g key={f.id} role="button" tabIndex={0} aria-label={`Call ${f.id + 1}: ${programName(f.programId)}, depth ${f.depth}, ${f.status}. Open logs.`} aria-pressed={active} onClick={() => onSelect(f.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(f.id) } }} className={styles.atlasNode}>
          <title>{f.programId} · {f.instruction ?? 'Instruction name unavailable'} · {f.status}</title>
          <circle cx={p.x} cy={p.y} r={active ? 22 : 14} fill={color} fillOpacity={active ? .16 : .06} stroke={color} strokeOpacity={active ? .9 : .25} />
          <circle cx={p.x} cy={p.y} r={active ? 7 : 5} fill={color} />
          <text x={p.x} y={p.y - 29} textAnchor="middle" fill={color} fontSize="12">{f.id + 1}</text>
          {(shown.length < 14 || active) && <text x={p.x} y={p.y + 37} textAnchor="middle" fill="#dbe9e8" fontSize="13">{programName(f.programId)}</text>}
        </g> })}
      </svg>
      <div className={styles.atlasControls}><label>Rotate depth view<input type="range" min="-40" max="40" value={rotation} disabled={!spatial} onChange={e => setRotation(Number(e.target.value))} aria-label="Rotate depth view" /></label>
        {current.execution.failurePath.length > 0 && <button className={styles.secondary} onClick={() => { onSelect(current.execution.failurePath[step % current.execution.failurePath.length]); setStep(s => s + 1) }}>Step through failure path →</button>}</div>
    </>}
    <p className={styles.caption}>{current.state === 'LANDED_FAILED' ? 'A call marked SUCCESS returned success and was still rolled back: this transaction committed nothing. ' : ''}Geometry shows log order and call depth—not time, arrival order or causal competition. {current.execution.logsComplete ? 'Closed log frames.' : 'Incomplete logs: graph may omit calls.'} {frames.length > 80 ? `First 80 of ${frames.length} calls shown; the list below retains all calls.` : `${frames.length} recorded calls.`} Select any node to read its logs below.</p>
  </section>
}
