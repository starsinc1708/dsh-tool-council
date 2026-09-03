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
 * the browser bundle (the session designer, the Council tab) is never served.
 *
 * That fixes the split: bare name → this host row (preset publication, settings
 * ownership, browser bundle carrier); `./tool` subpath → the model-facing tool,
 * mounted by the preset it publishes.
 *
 * This row registers no tool and no prompt section, so composing it costs the
 * model nothing in any mode. It owns the `council` settings namespace: the
 * section lives on the always-composed host plane, so the composer-dock
 * designer and the Council tab can reach it in every mode, and the tool row
 * (agent plane, mounted by the published preset) reads it at call time.
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
     * on the always-composed row, so the composer-dock designer can mirror the
     * deployment's real topology in every mode and the published preset can mount
     * the tool with the same policy. Omitted → the tool's schema defaults (the
     * four shipped topologies, `spawn`, `council`, default ceilings).
     */
    councilPolicy?: CouncilConfig;
}
/**
 * Schema for the `council` settings section. `topology`, `maxAgentsPerLayer`,
 * and `agentPresetId` are written by the composition as the section's `base`
 * layer and are never user fields; they exist so the composer-dock designer
 * can render the deployment's real presets and layers and refuse an over-wide
 * session setup before the write, and so the Council tab can gate on the
 * preset id this deployment actually published.
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
 * The composition facts a user layer may not shadow, captured once.
 *
 * Captured — not recomputed — on purpose. `validate` runs LATER than `apply`
 * (inside `ctx.inject(['settings'], …)`), so anything read from the live
 * context inside it can legitimately differ from what the base layer recorded.
 * When it does, `validate` throws, `register` throws, and the inject callback's
 * rejection is swallowed: the namespace silently never registers and every
 * surface that depends on it — the session designer and the Council tab above
 * all — just disappears, with no error in any log. Passing the values in makes
 * that mistake unexpressible.
 */
export interface CouncilMirrors {
    /** `JSON.stringify` of the composition's topology projection. */
    readonly topologyJson: string;
    readonly maxAgentsPerLayer: number;
    readonly maxLayers: number;
    readonly agentPresetId: string;
    readonly defaultPresetId: string;
}
/**
 * Refuse a user layer that shadows a composition mirror.
 *
 * The designer reads all three: `topology` decides which presets and layers it
 * draws, `maxAgentsPerLayer` its ceiling checks, `agentPresetId` the Council
 * tab's gate. Shadowing any of them would move what the surfaces believe
 * without moving what the tool runs.
 * @param value - the resolved section (composition base under the user layer).
 * @param mirrors - the composition's own values, captured at registration.
 * @throws TypeError naming the field a user layer tried to set.
 */
export declare function assertMirrorsUnchanged(value: CouncilSettings, mirrors: CouncilMirrors): void;
/**
 * Register the host row: own the `council` settings namespace and publish the
 * Map-Reduce preset.
 * @param ctx - the plugin context; the roster and settings are read optionally.
 * @param config - the loader-normalized configuration.
 */
export declare function apply(ctx: Context, config: Config): void;
