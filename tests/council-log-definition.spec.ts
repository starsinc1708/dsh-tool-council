/**
 * Tests for the fold that makes a finished run reopenable.
 *
 * The Council tab's whole durability story rests on this state machine: it
 * turns the `tool-council/*` records in the session log back into one node
 * carrying the topology, the narration, the phase timings and the verdict
 * table. If the fold drops the result record, a completed run silently comes
 * back as a member graph with nothing in it.
 */

import { describe, expect, it } from 'vitest'
import { councilLogDefinition } from '../src/client/council-log-definition.ts'
import type { CouncilLogData } from '../src/client/council-log-definition.ts'
import type { CouncilResultRecord } from '../src/types.ts'

const RESULT: CouncilResultRecord = {
  preset: 'bug-hunt',
  stopReason: 'completed',
  agentsStarted: 8,
  durationMs: 12_000,
  membersReporting: 2,
  membersResponding: 4,
  mapMembers: 4,
  reportMissing: false,
  counts: { findings: 1, confirmed: 1, rejected: 0, notABug: 0, insufficient: 0, unverified: 0 },
  verifiers: ['V1'],
  rows: [],
  rowsTruncated: false,
  report: 'the report',
  reportTruncated: false,
}

function event(type: string, data: unknown, seq = 1) {
  return { type, data, seq } as never
}

function match(type: string, data: unknown, seq = 1) {
  return { event: event(type, data, seq), view: undefined, role: 'update', location: { kind: 'session' } } as never
}

/** Replay a whole event list through the definition, as the engine would. */
function fold(events: ReadonlyArray<{ type: string; data: unknown }>): CouncilLogData | undefined {
  let state: CouncilLogData | undefined
  for (const [index, entry] of events.entries()) {
    const identity = councilLogDefinition.match(event(entry.type, entry.data, index + 1) as never)
    if (identity === null) continue
    if (identity.role === 'start') {
      state = councilLogDefinition.start(
        { state: undefined } as never,
        match(entry.type, entry.data, index + 1),
        { previous: () => undefined } as never,
      )
      continue
    }
    if (state === undefined) continue
    state = councilLogDefinition.update({ state } as never, match(entry.type, entry.data, index + 1))
  }
  return state
}

const START = {
  type: 'tool-council/run-start',
  data: {
    runId: 'run-1',
    name: 'council:bug-hunt',
    preset: 'bug-hunt',
    task: 'audit src/rank.py',
    startedAt: 1_000,
    layers: [{ id: 'map', kind: 'map', label: 'map', width: 4 }],
  },
}

describe('councilLogDefinition.match', () => {
  it('claims the whole tool-council family and nothing else', () => {
    expect(councilLogDefinition.match(event('tool-council/run-start', { runId: 'r' }) as never))
      .toEqual({ id: 'r', role: 'start' })
    for (const type of ['tool-council/phase', 'tool-council/log', 'tool-council/result']) {
      expect(councilLogDefinition.match(event(type, { runId: 'r' }) as never)).toEqual({ id: 'r', role: 'update' })
    }
    // The workflow family belongs to ui-workflow-run's own node.
    expect(councilLogDefinition.match(event('tool-workflow/run-start', { runId: 'r' }) as never)).toBeNull()
    expect(councilLogDefinition.match(event('assistant/message', {}) as never)).toBeNull()
  })

  it('keys on the run id, so two concurrent runs never share a node', () => {
    expect(councilLogDefinition.match(event('tool-council/log', { runId: 'a' }) as never)?.id).toBe('a')
    expect(councilLogDefinition.match(event('tool-council/log', { runId: 'b' }) as never)?.id).toBe('b')
  })
})

describe('councilLogDefinition fold', () => {
  it('carries the topology, narration, phases and outcome of a finished run', () => {
    const state = fold([
      START,
      { type: 'tool-council/phase', data: { runId: 'run-1', title: 'map', at: 1_100 } },
      { type: 'tool-council/log', data: { runId: 'run-1', message: 'map layer done', at: 1_200 } },
      { type: 'tool-council/log', data: { runId: 'run-1', message: 'verify layer done', at: 1_300 } },
      { type: 'tool-council/result', data: { runId: 'run-1', result: RESULT } },
    ])

    expect(state?.preset).toBe('bug-hunt')
    // The snippet is what tells two runs of the same preset apart in a list.
    expect(state?.task).toBe('audit src/rank.py')
    expect(state?.startedAt).toBe(1_000)
    expect(state?.layers).toEqual([{ id: 'map', kind: 'map', label: 'map', width: 4 }])
    expect(state?.phases).toEqual([{ title: 'map', at: 1_100 }])
    // Every line, in order — the tab used to show only the last one.
    expect(state?.messages.map(line => line.text)).toEqual(['map layer done', 'verify layer done'])
    expect(state?.result?.report).toBe('the report')
  })

  it('leaves the result null while the run is still going', () => {
    const state = fold([START, { type: 'tool-council/log', data: { runId: 'run-1', message: 'working', at: 2 } }])
    expect(state?.result).toBeNull()
  })

  it('survives a start record written by an older build', () => {
    // Durable records outlive the code that wrote them: a log from before the
    // topology and timestamps existed must still fold, not throw.
    const state = fold([{ type: 'tool-council/run-start', data: { runId: 'run-1', name: 'council:bug-hunt' } }])
    expect(state).toEqual({
      name: 'council:bug-hunt', preset: '', task: '', startedAt: 0,
      layers: [], phases: [], messages: [], result: null,
    })
  })

  it('takes the newest result when a run somehow reports twice', () => {
    const state = fold([
      START,
      { type: 'tool-council/result', data: { runId: 'run-1', result: RESULT } },
      { type: 'tool-council/result', data: { runId: 'run-1', result: { ...RESULT, report: 'corrected' } } },
    ])
    expect(state?.result?.report).toBe('corrected')
  })
})

describe('councilLogDefinition.buildViewNode', () => {
  const state = fold([START])

  it('publishes a chat node anchored at the start record', () => {
    const node = councilLogDefinition.buildViewNode?.({
      key: 'council-log:run-1',
      id: 'run-1',
      state,
      start: { event: { seq: 7 }, location: { kind: 'session' } },
    } as never)
    expect(node).toMatchObject({ kind: 'council-log', id: 'run-1', target: 'chat', anchorSeq: 7 })
    expect((node?.data as CouncilLogData).preset).toBe('bug-hunt')
  })

  it('publishes nothing before a start record has been seen', () => {
    expect(councilLogDefinition.buildViewNode?.({ start: undefined, state: undefined } as never)).toBeNull()
  })
})
