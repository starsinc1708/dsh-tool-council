/**
 * Publishes the council as an agent PRESET — the entry the Web composer's mode
 * menu lists beside Standard, PTC, Minimal and Creator.
 *
 * A preset is a directory under a roster root holding `agent.cordis.yml` (the
 * agent-plane composition) and `preset.yml` (its display metadata). The roster
 * always scans `$DSH_HOME/.agent-presets` — that is `dsh-agent-presets`' own
 * `includeUserRoot` default — so writing a directory there is the whole
 * installation. Discovery is unmemoized, so the mode appears without a restart.
 *
 * Deriving rather than vendoring. The composition is a WHOLE agent plane, not a
 * delta: `standard` is ~250 rows. Shipping a snapshot of it would silently drift
 * from the harness on every upgrade and compose a mode out of last release's
 * rows. So the source text is read back from the installed roster through
 * `read()` and this package appends only its own rows — the mode is always the
 * current harness plus the council.
 *
 * Why the roster is read structurally. `@deepseek-ai/dsh-agent-presets` is
 * supplied by the harness installation, not by this package, and the npm-published
 * copy lags the installed one. Naming the shape here rather than importing it
 * keeps the plugin loadable against either, and the two members used are the ones
 * the service README documents.
 *
 * @module @deepseek-ai/dsh-tool-council
 */
/** One roster root, as `ctx.agentPresets.roots` reports it. */
export interface PresetRootLike {
    /** Absolute directory the roster scans. */
    readonly path: string;
    /** `user` roots are writable; `system` roots ship with the deployment. */
    readonly trust: string;
}
/** The slice of `ctx.agentPresets` this installer uses. */
export interface AgentPresetsLike {
    /** Every configured root in order, then the derived harness-home root. */
    readonly roots: readonly PresetRootLike[];
    /** One preset's composition text, exactly as stored. */
    read: (id: string) => Promise<string>;
}
/** What the installer was asked to publish. */
export interface PresetInstallOptions {
    /** Directory name and roster id. Must match `[a-z0-9][a-z0-9-]*`. */
    readonly presetId: string;
    /** Preset whose composition is the base. */
    readonly sourceId: string;
    /** Display name, rendered verbatim — a user-trust preset is never translated. */
    readonly name: string;
    /** Display description, rendered verbatim. */
    readonly description: string;
    /** Roster sort order. */
    readonly order: number;
    /** The rows appended to the source composition, already YAML. */
    readonly rows: string;
}
/**
 * What the installer did. Every arm is a normal outcome except `failed`: a
 * deployment with no roster, no writable root, or no source preset is a valid
 * deployment that simply cannot carry a mode, and the tool still registers.
 */
export type PresetInstallOutcome = {
    readonly kind: 'installed';
    readonly path: string;
} | {
    readonly kind: 'unchanged';
    readonly path: string;
} | {
    readonly kind: 'skipped';
    readonly reason: string;
} | {
    readonly kind: 'failed';
    readonly reason: string;
};
/**
 * Compose the preset's `agent.cordis.yml` from its source composition.
 *
 * The stamp covers the source text AND the appended rows, so an upgraded
 * harness (new source) and a reconfigured council (new rows) both invalidate an
 * installed copy, while a byte-identical derivation rewrites nothing.
 * @param source - the source preset's composition text, verbatim.
 * @param rows - this package's rows, as YAML list entries.
 * @param sourceId - the source preset's id, recorded in the header.
 * @returns the composition text to write, stamp included.
 */
export declare function composePreset(source: string, rows: string, sourceId: string): string;
/**
 * Read the stamp a previously installed composition carries.
 * @param text - an installed `agent.cordis.yml`.
 * @returns the stamp, or undefined when the file is absent or hand-written.
 */
export declare function readStamp(text: string): string | undefined;
/**
 * Render `preset.yml`. The roster localizes only `system`-trust built-ins, so a
 * user-trust preset's own metadata is what the mode menu shows, verbatim.
 * @param options - the display metadata.
 * @returns the file text.
 */
export declare function composeMetadata(options: PresetInstallOptions): string;
/**
 * Publish the council preset into the roster's writable root, idempotently.
 *
 * Never throws for a deployment that cannot carry a preset — the tool itself
 * stays usable in whatever mode the deployment does compose.
 * @param presets - the roster service, or undefined when none is composed.
 * @param options - what to publish.
 * @returns what happened, for the caller to log.
 */
export declare function ensurePreset(presets: AgentPresetsLike | undefined, options: PresetInstallOptions): Promise<PresetInstallOutcome>;
