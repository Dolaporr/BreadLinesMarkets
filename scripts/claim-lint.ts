import { readFile } from 'node:fs/promises'
import { assertiveSentences, COMMITMENT_IMPLYING, TELEMETRY_REQUIRING } from '../research/execution-casefile/audit/probes.ts'

/**
 * Holds Breadlines prose to the same standard as Breadlines code.
 *
 * The adversarial audit checks that no rendered surface asserts a claim the evidence cannot
 * support. A research memo is a surface too — arguably the one that travels furthest — so it runs
 * through the same assertion checks. Sentences carrying a negation or refusal marker are skipped,
 * because stating a boundary necessarily contains the phrase it forbids.
 *
 *   node --experimental-strip-types scripts/claim-lint.ts docs/some-memo.md [...]
 */
type Finding = { file: string; line: number; check: string; sentence: string }

/** Claims about causation that prose slips into far more easily than code does. */
const CAUSAL_PATTERNS = [
  { id: 'CAUSED', pattern: /\b(?:caused|causes|because of the|due to the|resulted from|led to the failure|is why it failed)\b/i },
  { id: 'BLAME', pattern: /\b(?:the provider (?:failed|dropped|delayed)|at fault|to blame|responsible for the failure)\b/i },
  { id: 'PERFORMANCE', pattern: /\b(?:faster than|slower than|outperform(?:s|ed)?|better latency|worse latency|more reliable than)\b/i },
  { id: 'GUARANTEE', pattern: /\b(?:guarantees? (?:inclusion|landing|ordering)|will land|ensures? that it lands)\b/i },
  { id: 'PARTNERSHIP', pattern: /\b(?:our partner|in partnership with|partnered with|official(?:ly)? (?:integrated|endorsed))\b/i },
]

/**
 * Framing that marks a sentence as DISCUSSING a claim rather than making one. Prose needs this and
 * code does not: a memo explaining a hazard has to be able to name the hazard. "The tempting
 * misread is that the first hop went through" states an error in order to reject it.
 */
/** A part of a transaction: the only subject for which "completed" implies committed state. */
const TRANSACTION_PART = /\b(?:leg|legs|hop|hops|instruction|instructions|cpi|cpis|call|calls|invocation|invocations|frame|frames|route|swap|swaps|transfer|transaction|tx|root|roots|market|markets)\b/i

const ATTRIBUTIVE = /\b(?:misread(?:ing)?|misreport|tempting|temptation|hazard|wrongly|falsely|incorrectly|mistake|mistaken|would (?:be|read|imply|mean)|reads? as|risk(?:s)? (?:reading|being)|prohibit|forbidden|guard(?:s|ed)? against|error|fallacy|conflat|over-read|must not|refus)\b/i

/**
 * Lines inside fenced code, tables and block quotes are data or quotation, not Breadlines claims.
 * Paragraphs are joined before splitting, because a markdown sentence wraps across lines and a
 * sentence cut in half loses the clause that qualifies it.
 */
function proseBlocks(markdown: string) {
  const out: Array<{ line: number; text: string }> = []
  let fenced = false
  let buffer: string[] = []
  let start = 1
  const flush = () => {
    if (buffer.length) out.push({ line: start, text: buffer.join(' ') })
    buffer = []
  }
  // A list inherits its lead-in. "Breadlines is not proposing:" followed by bullets makes every
  // bullet part of a refusal, exactly as a prohibitedInterpretations field does in the JSON probes.
  let leadIn = ''
  markdown.split('\n').forEach((raw, index) => {
    if (/^\s*```/.test(raw)) { flush(); fenced = !fenced; return }
    if (fenced) return
    const isBullet = /^\s*[-*+]\s|^\s*\d+\.\s/.test(raw)
    // An indented non-bullet line is a wrapped continuation of the bullet above it. It belongs to
    // the list and must not clear the list's lead-in for the bullets that follow.
    const isContinuation = Boolean(leadIn) && !isBullet && /^\s{2,}\S/.test(raw)
    if (isContinuation) {
      if (buffer.length) buffer.push(raw.replace(/`[^`]*`/g, ' ').replace(/"[^"]{1,80}"/g, ' ').trim())
      return
    }
    if (isBullet && leadIn) {
      if (!buffer.length) start = index + 1
      buffer.push(`${leadIn} ${raw.replace(/`[^`]*`/g, ' ').replace(/"[^"]{1,80}"/g, ' ').trim()}`)
      return
    }
    // A lead-in is the whole sentence, not just its last wrapped line: the clause that negates it
    // ("...does not unlock any of these:") is usually several lines above the colon.
    if (/:\s*$/.test(raw.trim()) && raw.trim().length > 3) {
      leadIn = [...buffer, raw.replace(/`[^`]*`/g, ' ').trim()].join(' ').trim()
      flush()
      return
    }
    if (!isBullet && raw.trim()) leadIn = ''  // a blank line between lead-in and list does not break the list
    // A heading scopes the section beneath it: "### Not established" makes its bullets refusals.
    if (/^\s*#{1,6}\s/.test(raw)) { flush(); leadIn = raw.replace(/^\s*#+\s*/, '').trim(); return }
    if (!raw.trim() || /^\s*\|/.test(raw) || /^\s*>/.test(raw)) { flush(); return }
    // Inline code and quoted spans are mentions, not uses: naming the word "completed" is not
    // claiming something completed. Stripping both leaves only the sentence's own assertions.
    const text = raw.replace(/`[^`]*`/g, ' ').replace(/"[^"]{1,80}"/g, ' ').replace(/\u201c[^\u201d]{1,80}\u201d/g, ' ')
    if (!buffer.length) start = index + 1
    buffer.push(text.trim())
  })
  flush()
  return out
}

async function lint(file: string) {
  const findings: Finding[] = []
  for (const { line, text } of proseBlocks(await readFile(file, 'utf8'))) {
    for (const sentence of assertiveSentences(text)) {
      if (ATTRIBUTIVE.test(sentence)) continue
      // The commitment confusion is specifically about a PART of a transaction reading as kept.
      // "a completed study" and "addresses that succeeded" are different senses of the same words,
      // so in prose the check requires a transaction part in scope.
      if (TRANSACTION_PART.test(sentence)) {
        for (const pattern of COMMITMENT_IMPLYING) {
          if (pattern.test(sentence)) findings.push({ file, line, check: 'COMMITMENT_IMPLIED', sentence })
        }
      }
      for (const { id, pattern } of TELEMETRY_REQUIRING) {
        if (pattern.test(sentence)) findings.push({ file, line, check: `TELEMETRY_CLAIM_${id}`, sentence })
      }
      for (const { id, pattern } of CAUSAL_PATTERNS) {
        if (pattern.test(sentence)) findings.push({ file, line, check: `PROSE_${id}`, sentence })
      }
    }
  }
  return findings
}

export async function lintFiles(files: string[]) {
  const all: Finding[] = []
  for (const file of files) all.push(...await lint(file))
  return all
}

async function main() {
  const files = process.argv.slice(2)
  if (!files.length) { console.error('usage: claim-lint.ts <markdown...>'); process.exitCode = 2; return }
  const findings = await lintFiles(files)
  for (const finding of findings) {
    console.log(`${finding.file}:${finding.line}  ${finding.check}\n    ${finding.sentence.trim().slice(0, 180)}`)
  }
  console.log(`\n${findings.length} finding(s) across ${files.length} file(s)`)
  process.exitCode = findings.length ? 1 : 0
}

if (process.argv[1]?.endsWith('claim-lint.ts')) void main()
