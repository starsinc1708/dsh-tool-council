/**
 * Conversation node definition folding one council run's `tool-council/*`
 * records into a single `council-log` Chat node: the topology it started with,
 * its phase transitions and narration lines, and — once it settles — its
 * durable outcome (the verdict rows and the written report).
 *
 * That last part is what lets the Council tab reopen a finished run instead of
 * showing only the member graph: the tool result lives in the parent model's
 * context, not in the UI's.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client';
import type { CouncilLayerRecord, CouncilResultRecord } from '@starsinc1708/dsh-tool-council/types';
/** One narration line with the wall clock it was emitted at. */
export interface CouncilLogLine {
    readonly text: string;
    readonly at: number;
}
/** One phase transition with the wall clock it happened at. */
export interface CouncilPhaseMark {
    readonly title: string;
    readonly at: number;
}
/** The node payload the graph view reads. */
export interface CouncilLogData {
    readonly name: string;
    readonly preset: string;
    /** Truncated first line of the task — what tells two runs apart in a list. */
    readonly task: string;
    readonly startedAt: number;
    readonly layers: readonly CouncilLayerRecord[];
    readonly phases: readonly CouncilPhaseMark[];
    readonly messages: readonly CouncilLogLine[];
    /** The settled outcome, or null while the run is still going. */
    readonly result: CouncilResultRecord | null;
}
/** State folded from one council run's `tool-council/*` events. */
type CouncilLogState = CouncilLogData;
/** Fold the whole `tool-council/*` family into one node per run. */
export declare const councilLogDefinition: ConversationNodeDefinition<CouncilLogState>;
export {};
