/**
 * Tests for the durable-record lifecycle against a session that refuses
 * appends. This is the only path on which the reopenable-run feature can
 * disappear silently, so it is the one that has to be driven directly: a
 * transient failure must cost the mirror it happened on, never the run's
 * outcome record, and a half-opened run must still be closable.
 */

import { describe, expect, it, vi } from 'vitest'
import { TASK_SNIPPET_CHARS, createCouncilRecorder, taskSnippet } from '../src/recorder.ts'
import type { CouncilResultRecord } from '../src/types.ts'

/** One appended record. */
interface Appended {
  readonly type: string
  readonly data: unknown
}

/** A session that records appends and can be told to refuse some of them. */
class FakeSession {
  readonly appended: Appended[] = []
  /** Types to refuse; a refused append throws, as a closed session would. */
  refuse = new Set<string>()

  append(type: string, data: unknown): void {
    if (this.refuse.has(type)) throw new Error(`refused ${type}`)
    this.appended.push({ type, data })
  }

  types(): string[] {
    return this.appended.map(entry => entry.type)
  }
}

/** The cordis slice the recorder actually touches. */
function fakeContext() {
  const handlers = new Map<string, (...args: any[]) => void>()
  const ctx = {
    logger: { warn: vi.fn() },
    on(event: string, handler: (...args: any[]) => void) { handlers.set(event, handler) },
  }
  const emit = (event: string, ...args: unknown[]) => { handlers.get(event)?.(...args) }
  return { ctx, emit }
}

const RUN = { id: 'run-1', meta: { name: 'council:bug-hunt', description: 'd' } }

const RESULT: CouncilResultRecord = {
  preset: 'bug-hunt',
  stopReason: 'completed',
  agentsStarted: 8,
  durationMs: 1_000,
  membersReporting: 1,
  membersResponding: 4,
  mapMembers: 4,
  reportMissing: false,
  counts: { findings: 1, confirmed: 1, rejected: 0, notABug: 0, insufficient: 0, unverified: 0 },
  verifiers: ['V1', 'V2'],
  rows: [],
  rowsTruncated: false,
  report: 'the report',
  reportTruncated: false,
}

function setup() {
  const { ctx, emit } = fakeContext()
  const recorder = createCouncilRecorder(ctx as never)
  const session = new FakeSession()
  return { recorder, session, emit }
}

describe('council recorder', () => {
  it('opens both node families and closes with the outcome before the end marker', () => {
    const { recorder, session, emit } = setup()
    recorder.start(session, RUN as never, { preset: 'bug-hunt', task: 'audit src/rank.py', layers: [] })
    emit('workflow/phase', { id: 'run-1' }, 'map')
    emit('workflow/log', { id: 'run-1' }, 'map layer done')
    recorder.finish('run-1', 'completed', RESULT)

    expect(session.types()).toEqual([
      'tool-workflow/run-start',
      'tool-council/run-start',
      'tool-council/phase',
      'tool-council/log',
      // Adjacent, in this order: a reader must never see a finished verdict
      // table above a status that still says running.
      'tool-council/result',
      'tool-workflow/run-end',
    ])
  })

  it('still closes the council node when the workflow opener was refused', () => {
    const { recorder, session } = setup()
    session.refuse.add('tool-workflow/run-start')
    recorder.start(session, RUN as never, { preset: 'bug-hunt', task: 'audit src/rank.py', layers: [] })
    recorder.finish('run-1', 'completed', RESULT)

    // Gating registration on the first opener alone left this node open for ever.
    expect(session.types()).toContain('tool-council/run-start')
    expect(session.types()).toContain('tool-council/result')
  })

  it('keeps the outcome after a mid-run mirror failure mutes the stream', () => {
    const { recorder, session, emit } = setup()
    recorder.start(session, RUN as never, { preset: 'bug-hunt', task: 'audit src/rank.py', layers: [] })
    session.refuse.add('tool-workflow/agent-start')
    emit('workflow/agent-start', { id: 'run-1' }, { seq: 1, label: 'Correctness', childId: 'session-2' })
    // The stream is muted from here on…
    emit('workflow/log', { id: 'run-1' }, 'this line is lost')
    recorder.finish('run-1', 'completed', RESULT)

    expect(session.types()).not.toContain('tool-council/log')
    // …but the record the whole feature exists for still lands.
    expect(session.types()).toContain('tool-council/result')
    expect(session.types()).toContain('tool-workflow/run-end')
  })

  it('registers nothing when the session refuses both openers', () => {
    const { recorder, session, emit } = setup()
    session.refuse.add('tool-workflow/run-start')
    session.refuse.add('tool-council/run-start')
    recorder.start(session, RUN as never, { preset: 'bug-hunt', task: 'audit src/rank.py', layers: [] })
    emit('workflow/log', { id: 'run-1' }, 'ignored')
    recorder.finish('run-1', 'completed', RESULT)
    expect(session.appended).toHaveLength(0)
  })

  it('closes a run with no outcome record, so a failed run does not read as running', () => {
    const { recorder, session } = setup()
    recorder.start(session, RUN as never, { preset: 'bug-hunt', task: 'audit src/rank.py', layers: [] })
    recorder.finish('run-1', 'error')
    expect(session.types()).toContain('tool-workflow/run-end')
    expect(session.types()).not.toContain('tool-council/result')
  })

  it('is idempotent and ignores events for runs it does not own', () => {
    const { recorder, session, emit } = setup()
    recorder.start(session, RUN as never, { preset: 'bug-hunt', task: 'audit src/rank.py', layers: [] })
    recorder.finish('run-1', 'completed', RESULT)
    const after = session.appended.length
    recorder.finish('run-1', 'completed', RESULT)
    recorder.abandon('run-1')
    emit('workflow/log', { id: 'run-1' }, 'after the close')
    emit('workflow/log', { id: 'other-run' }, 'never seen')
    expect(session.appended).toHaveLength(after)
  })
})

describe('taskSnippet', () => {
  it('collapses whitespace to one line and truncates with an ellipsis', () => {
    expect(taskSnippet('  audit\n  src/rank.py  ')).toBe('audit src/rank.py')
    const long = taskSnippet('x'.repeat(200))
    expect(long).toHaveLength(TASK_SNIPPET_CHARS)
    expect(long.endsWith('…')).toBe(true)
  })

  it('never throws, because it runs outside the guarded append', () => {
    // A throw here would fail the whole council call over a display string.
    expect(taskSnippet(undefined as unknown as string)).toBe('')
    expect(taskSnippet(42 as unknown as string)).toBe('')
  })
})
