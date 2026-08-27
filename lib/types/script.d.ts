/**
 * The fixed council orchestration script.
 *
 * Deployment-owned and build-time constant: the model supplies the task text
 * and nothing else, so it cannot change the topology, the schemas, the quorum,
 * or the validation. The script body runs in the workflow engine's worker,
 * where it can reach `args`, `agent`, `parallel`, `phase`, and `log` and
 * nothing else — it cannot import this package, which is why the clustering and
 * quorum arithmetic appear here a second time. `./tally.ts` is the host's
 * authoritative copy and the one under test; the host recomputes and refuses a
 * run whose script tally disagrees.
 *
 * @module @starsinc1708/dsh-tool-council
 */
/** One role instance the host expanded from `RoleConfig.count`. */
export interface ScriptInstance {
    /** `V1`, or `correctness#2` for the second copy of a role. */
    readonly instanceId: string;
    readonly label: string;
    readonly prompt: string;
    readonly model?: string;
    readonly provider?: string;
}
/** One layer, with its roles already expanded into concrete instances. */
export interface ScriptLayer {
    readonly id: string;
    readonly kind: 'map' | 'verify' | 'reduce';
    readonly quorumRule: 'majority' | 'unanimous' | 'threshold';
    readonly quorumThreshold?: number;
    readonly instances: readonly ScriptInstance[];
}
/** Everything the script reads from its `args` global. */
export interface ScriptArgs {
    readonly framing: string;
    readonly task: string;
    readonly reduceMode: 'vote' | 'synthesis';
    readonly maxFindings: number;
    readonly maxFindingChars: number;
    /** Per-member finding ceiling applied before clustering; `0` disables it. */
    readonly maxFindingsPerMember: number;
    /** Wall-clock budget checked at each layer boundary; `0` disables it. */
    readonly maxRunMs: number;
    /** Re-issue one `agent()` call whose child died before giving up on it. */
    readonly retryFailedMembers: boolean;
    /** Run the same-location merge stage between clustering and verification. */
    readonly mergeSameLocation: boolean;
    /** Ceiling on clusters handed to the merge stage. */
    readonly maxMergeCandidates: number;
    readonly layers: readonly ScriptLayer[];
}
/** Why the script stopped: cleanly, or because it ran out of its time budget. */
export type ScriptStopReason = 'completed' | 'deadline';
/** The plain-JS body handed to `WorkflowEngine.start`. */
export declare const COUNCIL_SCRIPT: string;
