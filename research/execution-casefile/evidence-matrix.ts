/**
 * The evidence matrix: five layers of execution evidence, and what each is worth.
 *
 * This is the single source of truth. The research memo renders its table from this file and the
 * viewer reads the same rows, so prose and code cannot drift apart. Editing a boundary here
 * changes every surface at once, which is the point.
 */
export const EVIDENCE_MATRIX_VERSION = 'breadlines-evidence-matrix-v1' as const

export type EvidenceLayer = {
  id: 'SIMULATION' | 'SENDER_TRACE' | 'PRECONFIRMATION' | 'LANDED_RECEIPT' | 'FINALIZED_OUTCOME'
  name: string
  /** The strongest attestation class this layer can reach at its best. */
  ceiling: 'CLIENT_OBSERVED' | 'PROVIDER_REPORTED' | 'VALIDATOR_ATTESTED' | 'CHAIN_PROVEN'
  canProve: string[]
  cannotProve: string[]
  /** What later evidence overrides this layer, and how. */
  supersededBy: string[]
}

export const EVIDENCE_MATRIX: EvidenceLayer[] = [
  {
    id: 'SIMULATION',
    name: 'Simulation',
    ceiling: 'CLIENT_OBSERVED',
    canProve: [
      'That the transaction executed a particular way against one node\'s chosen state, at the moment that node ran it.',
      'That a program returned a specific error under those conditions, which is often enough to find a construction bug.',
      'An approximate compute consumption under that state.',
    ],
    cannotProve: [
      'That the same result will occur on chain. Simulation runs against a state that has already moved on.',
      'That the transaction will be included, or included in any particular slot.',
      'Anything about fees actually charged, or about commitment.',
    ],
    supersededBy: [
      'Any landed receipt. A receipt showing a different outcome does not make the simulation wrong; it makes it stale, and only the receipt describes what happened.',
    ],
  },
  {
    id: 'SENDER_TRACE',
    name: 'Sender submission trace',
    ceiling: 'CLIENT_OBSERVED',
    canProve: [
      'That this application built, signed and attempted to send a specific message, in a specific order, on one named clock domain.',
      'How many send attempts it made and what each call returned to it.',
      'That a message was rebuilt, and which revision replaced which.',
    ],
    cannotProve: [
      'That any packet left the machine, reached a provider, or reached a leader.',
      'That a response time measures anything about the network rather than the local process.',
      'That an unobserved receipt means the transaction was dropped. Unobserved is unobserved.',
    ],
    supersededBy: [
      'A landed receipt, which can show a signature the sender never observed a response for.',
      'A finalized receipt for a different revision, which retires the assumption that the last attempt is the one that mattered.',
    ],
  },
  {
    id: 'PRECONFIRMATION',
    name: 'Preconfirmation / pre-inclusion evidence',
    ceiling: 'VALIDATOR_ATTESTED',
    canProve: [
      'That an identified party made a specific statement about this transaction at a time on a stated clock.',
      'With a VERIFIED signature over a described payload: that the holder of a named key committed to that statement. This is the only pre-inclusion fact that survives the issuer denying it later.',
      'What the issuer said it would do, and the deadline it attached.',
    ],
    cannotProve: [
      'That the transaction landed, executed, or committed anything. It is a statement about the future.',
      'That the named slot is where the transaction will appear.',
      'That the issuer had the ability to keep the promise, or that any other party was bound by it.',
      'Anything about position relative to other transactions, unless the attested payload itself describes ordering and is verified.',
      'Latency or delay of any party, from any difference between its timestamps and the sender\'s.',
    ],
    supersededBy: [
      'A landed receipt, which is the only thing that converts the promise into an outcome. A preconfirmation followed by no receipt is not a broken promise on the evidence alone — it is an unresolved one.',
      'A receipt in a different slot than the one asserted, which contradicts the slot claim while leaving the statement itself accurately recorded.',
    ],
  },
  {
    id: 'LANDED_RECEIPT',
    name: 'Landed transaction receipt',
    ceiling: 'CHAIN_PROVEN',
    canProve: [
      'That the transaction was included in a specific slot, and whether execution succeeded or was rejected.',
      'The fee charged, compute consumed, and the program frame that returned the rejection where logs establish one.',
      'That the transaction committed as one atomic unit, or committed nothing but its fee.',
    ],
    cannotProve: [
      'When it was submitted, which path carried it, or when any leader received it.',
      'Its position in any scheduler, or that it was late, early, or ordered behind anything.',
      'That nearby transactions sharing writable accounts contended with it, or caused its result.',
      'That a different fee, route or provider would have changed the outcome.',
      'That an instruction reached before the rejection committed anything.',
    ],
    supersededBy: [
      'Finalization. A receipt read at processed or confirmed commitment can still be reorganised away.',
    ],
  },
  {
    id: 'FINALIZED_OUTCOME',
    name: 'Finalized ledger outcome',
    ceiling: 'CHAIN_PROVEN',
    canProve: [
      'That the recorded outcome is settled and will not be reorganised.',
      'Everything the landed receipt proves, now durable.',
    ],
    cannotProve: [
      'Anything the landed receipt could not prove. Finalization settles the outcome, not its causes.',
      'That the path taken was good, bad, fast or slow.',
    ],
    supersededBy: [
      'Nothing on the ledger. This is the terminal layer; later evidence can only add context around it, never overturn it.',
    ],
  },
]

/** The layers, weakest to strongest, as an ordering for display. */
export const LAYER_ORDER = EVIDENCE_MATRIX.map((layer) => layer.id)

export function layer(id: EvidenceLayer['id']) {
  const found = EVIDENCE_MATRIX.find((entry) => entry.id === id)
  if (!found) throw new Error(`Unknown evidence layer ${id}`)
  return found
}

/** Renders the matrix as Markdown so the memo cannot drift from the code. */
export function matrixMarkdown() {
  return [
    '| Layer | Strongest class | Can prove | Cannot prove | Superseded by |',
    '| --- | --- | --- | --- | --- |',
    ...EVIDENCE_MATRIX.map((entry) => [
      '',
      entry.name,
      `\`${entry.ceiling}\``,
      entry.canProve.map((line) => `- ${line}`).join('<br>'),
      entry.cannotProve.map((line) => `- ${line}`).join('<br>'),
      entry.supersededBy.map((line) => `- ${line}`).join('<br>'),
      '',
    ].join(' | ').trim()),
  ].join('\n')
}
