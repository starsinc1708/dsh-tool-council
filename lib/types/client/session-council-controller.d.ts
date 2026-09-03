/**
 * Staged-editor controller for one session's council setup.
 *
 * The designer edits a DRAFT over the deployment's mirrored topology — one
 * chosen preset, its layers and roles as nodes, plus roles and map layers the
 * session AUTHORS itself — or builds a fully custom (from-scratch) council
 * (`custom: true`), and lands the result in the `council` settings namespace
 * under `sessionCouncil[sessionId]` with one Save. The reusable "My roles"
 * and "My presets" libraries live in the same section (`roleLibrary` /
 * `presetLibrary`) and survive across sessions.
 *
 * Everything is derived here, not in the component, so the dirty flag, the
 * projected document and the validation can never disagree.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { CouncilSettings, QuorumRule, SessionCouncilSetup, SessionRoleTune, TopologyPreset } from '@starsinc1708/dsh-tool-council/types';
import type { PresetTemplate, RoleTemplate, SessionQuorumTune } from '../settings.ts';
import type { LayerKind } from '../types.ts';
/**
 * One role this session authors. Unlike a tuning (which edits an existing
 * role), an authored role carries its own prompt — the whole lens.
 */
export interface AuthoredRole {
    readonly id: string;
    readonly label: string;
    readonly prompt: string;
    readonly count?: number;
    readonly model?: string;
    readonly provider?: string;
}
/**
 * One layer this session authors: a map layer added under a preset, or a node
 * of a fully custom topology (`kind` set). Roles live inside the layer.
 */
export interface AuthoredLayer {
    readonly id: string;
    readonly label?: string;
    /** Omitted = map (the only kind a preset-anchored session may add). */
    readonly kind?: LayerKind;
    readonly roles: AuthoredRole[];
    /** Verify-layer quorum; only meaningful when `kind` is `verify`. */
    readonly quorum?: SessionQuorumTune;
}
/** The live draft: what the panel is currently showing and editing. */
export interface CouncilDraft {
    /** Preset id of the mirrored topology, or '' for a fully custom council. */
    readonly presetId: string;
    /** Display name (custom councils; also the session's fixed label). */
    readonly name: string;
    /** True when the council is built from scratch (no mirrored preset). */
    readonly custom: boolean;
    /** True when the verify layer runs; only meaningful for presets that have one. */
    readonly verifyEnabled: boolean;
    /** Staged tunings of EXISTING roles, keyed `${layerId}.${roleId}`. */
    readonly roles: Record<string, SessionRoleTune>;
    /** Staged quorum override for the verify layer. */
    readonly quorum?: SessionQuorumTune;
    /** Authored roles appended to existing map/verify layers, by layer id. */
    readonly addRoles: Record<string, AuthoredRole[]>;
    /** Authored map layers added under the mirrored preset (map kind). */
    readonly addLayers: AuthoredLayer[];
    /** The whole topology when `custom` (kinds included). */
    readonly topology: AuthoredLayer[];
}
/** The value one session chose, or the empty draft. */
export declare function emptyDraft(presetId: string, hasVerify: boolean): CouncilDraft;
/** A fresh custom (from-scratch) draft: empty chain, nothing anchored. */
export declare function customDraft(): CouncilDraft;
/**
 * Load a session's stored setup into an editable draft.
 * @param presetId - the preset the draft should edit ('' for custom).
 * @param presetHasVerify - whether that preset declares a verify layer.
 * @param stored - the stored setup, or undefined.
 * @returns the draft.
 */
export declare function draftOf(presetId: string, presetHasVerify: boolean, stored: SessionCouncilSetup | undefined): CouncilDraft;
/** The composed mirror data one draft edit needs for pruning decisions. */
export interface BaselineRole {
    readonly layerId: string;
    readonly roleId: string;
    readonly count: number;
    readonly model: string;
    readonly provider: string;
}
/** Find one mirrored preset by id. */
export declare function presetOf(presets: readonly TopologyPreset[] | undefined, id: string): TopologyPreset | undefined;
/** A verify layer's composed quorum, for effective-value display. */
export declare function verifyLayerOf(preset: TopologyPreset): TopologyPreset['layers'][number] | undefined;
/** The mirror data of one existing role inside a preset, when it exists. */
export declare function baselineOf(preset: TopologyPreset, key: string): BaselineRole | undefined;
/** Set one existing role's absolute count in the draft. */
export declare function setCount(draft: CouncilDraft, key: string, count: number): CouncilDraft;
/** Point one existing role at a provider + model pair ('' clears). */
export declare function setRoutePair(draft: CouncilDraft, key: string, provider: string, model: string): CouncilDraft;
/**
 * Override one EXISTING role's prompt for this session. Empty text removes
 * the override and re-inherits the composed prompt.
 */
export declare function setPromptTune(draft: CouncilDraft, key: string, prompt: string): CouncilDraft;
/** Toggle the verify layer (preset-anchored drafts). */
export declare function setVerify(draft: CouncilDraft, presetHasVerify: boolean, enabled: boolean): CouncilDraft;
/** Set the verify layer's quorum (preset-anchored drafts). */
export declare function setQuorum(draft: CouncilDraft, rule: QuorumRule, threshold?: number): CouncilDraft;
/** Every id already claimed (preset roles/layers plus authored nodes). */
export declare function claimedIds(preset: TopologyPreset | undefined, draft: CouncilDraft): Set<string>;
/** A URL-ish slug, lowercased, punctuation dropped. */
export declare function slugify(value: string): string;
/** Mint an id unique within the preset from a label. */
export declare function mintId(label: string, taken: Set<string>): string;
/** Append one authored role to an existing map/verify layer. */
export declare function addRole(draft: CouncilDraft, layerId: string, role: AuthoredRole): CouncilDraft;
/** Replace one authored role of an existing layer. */
export declare function updateRole(draft: CouncilDraft, layerId: string, roleId: string, patch: Partial<AuthoredRole>): CouncilDraft;
/** Drop one authored role of an existing layer. */
export declare function removeRole(draft: CouncilDraft, layerId: string, roleId: string): CouncilDraft;
/** Append one authored map layer under the mirrored preset. */
export declare function addLayer(draft: CouncilDraft, layer: AuthoredLayer): CouncilDraft;
/** Drop one whole authored map layer under the mirrored preset. */
export declare function removeAuthoredLayer(draft: CouncilDraft, layerId: string): CouncilDraft;
/** Append an authored role to an authored map layer. */
export declare function addLayerRole(draft: CouncilDraft, layerId: string, role: AuthoredRole): CouncilDraft;
/** Replace one authored role of an authored map layer. */
export declare function updateLayerRole(draft: CouncilDraft, layerId: string, roleId: string, patch: Partial<AuthoredRole>): CouncilDraft;
/** Drop one authored role of an authored map layer. */
export declare function removeLayerRole(draft: CouncilDraft, layerId: string, roleId: string): CouncilDraft;
/** Append a node of the given kind to a custom topology. */
export declare function addCustomNode(draft: CouncilDraft, node: AuthoredLayer): CouncilDraft;
/** Set a custom node's label or quorum. */
export declare function patchCustomNode(draft: CouncilDraft, nodeId: string, patch: Partial<AuthoredLayer>): CouncilDraft;
/** Append an authored role to a custom node. */
export declare function addCustomRole(draft: CouncilDraft, nodeId: string, role: AuthoredRole): CouncilDraft;
/** Replace one authored role of a custom node. */
export declare function updateCustomRole(draft: CouncilDraft, nodeId: string, roleId: string, patch: Partial<AuthoredRole>): CouncilDraft;
/** Drop one authored role of a custom node. */
export declare function removeCustomRole(draft: CouncilDraft, nodeId: string, roleId: string): CouncilDraft;
/** Drop a whole custom node. */
export declare function removeCustomNode(draft: CouncilDraft, nodeId: string): CouncilDraft;
/**
 * The durable document one Save should write for a draft.
 *
 * Fields equal to the preset's own composition are dropped. For a custom
 * council the whole authored topology is stored with its name. Authored roles
 * and layers are kept whole (minus their defaults).
 * @param preset - the mirrored preset the draft edits (undefined for custom).
 * @param draft - the draft.
 * @returns the normalized setup to store.
 */
export declare function projectSetup(preset: TopologyPreset | undefined, draft: CouncilDraft): SessionCouncilSetup;
/** Whether two stored documents are the same normalized setup. */
export declare function setupsEqual(a: SessionCouncilSetup | undefined, b: SessionCouncilSetup | undefined): boolean;
/** What the panel renders. */
export interface CouncilDesignState {
    readonly status: 'loading' | 'ready' | 'unavailable';
    readonly writable: boolean;
    /** Preset id this council was published under — the designer's mode gate. */
    readonly councilPreset: string;
    readonly presets: readonly TopologyPreset[];
    /** Preset the deployment runs when nothing is configured (read-only mirror). */
    readonly defaultPreset: string;
    /** Per-layer member ceiling (read-only mirror). */
    readonly maxAgentsPerLayer: number;
    /** Per-preset layer ceiling (read-only mirror) — the "add layer" gate. */
    readonly maxLayers: number;
    readonly draft: CouncilDraft;
    /** Whether anything is staged but unsaved. */
    readonly dirty: boolean;
    /** Whether this session currently stores a setup at all. */
    readonly hasStored: boolean;
    /** Normalized document the current Save would write. */
    readonly staged: SessionCouncilSetup;
    /** "My roles" library, keyed by id. */
    readonly roleLibrary: Record<string, RoleTemplate>;
    /** "My presets" library, keyed by id. */
    readonly presetLibrary: Record<string, PresetTemplate>;
    /** Layers the staged draft would push past the ceiling. */
    readonly widthViolations: ReadonlyArray<{
        readonly layerId: string;
        readonly width: number;
        readonly max: number;
    }>;
    /** A staged threshold the verify layer's own width cannot reach, if any. */
    readonly quorumViolation: {
        readonly rule: QuorumRule;
        readonly threshold: number;
        readonly width: number;
    } | undefined;
    /** Structural problem of a custom topology, surfaced before the host would refuse. */
    readonly customError: string | undefined;
    /** The last write's rejection, cleared on the next edit. */
    readonly error: string;
}
/** Minimal observable the renderer binds into a `use…` hook. */
export interface Store<T> {
    getSnapshot(): T;
    subscribe(listener: () => void): () => void;
}
/** The custom-preset menu label prefix. */
export declare const CUSTOM_OPTION = "custom";
/**
 * Bridge the `council` settings namespace onto one session's designer.
 *
 * The draft lives here; the scope is read at publish time (fresh on every
 * save, so two sessions never clobber each other's documents).
 */
export declare class SessionCouncilController {
    private readonly scope;
    private readonly partialSaveMessage;
    private listeners;
    private snapshot;
    private draft;
    private selected;
    private error;
    private detachScope;
    private readonly sessionId;
    constructor(scope: SettingsScope<CouncilSettings>, sessionId: string, partialSaveMessage?: (error: string) => string);
    /** Detach from the scope. Owned by the dock entry's effect. */
    dispose(): void;
    /** @returns the observable the renderer binds as `useCouncilDesign`. */
    store(): Store<CouncilDesignState>;
    /** @returns the actions the slot injects alongside the store. */
    actions(): {
        selectPreset: (presetId: string) => void;
        startCustom: (fromTemplate?: PresetTemplate) => void;
        setName: (name: string) => void;
        setCount: (key: string, count: number) => void;
        setRoutePair: (key: string, provider: string, model: string) => void;
        setPrompt: (key: string, prompt: string) => void;
        setVerify: (enabled: boolean) => void;
        setQuorum: (rule: QuorumRule, threshold?: number) => void;
        addRoleTo: (layerId: string, role: AuthoredRole) => void;
        editRole: (layerId: string, roleId: string, patch: Partial<AuthoredRole>) => void;
        removeRole: (layerId: string, roleId: string) => void;
        addAuthoredLayer: (layer: AuthoredLayer) => void;
        removeAuthoredLayer: (layerId: string) => void;
        addLayerRole: (layerId: string, role: AuthoredRole) => void;
        editLayerRole: (layerId: string, roleId: string, patch: Partial<AuthoredRole>) => void;
        removeLayerRole: (layerId: string, roleId: string) => void;
        addCustomNode: (node: AuthoredLayer) => void;
        patchCustomNode: (nodeId: string, patch: Partial<AuthoredLayer>) => void;
        addCustomRole: (nodeId: string, role: AuthoredRole) => void;
        editCustomRole: (nodeId: string, roleId: string, patch: Partial<AuthoredRole>) => void;
        removeCustomRole: (nodeId: string, roleId: string) => void;
        removeCustomNode: (nodeId: string) => void;
        saveRoleToLibrary: (role: AuthoredRole) => void;
        deleteRoleFromLibrary: (roleId: string) => void;
        savePresetToLibrary: () => void;
        deletePresetFromLibrary: (presetId: string) => void;
        save: () => void;
        discard: () => void;
        clear: () => void;
    };
    /** Width cap a role stepper offers (the schema ceiling). */
    roleWidthCap(): number;
    private hasVerifyOf;
    private openPreset;
    private edit;
    private save;
    /** Write one session's setup into the `sessionCouncil` field. */
    private writeSetup;
    private saveRole;
    private deleteRole;
    private savePreset;
    private deletePreset;
    private publish;
}
