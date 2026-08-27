/**
 * Tests for the Council tab's pure halves: the Markdown exporter and the cell
 * escaping it shares with the host renderer. These are the parts a viewer
 * copies out and pastes somewhere else, so a broken table here travels.
 *
 * The React tree itself is not exercised — that needs a DOM harness this
 * package does not carry — but everything it renders from is.
 */

import { describe, expect, it } from 'vitest'
import { toMarkdown } from '../src/client/council-view.tsx'
import { en } from '../src/client/locales.ts'
import type { CouncilKey } from '../src/client/locales.ts'
import type { CouncilResultRecord, CouncilResultRow } from '../src/types.ts'

/** The locale binder the client injects, with the same `{name}` interpolation. */
function translate(key: CouncilKey, args: Record<string, unknown> = {}): string {
  return en[key].replace(/\{(\w+)\}/gu, (whole, name: string) =>
    Object.hasOwn(args, name) ? String(args[name]) : whole)
}

function row(overrides: Partial<CouncilResultRow> = {}): CouncilResultRow {
  return {
    findingId: 'f1',
    title: 'Greedy scoring inverted',
    location: 'rank.py:521',
    severity: 'high',
    votes: ['confirmed', 'rejected'],
    participating: 2,
    outcome: 'confirmed',
    fix: 'use mi_with_prefix',
    ...overrides,
  }
}

function record(overrides: Partial<CouncilResultRecord> = {}): CouncilResultRecord {
  return {
    kind: 'council-run',
    version: 1,
    runId: 'run-1',
    task: 'audit src/rank.py',
    startedAt: 1_000,
    layers: [],
    phases: [],
    messages: [],
    preset: 'bug-hunt',
    stopReason: 'completed',
    agentsStarted: 8,
    durationMs: 12_000,
    membersReporting: 2,
    membersResponding: 4,
    mapMembers: 4,
    reportMissing: false,
    counts: { findings: 1, confirmed: 1, rejected: 0, notABug: 0, insufficient: 0, unverified: 0 },
    verifiers: ['V1', 'V2'],
    rows: [row()],
    rowsTruncated: false,
    report: 'the written report',
    reportTruncated: false,
    ...overrides,
  }
}

describe('toMarkdown', () => {
  it('renders a heading, the summary, the table, the legend and the report', () => {
    const text = toMarkdown(record(), translate)
    const lines = text.split('\n')
    expect(lines[0]).toBe('# council: bug-hunt')
    expect(text).toContain('4 of 4 members answered · 2 reported · 1 findings · 1 confirmed')
    expect(text).toContain('| # | Finding | Location | V1 | V2 | Outcome | Fix |')
    expect(text).toContain('| 1 | Greedy scoring inverted | rank.py:521 | ✅ | ❌ | CONFIRMED | use mi_with_prefix |')
    expect(text).toContain('abstained')
    expect(text).toContain('## Report')
    expect(text.endsWith('the written report')).toBe(true)
  })

  it('marks an abstention and an unknown vote without breaking the row', () => {
    const text = toMarkdown(record({
      verifiers: ['V1', 'V2', 'V3'],
      rows: [row({ votes: ['confirmed', null, 'from-the-future'] })],
    }), translate)
    expect(text).toContain('| ✅ | · | ? |')
  })

  it('escapes pipes and newlines so a hostile title cannot break the table', () => {
    const text = toMarkdown(record({
      rows: [row({ title: 'a|b', location: 'x.ts:1', fix: 'c|d\ne' })],
    }), translate)
    expect(text).toContain('a\\|b')
    expect(text).toContain('c\\|d e')
    // One header, one divider, one body row — the newline did not split it.
    expect(text.split('\n').filter(line => line.startsWith('|'))).toHaveLength(3)
  })

  it('writes an em dash for a finding with no proposed fix', () => {
    const text = toMarkdown(record({ rows: [row({ fix: '' })] }), translate)
    expect(text).toContain('| CONFIRMED | — |')
  })

  it('says so instead of drawing an empty table when there were no findings', () => {
    const text = toMarkdown(record({
      rows: [], counts: { findings: 0, confirmed: 0, rejected: 0, notABug: 0, insufficient: 0, unverified: 0 },
    }), translate)
    expect(text).toContain('The council reported no findings.')
    expect(text).not.toContain('| # |')
  })

  it('carries the incomplete and failed notices above the table', () => {
    const budgeted = toMarkdown(record({ stopReason: 'deadline' }), translate)
    expect(budgeted.indexOf('Incomplete')).toBeLessThan(budgeted.indexOf('| # |'))
    const failed = toMarkdown(record({ error: 'worker died' }), translate)
    expect(failed).toContain('This run did not finish: worker died')
  })

  it('says the report is missing rather than leaving the section blank', () => {
    const text = toMarkdown(record({ reportMissing: true, report: '' }), translate)
    expect(text).toContain('The synthesizer produced no report for this run.')
  })
})

describe('dynamic locale keys', () => {
  // The view composes these keys at runtime and casts to CouncilKey, so a
  // renamed status or outcome would only surface as a blank cell in the UI.
  const families: Record<string, readonly string[]> = {
    'status.': ['running', 'completed', 'failed', 'cancelled', 'interrupted', 'loading', 'unavailable'],
    'kind.': ['map', 'verify', 'reduce'],
    'kindHint.': ['map', 'verify', 'reduce'],
    'outcome.': ['confirmed', 'rejected', 'not-a-bug', 'insufficient', 'unverified'],
    'quorumRule.': ['majority', 'unanimous', 'threshold'],
  }

  it('resolves every key the view and the card build at runtime', () => {
    for (const [prefix, suffixes] of Object.entries(families)) {
      for (const suffix of suffixes) {
        const key = `${prefix}${suffix}` as CouncilKey
        expect(Object.hasOwn(en, key), `missing locale key ${key}`).toBe(true)
        expect(en[key]).not.toBe('')
      }
    }
  })
})
