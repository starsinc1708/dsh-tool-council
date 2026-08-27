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

import { useCallback, useState, useSyncExternalStore } from 'react'
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
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
  CouncilLayerRecord, CouncilResultRecord, CouncilSettings,
} from '@starsinc1708/dsh-tool-council/types'
import type { CouncilKey } from './locales.ts'
import { NS } from './locales.ts'
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
const VISIBLE_ROWS = 50

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
  const { useCouncilPreset, useCostRate } = makeSettingsHooks(scope)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'council',
    order: 20,
    locale: NS,
    label: () => t('view.council'),
    inject: () => ({ useMemberUsage, useLayerTokens, useCouncilPreset, useCostRate }),
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
  readonly kind: string
  readonly meta?: unknown
  readonly subCalls?: readonly ToolBlock[]
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
 * @param meta - the tool result's presentation payload.
 * @returns whether it is an artifact this build can read.
 */
function isArtifact(meta: unknown): meta is CouncilResultRecord {
  if (typeof meta !== 'object' || meta === null) return false
  const candidate = meta as Partial<CouncilResultRecord>
  return candidate.kind === COUNCIL_ARTIFACT_KIND
    && candidate.version === COUNCIL_ARTIFACT_VERSION
    && typeof candidate.runId === 'string'
    && Array.isArray(candidate.rows)
}

/** One workflow-run node paired with the artifact its tool result carried. */
interface CouncilRun {
  readonly key: string
  readonly id: string
  readonly data: RunData
  artifact: CouncilResultRecord | null
}

type Translate = (key: CouncilKey, args?: Record<string, unknown>) => string

/** Render the Council graph tab. */
function CouncilView(
  props: ConvViewProps & PropsLocale<'council'> & InjectFace<CouncilViewInjected>,
) {
  const {
    useSession, useSessions, sessionId, t, useMemberUsage, useLayerTokens, useCouncilPreset, useCostRate,
  } = props
  const preset = useSessions(state => state.byId[sessionId]?.agentPreset)
  const councilPreset = useCouncilPreset()
  const costRate = useCostRate()
  const chat = useSession(state => state.chat)

  if (preset !== councilPreset) {
    return <div className={css.empty}>{t('onlyCouncilPreset', { preset: councilPreset })}</div>
  }

  const artifacts = new Map<string, CouncilResultRecord>()
  const runs: CouncilRun[] = []
  for (const node of chat.nodes.values()) {
    if (node.kind === 'workflow-run') {
      runs.push({ key: node.key, id: node.id, data: node.data as unknown as RunData, artifact: null })
    } else if (node.kind === 'tool') {
      collectArtifacts((node.data as unknown as { root?: ToolBlock }).root, artifacts)
    }
  }
  for (const run of runs) run.artifact = artifacts.get(run.id) ?? null
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
          t={t}
          useMemberUsage={useMemberUsage}
          useLayerTokens={useLayerTokens}
        />
      ))}
      <p className={css.footnote}>{t('legend.status')}</p>
    </div>
  )
}

interface RunProps {
  readonly run: CouncilRun
  readonly defaultOpen: boolean
  readonly costRate: number
  readonly t: Translate
  readonly useMemberUsage: (childId: string) => TokenUsageProjection | undefined
  readonly useLayerTokens: (childIds: readonly string[]) => number
}

function Run({ run, defaultOpen, costRate, t, useMemberUsage, useLayerTokens }: RunProps) {
  const [open, setOpen] = useState(defaultOpen)
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
        {result === null ? null : (
          <span className={css.runMeta}>{t('seconds', { n: Math.round(result.durationMs / 1000) })}</span>
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

      {result === null ? null : <Outcome result={result} t={t} />}
        </div>
      )}
    </details>
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
  readonly t: Translate
  readonly useMemberUsage: (childId: string) => TokenUsageProjection | undefined
  readonly useLayerTokens: (childIds: readonly string[]) => number
}

function Layer({ phase, layer, durationMs, costRate, t, useMemberUsage, useLayerTokens }: LayerProps) {
  const tokens = useLayerTokens(phase.members.map(member => member.childId))
  const cost = estimateCost(tokens, costRate)
  const heading = layer === undefined
    ? phase.phase ?? '—'
    : `${layer.label} · ${t(`kind.${layer.kind}` as CouncilKey)}`
  return (
    <fieldset className={css.layer}>
      <legend>{heading}</legend>
      <div className={css.layerMeta}>
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
function Outcome({ result, t }: { result: CouncilResultRecord; t: Translate }) {
  const [copied, setCopied] = useState('')
  const [showAll, setShowAll] = useState(false)
  // A run may legitimately carry hundreds of rows; drawing them all the moment
  // it is opened is what makes the tab stall on a big audit.
  const visible = showAll ? result.rows : result.rows.slice(0, VISIBLE_ROWS)
  const [copyError, setCopyError] = useState(false)
  const render = (format: 'md' | 'json') =>
    format === 'md' ? toMarkdown(result, t) : JSON.stringify(result, null, 2)
  const copy = (format: 'md' | 'json') => {
    setCopyError(false)
    const write = navigator.clipboard?.writeText(render(format))
    if (write === undefined) { setCopyError(true); return }
    void write.then(() => { setCopied(format) }, () => { setCopyError(true) })
  }
  const download = (format: 'md' | 'json') => {
    const name = `council-${result.preset}.${format}`
    const type = format === 'md' ? 'text/markdown' : 'application/json'
    setCopyError(!downloadText(name, render(format), type))
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
        <button type="button" onClick={() => { download('md') }}>{`${t('download')} MD`}</button>
        <button type="button" onClick={() => { download('json') }}>{`${t('download')} JSON`}</button>
      </div>
      {copyError ? <p className={css.warn} role="alert">{t('copyFailed')}</p> : null}

      {result.rows.length === 0 ? <p className={css.hint}>{t('noFindings')}</p> : (
        <div className={css.tableWrap}>
          <table className={css.table}>
            <caption className={css.caption}>{t('table.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t('col.finding')}</th>
                <th scope="col">{t('col.location')}</th>
                {result.verifiers.map(verifier => <th scope="col" key={verifier}>{verifier}</th>)}
                <th scope="col">{t('col.outcome')}</th>
                <th scope="col">{t('col.fix')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.findingId} data-outcome={row.outcome}>
                  <th scope="row" className={css.rowIndex}>{index + 1}</th>
                  <td>{row.title}</td>
                  <td className={css.mono}>{row.location}</td>
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
      {visible.length === result.rows.length ? null : (
        <button type="button" className={css.showAll} onClick={() => { setShowAll(true) }}>
          {t('showAllRows', { shown: visible.length, total: result.rows.length })}
        </button>
      )}
      <p className={css.footnote}>{t('tableLegend')}</p>
      {result.rowsTruncated
        ? <p className={css.warn}>{t('rowsTruncated', { shown: result.rows.length, total: result.counts.findings })}</p>
        : null}

      <h4>{t('report')}</h4>
      {result.reportMissing || result.report === ''
        ? <p className={css.warn}>{t('noReport')}</p>
        : <pre className={css.report}>{result.report}</pre>}
      {result.reportTruncated ? <p className={css.footnote}>{t('reportTruncated')}</p> : null}
    </div>
  )
}

/** Escape a cell so `|` and newlines cannot break the exported Markdown table. */
function cell(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ')
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
    const header = ['#', t('col.finding'), t('col.location'), ...result.verifiers, t('col.outcome'), t('col.fix')]
    lines.push(
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...result.rows.map((row, index) => `| ${[
        String(index + 1),
        cell(row.title),
        cell(row.location),
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
