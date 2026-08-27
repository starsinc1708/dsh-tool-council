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
    constructor(scope: SettingsScope<CouncilSettings>, 
    /**
     * How to phrase a half-applied save. Injected so the controller stays free
     * of the locale service, which is a different plugin's value.
     */
    partialSaveMessage?: (error: string) => string);
    /** Release the unload guard. Owned by the client plugin's effect. */
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
