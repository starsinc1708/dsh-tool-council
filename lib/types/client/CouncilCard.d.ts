/**
 * The council settings card: a preset picker, then that preset's layers as
 * rows of roles with an editable instance count and model route, plus the
 * quorum control on a verify layer.
 *
 * The card draws the deployment's real topology, which it reads from the
 * section's read-only `topology` mirror — so a composition that replaced the
 * shipped presets renders correctly without this plugin knowing anything about
 * them.
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
    setQuorum: (layerId: string, rule: QuorumRule, threshold?: number) => void;
    resetPreset: () => void;
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
 * Render the card.
 * @param props - the runtime kit, the locale binder, and the injected face.
 * @returns the settings card element.
 */
export declare function CouncilCard(props: CouncilCardProps): import("react").JSX.Element;
