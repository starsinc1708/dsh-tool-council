/**
 * Tests for the host's authoritative clustering and quorum arithmetic: the
 * deduplication key, the per-member cap, the merge fold, each quorum rule's
 * confirmation condition, the abstention-aware denominator, the negative
 * outcome's modal-vote tiebreak, and the drift check against the workflow
 * script's own copy.
 */

import { describe, expect, it } from 'vitest'
import {
  applyQuorum, assertTallyAgrees, capPerMember, dedupeFindings, fingerprint, mergeClusters,
  normalizeLocation, renderTable, tally,
} from '../src/tally.ts'
import type { Finding, QuorumConfig, VerifierBallot } from '../src/types.ts'

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    title: 'Greedy scoring inverted',
    location: 'rank.py:521',
    claim: 'ranks by residual entropy instead of gain',
    evidence: 'rank.py:519-524 multiplies h_cond by (1-crr)',
    severity: 'high',
    confidence: 0.8,
    fix: 'use mi_with_prefix',
    ...overrides,
  }
}

const majority: QuorumConfig = { rule: 'majority' }

describe('fingerprint', () => {
  it('is insensitive to case, punctuation, word order, and stop words', () => {
    expect(fingerprint('Greedy scoring is INVERTED!')).toBe(fingerprint('inverted, the greedy scoring'))
  })

  it('separates genuinely different headlines', () => {
    expect(fingerprint('greedy scoring inverted')).not.toBe(fingerprint('greedy scoring unbounded'))
  })
})

describe('normalizeLocation', () => {
  it('folds separators and drops a leading ./', () => {
    expect(normalizeLocation('  .\\src\\rank.py:521 ')).toBe('src/rank.py:521')
  })
})

describe('dedupeFindings', () => {
  it('clusters the same claim from different members and keeps both reporters', () => {
    const clustered = dedupeFindings([
      { by: 'correctness', finding: finding() },
      { by: 'tests', finding: finding({ title: 'Inverted greedy scoring' }) },
    ])
    expect(clustered).toHaveLength(1)
    expect(clustered[0]?.id).toBe('f1')
    expect(clustered[0]?.reportedBy).toEqual(['correctness', 'tests'])
    expect(clustered[0]?.variants).toEqual(['Greedy scoring inverted', 'Inverted greedy scoring'])
  })

  it('does not merge different claims at the same location', () => {
    const clustered = dedupeFindings([
      { by: 'correctness', finding: finding() },
      { by: 'perf-scale', finding: finding({ title: 'Quadratic rescan' }) },
    ])
    expect(clustered.map(entry => entry.id)).toEqual(['f1', 'f2'])
  })

  it('records one reporter once even when it repeats itself', () => {
    const clustered = dedupeFindings([
      { by: 'correctness', finding: finding() },
      { by: 'correctness', finding: finding() },
    ])
    expect(clustered[0]?.reportedBy).toEqual(['correctness'])
    expect(clustered[0]?.variants).toEqual(['Greedy scoring inverted'])
  })

  it('does not merge all-stop-word titles at the same location', () => {
    const clustered = dedupeFindings([
      { by: 'a', finding: finding({ title: 'The is', claim: 'first claim' }) },
      { by: 'b', finding: finding({ title: 'In on', claim: 'second claim' }) },
    ])
    expect(clustered.map(entry => entry.id)).toEqual(['f1', 'f2'])
  })
})

describe('capPerMember', () => {
  it('keeps every member inside the cap so one talkative member cannot fill the slice', () => {
    const reported = [
      { by: 'loud', finding: finding({ title: 'one' }) },
      { by: 'loud', finding: finding({ title: 'two' }) },
      { by: 'loud', finding: finding({ title: 'three' }) },
      { by: 'quiet', finding: finding({ title: 'four' }) },
    ]
    const capped = capPerMember(reported, 2)
    expect(capped.map(entry => entry.finding.title)).toEqual(['one', 'two', 'four'])
  })

  it('treats a cap of zero as disabled', () => {
    const reported = [{ by: 'a', finding: finding() }, { by: 'a', finding: finding({ title: 'x' }) }]
    expect(capPerMember(reported, 0)).toHaveLength(2)
  })
})

describe('mergeClusters', () => {
  const clustered = () => dedupeFindings([
    { by: 'correctness', finding: finding({ title: 'Greedy scoring inverted' }) },
    { by: 'tests', finding: finding({ title: 'Ranking uses residual entropy' }) },
    { by: 'perf-scale', finding: finding({ title: 'Quadratic rescan', location: 'rank.py:88' }) },
  ])

  it('folds two wordings of one defect into a single cluster and renumbers', () => {
    const list = clustered()
    expect(list).toHaveLength(3)
    const merged = mergeClusters(list, [['f1', 'f2']])
    expect(merged).toHaveLength(2)
    expect(merged[0]?.id).toBe('f1')
    expect(merged[0]?.reportedBy).toEqual(['correctness', 'tests'])
    expect(merged[0]?.variants).toEqual(['Greedy scoring inverted', 'Ranking uses residual entropy'])
    expect(merged[1]?.id).toBe('f2')
    expect(merged[1]?.title).toBe('Quadratic rescan')
  })

  it('keeps the earliest cluster as the representative whatever order the ids arrive in', () => {
    const merged = mergeClusters(clustered(), [['f2', 'f1']])
    expect(merged[0]?.title).toBe('Greedy scoring inverted')
  })

  it('ignores unknown ids and single-id groups', () => {
    const list = clustered()
    expect(mergeClusters(list, [['f9', 'f8'], ['f1'], []])).toHaveLength(3)
  })

  it('chains groups and carries every reporter to the final survivor', () => {
    // f1 ≡ f2 and f2 ≡ f3 means all three are one defect. Whichever order the
    // merge agent lists them in, nobody's report may be dropped on the way —
    // a lost reporter is a finding that silently shrinks.
    for (const groups of [[['f1', 'f2'], ['f2', 'f3']], [['f2', 'f3'], ['f1', 'f2']]]) {
      const merged = mergeClusters(clustered(), groups)
      expect(merged).toHaveLength(1)
      expect(merged[0]?.id).toBe('f1')
      expect(merged[0]?.title).toBe('Greedy scoring inverted')
      expect([...(merged[0]?.reportedBy ?? [])].sort())
        .toEqual(['correctness', 'perf-scale', 'tests'])
      expect(merged[0]?.variants).toHaveLength(3)
    }
  })
})

describe('applyQuorum', () => {
  const counts = (confirmed: number, rejected: number, notABug: number, uncertain: number) =>
    ({ confirmed, rejected, notABug, uncertain })

  it('refuses to decide below two participating ballots', () => {
    expect(applyQuorum(counts(1, 0, 0, 0), 1, majority)).toBe('insufficient')
  })

  it('confirms on a plain majority', () => {
    expect(applyQuorum(counts(2, 1, 0, 0), 3, majority)).toBe('confirmed')
  })

  it('does not let uncertainty confirm', () => {
    expect(applyQuorum(counts(1, 1, 0, 1), 3, majority)).toBe('rejected')
  })

  it('breaks a negative outcome toward the modal negative vote', () => {
    expect(applyQuorum(counts(1, 0, 2, 0), 3, majority)).toBe('not-a-bug')
    expect(applyQuorum(counts(1, 2, 0, 0), 3, majority)).toBe('rejected')
    expect(applyQuorum(counts(0, 1, 1, 0), 2, majority)).toBe('rejected')
  })

  it('requires every participating ballot under unanimity, and uncertainty leaves it insufficient', () => {
    const unanimous: QuorumConfig = { rule: 'unanimous' }
    expect(applyQuorum(counts(3, 0, 0, 0), 3, unanimous)).toBe('confirmed')
    expect(applyQuorum(counts(2, 0, 0, 1), 3, unanimous)).toBe('insufficient')
  })

  it('honours an explicit threshold, defaulting to every participating ballot', () => {
    expect(applyQuorum(counts(2, 1, 0, 0), 3, { rule: 'threshold', threshold: 2 })).toBe('confirmed')
    expect(applyQuorum(counts(2, 1, 0, 0), 3, { rule: 'threshold' })).toBe('rejected')
  })

  it('reports an unreached threshold nobody argued against as unresolved, not refuted', () => {
    // Two verifiers confirmed and a third died, so a threshold of three is not
    // met — but calling that REJECTED would invert what the two actually said.
    expect(applyQuorum(counts(2, 0, 0, 0), 2, { rule: 'threshold', threshold: 3 })).toBe('insufficient')
    // One dissenter, and the negative arm applies as usual.
    expect(applyQuorum(counts(2, 1, 0, 0), 3, { rule: 'threshold', threshold: 3 })).toBe('rejected')
  })

  it('treats an all-uncertain verdict as insufficient, not rejected', () => {
    expect(applyQuorum(counts(0, 0, 0, 2), 2, majority)).toBe('insufficient')
    expect(applyQuorum(counts(0, 0, 0, 3), 3, majority)).toBe('insufficient')
  })
})

describe('tally', () => {
  const clustered = dedupeFindings([
    { by: 'correctness', finding: finding() },
    { by: 'perf-scale', finding: finding({ title: 'Quadratic rescan', fix: '' }) },
  ])
  const ballots: VerifierBallot[] = [
    {
      verifier: 'V1',
      verdicts: [
        { findingId: 'f1', vote: 'confirmed', reason: 're-read rank.py:521' },
        { findingId: 'f2', vote: 'rejected', reason: 'the loop is bounded by k' },
      ],
    },
    {
      verifier: 'V2',
      verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: 'could not argue it away' }],
    },
  ]

  it('keeps verifier order and marks a missing verdict as an abstention', () => {
    const result = tally(clustered, ballots, majority)
    expect(result.verifiers).toEqual(['V1', 'V2'])
    expect(result.rows[0]?.votes).toEqual(['confirmed', 'confirmed'])
    expect(result.rows[1]?.votes).toEqual(['rejected', null])
    expect(result.rows[0]?.outcome).toBe('confirmed')
  })

  it('keeps an abstention out of the quorum denominator', () => {
    const result = tally(clustered, ballots, majority)
    expect(result.rows[0]?.participating).toBe(2)
    // One verifier rejected, the other said nothing at all: that is a quorum of
    // one, so the row is unresolved rather than REJECTED.
    expect(result.rows[1]?.participating).toBe(1)
    expect(result.rows[1]?.outcome).toBe('insufficient')
  })

  it('does not let one confirmation plus one silence confirm under majority', () => {
    const result = tally(clustered, [
      { verifier: 'V1', verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: 'read it' }] },
      { verifier: 'V2', verdicts: [] },
    ], majority)
    expect(result.rows[0]?.participating).toBe(1)
    expect(result.rows[0]?.outcome).toBe('insufficient')
  })

  it('ignores a verdict naming a finding that does not exist', () => {
    const result = tally(clustered, [
      { verifier: 'V1', verdicts: [{ findingId: 'f99', vote: 'confirmed', reason: 'stale id' }] },
      { verifier: 'V2', verdicts: [] },
    ], majority)
    expect(result.rows.every(row => row.counts.confirmed === 0)).toBe(true)
  })

  it('renders one table row per finding, with a column per verifier', () => {
    const table = renderTable(clustered, tally(clustered, ballots, majority))
    const lines = table.split('\n')
    expect(lines[0]).toBe('| # | Finding | Location | V1 | V2 | Outcome | Fix |')
    expect(lines).toHaveLength(4)
    expect(lines[2]).toContain('CONFIRMED')
    expect(lines[3]).toContain('| · |')
    expect(lines[3]).toContain('| — |')
  })

  it('escapes pipes and newlines in user-provided cells', () => {
    const hostile = finding({ title: 'a|b', location: 'src/x.py:1', fix: 'c|d\ne' })
    const list = dedupeFindings([{ by: 'm', finding: hostile }])
    const table = renderTable(list, tally(list, [], majority))
    expect(table).toContain('a\\|b')
    expect(table).toContain('c\\|d e')
    expect(table.split('\n')).toHaveLength(3)
  })

  it('accepts an identical script tally and names the first field of a divergent one', () => {
    const host = tally(clustered, ballots, majority)
    expect(() => { assertTallyAgrees(host, structuredClone(host)) }).not.toThrow()
    const drifted = { ...host, rows: host.rows.map(row => ({ ...row, outcome: 'confirmed' as const })) }
    expect(() => { assertTallyAgrees(host, drifted) })
      .toThrow('row 2 (f2): outcome insufficient vs confirmed')
  })

  it('names a divergent verifier column and a divergent participation count', () => {
    const host = tally(clustered, ballots, majority)
    expect(() => { assertTallyAgrees(host, { ...host, verifiers: ['V1', 'V9'] }) })
      .toThrow('verifier column 2: "V2" vs "V9"')
    const drifted = {
      ...host,
      rows: host.rows.map((row, index) => index === 1 ? { ...row, participating: 2 } : row),
    }
    expect(() => { assertTallyAgrees(host, drifted) }).toThrow('row 2 (f2): participating 1 vs 2')
  })
})
