/**
 * The council settings card: a preset picker, then that preset's layers as
 * rows of roles with an editable instance count, model route, and provider
 * route, plus the quorum control on a verify layer and a JSON transfer for the
 * whole overlay.
 *
 * The card draws the deployment's real topology, which it reads from the
 * section's read-only `topology` mirror — so a composition that replaced the
 * shipped presets renders correctly without this plugin knowing anything about
 * them. It bounds the width input against the mirrored `maxAgentsPerLayer` and
 * refuses an over-wide save itself, because the Host's refusal arrives as a raw
 * TypeError after the fact.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { QuorumRule } from '@starsinc1708/dsh-tool-council/types';
import type { CouncilCardState } from './controller.ts';
/** Everything the slot's `inject` factory hands the card. */
export interface CouncilCardFace {
    hooks: {
        councilCard: HostObservable<CouncilCardState>;
    };
    selectPreset: (presetId: string) => void;
    setDefaultPreset: (presetId: string) => void;
    setRoleCount: (layerId: string, roleId: string, count: number) => void;
    setRoleModel: (layerId: string, roleId: string, model: string) => void;
    setRoleProvider: (layerId: string, roleId: string, provider: string) => void;
    setCostRate: (rate: number) => void;
    revertRole: (layerId: string, roleId: string) => void;
    setQuorum: (layerId: string, rule: QuorumRule, threshold?: number) => void;
    resetPreset: () => void;
    exportOverrides: () => string;
    importOverrides: (text: string) => boolean;
    discard: () => void;
    save: () => void;
}
/**
 * Props the renderer binds for the council card. The `hooks` compartment is
 * bound by the framework into `useCouncilCard` (see {@link InjectFace}); the
 * actions pass through verbatim.
 */
export type CouncilCardProps = PropsRuntime<'settings.plugin.item'> & PropsLocale<'council'> & InjectFace<CouncilCardFace>;
/**
 * Every distinct route already named somewhere in the deployment.
 *
 * There is no catalogue service the settings plane can reach, so the
 * suggestions are what this deployment already uses — the composition's own
 * routes plus anything the user has staged. Free text stays free: a `datalist`
 * suggests, a `<select>` would silently hide every valid id nobody listed.
 * @param state - the card's current snapshot.
 * @param field - which route to collect.
 * @returns the distinct values, sorted, with the empty one dropped.
 */
export declare function routeSuggestions(state: CouncilCardState, field: 'model' | 'provider'): string[];
/**
 * Render the card.
 * @param props - the runtime kit, the locale binder, and the injected face.
 * @returns the settings card element.
 */
export declare function CouncilCard(props: CouncilCardProps): import("react").JSX.Element;
