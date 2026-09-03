/**
 * Model-facing council: a deployment-fixed map-reduce fan-out of subagents
 * across configured layers, with independent verification and an explicit
 * quorum.
 *
 * The plugin is a Consumer over the workflow and subagent seams, in the shape
 * of `@deepseek-ai/dsh-tool-ralph`: the topology, the schemas, the quorum, and
 * the validation belong to the composition, and the model supplies only the
 * task text. Concurrency limiting, cancellation, worker termination, and the
 * `workflow-run` conversation node all come from the workflow engine.
 *
 * @module @starsinc1708/dsh-tool-council
 */

import type { Context } from '@deepseek-ai/cordis'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type { SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallView, ToolResult, ToolResultView } from '@deepseek-ai/dsh-tools'
import type { WorkflowResult, WorkflowRun } from '@deepseek-ai/dsh-workflow'
// Declaration merge only: makes ctx.systemPrompt visible for section registration.
import type {} from '@deepseek-ai/dsh-system-prompt'

import { HARD_STOP_GRACE_MS, expandLayers, resolveConfig, totalAgentBudget } from './policy.ts'
import type { Config, ResolvedConfig } from './policy.ts'
import { createCouncilRecorder, taskSnippet } from './recorder.ts'
import type { CouncilRunNarration } from './recorder.ts'
import { COUNCIL_NAMESPACE, applyCustomSetup, applySessionSetup, sessionSetupOf } from './settings.ts'
import type { CouncilSettings, SessionCouncilSetup } from './settings.ts'
import { COUNCIL_SCRIPT } from './script.ts'
import type { ScriptArgs, ScriptStopReason } from './script.ts'
import { TABLE_LEGEND, assertClustersWellFormed, assertTallyAgrees, renderTable, tally } from './tally.ts'
import { COUNCIL_ARTIFACT_KIND, COUNCIL_ARTIFACT_VERSION } from './types.ts'
import type {
  ClusteredFinding, CouncilLayerRecord, CouncilResultRecord, CouncilResultRow, PresetConfig, Tally,
  VerifierBallot,
} from './types.ts'

export type * from './types.ts'
export type * from './settings.ts'
export { COUNCIL_ARTIFACT_KIND, COUNCIL_ARTIFACT_VERSION } from './types.ts'
export { TASK_SNIPPET_CHARS, taskSnippet } from './recorder.ts'
export { BUILTIN_PRESETS } from './presets.ts'
export { Config, HARD_STOP_GRACE_MS, expandLayers, resolveConfig, totalAgentBudget } from './policy.ts'
export type { ResolvedConfig } from './policy.ts'
export { COUNCIL_NAMESPACE, applySessionSetup, sessionSetupOf } from './settings.ts'
export {
  TABLE_LEGEND, applyQuorum, assertClustersWellFormed, capPerMember, dedupeFindings, fingerprint,
  mergeClusters, normalizeLocation, renderTable, tally,
} from './tally.ts'

export const name = 'tool-council'
export const inject = ['tools', 'workflowEngine', 'subagents', 'systemPrompt']

/**
 * Require a provider that starts a genuinely fresh, structured-output child.
 *
 * A council member seeded with the parent's transcript would inherit the
 * parent's framing of the problem, which is exactly the correlation the layer
 * exists to break.
 * @param ctx - the plugin context carrying `ctx.subagents`.
 * @param provider - the configured provider name.
 * @returns the registered provider.
 * @throws Error when the provider is absent, unstructured, or context-inheriting.
 */
function requireFreshProvider(ctx: Context, provider: string): SubagentProvider {
  const registered = ctx.subagents.getProvider(provider)
  if (registered === undefined) throw new Error(`council: subagent provider "${provider}" is not registered`)
  if (!registered.capabilities.outputSchema) {
    throw new Error(`council: subagent provider "${provider}" does not support structured output`)
  }
  if (registered.inheritsParentContext) {
    throw new Error(`council: subagent provider "${provider}" inherits parent context; council members must be fresh`)
  }
  return registered
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The script's terminal value, after the host re-validated it. */
interface CouncilOutcome {
  readonly findings: readonly ClusteredFinding[]
  readonly ballots: readonly VerifierBallot[]
  readonly tally: Tally | null
  readonly report: string
  /** The reduce layer ran and returned nothing usable. */
  readonly reportMissing: boolean
  /** Map members that reported at least one finding. */
  readonly membersReporting: number
  /** Map members that answered at all — an empty list is a valid answer. */
  readonly membersResponding: number
  /** Map-layer instances started — the denominator of the two counts above. */
  readonly mapMembers: number
  readonly stopReason: ScriptStopReason
}

/**
 * Defensively decode the script's terminal value across the realm boundary.
 * @param value - the workflow result value, as plain cloned data.
 * @returns the decoded outcome.
 * @throws Error when the value does not match the script's declared shape.
 */
export function readOutcome(value: unknown): CouncilOutcome {
  if (!isRecord(value)
    || !Array.isArray(value['findings'])
    || !Array.isArray(value['ballots'])
    || typeof value['report'] !== 'string'
    || typeof value['reportMissing'] !== 'boolean'
    || typeof value['membersReporting'] !== 'number'
    || typeof value['membersResponding'] !== 'number'
    || typeof value['mapMembers'] !== 'number'
    || (value['stopReason'] !== 'completed' && value['stopReason'] !== 'deadline')) {
    throw new Error('council: the workflow returned a malformed result')
  }
  const table = value['tally']
  if (table !== null && !isRecord(table)) throw new Error('council: the workflow returned a malformed tally')
  return {
    findings: value['findings'] as ClusteredFinding[],
    ballots: value['ballots'] as VerifierBallot[],
    tally: table as Tally | null,
    report: value['report'],
    reportMissing: value['reportMissing'],
    membersReporting: value['membersReporting'],
    membersResponding: value['membersResponding'],
    mapMembers: value['mapMembers'],
    stopReason: value['stopReason'],
  }
}

/**
 * Map a non-clean workflow stop reason to an error message.
 * @param result - the settled workflow result.
 * @returns the message, or `undefined` when the run completed cleanly.
 */
export function stopReasonError(result: WorkflowResult): string | undefined {
  switch (result.stopReason) {
    case 'completed':
      return undefined
    case 'cancelled':
      return `council run was cancelled${result.error === undefined ? '' : ` (${result.error})`}`
    case 'error':
      return `council run failed: ${result.error ?? 'unknown error'}`
    /* v8 ignore start -- WorkflowStopReason is closed; a future variant must fail loud here. */
    default:
      return `council run ended abnormally (${String(result.stopReason satisfies never)})`
    /* v8 ignore stop */
  }
}

const TRUNCATION_NOTICE = '\n… [truncated]'

/**
 * Bound the parent-facing text, marker included.
 * @param text - the rendered report.
 * @param maxChars - the deployment's ceiling.
 * @returns `text`, or a truncated copy ending in the notice.
 */
function bound(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  if (maxChars <= TRUNCATION_NOTICE.length) return TRUNCATION_NOTICE.slice(0, maxChars)
  return `${text.slice(0, maxChars - TRUNCATION_NOTICE.length)}${TRUNCATION_NOTICE}`
}

/**
 * The one-line participation summary, phrased as self-report, not certification.
 *
 * Answering and reporting are counted separately on purpose: the map prompt
 * calls an empty list "a valid and respectable answer", so folding the two
 * would make a clean run where nobody found anything read as four dead children.
 * @param outcome - the validated script outcome.
 * @returns the summary sentence.
 */
export function summaryLine(outcome: CouncilOutcome): string {
  const answered = outcome.mapMembers === 0
    ? `${outcome.membersResponding} council members answered`
    : `${outcome.membersResponding} of ${outcome.mapMembers} examining members answered`
  const reported = outcome.findings.length === 0
    ? 'none reported a finding'
    : `${outcome.membersReporting} reported ${outcome.findings.length} distinct findings`
  if (outcome.tally === null) return `${answered}; ${reported}.`
  const confirmed = outcome.tally.rows.filter(row => row.outcome === 'confirmed').length
  return `${answered}; ${reported}; `
    + `${outcome.ballots.length} verifiers voted, confirming ${confirmed}.`
}

/**
 * Render the council's result for the parent model.
 *
 * The quorum line is deliberately phrased as a count of members, not as a
 * certification: verifiers are agents re-reading the same repository, and the
 * table would otherwise read as an independent oracle. A run that lost its
 * synthesizer or ran out of its budget says so here rather than presenting a
 * partial council as a complete one.
 * @param outcome - the validated script outcome.
 * @param maxChars - the report ceiling.
 * @returns the model-facing text.
 */
export function renderOutcome(outcome: CouncilOutcome, maxChars: number): string {
  const parts: string[] = [summaryLine(outcome)]
  if (outcome.stopReason === 'deadline') {
    parts.push('INCOMPLETE: the run hit its time budget, so one or more layers did not run. '
      + 'Treat everything below as partial.')
  }
  if (outcome.reportMissing) {
    parts.push('NO REPORT: the synthesizer produced nothing, so there is no written conclusion — '
      + 'what follows is what the members and verifiers reported, unsynthesized.')
  }
  if (outcome.findings.length > 0) {
    // A null tally means no verify layer ran — a synthesis preset, a
    // budget-skipped layer, or a layer that had nothing to verify. The reduce
    // role normally carries those findings into its prose; when it produced
    // nothing, listing them here is the difference between a degraded answer
    // and a lost one.
    if (outcome.tally !== null) {
      const shown = Math.min(outcome.findings.length, MAX_RENDERED_ROWS)
      parts.push(
        renderTable(outcome.findings.slice(0, shown), {
          verifiers: outcome.tally.verifiers,
          rows: outcome.tally.rows.slice(0, shown),
        }),
        TABLE_LEGEND,
      )
      if (shown < outcome.findings.length) {
        parts.push(`Showing ${shown} of ${outcome.findings.length} findings; the rest are in the Council tab.`)
      }
    } else if (outcome.reportMissing) {
      const shown = Math.min(outcome.findings.length, MAX_RENDERED_ROWS)
      parts.push(renderFindingList(outcome.findings.slice(0, shown)))
      if (shown < outcome.findings.length) {
        parts.push(`Showing ${shown} of ${outcome.findings.length} findings; the rest are in the Council tab.`)
      }
    }
  }
  if (outcome.report !== '') parts.push(outcome.report)
  return bound(parts.join('\n\n'), maxChars)
}

/**
 * List findings that never reached a verdict table, so an unverified run still
 * surfaces what its members actually said.
 * @param findings - the deduplicated findings, in report order.
 * @returns a Markdown list, one entry per finding.
 */
function renderFindingList(findings: readonly ClusteredFinding[]): string {
  return findings.map(finding => `- **${finding.title}** (${finding.location}, ${finding.severity}) — `
    + `${finding.claim} [reported by ${finding.reportedBy.join(', ')}]`).join('\n')
}

/** Ceiling on verdict rows carried into the durable record. */
const MAX_RECORD_ROWS = 200

/**
 * Ceiling on verdict rows rendered into the parent's context.
 *
 * `maxFindings` goes to 10 000, and `bound()` only trims the finished string —
 * so without this the whole table is built and escaped before most of it is
 * thrown away, and the reader gets a table cut off mid-row with no indication
 * that anything is missing. Rows are dropped explicitly instead, and counted.
 */
const MAX_RENDERED_ROWS = 100

/**
 * Flatten a settled outcome into the durable record the Council tab reopens.
 * @param outcome - the validated script outcome.
 * @param context - the preset, the engine's stop reason, and the run's timings.
 * @returns the artifact shipped as the tool's `presentationMeta`.
 */
export function buildResultRecord(
  outcome: CouncilOutcome,
  context: {
    readonly runId: string
    readonly preset: string
    readonly task: string
    readonly layers: readonly CouncilLayerRecord[]
    readonly narration: CouncilRunNarration
    readonly stopReason: string
    readonly agentsStarted: number
    readonly durationMs: number
    readonly maxReportChars: number
  },
): CouncilResultRecord {
  const rows: CouncilResultRow[] = []
  const counts = {
    findings: outcome.findings.length,
    confirmed: 0, rejected: 0, notABug: 0, insufficient: 0, unverified: 0,
  }
  outcome.findings.forEach((finding, index) => {
    const row = outcome.tally?.rows[index]
    // No tally at all is NOT "fewer than two verifiers voted" — nobody was ever
    // asked. Labelling both `insufficient` would make every synthesis run look
    // like a failed quorum.
    const outcomeLabel = row?.outcome ?? 'unverified'
    if (outcomeLabel === 'confirmed') counts.confirmed += 1
    else if (outcomeLabel === 'rejected') counts.rejected += 1
    else if (outcomeLabel === 'not-a-bug') counts.notABug += 1
    else if (outcomeLabel === 'insufficient') counts.insufficient += 1
    else counts.unverified += 1
    if (rows.length >= MAX_RECORD_ROWS) return
    rows.push({
      findingId: finding.id,
      title: finding.title,
      location: finding.location,
      severity: finding.severity,
      votes: row?.votes.map(vote => vote) ?? [],
      participating: row?.participating ?? 0,
      outcome: outcomeLabel,
      fix: finding.fix,
    })
  })
  const report = bound(outcome.report, context.maxReportChars)
  return {
    kind: COUNCIL_ARTIFACT_KIND,
    version: COUNCIL_ARTIFACT_VERSION,
    runId: context.runId,
    task: taskSnippet(context.task),
    startedAt: context.narration.startedAt,
    layers: context.layers,
    phases: context.narration.phases,
    messages: context.narration.messages,
    preset: context.preset,
    stopReason: outcome.stopReason === 'deadline' ? 'deadline' : context.stopReason,
    agentsStarted: context.agentsStarted,
    durationMs: context.durationMs,
    membersReporting: outcome.membersReporting,
    membersResponding: outcome.membersResponding,
    mapMembers: outcome.mapMembers,
    reportMissing: outcome.reportMissing,
    counts,
    verifiers: outcome.tally?.verifiers ?? [],
    rows,
    rowsTruncated: rows.length < outcome.findings.length,
    report,
    reportTruncated: report.length < outcome.report.length,
  }
}

/**
 * The record left behind by a run that never produced a usable value.
 * @param context - the preset, the failure's stop reason and message, and timings.
 * @returns a record whose counts are zero and whose stop reason names the failure.
 */
export function failureRecord(context: {
  readonly runId: string
  readonly preset: string
  readonly task: string
  readonly layers: readonly CouncilLayerRecord[]
  readonly narration: CouncilRunNarration
  readonly stopReason: string
  readonly error: string
  readonly agentsStarted: number
  readonly durationMs: number
}): CouncilResultRecord {
  return {
    kind: COUNCIL_ARTIFACT_KIND,
    version: COUNCIL_ARTIFACT_VERSION,
    runId: context.runId,
    task: taskSnippet(context.task),
    startedAt: context.narration.startedAt,
    layers: context.layers,
    phases: context.narration.phases,
    messages: context.narration.messages,
    preset: context.preset,
    stopReason: context.stopReason,
    error: context.error,
    agentsStarted: context.agentsStarted,
    durationMs: context.durationMs,
    membersReporting: 0,
    membersResponding: 0,
    mapMembers: 0,
    reportMissing: true,
    counts: { findings: 0, confirmed: 0, rejected: 0, notABug: 0, insufficient: 0, unverified: 0 },
    verifiers: [],
    rows: [],
    rowsTruncated: false,
    report: '',
    reportTruncated: false,
  }
}

const OUTPUT_PROPERTIES = {
  runId: { type: 'string', required: true },
  preset: { type: 'string', required: true },
  agentsStarted: { type: 'integer', required: true },
  stopReason: { type: 'string', required: true },
  durationMs: { type: 'integer', required: true },
  result: { type: 'json', required: true },
  /**
   * The run's durable artifact. It leaves through `presentationMeta`, which the
   * harness persists on the `tool/result` event — the only durable channel an
   * out-of-repo plugin has, since a private session event family would make the
   * whole log unreadable.
   */
  artifact: { type: 'json', required: true },
} as const

interface CouncilArgs {
  task: string
  preset?: string
}

export function presentCall(args: CouncilArgs): ToolCallView {
  const task = args.task.trim()
  const firstLine = task.split('\n', 1)[0] ?? ''
  return {
    card: 'generic',
    title: `council: ${args.preset ?? 'default preset'} — ${bound(firstLine, 80)}`,
    kind: 'other',
    rawInput: task,
  }
}

export function presentResult(args: CouncilArgs, result: ToolResult): ToolResultView {
  const view = readArtifact(result.meta)
  if (view === undefined) return { card: 'generic', title: `council: ${args.preset ?? 'default preset'}` }
  const parts = [`${view.membersResponding}/${view.mapMembers} answered`, `${view.counts.findings} findings`]
  if (view.counts.findings > 0) parts.push(`${view.counts.confirmed} confirmed`)
  parts.push(`${view.agentsStarted} agents`)
  if (view.durationMs > 0) parts.push(`${Math.round(view.durationMs / 1000)}s`)
  if (view.stopReason !== 'completed') parts.push(view.stopReason)
  if (view.reportMissing) parts.push('no report')
  return { card: 'generic', title: `council: ${view.preset} — ${parts.join(' · ')}` }
}

/**
 * Recognize one of this plugin's run artifacts in a `tool/result` meta payload.
 *
 * Presenters run on REPLAY of arbitrary logged results, including ones written
 * by another build, so the shape is checked rather than assumed.
 * @param meta - the persisted presentation payload.
 * @returns the artifact, or undefined when the payload is not one.
 */
export function readArtifact(meta: unknown): CouncilResultRecord | undefined {
  if (!isRecord(meta)) return undefined
  if (meta['kind'] !== COUNCIL_ARTIFACT_KIND) return undefined
  if (meta['version'] !== COUNCIL_ARTIFACT_VERSION) return undefined
  if (typeof meta['preset'] !== 'string' || typeof meta['runId'] !== 'string') return undefined
  if (!isRecord(meta['counts']) || !Array.isArray(meta['rows'])) return undefined
  return meta as unknown as CouncilResultRecord
}

/**
 * Project one preset's expanded layers into the durable topology record.
 * @param preset - the preset being run.
 * @returns one entry per layer, in composition order.
 */
function layerRecords(preset: PresetConfig): CouncilLayerRecord[] {
  return preset.layers.map(layer => ({
    id: layer.id,
    kind: layer.kind,
    label: layer.label ?? layer.id,
    width: layer.roles.reduce((sum, role) => sum + (role.count ?? 1), 0),
  }))
}

/**
 * Register the council tool and its usage policy.
 * @param ctx - the plugin context; `inject` guarantees the four services.
 * @param config - the loader-normalized deployment configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const composed = resolveConfig(config)
  const recorder = createCouncilRecorder(ctx)

  // The deployment policy (`config`) fixes the topology and the tool's surface
  // at registration. There is no global user overlay anymore — a council is
  // configured where it runs, in the composer-dock designer at the start of a
  // Map-Reduce session — so the only thing this tool row reads from the
  // `council` settings namespace at call time is the calling session's own
  // setup. Reading it fresh on every call lets an edit land on the next run
  // without a recomposition; a deployment with no settings service (or no host
  // row) runs the composed policy unchanged, and a session that never
  // configured a council lets the model pick a preset per request as before.
  const readSettings = (): CouncilSettings | undefined => {
    const settings = ctx.get('settings') as { get(name: string): unknown } | undefined
    return settings?.get(COUNCIL_NAMESPACE) as CouncilSettings | undefined
  }

  const presetList = composed.presets
    .map(preset => `- ${preset.id}: ${preset.description}`)
    .join('\n')

  const presetGuidance = 'Pick the preset by the task — `bug-hunt` for finding defects or auditing code, '
    + '`research` for investigating a question, `feature-design` for designing a feature, `refactor` for '
    + 'planning a refactor. Its verdicts are what its members reported, not independent certification.'
  ctx.systemPrompt.section({
    name: 'tool:council',
    order: 117,
    // The mandate is the mode's whole point, so it stays the default — but a
    // deployment that composes the tool into a general mode needs the council
    // available without every trivial question fanning out to eight children.
    text: composed.councilEveryRequest
      ? 'You are operating in Map-Reduce mode. Answer every substantive request through the `council` '
        + 'tool: choose the preset that matches the task, call `council` with the full task text, then report '
        + 'its verdict table and written conclusion. Only trivial chit-chat may be answered directly. '
        + presetGuidance
      : 'The `council` tool runs a fan-out of independent subagents over one task. Reach for it when a '
        + 'question is worth several independent readings — an audit, a design decision, a claim you want '
        + 'cross-checked — and answer directly otherwise. ' + presetGuidance,
  })

  ctx.tools.register(defineTool({
    name: composed.toolName,
    description: 'Run a council of independent subagents over one task: several members examine it in '
      + 'parallel through different lenses, verifiers re-check each finding from the source, and a '
      + 'synthesizer writes the report. Returns a verdict table and a written conclusion. In Map-Reduce '
      + 'mode this is the primary way to do work — call it for every substantive request.\n\nPresets:\n'
      + presetList,
    parameters: {
      task: {
        type: 'string',
        required: true,
        description: 'What the council examines. Include the subject (paths, a diff, a question) and what '
          + 'a good answer looks like. Every member sees this text and nothing else of your conversation.',
      },
      preset: {
        type: 'string',
        enum: composed.presets.map(preset => preset.id),
        description: `Topology to run. Choose by the task: bug-hunt for finding defects/auditing code, `
          + `research for investigating a question, feature-design for designing a feature, refactor for `
          + `planning a refactor. Defaults to ${composed.defaultPreset.id}. `
          + 'Ignored when this session has a council configured in the composer designer — that topology '
          + 'is fixed for the session and runs for every request in it.',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: OUTPUT_PROPERTIES },
      render: (_args, value) => [{
        type: 'text',
        text: renderOutcome(value.result as unknown as CouncilOutcome, composed.maxReportChars),
      }],
      // The artifact IS the presentation payload: the harness persists it on the
      // `tool/result` event, which is what lets the Council tab reopen a
      // finished run from a fresh client session.
      presentationMeta: (_args, value) => value.artifact,
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('council requires a calling agent (exec.agent was undefined)')
      const task = args.task.trim()
      if (task.length === 0) throw new Error('council task must be a non-empty string')
      const section = readSettings()
      const resolved = composed
      // A session that configured its council in the designer runs THAT
      // topology for every request: the model's per-request preset choice is a
      // fallback for sessions (and deployments) without one, never an override
      // of what the user fixed. `applySessionSetup` composes the tuning onto
      // the real preset and refuses an over-wide layer or unreachable quorum
      // before a single child is paid for.
      const setup: SessionCouncilSetup | undefined = sessionSetupOf(section, parent.session.id)
      let runPreset: PresetConfig
      // A custom (from-scratch) council carries its whole topology in the
      // setup; it is never anchored to a mirrored preset.
      const customLayers = (setup?.topology ?? []).length > 0 && (setup?.presetId ?? '') === ''
      if (customLayers) {
        runPreset = applyCustomSetup(setup!.topology ?? [], resolved.maxAgentsPerLayer, setup?.name ?? '')
        const validated = resolveConfig({
          presets: [runPreset],
          defaultPreset: runPreset.id,
          maxAgentsPerLayer: resolved.maxAgentsPerLayer,
          maxLayers: resolved.maxLayers,
        })
        runPreset = validated.presets[0] ?? runPreset
      } else if (setup?.presetId !== undefined && setup.presetId !== '') {
        const fixed = resolved.presets.find(candidate => candidate.id === setup.presetId)
        if (fixed === undefined) {
          throw new Error(
            `council: this session's preset "${setup.presetId}" is not offered by the deployment`,
          )
        }
        runPreset = applySessionSetup(fixed, setup, resolved.maxAgentsPerLayer)
        // A session may author roles and layers, and authored structure is
        // user-plane JSON: run the FULL deployment validation over the result
        // (unique ids, non-empty prompts, one trailing reduce, the layer cap,
        // widths, the quorum) before a single child is paid for.
        const validated = resolveConfig({
          presets: [runPreset],
          defaultPreset: runPreset.id,
          maxAgentsPerLayer: resolved.maxAgentsPerLayer,
          maxLayers: resolved.maxLayers,
        })
        runPreset = validated.presets[0] ?? runPreset
      } else {
        const picked = args.preset === undefined
          ? resolved.defaultPreset
          : resolved.presets.find(candidate => candidate.id === args.preset)
        if (picked === undefined) throw new Error(`council: unknown preset "${String(args.preset)}"`)
        runPreset = picked
      }
      void requireFreshProvider(ctx, resolved.subagentProvider)

      const layers = expandLayers(runPreset)
      const scriptArgs: ScriptArgs = {
        framing: runPreset.framing ?? '',
        task,
        reduceMode: runPreset.reduceMode ?? 'vote',
        maxFindings: resolved.maxFindings,
        maxFindingChars: resolved.maxFindingChars,
        maxFindingsPerMember: resolved.maxFindingsPerMember,
        maxRunMs: resolved.maxRunMs,
        retryFailedMembers: resolved.retryFailedMembers,
        mergeSameLocation: resolved.mergeSameLocation,
        maxMergeCandidates: resolved.maxMergeCandidates,
        layers,
      }

      const startedAt = Date.now()
      const run: WorkflowRun = ctx.workflowEngine.start({
        script: COUNCIL_SCRIPT,
        meta: {
          name: `council:${runPreset.id}`,
          description: runPreset.description,
          // The title must stay the layer id: `phase(title)` matches it by exact
          // string, and the script phases by layer id. The KIND travels in the
          // durable `tool-council/run-start` record instead, which is what the
          // Council tab translates its legends from.
          phases: layers.map(layer => ({
            title: layer.id,
            detail: `${layer.kind} — ${layer.instances.map(instance => instance.label).join(', ')}`,
          })),
        },
        args: scriptArgs as unknown as JsonValue,
        subagentProvider: resolved.subagentProvider,
        maxTotalAgents: totalAgentBudget(layers, resolved),
        parent,
        signal: exec.signal,
      })
      recorder.start(parent.session, run)
      const onAbort = (): void => { run.cancel('parent step aborted') }
      exec.signal.addEventListener('abort', onAbort, { once: true })
      if (exec.signal.aborted) run.cancel('parent step aborted')

      // The script bows out at its own layer boundaries, which cannot help if a
      // single layer never settles — so the host keeps a hard backstop past the
      // grace the script needs to finish its layer and write the report.
      const hardStop = resolved.maxRunMs > 0
        ? setTimeout(
            () => { run.cancel(`council run exceeded maxRunMs ${resolved.maxRunMs}ms`) },
            resolved.maxRunMs + HARD_STOP_GRACE_MS,
          )
        : undefined

      let settled: Awaited<WorkflowRun['result']> | undefined
      let record: CouncilResultRecord | undefined
      try {
        settled = await run.result
        const error = stopReasonError(settled)
        if (error !== undefined) throw new Error(error)
        const outcome = readOutcome(settled.value)
        // Everything below crossed a structured-clone boundary and is therefore
        // data, not a result the host may trust: check the clustering's own
        // invariants, then recompute the quorum from the raw ballots, so a drift
        // between the two copies cannot quietly change which findings the reader
        // acts on.
        assertClustersWellFormed(outcome.findings)
        if (outcome.tally !== null) {
          const verifyLayer = runPreset.layers.find(layer => layer.kind === 'verify')
          const quorum = verifyLayer?.quorum ?? { rule: 'majority' as const }
          assertTallyAgrees(tally(outcome.findings, outcome.ballots, quorum), outcome.tally)
        }
        record = buildResultRecord(outcome, {
          runId: run.id,
          preset: runPreset.id,
          task,
          layers: layerRecords(runPreset),
          narration: recorder.narration(run.id),
          stopReason: settled.stopReason,
          agentsStarted: settled.agentsStarted,
          durationMs: Date.now() - startedAt,
          maxReportChars: resolved.maxReportChars,
        })
        return {
          runId: run.id,
          preset: runPreset.id,
          agentsStarted: settled.agentsStarted,
          stopReason: record.stopReason,
          durationMs: record.durationMs,
          result: outcome as unknown as JsonValue,
          artifact: record as unknown as JsonValue,
        }
      } catch (error: unknown) {
        // The failure artifact never reaches a `tool/result` meta — an errored
        // call has no output value — but it keeps the shape one place and gives
        // the log line below something honest to say.
        record = failureRecord({
          runId: run.id,
          preset: runPreset.id,
          task,
          layers: layerRecords(runPreset),
          narration: recorder.narration(run.id),
          stopReason: settled?.stopReason ?? 'error',
          error: error instanceof Error ? error.message : String(error),
          agentsStarted: settled?.agentsStarted ?? 0,
          durationMs: Date.now() - startedAt,
        })
        throw error
      } finally {
        if (hardStop !== undefined) clearTimeout(hardStop)
        exec.signal.removeEventListener('abort', onAbort)
        try {
          // Disposal is awaited BEFORE closing the record so the agent-end
          // events the engine synthesizes while tearing down children still
          // reach the graph — but `finish` is in the finally, because a throwing
          // dispose used to skip it and leave the run reading `running` for ever.
          await run.dispose()
        } finally {
          recorder.finish(run.id, settled?.stopReason ?? 'error')
          recorder.abandon(run.id)
        }
      }
    },
    presentCall,
    presentResult,
  }))
}
