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
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type { SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallView, ToolResultView } from '@deepseek-ai/dsh-tools'
import type { WorkflowResult, WorkflowRun } from '@deepseek-ai/dsh-workflow'
// Declaration merge only: makes ctx.systemPrompt visible for section registration.
import type {} from '@deepseek-ai/dsh-system-prompt'

import { expandLayers, resolveConfig } from './policy.ts'
import type { Config, ResolvedConfig } from './policy.ts'
import { createCouncilRecorder } from './recorder.ts'
import { COUNCIL_NAMESPACE, applyOverrides } from './settings.ts'
import type { CouncilSettings } from './settings.ts'
import { COUNCIL_SCRIPT } from './script.ts'
import type { ScriptArgs } from './script.ts'
import { assertTallyAgrees, renderTable, tally } from './tally.ts'
import type { ClusteredFinding, Tally, VerifierBallot } from './types.ts'

export type * from './types.ts'
export type * from './settings.ts'
export { BUILTIN_PRESETS } from './presets.ts'
export { Config, expandLayers, resolveConfig } from './policy.ts'
export type { ResolvedConfig } from './policy.ts'
export { COUNCIL_NAMESPACE, applyOverrides } from './settings.ts'
export {
  applyQuorum, dedupeFindings, fingerprint, normalizeLocation, renderTable, tally,
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
  readonly membersReporting: number
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
    || typeof value['membersReporting'] !== 'number') {
    throw new Error('council: the workflow returned a malformed result')
  }
  const table = value['tally']
  if (table !== null && !isRecord(table)) throw new Error('council: the workflow returned a malformed tally')
  return {
    findings: value['findings'] as ClusteredFinding[],
    ballots: value['ballots'] as VerifierBallot[],
    tally: table as Tally | null,
    report: value['report'],
    membersReporting: value['membersReporting'],
  }
}

/**
 * Map a non-clean workflow stop reason to an error message.
 * @param result - the settled workflow result.
 * @returns the message, or `undefined` when the run completed cleanly.
 */
function stopReasonError(result: WorkflowResult): string | undefined {
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
 * Render the council's result for the parent model.
 *
 * The quorum line is deliberately phrased as a count of members, not as a
 * certification: verifiers are agents re-reading the same repository, and the
 * table would otherwise read as an independent oracle.
 * @param outcome - the validated script outcome.
 * @param maxChars - the report ceiling.
 * @returns the model-facing text.
 */
export function renderOutcome(outcome: CouncilOutcome, maxChars: number): string {
  const parts: string[] = []
  if (outcome.tally !== null) {
    if (outcome.findings.length > 0) {
      const confirmed = outcome.tally.rows.filter(row => row.outcome === 'confirmed').length
      parts.push(
        `${outcome.membersReporting} council members reported ${outcome.findings.length} distinct findings; `
        + `${outcome.ballots.length} verifiers voted, confirming ${confirmed}.`,
        renderTable(outcome.findings, outcome.tally),
      )
    } else {
      parts.push(`${outcome.membersReporting} council members reported no findings.`)
    }
  }
  // A null tally is the synthesis path: no table, just the written report.
  if (outcome.report !== '') parts.push(outcome.report)
  return bound(parts.join('\n\n'), maxChars)
}

const OUTPUT_PROPERTIES = {
  runId: { type: 'string', required: true },
  preset: { type: 'string', required: true },
  agentsStarted: { type: 'integer', required: true },
  result: { type: 'json', required: true },
} as const

interface CouncilArgs {
  task: string
  preset?: string
}

function presentCall(args: CouncilArgs): ToolCallView {
  return { card: 'generic', title: `council: ${args.preset ?? 'default'}`, kind: 'other', rawInput: args.task }
}

function presentResult(args: CouncilArgs, result: { content: ContentBlock[]; isError: boolean }): ToolResultView {
  void args
  void result
  return { card: 'generic' }
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
  // at registration. The user plane — default preset, per-role widths and
  // models, quorums — lives in the `council` settings namespace, which the
  // always-composed host row owns and this tool row only reads. Reading it
  // fresh on every call lets an edit land on the next run without a
  // recomposition; a deployment with no settings service (or no host row) runs
  // the composed policy unchanged.
  const effective = (): ResolvedConfig => {
    const settings = ctx.get('settings') as { get(name: string): unknown } | undefined
    const section = settings?.get(COUNCIL_NAMESPACE) as CouncilSettings | undefined
    if (section === undefined) return composed
    return resolveConfig({
      ...config,
      presets: applyOverrides(composed.presets, section.overrides),
      defaultPreset: section.defaultPreset ?? composed.defaultPreset.id,
    })
  }

  const presetList = composed.presets
    .map(preset => `- ${preset.id}: ${preset.description}`)
    .join('\n')

  ctx.systemPrompt.section({
    name: 'tool:council',
    order: 117,
    text: 'You are operating in Map-Reduce mode. Answer every substantive request through the `council` '
      + 'tool: choose the preset that matches the task, call `council` with the full task text, then report '
      + 'its verdict table and written conclusion. Pick the preset by the task — `bug-hunt` for finding '
      + 'defects or auditing code, `research` for investigating a question, `feature-design` for designing '
      + 'a feature, `refactor` for planning a refactor. Only trivial chit-chat may be answered directly. '
      + 'Its verdicts are what its members reported, not independent certification.',
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
          + `planning a refactor. Defaults to ${composed.defaultPreset.id}.`,
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: OUTPUT_PROPERTIES },
      render: (_args, value) => [{
        type: 'text',
        text: renderOutcome(value.result as unknown as CouncilOutcome, composed.maxReportChars),
      }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('council requires a calling agent (exec.agent was undefined)')
      const task = args.task.trim()
      if (task.length === 0) throw new Error('council task must be a non-empty string')
      const resolved = effective()
      const preset = args.preset === undefined
        ? resolved.defaultPreset
        : resolved.presets.find(candidate => candidate.id === args.preset)
      if (preset === undefined) throw new Error(`council: unknown preset "${String(args.preset)}"`)
      void requireFreshProvider(ctx, resolved.subagentProvider)

      const layers = expandLayers(preset)
      const scriptArgs: ScriptArgs = {
        framing: preset.framing ?? '',
        task,
        reduceMode: preset.reduceMode ?? 'vote',
        maxFindings: resolved.maxFindings,
        maxFindingChars: resolved.maxFindingChars,
        layers,
      }
      const totalAgents = layers.reduce((sum, layer) => sum + layer.instances.length, 0)

      const run: WorkflowRun = ctx.workflowEngine.start({
        script: COUNCIL_SCRIPT,
        meta: {
          name: `council:${preset.id}`,
          description: preset.description,
          phases: layers.map(layer => ({
            title: layer.id,
            detail: `${layer.kind} — ${layer.instances.map(instance => instance.label).join(', ')}`,
          })),
        },
        args: scriptArgs as unknown as JsonValue,
        subagentProvider: resolved.subagentProvider,
        maxTotalAgents: totalAgents,
        parent,
        signal: exec.signal,
      })
      recorder.start(parent.session, run)
      const onAbort = (): void => { run.cancel('parent step aborted') }
      exec.signal.addEventListener('abort', onAbort, { once: true })
      if (exec.signal.aborted) run.cancel('parent step aborted')

      let settled: Awaited<WorkflowRun['result']> | undefined
      try {
        settled = await run.result
        const error = stopReasonError(settled)
        if (error !== undefined) throw new Error(error)
        const outcome = readOutcome(settled.value)
        // The script's tally crossed a structured-clone boundary; recompute it
        // from the raw ballots so a drift between the two copies of the quorum
        // cannot quietly change which findings the reader acts on.
        if (outcome.tally !== null) {
          const verifyLayer = preset.layers.find(layer => layer.kind === 'verify')
          const quorum = verifyLayer?.quorum ?? { rule: 'majority' as const }
          assertTallyAgrees(tally(outcome.findings, outcome.ballots, quorum), outcome.tally)
        }
        return {
          runId: run.id,
          preset: preset.id,
          agentsStarted: settled.agentsStarted,
          result: outcome as unknown as JsonValue,
        }
      } finally {
        exec.signal.removeEventListener('abort', onAbort)
        try {
          await run.dispose()
          if (settled !== undefined) recorder.finish(run.id, settled.stopReason)
        } finally {
          recorder.abandon(run.id)
        }
      }
    },
    presentCall,
    presentResult,
  }))
}
