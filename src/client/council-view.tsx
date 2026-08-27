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

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { ClientContext, ConversationLocation, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: brings the `workflow-run` ChatNodeDataMap augmentation.
import type {} from '@deepseek-ai/dsh-client-ui-workflow-run/client'
// VALUE import, so it must be relative: the client bundle externalizes every
// bare specifier, and the loader's module table answers only the shared seed
// words. A package-subpath value import compiles fine and then fails at load
// with "missed the module table". Type-only imports below may use the
// specifier, because they are erased before the bundle exists.
import { COUNCIL_ARTIFACT_KIND, COUNCIL_ARTIFACT_VERSION } from '../types.ts'
import type {
  CouncilLayerRecord, CouncilResultRecord, CouncilResultRow, CouncilSettings, PresetOverride,
  TopologyPreset,
} from '@starsinc1708/dsh-tool-council/types'
import type { CouncilKey } from './locales.ts'
import { NS } from './locales.ts'
import { parseReport } from './report.ts'
import type { ReportBlock, ReportSpan } from './report.ts'
import css from './council-view.module.css'

/** The projection face a member's child session exposes for its token usage. */
interface UsageFace {
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
}

/** The sessions seam the view reads child projections through. */
interface SessionsLike {
  binding(id: string): { session?: { projections: { faceOf(key: string): UsageFace } } } | undefined
}

/** The published preset id assumed when the deployment mirrored none. */
const DEFAULT_COUNCIL_PRESET = 'map-reduce'

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
type WorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted'

/** Durable workflow-run member data (mirrors ui-workflow-run's renderer shape). */
interface MemberData {
  readonly seq: number
  readonly label: string
  readonly childId: string
  readonly status: WorkflowRunStatus
}

/** Durable workflow-run phase group. */
interface PhaseData {
  readonly key: string
  readonly phase: string | null
  readonly members: readonly MemberData[]
}

/** Durable workflow-run Chat node payload. */
interface RunData {
  readonly name: string
  readonly status: WorkflowRunStatus
  readonly phases: readonly PhaseData[]
}

/**
 * Shipped role label -> locale key for its one-line explanation.
 *
 * Keyed by label because that is all the workflow-run node carries about a
 * member. A deployment that renamed its roles falls through to the layer's
 * kind hint, which still says what the member is for.
 */
const ROLE_HINT_KEYS: Record<string, CouncilKey> = {
  'Correctness': 'roleHint.correctness',
  'API contract': 'roleHint.api-contract',
  'Performance & scale': 'roleHint.perf-scale',
  'Tests': 'roleHint.tests',
  'Prior art': 'roleHint.prior-art',
  'Constraints': 'roleHint.constraints',
  'Trade-offs': 'roleHint.tradeoffs',
  'Risks & unknowns': 'roleHint.risks',
  'Minimal': 'roleHint.minimal',
  'Idiomatic': 'roleHint.idiomatic',
  'Ambitious': 'roleHint.ambitious',
  'Plan': 'roleHint.plan',
  'Coupling': 'roleHint.coupling',
  'Merge': 'roleHint.merge',
  'Replicator': 'roleHint.replicator',
  "Devil's advocate": 'roleHint.devils-advocate',
  'Impact': 'roleHint.impact',
  'Feasibility': 'roleHint.feasibility',
  'Maintenance': 'roleHint.maintenance',
  'Behaviour': 'roleHint.behaviour',
  'Coverage': 'roleHint.coverage',
  'Rollback': 'roleHint.rollback',
  'Synthesizer': 'roleHint.synthesizer',
}

/** Verdict rows drawn before the reader asks for the rest. */
export const VISIBLE_ROWS = 50

/**
 * Format a wall clock for the run header.
 * @param at - epoch milliseconds recorded when the run opened.
 * @returns a locale-formatted time, or the raw number if the platform refuses.
 */
function formatTime(at: number): string {
  try {
    return new Date(at).toLocaleTimeString()
  } catch {
    /* v8 ignore next -- only a platform without Intl reaches this. */
    return String(at)
  }
}

/**
 * Format an elapsed span for a running run's clock.
 * @param ms - the span in milliseconds; negatives read as zero.
 * @returns `12s`, `4:07`, or `1:02:03`.
 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n))
  if (total < 60) return `${seconds}s`
  if (hours === 0) return `${minutes}:${pad(seconds)}`
  return `${hours}:${pad(minutes)}:${pad(seconds)}`
}

/**
 * The prefix `tool.ts` gives every council workflow run's `meta.name`.
 *
 * `RunData.name` is the only field of the live node that names the topology the
 * run was started from, and the engine carries it verbatim from
 * `tool-workflow/run-start`. Everything else about the topology arrives with the
 * artifact, which does not exist until the run settles.
 */
const RUN_NAME_PREFIX = 'council:'

/** The settings fields the declared-width lookup reads. */
interface TopologySettings {
  readonly topology?: readonly TopologyPreset[]
  readonly overrides?: Record<string, PresetOverride>
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
export function declaredWidths(
  settings: TopologySettings | undefined,
  runName: string,
): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  if (settings === undefined || !runName.startsWith(RUN_NAME_PREFIX)) return out
  const presetId = runName.slice(RUN_NAME_PREFIX.length)
  const preset = settings.topology?.find(candidate => candidate.id === presetId)
  if (preset === undefined) return out
  const override = settings.overrides?.[presetId]
  for (const layer of preset.layers) {
    out.set(layer.id, layer.roles.reduce(
      (sum, role) => sum + (override?.roles?.[`${layer.id}.${role.id}`]?.count ?? role.count),
      0,
    ))
  }
  return out
}

/** How many members of one layer are in each lifecycle state right now. */
export interface LiveCounts {
  readonly running: number
  readonly done: number
  readonly failed: number
  readonly stopped: number
}

/**
 * Count the member states a running layer is showing.
 * @param members - the members the workflow-run node has published so far.
 * @returns the four counts; `cancelled` and `interrupted` fold into `stopped`.
 */
export function liveCounts(members: readonly { readonly status: WorkflowRunStatus }[]): LiveCounts {
  let running = 0
  let done = 0
  let failed = 0
  let stopped = 0
  for (const member of members) {
    if (member.status === 'running') running += 1
    else if (member.status === 'completed') done += 1
    else if (member.status === 'failed') failed += 1
    else stopped += 1
  }
  return { running, done, failed, stopped }
}

/** One tool call still in flight, reduced to what the run clock needs. */
export interface LiveCall {
  readonly turn: number
  readonly step: number
  /** Epoch ms the `tool/call` event was logged. */
  readonly time: number
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
export function runStartFromCalls(
  calls: readonly LiveCall[],
  turn: number,
  step: number,
): number | undefined {
  const matches = calls.filter(call => call.turn === turn && call.step === step)
  return matches.length === 1 ? matches[0]?.time : undefined
}

/**
 * First moment this tab saw each run, keyed by run id.
 *
 * The honest fallback when the tool call cannot be joined: it measures how long
 * the tab has been WATCHING the run, which is why it is labelled differently
 * from the real elapsed time. Page-session scoped by construction — a reload
 * restarts it, and the label says so rather than pretending otherwise.
 *
 * It holds an entry only for runs that are still going: {@link forgetObserved}
 * drops each one as its run settles, which is what makes "one number per
 * running run" true rather than merely intended. Dropping it on the live
 * header's unmount would be wrong — the header also unmounts when the viewer
 * switches tabs, and the clock would restart on the way back, which is the one
 * thing this map exists to prevent.
 */
const FIRST_SEEN = new Map<string, number>()

/**
 * Read (and on first sight record) when this tab first saw a run.
 * @param runId - the workflow run's id.
 * @param now - the current epoch time.
 * @returns the first-observed time.
 */
export function observedSince(runId: string, now: number): number {
  const seen = FIRST_SEEN.get(runId)
  if (seen !== undefined) return seen
  FIRST_SEEN.set(runId, now)
  return now
}

/**
 * Drop the observed start of every run that has settled.
 *
 * A settled run reads its real `startedAt` off its artifact and never asks
 * again, so its entry is dead weight from that moment on.
 * @param settled - run ids that are no longer running.
 */
export function forgetObserved(settled: Iterable<string>): void {
  for (const runId of settled) FIRST_SEEN.delete(runId)
}

/**
 * Hand the viewer a file instead of only the clipboard.
 *
 * Clipboard access is permissioned and silently unavailable in some webviews;
 * an export that can only ever fail quietly is not an export.
 * @param name - suggested file name.
 * @param text - the file's contents.
 * @param type - the MIME type.
 * @returns whether the download could be started.
 */
function downloadText(name: string, text: string, type: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.rel = 'noopener'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    // Revoked on the next frame: revoking synchronously races the download in
    // some engines.
    setTimeout(() => { URL.revokeObjectURL(url) }, 0)
    return true
  } catch {
    return false
  }
}

const VOTE_MARK: Record<string, string> = {
  'confirmed': '✅',
  'rejected': '❌',
  'not-a-bug': '➖',
  'uncertain': '❔',
}

/**
 * Severity levels this build has copy and a colour for.
 *
 * `CouncilResultRow.severity` is a plain `string` in the durable record, not the
 * `FindingSeverity` union: the record is replayed from logs written by other
 * builds. An unrecognized level renders its raw text in the neutral badge rather
 * than resolving a locale key that does not exist.
 */
const SEVERITY_LEVELS: ReadonlySet<string> = new Set(['blocker', 'high', 'medium', 'low'])

/** Which rows the verdict table is showing. */
export type RowFilter = 'confirmed' | 'unresolved' | 'all'

/** The three filters, in chip order. */
export const ROW_FILTERS: readonly RowFilter[] = ['confirmed', 'unresolved', 'all']

/** Just enough of a verdict row to filter it. */
interface FilterableRow {
  readonly outcome: string
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
export function rowMatches(row: FilterableRow, filter: RowFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'confirmed') return row.outcome === 'confirmed'
  return row.outcome === 'insufficient' || row.outcome === 'unverified'
}

/**
 * How many rows each chip would show.
 *
 * Rendered on the chips themselves so an empty table always distinguishes "this
 * filter has nothing" from "this run found nothing".
 * @param rows - every verdict row of the run.
 * @returns one count per filter.
 */
export function filterCounts(rows: readonly FilterableRow[]): Record<RowFilter, number> {
  const counts: Record<RowFilter, number> = { confirmed: 0, unresolved: 0, all: rows.length }
  for (const row of rows) {
    if (rowMatches(row, 'confirmed')) counts.confirmed += 1
    else if (rowMatches(row, 'unresolved')) counts.unresolved += 1
  }
  return counts
}

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
export function windowRows<Row extends FilterableRow>(
  rows: readonly Row[],
  filter: RowFilter,
  showAll: boolean,
): { readonly filtered: readonly Row[]; readonly visible: readonly Row[] } {
  const filtered = rows.filter(row => rowMatches(row, filter))
  return { filtered, visible: showAll ? filtered : filtered.slice(0, VISIBLE_ROWS) }
}

/** Everything the view's slot registration injects. */
export interface CouncilViewInjected {
  /** Reactively read one member's cumulative token usage from its child session. */
  useMemberUsage: (childId: string) => TokenUsageProjection | undefined
  /** Reactively total the token usage of every member on one layer. */
  useLayerTokens: (childIds: readonly string[]) => number
  /** The agent-preset id this council was published under. */
  useCouncilPreset: () => string
  /** The viewer's own blended rate, $ per 1M tokens; 0 means show no money. */
  useCostRate: () => number
  /**
   * The deployment's mirrored topology and the saved overlay, for the declared
   * width of a layer whose run has not settled yet.
   */
  useCouncilTopology: () => TopologySettings | undefined
  /**
   * Open one finding's file with the Host operating system's default
   * application, through `ctx.workspaces.openPath`.
   * @param path - the finding's location with any `:line` suffix removed.
   * @param cwd - the session's workspace root, for a workspace-relative path.
   * @returns the Host's promise, so a refusal can be surfaced rather than lost.
   */
  openLocation: (path: string, cwd: string | undefined) => Promise<void>
}

/**
 * Whether a path is already rooted, and therefore not workspace-relative.
 *
 * All three spellings the Host accepts: a POSIX absolute path, a Windows drive
 * letter, and a UNC share.
 * @param value - the candidate path.
 * @returns whether it is already absolute.
 */
function isRooted(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[/\\]/u.test(value) || value.startsWith('\\\\')
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
export function workspacePath(cwd: string | undefined, path: string): string {
  if (isRooted(path)) return path
  if (cwd === undefined || cwd === '') return path
  return `${cwd.replace(/[/\\]+$/u, '')}/${path.replace(/^[/\\]+/u, '')}`
}

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
export function locationPath(location: string): string {
  return location.trim().replace(/:\d+(?::\d+)?$/u, '')
}

/**
 * Render an optional cost estimate for a token total.
 * @param tokens - the token count.
 * @param rate - $ per 1M tokens; 0 disables the estimate entirely.
 * @returns the formatted estimate, or undefined when there is nothing to show.
 */
function estimateCost(tokens: number, rate: number): string | undefined {
  if (!(rate > 0) || tokens === 0) return undefined
  const amount = (tokens / 1_000_000) * rate
  // Two significant figures below a cent, two decimals above: a run that costs
  // $0.004 should not read as $0.00.
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`
}

function totalOf(usage: TokenUsageProjection | undefined): number {
  // The four buckets are disjoint by the meter's contract, so the sum is the
  // run's real token spend and not a double count.
  return usage === undefined
    ? 0
    : usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

function usageOf(sessions: SessionsLike, childId: string): TokenUsageProjection | undefined {
  return sessions.binding(childId)?.session?.projections.faceOf('tokenUsage')?.getSnapshot() as
    TokenUsageProjection | undefined
}

/** Build the live token-usage hooks bound to child-session projections. */
function makeUsageHooks(sessions: SessionsLike) {
  const useMemberUsage = (childId: string): TokenUsageProjection | undefined => {
    // Memoized on the child id: an inline callback makes React tear down and
    // re-establish the projection subscription on every single render.
    const subscribe = useCallback(
      (onChange: () => void) =>
        sessions.binding(childId)?.session?.projections.faceOf('tokenUsage')?.subscribe(onChange) ?? (() => {}),
      [childId],
    )
    return useSyncExternalStore(subscribe, () => usageOf(sessions, childId))
  }
  const useLayerTokens = (childIds: readonly string[]): number => {
    const key = childIds.join(',')
    const subscribe = useCallback((onChange: () => void) => {
      const disposers = key === '' ? [] : key.split(',').map(
        id => sessions.binding(id)?.session?.projections.faceOf('tokenUsage')?.subscribe(onChange) ?? (() => {}),
      )
      return () => { for (const dispose of disposers) dispose() }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the identity of `childIds`.
    }, [key])
    // A number is compared by value, so the snapshot stays stable across
    // renders and useSyncExternalStore does not loop.
    return useSyncExternalStore(
      subscribe,
      () => childIds.reduce((sum, id) => sum + totalOf(usageOf(sessions, id)), 0),
    )
  }
  return { useMemberUsage, useLayerTokens }
}

/** Build the hooks reading the council settings section. */
function makeSettingsHooks(scope: SettingsScope<CouncilSettings>) {
  const subscribe = (listener: () => void) => scope.subscribe(listener)
  return {
    useCouncilPreset: (): string => useSyncExternalStore(
      subscribe,
      () => scope.getSnapshot().value?.agentPresetId ?? DEFAULT_COUNCIL_PRESET,
    ),
    useCostRate: (): number => useSyncExternalStore(
      subscribe,
      () => scope.getSnapshot().value?.costPerMillionTokens ?? 0,
    ),
    // The whole section value, not a derived object: `useSyncExternalStore`
    // compares snapshots by identity, and a fresh `{ topology, overrides }`
    // literal per read would re-render for ever.
    useCouncilTopology: (): TopologySettings | undefined => useSyncExternalStore(
      subscribe,
      () => scope.getSnapshot().value,
    ),
  }
}

/**
 * Register the Council conversation-view tab.
 * @param ctx - the browser plugin context.
 * @param scope - the bound `council` settings scope the preset gate reads.
 */
export function registerCouncilView(ctx: ClientContext, scope: SettingsScope<CouncilSettings>): void {
  const t = ctx.locale.bind(NS)
  const { useMemberUsage, useLayerTokens } = makeUsageHooks(ctx.sessions as unknown as SessionsLike)
  const { useCouncilPreset, useCostRate, useCouncilTopology } = makeSettingsHooks(scope)
  // Read at call time, not at registration: the service is injected, and
  // capturing it here would bind whatever `ctx.workspaces` happened to be when
  // the plugin applied.
  const openLocation = (path: string, cwd: string | undefined): Promise<void> =>
    ctx.workspaces.openPath(workspacePath(cwd, path))
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'council',
    order: 20,
    locale: NS,
    label: () => t('view.council'),
    inject: () => ({
      useMemberUsage, useLayerTokens, useCouncilPreset, useCostRate, useCouncilTopology, openLocation,
    }),
  }, CouncilView))
}

/**
 * One tool call in the client's chat tree.
 *
 * Restated structurally rather than imported: `ToolCallBlock` lives behind a
 * subpath the runtime's `exports` map does not publish, and a value import
 * across client plugins fails the bundle-purity gate either way.
 */
interface ToolBlock {
  /** `tool-result` on a settled call; ABSENT on one still running. */
  readonly kind?: string
  /** Settled arm: the persisted presentation payload. */
  readonly meta?: unknown
  /** Running arm: when the `tool/call` was logged, and where it sits. */
  readonly time?: number
  readonly turn?: number
  readonly step?: number
  readonly subCalls?: readonly ToolBlock[]
}

/**
 * Collect the tool calls still in flight, at any depth.
 *
 * The running arm of `ToolCallBlock` has no `kind` discriminator at all, so it
 * is recognized by the absence of the settled one plus the three fields the
 * clock needs.
 * @param block - one tool call block, possibly with sub-calls.
 * @param into - accumulator.
 */
function collectRunningCalls(block: ToolBlock | undefined, into: LiveCall[]): void {
  if (block === undefined) return
  if (block.kind !== 'tool-result'
    && typeof block.time === 'number'
    && typeof block.turn === 'number'
    && typeof block.step === 'number') {
    into.push({ turn: block.turn, step: block.step, time: block.time })
  }
  for (const child of block.subCalls ?? []) collectRunningCalls(child, into)
}

/**
 * The turn and step one chat node was anchored in.
 * @param location - the node's engine-resolved location.
 * @returns the step coordinates, or undefined when the node is not step-scoped.
 */
function stepOf(location: ConversationLocation): { turn: number; step: number } | undefined {
  return location.kind === 'step' ? { turn: location.step.turn, step: location.step.step } : undefined
}

/**
 * Collect this plugin's run artifacts from the settled tool results in a chat.
 *
 * The artifact rides `tool/result`'s `meta`, which the harness persists for
 * exactly this purpose — so a finished run reopens from the session log without
 * the plugin writing a single record of its own.
 * @param block - one tool call block, possibly with sub-calls.
 * @param into - accumulator keyed by run id.
 */
function collectArtifacts(block: ToolBlock | undefined, into: Map<string, CouncilResultRecord>): void {
  if (block === undefined) return
  const meta = block.meta
  if (isArtifact(meta)) into.set(meta.runId, meta)
  for (const child of block.subCalls ?? []) collectArtifacts(child, into)
}

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
export function isArtifact(meta: unknown): meta is CouncilResultRecord {
  if (typeof meta !== 'object' || meta === null) return false
  const candidate = meta as Partial<CouncilResultRecord>
  return candidate.kind === COUNCIL_ARTIFACT_KIND
    && candidate.version === COUNCIL_ARTIFACT_VERSION
    && typeof candidate.runId === 'string'
    && typeof candidate.preset === 'string'
    && typeof candidate.report === 'string'
    && typeof candidate.counts === 'object' && candidate.counts !== null
    && Array.isArray(candidate.layers)
    && Array.isArray(candidate.phases)
    && Array.isArray(candidate.messages)
    && Array.isArray(candidate.verifiers)
    && Array.isArray(candidate.rows)
    && candidate.rows.every(isArtifactRow)
}

/**
 * Whether one persisted verdict row carries everything the table renders.
 * @param row - one entry of the artifact's `rows`.
 * @returns whether every field the table dereferences is present.
 */
function isArtifactRow(row: unknown): boolean {
  if (typeof row !== 'object' || row === null) return false
  const candidate = row as Partial<CouncilResultRow>
  return typeof candidate.findingId === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.location === 'string'
    && typeof candidate.severity === 'string'
    && typeof candidate.outcome === 'string'
    && typeof candidate.fix === 'string'
    && Array.isArray(candidate.votes)
}

/** One workflow-run node paired with the artifact its tool result carried. */
interface CouncilRun {
  readonly key: string
  readonly id: string
  readonly data: RunData
  /** Where the node was anchored, for the live start-time join. */
  readonly at: { turn: number; step: number } | undefined
  artifact: CouncilResultRecord | null
  /** Exact start, joined from the still-running tool call; 0 when unavailable. */
  startedAt: number
}

type Translate = (key: CouncilKey, args?: Record<string, unknown>) => string

/** Render the Council graph tab. */
function CouncilView(
  props: ConvViewProps & PropsLocale<'council'> & InjectFace<CouncilViewInjected>,
) {
  const {
    useSession, useSessions, sessionId, t, useMemberUsage, useLayerTokens, useCouncilPreset, useCostRate,
    useCouncilTopology, openLocation,
  } = props
  const preset = useSessions(state => state.byId[sessionId]?.agentPreset)
  // The session's workspace root, which is what turns a member's
  // workspace-relative `src/rank.py:521` into a path the Host can open.
  const cwd = useSessions(state => state.byId[sessionId]?.cwd)
  const councilPreset = useCouncilPreset()
  const costRate = useCostRate()
  const settings = useCouncilTopology()
  const chat = useSession(state => state.chat)

  if (preset !== councilPreset) {
    return <div className={css.empty}>{t('onlyCouncilPreset', { preset: councilPreset })}</div>
  }

  const artifacts = new Map<string, CouncilResultRecord>()
  const running: LiveCall[] = []
  const runs: CouncilRun[] = []
  for (const node of chat.nodes.values()) {
    if (node.kind === 'workflow-run') {
      runs.push({
        key: node.key,
        id: node.id,
        data: node.data as unknown as RunData,
        at: stepOf(node.location),
        artifact: null,
        startedAt: 0,
      })
    } else if (node.kind === 'tool') {
      const root = (node.data as unknown as { root?: ToolBlock }).root
      collectArtifacts(root, artifacts)
      collectRunningCalls(root, running)
    }
  }
  for (const run of runs) {
    run.artifact = artifacts.get(run.id) ?? null
    run.startedAt = run.at === undefined
      ? 0
      : runStartFromCalls(running, run.at.turn, run.at.step) ?? 0
  }
  // A settled run has its real start on its artifact and will never ask the
  // observed-start map again.
  forgetObserved(runs.filter(run => run.data.status !== 'running').map(run => run.id))
  if (runs.length === 0) return <div className={css.empty}>{t('noRuns')}</div>

  return (
    <div className={css.wrap}>
      {runs.map((run, index) => (
        <Run
          key={run.key}
          run={run}
          // Only the newest run is expanded. A collapsed run mounts no members,
          // which is also what stops a finished run from holding live token
          // subscriptions open for the rest of the session.
          defaultOpen={index === runs.length - 1}
          costRate={costRate}
          widths={declaredWidths(settings, run.data.name)}
          cwd={cwd}
          openLocation={openLocation}
          t={t}
          useMemberUsage={useMemberUsage}
          useLayerTokens={useLayerTokens}
        />
      ))}
      <p className={css.footnote}>{t('legend.status')}</p>
      {/* Only while something is in flight: the live counts and the two clock
          labels are exactly what a reader would otherwise have to guess at. */}
      {runs.some(run => run.data.status === 'running')
        ? <p className={css.footnote}>{t('live.legend')}</p>
        : null}
    </div>
  )
}

interface RunProps {
  readonly run: CouncilRun
  readonly defaultOpen: boolean
  readonly costRate: number
  /** Declared width per layer id, from the settings topology mirror. */
  readonly widths: ReadonlyMap<string, number>
  /** The session's workspace root, for resolving a finding's location. */
  readonly cwd: string | undefined
  readonly openLocation: (path: string, cwd: string | undefined) => Promise<void>
  readonly t: Translate
  readonly useMemberUsage: (childId: string) => TokenUsageProjection | undefined
  readonly useLayerTokens: (childIds: readonly string[]) => number
}

function Run({
  run, defaultOpen, costRate, widths, cwd, openLocation, t, useMemberUsage, useLayerTokens,
}: RunProps) {
  const [open, setOpen] = useState(defaultOpen)
  const live = run.data.status === 'running'
  // One object now: the artifact carries the topology, the narration and the
  // outcome together, and it exists only once the run's tool result has landed.
  // A live run therefore shows its member graph and nothing else — the graph is
  // the live signal, and the rest arrives when the run settles.
  const result = run.artifact
  const layers = new Map((result?.layers ?? []).map(layer => [layer.id, layer] as const))
  const endedAt = result === null ? 0 : result.startedAt + result.durationMs

  return (
    <details
      className={css.run}
      open={open}
      onToggle={(event) => { setOpen(event.currentTarget.open) }}
    >
      <summary className={css.runHead}>
        <span className={css.runName}>{run.data.name}</span>
        {/* Two runs of the same preset are otherwise indistinguishable in a
            collapsed list — the task snippet and the clock are what tell them
            apart, and both are already durable. */}
        {result === null || result.task === '' ? null : <span className={css.runTask}>{result.task}</span>}
        <span className={css.runStatus}>{t(`status.${run.data.status}` as CouncilKey)}</span>
        {/* A budgeted or failed run must say so while collapsed; the warnings
            inside the body are invisible until it is opened. */}
        {result?.stopReason === 'deadline'
          ? <span className={css.chipWarn}>{t('chip.deadline')}</span>
          : null}
        {result?.error === undefined ? null : <span className={css.chipDanger}>{t('chip.failed')}</span>}
        {result === null || result.startedAt === 0 ? null : (
          <span className={css.runMeta}>{t('startedAt', { time: formatTime(result.startedAt) })}</span>
        )}
        {result !== null || !live || run.startedAt === 0 ? null : (
          <span className={css.runMeta}>{t('startedAt', { time: formatTime(run.startedAt) })}</span>
        )}
        {result === null ? null : (
          <span className={css.runMeta}>{t('seconds', { n: Math.round(result.durationMs / 1000) })}</span>
        )}
        {/* Mounted only while the run is running: unmounting on settle is what
            clears the interval and drops every live token subscription this
            header opened. */}
        {!live ? null : (
          <RunLive
            runId={run.id}
            startedAt={run.startedAt}
            childIds={run.data.phases.flatMap(phase => phase.members.map(member => member.childId))}
            costRate={costRate}
            t={t}
            useLayerTokens={useLayerTokens}
          />
        )}
      </summary>

      {!open ? null : (
        <div className={css.runBody}>
      {result === null ? null : (
        <p className={css.runSummary}>
          {t('summary', {
            responding: result.membersResponding,
            reporting: result.membersReporting,
            members: result.mapMembers,
            findings: result.counts.findings,
            confirmed: result.counts.confirmed,
          })}
        </p>
      )}
      {result?.stopReason === 'deadline' ? <p className={css.warn}>{t('incomplete')}</p> : null}
      {result?.error === undefined ? null : (
        <p className={css.warn}>{t('runFailed', { error: result.error })}</p>
      )}

      <div className={css.layers}>
        {run.data.phases.map(phase => (
          <Layer
            key={phase.key}
            phase={phase}
            layer={phase.phase === null ? undefined : layers.get(phase.phase)}
            durationMs={phaseDuration(result, phase.phase, endedAt)}
            costRate={costRate}
            live={live}
            declared={phase.phase === null ? undefined : widths.get(phase.phase)}
            t={t}
            useMemberUsage={useMemberUsage}
            useLayerTokens={useLayerTokens}
          />
        ))}
      </div>

      {result === null || result.messages.length === 0 ? null : (
        <ul className={css.runLog}>
          {result.messages.map((line, index) => <li key={index}>{line.text}</li>)}
        </ul>
      )}

      {result === null ? null : (
        <Outcome result={result} cwd={cwd} openLocation={openLocation} t={t} />
      )}
        </div>
      )}
    </details>
  )
}

interface RunLiveProps {
  readonly runId: string
  /** Exact start from the joined tool call, or 0 when the join was refused. */
  readonly startedAt: number
  readonly childIds: readonly string[]
  readonly costRate: number
  readonly t: Translate
  readonly useLayerTokens: (childIds: readonly string[]) => number
}

/** How often the run clock re-renders while a run is in flight. */
const TICK_MS = 1000

/**
 * The live half of a running run's header: a ticking clock, the run's token
 * total, and the optional cost estimate.
 *
 * Rendered only while the run's status is `running`, so the interval and the
 * token subscriptions exist exactly as long as there is something to watch.
 * @param props - the run's identity, its members, and the viewer's rate.
 * @returns the live header cells.
 */
function RunLive({ runId, startedAt, childIds, costRate, t, useLayerTokens }: RunLiveProps) {
  const tokens = useLayerTokens(childIds)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, TICK_MS)
    return () => { clearInterval(timer) }
  }, [])
  const cost = estimateCost(tokens, costRate)
  // Two different measurements, two different labels. `startedAt` is the real
  // council call; the fallback is only how long this tab has been watching, and
  // saying "elapsed" for it would be a clock that lies after a reload.
  const exact = startedAt > 0
  const since = exact ? startedAt : observedSince(runId, now)
  return (
    <>
      <span className={css.runClock}>
        {exact
          ? t('live.elapsed', { time: formatDuration(now - since) })
          : t('live.observed', { time: formatDuration(now - since) })}
      </span>
      {tokens === 0 ? null : <span className={css.runMeta}>{t('tokens', { n: tokens })}</span>}
      {cost === undefined ? null : <span className={css.runMeta}>{t('cost', { amount: cost })}</span>}
    </>
  )
}

/**
 * How long one phase took, from the script's own phase marks.
 *
 * Matched by TITLE, not by position: a layer can enter a phase and start no
 * agents at all (a verify layer with nothing to verify), which leaves a phase
 * mark with no matching group in the workflow-run node and would shift every
 * later duration by one.
 * @param artifact - the run's artifact, when it has settled.
 * @param title - the phase's title, which is the layer id.
 * @param endedAt - when the run settled, for the last phase.
 * @returns the duration in milliseconds, or 0 when it cannot be established.
 */
function phaseDuration(artifact: CouncilResultRecord | null, title: string | null, endedAt: number): number {
  if (artifact === null || title === null) return 0
  const index = artifact.phases.findIndex(mark => mark.title === title)
  const mark = artifact.phases[index]
  if (mark === undefined || mark.at === 0) return 0
  const next = artifact.phases[index + 1]?.at ?? endedAt
  return next > mark.at ? next - mark.at : 0
}

interface LayerProps {
  readonly phase: PhaseData
  readonly layer: CouncilLayerRecord | undefined
  readonly durationMs: number
  readonly costRate: number
  /** Whether the owning run is still going, which is what the counts describe. */
  readonly live: boolean
  /** Declared width from the settings mirror; undefined when it is not knowable. */
  readonly declared: number | undefined
  readonly t: Translate
  readonly useMemberUsage: (childId: string) => TokenUsageProjection | undefined
  readonly useLayerTokens: (childIds: readonly string[]) => number
}

function Layer({
  phase, layer, durationMs, costRate, live, declared, t, useMemberUsage, useLayerTokens,
}: LayerProps) {
  const tokens = useLayerTokens(phase.members.map(member => member.childId))
  const cost = estimateCost(tokens, costRate)
  const heading = layer === undefined
    ? phase.phase ?? '—'
    : `${layer.label} · ${t(`kind.${layer.kind}` as CouncilKey)}`
  // `phase.members` only ever holds instances that have already STARTED, so
  // these are counts of what is known, never a `2/3` progress fraction: the
  // denominator would be a guess until the artifact lands.
  const counts = liveCounts(phase.members)
  return (
    <fieldset className={css.layer}>
      <legend>{heading}</legend>
      <div className={css.layerMeta}>
        {!live ? null : (
          <>
            {counts.running === 0 ? null : (
              <span className={css.liveMark}>{t('live.running', { n: counts.running })}</span>
            )}
            {counts.done === 0 ? null : <span>{t('live.done', { n: counts.done })}</span>}
            {counts.failed === 0 ? null : <span>{t('live.failed', { n: counts.failed })}</span>}
            {counts.stopped === 0 ? null : <span>{t('live.stopped', { n: counts.stopped })}</span>}
            {declared === undefined ? null : <span>{t('live.declared', { n: declared })}</span>}
          </>
        )}
        {tokens === 0 ? null : <span>{t('tokens', { n: tokens })}</span>}
        {cost === undefined ? null : <span>{t('cost', { amount: cost })}</span>}
        {durationMs === 0 ? null : <span>{t('seconds', { n: Math.round(durationMs / 1000) })}</span>}
      </div>
      {phase.members.map(member => (
        <Member
          key={member.seq}
          label={member.label}
          status={member.status}
          childId={member.childId}
          kind={layer?.kind}
          useMemberUsage={useMemberUsage}
          t={t}
        />
      ))}
    </fieldset>
  )
}

interface MemberProps {
  readonly label: string
  readonly status: WorkflowRunStatus
  readonly childId: string
  readonly kind: CouncilLayerRecord['kind'] | undefined
  readonly useMemberUsage: (childId: string) => TokenUsageProjection | undefined
  readonly t: Translate
}

function Member({ label, status, childId, kind, useMemberUsage, t }: MemberProps) {
  const usage = useMemberUsage(childId)
  // A deployment that renamed its roles has no glossary entry; the layer's kind
  // still says what the member is for, which beats an unexplained name.
  const hintKey = ROLE_HINT_KEYS[label] ?? (kind === undefined ? undefined : `kindHint.${kind}` as CouncilKey)
  const explanation = hintKey === undefined ? undefined : t(hintKey)
  const total = usage === undefined ? undefined : totalOf(usage)
  return (
    <div className={css.member}>
      <div className={css.memberRow}>
        <span className={css.dot} data-status={status} />
        <span className={css.memberLabel}>{label}</span>
        <span className={css.memberStatus}>{t(`status.${status}` as CouncilKey)}</span>
        {total === undefined ? null : <span className={css.memberTokens}>{t('tokens', { n: total })}</span>}
      </div>
      {explanation === undefined ? null : <p className={css.memberHint}>{explanation}</p>}
    </div>
  )
}

/**
 * Render one settled run's verdict table, report, and export controls.
 * @param props - the durable result record and the locale binder.
 * @returns the outcome section.
 */
interface OutcomeProps {
  readonly result: CouncilResultRecord
  readonly cwd: string | undefined
  readonly openLocation: (path: string, cwd: string | undefined) => Promise<void>
  readonly t: Translate
}

/** The three things this run can be handed to somebody else as. */
type ExportFormat = 'md' | 'json' | 'checklist'

const EXPORT_FILE: Record<ExportFormat, { readonly extension: string; readonly type: string }> = {
  md: { extension: 'md', type: 'text/markdown' },
  json: { extension: 'json', type: 'application/json' },
  checklist: { extension: 'checklist.md', type: 'text/markdown' },
}

function Outcome({ result, cwd, openLocation, t }: OutcomeProps) {
  const [copied, setCopied] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [filter, setFilter] = useState<RowFilter>('all')
  const counts = filterCounts(result.rows)
  // A run may legitimately carry hundreds of rows; drawing them all the moment
  // it is opened is what makes the tab stall on a big audit. The chip is applied
  // BEFORE that window — see `windowRows`, which owns the order.
  const { filtered, visible } = windowRows(result.rows, filter, showAll)
  // Numbered by position in the WHOLE run, so `#7` means the same finding under
  // every filter and matches the row the export and the tool's table carry.
  const numbers = new Map(result.rows.map((row, index) => [row.findingId, index + 1] as const))
  const [copyError, setCopyError] = useState(false)
  const [openError, setOpenError] = useState('')
  const render = (format: ExportFormat) => {
    if (format === 'md') return toMarkdown(result, t)
    if (format === 'checklist') return toChecklist(result, t)
    return JSON.stringify(result, null, 2)
  }
  // One clipboard path for every copy on this card — the exports and the
  // per-row location chip — because clipboard access is permissioned and a
  // write that only ever fails silently is not a copy.
  const copyText = (text: string, mark: string) => {
    setCopyError(false)
    const write = navigator.clipboard?.writeText(text)
    if (write === undefined) { setCopyError(true); return }
    void write.then(() => { setCopied(mark) }, () => { setCopyError(true) })
  }
  const copy = (format: ExportFormat) => { copyText(render(format), format) }
  const download = (format: ExportFormat) => {
    const { extension, type } = EXPORT_FILE[format]
    setCopyError(!downloadText(`council-${result.preset}.${extension}`, render(format), type))
  }
  const open = (path: string) => {
    setOpenError('')
    void openLocation(path, cwd).catch(() => { setOpenError(path) })
  }
  return (
    <div className={css.outcome}>
      <div className={css.outcomeHead}>
        <h4>{t('verdicts')}</h4>
        <span className={css.spacer} />
        <button type="button" onClick={() => { copy('md') }}>
          {copied === 'md' ? t('copied') : `${t('export')} MD`}
        </button>
        <button type="button" onClick={() => { copy('json') }}>
          {copied === 'json' ? t('copied') : `${t('export')} JSON`}
        </button>
        {/* The one export somebody works FROM rather than reads: the confirmed
            findings as a task list, ready to paste into an issue. */}
        <button type="button" onClick={() => { copy('checklist') }}>
          {copied === 'checklist' ? t('copied') : `${t('export')} ${t('checklist.label')}`}
        </button>
        <button type="button" onClick={() => { download('md') }}>{`${t('download')} MD`}</button>
        <button type="button" onClick={() => { download('json') }}>{`${t('download')} JSON`}</button>
        <button type="button" onClick={() => { download('checklist') }}>
          {`${t('download')} ${t('checklist.label')}`}
        </button>
      </div>
      {copyError ? <p className={css.warn} role="alert">{t('copyFailed')}</p> : null}
      {openError === '' ? null : (
        <p className={css.warn} role="alert">{t('location.openFailed', { path: openError })}</p>
      )}

      {result.rows.length === 0 ? <p className={css.hint}>{t('noFindings')}</p> : (
        <>
          {/* The count rides the chip, so an empty table is never ambiguous
              between "this filter has nothing" and "this run found nothing". */}
          <div className={css.chips}>
            {ROW_FILTERS.map(candidate => (
              <button
                key={candidate}
                type="button"
                aria-pressed={candidate === filter}
                className={candidate === filter ? css.chipOn : css.chip}
                onClick={() => { setFilter(candidate); setShowAll(false) }}
              >
                {t(`filter.${candidate}` as CouncilKey, { n: counts[candidate] })}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? <p className={css.hint}>{t('filter.none')}</p> : (
            <div className={css.tableWrap}>
              <table className={css.table}>
                <caption className={css.caption}>{t('table.caption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">{t('col.finding')}</th>
                    <th scope="col">{t('col.location')}</th>
                    <th scope="col">{t('col.severity')}</th>
                    {result.verifiers.map(verifier => <th scope="col" key={verifier}>{verifier}</th>)}
                    <th scope="col">{t('col.outcome')}</th>
                    <th scope="col">{t('col.fix')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(row => (
                    <tr key={row.findingId} data-outcome={row.outcome}>
                      <th scope="row" className={css.rowIndex}>{numbers.get(row.findingId)}</th>
                      <td>{row.title}</td>
                      <td>
                        <LocationCell
                          location={row.location}
                          copied={copied === `at:${row.findingId}`}
                          onCopy={() => { copyText(row.location, `at:${row.findingId}`) }}
                          onOpen={open}
                          t={t}
                        />
                      </td>
                      <td>
                        <span className={css.severity} data-severity={row.severity}>
                          {SEVERITY_LEVELS.has(row.severity)
                            ? t(`severity.${row.severity}` as CouncilKey)
                            : row.severity}
                        </span>
                      </td>
                      {result.verifiers.map((verifier, column) => (
                        <td key={verifier} className={css.vote}>
                          {row.votes[column] === null || row.votes[column] === undefined
                            ? '·'
                            : VOTE_MARK[row.votes[column] as string] ?? '?'}
                        </td>
                      ))}
                      <td>{t(`outcome.${row.outcome}` as CouncilKey)}</td>
                      <td>{row.fix === '' ? '—' : row.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {visible.length === filtered.length ? null : (
        <button type="button" className={css.showAll} onClick={() => { setShowAll(true) }}>
          {t('showAllRows', { shown: visible.length, total: filtered.length })}
        </button>
      )}
      <p className={css.footnote}>{t('tableLegend')}</p>
      {result.rows.length === 0 ? null : <p className={css.footnote}>{t('filter.legend')}</p>}
      {result.rows.length === 0 ? null : <p className={css.footnote}>{t('location.legend')}</p>}
      {result.rowsTruncated
        ? <p className={css.warn}>{t('rowsTruncated', { shown: result.rows.length, total: result.counts.findings })}</p>
        : null}

      <h4>{t('report')}</h4>
      {result.reportMissing || result.report === ''
        ? <p className={css.warn}>{t('noReport')}</p>
        : <Report text={result.report} />}
      {result.reportTruncated ? <p className={css.footnote}>{t('reportTruncated')}</p> : null}
    </div>
  )
}

interface LocationCellProps {
  readonly location: string
  readonly copied: boolean
  readonly onCopy: () => void
  readonly onOpen: (path: string) => void
  readonly t: Translate
}

/**
 * One finding's location: a monospace chip that copies itself, and — when the
 * location names a file — a control that opens it.
 *
 * `rank.py:521` retyped by hand is how a verdict table stops being something you
 * act on. Opening goes through `ctx.workspaces.openPath`, which hands the file
 * to the operating system's default application; there is no reveal-at-line
 * seam, so the LINE is copied but never jumped to.
 * @param props - the location, its copied state, and the two actions.
 * @returns the location cell.
 */
function LocationCell({ location, copied, onCopy, onOpen, t }: LocationCellProps) {
  const path = locationPath(location)
  return (
    <span className={css.location}>
      <button
        type="button"
        className={css.locationChip}
        title={t('location.copy')}
        onClick={onCopy}
      >
        {location}
      </button>
      {copied ? <span className={css.locationNote}>{t('copied')}</span> : null}
      {path === '' ? null : (
        <button
          type="button"
          className={css.locationOpen}
          title={t('location.open')}
          aria-label={t('location.open')}
          onClick={() => { onOpen(path) }}
        >
          ↗
        </button>
      )}
    </span>
  )
}

/**
 * Render one line's spans.
 *
 * Every span becomes a React text child, which React escapes. That is the whole
 * XSS story for this feature: no HTML is built, so `<script>` in a model-written
 * report is five characters of text.
 * @param spans - the parsed spans of one heading, item, or paragraph.
 * @returns the span elements.
 */
function Spans({ spans }: { spans: readonly ReportSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (span.kind === 'code'
        ? <code key={index} className={css.reportInline}>{span.text}</code>
        : <span key={index}>{span.text}</span>))}
    </>
  )
}

/**
 * Render one structural block of the report.
 * @param block - the parsed block.
 * @returns its element.
 */
function Block({ block }: { block: ReportBlock }) {
  if (block.kind === 'heading') {
    // h5/h6 under the section's own h4, so the report does not outrank the
    // heading that introduces it.
    const Tag = block.level === 1 ? 'h5' : 'h6'
    return (
      <Tag className={css.reportHeading} data-level={block.level}>
        <Spans spans={block.spans} />
      </Tag>
    )
  }
  if (block.kind === 'code') {
    return (
      <pre className={css.reportCode} data-language={block.language === '' ? undefined : block.language}>
        {block.text}
      </pre>
    )
  }
  if (block.kind === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul'
    return (
      <Tag className={css.reportList}>
        {block.items.map((item, index) => <li key={index}><Spans spans={item} /></li>)}
      </Tag>
    )
  }
  return <p className={css.reportParagraph}><Spans spans={block.spans} /></p>
}

/**
 * Render the synthesizer's report as structure rather than as a monospace wall.
 * @param props - the report text, verbatim from the durable record.
 * @returns the rendered report.
 */
function Report({ text }: { text: string }) {
  const blocks = parseReport(text)
  return (
    <div className={css.report}>
      {blocks.map((block, index) => <Block key={index} block={block} />)}
    </div>
  )
}

/** Escape a cell so `|` and newlines cannot break the exported Markdown table. */
function cell(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ')
}

/**
 * Collapse a member-authored string onto one line.
 *
 * The checklist is a list of line-oriented items, so a newline inside a title is
 * not a formatting nuisance: a title containing `\n- [ ] already fixed` would
 * forge an extra checklist entry that no member ever reported.
 * @param value - the member-authored text.
 * @returns the same text with every run of whitespace collapsed to one space.
 */
function oneLine(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

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
export function toChecklist(result: CouncilResultRecord, t: Translate): string {
  const confirmed = result.rows.filter(row => row.outcome === 'confirmed')
  const lines: string[] = [`# ${t('checklist.title', { preset: result.preset })}`, '']
  if (confirmed.length === 0) {
    lines.push(t('checklist.none'))
    return lines.join('\n')
  }
  for (const row of confirmed) {
    const title = oneLine(row.title)
    const location = oneLine(row.location)
    lines.push(location === '' ? `- [ ] ${title}` : `- [ ] ${title} — ${location}`)
    const fix = oneLine(row.fix)
    if (fix !== '') lines.push(`  - ${t('checklist.fix', { fix })}`)
  }
  return lines.join('\n')
}

/**
 * Render one settled run as a self-contained Markdown document.
 * @param result - the durable outcome record.
 * @param t - the locale binder, so the export reads in the viewer's language.
 * @returns the Markdown text.
 */
export function toMarkdown(result: CouncilResultRecord, t: Translate): string {
  const lines: string[] = [
    `# council: ${result.preset}`,
    '',
    t('summary', {
      responding: result.membersResponding,
      reporting: result.membersReporting,
      members: result.mapMembers,
      findings: result.counts.findings,
      confirmed: result.counts.confirmed,
    }),
    '',
  ]
  if (result.stopReason === 'deadline') lines.push(t('incomplete'), '')
  if (result.error !== undefined) lines.push(t('runFailed', { error: result.error }), '')
  if (result.rows.length > 0) {
    const header = [
      '#', t('col.finding'), t('col.location'), t('col.severity'),
      ...result.verifiers, t('col.outcome'), t('col.fix'),
    ]
    lines.push(
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      // Every row, unfiltered: the export is the record of the run, not of what
      // the reader happened to be looking at.
      ...result.rows.map((row, index) => `| ${[
        String(index + 1),
        cell(row.title),
        cell(row.location),
        SEVERITY_LEVELS.has(row.severity) ? t(`severity.${row.severity}` as CouncilKey) : cell(row.severity),
        ...result.verifiers.map((_verifier, column) => {
          const vote = row.votes[column]
          return vote === null || vote === undefined ? '·' : VOTE_MARK[vote] ?? '?'
        }),
        t(`outcome.${row.outcome}` as CouncilKey),
        row.fix === '' ? '—' : cell(row.fix),
      ].join(' | ')} |`),
      '',
      t('tableLegend'),
      '',
    )
  } else {
    lines.push(t('noFindings'), '')
  }
  lines.push(`## ${t('report')}`, '')
  lines.push(result.reportMissing || result.report === '' ? t('noReport') : result.report)
  return lines.join('\n')
}
