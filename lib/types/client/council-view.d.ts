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
import type { CouncilResultRecord, CouncilSettings, PresetOverride, TopologyPreset } from '@starsinc1708/dsh-tool-council/types';
import type { CouncilKey } from './locales.ts';
/**
 * Status shown for a run, a phase, or a member.
 *
 * This is the `workflow-run` RENDERER's union, not the engine's: the engine's
 * `WorkflowStopReason` is only `completed | cancelled | error`, and `failed`
 * and `interrupted` are the renderer's own distinctions — `interrupted` is a
 * member whose worker died, which the run's own stop reason cannot express. The
 * union is restated here because the package exports it only from a subpath its
 * `exports` map does not publish.
 */
type WorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
/** Verdict rows drawn before the reader asks for the rest. */
export declare const VISIBLE_ROWS = 50;
/**
 * Format an elapsed span for a running run's clock.
 * @param ms - the span in milliseconds; negatives read as zero.
 * @returns `12s`, `4:07`, or `1:02:03`.
 */
export declare function formatDuration(ms: number): string;
/** The settings fields the declared-width lookup reads. */
interface TopologySettings {
    readonly topology?: readonly TopologyPreset[];
    readonly overrides?: Record<string, PresetOverride>;
}
/**
 * Declared width of every layer of the preset a live run is executing.
 *
 * The width is NOT derivable from the run: `phase.members` holds only the
 * instances that have already started, and the artifact's `layers` (which
 * carries the real width) lands only when the run settles. The one live source
 * is the `council` settings section — the deployment's read-only `topology`
 * mirror plus the saved `overrides` overlay, which is exactly the pair the tool
 * itself resolves on every call — joined to the run through the preset id in
 * `RunData.name`.
 *
 * It is a live READ, not a record of what launched: an overlay edited while a
 * run is in flight would make this disagree with the run's real width. That is
 * why it is rendered as "of N declared" beside the observed counts rather than
 * as a denominator like `2/3`.
 * @param settings - the council settings section, as the card mirrors it.
 * @param runName - the workflow run's name (`council:<presetId>`).
 * @returns layer id -> declared width; empty when the preset cannot be identified.
 */
export declare function declaredWidths(settings: TopologySettings | undefined, runName: string): ReadonlyMap<string, number>;
/** How many members of one layer are in each lifecycle state right now. */
export interface LiveCounts {
    readonly running: number;
    readonly done: number;
    readonly failed: number;
    readonly stopped: number;
}
/**
 * Count the member states a running layer is showing.
 * @param members - the members the workflow-run node has published so far.
 * @returns the four counts; `cancelled` and `interrupted` fold into `stopped`.
 */
export declare function liveCounts(members: readonly {
    readonly status: WorkflowRunStatus;
}[]): LiveCounts;
/** One tool call still in flight, reduced to what the run clock needs. */
export interface LiveCall {
    readonly turn: number;
    readonly step: number;
    /** Epoch ms the `tool/call` event was logged. */
    readonly time: number;
}
/**
 * When the council call that owns one run was logged.
 *
 * Neither `RunData` nor the chat node carries a start time — `ConversationViewNode`
 * has no `time` field and `anchorSeq` is a sequence number, not a clock. What the
 * same snapshot does carry is the still-running `tool/call` head, whose `time` is
 * the exact epoch millisecond the call was logged, a few milliseconds before the
 * engine started the run.
 *
 * The join is by the call's own `turn`/`step` and is deliberately refused when it
 * is not unique: two calls in flight in one step cannot be told apart from here,
 * and a wrong start time is worse than an honest "since first seen".
 * @param calls - every tool call still in flight, at any depth.
 * @param turn - the run node's turn.
 * @param step - the run node's step.
 * @returns the call's log time, or undefined when the join is not unambiguous.
 */
export declare function runStartFromCalls(calls: readonly LiveCall[], turn: number, step: number): number | undefined;
/**
 * Read (and on first sight record) when this tab first saw a run.
 * @param runId - the workflow run's id.
 * @param now - the current epoch time.
 * @returns the first-observed time.
 */
export declare function observedSince(runId: string, now: number): number;
/**
 * Drop the observed start of every run that has settled.
 *
 * A settled run reads its real `startedAt` off its artifact and never asks
 * again, so its entry is dead weight from that moment on.
 * @param settled - run ids that are no longer running.
 */
export declare function forgetObserved(settled: Iterable<string>): void;
/** Which rows the verdict table is showing. */
export type RowFilter = 'confirmed' | 'unresolved' | 'all';
/** The three filters, in chip order. */
export declare const ROW_FILTERS: readonly RowFilter[];
/** Just enough of a verdict row to filter it. */
interface FilterableRow {
    readonly outcome: string;
}
/**
 * Whether one row belongs to one filter.
 *
 * `unresolved` deliberately covers BOTH unresolved arms: `insufficient` (a
 * quorum was attempted and did not settle the row) and `unverified` (the preset
 * declares no verify layer, so nobody was asked). They differ in why, not in
 * what they leave the reader to do, and splitting them into two chips would put
 * a chip permanently at zero on every preset.
 * @param row - the verdict row.
 * @param filter - the active filter.
 * @returns whether the row is shown.
 */
export declare function rowMatches(row: FilterableRow, filter: RowFilter): boolean;
/**
 * How many rows each chip would show.
 *
 * Rendered on the chips themselves so an empty table always distinguishes "this
 * filter has nothing" from "this run found nothing".
 * @param rows - every verdict row of the run.
 * @returns one count per filter.
 */
export declare function filterCounts(rows: readonly FilterableRow[]): Record<RowFilter, number>;
/**
 * Apply the chip, then the row window — in that order, and nowhere else.
 *
 * The order is the whole point and is why this is a function rather than two
 * lines in the component: windowing first would take the first 50 rows of the
 * WHOLE run and then filter those, so a blocker confirmed at row 60 would be
 * missing from a `confirmed` chip that says it is showing it.
 * @param rows - every verdict row of the run, in report order.
 * @param filter - the active chip.
 * @param showAll - whether the reader asked for the rest.
 * @returns the filtered rows and the windowed slice actually drawn.
 */
export declare function windowRows<Row extends FilterableRow>(rows: readonly Row[], filter: RowFilter, showAll: boolean): {
    readonly filtered: readonly Row[];
    readonly visible: readonly Row[];
};
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
    /**
     * The deployment's mirrored topology and the saved overlay, for the declared
     * width of a layer whose run has not settled yet.
     */
    useCouncilTopology: () => TopologySettings | undefined;
    /**
     * Open one finding's file with the Host operating system's default
     * application, through `ctx.workspaces.openPath`.
     * @param path - the finding's location with any `:line` suffix removed.
     * @param cwd - the session's workspace root, for a workspace-relative path.
     * @returns the Host's promise, so a refusal can be surfaced rather than lost.
     */
    openLocation: (path: string, cwd: string | undefined) => Promise<void>;
}
/**
 * Resolve a member's location against the session's workspace root.
 *
 * `ctx.workspaces.openPath` takes "an absolute or host-resolvable path", and the
 * harness's own chat file-mention path resolves before calling it — a member
 * reports `src/rank.py:521`, which means nothing without the workspace root.
 *
 * A deliberate in-plugin copy of the runtime's `resolveWorkspacePath`, NOT an
 * import of it: the bundle-purity rule says collaborate through cordis services,
 * and `ctx.workspaces` IS that service, while a value import of another bundle's
 * helper would tie this plugin's load to that bundle's arrival — the failure
 * that has already killed this card once. The cost is stated plainly: if the
 * Host widens what spellings it accepts, this drifts, and the symptom is a file
 * that does not open rather than anything silent.
 * @param cwd - the session's workspace root, when the summary carries one.
 * @param path - the finding's path, absolute or workspace-relative.
 * @returns the path to hand the Host.
 */
export declare function workspacePath(cwd: string | undefined, path: string): string;
/**
 * The file part of a finding's location.
 *
 * A location is `path:line`, `path:line:column`, or a bare `path`. Only a
 * TRAILING numeric group is stripped, so a Windows drive letter (`C:\x\y.ts:12`)
 * keeps its colon and loses only the line.
 *
 * The line itself is dropped on purpose and cannot be honoured: the one seam the
 * client runtime exposes is `openPath(path)`, which hands the file to the
 * operating system's default application. There is no reveal-at-line API to call.
 * @param location - the finding's location as the member reported it.
 * @returns the path, or `''` when the location is not one.
 */
export declare function locationPath(location: string): string;
/**
 * Register the Council conversation-view tab.
 * @param ctx - the browser plugin context.
 * @param scope - the bound `council` settings scope the preset gate reads.
 */
export declare function registerCouncilView(ctx: ClientContext, scope: SettingsScope<CouncilSettings>): void;
/**
 * Recognize a council artifact in a persisted `meta` payload.
 *
 * This is a TYPE GUARD over data, not a sanity check: everything it admits is
 * dereferenced unconditionally below — `result.counts.findings`,
 * `result.verifiers.map`, `row.votes[column]`, `locationPath(row.location)`,
 * `parseReport(result.report)`. A record that carries the right `kind` and
 * `version` but a missing field therefore does not degrade, it throws inside
 * the tab's render and blanks the whole view.
 *
 * The input class is real and the codebase already says so: artifacts are
 * replayed from session logs a DIFFERENT build wrote (see `SEVERITY_LEVELS`,
 * which exists for exactly that reason). `version` alone cannot police it,
 * because a build that shipped a bug wrote version 1 too. So the guard checks
 * every field the view reads, rows included — 200 rows at most, which is
 * nothing beside the render it protects.
 * @param meta - the tool result's presentation payload.
 * @returns whether it is an artifact this build can read.
 */
export declare function isArtifact(meta: unknown): meta is CouncilResultRecord;
type Translate = (key: CouncilKey, args?: Record<string, unknown>) => string;
/**
 * Render the confirmed findings as a Markdown task list.
 *
 * Confirmed only, and deliberately: this is the list somebody works through, and
 * an unresolved row is not yet work. The unresolved rows stay one chip away in
 * the table and in the full Markdown export.
 * @param result - the durable outcome record.
 * @param t - the locale binder.
 * @returns the checklist text.
 */
export declare function toChecklist(result: CouncilResultRecord, t: Translate): string;
/**
 * Render one settled run as a self-contained Markdown document.
 * @param result - the durable outcome record.
 * @param t - the locale binder, so the export reads in the viewer's language.
 * @returns the Markdown text.
 */
export declare function toMarkdown(result: CouncilResultRecord, t: Translate): string;
export {};
