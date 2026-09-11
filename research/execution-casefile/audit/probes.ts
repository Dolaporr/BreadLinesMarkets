/**
 * Semantic probes. These do not check that a word is absent — a prohibition necessarily contains
 * the phrase it forbids. They check that no ASSERTIVE sentence makes a claim the evidence cannot
 * support, and that each surface which shows execution reach also discloses commitment.
 */

/** Markers that turn a sentence into a boundary, refusal or requirement rather than a claim. */
const PROHIBITIVE = /\b(?:not|never|cannot|can't|does not|do not|don't|without|unavailable|unknown|undetermined|refuse[sd]?|prohibit(?:ed|s)?|forbid(?:den|s)?|would (?:be )?required|requires?|needed to answer|minimum evidence|no )\b/i

export function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function assertiveSentences(text: string) {
  return sentences(text).filter((s) => !PROHIBITIVE.test(s))
}

/** A positive claim that state was kept, in any of its everyday phrasings. */
export const COMMITMENT_IMPLYING = [
  /\bcompleted\b/i,
  /\bsucceeded\b/i,
  /\bwent through\b/i,
  /\b(?:was|were|got) (?:settled|applied|finalized|filled)\b/i,
  /\bpartially (?:executed|committed|applied|settled|filled)\b/i,
  /\bhalf[-\s]?(?:executed|committed|filled)\b/i,
  /\b(?:first|second|earlier|initial) (?:leg|hop|instruction|swap)\b/i,
  /\bup to (?:that|the failing) point\b/i,
]

/** Claims requiring telemetry the ledger does not carry. */
export const TELEMETRY_REQUIRING = [
  { id: 'LATENESS', pattern: /\b(?:too late|arrived late|was late|got there late|showed up late|latency caused)\b/i },
  { id: 'ORDERING', pattern: /\b(?:ordered behind|sequenced behind|front[-\s]?ran|front[-\s]?run|sandwiched|lost the race|beaten to it|outraced|won the race)\b/i },
  { id: 'CONTENTION', pattern: /\b(?:contention|contended|locked out|blocked by|competed for|took the (?:liquidity|opportunity)|state changed under)\b/i },
  { id: 'PROVIDER', pattern: /\b(?:provider (?:fault|failure|dropped|delayed)|dropped (?:it|the tx)|rpc (?:fault|dropped)|would have landed|better route|should have used)\b/i },
]

export type Violation = { check: string; surface: string; detail: string; text: string }

/**
 * Walks Breadlines-authored strings only. Raw receipts and verbatim program logs are chain
 * transcription, not Breadlines claims, so they are collected separately and never scanned for
 * claim vocabulary — `Program X success` is what the log says.
 */
export function authoredStrings(value: unknown, skipKeys: string[], path = '$'): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((v, i) => authoredStrings(v, skipKeys, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) =>
      skipKeys.includes(key) ? [] : authoredStrings(v, skipKeys, `${path}.${key}`))
  }
  return []
}

/**
 * Some containers make every entry prohibitive by virtue of the field they sit in: an item in
 * `prohibitedInterpretations` is a thing you must not conclude, and needs no negation of its own.
 * A claim smuggled into one of these would be a real defect, so the list stays deliberately short
 * and names only fields whose contract is refusal or requirement.
 */
const PROHIBITIVE_CONTAINERS = [
  'prohibitedInterpretations', 'prohibitedExpansion', 'limitations', 'limitation',
  'boundary', 'attributionBoundary', 'neededToAnswer', 'minimumEvidence', 'required',
  'missingTelemetry', 'failureUnknowns', 'telemetryRequirements', 'reason',
]

export function isProhibitiveContainer(path: string) {
  return PROHIBITIVE_CONTAINERS.some((key) => path.includes(`.${key}`))
}

export function scanAssertions(
  surface: string,
  entries: Array<{ path: string; text: string }>,
  options: { commitmentApplies: boolean } = { commitmentApplies: true },
): Violation[] {
  const out: Violation[] = []
  for (const { path, text } of entries) {
    if (isProhibitiveContainer(path)) continue
    for (const sentence of assertiveSentences(text)) {
      // On a committed transaction, reach and commitment coincide, so "completed" is accurate
      // rather than misleading. The confusion this check exists for only arises on a failure.
      if (options.commitmentApplies) for (const pattern of COMMITMENT_IMPLYING) {
        if (pattern.test(sentence)) {
          out.push({ check: 'COMMITMENT_IMPLIED', surface, detail: path, text: sentence })
        }
      }
      for (const { id, pattern } of TELEMETRY_REQUIRING) {
        if (pattern.test(sentence)) {
          out.push({ check: `TELEMETRY_CLAIM_${id}`, surface, detail: path, text: sentence })
        }
      }
    }
  }
  return out
}

/** Does this surface, on its own, tell the reader what committed? */
export function disclosesCommitment(text: string) {
  return /\bcommitt?(?:ed|ment)\b/i.test(text) && /\b(?:nothing|none|not committed|rolled back|one unit|atomic)\b/i.test(text)
}
