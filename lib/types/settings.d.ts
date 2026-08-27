/**
 * The user-plane settings section and the overlay it applies to the
 * composition's presets.
 *
 * The section carries a read-only `topology` mirror alongside the writable
 * fields. That mirror is what lets the browser card render the deployment's
 * actual layers and roles without a `@Remote` namespace — a Remote would mean
 * editing `packages/api/remotes` on both faces, which is an explicit choice by
 * the Client composition owner and not worth a form that changes two numbers.
 *
 * Browser-safe: no cordis Context, no Agent, no host-only import.
 *
 * @module @starsinc1708/dsh-tool-council/types
 */
import type { LayerKind, PresetConfig, QuorumRule } from './types.ts';
/** The settings namespace this package serves. Also the settings-card slot key. */
export declare const COUNCIL_NAMESPACE = "council";
/** One role, as the card needs to draw it — prompts deliberately excluded. */
export interface TopologyRole {
    readonly id: string;
    readonly label: string;
    readonly count: number;
    readonly model: string;
    readonly provider: string;
}
/** One layer, as the card needs to draw it. */
export interface TopologyLayer {
    readonly id: string;
    readonly kind: LayerKind;
    readonly roles: readonly TopologyRole[];
    readonly quorumRule?: QuorumRule;
    readonly quorumThreshold?: number;
}
/** One preset, as the card needs to draw it. */
export interface TopologyPreset {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly layers: readonly TopologyLayer[];
}
/** A user override of one role's width, model, or provider. */
export interface RoleOverride {
    count?: number;
    model?: string;
    provider?: string;
}
/** A user override of one verify layer's quorum. */
export interface QuorumOverride {
    rule?: QuorumRule;
    threshold?: number;
}
/** Every override for one preset, keyed `layerId.roleId` and `layerId`. */
export interface PresetOverride {
    roles?: Record<string, RoleOverride>;
    quorums?: Record<string, QuorumOverride>;
}
/** The council settings document. */
export interface CouncilSettings {
    /** Preset used when the model names none. */
    defaultPreset?: string;
    /** Read-only composition mirror; the card renders it and never writes it. */
    topology?: TopologyPreset[];
    /**
     * Read-only mirror of the deployment's `maxAgentsPerLayer`. The card needs it
     * to bound the width input and warn BEFORE a save the host would refuse; it
     * is written by the composition as part of the section's `base` layer.
     */
    maxAgentsPerLayer?: number;
    /**
     * Read-only mirror of the agent-preset id this council was published under.
     * The Council conversation tab gates on it, so a deployment that renamed the
     * published preset still gets its graph instead of an empty state.
     */
    agentPresetId?: string;
    /**
     * Blended $ per 1M tokens for the Council tab's optional cost estimate; `0`
     * (the default) shows no money at all.
     *
     * Deliberately a user preference and deliberately one number. The token meter
     * reports no price and the view cannot know which route each member actually
     * ran on, so a per-route figure is impossible by construction. This is the
     * viewer's own arithmetic on their own rate, labelled as an estimate — not a
     * bill, and never a substitute for one.
     */
    costPerMillionTokens?: number;
    /** User overlay, keyed by preset id. */
    overrides?: Record<string, PresetOverride>;
}
/**
 * Project the composition's presets into the card-facing mirror.
 * @param presets - the deployment's resolved presets.
 * @returns the same topology with prompts and framing dropped.
 */
export declare function toTopology(presets: readonly PresetConfig[]): TopologyPreset[];
/**
 * Apply the user overlay to the composition's presets.
 *
 * Unknown preset, layer, or role keys are ignored rather than refused: a user
 * document survives a composition change that removed a role, and the next
 * write simply drops the stale key. Structural rules stay with the
 * composition — an overlay may change a width or a model, never a topology.
 * @param presets - the composition's presets.
 * @param overrides - the user overlay, keyed by preset id.
 * @returns presets with widths, models, and quorums overlaid.
 */
export declare function applyOverrides(presets: readonly PresetConfig[], overrides: Record<string, PresetOverride> | undefined): PresetConfig[];
