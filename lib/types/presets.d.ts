/**
 * The shipped council topologies and their role prompts.
 *
 * A role's whole identity is its prompt text plus its optional model route:
 * the workflow `agent()` hook accepts neither a persona nor a tool filter, so
 * these strings are the only lens a deployment has. They are exported so a
 * composition can start from one and override a single field in `cordis.yml`
 * rather than restating a topology.
 *
 * @module @starsinc1708/dsh-tool-council
 */
import type { PresetConfig } from './types.ts';
/** The four shipped topologies. */
export declare const BUILTIN_PRESETS: readonly PresetConfig[];
