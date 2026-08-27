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
 * @module @starsinc1708/dsh-tool-council
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

/**
 * Cap how many findings one member contributes before clustering.
 *
 * Without it a single talkative member fills `maxFindings` and the quieter
 * members' claims never reach the slice — the cap has to bite per member, not
 * only on the merged list.
 * @param reported - every map-layer finding, in stable child order.
 * @param perMember - the ceiling per reporting instance; `0` disables the cap.
 * @returns the same list with each member's tail beyond `perMember` dropped.
 */
export function capPerMember(
  reported: readonly ReportedFinding[],
  perMember: number,
): ReportedFinding[] {
  if (perMember <= 0) return [...reported]
  const seen = new Map<string, number>()
  const kept: ReportedFinding[] = []
  for (const entry of reported) {
    const count = seen.get(entry.by) ?? 0
    if (count >= perMember) continue
    seen.set(entry.by, count + 1)
    kept.push(entry)
  }
  return kept
}

/**
 * Fold the merge layer's id groups into the clustered list.
 *
 * A group names ids that describe ONE defect in different words. The
 * earliest-reported cluster in the group absorbs the others' reporters and
 * title variants; ids are then reassigned `f1…fn` in first-seen order, because
 * a finding id is a run-local table coordinate and a gap in it would read as a
 * dropped row.
 *
 * Groups CHAIN: a cluster absorbed by one group may be named again by a later
 * one, so each id is resolved to its current survivor before merging and an
 * absorbed survivor hands over everything it had already absorbed. Without that
 * hand-over, `[[f2,f3],[f1,f2]]` would silently lose f3's reporter — the exact
 * kind of quiet deletion the merge step must never do.
 * @param clustered - the deterministic clusters, in first-seen order.
 * @param groups - id groups to fold; unknown ids and already-joined groups are ignored.
 * @returns the folded clusters, renumbered in first-seen order.
 */
export function mergeClusters(
  clustered: readonly ClusteredFinding[],
  groups: readonly (readonly string[])[],
): ClusteredFinding[] {
  const order = new Map(clustered.map((finding, index) => [finding.id, index] as const))
  const byId = new Map(clustered.map(finding => [finding.id, finding] as const))
  /** Absorbed id -> the id that absorbed it. */
  const absorbedBy = new Map<string, string>()
  const extra = new Map<string, { reportedBy: string[]; variants: string[] }>()
  const rootOf = (id: string): string => {
    let current = id
    while (absorbedBy.has(current)) current = absorbedBy.get(current) as string
    return current
  }
  for (const group of groups) {
    const roots = [...new Set(group.filter(id => byId.has(id)).map(rootOf))]
    if (roots.length < 2) continue
    // Keep the earliest cluster in report order, not the order the merge agent
    // happened to list: the representative must stay the one the verifiers were
    // shown when the deterministic pass quoted it.
    const sorted = roots.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    const [survivor, ...absorbed] = sorted
    /* v8 ignore next -- length >= 2 was checked above. */
    if (survivor === undefined) continue
    const bucket = extra.get(survivor) ?? { reportedBy: [], variants: [] }
    for (const id of absorbed) {
      absorbedBy.set(id, survivor)
      const source = byId.get(id)
      /* v8 ignore next -- roots are drawn from ids filtered against byId. */
      if (source === undefined) continue
      const inherited = extra.get(id) ?? { reportedBy: [], variants: [] }
      extra.delete(id)
      for (const by of [...source.reportedBy, ...inherited.reportedBy]) {
        if (!bucket.reportedBy.includes(by)) bucket.reportedBy.push(by)
      }
      for (const variant of [...source.variants, ...inherited.variants]) {
        if (!bucket.variants.includes(variant)) bucket.variants.push(variant)
      }
    }
    extra.set(survivor, bucket)
  }
  if (absorbedBy.size === 0) return [...clustered]
  return clustered
    .filter(finding => !absorbedBy.has(finding.id))
    .map((finding, index) => {
      const bucket = extra.get(finding.id)
      const reportedBy = [...finding.reportedBy]
      const variants = [...finding.variants]
      if (bucket !== undefined) {
        for (const by of bucket.reportedBy) if (!reportedBy.includes(by)) reportedBy.push(by)
        for (const variant of bucket.variants) if (!variants.includes(variant)) variants.push(variant)
      }
      return { ...finding, id: `f${index + 1}`, reportedBy, variants }
    })
}

/**
 * Refuse a clustered list the script's own copy could not have produced.
 *
 * The tally guard recomputes the quorum but takes the CLUSTERING on trust, so a
 * drift between the two copies of `dedupeFindings`/`mergeClusters` — or a
 * corrupted payload across the structured-clone boundary — would change which
 * findings a reader acts on with nothing to catch it. The host cannot recompute
 * the clustering itself without carrying the whole raw finding list across the
 * boundary (roughly doubling the payload), so it checks the invariants the
 * clustering guarantees instead: contiguous ids in report order, one cluster
 * per location+fingerprint key, and reporter/variant lists that are non-empty
 * and duplicate-free. Drift that *changes* the key or the ordering is caught
 * here; drift that produces a differently-but-validly clustered list is caught
 * by the parity test the two copies share in CI.
 * @param clusters - the clustered findings the script returned.
 * @throws Error naming the first violated invariant.
 */
export function assertClustersWellFormed(clusters: readonly ClusteredFinding[]): void {
  const refuse = (why: string): never => {
    throw new Error(`council: the workflow returned malformed clusters — ${why}`)
  }
  const keys = new Set<string>()
  for (const [index, cluster] of clusters.entries()) {
    const where = `finding ${index + 1}`
    if (cluster.id !== `f${index + 1}`) refuse(`${where} has id "${cluster.id}", expected "f${index + 1}"`)
    const fp = fingerprint(cluster.title)
    const key = `${normalizeLocation(cluster.location)}|${fp === '' ? cluster.title.toLowerCase().trim() : fp}`
    if (keys.has(key)) refuse(`${where} (${cluster.id}) repeats an earlier location+title key`)
    keys.add(key)
    if (cluster.reportedBy.length === 0) refuse(`${where} (${cluster.id}) has no reporter`)
    if (new Set(cluster.reportedBy).size !== cluster.reportedBy.length) {
      refuse(`${where} (${cluster.id}) lists a reporter twice`)
    }
    if (!cluster.variants.includes(cluster.title)) {
      refuse(`${where} (${cluster.id}) does not list its own title among its variants`)
    }
    if (new Set(cluster.variants).size !== cluster.variants.length) {
      refuse(`${where} (${cluster.id}) lists a title variant twice`)
    }
  }
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
 * `participating` is the number of ballots that returned a verdict FOR THIS
 * FINDING, not the number of ballots the layer collected: a verifier that
 * answered nothing about a finding abstained on it, and counting that silence
 * in the denominator would make one confirmation plus one abstention read as a
 * quorum of two. Below two participating ballots the outcome is `insufficient`.
 *
 * `uncertain` never confirms: it only denies unanimity. When the rule does not
 * confirm, the modal negative vote decides between `not-a-bug` (the fact holds
 * but is not a defect) and `rejected` (the claim itself is wrong) — a
 * distinction that changes the follow-up action, so it must survive the tally.
 * With no negative vote at all the outcome is `insufficient` rather than
 * `rejected`: a `threshold` of three that only two verifiers reached is
 * unresolved, not refuted, and reporting it as refuted would invert what the
 * verifiers actually said.
 * @param counts - the vote counts for one finding.
 * @param participating - how many ballots voted on THIS finding.
 * @param quorum - the layer's rule and, for `threshold`, its required count.
 * @returns the finding's outcome; `insufficient` when the bar was not met and nobody objected.
 */
export function applyQuorum(counts: Counts, participating: number, quorum: QuorumConfig): Outcome {
  if (participating < 2) return 'insufficient'
  const confirmed = (() => {
    switch (quorum.rule) {
      case 'majority':
        return counts.confirmed > counts.rejected + counts.notABug
      case 'unanimous':
        return counts.confirmed === participating
      case 'threshold':
        return counts.confirmed >= (quorum.threshold ?? participating)
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
 * visible in the report instead of being read as agreement, and its silence
 * stays out of that row's quorum denominator. (`null`, not `undefined`: the
 * workflow engine's result materializer rejects `undefined` as non-JSON data.)
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
    const participating = counts.confirmed + counts.rejected + counts.notABug + counts.uncertain
    return {
      findingId: finding.id,
      votes,
      counts,
      participating,
      outcome: applyQuorum(counts, participating, quorum),
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
 * The legend the verdict table needs to be read correctly — in particular that
 * `·` is an abstention that does not count toward the quorum.
 */
export const TABLE_LEGEND = '✅ confirmed · ❌ rejected · ➖ not a bug · ❔ uncertain · '
  + '"·" no verdict returned (abstention). A quorum counts only the verifiers who voted on that '
  + 'row. INSUFFICIENT means unresolved, not refuted: the rule was not met and nobody argued '
  + 'against the finding — either fewer than two verifiers voted on it, or those who did could '
  + 'not reach the bar the rule sets.'

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
 * Name the first field on which two tallies disagree.
 * @param expected - the host's recomputation.
 * @param actual - the tally the script returned.
 * @returns the divergence description, or undefined when the two agree.
 */
function firstDivergence(expected: Tally, actual: Tally): string | undefined {
  if (expected.verifiers.length !== actual.verifiers.length) {
    return `verifier count ${expected.verifiers.length} vs ${actual.verifiers.length}`
  }
  for (const [index, verifier] of expected.verifiers.entries()) {
    if (verifier !== actual.verifiers[index]) {
      return `verifier column ${index + 1}: "${verifier}" vs "${String(actual.verifiers[index])}"`
    }
  }
  if (expected.rows.length !== actual.rows.length) {
    return `row count ${expected.rows.length} vs ${actual.rows.length}`
  }
  for (const [index, row] of expected.rows.entries()) {
    const other = actual.rows[index]
    /* v8 ignore next -- row counts were compared above. */
    if (other === undefined) return `row ${index + 1}: missing`
    const where = `row ${index + 1} (${row.findingId})`
    if (row.findingId !== other.findingId) return `${where}: findingId "${other.findingId}"`
    if (row.votes.length !== other.votes.length) {
      return `${where}: vote count ${row.votes.length} vs ${other.votes.length}`
    }
    for (const [column, vote] of row.votes.entries()) {
      if (vote !== other.votes[column]) {
        return `${where}: vote ${column + 1} ${String(vote)} vs ${String(other.votes[column])}`
      }
    }
    for (const key of ['confirmed', 'rejected', 'notABug', 'uncertain'] as const) {
      if (row.counts[key] !== other.counts[key]) {
        return `${where}: counts.${key} ${row.counts[key]} vs ${other.counts[key]}`
      }
    }
    if (row.participating !== other.participating) {
      return `${where}: participating ${row.participating} vs ${other.participating}`
    }
    if (row.outcome !== other.outcome) return `${where}: outcome ${row.outcome} vs ${other.outcome}`
  }
  return undefined
}

/**
 * Compare a script-produced tally against the host's own recomputation.
 *
 * The script's tally crosses a structured-clone boundary and is therefore data,
 * not a result the host may trust. Any divergence means the two copies of the
 * quorum logic have drifted, which would silently change which findings a
 * reviewer acts on — so the message names the first field that differs rather
 * than only reporting that something did.
 * @param expected - the host's recomputation from the raw ballots.
 * @param actual - the tally the workflow script returned.
 * @throws Error when column order, row order, votes, counts, or outcomes differ.
 */
export function assertTallyAgrees(expected: Tally, actual: Tally): void {
  const divergence = firstDivergence(expected, actual)
  if (divergence !== undefined) {
    throw new Error(`council: the script tally disagrees with the host recomputation — ${divergence}`)
  }
}
