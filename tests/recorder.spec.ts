/**
 * Tests for the recorder's two jobs and the constraint that shapes both.
 *
 * It may append ONLY event types the harness knows. A private `tool-council/*`
 * family — which earlier versions of this plugin wrote — makes the whole
 * session log unreadable on the next start, because the reader validates types
 * against `KNOWN_SESSION_EVENT_TYPES` and `Session.append()` gives an
 * out-of-repo plugin no way to set the `ignorable` marker. The first test here
 * therefore checks the appended vocabulary against the harness's own catalogue,
 * not against a list written by hand.
 *
 * Its second job is collecting the run's narration in memory for the artifact,
 * which must survive a session that refuses appends entirely.
 */

import { describe, expect, it, vi } from 'vitest'
import { TASK_SNIPPET_CHARS, createCouncilRecorder, taskSnippet } from '../src/recorder.ts'

/**
 * The harness's own event catalogue.
 *
 * Loaded by URL rather than by specifier: the module is real and generated, but
 * `dsh-session`'s `exports` map does not publish that subpath, so a normal
 * import cannot resolve it. Reading the generated set is the whole point — an
 * allowlist written by hand here would drift from the harness exactly when it
 * matters.
 */
const { KNOWN_SESSION_EVENT_TYPES } = await import(
  new URL('../node_modules/@deepseek-ai/dsh-session/lib/types/known-event-types.js', import.meta.url).href
) as { KNOWN_SESSION_EVENT_TYPES: ReadonlySet<string> }

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

function setup() {
  const { ctx, emit } = fakeContext()
  const recorder = createCouncilRecorder(ctx as never)
  const session = new FakeSession()
  return { recorder, session, emit }
}

describe('council recorder vocabulary', () => {
  /** Drive one whole run through the recorder. */
  function runOnce(bench: ReturnType<typeof setup>) {
    const { recorder, session, emit } = bench
    recorder.start(session, RUN as never)
    emit('workflow/agent-start', { id: 'run-1' }, { seq: 1, label: 'Correctness', phase: 'map', childId: 'session-2' })
    emit('workflow/phase', { id: 'run-1' }, 'map')
    emit('workflow/log', { id: 'run-1' }, 'map layer done')
    emit('workflow/agent-end', { id: 'run-1' }, { seq: 1, outcome: 'completed' })
    recorder.finish('run-1', 'completed')
  }

  it('appends only event types this harness knows', () => {
    // The regression that made a whole session unreadable. Checked against the
    // harness's own catalogue so a future private event type cannot slip back
    // in behind a hand-written allowlist.
    const bench = setup()
    runOnce(bench)
    expect(bench.session.appended.length).toBeGreaterThan(0)
    const unknown = [...new Set(bench.session.types())].filter(type => !KNOWN_SESSION_EVENT_TYPES.has(type))
    expect(unknown, 'these types would make the session log unreadable').toEqual([])
  })

  it('mirrors the workflow lifecycle and nothing of its own', () => {
    const bench = setup()
    runOnce(bench)
    expect(bench.session.types()).toEqual([
      'tool-workflow/run-start',
      'tool-workflow/agent-start',
      'tool-workflow/agent-end',
      'tool-workflow/run-end',
    ])
    // Phases and log lines are the council's own vocabulary: collected, never written.
    expect(bench.session.types().some(type => type.startsWith('tool-council/'))).toBe(false)
  })
})

describe('council recorder narration', () => {
  it('collects phase marks and log lines for the artifact', () => {
    const { recorder, session, emit } = setup()
    recorder.start(session, RUN as never)
    emit('workflow/phase', { id: 'run-1' }, 'map')
    emit('workflow/log', { id: 'run-1' }, 'map layer done')
    emit('workflow/phase', { id: 'run-1' }, 'verify')
    emit('workflow/log', { id: 'run-1' }, 'verify layer done')

    const narration = recorder.narration('run-1')
    expect(narration.startedAt).toBeGreaterThan(0)
    expect(narration.phases.map(mark => mark.title)).toEqual(['map', 'verify'])
    expect(narration.messages.map(line => line.text)).toEqual(['map layer done', 'verify layer done'])
  })

  it('collects narration even when the session refuses every append', () => {
    // The artifact does not travel through the session log, so it must not
    // depend on the log accepting anything.
    const { recorder, session, emit } = setup()
    session.refuse.add('tool-workflow/run-start')
    recorder.start(session, RUN as never)
    emit('workflow/log', { id: 'run-1' }, 'still collected')
    expect(recorder.narration('run-1').messages.map(line => line.text)).toEqual(['still collected'])
  })

  it('mutes the per-agent mirror after a failure but still writes the end marker', () => {
    const { recorder, session, emit } = setup()
    recorder.start(session, RUN as never)
    session.refuse.add('tool-workflow/agent-start')
    emit('workflow/agent-start', { id: 'run-1' }, { seq: 1, label: 'Correctness', childId: 'session-2' })
    emit('workflow/agent-end', { id: 'run-1' }, { seq: 1, outcome: 'completed' })
    recorder.finish('run-1', 'completed')

    expect(session.types()).not.toContain('tool-workflow/agent-end')
    // Without the end marker the run reads as `running` for ever.
    expect(session.types()).toContain('tool-workflow/run-end')
  })

  it('returns empty narration for a run it does not own, and after abandon', () => {
    const { recorder, session, emit } = setup()
    recorder.start(session, RUN as never)
    emit('workflow/log', { id: 'run-1' }, 'kept for now')
    expect(recorder.narration('other-run')).toEqual({ startedAt: 0, phases: [], messages: [] })
    recorder.abandon('run-1')
    expect(recorder.narration('run-1')).toEqual({ startedAt: 0, phases: [], messages: [] })
  })

  it('ignores events for runs it does not own and closes at most once', () => {
    const { recorder, session, emit } = setup()
    recorder.start(session, RUN as never)
    recorder.finish('run-1', 'completed')
    recorder.abandon('run-1')
    const after = session.appended.length
    recorder.finish('run-1', 'completed')
    emit('workflow/log', { id: 'run-1' }, 'after the close')
    emit('workflow/log', { id: 'other-run' }, 'never seen')
    expect(session.appended).toHaveLength(after)
  })

  it('bounds what one run may accumulate', () => {
    const { recorder, session, emit } = setup()
    recorder.start(session, RUN as never)
    for (let index = 0; index < 400; index += 1) {
      emit('workflow/phase', { id: 'run-1' }, `phase-${index}`)
      emit('workflow/log', { id: 'run-1' }, `line-${index}`)
    }
    const narration = recorder.narration('run-1')
    expect(narration.phases.length).toBeLessThanOrEqual(64)
    expect(narration.messages.length).toBeLessThanOrEqual(256)
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
