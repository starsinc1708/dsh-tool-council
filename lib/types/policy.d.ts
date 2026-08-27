/**
 * The council's deployment policy: the schema, the structural validation, and
 * the role expansion. Owned here, apart from the tool and the host rows, so the
 * always-composed host row can validate the same policy it publishes and mirrors
 * without dragging in the tool's `ctx.tools`/workflow dependencies.
 *
 * @module @starsinc1708/dsh-tool-council
 */
import z from '@deepseek-ai/schemastery';
import type { ScriptLayer } from './script.ts';
import type { PresetConfig } from './types.ts';
/** Deployment policy for the council tool. */
export interface Config {
    /** Model-facing tool name. Defaults to `council`. */
    toolName?: string;
    /** Fresh structured-output provider every child uses (default `spawn`). */
    subagentProvider?: string;
    /** The topologies this deployment offers. Defaults to {@link BUILTIN_PRESETS}. */
    presets?: PresetConfig[];
    /** Preset used when the model names none. Must be one of `presets`. */
    defaultPreset?: string;
    /** Ceiling on one layer's concurrent children (default 12). */
    maxAgentsPerLayer?: number;
    /** Ceiling on a preset's layer count (default 6). */
    maxLayers?: number;
    /** Ceiling on findings carried into the verify layer (default 200). */
    maxFindings?: number;
    /**
     * Ceiling on findings one member contributes before clustering (default 50).
     * `0` disables it. Without a per-member cap one talkative member can fill
     * `maxFindings` and the quieter members never reach the slice.
     */
    maxFindingsPerMember?: number;
    /** Ceiling on one serialized finding's characters (default 2000). */
    maxFindingChars?: number;
    /** Ceiling on the parent-facing report's characters (default 32768). */
    maxReportChars?: number;
    /**
     * Wall-clock budget for one run in milliseconds; `0` (the default) disables
     * it. The script checks it at each layer boundary and still runs the trailing
     * reduce layer, so an over-budget run returns partial findings with an
     * explicit stop reason rather than nothing. The host cancels the run outright
     * once the budget plus {@link HARD_STOP_GRACE_MS} has passed — the backstop
     * for a layer that never settles, and the only enforcement left if the worker
     * realm exposes no clock. A layer already running is never cut short, so this
     * bounds how long a run keeps spending, not when it stops.
     */
    maxRunMs?: number;
    /**
     * Re-issue one `agent()` call whose child died before giving up on that role
     * (default true). A dead child resolves to `null` instead of throwing, so
     * without this a transport failure silently removes a whole lens.
     */
    retryFailedMembers?: boolean;
    /**
     * Run the merge stage between clustering and verification (default true).
     * It spends one extra child ONLY when two clusters share a location, which is
     * exactly the case the lexical key cannot decide.
     */
    mergeSameLocation?: boolean;
    /** Ceiling on clusters handed to the merge stage (default 60). */
    maxMergeCandidates?: number;
}
/**
 * Grace added to `maxRunMs` before the host cancels the run outright. The
 * script's own budget check happens at layer boundaries, so it needs room to
 * finish the layer it is in and write the report.
 */
export declare const HARD_STOP_GRACE_MS = 60000;
/** Schemastery configuration for the council tool. */
export declare const Config: z<Config>;
export interface ResolvedConfig {
    readonly toolName: string;
    readonly subagentProvider: string;
    readonly presets: readonly PresetConfig[];
    readonly defaultPreset: PresetConfig;
    readonly maxAgentsPerLayer: number;
    readonly maxFindings: number;
    readonly maxFindingsPerMember: number;
    readonly maxFindingChars: number;
    readonly maxReportChars: number;
    readonly maxRunMs: number;
    readonly retryFailedMembers: boolean;
    readonly mergeSameLocation: boolean;
    readonly maxMergeCandidates: number;
}
/**
 * Validate the composition at load, not at call.
 *
 * Schemastery cannot express the structural rules a council depends on — one
 * trailing reduce layer with exactly one role, a quorum exactly where a verify
 * layer is, unique ids — and a topology that violates them produces a run that
 * silently drops a layer instead of failing. A bad config must break the
 * deployment.
 * @param config - the loader-normalized configuration.
 * @returns the validated policy every call reuses.
 * @throws TypeError on any structural violation, naming the offending preset.
 */
export declare function resolveConfig(config: Config): ResolvedConfig;
/**
 * The run's `maxTotalAgents` ceiling.
 *
 * `maxTotalAgents` is a hard engine cap, not a budget: a call past it kills the
 * run with `AGENT_CAP`. So it has to allow for everything the script may
 * legitimately spend — one retry per member when `retryFailedMembers` is on,
 * and one merge child when the merge stage is enabled — or a single dead child
 * would turn a degraded run into a failed one.
 * @param layers - the expanded layers of the preset being run.
 * @param options - whether retries and the merge stage are enabled.
 * @returns the ceiling to hand `WorkflowEngine.start`.
 */
export declare function totalAgentBudget(layers: readonly ScriptLayer[], options: {
    readonly retryFailedMembers: boolean;
    readonly mergeSameLocation: boolean;
}): number;
/**
 * Expand `RoleConfig.count` into the concrete instances the script fans out.
 *
 * A single-instance role keeps its bare id so the report's column header reads
 * `V1`, not `V1#1`.
 * @param preset - the preset whose layers are being expanded.
 * @returns the script-facing layers, in composition order.
 */
export declare function expandLayers(preset: PresetConfig): ScriptLayer[];
