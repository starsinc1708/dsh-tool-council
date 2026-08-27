/**
 * Council conversation view: a graph of the council's map → verify → reduce
 * agents, followed by the run's verdict table and written report, rendered as
 * a tab beside Chat and Trajectory.
 *
 * It reads two things the harness already persists: the `workflow-run` nodes
 * the engine emits (member graph, live state, per-member tokens) and the run
 * ARTIFACT the council tool ships as its `presentationMeta`, which the harness
 * stores on the `tool/result` event. That artifact — topology, narration,
 * per-layer timing and the settled outcome — is what makes a finished run
 * reopenable, and it costs no private event type: a plugin cannot write one,
 * because the session reader refuses a log carrying a type it does not know.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client';
import type { CouncilResultRecord, CouncilSettings } from '@starsinc1708/dsh-tool-council/types';
import type { CouncilKey } from './locales.ts';
/** Everything the view's slot registration injects. */
export interface CouncilViewInjected {
    /** Reactively read one member's cumulative token usage from its child session. */
    useMemberUsage: (childId: string) => TokenUsageProjection | undefined;
    /** Reactively total the token usage of every member on one layer. */
    useLayerTokens: (childIds: readonly string[]) => number;
    /** The agent-preset id this council was published under. */
    useCouncilPreset: () => string;
    /** The viewer's own blended rate, $ per 1M tokens; 0 means show no money. */
    useCostRate: () => number;
}
/**
 * Register the Council conversation-view tab.
 * @param ctx - the browser plugin context.
 * @param scope - the bound `council` settings scope the preset gate reads.
 */
export declare function registerCouncilView(ctx: ClientContext, scope: SettingsScope<CouncilSettings>): void;
type Translate = (key: CouncilKey, args?: Record<string, unknown>) => string;
/**
 * Render one settled run as a self-contained Markdown document.
 * @param result - the durable outcome record.
 * @param t - the locale binder, so the export reads in the viewer's language.
 * @returns the Markdown text.
 */
export declare function toMarkdown(result: CouncilResultRecord, t: Translate): string;
export {};
