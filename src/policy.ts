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
  /** Ceiling on one layer's concurrent children (default 12). */
  maxAgentsPerLayer?: number
  /** Ceiling on a preset's layer count (default 6). */
  maxLayers?: number
  /** Ceiling on findings carried into the verify layer (default 200). */
  maxFindings?: number
  /** Ceiling on one serialized finding's characters (default 2000). */
  maxFindingChars?: number
  /** Ceiling on the parent-facing report's characters (default 32768). */
  maxReportChars?: number
}

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
  maxAgentsPerLayer: z.number().step(1).min(1).max(64).default(12),
  maxLayers: z.number().step(1).min(1).max(16).default(6),
  maxFindings: z.number().step(1).min(1).max(10_000).default(200),
  maxFindingChars: z.number().step(1).min(1).max(100_000).default(2_000),
  maxReportChars: z.number().step(1).min(1).max(1_000_000).default(32_768),
})

export interface ResolvedConfig {
  readonly toolName: string
  readonly subagentProvider: string
  readonly presets: readonly PresetConfig[]
  readonly defaultPreset: PresetConfig
  readonly maxFindings: number
  readonly maxFindingChars: number
  readonly maxReportChars: number
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
  const maxAgentsPerLayer = config.maxAgentsPerLayer ?? 12
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
    // The reduce branch in the script returns unconditionally, so any layer
    // after a reduce is silently dropped; and the script tallies ballots with
    // the LAST verify layer's quorum while the host recomputes with the first,
    // so a second verify layer would split the two copies.
    if (preset.layers.slice(0, -1).some(layer => layer.kind === 'reduce')) {
      throw new TypeError(`${where}: only the last layer may be a reduce layer`)
    }
    const verifyCount = preset.layers.filter(layer => layer.kind === 'verify').length
    if (verifyCount > 1) {
      throw new TypeError(`${where}: at most one verify layer is supported (${verifyCount} declared)`)
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
    maxFindings: config.maxFindings ?? 200,
    maxFindingChars: config.maxFindingChars ?? 2_000,
    maxReportChars: config.maxReportChars ?? 32_768,
  }
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
    const roleIds = new Set<string>()
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
