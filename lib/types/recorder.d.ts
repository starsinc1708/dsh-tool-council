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
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { WorkflowRun } from '@deepseek-ai/dsh-workflow';
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        /** Opens one council run's log record (the start anchor for the log node). */
        'tool-council/run-start': {
            readonly runId: string;
            readonly name: string;
        };
        /** One narration line from a council run (intermediate findings counts). */
        'tool-council/log': {
            readonly runId: string;
            readonly message: string;
        };
    }
}
/** The appendable face of a Session the recorder needs. */
interface SessionLike {
    append(type: string, data: any): void;
}
/** Lifecycle handle the tool calls from its execute. */
export interface CouncilRecorder {
    start(session: SessionLike, run: WorkflowRun): void;
    finish(runId: string, stopReason: string): void;
    abandon(runId: string): void;
}
/**
 * Create a recorder that mirrors each workflow event into the parent session.
 * @param ctx - the council tool's plugin context.
 * @returns the start/finish/abandon handle.
 */
export declare function createCouncilRecorder(ctx: Context): CouncilRecorder;
/** Brand the child session id type import so this module compiles standalone. */
export type { SessionId };
