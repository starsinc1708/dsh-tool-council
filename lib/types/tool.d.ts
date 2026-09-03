/**
 * Model-facing council: a deployment-fixed map-reduce fan-out of subagents
 * across configured layers, with independent verification and an explicit
 * quorum.
 *
 * The plugin is a Consumer over the workflow and subagent seams, in the shape
 * of `@deepseek-ai/dsh-tool-ralph`: the topology, the schemas, the quorum, and
 * the validation belong to the composition, and the model supplies only the
 * task text. Concurrency limiting, cancellation, worker termination, and the
 * `workflow-run` conversation node all come from the workflow engine.
 *
 * @module @starsinc1708/dsh-tool-council
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ToolCallView, ToolResult, ToolResultView } from '@deepseek-ai/dsh-tools';
import type { WorkflowResult } from '@deepseek-ai/dsh-workflow';
import type { Config } from './policy.ts';
import type { CouncilRunNarration } from './recorder.ts';
import type { ScriptStopReason } from './script.ts';
import type { ClusteredFinding, CouncilLayerRecord, CouncilResultRecord, Tally, VerifierBallot } from './types.ts';
export type * from './types.ts';
export type * from './settings.ts';
export { COUNCIL_ARTIFACT_KIND, COUNCIL_ARTIFACT_VERSION } from './types.ts';
export { TASK_SNIPPET_CHARS, taskSnippet } from './recorder.ts';
export { BUILTIN_PRESETS } from './presets.ts';
export { Config, HARD_STOP_GRACE_MS, expandLayers, resolveConfig, totalAgentBudget } from './policy.ts';
export type { ResolvedConfig } from './policy.ts';
export { COUNCIL_NAMESPACE, applySessionSetup, sessionSetupOf } from './settings.ts';
export { TABLE_LEGEND, applyQuorum, assertClustersWellFormed, capPerMember, dedupeFindings, fingerprint, mergeClusters, normalizeLocation, renderTable, tally, } from './tally.ts';
export declare const name = "tool-council";
export declare const inject: string[];
/** The script's terminal value, after the host re-validated it. */
interface CouncilOutcome {
    readonly findings: readonly ClusteredFinding[];
    readonly ballots: readonly VerifierBallot[];
    readonly tally: Tally | null;
    readonly report: string;
    /** The reduce layer ran and returned nothing usable. */
    readonly reportMissing: boolean;
    /** Map members that reported at least one finding. */
    readonly membersReporting: number;
    /** Map members that answered at all — an empty list is a valid answer. */
    readonly membersResponding: number;
    /** Map-layer instances started — the denominator of the two counts above. */
    readonly mapMembers: number;
    readonly stopReason: ScriptStopReason;
}
/**
 * Defensively decode the script's terminal value across the realm boundary.
 * @param value - the workflow result value, as plain cloned data.
 * @returns the decoded outcome.
 * @throws Error when the value does not match the script's declared shape.
 */
export declare function readOutcome(value: unknown): CouncilOutcome;
/**
 * Map a non-clean workflow stop reason to an error message.
 * @param result - the settled workflow result.
 * @returns the message, or `undefined` when the run completed cleanly.
 */
export declare function stopReasonError(result: WorkflowResult): string | undefined;
/**
 * The one-line participation summary, phrased as self-report, not certification.
 *
 * Answering and reporting are counted separately on purpose: the map prompt
 * calls an empty list "a valid and respectable answer", so folding the two
 * would make a clean run where nobody found anything read as four dead children.
 * @param outcome - the validated script outcome.
 * @returns the summary sentence.
 */
export declare function summaryLine(outcome: CouncilOutcome): string;
/**
 * Render the council's result for the parent model.
 *
 * The quorum line is deliberately phrased as a count of members, not as a
 * certification: verifiers are agents re-reading the same repository, and the
 * table would otherwise read as an independent oracle. A run that lost its
 * synthesizer or ran out of its budget says so here rather than presenting a
 * partial council as a complete one.
 * @param outcome - the validated script outcome.
 * @param maxChars - the report ceiling.
 * @returns the model-facing text.
 */
export declare function renderOutcome(outcome: CouncilOutcome, maxChars: number): string;
/**
 * Flatten a settled outcome into the durable record the Council tab reopens.
 * @param outcome - the validated script outcome.
 * @param context - the preset, the engine's stop reason, and the run's timings.
 * @returns the artifact shipped as the tool's `presentationMeta`.
 */
export declare function buildResultRecord(outcome: CouncilOutcome, context: {
    readonly runId: string;
    readonly preset: string;
    readonly task: string;
    readonly layers: readonly CouncilLayerRecord[];
    readonly narration: CouncilRunNarration;
    readonly stopReason: string;
    readonly agentsStarted: number;
    readonly durationMs: number;
    readonly maxReportChars: number;
}): CouncilResultRecord;
/**
 * The record left behind by a run that never produced a usable value.
 * @param context - the preset, the failure's stop reason and message, and timings.
 * @returns a record whose counts are zero and whose stop reason names the failure.
 */
export declare function failureRecord(context: {
    readonly runId: string;
    readonly preset: string;
    readonly task: string;
    readonly layers: readonly CouncilLayerRecord[];
    readonly narration: CouncilRunNarration;
    readonly stopReason: string;
    readonly error: string;
    readonly agentsStarted: number;
    readonly durationMs: number;
}): CouncilResultRecord;
interface CouncilArgs {
    task: string;
    preset?: string;
}
export declare function presentCall(args: CouncilArgs): ToolCallView;
export declare function presentResult(args: CouncilArgs, result: ToolResult): ToolResultView;
/**
 * Recognize one of this plugin's run artifacts in a `tool/result` meta payload.
 *
 * Presenters run on REPLAY of arbitrary logged results, including ones written
 * by another build, so the shape is checked rather than assumed.
 * @param meta - the persisted presentation payload.
 * @returns the artifact, or undefined when the payload is not one.
 */
export declare function readArtifact(meta: unknown): CouncilResultRecord | undefined;
/**
 * Register the council tool and its usage policy.
 * @param ctx - the plugin context; `inject` guarantees the four services.
 * @param config - the loader-normalized deployment configuration.
 */
export declare function apply(ctx: Context, config: Config): void;
