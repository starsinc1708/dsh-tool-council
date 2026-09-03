/**
 * Per-session council designer, browser half.
 *
 * The only configuration surface the council has left: an expandable panel
 * above the composer, visible inside Map-Reduce sessions, that FIXES how the
 * council runs for this session. Pick one of the deployment's presets, a
 * saved custom preset from **My presets**, or build a council from scratch
 * (**Custom**): tune every preset role's width and model, append your own
 * roles (each with its own lens prompt), add whole extra map layers, switch
 * verification off, restate its quorum — then Save. Roles you author can be
 * stored into **My roles** and inserted into any layer of any later session
 * with one click; a finished custom topology can be saved as a reusable
 * preset template.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { CouncilSettings, TopologyPreset } from '../settings.ts';
import type { LayerKind } from '../types.ts';
import type { AuthoredLayer, CouncilDraft } from './session-council-controller.ts';
/** The dock entry's list id. */
export declare const COUNCIL_DESIGNER_SLOT_ID = "council-design";
/** The injected business face: the settings scope and the model directory. */
export interface CouncilDesignerInjected {
    scope: SettingsScope<CouncilSettings>;
    /** Resolver for the harness's per-session model directory, when composed. */
    modelDirectories?: {
        directoryFor(sessionId: string): ModelDirectoryLike;
    };
}
/** The harness's per-session model directory, structurally (no value import). */
export interface ModelDirectoryLike {
    store: {
        getSnapshot(): {
            groups: readonly {
                readonly id: string;
                readonly name: string;
                readonly models: readonly {
                    readonly id: string;
                    readonly name: string;
                }[];
            }[];
            status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error';
        };
        subscribe(listener: () => void): () => void;
    };
    load(): Promise<unknown>;
}
/** One row of a role in the panel, whatever its origin. */
export interface RoleRow {
    /** `${layerId}.${roleId}`. */
    readonly key: string;
    readonly roleId: string;
    readonly label: string;
    readonly count: number;
    readonly provider: string;
    readonly model: string;
    /** Lens prompt, present on authored roles only. */
    readonly prompt?: string;
}
/** The ordered DAG a preset composes under a draft. */
export interface FlowNode {
    readonly id: string;
    readonly kind: LayerKind;
    readonly roles: readonly RoleRow[];
    /** Whole authored map layers and custom nodes are marked. */
    readonly authored: boolean;
    readonly label?: string;
}
/** The flow of a preset-anchored draft (mirror layers + authored map layers). */
export declare function flowOf(preset: TopologyPreset, draft: CouncilDraft): FlowNode[];
/** The flow of a custom (from-scratch) topology. */
export declare function customFlowOf(topology: readonly AuthoredLayer[]): FlowNode[];
/** One role's route choice, as the picker edits it. */
export interface ModelRoute {
    readonly provider: string;
    readonly model: string;
}
/**
 * Register the council designer in the composer dock.
 * @param ctx - the browser plugin context.
 * @param scope - the bound `council` settings scope the designer reads and writes.
 */
export declare function registerCouncilDesigner(ctx: ClientContext, scope: SettingsScope<CouncilSettings>): void;
