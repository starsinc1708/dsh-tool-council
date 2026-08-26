/**
 * The council's deployment policy: the schema, the structural validation, and
 * the role expansion. Owned here, apart from the tool and the host rows, so the
 * always-composed host row can validate the same policy it publishes and mirrors
 * without dragging in the tool's `ctx.tools`/workflow dependencies.
 *
 * @module @deepseek-ai/dsh-tool-council
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
    /** Ceiling on one serialized finding's characters (default 2000). */
    maxFindingChars?: number;
    /** Ceiling on the parent-facing report's characters (default 32768). */
    maxReportChars?: number;
}
/** Schemastery configuration for the council tool. */
export declare const Config: z<Config>;
export interface ResolvedConfig {
    readonly toolName: string;
    readonly subagentProvider: string;
    readonly presets: readonly PresetConfig[];
    readonly defaultPreset: PresetConfig;
    readonly maxFindings: number;
    readonly maxFindingChars: number;
    readonly maxReportChars: number;
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
 * Expand `RoleConfig.count` into the concrete instances the script fans out.
 *
 * A single-instance role keeps its bare id so the report's column header reads
 * `V1`, not `V1#1`.
 * @param preset - the preset whose layers are being expanded.
 * @returns the script-facing layers, in composition order.
 */
export declare function expandLayers(preset: PresetConfig): ScriptLayer[];
