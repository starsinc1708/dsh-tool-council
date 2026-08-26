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
 * Bridge the `council` settings namespace onto the card.
 *
 * Edits stage locally and land in one `set('overrides', …)` write, because the
 * overrides map is a single scalar field from the settings document's point of
 * view: writing it per-role would let a rejected write leave the map half
 * applied.
 */
export declare class CouncilCardController {
    private readonly scope;
    private listeners;
    private snapshot;
    private staged;
    private stagedDefault;
    private selected;
    private error;
    constructor(scope: SettingsScope<CouncilSettings>);
    /** @returns the observable the renderer binds as `useCouncilCard`. */
    store(): Store<CouncilCardState>;
    /** @returns the actions the slot injects alongside the store. */
    actions(): {
        selectPreset: (presetId: string) => void;
        setDefaultPreset: (presetId: string) => void;
        setRoleCount: (layerId: string, roleId: string, count: number) => void;
        setRoleModel: (layerId: string, roleId: string, model: string) => void;
        setQuorum: (layerId: string, rule: QuorumRule, threshold?: number) => void;
        discard: () => void;
        save: () => void;
        /** Drop every override for the shown preset and re-inherit the composition. */
        resetPreset: () => void;
    };
    private editRole;
    private draft;
    private currentPresetId;
    private save;
    private publish;
}
