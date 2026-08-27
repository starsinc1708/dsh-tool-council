/**
 * The council's HOST-plane row, mounted under the package's BARE name.
 *
 * Why the installer, not the tool, owns the bare name. Two constraints meet
 * here. The preset cannot install itself — a row living only inside the
 * `map-reduce` composition never runs until someone selects a mode that does
 * not exist yet — so the installer must sit on the host plane, which is
 * composed unconditionally. And the client module system serves a package's
 * browser bundle only for an entry whose name IS the package name: it resolves
 * `<entry>/package.json`, which a subpath row like `dsh-tool-council/tool` can
 * never satisfy. So the row that is always composed has to be the bare one, or
 * the settings card is never served.
 *
 * That fixes the split: bare name → this host row (preset publication, settings
 * ownership, browser bundle carrier); `./tool` subpath → the model-facing tool,
 * mounted by the preset it publishes.
 *
 * This row registers no tool and no prompt section, so composing it costs the
 * model nothing in any mode. It owns the `council` settings namespace: the
 * section lives on the always-composed host plane, so the browser card can
 * reach it in every mode, and the tool row (agent plane, mounted by the
 * published preset) reads it at call time.
 *
 * @module @starsinc1708/dsh-tool-council
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { dump } from 'js-yaml'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

import { ensurePreset } from './preset-install.ts'
import type { AgentPresetsLike } from './preset-install.ts'
import { COUNCIL_NAMESPACE, applyOverrides, toTopology } from './settings.ts'
import type { CouncilSettings, PresetOverride, QuorumOverride, RoleOverride } from './settings.ts'
import { resolveConfig } from './policy.ts'
import type { Config as CouncilConfig } from './policy.ts'

/** Cordis plugin name for the host row. */
export const name = 'tool-council-host'

/** Deployment policy for preset publication and settings ownership. */
export interface Config {
  /**
   * Publish the preset. `false` leaves `$DSH_HOME` untouched — the council is
   * then reachable only from a mode whose composition mounts the tool row by
   * hand.
   */
  installPreset?: boolean
  /** Roster id and directory name of the published preset. */
  presetId?: string
  /** Preset whose composition the published one is derived from. */
  presetSource?: string
  /** Display name in the mode menu; rendered verbatim, never translated. */
  presetName?: string
  /** Display description in the mode menu; rendered verbatim. */
  presetDescription?: string
  /** Sort order in the mode menu. */
  presetOrder?: number
  /**
   * Module specifier the published preset mounts the council tool by. A subpath
   * row deliberately: the bare name is this host row, already composed.
   */
  presetPluginName?: string
  /**
   * The council's deployment policy — the tool's own configuration. Owned here,
   * on the always-composed row, so the settings card can mirror the deployment's
   * real topology in every mode and the published preset can mount the tool
   * with the same policy. Omitted → the tool's schema defaults (the four
   * shipped topologies, `spawn`, `council`, default ceilings).
   */
  councilPolicy?: CouncilConfig
}

const RoleOverrideSchema: z<RoleOverride> = z.object({
  count: z.number().step(1).min(1).max(64),
  model: z.string(),
  provider: z.string(),
})

const QuorumOverrideSchema: z<QuorumOverride> = z.object({
  rule: z.union(['majority', 'unanimous', 'threshold'] as const),
  threshold: z.number().step(1).min(1).max(64),
})

const PresetOverrideSchema: z<PresetOverride> = z.object({
  roles: z.dict(RoleOverrideSchema).default({}),
  quorums: z.dict(QuorumOverrideSchema).default({}),
})

/**
 * User-plane schema for the `council` settings section. `topology`,
 * `maxAgentsPerLayer`, and `agentPresetId` are written by the composition as
 * the section's `base` layer and are never user fields; they exist so the
 * settings card can render the deployment's real layers and refuse an
 * over-wide overlay before the write, and so the Council tab can gate on the
 * preset id this deployment actually published.
 */
export const CouncilSettingsSchema: z<CouncilSettings> = z.object({
  defaultPreset: z.string(),
  topology: z.array(z.any()).default([]),
  maxAgentsPerLayer: z.number().step(1).min(1).max(100).default(100),
  agentPresetId: z.string().default('map-reduce'),
  costPerMillionTokens: z.number().min(0).max(10_000).default(0),
  overrides: z.dict(PresetOverrideSchema).default({}),
}) as unknown as z<CouncilSettings>

/** Schemastery configuration for the host row. */
export const Config: z<Config> = z.object({
  installPreset: z.boolean().default(true),
  presetId: z.string().default('map-reduce'),
  presetSource: z.string().default('standard'),
  presetName: z.string().default('Map-Reduce mode'),
  presetDescription: z.string().default(
    'Standard mode plus the council: one task fans out to independent members, their findings are '
    + 'deduplicated, verified by a separate panel, and reduced to a quorum report.',
  ),
  presetOrder: z.number().step(1).min(0).max(1000).default(10),
  presetPluginName: z.string().default('@starsinc1708/dsh-tool-council/tool'),
  // Validated structurally by resolveConfig below, not by schemastery: the
  // tool's schema cannot express "one trailing reduce layer", "a quorum exactly
  // on a verify layer", or unique ids. Raw passthrough keeps the published
  // preset's tool config minimal — the tool re-applies its own defaults.
  councilPolicy: z.any(),
})

/**
 * Render the rows appended to the source composition.
 *
 * The council tool injects the workflow engine, which is a SERVICE — and on the
 * agent plane a service row must sit inside a group carrying an `isolate` realm
 * or it publishes process-global and collides with every other preset. So the
 * tool ships inside its own entry-local group together with a private
 * `workflow-worker-thread` provider, exactly mirroring the delegation group the
 * standard preset already carries (whose isolated engine is invisible outside
 * that group).
 * @param pluginName - module specifier to mount.
 * @param toolConfig - YAML mapping lines for the tool row's `config`, or empty.
 * @returns the YAML list entries to append.
 */
export function composeRows(pluginName: string, toolConfig: string): string {
  const head = [
    '# The council itself, plus its private workflow engine. Present on this',
    '# plane and no other, which is what distinguishes this mode from the',
    '# preset it was derived from.',
    '- id: council',
    '  name: cordis:group',
    '  group: true',
    '  isolate:',
    '    workflowEngine: true',
    '  config:',
    '    - id: council-workflow-worker',
    "      name: '@deepseek-ai/dsh-workflow-worker-thread'",
    '      config:',
    '        provider: spawn',
    '    - id: tool-council',
    `      name: ${JSON.stringify(pluginName)}`,
  ]
  const body = toolConfig.trim()
  if (body === '') return head.join('\n')
  const indented = body.split('\n').map(line => (line.trim() === '' ? '' : `        ${line}`))
  return [...head, '      config:', ...indented].join('\n')
}

/**
 * Serialize the raw `councilPolicy` back to YAML for the published preset's
 * tool row. Omitted policy → empty (the tool's schema defaults apply).
 * @param policy - the raw user-declared policy, or undefined.
 * @returns YAML mapping lines, or an empty string.
 */
function toolConfigOf(policy: unknown): string {
  if (policy === undefined || policy === null) return ''
  if (typeof policy === 'object' && !Array.isArray(policy) && Object.keys(policy as object).length === 0) return ''
  return dump(policy, { noRefs: true, lineWidth: -1 }).trimEnd()
}

/**
 * The composition facts a user layer may not shadow, captured once.
 *
 * Captured — not recomputed — on purpose. `validate` runs LATER than `apply`
 * (inside `ctx.inject(['settings'], …)`), so anything read from the live
 * context inside it can legitimately differ from what the base layer recorded.
 * When it does, `validate` throws, `register` throws, and the inject callback's
 * rejection is swallowed: the namespace silently never registers and every
 * surface that depends on it — the settings card above all — just disappears,
 * with no error in any log. Passing the values in makes that mistake
 * unexpressible.
 */
export interface CouncilMirrors {
  /** `JSON.stringify` of the composition's topology projection. */
  readonly topologyJson: string
  readonly maxAgentsPerLayer: number
  readonly agentPresetId: string
}

/**
 * Refuse a user layer that shadows a composition mirror.
 *
 * The card reads all three: `topology` decides which roles and widths it draws,
 * `maxAgentsPerLayer` its ceiling check, `agentPresetId` the Council tab's gate.
 * Shadowing any of them would move what the card believes without moving what
 * the tool runs.
 * @param value - the resolved section (composition base under the user layer).
 * @param mirrors - the composition's own values, captured at registration.
 * @throws TypeError naming the field a user layer tried to set.
 */
export function assertMirrorsUnchanged(value: CouncilSettings, mirrors: CouncilMirrors): void {
  if (value.maxAgentsPerLayer !== undefined && value.maxAgentsPerLayer !== mirrors.maxAgentsPerLayer) {
    throw new TypeError('council: maxAgentsPerLayer mirrors the composition and cannot be set here')
  }
  if (value.agentPresetId !== undefined && value.agentPresetId !== mirrors.agentPresetId) {
    throw new TypeError('council: agentPresetId mirrors the composition and cannot be set here')
  }
  if (value.topology !== undefined && JSON.stringify(value.topology) !== mirrors.topologyJson) {
    throw new TypeError('council: topology mirrors the composition and cannot be set here')
  }
}

/**
 * Register the host row: own the `council` settings namespace and publish the
 * Map-Reduce preset.
 * @param ctx - the plugin context; the roster and settings are read optionally.
 * @param config - the loader-normalized configuration.
 */
export function apply(ctx: Context, config: Config): void {
  // Validate the policy at load, not at call: a topology that violates the
  // structural rules must break the deployment.
  const policy = resolveConfig(config.councilPolicy ?? {})
  // The mode id this council answers to. When `installPreset` is false nothing
  // is written to the roster, but the id still names the mode a hand-composed
  // deployment mounts the tool in — which is exactly what the Council tab gates
  // on, so it is mirrored either way.
  const presetId = config.presetId ?? 'map-reduce'
  const baseTopology = toTopology(policy.presets)
  const mirrors: CouncilMirrors = {
    topologyJson: JSON.stringify(baseTopology),
    maxAgentsPerLayer: policy.maxAgentsPerLayer,
    agentPresetId: presetId,
  }

  // The user plane may widen or narrow a role and re-route its model; it may
  // not change the topology. It lives in the `council` namespace, which this
  // always-composed row owns, so the card can reach it in every mode.
  installSettingsSection(ctx, settingsNamespace(COUNCIL_NAMESPACE), CouncilSettingsSchema, {
    defaultPreset: policy.defaultPreset.id,
    topology: baseTopology,
    // Read-only mirrors: the card bounds its width input against the real
    // ceiling instead of a hard-coded 16, and the Council tab gates on the id
    // this deployment actually published rather than the shipped default.
    maxAgentsPerLayer: policy.maxAgentsPerLayer,
    agentPresetId: presetId,
    overrides: {},
  }, {
    // This row OWNS the section but does not consume it — the tool row reads
    // it at call time — so the source/onChange wiring is a no-op here.
    setSource: () => {},
    onChange: () => {},
    // Refuse the write, not the next call: an overlay that pushes a layer past
    // maxAgentsPerLayer must fail in the settings UI where the user can see it.
    validate: (value) => {
      assertMirrorsUnchanged(value, mirrors)
      void resolveConfig({
        ...(config.councilPolicy ?? {}),
        presets: applyOverrides(policy.presets, value.overrides),
        defaultPreset: value.defaultPreset ?? policy.defaultPreset.id,
      })
    },
  })

  if (config.installPreset === false) return

  const options = {
    presetId,
    sourceId: config.presetSource ?? 'standard',
    name: config.presetName ?? 'Map-Reduce mode',
    description: config.presetDescription ?? '',
    order: config.presetOrder ?? 10,
    rows: composeRows(
      config.presetPluginName ?? '@starsinc1708/dsh-tool-council/tool',
      toolConfigOf(config.councilPolicy),
    ),
  }

  // Deferred past boot: the `agent-presets` roster is a service that
  // initializes after this dependency-free row, so reading it must wait for
  // the tree to finish composing. The effect owns the timer so disposal clears
  // a pending publication.
  ctx.effect(() => {
    let disposed = false
    const timer = setTimeout(async () => {
      // The roster is optional: a headless or rosterless deployment composes no
      // presets at all, and that is a valid deployment rather than an error.
      const ap = ctx.get('agentPresets') as AgentPresetsLike | undefined
      const outcome = await ensurePreset(ap, options)
      if (disposed) return
      if (outcome.kind === 'installed') {
        ctx.logger.info('dsh-tool-council: published the %s preset at %s', options.presetId, outcome.path)
      } else if (outcome.kind === 'failed') {
        ctx.logger.warn('dsh-tool-council: could not publish the %s preset — %s', options.presetId, outcome.reason)
      } else if (outcome.kind === 'skipped') {
        ctx.logger.info('dsh-tool-council: no %s preset published — %s', options.presetId, outcome.reason)
      }
    }, 0)
    return () => { disposed = true; clearTimeout(timer) }
  }, 'dsh-tool-council: preset installer lifetime')
}
