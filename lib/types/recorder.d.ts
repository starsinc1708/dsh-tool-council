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
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { WorkflowRun } from '@deepseek-ai/dsh-workflow';
import type { CouncilRunNarration } from './types.ts';
export type { CouncilLayerRecord, CouncilLogLine, CouncilPhaseMark, CouncilResultRecord, CouncilResultRow, CouncilRunNarration, } from './types.ts';
/** The appendable face of a Session the recorder needs. */
interface SessionLike {
    append(type: string, data: any): void;
}
/** How much of the task the run header keeps. */
export declare const TASK_SNIPPET_CHARS = 80;
/**
 * Reduce a task to one short single-line snippet for the run header.
 * @param task - the model-supplied task text.
 * @returns the collapsed, truncated first line, or `''`.
 */
export declare function taskSnippet(task: string): string;
/** Lifecycle handle the tool calls from its execute. */
export interface CouncilRecorder {
    /** Begin mirroring one run and collecting its narration. */
    start(session: SessionLike, run: WorkflowRun): void;
    /**
     * The narration collected for one run so far.
     * @param runId - the run's id.
     * @returns its start time, phase marks, and log lines; empty for an unknown run.
     */
    narration(runId: string): CouncilRunNarration;
    /** Append the run's end marker. Idempotent. */
    finish(runId: string, stopReason: string): void;
    /** Release the run's collected narration. */
    abandon(runId: string): void;
}
/**
 * Create a recorder that mirrors each workflow event into the parent session.
 * @param ctx - the council tool's plugin context.
 * @returns the start/narration/finish/abandon handle.
 */
export declare function createCouncilRecorder(ctx: Context): CouncilRecorder;
/** Brand the child session id type import so this module compiles standalone. */
export type { SessionId };
