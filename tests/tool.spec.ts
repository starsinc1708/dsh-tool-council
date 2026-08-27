/**
 * Tests for the host's model-facing rendering and its durable record: the
 * participation summary that must not read a clean run as a dead one, the
 * promise that nothing is claimed which is not then rendered, and the
 * distinction between "fewer than two verifiers voted" and "no verify layer
 * exists".
 */

import { describe, expect, it } from 'vitest'
import {
  buildResultRecord, failureRecord, presentCall, presentResult, readArtifact, readOutcome,
  renderOutcome, stopReasonError, summaryLine,
} from '../src/tool.ts'
import { dedupeFindings, tally } from '../src/tally.ts'
import type { ClusteredFinding, Finding, Tally, VerifierBallot } from '../src/types.ts'

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

interface OutcomeOverrides {
  findings?: readonly ClusteredFinding[]
  ballots?: readonly VerifierBallot[]
  tally?: Tally | null
  report?: string
  reportMissing?: boolean
  membersReporting?: number
  membersResponding?: number
  mapMembers?: number
  stopReason?: 'completed' | 'deadline'
}

function outcome(overrides: OutcomeOverrides = {}) {
  return {
    findings: [],
    ballots: [],
    tally: null,
    report: '',
    reportMissing: false,
    membersReporting: 0,
    membersResponding: 4,
    mapMembers: 4,
    stopReason: 'completed' as const,
    ...overrides,
  }
}

const clustered = dedupeFindings([
  { by: 'correctness', finding: finding() },
  { by: 'tests', finding: finding({ title: 'Quadratic rescan', fix: '' }) },
])

const ballots: VerifierBallot[] = [
  { verifier: 'V1', verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: 'read it' }] },
  { verifier: 'V2', verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: 'read it too' }] },
]

/** The run context the record builders need, shared by every case below. */
const context = {
  runId: 'run-1',
  preset: 'bug-hunt',
  task: 'audit src/rank.py',
  layers: [{ id: 'map', kind: 'map' as const, label: 'map', width: 4 }],
  narration: { startedAt: 1_000, phases: [{ title: 'map', at: 1_100 }], messages: [] },
  stopReason: 'completed',
  agentsStarted: 8,
  durationMs: 12_000,
  maxReportChars: 32_768,
}

describe('summaryLine', () => {
  it('does not read four healthy members that found nothing as four dead ones', () => {
    // The map prompt calls an empty list "a valid and respectable answer", so
    // answering and reporting have to be counted separately.
    expect(summaryLine(outcome())).toBe('4 of 4 examining members answered; none reported a finding.')
  })

  it('separates responders from reporters when a child did die', () => {
    expect(summaryLine(outcome({ membersResponding: 3, membersReporting: 1, findings: clustered })))
      .toBe('3 of 4 examining members answered; 1 reported 2 distinct findings.')
  })

  it('adds the verifier line only when a quorum was actually run', () => {
    const table = tally(clustered, ballots, { rule: 'majority' })
    expect(summaryLine(outcome({
      findings: clustered, ballots, tally: table, membersReporting: 2,
    }))).toBe('4 of 4 examining members answered; 2 reported 2 distinct findings; '
      + '2 verifiers voted, confirming 1.')
  })
})

describe('renderOutcome', () => {
  it('renders the table and its legend on the vote path', () => {
    const table = tally(clustered, ballots, { rule: 'majority' })
    const text = renderOutcome(outcome({ findings: clustered, ballots, tally: table, report: 'the report' }), 8_000)
    expect(text).toContain('| V1 | V2 |')
    expect(text).toContain('abstention')
    expect(text).toContain('the report')
  })

  it('lists the findings when there is no table AND no report, instead of losing them', () => {
    // Otherwise the run says "N findings" and then shows none of them.
    const text = renderOutcome(outcome({
      findings: clustered, reportMissing: true, membersReporting: 2,
    }), 8_000)
    expect(text).toContain('NO REPORT')
    expect(text).toContain('Greedy scoring inverted')
    expect(text).toContain('Quadratic rescan')
  })

  it('leaves the raw list out when the synthesizer did write the report', () => {
    const text = renderOutcome(outcome({ findings: clustered, report: 'a merged document' }), 8_000)
    expect(text).toContain('a merged document')
    expect(text).not.toContain('reported by')
  })

  it('says a budgeted run is partial before showing anything', () => {
    const text = renderOutcome(outcome({ stopReason: 'deadline', report: 'partial' }), 8_000)
    expect(text.indexOf('INCOMPLETE')).toBeLessThan(text.indexOf('partial'))
  })

  it('honours the character ceiling', () => {
    const text = renderOutcome(outcome({ report: 'x'.repeat(500) }), 120)
    expect(text.length).toBe(120)
    expect(text.endsWith('… [truncated]')).toBe(true)
  })

  it('degrades to the bare marker when the ceiling is shorter than the marker itself', () => {
    // maxReportChars goes down to 1: the notice cannot fit, and the branch that
    // handles that must still return something of exactly the allowed length.
    expect(renderOutcome(outcome({ report: 'x'.repeat(50) }), 5)).toHaveLength(5)
    // The notice starts with its own newline, so a ceiling of one yields it.
    expect(renderOutcome(outcome({ report: 'x'.repeat(50) }), 1)).toBe('\n')
  })

  it('caps the rendered rows and says how many it left out', () => {
    // maxFindings goes to 10 000; materializing and escaping all of them just
    // to have bound() cut the string mid-row helps nobody.
    const many = dedupeFindings(Array.from({ length: 140 }, (_unused, index) => ({
      by: 'correctness',
      finding: finding({ title: `finding ${index}`, location: `f${index}.ts:1` }),
    })))
    const table = tally(many, ballots, { rule: 'majority' })
    const text = renderOutcome(outcome({ findings: many, ballots, tally: table }), 1_000_000)
    expect(text).toContain('Showing 100 of 140 findings')
    expect(text).toContain('| 100 |')
    expect(text).not.toContain('| 101 |')
  })
})

describe('buildResultRecord', () => {
  it('counts a finding nobody was asked about as unverified, not insufficient', () => {
    const record = buildResultRecord(outcome({ findings: clustered, report: 'r' }), context)
    expect(record.counts.unverified).toBe(2)
    expect(record.counts.insufficient).toBe(0)
    expect(record.rows.every(row => row.outcome === 'unverified')).toBe(true)
  })

  it('keeps insufficient for a quorum that was attempted and fell short', () => {
    const short: VerifierBallot[] = [
      { verifier: 'V1', verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: 'read it' }] },
      { verifier: 'V2', verdicts: [] },
    ]
    const table = tally(clustered, short, { rule: 'majority' })
    const record = buildResultRecord(outcome({ findings: clustered, ballots: short, tally: table }), context)
    expect(record.counts.insufficient).toBe(2)
    expect(record.counts.unverified).toBe(0)
    expect(record.rows[0]?.participating).toBe(1)
  })

  it('reports the script deadline as the record stop reason', () => {
    const record = buildResultRecord(outcome({ stopReason: 'deadline' }), context)
    expect(record.stopReason).toBe('deadline')
  })

  it('flags a report cut to the ceiling', () => {
    const record = buildResultRecord(
      outcome({ report: 'x'.repeat(200) }),
      { ...context, maxReportChars: 50 },
    )
    expect(record.reportTruncated).toBe(true)
    expect(record.report.length).toBe(50)
  })
})

describe('call and result cards', () => {
  it('titles a pending call with the preset and the task first line', () => {
    const view = presentCall({ task: '  audit src/rank.py\nand the tests  ', preset: 'bug-hunt' })
    expect(view).toMatchObject({ card: 'generic', title: 'council: bug-hunt — audit src/rank.py' })
  })

  it('names the default preset when the model chose none', () => {
    expect(presentCall({ task: 'x' }).title).toBe('council: default preset — x')
  })

  it('summarizes the completed call from the persisted artifact', () => {
    const artifact = buildResultRecord(
      outcome({ findings: clustered, membersReporting: 2, stopReason: 'deadline', reportMissing: true }),
      { ...context, stopReason: 'completed', durationMs: 12_400 },
    )
    const view = presentResult({ task: 'x', preset: 'bug-hunt' }, {
      content: [], isError: false, meta: artifact as never,
    })
    expect(view.title)
      .toBe('council: bug-hunt — 4/4 answered · 2 findings · 0 confirmed · 8 agents · 12s · deadline · no report')
  })

  it('recognizes an artifact only when kind and version both match', () => {
    // Presenters replay arbitrary logged results, including ones another build
    // wrote: an unrecognized payload must degrade, never throw or half-read.
    const artifact = buildResultRecord(outcome(), context)
    expect(readArtifact(artifact)).toBe(artifact)
    expect(readArtifact({ ...artifact, kind: 'something-else' })).toBeUndefined()
    expect(readArtifact({ ...artifact, version: 99 })).toBeUndefined()
    expect(readArtifact({ ...artifact, rows: 'not an array' })).toBeUndefined()
    expect(readArtifact(undefined)).toBeUndefined()
    expect(readArtifact('a string')).toBeUndefined()
  })

  it('falls back to a bare title when the metadata is absent or foreign', () => {
    // Replay of an older logged call must not throw; presenters are pure and
    // may run against metadata this build never wrote.
    expect(presentResult({ task: 'x', preset: 'bug-hunt' }, { content: [], isError: false }).title)
      .toBe('council: bug-hunt')
    expect(presentResult({ task: 'x' }, { content: [], isError: true, meta: { nope: 1 } }).title)
      .toBe('council: default preset')
  })
})

describe('readOutcome', () => {
  const good = {
    findings: [], ballots: [], tally: null, report: 'r', reportMissing: false,
    membersReporting: 1, membersResponding: 4, mapMembers: 4, stopReason: 'completed',
  }

  it('accepts the shape the script returns', () => {
    expect(readOutcome(good)).toMatchObject({ stopReason: 'completed', membersResponding: 4 })
    expect(readOutcome({ ...good, stopReason: 'deadline' }).stopReason).toBe('deadline')
  })

  it('refuses anything that is not the declared shape', () => {
    // This decoder is the structured-clone boundary: a worker that returned
    // half a result must fail loudly, not render as an empty council.
    for (const bad of [
      null, undefined, 'a string', [good],
      { ...good, findings: undefined },
      { ...good, ballots: 'not an array' },
      { ...good, report: 42 },
      { ...good, reportMissing: 'no' },
      { ...good, membersReporting: '1' },
      { ...good, membersResponding: undefined },
      { ...good, mapMembers: null },
      { ...good, stopReason: 'cancelled' },
    ]) {
      expect(() => readOutcome(bad), JSON.stringify(bad)).toThrow('malformed result')
    }
  })

  it('refuses a tally that is not an object, but accepts a null one', () => {
    expect(readOutcome({ ...good, tally: null }).tally).toBeNull()
    expect(() => readOutcome({ ...good, tally: 'table' })).toThrow('malformed tally')
    expect(() => readOutcome({ ...good, tally: [] })).toThrow('malformed tally')
  })
})

describe('stopReasonError', () => {
  it('passes a clean completion through', () => {
    expect(stopReasonError({ value: null, stopReason: 'completed', agentsStarted: 8 })).toBeUndefined()
  })

  it('names a cancellation, with the reason when the engine gave one', () => {
    expect(stopReasonError({ value: null, stopReason: 'cancelled', agentsStarted: 3 }))
      .toBe('council run was cancelled')
    expect(stopReasonError({ value: null, stopReason: 'cancelled', error: 'maxRunMs', agentsStarted: 3 }))
      .toBe('council run was cancelled (maxRunMs)')
  })

  it('names a failure, and does not pretend to know one it was not told', () => {
    expect(stopReasonError({ value: null, stopReason: 'error', error: 'worker died', agentsStarted: 1 }))
      .toBe('council run failed: worker died')
    expect(stopReasonError({ value: null, stopReason: 'error', agentsStarted: 1 }))
      .toBe('council run failed: unknown error')
  })
})

describe('failureRecord', () => {
  it('closes a run that produced nothing, carrying the failure into the tab', () => {
    const record = failureRecord({
      runId: 'run-1',
      preset: 'bug-hunt',
      task: 'audit src/rank.py',
      layers: [],
      narration: { startedAt: 1_000, phases: [], messages: [] },
      stopReason: 'error',
      error: 'worker died',
      agentsStarted: 5,
      durationMs: 900,
    })
    expect(record).toMatchObject({
      preset: 'bug-hunt', stopReason: 'error', error: 'worker died', agentsStarted: 5, durationMs: 900,
      reportMissing: true, rowsTruncated: false, reportTruncated: false,
    })
    expect(record.counts).toEqual({ findings: 0, confirmed: 0, rejected: 0, notABug: 0, insufficient: 0, unverified: 0 })
    expect(record.rows).toEqual([])
    expect(record.report).toBe('')
  })
})
