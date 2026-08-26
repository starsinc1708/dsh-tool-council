/**
 * Conversation node definition folding the council's narration lines into one
 * `council-log` Chat node per run, so the graph view can show intermediate
 * findings counts live.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client';
/** State folded from one council run's `tool-council/*` events. */
interface CouncilLogState {
    readonly name: string;
    readonly messages: readonly string[];
}
/** The node payload the graph view reads. */
export interface CouncilLogData {
    readonly name: string;
    readonly messages: readonly string[];
}
/** Fold `tool-council/run-start` + `tool-council/log` into one node per run. */
export declare const councilLogDefinition: ConversationNodeDefinition<CouncilLogState>;
export {};
