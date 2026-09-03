/**
 * The `council` settings section: the deployment's read-only mirrors plus the
 * per-session council setups the Map-Reduce designer writes.
 *
 * Browser-safe: no cordis Context, no Agent, no host-only import. Everything
 * here is shared by the host (which composes a session's setup onto a real
 * preset) and the browser (which validates the same setup against the mirrors
 * before offering Save).
 *
 * @module @starsinc1708/dsh-tool-council/types
 */
import type { LayerKind, PresetConfig, QuorumRule } from './types.ts';
/** The settings namespace this package serves. */
export declare const COUNCIL_NAMESPACE = "council";
/** One role, as the designer needs to draw it — prompts deliberately excluded. */
export interface TopologyRole {
    readonly id: string;
    readonly label: string;
    readonly count: number;
    readonly model: string;
    readonly provider: string;
}
/** One layer, as the designer needs to draw it. */
export interface TopologyLayer {
    readonly id: string;
    readonly kind: LayerKind;
    readonly roles: readonly TopologyRole[];
    readonly quorumRule?: QuorumRule;
    readonly quorumThreshold?: number;
}
/** One preset, as the designer needs to draw it. */
export interface TopologyPreset {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly layers: readonly TopologyLayer[];
}
/**
 * One role's per-session tuning, keyed `${layerId}.${roleId}` in the setup.
 * An absent field inherits the composed preset; an empty model/provider route
 * also means inherit (the composed route survives); `count` is the ABSOLUTE
 * width of the role — the number of concurrent instances this session starts.
 */
export interface SessionRoleTune {
    count?: number;
    model?: string;
    provider?: string;
    /**
     * Prompt override for an EXISTING role. Empty (or absent) inherits the
     * composed prompt; a non-empty value replaces it for this session — the
     * sanctioned way to slightly tune a default lens without copying the role.
     */
    prompt?: string;
}
/** A per-session quorum override for the verify layer. */
export interface SessionQuorumTune {
    rule?: QuorumRule;
    threshold?: number;
}
/**
 * One role a session authors in the designer. Unlike a tuning (which edits an
 * existing role) an authored role carries its own prompt — the whole lens —
 * because nothing in the preset knows it.
 */
export interface SessionRoleAuthor {
    /** Unique within the whole preset; the designer generates it from the label. */
    id: string;
    /** Display label; defaults to the id when absent. */
    label?: string;
    /** The role's instruction, appended to the framing exactly like a preset role's. */
    prompt: string;
    /** Independent instances of this role; defaults to 1. */
    count?: number;
    /** Route the members run on, when the designer picked one. */
    model?: string;
    provider?: string;
}
/**
 * One layer of a session's authored topology — a map layer added below a
 * preset's own map layers, or a node of a fully custom (from-scratch) preset.
 * Each carries its own roles; a whole added layer runs as another examining
 * pass before the verify layer.
 */
export interface SessionLayerAuthor {
    /** Unique within the preset; the designer generates it from the label. */
    id: string;
    /** Display label; defaults to the id when absent. */
    label?: string;
    /** Layer kind. Omitted = `map` (authored layers added under a preset). */
    kind?: LayerKind;
    /** Roles on this layer. */
    roles: SessionRoleAuthor[];
    /** Verify-layer quorum; only meaningful when `kind` is `verify`. */
    quorum?: SessionQuorumTune;
}
/** A reusable, user-authored role kept in the role library. */
export interface RoleTemplate extends SessionRoleAuthor {
    id: string;
}
/** A reusable, user-authored topology kept in the preset library. */
export interface PresetTemplate {
    /** Unique library key. */
    id: string;
    /** Display label, shown in the preset menu. */
    label: string;
    layers: SessionLayerAuthor[];
}
/**
 * Everything the composer-dock designer lets one session say about its
 * council, keyed by the session's id in `CouncilSettings.sessionCouncil`.
 *
 * A setup FIXES the session's council: every run in the session executes the
 * named preset composed with these edits, and the model's per-request preset
 * choice is ignored while a setup exists. Absent setup = the model picks a
 * preset per request, exactly as before.
 */
export interface SessionCouncilSetup {
    /**
     * Preset id from the deployment's mirrored topology that this session runs.
     * ABSENT (or empty) with a `topology` body means a fully custom, built-from-
     * scratch council. A preset id and a custom body never mix: the custom body
     * wins.
     */
    presetId?: string;
    /** Display name for a custom council (mirrors a preset's label). */
    name?: string;
    /** `false` drops the verify layer (map → reduce only). Default true. */
    verifyEnabled?: boolean;
    /** Per-role tuning of EXISTING roles, keyed `${layerId}.${roleId}`. */
    roles?: Record<string, SessionRoleTune>;
    /** Verify-layer quorum override; ignored while `verifyEnabled` is false. */
    quorum?: SessionQuorumTune;
    /**
     * Authored roles appended to existing layers, keyed by that layer's id
     * (map and verify layers only). Each carries its own prompt.
     */
    addRoles?: Record<string, SessionRoleAuthor[]>;
    /** Authored map layers appended after the preset's own map layers. */
    addLayers?: SessionLayerAuthor[];
    /**
     * The WHOLE topology of a custom council built from scratch: every layer,
     * kinds included, roles with their own prompts. Presence of this body (with
     * no `presetId`) is what makes the session's council custom.
     */
    topology?: SessionLayerAuthor[];
}
/** The council settings document. */
export interface CouncilSettings {
    /** Read-only composition mirror; the designer renders it and never writes it. */
    topology?: TopologyPreset[];
    /**
     * Read-only mirror of the deployment's `maxAgentsPerLayer`. The designer
     * bounds every width input against it; it is written by the composition as
     * part of the section's `base` layer.
     */
    maxAgentsPerLayer?: number;
    /**
     * Read-only mirror of the deployment's `maxLayers` — how many layers one
     * preset may compose. The designer disables "add layer" once a session's
     * authored preset would exceed it, matching the host's own refusal.
     */
    maxLayers?: number;
    /**
     * Read-only mirror of the agent-preset id this council was published under.
     * The Council conversation tab gates on it, so a deployment that renamed the
     * published preset still gets its graph instead of an empty state.
     */
    agentPresetId?: string;
    /**
     * Read-only mirror of the deployment's default preset id — the preset a
     * session runs when neither the model nor a session setup names one. The
     * designer uses it to pre-select the preset a fresh session would otherwise
     * get.
     */
    defaultPreset?: string;
    /**
     * Blended $ per 1M tokens for the Council tab's optional cost estimate; `0`
     * (the default) shows no money at all. No editor remains for this field —
     * the Map-Reduce designer owns the council now — but the viewer arithmetic
     * stays available to a deployment that writes it by hand.
     */
    costPerMillionTokens?: number;
    /** Per-session council setups, keyed by the parent session's id. */
    sessionCouncil?: Record<string, SessionCouncilSetup>;
    /** The user's reusable role library, keyed by role id. */
    roleLibrary?: Record<string, RoleTemplate>;
    /** The user's reusable custom-preset library, keyed by preset id. */
    presetLibrary?: Record<string, PresetTemplate>;
}
/** Ceiling on one role's width in a session setup (mirrors the schema). */
export declare const MAX_ROLE_WIDTH = 64;
/**
 * Project the composition's presets into the browser-facing mirror.
 * @param presets - the deployment's resolved presets.
 * @returns the same topology with prompts and framing dropped.
 */
export declare function toTopology(presets: readonly PresetConfig[]): TopologyPreset[];
/**
 * The stored setup of one session, or undefined when it chose none.
 * @param section - the resolved council settings section, or undefined.
 * @param sessionId - the parent session the run belongs to.
 * @returns the setup, or undefined.
 */
export declare function sessionSetupOf(section: CouncilSettings | undefined, sessionId: string): SessionCouncilSetup | undefined;
/**
 * One role's tuned count under a setup.
 *
 * The count is ABSOLUTE — the role's width for the session. A value outside
 * `1..MAX_ROLE_WIDTH` is treated as absent (the composed width stands) because
 * the document is user-plane JSON that survived arbitrary edits; anything else
 * would start a layer with a nonsense number of members.
 * @param composed - the role's composed width, or undefined for the default 1.
 * @param tune - the session's tuning of this role, or undefined.
 * @returns the count to run.
 */
export declare function tunedCount(composed: number | undefined, tune: SessionRoleTune | undefined): number;
/**
 * Whether a session setup drops a layer (only the verify layer can be dropped).
 * @param kind - the layer kind.
 * @param setup - the session setup, or undefined.
 * @returns true when the layer should not run.
 */
export declare function layerDropped(kind: LayerKind, setup: SessionCouncilSetup | undefined): boolean;
/**
 * Compose a session setup onto a real preset.
 *
 * A setup may tune existing roles (widths, routes), append AUTHORED roles to
 * map and verify layers (each carrying its own prompt), insert AUTHORED map
 * layers after the preset's own map layers, drop the verify layer, and restate
 * its quorum. It may not touch the reduce layer or reorder anything the
 * preset composed. Unknown role keys are ignored (a stored setup survives a
 * composition that removed a role). Over-wide layers and unreachable
 * thresholds are refused HERE, before a single child is paid for; the full
 * structural rules (unique ids, non-empty prompts, layer ordering) are
 * re-verified by the caller through `resolveConfig` on the host.
 * @param preset - the composed preset, with its prompts intact.
 * @param setup - the session's setup, or undefined (returns the preset).
 * @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
 * @returns the preset to run.
 * @throws RangeError naming the offending layer on an over-wide layer or an
 * unreachable threshold.
 */
export declare function applySessionSetup(preset: PresetConfig, setup: SessionCouncilSetup | undefined, maxAgentsPerLayer: number): PresetConfig;
/**
 * Compose a fully custom (from-scratch) topology into a runnable preset.
 *
 * The session authored every layer itself — kinds, roles and prompts included
 * — so there is no mirrored preset to compose onto. Structural rules (a single
 * trailing reduce, at most one verify, unique ids, non-empty prompts) are
 * enforced by the caller through `resolveConfig`; over-wide layers and
 * unreachable thresholds are refused here, before a single child is paid for.
 * @param layers - the authored topology, in composition order.
 * @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
 * @param name - display label for the run.
 * @returns the preset to run.
 * @throws RangeError naming the offending layer on an over-wide layer.
 */
export declare function applyCustomSetup(layers: readonly SessionLayerAuthor[], maxAgentsPerLayer: number, name: string): PresetConfig;
/** One planned layer: id, kind, and the width a setup would give it. */
interface WidthLayer {
    readonly id: string;
    readonly kind: LayerKind;
    readonly width: number;
}
/**
 * The widths of every layer one mirrored preset composes under a setup —
 * tuned existing roles, authored roles, authored map layers, verification
 * dropped when off, and the reduce layer at its single instance. Shared by the
 * width/quorum validators and the Council tab's "of N declared" readout, so
 * what the designer blocks, what the tool runs and what the tab says can
 * never disagree.
 * @param preset - the mirrored preset.
 * @param setup - the session setup, or undefined for the composed widths.
 * @returns layer id -> width, in composition order.
 */
export declare function sessionLayerWidthPlan(preset: TopologyPreset, setup: SessionCouncilSetup | undefined): readonly WidthLayer[];
/**
 * Every planned layer whose width a session setup would push past the ceiling
 * — the designer-side twin of `applySessionSetup`'s refusal, computed over the
 * mirrored topology so the panel can disable Save before the Host would refuse
 * the run.
 * @param preset - the mirrored preset.
 * @param setup - the staged session setup, or undefined.
 * @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
 * @returns one entry per offending layer, in composition order.
 */
export declare function sessionWidthViolations(preset: TopologyPreset, setup: SessionCouncilSetup | undefined, maxAgentsPerLayer: number): ReadonlyArray<{
    readonly layerId: string;
    readonly width: number;
    readonly max: number;
}>;
/**
 * The declared width of every layer one mirrored preset composes under a
 * session setup — what the Council tab's "of N declared" readouts should show.
 * @param preset - the mirrored preset.
 * @param setup - the session setup, or undefined for the composed widths.
 * @returns layer id -> declared width, in composition order.
 */
export declare function sessionLayerWidths(preset: TopologyPreset, setup: SessionCouncilSetup | undefined): ReadonlyMap<string, number>;
/**
 * Whether a session's staged quorum for a verify layer is unreachable by its
 * own width — the designer-side twin of `applySessionSetup`'s threshold check.
 * @param preset - the mirrored preset.
 * @param setup - the staged session setup, or undefined.
 * @returns the violation, or undefined when the quorum is fine or absent.
 */
export declare function sessionQuorumViolation(preset: TopologyPreset, setup: SessionCouncilSetup | undefined): {
    readonly rule: QuorumRule;
    readonly threshold: number;
    readonly width: number;
} | undefined;
/**
 * How many layers a setup's preset would compose — the designer's "add layer"
 * gate against the mirrored `maxLayers`.
 * @param preset - the mirrored preset.
 * @param setup - the staged session setup, or undefined.
 * @returns the composed layer count.
 */
export declare function sessionLayerCount(preset: TopologyPreset, setup: SessionCouncilSetup | undefined): number;
/** One width violation of a custom topology. */
export interface CustomWidthViolation {
    readonly layerId: string;
    readonly width: number;
    readonly max: number;
}
/**
 * Every layer of a custom topology whose width exceeds the ceiling — the
 * designer-side twin of `applyCustomSetup`'s refusal.
 * @param layers - the authored topology.
 * @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
 * @returns one entry per offending layer, in composition order.
 */
export declare function customWidthViolations(layers: readonly SessionLayerAuthor[], maxAgentsPerLayer: number): readonly CustomWidthViolation[];
/**
 * Whether a custom verify layer's threshold is unreachable by its own width.
 * @param layers - the authored topology.
 * @returns the violation, or undefined when fine or no threshold quorum.
 */
export declare function customQuorumViolation(layers: readonly SessionLayerAuthor[]): {
    readonly threshold: number;
    readonly width: number;
} | undefined;
/**
 * The structural error of a custom topology the designer must surface before
 * the host's `resolveConfig` would refuse the run, or undefined when the
 * skeleton is sound (prompts/ids still checked host-side). Returns a stable
 * machine code the UI translates.
 * @param layers - the authored topology.
 * @returns a short code, or undefined.
 */
export declare function customStructuralError(layers: readonly SessionLayerAuthor[]): string | undefined;
export {};
