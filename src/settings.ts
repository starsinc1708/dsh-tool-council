/**
 * The `council` settings section: the deployment's read-only mirrors plus the
 * per-session council setups the Map-Reduce designer writes.
 *
 * Browser-safe: no cordis Context, no Agent, no host-only import. Everything
 * here is shared by the host (which composes a session's setup onto a real
 * preset) and the browser (which validates the same setup against the mirrors
 * before offering Save).
 *
 * @module @starsinc1708/dsh-tool-council/types
 */

import type { LayerKind, PresetConfig, QuorumRule } from './types.ts'

/** The settings namespace this package serves. */
export const COUNCIL_NAMESPACE = 'council'

/** One role, as the designer needs to draw it — prompts deliberately excluded. */
export interface TopologyRole {
  readonly id: string
  readonly label: string
  readonly count: number
  readonly model: string
  readonly provider: string
}

/** One layer, as the designer needs to draw it. */
export interface TopologyLayer {
  readonly id: string
  readonly kind: LayerKind
  readonly roles: readonly TopologyRole[]
  readonly quorumRule?: QuorumRule
  readonly quorumThreshold?: number
}

/** One preset, as the designer needs to draw it. */
export interface TopologyPreset {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly layers: readonly TopologyLayer[]
}

/**
 * One role's per-session tuning, keyed `${layerId}.${roleId}` in the setup.
 * An absent field inherits the composed preset; an empty model/provider route
 * also means inherit (the composed route survives); `count` is the ABSOLUTE
 * width of the role — the number of concurrent instances this session starts.
 */
export interface SessionRoleTune {
  count?: number
  model?: string
  provider?: string
  /**
   * Prompt override for an EXISTING role. Empty (or absent) inherits the
   * composed prompt; a non-empty value replaces it for this session — the
   * sanctioned way to slightly tune a default lens without copying the role.
   */
  prompt?: string
}

/** A per-session quorum override for the verify layer. */
export interface SessionQuorumTune {
  rule?: QuorumRule
  threshold?: number
}

/**
 * One role a session authors in the designer. Unlike a tuning (which edits an
 * existing role) an authored role carries its own prompt — the whole lens —
 * because nothing in the preset knows it.
 */
export interface SessionRoleAuthor {
  /** Unique within the whole preset; the designer generates it from the label. */
  id: string
  /** Display label; defaults to the id when absent. */
  label?: string
  /** The role's instruction, appended to the framing exactly like a preset role's. */
  prompt: string
  /** Independent instances of this role; defaults to 1. */
  count?: number
  /** Route the members run on, when the designer picked one. */
  model?: string
  provider?: string
}

/**
 * One layer of a session's authored topology — a map layer added below a
 * preset's own map layers, or a node of a fully custom (from-scratch) preset.
 * Each carries its own roles; a whole added layer runs as another examining
 * pass before the verify layer.
 */
export interface SessionLayerAuthor {
  /** Unique within the preset; the designer generates it from the label. */
  id: string
  /** Display label; defaults to the id when absent. */
  label?: string
  /** Layer kind. Omitted = `map` (authored layers added under a preset). */
  kind?: LayerKind
  /** Roles on this layer. */
  roles: SessionRoleAuthor[]
  /** Verify-layer quorum; only meaningful when `kind` is `verify`. */
  quorum?: SessionQuorumTune
}

/** A reusable, user-authored role kept in the role library. */
export interface RoleTemplate extends SessionRoleAuthor {
  id: string
}

/** A reusable, user-authored topology kept in the preset library. */
export interface PresetTemplate {
  /** Unique library key. */
  id: string
  /** Display label, shown in the preset menu. */
  label: string
  layers: SessionLayerAuthor[]
}

/**
 * Everything the composer-dock designer lets one session say about its
 * council, keyed by the session's id in `CouncilSettings.sessionCouncil`.
 *
 * A setup FIXES the session's council: every run in the session executes the
 * named preset composed with these edits, and the model's per-request preset
 * choice is ignored while a setup exists. Absent setup = the model picks a
 * preset per request, exactly as before.
 */
export interface SessionCouncilSetup {
  /**
   * Preset id from the deployment's mirrored topology that this session runs.
   * ABSENT (or empty) with a `topology` body means a fully custom, built-from-
   * scratch council. A preset id and a custom body never mix: the custom body
   * wins.
   */
  presetId?: string
  /** Display name for a custom council (mirrors a preset's label). */
  name?: string
  /** `false` drops the verify layer (map → reduce only). Default true. */
  verifyEnabled?: boolean
  /** Per-role tuning of EXISTING roles, keyed `${layerId}.${roleId}`. */
  roles?: Record<string, SessionRoleTune>
  /** Verify-layer quorum override; ignored while `verifyEnabled` is false. */
  quorum?: SessionQuorumTune
  /**
   * Authored roles appended to existing layers, keyed by that layer's id
   * (map and verify layers only). Each carries its own prompt.
   */
  addRoles?: Record<string, SessionRoleAuthor[]>
  /** Authored map layers appended after the preset's own map layers. */
  addLayers?: SessionLayerAuthor[]
  /**
   * The WHOLE topology of a custom council built from scratch: every layer,
   * kinds included, roles with their own prompts. Presence of this body (with
   * no `presetId`) is what makes the session's council custom.
   */
  topology?: SessionLayerAuthor[]
}

/** The council settings document. */
export interface CouncilSettings {
  /** Read-only composition mirror; the designer renders it and never writes it. */
  topology?: TopologyPreset[]
  /**
   * Read-only mirror of the deployment's `maxAgentsPerLayer`. The designer
   * bounds every width input against it; it is written by the composition as
   * part of the section's `base` layer.
   */
  maxAgentsPerLayer?: number
  /**
   * Read-only mirror of the deployment's `maxLayers` — how many layers one
   * preset may compose. The designer disables "add layer" once a session's
   * authored preset would exceed it, matching the host's own refusal.
   */
  maxLayers?: number
  /**
   * Read-only mirror of the agent-preset id this council was published under.
   * The Council conversation tab gates on it, so a deployment that renamed the
   * published preset still gets its graph instead of an empty state.
   */
  agentPresetId?: string
  /**
   * Read-only mirror of the deployment's default preset id — the preset a
   * session runs when neither the model nor a session setup names one. The
   * designer uses it to pre-select the preset a fresh session would otherwise
   * get.
   */
  defaultPreset?: string
  /**
   * Blended $ per 1M tokens for the Council tab's optional cost estimate; `0`
   * (the default) shows no money at all. No editor remains for this field —
   * the Map-Reduce designer owns the council now — but the viewer arithmetic
   * stays available to a deployment that writes it by hand.
   */
  costPerMillionTokens?: number
  /** Per-session council setups, keyed by the parent session's id. */
  sessionCouncil?: Record<string, SessionCouncilSetup>
  /** The user's reusable role library, keyed by role id. */
  roleLibrary?: Record<string, RoleTemplate>
  /** The user's reusable custom-preset library, keyed by preset id. */
  presetLibrary?: Record<string, PresetTemplate>
}

/** Ceiling on one role's width in a session setup (mirrors the schema). */
export const MAX_ROLE_WIDTH = 64

/**
 * Project the composition's presets into the browser-facing mirror.
 * @param presets - the deployment's resolved presets.
 * @returns the same topology with prompts and framing dropped.
 */
export function toTopology(presets: readonly PresetConfig[]): TopologyPreset[] {
  return presets.map(preset => ({
    id: preset.id,
    label: preset.label ?? preset.id,
    description: preset.description,
    layers: preset.layers.map(layer => ({
      id: layer.id,
      kind: layer.kind,
      roles: layer.roles.map(role => ({
        id: role.id,
        label: role.label ?? role.id,
        count: role.count ?? 1,
        model: role.model ?? '',
        provider: role.provider ?? '',
      })),
      ...layer.quorum === undefined ? {} : {
        quorumRule: layer.quorum.rule,
        ...layer.quorum.threshold === undefined ? {} : { quorumThreshold: layer.quorum.threshold },
      },
    })),
  }))
}

/**
 * The stored setup of one session, or undefined when it chose none.
 * @param section - the resolved council settings section, or undefined.
 * @param sessionId - the parent session the run belongs to.
 * @returns the setup, or undefined.
 */
export function sessionSetupOf(
  section: CouncilSettings | undefined,
  sessionId: string,
): SessionCouncilSetup | undefined {
  return section?.sessionCouncil?.[sessionId]
}

/**
 * One role's tuned count under a setup.
 *
 * The count is ABSOLUTE — the role's width for the session. A value outside
 * `1..MAX_ROLE_WIDTH` is treated as absent (the composed width stands) because
 * the document is user-plane JSON that survived arbitrary edits; anything else
 * would start a layer with a nonsense number of members.
 * @param composed - the role's composed width, or undefined for the default 1.
 * @param tune - the session's tuning of this role, or undefined.
 * @returns the count to run.
 */
export function tunedCount(composed: number | undefined, tune: SessionRoleTune | undefined): number {
  const count = tune?.count
  return typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= MAX_ROLE_WIDTH
    ? count
    : (composed ?? 1)
}

/**
 * Whether a session setup drops a layer (only the verify layer can be dropped).
 * @param kind - the layer kind.
 * @param setup - the session setup, or undefined.
 * @returns true when the layer should not run.
 */
export function layerDropped(kind: LayerKind, setup: SessionCouncilSetup | undefined): boolean {
  return kind === 'verify' && setup?.verifyEnabled === false
}

/**
 * Compose a session setup onto a real preset.
 *
 * A setup may tune existing roles (widths, routes), append AUTHORED roles to
 * map and verify layers (each carrying its own prompt), insert AUTHORED map
 * layers after the preset's own map layers, drop the verify layer, and restate
 * its quorum. It may not touch the reduce layer or reorder anything the
 * preset composed. Unknown role keys are ignored (a stored setup survives a
 * composition that removed a role). Over-wide layers and unreachable
 * thresholds are refused HERE, before a single child is paid for; the full
 * structural rules (unique ids, non-empty prompts, layer ordering) are
 * re-verified by the caller through `resolveConfig` on the host.
 * @param preset - the composed preset, with its prompts intact.
 * @param setup - the session's setup, or undefined (returns the preset).
 * @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
 * @returns the preset to run.
 * @throws RangeError naming the offending layer on an over-wide layer or an
 * unreachable threshold.
 */
export function applySessionSetup(
  preset: PresetConfig,
  setup: SessionCouncilSetup | undefined,
  maxAgentsPerLayer: number,
): PresetConfig {
  if (setup === undefined) return preset
  const tunings = setup.roles ?? {}

  /** One preset role with its session tuning applied. */
  const tuneRole = (layerId: string) => (role: PresetConfig['layers'][number]['roles'][number]) => {
    const tune = tunings[`${layerId}.${role.id}`]
    if (tune === undefined) return role
    return {
      ...role,
      ...tune.count === undefined ? {} : { count: tune.count },
      ...tune.model === undefined || tune.model === '' ? {} : { model: tune.model },
      ...tune.provider === undefined || tune.provider === '' ? {} : { provider: tune.provider },
      ...tune.prompt === undefined || tune.prompt.trim() === '' ? {} : { prompt: tune.prompt },
    }
  }

  /** One authored role, normalized into the preset's role shape. */
  const authorRole = (role: SessionRoleAuthor) => ({
    id: role.id,
    label: role.label ?? role.id,
    prompt: role.prompt,
    ...role.count === undefined ? {} : { count: role.count },
    ...role.model === undefined || role.model === '' ? {} : { model: role.model },
    ...role.provider === undefined || role.provider === '' ? {} : { provider: role.provider },
  })

  const authorOf = (layerId: string): SessionRoleAuthor[] => setup.addRoles?.[layerId] ?? []

  // 1. Existing layers: tuned; map and verify additionally receive authored
  //    roles. The reduce layer keeps its single instance but MAY be re-routed:
  //    pointing the synthesizer at a stronger model is the sanctioned way to
  //    strengthen it.
  const kept = preset.layers
    .filter(layer => !layerDropped(layer.kind, setup))
    .map((layer) => {
      if (layer.kind === 'reduce') {
        for (const role of layer.roles) {
          const tune = tunings[`${layer.id}.${role.id}`]
          if (tune?.count !== undefined && tune.count !== 1) {
            throw new RangeError(
              `council: the reduce role "${role.id}" always runs exactly one instance; `
              + `this session requested ${tune.count}`,
            )
          }
        }
        return { ...layer, roles: layer.roles.map(tuneRole(layer.id)) }
      }
      const tuned = layer.roles.map(tuneRole(layer.id))
      const authored = (layer.kind === 'map' || layer.kind === 'verify')
        ? authorOf(layer.id).map(authorRole)
        : []
      return authored.length === 0 ? { ...layer, roles: tuned } : { ...layer, roles: [...tuned, ...authored] }
    })

  // 2. Authored map layers: appended after the preset's own map layers (and
  //    before whatever follows them), so an added pass never lands after the
  //    verify layer.
  const extras = (setup.addLayers ?? []).map(layer => ({
    id: layer.id,
    kind: 'map' as const,
    label: layer.label ?? layer.id,
    roles: [...(layer.roles ?? []), ...authorOf(layer.id)].map(authorRole),
  }))
  if (extras.length > 0) {
    const firstNonMap = kept.findIndex(layer => layer.kind !== 'map')
    kept.splice(firstNonMap === -1 ? kept.length : firstNonMap, 0, ...extras)
  }

  // 3. Widths (authored roles and layers included) and the verify quorum.
  for (const layer of kept) {
    const width = layer.roles.reduce((sum, role) => sum + (role.count ?? 1), 0)
    if (width > maxAgentsPerLayer) {
      throw new RangeError(
        `council: this session's setup starts ${width} members on layer "${layer.id}" of preset `
        + `"${preset.id}"; this deployment allows at most ${maxAgentsPerLayer} per layer. `
        + 'Narrow a role in the council designer.',
      )
    }
    if (layer.kind !== 'verify') continue
    if (setup.quorum === undefined || Object.keys(setup.quorum).length === 0) continue
    const rule = setup.quorum.rule ?? 'majority'
    if (rule === 'threshold') {
      const threshold = setup.quorum.threshold ?? width
      if (!Number.isInteger(threshold) || threshold < 1 || threshold > width) {
        throw new RangeError(
          `council: preset "${preset.id}" verify layer needs a threshold between 1 and its `
          + `width ${width}; this session set ${String(threshold)}`,
        )
      }
      layer.quorum = { rule, threshold }
    } else {
      layer.quorum = { rule }
    }
  }
  return { ...preset, layers: kept }
}

/**
 * Compose a fully custom (from-scratch) topology into a runnable preset.
 *
 * The session authored every layer itself — kinds, roles and prompts included
 * — so there is no mirrored preset to compose onto. Structural rules (a single
 * trailing reduce, at most one verify, unique ids, non-empty prompts) are
 * enforced by the caller through `resolveConfig`; over-wide layers and
 * unreachable thresholds are refused here, before a single child is paid for.
 * @param layers - the authored topology, in composition order.
 * @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
 * @param name - display label for the run.
 * @returns the preset to run.
 * @throws RangeError naming the offending layer on an over-wide layer.
 */
export function applyCustomSetup(
  layers: readonly SessionLayerAuthor[],
  maxAgentsPerLayer: number,
  name: string,
): PresetConfig {
  const hasVerify = layers.some(layer => layer.kind === 'verify')
  const presetLayers = layers.map((layer) => {
    const kind = layer.kind ?? 'map'
    const roles = layer.roles.map((role) => ({
      id: role.id,
      label: role.label ?? role.id,
      prompt: role.prompt,
      ...role.count === undefined ? {} : { count: role.count },
      ...role.model === undefined || role.model === '' ? {} : { model: role.model },
      ...role.provider === undefined || role.provider === '' ? {} : { provider: role.provider },
    }))
    const width = roles.reduce((sum, role) => sum + (role.count ?? 1), 0)
    if (width > maxAgentsPerLayer) {
      throw new RangeError(
        `council: this custom session starts ${width} members on layer "${layer.id}"; this deployment `
        + `allows at most ${maxAgentsPerLayer} per layer. Narrow a role in the council designer.`,
      )
    }
    if (kind === 'verify') {
      const quorum = layer.quorum ?? {}
      const rule = quorum.rule ?? 'majority'
      if (rule === 'threshold') {
        const threshold = quorum.threshold ?? width
        if (!Number.isInteger(threshold) || threshold < 1 || threshold > width) {
          throw new RangeError(
            `council: custom verify layer "${layer.id}" needs a threshold between 1 and its width `
            + `${width}; this session set ${String(threshold)}`,
          )
        }
        return { id: layer.id, kind, label: layer.label ?? layer.id, roles, quorum: { rule, threshold } }
      }
      return { id: layer.id, kind, label: layer.label ?? layer.id, roles, quorum: { rule } }
    }
    return { id: layer.id, kind, label: layer.label ?? layer.id, roles }
  })
  return {
    id: 'custom',
    label: name === '' ? 'Custom' : name,
    description: 'A custom council built from scratch in the session designer.',
    framing: 'A council of independent agents is working the task below. You are one member: you share '
      + 'the workspace but no conversation. Read the workspace, run what you can, and report only what '
      + 'you verified yourself.',
    reduceMode: hasVerify ? 'vote' : 'synthesis',
    layers: presetLayers,
  }
}

/** One planned layer: id, kind, and the width a setup would give it. */
interface WidthLayer {
  readonly id: string
  readonly kind: LayerKind
  readonly width: number
}

/**
 * The widths of every layer one mirrored preset composes under a setup —
 * tuned existing roles, authored roles, authored map layers, verification
 * dropped when off, and the reduce layer at its single instance. Shared by the
 * width/quorum validators and the Council tab's "of N declared" readout, so
 * what the designer blocks, what the tool runs and what the tab says can
 * never disagree.
 * @param preset - the mirrored preset.
 * @param setup - the session setup, or undefined for the composed widths.
 * @returns layer id -> width, in composition order.
 */
export function sessionLayerWidthPlan(
  preset: TopologyPreset,
  setup: SessionCouncilSetup | undefined,
): readonly WidthLayer[] {
  const plan: WidthLayer[] = preset.layers
    .filter(layer => !layerDropped(layer.kind, setup))
    .map(layer => ({
      id: layer.id,
      kind: layer.kind,
      width: layer.roles.reduce(
        (sum, role) => sum + tunedCount(role.count, setup?.roles?.[`${layer.id}.${role.id}`]),
        0,
      ) + (layer.kind === 'reduce' ? 0 : (setup?.addRoles?.[layer.id] ?? []).reduce(
        (sum, role) => sum + (role.count ?? 1),
        0,
      )),
    }))
  const extras: WidthLayer[] = (setup?.addLayers ?? []).map(layer => ({
    id: layer.id,
    kind: 'map',
    width: (layer.roles ?? []).reduce((sum, role) => sum + (role.count ?? 1), 0)
      + (setup?.addRoles?.[layer.id] ?? []).reduce((sum, role) => sum + (role.count ?? 1), 0),
  }))
  if (extras.length > 0) {
    const firstNonMap = plan.findIndex(layer => layer.kind !== 'map')
    plan.splice(firstNonMap === -1 ? plan.length : firstNonMap, 0, ...extras)
  }
  return plan
}

/**
 * Every planned layer whose width a session setup would push past the ceiling
 * — the designer-side twin of `applySessionSetup`'s refusal, computed over the
 * mirrored topology so the panel can disable Save before the Host would refuse
 * the run.
 * @param preset - the mirrored preset.
 * @param setup - the staged session setup, or undefined.
 * @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
 * @returns one entry per offending layer, in composition order.
 */
export function sessionWidthViolations(
  preset: TopologyPreset,
  setup: SessionCouncilSetup | undefined,
  maxAgentsPerLayer: number,
): ReadonlyArray<{ readonly layerId: string; readonly width: number; readonly max: number }> {
  if (maxAgentsPerLayer <= 0) return []
  const out: Array<{ layerId: string; width: number; max: number }> = []
  for (const layer of sessionLayerWidthPlan(preset, setup)) {
    if (layer.width > maxAgentsPerLayer) {
      out.push({ layerId: layer.id, width: layer.width, max: maxAgentsPerLayer })
    }
  }
  return out
}

/**
 * The declared width of every layer one mirrored preset composes under a
 * session setup — what the Council tab's "of N declared" readouts should show.
 * @param preset - the mirrored preset.
 * @param setup - the session setup, or undefined for the composed widths.
 * @returns layer id -> declared width, in composition order.
 */
export function sessionLayerWidths(
  preset: TopologyPreset,
  setup: SessionCouncilSetup | undefined,
): ReadonlyMap<string, number> {
  return new Map(sessionLayerWidthPlan(preset, setup).map(layer => [layer.id, layer.width]))
}

/**
 * Whether a session's staged quorum for a verify layer is unreachable by its
 * own width — the designer-side twin of `applySessionSetup`'s threshold check.
 * @param preset - the mirrored preset.
 * @param setup - the staged session setup, or undefined.
 * @returns the violation, or undefined when the quorum is fine or absent.
 */
export function sessionQuorumViolation(
  preset: TopologyPreset,
  setup: SessionCouncilSetup | undefined,
): { readonly rule: QuorumRule; readonly threshold: number; readonly width: number } | undefined {
  if (setup?.quorum === undefined || setup.quorum.rule !== 'threshold') return undefined
  const plan = sessionLayerWidthPlan(preset, setup)
  const verify = plan.find(layer => layer.kind === 'verify')
  if (verify === undefined) return undefined
  const composedThreshold = preset.layers.find(layer => layer.kind === 'verify')?.quorumThreshold
  const threshold = setup.quorum.threshold ?? composedThreshold
  if (threshold === undefined || !Number.isInteger(threshold) || threshold < 1 || threshold > verify.width) {
    return { rule: 'threshold', threshold: threshold ?? 0, width: verify.width }
  }
  return undefined
}

/**
 * How many layers a setup's preset would compose — the designer's "add layer"
 * gate against the mirrored `maxLayers`.
 * @param preset - the mirrored preset.
 * @param setup - the staged session setup, or undefined.
 * @returns the composed layer count.
 */
export function sessionLayerCount(
  preset: TopologyPreset,
  setup: SessionCouncilSetup | undefined,
): number {
  return sessionLayerWidthPlan(preset, setup).length
}

/** One width violation of a custom topology. */
export interface CustomWidthViolation {
  readonly layerId: string
  readonly width: number
  readonly max: number
}

/**
 * Every layer of a custom topology whose width exceeds the ceiling — the
 * designer-side twin of `applyCustomSetup`'s refusal.
 * @param layers - the authored topology.
 * @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
 * @returns one entry per offending layer, in composition order.
 */
export function customWidthViolations(
  layers: readonly SessionLayerAuthor[],
  maxAgentsPerLayer: number,
): readonly CustomWidthViolation[] {
  if (maxAgentsPerLayer <= 0) return []
  const out: CustomWidthViolation[] = []
  for (const layer of layers) {
    const width = layer.roles.reduce((sum, role) => sum + (role.count ?? 1), 0)
    if (width > maxAgentsPerLayer) out.push({ layerId: layer.id, width, max: maxAgentsPerLayer })
  }
  return out
}

/**
 * Whether a custom verify layer's threshold is unreachable by its own width.
 * @param layers - the authored topology.
 * @returns the violation, or undefined when fine or no threshold quorum.
 */
export function customQuorumViolation(
  layers: readonly SessionLayerAuthor[],
): { readonly threshold: number; readonly width: number } | undefined {
  const verify = layers.find(layer => layer.kind === 'verify')
  if (verify === undefined || verify.quorum?.rule !== 'threshold') return undefined
  const width = verify.roles.reduce((sum, role) => sum + (role.count ?? 1), 0)
  const threshold = verify.quorum.threshold ?? width
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > width) {
    return { threshold, width }
  }
  return undefined
}

/**
 * The structural error of a custom topology the designer must surface before
 * the host's `resolveConfig` would refuse the run, or undefined when the
 * skeleton is sound (prompts/ids still checked host-side). Returns a stable
 * machine code the UI translates.
 * @param layers - the authored topology.
 * @returns a short code, or undefined.
 */
export function customStructuralError(
  layers: readonly SessionLayerAuthor[],
): string | undefined {
  if (layers.length === 0) return 'no-layers'
  const last = layers[layers.length - 1]
  if (last === undefined || last.kind !== 'reduce') return 'missing-reduce'
  if (last.roles.length !== 1) return 'reduce-role'
  const verifies = layers.filter(layer => layer.kind === 'verify').length
  if (verifies > 1) return 'too-many-verify'
  const reduceAt = layers.findIndex(layer => layer.kind === 'reduce')
  if (reduceAt !== layers.length - 1) return 'reduce-not-last'
  const verifyAt = layers.findIndex(layer => layer.kind === 'verify')
  if (verifyAt >= 0 && layers.slice(verifyAt + 1).some(layer => layer.kind === 'map')) {
    return 'map-after-verify'
  }
  if (layers.some(layer => layer.roles.length === 0)) return 'empty-layer'
  return undefined
}
