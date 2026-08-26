/**
 * The council's HOST-plane row, mounted under the package's BARE name.
 *
 * Why the installer, not the tool, owns the bare name. Two constraints meet
 * here. The preset cannot install itself — a row living only inside the
 * `map-reduce` composition never runs until someone selects a mode that does
 * not exist yet — so the installer must sit on the host plane, which is
 * composed unconditionally. And the client module system serves a package's
 * browser bundle only for an entry whose name IS the package name: it resolves
 * `<entry>/package.json`, which a subpath row like `dsh-tool-council/tool` can
 * never satisfy. So the row that is always composed has to be the bare one, or
 * the settings card is never served.
 *
 * That fixes the split: bare name → this host row (preset publication, settings
 * ownership, browser bundle carrier); `./tool` subpath → the model-facing tool,
 * mounted by the preset it publishes.
 *
 * This row registers no tool and no prompt section, so composing it costs the
 * model nothing in any mode. It owns the `council` settings namespace: the
 * section lives on the always-composed host plane, so the browser card can
 * reach it in every mode, and the tool row (agent plane, mounted by the
 * published preset) reads it at call time.
 *
 * @module @starsinc1708/dsh-tool-council
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { CouncilSettings } from './settings.ts';
import type { Config as CouncilConfig } from './policy.ts';
/** Cordis plugin name for the host row. */
export declare const name = "tool-council-host";
/** Deployment policy for preset publication and settings ownership. */
export interface Config {
    /**
     * Publish the preset. `false` leaves `$DSH_HOME` untouched — the council is
     * then reachable only from a mode whose composition mounts the tool row by
     * hand.
     */
    installPreset?: boolean;
    /** Roster id and directory name of the published preset. */
    presetId?: string;
    /** Preset whose composition the published one is derived from. */
    presetSource?: string;
    /** Display name in the mode menu; rendered verbatim, never translated. */
    presetName?: string;
    /** Display description in the mode menu; rendered verbatim. */
    presetDescription?: string;
    /** Sort order in the mode menu. */
    presetOrder?: number;
    /**
     * Module specifier the published preset mounts the council tool by. A subpath
     * row deliberately: the bare name is this host row, already composed.
     */
    presetPluginName?: string;
    /**
     * The council's deployment policy — the tool's own configuration. Owned here,
     * on the always-composed row, so the settings card can mirror the deployment's
     * real topology in every mode and the published preset can mount the tool
     * with the same policy. Omitted → the tool's schema defaults (the four
     * shipped topologies, `spawn`, `council`, default ceilings).
     */
    councilPolicy?: CouncilConfig;
}
/**
 * User-plane schema for the `council` settings section. `topology` is written
 * by the composition as the section's `base` layer and is never a user field;
 * it exists so the settings card can render the deployment's real layers.
 */
export declare const CouncilSettingsSchema: z<CouncilSettings>;
/** Schemastery configuration for the host row. */
export declare const Config: z<Config>;
/**
 * Render the rows appended to the source composition.
 *
 * The council tool injects the workflow engine, which is a SERVICE — and on the
 * agent plane a service row must sit inside a group carrying an `isolate` realm
 * or it publishes process-global and collides with every other preset. So the
 * tool ships inside its own entry-local group together with a private
 * `workflow-worker-thread` provider, exactly mirroring the delegation group the
 * standard preset already carries (whose isolated engine is invisible outside
 * that group).
 * @param pluginName - module specifier to mount.
 * @param toolConfig - YAML mapping lines for the tool row's `config`, or empty.
 * @returns the YAML list entries to append.
 */
export declare function composeRows(pluginName: string, toolConfig: string): string;
/**
 * Register the host row: own the `council` settings namespace and publish the
 * Map-Reduce preset.
 * @param ctx - the plugin context; the roster and settings are read optionally.
 * @param config - the loader-normalized configuration.
 */
export declare function apply(ctx: Context, config: Config): void;
