/**
 * Staged-form controller for the council settings card.
 *
 * `ui-settings-plugins` ships a generic `CardForm` and field chrome, but the
 * client bundle-purity gate forbids importing values across plugins, so this
 * is a purpose-built copy — and a smaller one: the council's writable surface
 * is a preset selection plus a sparse override map, not a flat field list, so
 * the generic staged form would not have fit anyway.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { CouncilSettings, PresetOverride, QuorumRule, TopologyPreset } from '@starsinc1708/dsh-tool-council/types';
/** A verify layer whose staged threshold cannot be satisfied by its own width. */
export interface QuorumViolation {
    readonly presetId: string;
    readonly layerId: string;
    readonly threshold: number;
    readonly width: number;
}
/** A layer whose staged width exceeds the deployment's ceiling. */
export interface WidthViolation {
    /** The preset the layer belongs to — layer ids repeat across presets. */
    readonly presetId: string;
    readonly layerId: string;
    readonly width: number;
    readonly max: number;
}
/**
 * How much of the composition the staged overlay is currently changing.
 *
 * Computed here rather than in the card for two reasons: it is the number the
 * tab badges and the summary line both read, and a count that disagrees with
 * itself between the two is exactly how a role ends up badged `overridden` at
 * its default value with nobody able to find it.
 */
export interface OverrideCounts {
    /** Overrides per preset id. A preset with none is ABSENT, never zero. */
    readonly byPreset: Readonly<Record<string, number>>;
    /** Role plus quorum overrides across every preset. */
    readonly total: number;
    /** How many presets carry at least one. */
    readonly presets: number;
}
/**
 * Count the role and quorum overrides in an overlay.
 *
 * Roles and quorums are counted together because they are the same thing to the
 * reader: a difference from what this deployment composed. An entry that
 * survived with empty maps counts as nothing and is left out of `byPreset`, so
 * `presets` never counts a preset whose badge would read `·0`.
 * @param overrides - the staged (or saved) overlay.
 * @returns the per-preset counts and the two totals.
 */
export declare function countOverrides(overrides: Record<string, PresetOverride>): OverrideCounts;
/** What the card renders. */
export interface CouncilCardState {
    readonly status: 'loading' | 'ready' | 'unavailable';
    readonly writable: boolean;
    /** The deployment's topology, as the Host mirrored it into the section. */
    readonly presets: readonly TopologyPreset[];
    /** Which preset the card is currently showing. */
    readonly selected: string;
    /** Preset the tool uses when the model names none. */
    readonly defaultPreset: string;
    /** Staged overrides, merged over what the Host last accepted. */
    readonly overrides: Record<string, PresetOverride>;
    /**
     * How many overrides the overlay carries, per preset and in total.
     *
     * The tab badges and the summary line both read this, so a preset whose
     * overrides are on a tab nobody opened is still visible from the outside —
     * which is what stops an override being lost behind three closed tabs.
     */
    readonly overrideCounts: OverrideCounts;
    /** The deployment's per-layer width ceiling, mirrored by the Host. */
    readonly maxAgentsPerLayer: number;
    /** Blended $ per 1M tokens for the Council tab's estimate; 0 means off. */
    readonly costPerMillionTokens: number;
    /** Agents one run of the shown preset would start, with the staging applied. */
    readonly totalAgents: number;
    /**
     * Layers the staged overlay would push past the ceiling, across EVERY preset:
     * the overrides map is written as one field, so a violation the user cannot
     * currently see would still be rejected by the Host. The card refuses it
     * first, naming the preset as well as the layer.
     */
    readonly widthViolations: readonly WidthViolation[];
    /**
     * Verify layers whose staged `threshold` is outside `1..width`. The Host
     * refuses these too, and its refusal is a raw English TypeError — so the card
     * has to catch them itself, with the same bounds the Host uses.
     */
    readonly quorumViolations: readonly QuorumViolation[];
    /** Whether anything is staged but unsaved. */
    readonly dirty: boolean;
    /** The last write's rejection, cleared on the next edit. */
    readonly error: string;
}
/** Minimal observable the renderer binds into a `use…` hook. */
export interface Store<T> {
    getSnapshot(): T;
    subscribe(listener: () => void): () => void;
}
/**
 * Recognize an overrides document pasted into the card.
 * @param value - parsed JSON of unknown shape.
 * @returns the document, or undefined when it is not one.
 */
export declare function readOverridesDocument(value: unknown): Record<string, PresetOverride> | undefined;
/**
 * Every layer of every preset whose overlaid width exceeds the ceiling.
 * @param presets - the mirrored topology.
 * @param overrides - the staged overlay.
 * @param max - the deployment's `maxAgentsPerLayer`.
 * @returns one entry per offending layer, in composition order.
 */
export declare function widthViolations(presets: readonly TopologyPreset[], overrides: Record<string, PresetOverride>, max: number): WidthViolation[];
/**
 * Every verify layer whose overlaid threshold its own width cannot satisfy.
 *
 * The bounds match `resolveConfig`'s: a `threshold` quorum needs a whole number
 * between 1 and the layer's width, counting the staged width overrides.
 * @param presets - the mirrored topology.
 * @param overrides - the staged overlay.
 * @returns one entry per offending verify layer, in composition order.
 */
export declare function quorumViolations(presets: readonly TopologyPreset[], overrides: Record<string, PresetOverride>): QuorumViolation[];
/**
 * Bridge the `council` settings namespace onto the card.
 *
 * Edits stage locally and land in one `set('overrides', …)` write, because the
 * overrides map is a single scalar field from the settings document's point of
 * view: writing it per-role would let a rejected write leave the map half
 * applied.
 */
export declare class CouncilCardController {
    private readonly scope;
    /**
     * How to phrase a half-applied save. Injected so the controller stays free
     * of the locale service, which is a different plugin's value.
     */
    private readonly partialSaveMessage;
    private listeners;
    private snapshot;
    private staged;
    private stagedDefault;
    private stagedCost;
    private selected;
    private error;
    private detachUnloadGuard;
    /**
     * Release for the settings-scope subscription.
     *
     * Held, not discarded: a controller that keeps publishing after `dispose()`
     * is not merely wasteful. `syncUnloadGuard` would see it dirty with no guard
     * attached and attach a FRESH `beforeunload` handler whose detach closure
     * nothing can ever call again — one hot reload with staged edits and the
     * browser asks "leave site?" for the rest of the session.
     */
    private detachScope;
    constructor(scope: SettingsScope<CouncilSettings>, 
    /**
     * How to phrase a half-applied save. Injected so the controller stays free
     * of the locale service, which is a different plugin's value.
     */
    partialSaveMessage?: (error: string) => string);
    /**
     * Detach from the scope and drop the unload guard. Owned by the client
     * plugin's effect, which calls it on dispose and on hot reload.
     */
    dispose(): void;
    /**
     * Keep a `beforeunload` guard attached exactly while edits are staged.
     *
     * The browser shows only its own generic dialog and an in-app route change
     * never reaches this event — so the badge in the card, not this, is the
     * primary signal. This catches the one case the badge cannot: closing the tab.
     * @param dirty - whether anything is staged but unsaved.
     */
    private syncUnloadGuard;
    /** @returns the observable the renderer binds as `useCouncilCard`. */
    store(): Store<CouncilCardState>;
    /** @returns the actions the slot injects alongside the store. */
    actions(): {
        selectPreset: (presetId: string) => void;
        setDefaultPreset: (presetId: string) => void;
        /** Stage the viewer's blended token rate; `0` turns the estimate off. */
        setCostRate: (rate: number) => void;
        setRoleCount: (layerId: string, roleId: string, count: number) => void;
        setRoleModel: (layerId: string, roleId: string, model: string) => void;
        setRoleProvider: (layerId: string, roleId: string, provider: string) => void;
        /** Drop every override for one role and re-inherit the composition. */
        revertRole: (layerId: string, roleId: string) => void;
        setQuorum: (layerId: string, rule: QuorumRule, threshold?: number) => void;
        discard: () => void;
        save: () => void;
        /** Drop every override for the shown preset and re-inherit the composition. */
        resetPreset: () => void;
        /**
         * Drop the WHOLE overlay, every preset at once.
         *
         * Staged like every other edit rather than written straight through: it
         * is the most destructive control on the card, so it has to be
         * discardable, and it has to mark the card dirty so the badge and the
         * unload guard both say something is pending.
         */
        resetAll: () => void;
        /** @returns the current overrides map as an indented JSON document. */
        exportOverrides: () => string;
        /**
         * Stage a whole overrides document pasted by the user.
         * @param text - the JSON document.
         * @returns true when it parsed; false leaves the staging untouched.
         */
        importOverrides: (text: string) => boolean;
    };
    private editRole;
    /** Write one preset's entry into the draft, pruning it away when it is empty. */
    private commit;
    private draft;
    private currentPresetId;
    private save;
    private publish;
}
