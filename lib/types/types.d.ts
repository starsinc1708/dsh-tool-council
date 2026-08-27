/**
 * Durable vocabulary of the council seam: the finding, the verdict, the tally,
 * and the layer/role configuration they travel through. Browser-safe — this
 * module imports no Agent, no cordis Context, and no host-only type, so the
 * settings card can reuse it.
 *
 * @module @starsinc1708/dsh-tool-council
 */
/** How serious the author claims the finding is. */
export type FindingSeverity = 'blocker' | 'high' | 'medium' | 'low';
/** One claim produced by a map-layer child. */
export interface Finding {
    /** Short normalized headline, at most `maxTitleChars`. */
    readonly title: string;
    /** `path:line` or `path`. The deduplication key's first component. */
    readonly location: string;
    /** What is wrong, in one or two sentences. */
    readonly claim: string;
    /** The observation that supports `claim` — a quotation or a reproduction, never a restatement. */
    readonly evidence: string;
    readonly severity: FindingSeverity;
    /** The author's own confidence, 0..1. Advisory: it never enters the quorum. */
    readonly confidence: number;
    /** Suggested change, or `''` when the author has none. */
    readonly fix: string;
}
/** A deduplicated finding with a run-stable id and its reporters. */
export interface ClusteredFinding extends Finding {
    /** `f1`, `f2`, … assigned in first-seen order; stable for the whole run. */
    readonly id: string;
    /** Role instance ids that reported this cluster, in first-seen order. */
    readonly reportedBy: readonly string[];
    /** Every variant title the cluster absorbed, including `title`. */
    readonly variants: readonly string[];
}
/** One verifier's position on one finding. */
export type Vote = 'confirmed' | 'rejected' | 'not-a-bug' | 'uncertain';
/** A verifier's vote plus the reasoning it is accountable for. */
export interface Verdict {
    readonly findingId: string;
    readonly vote: Vote;
    /** Why. A `rejected` or `not-a-bug` verdict without a concrete reason is refused. */
    readonly reason: string;
}
/** Every verdict one verifier instance returned. */
export interface VerifierBallot {
    /** Role instance id — the column header in the report table (`V1`, `V2`, …). */
    readonly verifier: string;
    readonly verdicts: readonly Verdict[];
}
/** How a verify layer converts votes into an outcome. */
export type QuorumRule = 'majority' | 'unanimous' | 'threshold';
/** The quorum policy of one verify layer. */
export interface QuorumConfig {
    readonly rule: QuorumRule;
    /** Required `confirmed` count. Only read when `rule` is `threshold`. */
    readonly threshold?: number;
}
/**
 * The outcome of applying a quorum to one finding's votes.
 *
 * `insufficient` is the "unresolved" arm, not a negative one: the finding did
 * not clear the rule AND no verifier argued against it. That covers two
 * situations — fewer than two verifiers voted on it at all, or the ones who did
 * could not meet the bar the rule sets (a `threshold` higher than the number
 * who voted, or unanimity denied by an `uncertain`). Neither is `rejected`,
 * because nobody said the claim was wrong.
 */
export type Outcome = 'confirmed' | 'rejected' | 'not-a-bug' | 'insufficient';
/** One row of the report table. */
export interface TallyRow {
    readonly findingId: string;
    /** Votes in verifier order; `null` where that verifier returned no verdict for this finding. */
    readonly votes: readonly (Vote | null)[];
    readonly counts: {
        readonly confirmed: number;
        readonly rejected: number;
        readonly notABug: number;
        readonly uncertain: number;
    };
    /**
     * Ballots that voted on THIS finding — the quorum's denominator. An abstention
     * (`null` vote) is excluded, so a row answered by one verifier is
     * `insufficient` even when the layer collected three ballots.
     */
    readonly participating: number;
    readonly outcome: Outcome;
}
/** The full tally: the verifier columns and one row per finding. */
export interface Tally {
    /** Verifier ids, in layer order — the table's column headers. */
    readonly verifiers: readonly string[];
    readonly rows: readonly TallyRow[];
}
/** One role on one layer. `count` instances of it run concurrently. */
export interface RoleConfig {
    /** Unique within its layer. Becomes the instance id (`V1`, `V1#2`, …) and the table column. */
    id: string;
    /** Display label for the report and the settings card. */
    label?: string;
    /**
     * The role's instruction, appended to the layer's framing. This is the whole
     * lens: the workflow `agent()` hook exposes no persona and no tool filter,
     * so a role differs from its neighbours by this text, by `model`, and by
     * `provider` — the five options the engine accepts are label, phase, schema,
     * provider, and model.
     */
    prompt: string;
    /** Independent instances of this role. Defaults to 1. */
    count?: number;
    /** Optional per-role model route, passed to `agent(prompt, { model })`. */
    model?: string;
    /**
     * Optional per-role subagent provider, passed to `agent(prompt, { provider })`.
     * The strongest decorrelation lever the engine exposes: two roles on different
     * providers run on different agent implementations, not merely different
     * weights. `spawn` and `fork` ship with the base composition; `acp`, `codex`,
     * `claude-code`, and `dsh-sdk` are installed separately.
     */
    provider?: string;
}
/** What a layer does with its roles' output. */
export type LayerKind = 'map' | 'verify' | 'reduce';
/** One layer of the council. */
export interface LayerConfig {
    id: string;
    kind: LayerKind;
    label?: string;
    roles: RoleConfig[];
    /** Required when `kind` is `verify`, refused otherwise. */
    quorum?: QuorumConfig;
}
/** How the reduce layer is fed. */
export type ReduceMode = 'vote' | 'synthesis';
/** A named, complete council topology. */
export interface PresetConfig {
    id: string;
    label?: string;
    /** Model-facing: when to choose this preset. It reaches the tool description. */
    description: string;
    /**
     * How the reduce role is fed. Both modes deduplicate and both run whatever
     * verify layer the topology declares — the mode chooses the REPORT shape:
     * `vote` renders the verdict table as the answer, `synthesis` asks the reduce
     * role for prose and hands it the table as supporting evidence.
     */
    reduceMode?: ReduceMode;
    /** Prepended to every child prompt in the run. */
    framing?: string;
    layers: LayerConfig[];
}
/** One layer of a running topology, as the graph view needs to label it. */
export interface CouncilLayerRecord {
    readonly id: string;
    readonly kind: LayerKind;
    readonly label: string;
    /** Instances started on this layer — the sum of its roles' counts. */
    readonly width: number;
}
/** One verdict row, flattened for the durable record. */
export interface CouncilResultRow {
    readonly findingId: string;
    readonly title: string;
    readonly location: string;
    readonly severity: string;
    /** Votes in verifier order; `null` is an abstention. Empty with no verify layer. */
    readonly votes: readonly (string | null)[];
    /** Ballots that voted on THIS row — the quorum denominator. */
    readonly participating: number;
    /**
     * The row's {@link Outcome}, or `unverified` when the preset declares no
     * verify layer at all. `insufficient` means a quorum was attempted and fewer
     * than two verifiers voted; `unverified` means nobody was ever asked, and
     * showing the two as one label would misdescribe every synthesis run.
     */
    readonly outcome: Outcome | 'unverified';
    readonly fix: string;
}
/**
 * Everything a settled council run leaves behind, durable in the parent
 * session. This is what makes a run a reopenable artifact rather than a tool
 * result that vanishes with the model's context.
 */
export interface CouncilResultRecord {
    readonly preset: string;
    /** The workflow engine's stop reason, or `deadline` when the script bowed out. */
    readonly stopReason: string;
    readonly error?: string;
    readonly agentsStarted: number;
    readonly durationMs: number;
    /** Map members that reported at least one finding. */
    readonly membersReporting: number;
    /** Map members that answered at all — an empty list is an answer. */
    readonly membersResponding: number;
    readonly mapMembers: number;
    readonly reportMissing: boolean;
    readonly counts: {
        readonly findings: number;
        readonly confirmed: number;
        readonly rejected: number;
        readonly notABug: number;
        readonly insufficient: number;
        /** Findings on a preset with no verify layer: nobody was asked to vote. */
        readonly unverified: number;
    };
    readonly verifiers: readonly string[];
    readonly rows: readonly CouncilResultRow[];
    /** True when `rows` carries fewer entries than `counts.findings`. */
    readonly rowsTruncated: boolean;
    readonly report: string;
    /** True when `report` was cut to the deployment's ceiling. */
    readonly reportTruncated: boolean;
}
/**
 * The `./types` subpath carries the whole browser-safe surface in one entry:
 * this vocabulary plus the settings helper layer the card and the host both
 * reuse. `settings.ts` imports from here type-only, so this value re-export
 * introduces no runtime cycle.
 */
export { COUNCIL_NAMESPACE, applyOverrides, toTopology } from './settings.ts';
export type { CouncilSettings, PresetOverride, QuorumOverride, RoleOverride, TopologyLayer, TopologyPreset, TopologyRole, } from './settings.ts';
