/**
 * Council conversation view: a graph of the council's map → verify → reduce
 * agents, rendered as a tab beside Chat and Trajectory. It reads the durable
 * `workflow-run` conversation nodes (emitted by the workflow engine), shows
 * each member's role, live state, spent tokens, and a role explanation, and is
 * gated to the Map-Reduce preset.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client';
/** Everything the view's slot registration injects. */
export interface CouncilViewInjected {
    /** Read one member's cumulative token usage from its child session. */
    readMemberUsage: (childId: string) => TokenUsageProjection | undefined;
}
/** Register the Council conversation-view tab. */
export declare function registerCouncilView(ctx: ClientContext): void;
