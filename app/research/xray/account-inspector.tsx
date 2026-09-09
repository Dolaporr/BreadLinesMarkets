'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { type CaseFile } from '../../../research/execution-casefile/core'
import { inspectAccounts, decimalAmount } from '../../../research/execution-casefile/inspection'
import styles from './workspace.module.css'

export default function AccountInspector({ current }: { current: CaseFile }) {
  const report = useMemo(() => inspectAccounts(current), [current])
  const [query, setQuery] = useState(''), [changed, setChanged] = useState(false)
  const rows = report.accounts.filter(a => (a.address ?? '').includes(query.trim()) && (!changed || (a.deltaLamports != null && a.deltaLamports !== '0')))
  const flag = (v: boolean | null) => v == null ? 'Unknown' : v ? 'Yes' : 'No'
  return <section className={styles.panel}>
    <div className={styles.panelTitle}><h3>Accounts & balance changes</h3><span>RECEIPT EVIDENCE</span></div>
    <p className={styles.boundary}>{report.boundary}</p>
    <div className={styles.accountFilters}><label className={styles.search}><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by account address" aria-label="Filter account addresses" /></label><label><input type="checkbox" checked={changed} onChange={e => setChanged(e.target.checked)} /> Known SOL changes only</label></div>
    <p className={styles.caption}>{report.balanceCoverage}. Showing {rows.length} of {report.accounts.length} accounts. Values below are exact SOL conversions from supplied lamports.</p>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Account balances, scroll horizontally"><table className={styles.accountTable}><thead><tr><th>Account / position</th><th>Signer</th><th>Writable</th><th>Before · SOL</th><th>After · SOL</th><th>Change · SOL</th><th>Outer references</th></tr></thead><tbody>{rows.map(a => <tr key={a.index}><td><span className={styles.caption}>#{a.index + 1}{a.index === 0 ? ' · Fee payer position' : ''}</span><code>{a.address ?? 'Unavailable'}</code></td><td>{flag(a.signer)}</td><td>{flag(a.writable)}</td><td>{decimalAmount(a.preLamports, 9)}</td><td>{decimalAmount(a.postLamports, 9)}</td><td className={a.deltaLamports?.startsWith('-') ? styles.debit : a.deltaLamports === '0' ? '' : styles.credit}>{decimalAmount(a.deltaLamports, 9)}</td><td>{a.outerReferences.length ? a.outerReferences.join(', ') : 'Not resolved'}</td></tr>)}</tbody></table></div>
    {!rows.length && <p className={styles.empty}>No accounts match this filter.</p>}
    <p className={styles.caption}>References use explicit instruction account arrays; missing references do not prove an account was unused. Signer and writable flags are declarations, not identities or proof of writes.</p>
    <h3>Token balances</h3><p className={styles.caption}>{report.tokenCoverage}. Raw amounts avoid rounded wallet displays; no token prices or inferred symbols.</p>
    {!report.tokens.length ? <p className={styles.empty}>No token balance rows were supplied. This does not establish that no token instructions ran.</p> : <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Token balances, scroll horizontally"><table className={styles.accountTable}><thead><tr><th>Account / mint</th><th>Before · raw</th><th>After · raw</th><th>Change · token units</th></tr></thead><tbody>{report.tokens.map(t => <tr key={`${t.index}:${t.mint}`}><td><span className={styles.caption}>Account #{t.index + 1}</span><code>{t.address ?? 'Address unresolved'}</code><span className={styles.caption}>Mint</span><code>{t.mint}</code></td><td>{t.preRaw ?? 'Unavailable'}</td><td>{t.postRaw ?? 'Unavailable'}</td><td>{t.decimals == null ? 'Unavailable' : decimalAmount(t.deltaRaw, t.decimals)}{t.reason && <p className={styles.caption}>{t.reason}</p>}</td></tr>)}</tbody></table></div>}
  </section>
}
