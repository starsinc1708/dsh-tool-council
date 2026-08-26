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
  CouncilSettings, PresetOverride, QuorumRule, TopologyPreset,
} from '@deepseek-ai/dsh-tool-council/types'

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
  dirty: false,
  error: '',
}

/** Minimal observable the renderer binds into a `use…` hook. */
export interface Store<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
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
  private selected = ''
  private error = ''

  constructor(private readonly scope: SettingsScope<CouncilSettings>) {
    scope.subscribe(() => { this.publish() })
    this.publish()
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
      setRoleCount: (layerId: string, roleId: string, count: number) => {
        this.editRole(layerId, roleId, { count })
      },
      setRoleModel: (layerId: string, roleId: string, model: string) => {
        this.editRole(layerId, roleId, { model })
      },
      setQuorum: (layerId: string, rule: QuorumRule, threshold?: number) => {
        const preset = this.currentPresetId()
        const next = this.draft()
        const entry = next[preset] ?? {}
        next[preset] = {
          ...entry,
          quorums: {
            ...entry.quorums,
            [layerId]: { rule, ...threshold === undefined ? {} : { threshold } },
          },
        }
        this.staged = next
        this.error = ''
        this.publish()
      },
      discard: () => {
        this.staged = undefined
        this.stagedDefault = undefined
        this.error = ''
        this.publish()
      },
      save: () => { void this.save() },
      /** Drop every override for the shown preset and re-inherit the composition. */
      resetPreset: () => {
        const next = this.draft()
        delete next[this.currentPresetId()]
        this.staged = next
        this.error = ''
        this.publish()
      },
    }
  }

  private editRole(layerId: string, roleId: string, patch: { count?: number; model?: string }): void {
    const preset = this.currentPresetId()
    const next = this.draft()
    const entry = next[preset] ?? {}
    const key = `${layerId}.${roleId}`
    next[preset] = {
      ...entry,
      roles: { ...entry.roles, [key]: { ...entry.roles?.[key], ...patch } },
    }
    this.staged = next
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
    try {
      if (this.stagedDefault !== undefined) await this.scope.set('defaultPreset', this.stagedDefault)
      if (this.staged !== undefined) await this.scope.set('overrides', this.staged)
      this.staged = undefined
      this.stagedDefault = undefined
      this.error = ''
    } catch (error: unknown) {
      // The Host refuses a section its `validate` hook rejects — an overlay
      // past maxAgentsPerLayer arrives here, and the user must see why.
      this.error = error instanceof Error ? error.message : String(error)
    }
    this.publish()
  }

  private publish(): void {
    const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
    const presets = snapshot.value?.topology ?? []
    const first = presets[0]?.id ?? ''
    const selected = presets.some(preset => preset.id === this.selected) ? this.selected : first
    this.selected = selected
    this.snapshot = {
      status: snapshot.status,
      writable: snapshot.writable,
      presets,
      selected,
      defaultPreset: this.stagedDefault ?? snapshot.value?.defaultPreset ?? first,
      overrides: this.staged ?? snapshot.value?.overrides ?? {},
      dirty: this.staged !== undefined || this.stagedDefault !== undefined,
      error: this.error,
    }
    for (const listener of this.listeners) listener()
  }
}
