/**
 * Projects the council's workflow run into its parent Session as durable
 * records: `tool-workflow/*` (so the existing workflow-run conversation node
 * renders the member graph) plus a `tool-council/*` family of its own — the run
 * header with the topology, one record per phase transition, one per narration
 * line, and the run's OUTCOME.
 *
 * The outcome record is what makes a run an artifact instead of a tool result:
 * without it the verdict table and the report live only in the parent's
 * `tool/result` block and cannot be reopened, exported, or read from a fresh
 * client session.
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

// The record shapes live in the browser-safe vocabulary: the Client folds them
// out of the session log, so they must be reachable without a host import.
import type { CouncilLayerRecord, CouncilResultRecord } from './types.ts'

export type { CouncilLayerRecord, CouncilResultRecord, CouncilResultRow } from './types.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Opens one council run's record: its identity and the topology it runs. */
    'tool-council/run-start': {
      readonly runId: string
      readonly name: string
      readonly preset: string
      /** First line of the task, truncated — what tells two runs apart. */
      readonly task: string
      readonly startedAt: number
      readonly layers: readonly CouncilLayerRecord[]
    }
    /** The script entered a layer. Carries the wall clock for per-layer timing. */
    'tool-council/phase': {
      readonly runId: string
      readonly title: string
      readonly at: number
    }
    /** One narration line from a council run (intermediate findings counts). */
    'tool-council/log': {
      readonly runId: string
      readonly message: string
      readonly at: number
    }
    /** The run's durable outcome: the verdict table and the written report. */
    'tool-council/result': {
      readonly runId: string
      readonly result: CouncilResultRecord
    }
  }
}

/** The appendable face of a Session the recorder needs. */
interface SessionLike {
  /* eslint-disable @typescript-eslint/no-explicit-any -- the real Session.append
     is a generic keyed by SessionEventMap; any keeps this seam assignable. */
  append(type: string, data: any): void
}

/** What the tool hands the recorder when a run opens. */
export interface CouncilRunStart {
  readonly preset: string
  /**
   * The task, for the run header. Truncated by {@link TASK_SNIPPET_CHARS}: the
   * parent's own message is safe to echo back to it, but the whole prompt does
   * not belong in a list row — and the session log should not carry it twice.
   */
  readonly task: string
  readonly layers: readonly CouncilLayerRecord[]
}

/** How much of the task the run header keeps. */
export const TASK_SNIPPET_CHARS = 80

/**
 * Reduce a task to one short single-line snippet.
 * @param task - the model-supplied task text.
 * @returns the first line, collapsed and truncated, or `''`.
 */
export function taskSnippet(task: string): string {
  // Total by construction: this runs OUTSIDE the guarded `append`, so a throw
  // here would fail the council call itself over a display string.
  const line = typeof task === 'string' ? task.replace(/\s+/gu, ' ').trim() : ''
  return line.length <= TASK_SNIPPET_CHARS ? line : `${line.slice(0, TASK_SNIPPET_CHARS - 1)}…`
}

/** Lifecycle handle the tool calls from its execute. */
export interface CouncilRecorder {
  start(session: SessionLike, run: WorkflowRun, info: CouncilRunStart): void
  /**
   * Close the run: append its outcome and then its end marker, adjacently, so
   * no reader ever sees a finished verdict table above a `running` status.
   * Idempotent — a second call for the same run does nothing.
   */
  finish(runId: string, stopReason: string, result?: CouncilResultRecord): void
  abandon(runId: string): void
}

/** One live run's recording state. */
interface RunRecord {
  readonly session: SessionLike
  /**
   * Set once a high-frequency mirror fails. The per-agent and per-line records
   * stop, but the run's outcome is still attempted: a transient append failure
   * mid-run must not be what deletes the one record the feature exists for.
   */
  streamFailed: boolean
}

/**
 * Create a recorder that mirrors each workflow event into the parent session.
 * @param ctx - the council tool's plugin context.
 * @returns the start/finish/abandon handle.
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

  /** Mirror one high-frequency record, muting the stream after a failure. */
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

  ctx.on('workflow/phase', (info: WorkflowRunInfo, title: string) => {
    stream(info.id, 'tool-council/phase', { runId: info.id, title, at: Date.now() })
  })

  ctx.on('workflow/log', (info: WorkflowRunInfo, message: string) => {
    stream(info.id, 'tool-council/log', { runId: info.id, message, at: Date.now() })
  })

  return {
    start(session, run, info) {
      // Two independent node families open here. Registering the run when
      // EITHER opener lands is what keeps a half-opened run closable: gating on
      // the first one alone left the council node open for ever whenever the
      // workflow opener was the one that failed.
      const workflowOpened = append(session, 'tool-workflow/run-start', { runId: run.id, name: run.meta.name })
      const councilOpened = append(session, 'tool-council/run-start', {
        runId: run.id,
        name: run.meta.name,
        preset: info.preset,
        task: taskSnippet(info.task),
        startedAt: Date.now(),
        layers: info.layers,
      })
      if (workflowOpened || councilOpened) active.set(run.id, { session, streamFailed: false })
    },
    finish(runId, stopReason, result) {
      const entry = active.get(runId)
      if (entry === undefined) return
      active.delete(runId)
      // Outcome first, end marker second, both unconditionally: these are the
      // two records a reopened run is made of, and a muted stream must not
      // suppress them.
      if (result !== undefined) append(entry.session, 'tool-council/result', { runId, result })
      append(entry.session, 'tool-workflow/run-end', { runId, stopReason })
    },
    abandon(runId) {
      active.delete(runId)
    },
  }
}

/** Brand the child session id type import so this module compiles standalone. */
export type { SessionId }
