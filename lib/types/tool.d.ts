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
import type { Config } from './policy.ts';
import type { ClusteredFinding, Tally, VerifierBallot } from './types.ts';
export type * from './types.ts';
export type * from './settings.ts';
export { BUILTIN_PRESETS } from './presets.ts';
export { Config, expandLayers, resolveConfig } from './policy.ts';
export type { ResolvedConfig } from './policy.ts';
export { COUNCIL_NAMESPACE, applyOverrides } from './settings.ts';
export { applyQuorum, dedupeFindings, fingerprint, normalizeLocation, renderTable, tally, } from './tally.ts';
export declare const name = "tool-council";
export declare const inject: string[];
/** The script's terminal value, after the host re-validated it. */
interface CouncilOutcome {
    readonly findings: readonly ClusteredFinding[];
    readonly ballots: readonly VerifierBallot[];
    readonly tally: Tally | null;
    readonly report: string;
    readonly membersReporting: number;
}
/**
 * Defensively decode the script's terminal value across the realm boundary.
 * @param value - the workflow result value, as plain cloned data.
 * @returns the decoded outcome.
 * @throws Error when the value does not match the script's declared shape.
 */
export declare function readOutcome(value: unknown): CouncilOutcome;
/**
 * Render the council's result for the parent model.
 *
 * The quorum line is deliberately phrased as a count of members, not as a
 * certification: verifiers are agents re-reading the same repository, and the
 * table would otherwise read as an independent oracle.
 * @param outcome - the validated script outcome.
 * @param maxChars - the report ceiling.
 * @returns the model-facing text.
 */
export declare function renderOutcome(outcome: CouncilOutcome, maxChars: number): string;
/**
 * Register the council tool and its usage policy.
 * @param ctx - the plugin context; `inject` guarantees the four services.
 * @param config - the loader-normalized deployment configuration.
 */
export declare function apply(ctx: Context, config: Config): void;
