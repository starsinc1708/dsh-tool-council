/**
 * Staged-form controller for the council settings card.
 *
 * `ui-settings-plugins` ships a generic `CardForm` and field chrome, but the
 * client bundle-purity gate forbids importing values across plugins, so this
 * is a purpose-built copy — and a smaller one: the council's writable surface
 * is a preset selection plus a sparse override map, not a flat field list, so
 * the generic staged form would not have fit anyway.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  CouncilSettings, PresetOverride, QuorumRule, RoleOverride, TopologyPreset,
} from '@starsinc1708/dsh-tool-council/types'

/** A verify layer whose staged threshold cannot be satisfied by its own width. */
export interface QuorumViolation {
  readonly presetId: string
  readonly layerId: string
  readonly threshold: number
  readonly width: number
}

/** A layer whose staged width exceeds the deployment's ceiling. */
export interface WidthViolation {
  /** The preset the layer belongs to — layer ids repeat across presets. */
  readonly presetId: string
  readonly layerId: string
  readonly width: number
  readonly max: number
}

/**
 * How much of the composition the staged overlay is currently changing.
 *
 * Computed here rather than in the card for two reasons: it is the number the
 * tab badges and the summary line both read, and a count that disagrees with
 * itself between the two is exactly how a role ends up badged `overridden` at
 * its default value with nobody able to find it.
 */
export interface OverrideCounts {
  /** Overrides per preset id. A preset with none is ABSENT, never zero. */
  readonly byPreset: Readonly<Record<string, number>>
  /** Role plus quorum overrides across every preset. */
  readonly total: number
  /** How many presets carry at least one. */
  readonly presets: number
}

/**
 * Count the role and quorum overrides in an overlay.
 *
 * Roles and quorums are counted together because they are the same thing to the
 * reader: a difference from what this deployment composed. An entry that
 * survived with empty maps counts as nothing and is left out of `byPreset`, so
 * `presets` never counts a preset whose badge would read `·0`.
 * @param overrides - the staged (or saved) overlay.
 * @returns the per-preset counts and the two totals.
 */
export function countOverrides(overrides: Record<string, PresetOverride>): OverrideCounts {
  const byPreset: Record<string, number> = {}
  let total = 0
  for (const [presetId, override] of Object.entries(overrides)) {
    const count = Object.keys(override.roles ?? {}).length + Object.keys(override.quorums ?? {}).length
    if (count === 0) continue
    byPreset[presetId] = count
    total += count
  }
  return { byPreset, total, presets: Object.keys(byPreset).length }
}

/** What the card renders. */
export interface CouncilCardState {
  readonly status: 'loading' | 'ready' | 'unavailable'
  readonly writable: boolean
  /** The deployment's topology, as the Host mirrored it into the section. */
  readonly presets: readonly TopologyPreset[]
  /** Which preset the card is currently showing. */
  readonly selected: string
  /** Preset the tool uses when the model names none. */
  readonly defaultPreset: string
  /** Staged overrides, merged over what the Host last accepted. */
  readonly overrides: Record<string, PresetOverride>
  /**
   * How many overrides the overlay carries, per preset and in total.
   *
   * The tab badges and the summary line both read this, so a preset whose
   * overrides are on a tab nobody opened is still visible from the outside —
   * which is what stops an override being lost behind three closed tabs.
   */
  readonly overrideCounts: OverrideCounts
  /** The deployment's per-layer width ceiling, mirrored by the Host. */
  readonly maxAgentsPerLayer: number
  /** Blended $ per 1M tokens for the Council tab's estimate; 0 means off. */
  readonly costPerMillionTokens: number
  /** Agents one run of the shown preset would start, with the staging applied. */
  readonly totalAgents: number
  /**
   * Layers the staged overlay would push past the ceiling, across EVERY preset:
   * the overrides map is written as one field, so a violation the user cannot
   * currently see would still be rejected by the Host. The card refuses it
   * first, naming the preset as well as the layer.
   */
  readonly widthViolations: readonly WidthViolation[]
  /**
   * Verify layers whose staged `threshold` is outside `1..width`. The Host
   * refuses these too, and its refusal is a raw English TypeError — so the card
   * has to catch them itself, with the same bounds the Host uses.
   */
  readonly quorumViolations: readonly QuorumViolation[]
  /** Whether anything is staged but unsaved. */
  readonly dirty: boolean
  /** The last write's rejection, cleared on the next edit. */
  readonly error: string
}

const EMPTY: CouncilCardState = {
  status: 'loading',
  writable: false,
  presets: [],
  selected: '',
  defaultPreset: '',
  overrides: {},
  overrideCounts: { byPreset: {}, total: 0, presets: 0 },
  maxAgentsPerLayer: 0,
  costPerMillionTokens: 0,
  totalAgents: 0,
  widthViolations: [],
  quorumViolations: [],
  dirty: false,
  error: '',
}

/** Minimal observable the renderer binds into a `use…` hook. */
export interface Store<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/**
 * Drop the keys an override no longer carries.
 *
 * An empty string means "inherit", not "override with nothing": leaving the
 * key behind would keep the role marked `overridden` for ever and would send
 * the Host a field it has to ignore.
 * @param override - the patched role override.
 * @returns the same override without empty routes, or undefined when nothing is left.
 */
function pruneRole(override: RoleOverride): RoleOverride | undefined {
  const next: RoleOverride = {}
  if (override.count !== undefined) next.count = override.count
  if (override.model !== undefined && override.model !== '') next.model = override.model
  if (override.provider !== undefined && override.provider !== '') next.provider = override.provider
  return Object.keys(next).length === 0 ? undefined : next
}

/** Drop a preset entry whose role and quorum maps are both empty. */
function prunePreset(override: PresetOverride): PresetOverride | undefined {
  const roles = override.roles ?? {}
  const quorums = override.quorums ?? {}
  if (Object.keys(roles).length === 0 && Object.keys(quorums).length === 0) return undefined
  return { roles, quorums }
}

/**
 * Recognize an overrides document pasted into the card.
 * @param value - parsed JSON of unknown shape.
 * @returns the document, or undefined when it is not one.
 */
export function readOverridesDocument(value: unknown): Record<string, PresetOverride> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const out: Record<string, PresetOverride> = {}
  for (const [presetId, raw] of Object.entries(value)) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
    const entry = raw as { roles?: unknown; quorums?: unknown }
    const roles: Record<string, RoleOverride> = {}
    const quorums: Record<string, { rule?: QuorumRule; threshold?: number }> = {}
    if (entry.roles !== undefined) {
      if (typeof entry.roles !== 'object' || entry.roles === null || Array.isArray(entry.roles)) return undefined
      for (const [key, role] of Object.entries(entry.roles as Record<string, unknown>)) {
        if (typeof role !== 'object' || role === null || Array.isArray(role)) return undefined
        const { count, model, provider } = role as RoleOverride
        if (count !== undefined && (!Number.isSafeInteger(count) || count < 1)) return undefined
        if (model !== undefined && typeof model !== 'string') return undefined
        if (provider !== undefined && typeof provider !== 'string') return undefined
        const pruned = pruneRole({ count, model, provider })
        if (pruned !== undefined) roles[key] = pruned
      }
    }
    if (entry.quorums !== undefined) {
      if (typeof entry.quorums !== 'object' || entry.quorums === null || Array.isArray(entry.quorums)) return undefined
      for (const [key, quorum] of Object.entries(entry.quorums as Record<string, unknown>)) {
        if (typeof quorum !== 'object' || quorum === null || Array.isArray(quorum)) return undefined
        const { rule, threshold } = quorum as { rule?: QuorumRule; threshold?: number }
        if (rule !== undefined && !['majority', 'unanimous', 'threshold'].includes(rule)) return undefined
        if (threshold !== undefined && (!Number.isSafeInteger(threshold) || threshold < 1)) return undefined
        // An entry carrying neither field is not an override, exactly as
        // `pruneRole` treats a role whose routes were all cleared. Storing it
        // would badge the preset `·1` and show the composed rule in the select:
        // an override the reader cannot find, which is the phantom the tab
        // badges exist to prevent.
        if (rule === undefined && threshold === undefined) continue
        quorums[key] = { ...rule === undefined ? {} : { rule }, ...threshold === undefined ? {} : { threshold } }
      }
    }
    const pruned = prunePreset({ roles, quorums })
    if (pruned !== undefined) out[presetId] = pruned
  }
  return out
}

/**
 * Every layer of every preset whose overlaid width exceeds the ceiling.
 * @param presets - the mirrored topology.
 * @param overrides - the staged overlay.
 * @param max - the deployment's `maxAgentsPerLayer`.
 * @returns one entry per offending layer, in composition order.
 */
export function widthViolations(
  presets: readonly TopologyPreset[],
  overrides: Record<string, PresetOverride>,
  max: number,
): WidthViolation[] {
  if (max <= 0) return []
  const out: WidthViolation[] = []
  for (const preset of presets) {
    const override = overrides[preset.id]
    for (const layer of preset.layers) {
      const width = layer.roles.reduce(
        (sum, role) => sum + (override?.roles?.[`${layer.id}.${role.id}`]?.count ?? role.count),
        0,
      )
      if (width > max) out.push({ presetId: preset.id, layerId: layer.id, width, max })
    }
  }
  return out
}

/**
 * Every verify layer whose overlaid threshold its own width cannot satisfy.
 *
 * The bounds match `resolveConfig`'s: a `threshold` quorum needs a whole number
 * between 1 and the layer's width, counting the staged width overrides.
 * @param presets - the mirrored topology.
 * @param overrides - the staged overlay.
 * @returns one entry per offending verify layer, in composition order.
 */
export function quorumViolations(
  presets: readonly TopologyPreset[],
  overrides: Record<string, PresetOverride>,
): QuorumViolation[] {
  const out: QuorumViolation[] = []
  for (const preset of presets) {
    const override = overrides[preset.id]
    for (const layer of preset.layers) {
      if (layer.quorumRule === undefined) continue
      const staged = override?.quorums?.[layer.id]
      const rule = staged?.rule ?? layer.quorumRule
      if (rule !== 'threshold') continue
      const width = layer.roles.reduce(
        (sum, role) => sum + (override?.roles?.[`${layer.id}.${role.id}`]?.count ?? role.count),
        0,
      )
      // An absent threshold is legal: `expandLayers` leaves it undefined and
      // both quorum copies default it to the live ballot count.
      const threshold = staged?.threshold ?? layer.quorumThreshold
      if (threshold === undefined) continue
      if (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > width) {
        out.push({ presetId: preset.id, layerId: layer.id, threshold, width })
      }
    }
  }
  return out
}

/**
 * Bridge the `council` settings namespace onto the card.
 *
 * Edits stage locally and land in one `set('overrides', …)` write, because the
 * overrides map is a single scalar field from the settings document's point of
 * view: writing it per-role would let a rejected write leave the map half
 * applied.
 */
export class CouncilCardController {
  private listeners = new Set<() => void>()
  private snapshot: CouncilCardState = EMPTY
  private staged: Record<string, PresetOverride> | undefined
  private stagedDefault: string | undefined
  private stagedCost: number | undefined
  private selected = ''
  private error = ''

  private detachUnloadGuard: (() => void) | undefined
  /**
   * Release for the settings-scope subscription.
   *
   * Held, not discarded: a controller that keeps publishing after `dispose()`
   * is not merely wasteful. `syncUnloadGuard` would see it dirty with no guard
   * attached and attach a FRESH `beforeunload` handler whose detach closure
   * nothing can ever call again — one hot reload with staged edits and the
   * browser asks "leave site?" for the rest of the session.
   */
  private detachScope: (() => void) | undefined

  constructor(
    private readonly scope: SettingsScope<CouncilSettings>,
    /**
     * How to phrase a half-applied save. Injected so the controller stays free
     * of the locale service, which is a different plugin's value.
     */
    private readonly partialSaveMessage: (error: string) => string = error => error,
  ) {
    this.detachScope = scope.subscribe(() => { this.publish() })
    this.publish()
  }

  /**
   * Detach from the scope and drop the unload guard. Owned by the client
   * plugin's effect, which calls it on dispose and on hot reload.
   */
  dispose(): void {
    this.detachScope?.()
    this.detachScope = undefined
    this.detachUnloadGuard?.()
    this.detachUnloadGuard = undefined
    this.listeners.clear()
  }

  /**
   * Keep a `beforeunload` guard attached exactly while edits are staged.
   *
   * The browser shows only its own generic dialog and an in-app route change
   * never reaches this event — so the badge in the card, not this, is the
   * primary signal. This catches the one case the badge cannot: closing the tab.
   * @param dirty - whether anything is staged but unsaved.
   */
  private syncUnloadGuard(dirty: boolean): void {
    if (typeof window === 'undefined') return
    if (dirty === (this.detachUnloadGuard !== undefined)) return
    if (!dirty) {
      this.detachUnloadGuard?.()
      this.detachUnloadGuard = undefined
      return
    }
    const handler = (event: BeforeUnloadEvent): void => { event.preventDefault() }
    window.addEventListener('beforeunload', handler)
    this.detachUnloadGuard = () => { window.removeEventListener('beforeunload', handler) }
  }

  /** @returns the observable the renderer binds as `useCouncilCard`. */
  store(): Store<CouncilCardState> {
    return {
      getSnapshot: () => this.snapshot,
      subscribe: (listener) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
    }
  }

  /** @returns the actions the slot injects alongside the store. */
  actions() {
    return {
      selectPreset: (presetId: string) => { this.selected = presetId; this.publish() },
      setDefaultPreset: (presetId: string) => {
        this.stagedDefault = presetId
        this.error = ''
        this.publish()
      },
      /** Stage the viewer's blended token rate; `0` turns the estimate off. */
      setCostRate: (rate: number) => {
        this.stagedCost = Number.isFinite(rate) && rate >= 0 ? rate : 0
        this.error = ''
        this.publish()
      },
      setRoleCount: (layerId: string, roleId: string, count: number) => {
        this.editRole(layerId, roleId, { count })
      },
      setRoleModel: (layerId: string, roleId: string, model: string) => {
        this.editRole(layerId, roleId, { model })
      },
      setRoleProvider: (layerId: string, roleId: string, provider: string) => {
        this.editRole(layerId, roleId, { provider })
      },
      /** Drop every override for one role and re-inherit the composition. */
      revertRole: (layerId: string, roleId: string) => {
        const preset = this.currentPresetId()
        const next = this.draft()
        const entry = next[preset]
        if (entry?.roles === undefined) return
        const roles = { ...entry.roles }
        delete roles[`${layerId}.${roleId}`]
        this.commit(next, preset, { ...entry, roles })
      },
      setQuorum: (layerId: string, rule: QuorumRule, threshold?: number) => {
        const preset = this.currentPresetId()
        const next = this.draft()
        const entry = next[preset] ?? {}
        this.commit(next, preset, {
          ...entry,
          quorums: {
            ...entry.quorums,
            [layerId]: { rule, ...threshold === undefined ? {} : { threshold } },
          },
        })
      },
      discard: () => {
        this.staged = undefined
        this.stagedDefault = undefined
        this.stagedCost = undefined
        this.error = ''
        this.publish()
      },
      save: () => { void this.save() },
      /** Drop every override for the shown preset and re-inherit the composition. */
      resetPreset: () => {
        const next = this.draft()
        // Staging unconditionally would mark the card dirty, enable Save, and
        // arm the unload guard for a write of the identical document — the
        // preset had nothing to reset. `revertRole` returns early for the same
        // reason and `resetAll`'s button is disabled at zero.
        if (next[this.currentPresetId()] === undefined) return
        delete next[this.currentPresetId()]
        this.staged = next
        this.error = ''
        this.publish()
      },
      /**
       * Drop the WHOLE overlay, every preset at once.
       *
       * Staged like every other edit rather than written straight through: it
       * is the most destructive control on the card, so it has to be
       * discardable, and it has to mark the card dirty so the badge and the
       * unload guard both say something is pending.
       */
      resetAll: () => {
        this.staged = {}
        this.error = ''
        this.publish()
      },
      /** @returns the current overrides map as an indented JSON document. */
      exportOverrides: (): string => JSON.stringify(this.snapshot.overrides, null, 2),
      /**
       * Stage a whole overrides document pasted by the user.
       * @param text - the JSON document.
       * @returns true when it parsed; false leaves the staging untouched.
       */
      importOverrides: (text: string): boolean => {
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          return false
        }
        const document = readOverridesDocument(parsed)
        if (document === undefined) return false
        this.staged = document
        this.error = ''
        this.publish()
        return true
      },
    }
  }

  private editRole(
    layerId: string,
    roleId: string,
    patch: { count?: number; model?: string; provider?: string },
  ): void {
    const preset = this.currentPresetId()
    const next = this.draft()
    const entry = next[preset] ?? {}
    const key = `${layerId}.${roleId}`
    const merged = pruneRole({ ...entry.roles?.[key], ...patch })
    const roles = { ...entry.roles }
    if (merged === undefined) delete roles[key]
    else roles[key] = merged
    this.commit(next, preset, { ...entry, roles })
  }

  /** Write one preset's entry into the draft, pruning it away when it is empty. */
  private commit(
    draft: Record<string, PresetOverride>,
    presetId: string,
    entry: PresetOverride,
  ): void {
    const pruned = prunePreset(entry)
    if (pruned === undefined) delete draft[presetId]
    else draft[presetId] = pruned
    this.staged = draft
    this.error = ''
    this.publish()
  }

  private draft(): Record<string, PresetOverride> {
    return structuredClone(this.staged ?? this.scope.getSnapshot().value?.overrides ?? {})
  }

  private currentPresetId(): string {
    return this.snapshot.selected
  }

  private async save(): Promise<void> {
    if (this.snapshot.widthViolations.length > 0 || this.snapshot.quorumViolations.length > 0) return
    // The scope writes one field at a time and offers no transaction, so the
    // expensive field goes FIRST and each is cleared as it lands: a refusal on
    // the second must not silently discard the first, nor re-send it on retry.
    // Whether ANY field reached the Host. Derived, never inferred from which
    // fields are still staged: "overrides cleared and default still staged"
    // is also what a save that wrote nothing at all looks like when only the
    // default was staged, and reporting that as a partial save is a lie in the
    // reader's favour — they would think their overrides had landed.
    let landed = false
    try {
      if (this.staged !== undefined) {
        await this.scope.set('overrides', this.staged)
        this.staged = undefined
        landed = true
      }
      if (this.stagedDefault !== undefined) {
        await this.scope.set('defaultPreset', this.stagedDefault)
        this.stagedDefault = undefined
        landed = true
      }
      if (this.stagedCost !== undefined) {
        await this.scope.set('costPerMillionTokens', this.stagedCost)
        this.stagedCost = undefined
        landed = true
      }
      this.error = ''
    } catch (error: unknown) {
      // The Host refuses a section its `validate` hook rejects. The card
      // catches the width and threshold cases before the write, so anything
      // arriving here is a rule the card does not model — show the Host's own
      // words, and say plainly when only part of the save landed. Partial means
      // exactly that: something was written AND something is still pending.
      const message = error instanceof Error ? error.message : String(error)
      const pending = this.staged !== undefined
        || this.stagedDefault !== undefined
        || this.stagedCost !== undefined
      this.error = landed && pending ? this.partialSaveMessage(message) : message
    }
    this.publish()
  }

  private publish(): void {
    const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
    const presets = snapshot.value?.topology ?? []
    const first = presets[0]?.id ?? ''
    const selected = presets.some(preset => preset.id === this.selected) ? this.selected : first
    this.selected = selected
    const overrides = this.staged ?? snapshot.value?.overrides ?? {}
    const maxAgentsPerLayer = snapshot.value?.maxAgentsPerLayer ?? 0
    const shown = presets.find(preset => preset.id === selected)
    const override = overrides[selected]
    this.snapshot = {
      status: snapshot.status,
      writable: snapshot.writable,
      presets,
      selected,
      defaultPreset: this.stagedDefault ?? snapshot.value?.defaultPreset ?? first,
      overrides,
      overrideCounts: countOverrides(overrides),
      maxAgentsPerLayer,
      costPerMillionTokens: this.stagedCost ?? snapshot.value?.costPerMillionTokens ?? 0,
      totalAgents: shown === undefined ? 0 : shown.layers.reduce(
        (total, layer) => total + layer.roles.reduce(
          (sum, role) => sum + (override?.roles?.[`${layer.id}.${role.id}`]?.count ?? role.count),
          0,
        ),
        0,
      ),
      widthViolations: widthViolations(presets, overrides, maxAgentsPerLayer),
      quorumViolations: quorumViolations(presets, overrides),
      dirty: this.staged !== undefined || this.stagedDefault !== undefined || this.stagedCost !== undefined,
      error: this.error,
    }
    this.syncUnloadGuard(this.snapshot.dirty)
    for (const listener of this.listeners) listener()
  }
}
