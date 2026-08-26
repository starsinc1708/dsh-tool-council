/**
 * Projects the council's workflow run into its parent Session as durable
 * `tool-workflow/*` records (so the existing workflow-run conversation node
 * renders it) plus a `tool-council/log` record per script narration line (so
 * the graph view can show intermediate findings counts).
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

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Opens one council run's log record (the start anchor for the log node). */
    'tool-council/run-start': {
      readonly runId: string
      readonly name: string
    }
    /** One narration line from a council run (intermediate findings counts). */
    'tool-council/log': {
      readonly runId: string
      readonly message: string
    }
  }
}

/** The appendable face of a Session the recorder needs. */
interface SessionLike {
  /* eslint-disable @typescript-eslint/no-explicit-any -- the real Session.append
     is a generic keyed by SessionEventMap; any keeps this seam assignable. */
  append(type: string, data: any): void
}

/** Lifecycle handle the tool calls from its execute. */
export interface CouncilRecorder {
  start(session: SessionLike, run: WorkflowRun): void
  finish(runId: string, stopReason: string): void
  abandon(runId: string): void
}

/**
 * Create a recorder that mirrors each workflow event into the parent session.
 * @param ctx - the council tool's plugin context.
 * @returns the start/finish/abandon handle.
 */
export function createCouncilRecorder(ctx: Context): CouncilRecorder {
  const active = new Map<string, SessionLike>()

  const append = (session: SessionLike, type: string, data: unknown): boolean => {
    try {
      session.append(type, data)
      return true
    } catch (error: unknown) {
      ctx.logger.warn('dsh-tool-council: disabled durable record after %s append failed: %s', type, String(error))
      return false
    }
  }

  ctx.on('workflow/agent-start', (info: WorkflowRunInfo, agent: WorkflowAgentInfo) => {
    const session = active.get(info.id)
    if (session === undefined) return
    if (!append(session, 'tool-workflow/agent-start', {
      runId: info.id,
      seq: agent.seq,
      label: agent.label,
      ...agent.phase === undefined ? {} : { phase: agent.phase },
      childId: agent.childId,
    })) active.delete(info.id)
  })

  ctx.on('workflow/agent-end', (info: WorkflowRunInfo, agent: WorkflowAgentEndInfo) => {
    const session = active.get(info.id)
    if (session === undefined) return
    if (!append(session, 'tool-workflow/agent-end', {
      runId: info.id,
      seq: agent.seq,
      outcome: agent.outcome,
    })) active.delete(info.id)
  })

  ctx.on('workflow/log', (info: WorkflowRunInfo, message: string) => {
    const session = active.get(info.id)
    if (session === undefined) return
    append(session, 'tool-council/log', { runId: info.id, message })
  })

  return {
    start(session, run) {
      if (append(session, 'tool-workflow/run-start', { runId: run.id, name: run.meta.name })) {
        active.set(run.id, session)
      }
      append(session, 'tool-council/run-start', { runId: run.id, name: run.meta.name })
    },
    finish(runId, stopReason) {
      const session = active.get(runId)
      if (session !== undefined) append(session, 'tool-workflow/run-end', { runId, stopReason })
      active.delete(runId)
    },
    abandon(runId) {
      active.delete(runId)
    },
  }
}

/** Brand the child session id type import so this module compiles standalone. */
export type { SessionId }
