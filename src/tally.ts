/**
 * Pure deduplication and quorum arithmetic — the host's authoritative copy.
 *
 * The workflow script runs the same logic inside its worker, because the
 * verify layer needs deduplicated findings *during* the run and the script
 * cannot import this module. The host then recomputes from the raw ballots and
 * refuses a run whose script-side tally disagrees. The duplication is
 * deliberate and follows `dsh-tool-ralph`, which likewise validates its
 * structured handoff on both sides of the realm boundary; this copy is the one
 * the coverage gate exercises.
 *
 * @module @deepseek-ai/dsh-tool-council
 */

import type {
  ClusteredFinding, Finding, Outcome, QuorumConfig, Tally, TallyRow, VerifierBallot, Vote,
} from './types.ts'

/** Tokens dropped before fingerprinting a title; they carry no discriminating signal. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'in', 'on', 'of', 'to', 'for', 'and', 'or', 'not',
  'не', 'в', 'на', 'и', 'или', 'по', 'из', 'что', 'это',
])

/**
 * Reduce a headline to an order-insensitive token signature.
 * @param title - the finding's headline, in any case or word order.
 * @returns sorted, deduplicated, stop-word-free lowercase tokens joined by `-`.
 */
export function fingerprint(title: string): string {
  const tokens = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(token => token.length > 0 && !STOP_WORDS.has(token))
  return [...new Set(tokens)].sort().join('-')
}

/**
 * Normalize a location so `./src/rank.py:521` and `src/rank.py:521` cluster.
 * @param location - the reported path, optionally suffixed with `:line`.
 * @returns the path without a leading `./`, with backslashes folded to `/`.
 */
export function normalizeLocation(location: string): string {
  return location.trim().replace(/\\/gu, '/').replace(/^\.\//u, '')
}

/** A finding tagged with the role instance that reported it. */
export interface ReportedFinding {
  readonly by: string
  readonly finding: Finding
}

/**
 * Cluster findings that name the same location and the same claim.
 *
 * The surviving representative is the first-seen member, because it is the one
 * the verify layer's prompt already quoted when the script deduplicated. Later
 * members contribute only their reporter and their title variant.
 * @param reported - every map-layer finding, in stable child order.
 * @returns one cluster per distinct `location|fingerprint` pair, first-seen order.
 */
export function dedupeFindings(reported: readonly ReportedFinding[]): ClusteredFinding[] {
  const clusters = new Map<string, {
    finding: Finding
    reportedBy: string[]
    variants: string[]
  }>()
  for (const { by, finding } of reported) {
    const fp = fingerprint(finding.title)
    const titleKey = fp === '' ? finding.title.toLowerCase().trim() : fp
    const key = `${normalizeLocation(finding.location)}|${titleKey}`
    const existing = clusters.get(key)
    if (existing === undefined) {
      clusters.set(key, { finding, reportedBy: [by], variants: [finding.title] })
      continue
    }
    if (!existing.reportedBy.includes(by)) existing.reportedBy.push(by)
    if (!existing.variants.includes(finding.title)) existing.variants.push(finding.title)
  }
  return [...clusters.values()].map((cluster, index) => ({
    ...cluster.finding,
    id: `f${index + 1}`,
    reportedBy: cluster.reportedBy,
    variants: cluster.variants,
  }))
}

/** Vote counts for one finding. */
interface Counts {
  confirmed: number
  rejected: number
  notABug: number
  uncertain: number
}

/**
 * Apply one quorum rule to one finding's counts.
 *
 * `uncertain` never confirms: it only denies unanimity. When the rule does not
 * confirm, the modal negative vote decides between `not-a-bug` (the fact holds
 * but is not a defect) and `rejected` (the claim itself is wrong) — a
 * distinction that changes the follow-up action, so it must survive the tally.
 * @param counts - the vote counts for one finding.
 * @param ballots - how many verifier ballots the layer actually collected.
 * @param quorum - the layer's rule and, for `threshold`, its required count.
 * @returns the finding's outcome, or `insufficient` below two ballots.
 */
export function applyQuorum(counts: Counts, ballots: number, quorum: QuorumConfig): Outcome {
  if (ballots < 2) return 'insufficient'
  const confirmed = (() => {
    switch (quorum.rule) {
      case 'majority':
        return counts.confirmed > counts.rejected + counts.notABug
      case 'unanimous':
        return counts.confirmed === ballots
      case 'threshold':
        return counts.confirmed >= (quorum.threshold ?? ballots)
    }
  })()
  if (confirmed) return 'confirmed'
  // All-uncertain (or all-abstained) is not a negative verdict: with no
  // rejected and no not-a-bug, "could not verify" must not be reported as
  // "the claim is false".
  if (counts.rejected === 0 && counts.notABug === 0) return 'insufficient'
  return counts.notABug > counts.rejected ? 'not-a-bug' : 'rejected'
}

/**
 * Build the verdict table from the verify layer's ballots.
 *
 * A verifier that returned no verdict for a finding contributes `null` to that
 * row rather than a silent abstention, so a partially answered ballot is
 * visible in the report instead of being read as agreement. (`null`, not
 * `undefined`: the workflow engine's result materializer rejects `undefined`
 * as non-JSON data.)
 * @param findings - the deduplicated findings, in report order.
 * @param ballots - one entry per surviving verifier instance, in layer order.
 * @param quorum - the verify layer's quorum policy.
 * @returns the column headers and one row per finding.
 */
export function tally(
  findings: readonly ClusteredFinding[],
  ballots: readonly VerifierBallot[],
  quorum: QuorumConfig,
): Tally {
  const byVerifier = ballots.map(ballot => new Map(
    ballot.verdicts.map(verdict => [verdict.findingId, verdict.vote] as const),
  ))
  const rows: TallyRow[] = findings.map((finding) => {
    const votes = byVerifier.map(map => map.get(finding.id) ?? null)
    const counts: Counts = { confirmed: 0, rejected: 0, notABug: 0, uncertain: 0 }
    for (const vote of votes) {
      if (vote === 'confirmed') counts.confirmed += 1
      else if (vote === 'rejected') counts.rejected += 1
      else if (vote === 'not-a-bug') counts.notABug += 1
      else if (vote === 'uncertain') counts.uncertain += 1
    }
    return {
      findingId: finding.id,
      votes,
      counts,
      outcome: applyQuorum(counts, ballots.length, quorum),
    }
  })
  return { verifiers: ballots.map(ballot => ballot.verifier), rows }
}

const VOTE_MARK: Record<Vote, string> = {
  'confirmed': '✅',
  'rejected': '❌',
  'not-a-bug': '➖',
  'uncertain': '❔',
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  'confirmed': 'CONFIRMED',
  'rejected': 'REJECTED',
  'not-a-bug': 'NOT A BUG',
  'insufficient': 'INSUFFICIENT',
}

/**
 * Render the tally as a Markdown table for the parent model and the report.
 * @param findings - the deduplicated findings, in report order.
 * @param result - the tally produced by {@link tally} over the same findings.
 * @returns a Markdown table, one row per finding, one column per verifier.
 */
export function renderTable(findings: readonly ClusteredFinding[], result: Tally): string {
  const header = ['#', 'Finding', 'Location', ...result.verifiers, 'Outcome', 'Fix']
  const divider = header.map(() => '---')
  const body = findings.map((finding, index) => {
    const row = result.rows[index]
    /* v8 ignore next -- tally() emits one row per finding; a mismatch is a caller bug. */
    if (row === undefined) throw new Error(`council: no tally row for finding ${finding.id}`)
    return [
      String(index + 1),
      cell(finding.title),
      cell(finding.location),
      ...row.votes.map(vote => vote === null ? '·' : VOTE_MARK[vote]),
      OUTCOME_LABEL[row.outcome],
      finding.fix === '' ? '—' : cell(finding.fix),
    ]
  })
  return [header, divider, ...body].map(cells => `| ${cells.join(' | ')} |`).join('\n')
}

/** Escape a user-provided table cell so `|` and newlines cannot break the Markdown table. */
function cell(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ')
}

/**
 * Compare a script-produced tally against the host's own recomputation.
 *
 * The script's tally crosses a structured-clone boundary and is therefore data,
 * not a result the host may trust. Any divergence means the two copies of the
 * quorum logic have drifted, which would silently change which findings a
 * reviewer acts on.
 * @param expected - the host's recomputation from the raw ballots.
 * @param actual - the tally the workflow script returned.
 * @throws Error when column order, row order, votes, counts, or outcomes differ.
 */
export function assertTallyAgrees(expected: Tally, actual: Tally): void {
  const render = (value: Tally): string => JSON.stringify(value)
  if (render(expected) !== render(actual)) {
    throw new Error('council: the script tally disagrees with the host recomputation')
  }
}
