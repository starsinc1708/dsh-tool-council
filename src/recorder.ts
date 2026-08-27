/**
 * Projects the council's workflow run into its parent Session, and collects the
 * run's narration for the durable artifact.
 *
 * ONLY `tool-workflow/*` records are appended, and that is a hard constraint,
 * not a style choice. The harness validates a session log against
 * `KNOWN_SESSION_EVENT_TYPES`, and `Session.append()` gives an out-of-repo
 * plugin no way to set the envelope's `ignorable` marker — so a private event
 * family makes the whole log unreadable on the next start:
 *
 *   SessionFormatUnsupportedError: … contains event type "tool-council/…"
 *   unknown to this harness and not marked ignorable; refusing to interpret
 *   the log
 *
 * Earlier versions of this plugin did exactly that. The run's own artifact now
 * travels through the supported channel instead — the tool's `presentationMeta`,
 * which the harness persists on the `tool/result` event it already writes — and
 * the phase and log marks the artifact needs are held in memory here for the
 * lifetime of the run rather than written as records of their own.
 *
 * The `tool-workflow` package's own recorder only tracks runs started by the
 * model-facing `workflow` tool; the council starts its run directly through
 * `ctx.workflowEngine`, so it owns this recorder itself.
 *
 * @module @starsinc1708/dsh-tool-council
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkflowAgentEndInfo, WorkflowAgentInfo, WorkflowRunInfo, WorkflowRun } from '@deepseek-ai/dsh-workflow'

import type { CouncilLogLine, CouncilPhaseMark, CouncilRunNarration } from './types.ts'

export type {
  CouncilLayerRecord, CouncilLogLine, CouncilPhaseMark, CouncilResultRecord, CouncilResultRow,
  CouncilRunNarration,
} from './types.ts'

/** The appendable face of a Session the recorder needs. */
interface SessionLike {
  /* eslint-disable @typescript-eslint/no-explicit-any -- the real Session.append
     is a generic keyed by SessionEventMap; any keeps this seam assignable. */
  append(type: string, data: any): void
}

/** How much of the task the run header keeps. */
export const TASK_SNIPPET_CHARS = 80

/**
 * Reduce a task to one short single-line snippet for the run header.
 * @param task - the model-supplied task text.
 * @returns the collapsed, truncated first line, or `''`.
 */
export function taskSnippet(task: string): string {
  // Total by construction: a throw here would fail the council call itself over
  // a display string.
  const line = typeof task === 'string' ? task.replace(/\s+/gu, ' ').trim() : ''
  return line.length <= TASK_SNIPPET_CHARS ? line : `${line.slice(0, TASK_SNIPPET_CHARS - 1)}…`
}

/** Lifecycle handle the tool calls from its execute. */
export interface CouncilRecorder {
  /** Begin mirroring one run and collecting its narration. */
  start(session: SessionLike, run: WorkflowRun): void
  /**
   * The narration collected for one run so far.
   * @param runId - the run's id.
   * @returns its start time, phase marks, and log lines; empty for an unknown run.
   */
  narration(runId: string): CouncilRunNarration
  /** Append the run's end marker. Idempotent. */
  finish(runId: string, stopReason: string): void
  /** Release the run's collected narration. */
  abandon(runId: string): void
}

/** One live run's recording state. */
interface RunRecord {
  readonly session: SessionLike
  readonly startedAt: number
  readonly phases: CouncilPhaseMark[]
  readonly messages: CouncilLogLine[]
  /**
   * Set once a per-agent mirror fails. The remaining agent records stop rather
   * than hammering a session that refuses them; the run's end marker is still
   * attempted, so a run never reads as `running` for ever.
   */
  streamFailed: boolean
}

/** Ceilings on what one run may accumulate in memory. */
const MAX_PHASES = 64
const MAX_MESSAGES = 256

const NO_NARRATION: CouncilRunNarration = { startedAt: 0, phases: [], messages: [] }

/**
 * Create a recorder that mirrors each workflow event into the parent session.
 * @param ctx - the council tool's plugin context.
 * @returns the start/narration/finish/abandon handle.
 */
export function createCouncilRecorder(ctx: Context): CouncilRecorder {
  const active = new Map<string, RunRecord>()

  const append = (session: SessionLike, type: string, data: unknown): boolean => {
    try {
      session.append(type, data)
      return true
    } catch (error: unknown) {
      ctx.logger.warn('dsh-tool-council: durable %s append failed: %s', type, String(error))
      return false
    }
  }

  /** Mirror one per-agent record, muting the stream after a failure. */
  const stream = (runId: string, type: string, data: unknown): void => {
    const entry = active.get(runId)
    if (entry === undefined || entry.streamFailed) return
    if (!append(entry.session, type, data)) entry.streamFailed = true
  }

  ctx.on('workflow/agent-start', (info: WorkflowRunInfo, agent: WorkflowAgentInfo) => {
    stream(info.id, 'tool-workflow/agent-start', {
      runId: info.id,
      seq: agent.seq,
      label: agent.label,
      ...agent.phase === undefined ? {} : { phase: agent.phase },
      childId: agent.childId,
    })
  })

  ctx.on('workflow/agent-end', (info: WorkflowRunInfo, agent: WorkflowAgentEndInfo) => {
    stream(info.id, 'tool-workflow/agent-end', { runId: info.id, seq: agent.seq, outcome: agent.outcome })
  })

  // Phases and log lines are the council's own vocabulary: collected here for
  // the artifact, never appended as records of their own.
  ctx.on('workflow/phase', (info: WorkflowRunInfo, title: string) => {
    const entry = active.get(info.id)
    if (entry === undefined || entry.phases.length >= MAX_PHASES) return
    entry.phases.push({ title, at: Date.now() })
  })

  ctx.on('workflow/log', (info: WorkflowRunInfo, message: string) => {
    const entry = active.get(info.id)
    if (entry === undefined || entry.messages.length >= MAX_MESSAGES) return
    entry.messages.push({ text: message, at: Date.now() })
  })

  return {
    start(session, run) {
      const opened = append(session, 'tool-workflow/run-start', { runId: run.id, name: run.meta.name })
      // Narration is collected whether or not the mirror opened: the artifact
      // does not depend on the session accepting anything.
      active.set(run.id, { session, startedAt: Date.now(), phases: [], messages: [], streamFailed: !opened })
    },
    narration(runId) {
      const entry = active.get(runId)
      if (entry === undefined) return NO_NARRATION
      return { startedAt: entry.startedAt, phases: [...entry.phases], messages: [...entry.messages] }
    },
    finish(runId, stopReason) {
      const entry = active.get(runId)
      if (entry === undefined) return
      // The end marker is attempted even on a muted stream: without it the run
      // reads as `running` for ever.
      append(entry.session, 'tool-workflow/run-end', { runId, stopReason })
    },
    abandon(runId) {
      active.delete(runId)
    },
  }
}

/** Brand the child session id type import so this module compiles standalone. */
export type { SessionId }
