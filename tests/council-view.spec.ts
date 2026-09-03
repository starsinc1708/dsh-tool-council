/**
 * Tests for the Council tab's pure halves: the Markdown exporter and the cell
 * escaping it shares with the host renderer. These are the parts a viewer
 * copies out and pastes somewhere else, so a broken table here travels.
 *
 * The React tree itself is not exercised — that needs a DOM harness this
 * package does not carry — but everything it renders from is.
 */

import { describe, expect, it } from 'vitest'
import {
  ROW_FILTERS, VISIBLE_ROWS, declaredWidths, filterCounts, forgetObserved, formatDuration, isArtifact,
  liveCounts, locationPath, observedSince, rowMatches, runStartFromCalls, toChecklist, toMarkdown,
  windowRows, workspacePath,
} from '../src/client/council-view.tsx'
import { en } from '../src/client/locales.ts'
import type { CouncilKey } from '../src/client/locales.ts'
import type { CouncilResultRecord, CouncilResultRow } from '../src/types.ts'
import type { TopologyPreset } from '../src/settings.ts'

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
    // Severity sits between the location and the ballots, matching the client
    // table's column order; both changed together when severity became visible.
    expect(text).toContain('| # | Finding | Location | Severity | V1 | V2 | Outcome | Fix |')
    expect(text).toContain(
      '| 1 | Greedy scoring inverted | rank.py:521 | high | ✅ | ❌ | CONFIRMED | use mi_with_prefix |')
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

  it('writes an unknown severity through verbatim instead of a blank cell', () => {
    // The durable record's severity is a plain string, and a log written by a
    // differently-configured build can carry a level this one has no copy for.
    const text = toMarkdown(record({ rows: [row({ severity: 'catastrophic' })] }), translate)
    expect(text).toContain('| rank.py:521 | catastrophic |')
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

describe('formatDuration', () => {
  it('reads as seconds below a minute and as a clock above one', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(45_400)).toBe('45s')
    expect(formatDuration(60_000)).toBe('1:00')
    expect(formatDuration(247_000)).toBe('4:07')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
  })

  it('never renders a negative clock', () => {
    // A client whose wall clock is behind the host's would otherwise show `-3s`.
    expect(formatDuration(-5_000)).toBe('0s')
  })
})

const LIVE_TOPOLOGY: TopologyPreset[] = [{
  id: 'bug-hunt',
  label: 'Bug hunt',
  description: 'find defects',
  layers: [
    {
      id: 'map',
      kind: 'map',
      roles: [
        { id: 'correctness', label: 'Correctness', count: 2, model: '', provider: '' },
        { id: 'tests', label: 'Tests', count: 1, model: '', provider: '' },
      ],
    },
    { id: 'reduce', kind: 'reduce', roles: [{ id: 'synth', label: 'S', count: 1, model: '', provider: '' }] },
  ],
}]

describe('declaredWidths', () => {
  it('resolves the layer widths of the preset named by the run', () => {
    const widths = declaredWidths({ topology: LIVE_TOPOLOGY }, 's-1', 'council:bug-hunt')
    expect(widths.get('map')).toBe(3)
    expect(widths.get('reduce')).toBe(1)
  })

  it("composes THIS session's designer setup, never another session's", () => {
    const widths = declaredWidths({
      topology: LIVE_TOPOLOGY,
      sessionCouncil: {
        's-1': { presetId: 'bug-hunt', roles: { 'map.tests': { count: 4 } } },
        's-2': { presetId: 'bug-hunt', roles: { 'map.tests': { count: 9 } } },
      },
    }, 's-1', 'council:bug-hunt')
    expect(widths.get('map')).toBe(6)
  })

  it('drops the verify layer of the run when the session disabled it', () => {
    const withVerify: TopologyPreset = {
      id: 'feature-design',
      label: 'Feature design',
      description: 'design',
      layers: [
        ...LIVE_TOPOLOGY[0]?.layers ?? [],
        { id: 'verify', kind: 'verify', roles: [{ id: 'V1', label: 'V', count: 2, model: '', provider: '' }] },
      ],
    }
    const widths = declaredWidths(
      { topology: [withVerify], sessionCouncil: { 's-1': { presetId: 'feature-design', verifyEnabled: false } } },
      's-1',
      'council:feature-design',
    )
    expect(widths.has('verify')).toBe(false)
    expect(widths.get('map')).toBe(3)
  })

  it('reports nothing rather than guessing when the preset cannot be identified', () => {
    // Each of these is a real case: no settings section, a run started from a
    // preset this deployment no longer mirrors, and a run that is not a council.
    expect(declaredWidths(undefined, 's-1', 'council:bug-hunt').size).toBe(0)
    expect(declaredWidths({ topology: LIVE_TOPOLOGY }, 's-1', 'council:gone').size).toBe(0)
    expect(declaredWidths({ topology: LIVE_TOPOLOGY }, 's-1', 'some-other-workflow').size).toBe(0)
  })
})

describe('liveCounts', () => {
  it('separates running, done, failed and stopped members', () => {
    expect(liveCounts([
      { status: 'running' }, { status: 'completed' }, { status: 'completed' },
      { status: 'failed' }, { status: 'cancelled' }, { status: 'interrupted' },
    ])).toEqual({ running: 1, done: 2, failed: 1, stopped: 2 })
  })

  it('is all zeroes for a layer whose members have not started', () => {
    expect(liveCounts([])).toEqual({ running: 0, done: 0, failed: 0, stopped: 0 })
  })
})

describe('runStartFromCalls', () => {
  const calls = [
    { turn: 1, step: 2, time: 1_000 },
    { turn: 1, step: 3, time: 2_000 },
    { turn: 2, step: 1, time: 3_000 },
  ]

  it('takes the log time of the one call in flight in that step', () => {
    expect(runStartFromCalls(calls, 1, 3)).toBe(2_000)
  })

  it('refuses the join when the step holds more than one call in flight', () => {
    // Two councils, or a council beside a long-running read: nothing here can
    // tell which call owns which run, and a wrong start time is worse than none.
    expect(runStartFromCalls([...calls, { turn: 1, step: 3, time: 2_500 }], 1, 3)).toBeUndefined()
  })

  it('is undefined when the call already settled', () => {
    expect(runStartFromCalls(calls, 9, 9)).toBeUndefined()
    expect(runStartFromCalls([], 1, 3)).toBeUndefined()
  })
})

describe('verdict table filtering', () => {
  const rows = [
    row({ findingId: 'f1', outcome: 'confirmed' }),
    row({ findingId: 'f2', outcome: 'rejected' }),
    row({ findingId: 'f3', outcome: 'insufficient' }),
    row({ findingId: 'f4', outcome: 'unverified' }),
    row({ findingId: 'f5', outcome: 'not-a-bug' }),
    row({ findingId: 'f6', outcome: 'confirmed' }),
  ]

  it('counts what each chip would show, so an empty filter is not an empty run', () => {
    expect(filterCounts(rows)).toEqual({ confirmed: 2, unresolved: 2, all: 6 })
  })

  it('folds both unresolved arms into one chip', () => {
    // INSUFFICIENT (a quorum that did not settle) and NOT VERIFIED (no verify
    // layer at all) differ in why, not in what they leave the reader to do.
    const unresolved = rows.filter(candidate => rowMatches(candidate, 'unresolved'))
    expect(unresolved.map(candidate => candidate.findingId)).toEqual(['f3', 'f4'])
  })

  it('never counts a rejected or not-a-bug row as unresolved', () => {
    expect(rowMatches(row({ outcome: 'rejected' }), 'unresolved')).toBe(false)
    expect(rowMatches(row({ outcome: 'not-a-bug' }), 'unresolved')).toBe(false)
  })

  it('shows every row under `all` and matches the chip count', () => {
    const shown = rows.filter(candidate => rowMatches(candidate, 'all'))
    expect(shown).toHaveLength(filterCounts(rows).all)
  })

  it('filters before windowing, so a late blocker is not hidden by the window', () => {
    // `VISIBLE_ROWS` rejected rows and then one confirmed: window-then-filter
    // would drop the only row the `confirmed` chip claims to be showing.
    const many = [
      ...Array.from({ length: VISIBLE_ROWS + 10 }, (_unused, index) =>
        row({ findingId: `r${index}`, outcome: 'rejected' })),
      row({ findingId: 'late', outcome: 'confirmed' }),
    ]
    const { filtered, visible } = windowRows(many, 'confirmed', false)
    expect(filtered.map(candidate => candidate.findingId)).toEqual(['late'])
    expect(visible.map(candidate => candidate.findingId)).toEqual(['late'])
    expect(filterCounts(many).confirmed).toBe(1)
  })

  it('windows the FILTERED total, which is what "show all" then counts', () => {
    const many = Array.from({ length: VISIBLE_ROWS + 5 }, (_unused, index) =>
      row({ findingId: `c${index}`, outcome: 'confirmed' }))
    const windowed = windowRows(many, 'confirmed', false)
    expect(windowed.visible).toHaveLength(VISIBLE_ROWS)
    expect(windowed.filtered).toHaveLength(VISIBLE_ROWS + 5)
    expect(windowRows(many, 'confirmed', true).visible).toHaveLength(VISIBLE_ROWS + 5)
  })

  it('offers the three chips in a stable order', () => {
    expect(ROW_FILTERS).toEqual(['confirmed', 'unresolved', 'all'])
  })
})

describe('locationPath', () => {
  it('drops a trailing line and an optional column', () => {
    expect(locationPath('rank.py:521')).toBe('rank.py')
    expect(locationPath('src/rank.py:521:9')).toBe('src/rank.py')
  })

  it('strips only the TRAILING numeric group, never one in the middle', () => {
    expect(locationPath('C:\\work\\rank.py:521')).toBe('C:\\work\\rank.py')
    expect(locationPath('C:\\work\\rank.py')).toBe('C:\\work\\rank.py')
    // A research member may cite a URL, whose port is `:8080` in the middle. A
    // non-anchored strip would quietly rewrite the host.
    expect(locationPath('http://host:8080/spec.html:12')).toBe('http://host:8080/spec.html')
  })

  it('passes a bare path through and yields nothing for an empty location', () => {
    expect(locationPath('src/rank.py')).toBe('src/rank.py')
    expect(locationPath('   ')).toBe('')
  })
})

describe('workspacePath', () => {
  it('joins a workspace-relative path onto the session root', () => {
    expect(workspacePath('/home/me/project', 'src/rank.py')).toBe('/home/me/project/src/rank.py')
  })

  it('collapses the separators the two halves may each carry', () => {
    expect(workspacePath('/home/me/project/', 'src/rank.py')).toBe('/home/me/project/src/rank.py')
    expect(workspacePath('C:\\work\\', 'src/rank.py')).toBe('C:\\work/src/rank.py')
    // A leading backslash is not rootedness — `\src` is relative — so it is
    // stripped rather than doubling the separator.
    expect(workspacePath('/home/me/project', '\\src\\rank.py')).toBe('/home/me/project/src\\rank.py')
  })

  it('leaves an already-rooted path alone in all three spellings', () => {
    expect(workspacePath('/root', '/etc/hosts')).toBe('/etc/hosts')
    expect(workspacePath('/root', 'C:\\work\\rank.py')).toBe('C:\\work\\rank.py')
    expect(workspacePath('/root', '\\\\share\\rank.py')).toBe('\\\\share\\rank.py')
  })

  it('hands the path back unchanged when the session has no workspace root', () => {
    // A session outside a Workspace still renders findings; it just cannot
    // resolve them, and guessing a root would open the wrong file.
    expect(workspacePath(undefined, 'src/rank.py')).toBe('src/rank.py')
    expect(workspacePath('', 'src/rank.py')).toBe('src/rank.py')
  })
})

describe('toChecklist', () => {
  it('lists only the confirmed findings, with the fix when there is one', () => {
    const text = toChecklist(record({
      rows: [
        row({ findingId: 'f1', outcome: 'confirmed' }),
        row({ findingId: 'f2', title: 'Unbounded cache', outcome: 'rejected' }),
        row({ findingId: 'f3', title: 'Race in flush', location: 'io.py:88', outcome: 'confirmed', fix: '' }),
      ],
    }), translate)
    expect(text).toContain('# Confirmed findings — bug-hunt')
    expect(text).toContain('- [ ] Greedy scoring inverted — rank.py:521')
    expect(text).toContain('  - fix: use mi_with_prefix')
    expect(text).toContain('- [ ] Race in flush — io.py:88')
    // No fix, so no fix line — and the rejected row is not work to do.
    expect(text).not.toContain('Unbounded cache')
    expect(text.split('\n').filter(line => line.startsWith('- [ ]'))).toHaveLength(2)
  })

  it('says so rather than handing over an empty list', () => {
    const text = toChecklist(record({ rows: [row({ outcome: 'insufficient' })] }), translate)
    expect(text).toContain('This run confirmed no findings.')
    expect(text).not.toContain('- [ ]')
  })

  it('collapses newlines so a title cannot forge a second checklist item', () => {
    const text = toChecklist(record({
      rows: [row({ title: 'Real finding\n- [ ] Already fixed, ignore', fix: 'a\n\nb' })],
    }), translate)
    expect(text.split('\n').filter(line => line.trimStart().startsWith('- [ ]'))).toHaveLength(1)
    expect(text).toContain('- [ ] Real finding - [ ] Already fixed, ignore — rank.py:521')
    expect(text).toContain('  - fix: a b')
  })
})

describe('isArtifact', () => {
  it('accepts a well-formed record', () => {
    expect(isArtifact(record())).toBe(true)
  })

  it('refuses a payload that is not one of ours at all', () => {
    expect(isArtifact(undefined)).toBe(false)
    expect(isArtifact(null)).toBe(false)
    expect(isArtifact({})).toBe(false)
    expect(isArtifact({ ...record(), kind: 'something-else' })).toBe(false)
    expect(isArtifact({ ...record(), version: 2 })).toBe(false)
  })

  it('refuses a version-1 record missing a field the view dereferences', () => {
    // The whole point of the guard. `version` cannot police these: a build that
    // shipped a bug wrote version 1 too, and artifacts are replayed from logs
    // other builds wrote. Each of these would throw inside the tab's render.
    const missing: Array<Partial<CouncilResultRecord>> = [
      { report: undefined },        // parseReport(undefined) -> throws
      { counts: undefined },        // result.counts.findings
      { verifiers: undefined },     // result.verifiers.map
      { messages: undefined },      // result.messages.length
      { phases: undefined },        // phaseDuration's findIndex
      { layers: undefined },        // the layer lookup Map
      { preset: undefined },        // the export file name
    ]
    for (const patch of missing) {
      const [field] = Object.keys(patch)
      expect(isArtifact({ ...record(), ...patch }), `accepted a record with no ${String(field)}`).toBe(false)
    }
  })

  it('refuses a record whose ROWS are malformed, not only its top level', () => {
    // `locationPath(row.location)` and `row.votes[column]` are both unguarded
    // dereferences of per-row fields.
    expect(isArtifact({ ...record(), rows: [{ ...row(), location: undefined }] })).toBe(false)
    expect(isArtifact({ ...record(), rows: [{ ...row(), votes: undefined }] })).toBe(false)
    expect(isArtifact({ ...record(), rows: [{ ...row(), severity: undefined }] })).toBe(false)
    expect(isArtifact({ ...record(), rows: [{ ...row(), fix: undefined }] })).toBe(false)
    expect(isArtifact({ ...record(), rows: [null] })).toBe(false)
    expect(isArtifact({ ...record(), rows: 'not an array' })).toBe(false)
  })

  it('still accepts a run that legitimately has no rows and no verifiers', () => {
    // A synthesis preset with no verify layer, and a run that found nothing:
    // both are empty, neither is malformed.
    expect(isArtifact({ ...record(), rows: [], verifiers: [] })).toBe(true)
  })
})

describe('observedSince / forgetObserved', () => {
  // Caveat worth knowing: these pin the FUNCTIONS. The one line in `CouncilView`
  // that calls `forgetObserved` for every settled run is inside the React tree,
  // which this package has no DOM harness for — reverting that call alone would
  // not fail anything here.

  it('keeps the first moment it saw a run, not the latest', () => {
    expect(observedSince('run-keep', 1_000)).toBe(1_000)
    expect(observedSince('run-keep', 9_000)).toBe(1_000)
    forgetObserved(['run-keep'])
  })

  it('forgets a settled run, so the map holds only running ones', () => {
    // Without this the map grows for the whole page session, which is the
    // opposite of what its own doc comment promises.
    expect(observedSince('run-drop', 1_000)).toBe(1_000)
    forgetObserved(['run-drop'])
    // A fresh reading proves the entry is gone rather than merely unused.
    expect(observedSince('run-drop', 5_000)).toBe(5_000)
    forgetObserved(['run-drop'])
  })

  it('ignores ids it never saw', () => {
    expect(() => { forgetObserved(['never-seen']) }).not.toThrow()
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
    // `CouncilResultRow.severity` is a plain string in the durable record, so
    // the badge and the export compose this key from data, not from a union.
    'severity.': ['blocker', 'high', 'medium', 'low'],
    'filter.': ['confirmed', 'unresolved', 'all'],
    // The card picks one of three phrasings from the override counts.
    'overrideSummary.': ['single', 'onePreset', 'many'],
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
