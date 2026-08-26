/**
 * Tests for the host's authoritative clustering and quorum arithmetic: the
 * deduplication key, each quorum rule's confirmation condition, the negative
 * outcome's modal-vote tiebreak, the two-ballot floor, and the drift check
 * against the workflow script's own copy.
 */

import { describe, expect, it } from 'vitest'
import {
  applyQuorum, assertTallyAgrees, dedupeFindings, fingerprint, normalizeLocation, renderTable, tally,
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
})

describe('applyQuorum', () => {
  const counts = (confirmed: number, rejected: number, notABug: number, uncertain: number) =>
    ({ confirmed, rejected, notABug, uncertain })

  it('refuses to decide below two ballots', () => {
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

  it('requires every ballot under unanimity, and uncertainty denies it', () => {
    const unanimous: QuorumConfig = { rule: 'unanimous' }
    expect(applyQuorum(counts(3, 0, 0, 0), 3, unanimous)).toBe('confirmed')
    expect(applyQuorum(counts(2, 0, 0, 1), 3, unanimous)).toBe('rejected')
  })

  it('honours an explicit threshold, defaulting to every ballot', () => {
    expect(applyQuorum(counts(2, 1, 0, 0), 3, { rule: 'threshold', threshold: 2 })).toBe('confirmed')
    expect(applyQuorum(counts(2, 1, 0, 0), 3, { rule: 'threshold' })).toBe('rejected')
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
    expect(result.rows[1]?.votes).toEqual(['rejected', undefined])
    expect(result.rows[0]?.outcome).toBe('confirmed')
    expect(result.rows[1]?.outcome).toBe('rejected')
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

  it('accepts an identical script tally and refuses a divergent one', () => {
    const host = tally(clustered, ballots, majority)
    expect(() => { assertTallyAgrees(host, structuredClone(host)) }).not.toThrow()
    const drifted = { ...host, rows: host.rows.map(row => ({ ...row, outcome: 'confirmed' as const })) }
    expect(() => { assertTallyAgrees(host, drifted) })
      .toThrow('the script tally disagrees with the host recomputation')
  })
})
