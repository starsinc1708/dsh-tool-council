/**
 * The council's deployment policy: the schema, the structural validation, and
 * the role expansion. Owned here, apart from the tool and the host rows, so the
 * always-composed host row can validate the same policy it publishes and mirrors
 * without dragging in the tool's `ctx.tools`/workflow dependencies.
 *
 * @module @starsinc1708/dsh-tool-council
 */

import z from '@deepseek-ai/schemastery'

import { BUILTIN_PRESETS } from './presets.ts'
import type { ScriptInstance, ScriptLayer } from './script.ts'
import type { LayerConfig, PresetConfig, QuorumConfig, RoleConfig } from './types.ts'

/** Deployment policy for the council tool. */
export interface Config {
  /** Model-facing tool name. Defaults to `council`. */
  toolName?: string
  /** Fresh structured-output provider every child uses (default `spawn`). */
  subagentProvider?: string
  /** The topologies this deployment offers. Defaults to {@link BUILTIN_PRESETS}. */
  presets?: PresetConfig[]
  /** Preset used when the model names none. Must be one of `presets`. */
  defaultPreset?: string
  /** Ceiling on one layer's concurrent children (default 100). */
  maxAgentsPerLayer?: number
  /** Ceiling on a preset's layer count (default 6). */
  maxLayers?: number
  /** Ceiling on findings carried into the verify layer (default 200). */
  maxFindings?: number
  /**
   * Ceiling on findings one member contributes before clustering (default 50).
   * `0` disables it. Without a per-member cap one talkative member can fill
   * `maxFindings` and the quieter members never reach the slice.
   */
  maxFindingsPerMember?: number
  /** Ceiling on one serialized finding's characters (default 2000). */
  maxFindingChars?: number
  /** Ceiling on the parent-facing report's characters (default 32768). */
  maxReportChars?: number
  /**
   * Wall-clock budget for one run in milliseconds; `0` (the default) disables
   * it. The script checks it at each layer boundary and still runs the trailing
   * reduce layer, so an over-budget run returns partial findings with an
   * explicit stop reason rather than nothing. The host cancels the run outright
   * once the budget plus {@link HARD_STOP_GRACE_MS} has passed — the backstop
   * for a layer that never settles, and the only enforcement left if the worker
   * realm exposes no clock. A layer already running is never cut short, so this
   * bounds how long a run keeps spending, not when it stops.
   */
  maxRunMs?: number
  /**
   * Re-issue one `agent()` call whose child died before giving up on that role
   * (default true). A dead child resolves to `null` instead of throwing, so
   * without this a transport failure silently removes a whole lens.
   */
  retryFailedMembers?: boolean
  /**
   * Run the merge stage between clustering and verification (default true).
   * It spends one extra child ONLY when two clusters share a location, which is
   * exactly the case the lexical key cannot decide.
   */
  mergeSameLocation?: boolean
  /** Ceiling on clusters handed to the merge stage (default 60). */
  maxMergeCandidates?: number
  /**
   * Whether the prompt section mandates the council for every substantive
   * request (default true — that mandate is what Map-Reduce mode IS).
   *
   * Set false for a deployment that mounts the tool inside a general-purpose
   * mode, where fanning every question out to eight children is not what the
   * user asked for.
   */
  councilEveryRequest?: boolean
}

/**
 * Grace added to `maxRunMs` before the host cancels the run outright. The
 * script's own budget check happens at layer boundaries, so it needs room to
 * finish the layer it is in and write the report.
 */
export const HARD_STOP_GRACE_MS = 60_000

const Quorum: z<QuorumConfig> = z.object({
  rule: z.union(['majority', 'unanimous', 'threshold'] as const).default('majority'),
  threshold: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
})

const Role: z<RoleConfig> = z.object({
  id: z.string().required(),
  label: z.string(),
  prompt: z.string().required(),
  count: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  model: z.string(),
  provider: z.string(),
})

const Layer: z<LayerConfig> = z.object({
  id: z.string().required(),
  kind: z.union(['map', 'verify', 'reduce'] as const).required(),
  label: z.string(),
  roles: z.array(Role).default([]),
  quorum: Quorum.default(undefined as unknown as QuorumConfig),
})

const Preset: z<PresetConfig> = z.object({
  id: z.string().required(),
  label: z.string(),
  description: z.string().required(),
  reduceMode: z.union(['vote', 'synthesis'] as const).default('vote'),
  framing: z.string().default(''),
  layers: z.array(Layer).default([]),
})

/** Schemastery configuration for the council tool. */
export const Config: z<Config> = z.object({
  toolName: z.string().default('council'),
  subagentProvider: z.string().default('spawn'),
  presets: z.array(Preset).default([...BUILTIN_PRESETS] as PresetConfig[]),
  defaultPreset: z.string().default('bug-hunt'),
  maxAgentsPerLayer: z.number().step(1).min(1).max(100).default(100),
  maxLayers: z.number().step(1).min(1).max(16).default(6),
  maxFindings: z.number().step(1).min(1).max(10_000).default(200),
  maxFindingsPerMember: z.number().step(1).min(0).max(10_000).default(50),
  maxFindingChars: z.number().step(1).min(1).max(100_000).default(2_000),
  maxReportChars: z.number().step(1).min(1).max(1_000_000).default(32_768),
  maxRunMs: z.number().step(1).min(0).max(24 * 60 * 60 * 1000).default(0),
  retryFailedMembers: z.boolean().default(true),
  mergeSameLocation: z.boolean().default(true),
  maxMergeCandidates: z.number().step(1).min(2).max(1_000).default(60),
  councilEveryRequest: z.boolean().default(true),
})

export interface ResolvedConfig {
  readonly toolName: string
  readonly subagentProvider: string
  readonly presets: readonly PresetConfig[]
  readonly defaultPreset: PresetConfig
  readonly maxAgentsPerLayer: number
  /** Ceiling on one preset's layer count — mirrored for the designer's layer gate. */
  readonly maxLayers: number
  readonly maxFindings: number
  readonly maxFindingsPerMember: number
  readonly maxFindingChars: number
  readonly maxReportChars: number
  readonly maxRunMs: number
  readonly retryFailedMembers: boolean
  readonly mergeSameLocation: boolean
  readonly maxMergeCandidates: number
  readonly councilEveryRequest: boolean
}

/**
 * Validate the composition at load, not at call.
 *
 * Schemastery cannot express the structural rules a council depends on — one
 * trailing reduce layer with exactly one role, a quorum exactly where a verify
 * layer is, unique ids — and a topology that violates them produces a run that
 * silently drops a layer instead of failing. A bad config must break the
 * deployment.
 * @param config - the loader-normalized configuration.
 * @returns the validated policy every call reuses.
 * @throws TypeError on any structural violation, naming the offending preset.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  const presets = config.presets ?? [...BUILTIN_PRESETS]
  const maxAgentsPerLayer = config.maxAgentsPerLayer ?? 100
  const maxLayers = config.maxLayers ?? 6
  if (presets.length === 0) throw new TypeError('council: at least one preset is required')
  const ids = new Set<string>()
  for (const preset of presets) {
    const where = `council preset "${preset.id}"`
    if (ids.has(preset.id)) throw new TypeError(`${where}: duplicate preset id`)
    ids.add(preset.id)
    if (preset.layers.length === 0) throw new TypeError(`${where}: has no layers`)
    if (preset.layers.length > maxLayers) {
      throw new TypeError(`${where}: ${preset.layers.length} layers exceeds maxLayers ${maxLayers}`)
    }
    const last = preset.layers[preset.layers.length - 1]
    /* v8 ignore next -- length was checked above; the index cannot be empty. */
    if (last === undefined) throw new TypeError(`${where}: has no layers`)
    if (last.kind !== 'reduce') throw new TypeError(`${where}: the last layer must be a reduce layer`)
    // A second reduce layer would overwrite the first one's report with no
    // record that it existed; and the script tallies ballots with the LAST
    // verify layer's quorum while the host recomputes with the first, so a
    // second verify layer would split the two copies.
    if (preset.layers.slice(0, -1).some(layer => layer.kind === 'reduce')) {
      throw new TypeError(`${where}: only the last layer may be a reduce layer`)
    }
    const verifyCount = preset.layers.filter(layer => layer.kind === 'verify').length
    if (verifyCount > 1) {
      throw new TypeError(`${where}: at most one verify layer is supported (${verifyCount} declared)`)
    }
    // Every map layer re-clusters the CUMULATIVE finding list and renumbers
    // `f1…fn`, so a map layer after the verify layer invalidates the ids the
    // ballots were cast against — and the host's recomputation then refuses the
    // run at the very end, after every child has been paid for. Refuse the
    // topology at load instead.
    const verifyAt = preset.layers.findIndex(layer => layer.kind === 'verify')
    if (verifyAt >= 0 && preset.layers.slice(verifyAt + 1).some(layer => layer.kind === 'map')) {
      throw new TypeError(`${where}: a map layer may not follow the verify layer`)
    }
    validateLayers(preset, maxAgentsPerLayer, where)
  }
  const defaultId = config.defaultPreset ?? 'bug-hunt'
  const defaultPreset = presets.find(preset => preset.id === defaultId)
  if (defaultPreset === undefined) {
    throw new TypeError(`council: defaultPreset "${defaultId}" is not among the configured presets`)
  }
  return {
    toolName: config.toolName ?? 'council',
    subagentProvider: config.subagentProvider ?? 'spawn',
    presets,
    defaultPreset,
    maxAgentsPerLayer,
    maxLayers,
    maxFindings: config.maxFindings ?? 200,
    maxFindingsPerMember: config.maxFindingsPerMember ?? 50,
    maxFindingChars: config.maxFindingChars ?? 2_000,
    maxReportChars: config.maxReportChars ?? 32_768,
    maxRunMs: config.maxRunMs ?? 0,
    retryFailedMembers: config.retryFailedMembers ?? true,
    mergeSameLocation: config.mergeSameLocation ?? true,
    maxMergeCandidates: config.maxMergeCandidates ?? 60,
    councilEveryRequest: config.councilEveryRequest ?? true,
  }
}

/**
 * The run's `maxTotalAgents` ceiling.
 *
 * `maxTotalAgents` is a hard engine cap, not a budget: a call past it kills the
 * run with `AGENT_CAP`. So it has to allow for everything the script may
 * legitimately spend — one retry per member when `retryFailedMembers` is on,
 * and one merge child when the merge stage is enabled — or a single dead child
 * would turn a degraded run into a failed one.
 * @param layers - the expanded layers of the preset being run.
 * @param options - whether retries and the merge stage are enabled.
 * @returns the ceiling to hand `WorkflowEngine.start`.
 */
export function totalAgentBudget(
  layers: readonly ScriptLayer[],
  options: { readonly retryFailedMembers: boolean; readonly mergeSameLocation: boolean },
): number {
  const instances = layers.reduce((sum, layer) => sum + layer.instances.length, 0)
  // Exactly one merge child per run: the script clusters once, at the last map
  // layer, however many map layers the topology declares.
  const merge = options.mergeSameLocation ? 1 : 0
  const attempts = options.retryFailedMembers ? 2 : 1
  return (instances + merge) * attempts
}

/**
 * Validate every layer of one preset.
 * @param preset - the preset under validation.
 * @param maxAgentsPerLayer - the deployment's width ceiling.
 * @param where - the error prefix naming the preset.
 * @throws TypeError on a duplicate id, a misplaced quorum, or an over-wide layer.
 */
function validateLayers(preset: PresetConfig, maxAgentsPerLayer: number, where: string): void {
  const layerIds = new Set<string>()
  // Role ids are unique across the WHOLE preset, not just within a layer:
  // `expandLayers` derives the instance id from the role id alone, so two
  // layers sharing a role id would share an instance id — collapsing their
  // per-member caps and their `reportedBy` attributions into one phantom member.
  const roleIds = new Set<string>()
  for (const layer of preset.layers) {
    if (layerIds.has(layer.id)) throw new TypeError(`${where}: duplicate layer id "${layer.id}"`)
    layerIds.add(layer.id)
    if (layer.roles.length === 0) throw new TypeError(`${where}: layer "${layer.id}" has no roles`)
    const width = layer.roles.reduce((sum, role) => sum + (role.count ?? 1), 0)
    if (width > maxAgentsPerLayer) {
      throw new TypeError(
        `${where}: layer "${layer.id}" width ${width} exceeds maxAgentsPerLayer ${maxAgentsPerLayer}`,
      )
    }
    for (const role of layer.roles) {
      if (roleIds.has(role.id)) {
        throw new TypeError(`${where}: layer "${layer.id}" has a duplicate role id "${role.id}"`)
      }
      roleIds.add(role.id)
      if (role.prompt.trim().length === 0) {
        throw new TypeError(`${where}: role "${role.id}" has an empty prompt`)
      }
    }
    if (layer.kind === 'verify' && layer.quorum === undefined) {
      throw new TypeError(`${where}: verify layer "${layer.id}" needs a quorum`)
    }
    if (layer.kind !== 'verify' && layer.quorum !== undefined) {
      throw new TypeError(`${where}: only a verify layer may declare a quorum ("${layer.id}")`)
    }
    if (layer.kind === 'verify' && layer.quorum?.rule === 'threshold') {
      const threshold = layer.quorum.threshold
      if (threshold === undefined || threshold < 1 || threshold > width) {
        throw new TypeError(
          `${where}: verify layer "${layer.id}" needs a threshold between 1 and its width ${width}`,
        )
      }
    }
    if (layer.kind === 'reduce' && (layer.roles.length !== 1 || (layer.roles[0]?.count ?? 1) !== 1)) {
      throw new TypeError(`${where}: reduce layer "${layer.id}" must have exactly one role instance`)
    }
  }
}

/**
 * Expand `RoleConfig.count` into the concrete instances the script fans out.
 *
 * A single-instance role keeps its bare id so the report's column header reads
 * `V1`, not `V1#1`.
 * @param preset - the preset whose layers are being expanded.
 * @returns the script-facing layers, in composition order.
 */
export function expandLayers(preset: PresetConfig): ScriptLayer[] {
  return preset.layers.map((layer) => {
    const instances: ScriptInstance[] = []
    for (const role of layer.roles) {
      const count = role.count ?? 1
      for (let copy = 1; copy <= count; copy += 1) {
        const instanceId = count === 1 ? role.id : `${role.id}#${copy}`
        instances.push({
          instanceId,
          label: role.label ?? role.id,
          prompt: role.prompt,
          ...role.model === undefined ? {} : { model: role.model },
          ...role.provider === undefined ? {} : { provider: role.provider },
        })
      }
    }
    return {
      id: layer.id,
      kind: layer.kind,
      quorumRule: layer.quorum?.rule ?? 'majority',
      // No default here: the host's `applyQuorum` defaults a missing threshold
      // to the live ballot count, so the script must do the same (`?? ballots`),
      // not `instances.length` — otherwise a failed verifier splits the copies.
      quorumThreshold: layer.quorum?.threshold,
      instances,
    }
  })
}
