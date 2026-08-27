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
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { WorkflowRun } from '@deepseek-ai/dsh-workflow';
import type { CouncilLayerRecord, CouncilResultRecord } from './types.ts';
export type { CouncilLayerRecord, CouncilResultRecord, CouncilResultRow } from './types.ts';
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        /** Opens one council run's record: its identity and the topology it runs. */
        'tool-council/run-start': {
            readonly runId: string;
            readonly name: string;
            readonly preset: string;
            /** First line of the task, truncated — what tells two runs apart. */
            readonly task: string;
            readonly startedAt: number;
            readonly layers: readonly CouncilLayerRecord[];
        };
        /** The script entered a layer. Carries the wall clock for per-layer timing. */
        'tool-council/phase': {
            readonly runId: string;
            readonly title: string;
            readonly at: number;
        };
        /** One narration line from a council run (intermediate findings counts). */
        'tool-council/log': {
            readonly runId: string;
            readonly message: string;
            readonly at: number;
        };
        /** The run's durable outcome: the verdict table and the written report. */
        'tool-council/result': {
            readonly runId: string;
            readonly result: CouncilResultRecord;
        };
    }
}
/** The appendable face of a Session the recorder needs. */
interface SessionLike {
    append(type: string, data: any): void;
}
/** What the tool hands the recorder when a run opens. */
export interface CouncilRunStart {
    readonly preset: string;
    /**
     * The task, for the run header. Truncated by {@link TASK_SNIPPET_CHARS}: the
     * parent's own message is safe to echo back to it, but the whole prompt does
     * not belong in a list row — and the session log should not carry it twice.
     */
    readonly task: string;
    readonly layers: readonly CouncilLayerRecord[];
}
/** How much of the task the run header keeps. */
export declare const TASK_SNIPPET_CHARS = 80;
/**
 * Reduce a task to one short single-line snippet.
 * @param task - the model-supplied task text.
 * @returns the first line, collapsed and truncated, or `''`.
 */
export declare function taskSnippet(task: string): string;
/** Lifecycle handle the tool calls from its execute. */
export interface CouncilRecorder {
    start(session: SessionLike, run: WorkflowRun, info: CouncilRunStart): void;
    /**
     * Close the run: append its outcome and then its end marker, adjacently, so
     * no reader ever sees a finished verdict table above a `running` status.
     * Idempotent — a second call for the same run does nothing.
     */
    finish(runId: string, stopReason: string, result?: CouncilResultRecord): void;
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
