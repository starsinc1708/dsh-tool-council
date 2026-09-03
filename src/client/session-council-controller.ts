/**
 * Staged-editor controller for one session's council setup.
 *
 * The designer edits a DRAFT over the deployment's mirrored topology — one
 * chosen preset, its layers and roles as nodes, plus roles and map layers the
 * session AUTHORS itself — or builds a fully custom (from-scratch) council
 * (`custom: true`), and lands the result in the `council` settings namespace
 * under `sessionCouncil[sessionId]` with one Save. The reusable "My roles"
 * and "My presets" libraries live in the same section (`roleLibrary` /
 * `presetLibrary`) and survive across sessions.
 *
 * Everything is derived here, not in the component, so the dirty flag, the
 * projected document and the validation can never disagree.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  CouncilSettings, QuorumRule, SessionCouncilSetup, SessionRoleTune, TopologyPreset,
} from '@starsinc1708/dsh-tool-council/types'
import {
  MAX_ROLE_WIDTH, customQuorumViolation, customStructuralError, customWidthViolations,
  sessionQuorumViolation, sessionWidthViolations,
} from '../settings.ts'
import type {
  PresetTemplate, RoleTemplate, SessionLayerAuthor, SessionQuorumTune, SessionRoleAuthor,
} from '../settings.ts'
import type { LayerKind } from '../types.ts'

/**
 * One role this session authors. Unlike a tuning (which edits an existing
 * role), an authored role carries its own prompt — the whole lens.
 */
export interface AuthoredRole {
  readonly id: string
  readonly label: string
  readonly prompt: string
  readonly count?: number
  readonly model?: string
  readonly provider?: string
}

/**
 * One layer this session authors: a map layer added under a preset, or a node
 * of a fully custom topology (`kind` set). Roles live inside the layer.
 */
export interface AuthoredLayer {
  readonly id: string
  readonly label?: string
  /** Omitted = map (the only kind a preset-anchored session may add). */
  readonly kind?: LayerKind
  readonly roles: AuthoredRole[]
  /** Verify-layer quorum; only meaningful when `kind` is `verify`. */
  readonly quorum?: SessionQuorumTune
}

/** The live draft: what the panel is currently showing and editing. */
export interface CouncilDraft {
  /** Preset id of the mirrored topology, or '' for a fully custom council. */
  readonly presetId: string
  /** Display name (custom councils; also the session's fixed label). */
  readonly name: string
  /** True when the council is built from scratch (no mirrored preset). */
  readonly custom: boolean
  /** True when the verify layer runs; only meaningful for presets that have one. */
  readonly verifyEnabled: boolean
  /** Staged tunings of EXISTING roles, keyed `${layerId}.${roleId}`. */
  readonly roles: Record<string, SessionRoleTune>
  /** Staged quorum override for the verify layer. */
  readonly quorum?: SessionQuorumTune
  /** Authored roles appended to existing map/verify layers, by layer id. */
  readonly addRoles: Record<string, AuthoredRole[]>
  /** Authored map layers added under the mirrored preset (map kind). */
  readonly addLayers: AuthoredLayer[]
  /** The whole topology when `custom` (kinds included). */
  readonly topology: AuthoredLayer[]
}

/** The value one session chose, or the empty draft. */
export function emptyDraft(presetId: string, hasVerify: boolean): CouncilDraft {
  return {
    presetId,
    name: '',
    custom: false,
    verifyEnabled: hasVerify,
    roles: {},
    addRoles: {},
    addLayers: [],
    topology: [],
  }
}

/** A fresh custom (from-scratch) draft: empty chain, nothing anchored. */
export function customDraft(): CouncilDraft {
  return {
    presetId: '',
    name: '',
    custom: true,
    verifyEnabled: true,
    roles: {},
    addRoles: {},
    addLayers: [],
    topology: [],
  }
}

/** Clone one authored role. */
function auth(role: SessionRoleAuthor): AuthoredRole {
  return { ...role, label: role.label ?? role.id, prompt: role.prompt }
}

/** Clone one authored layer (stored shape). */
function authLayer(layer: SessionLayerAuthor): AuthoredLayer {
  return {
    id: layer.id,
    ...layer.label === undefined || layer.label === layer.id ? {} : { label: layer.label },
    ...layer.kind === undefined || layer.kind === 'map' ? {} : { kind: layer.kind },
    roles: layer.roles.map(auth),
    ...layer.quorum === undefined || Object.keys(layer.quorum).length === 0 ? {} : { quorum: { ...layer.quorum } },
  }
}

/**
 * Load a session's stored setup into an editable draft.
 * @param presetId - the preset the draft should edit ('' for custom).
 * @param presetHasVerify - whether that preset declares a verify layer.
 * @param stored - the stored setup, or undefined.
 * @returns the draft.
 */
export function draftOf(
  presetId: string,
  presetHasVerify: boolean,
  stored: SessionCouncilSetup | undefined,
): CouncilDraft {
  if (stored === undefined) return emptyDraft(presetId, presetHasVerify)
  const custom = (stored.topology ?? []).length > 0 && (stored.presetId ?? '') === ''
  const base: CouncilDraft = custom
    ? customDraft()
    : emptyDraft(stored.presetId ?? presetId, presetHasVerify)
  return {
    ...base,
    presetId: stored.presetId ?? '',
    name: stored.name ?? '',
    verifyEnabled: custom ? true : stored.verifyEnabled !== false && presetHasVerify,
    roles: { ...stored.roles },
    quorum: stored.quorum === undefined ? undefined : { ...stored.quorum },
    addRoles: Object.fromEntries(
      Object.entries(stored.addRoles ?? {}).map(([layerId, roles]) =>
        [layerId, roles.map(auth)] as const),
    ),
    addLayers: (stored.addLayers ?? []).map(authLayer),
    topology: custom ? (stored.topology ?? []).map(authLayer) : [],
  }
}

/** The composed mirror data one draft edit needs for pruning decisions. */
export interface BaselineRole {
  readonly layerId: string
  readonly roleId: string
  readonly count: number
  readonly model: string
  readonly provider: string
}

/** Find one mirrored preset by id. */
export function presetOf(presets: readonly TopologyPreset[] | undefined, id: string): TopologyPreset | undefined {
  return presets?.find(preset => preset.id === id)
}

/** A verify layer's composed quorum, for effective-value display. */
export function verifyLayerOf(preset: TopologyPreset): TopologyPreset['layers'][number] | undefined {
  return preset.layers.find(layer => layer.kind === 'verify')
}

/** The mirror data of one existing role inside a preset, when it exists. */
export function baselineOf(preset: TopologyPreset, key: string): BaselineRole | undefined {
  const [layerId, roleId] = key.split('.')
  const layer = preset.layers.find(candidate => candidate.id === layerId)
  const role = layer?.roles.find(candidate => candidate.id === roleId)
  if (layer === undefined || role === undefined) return undefined
  return { layerId, roleId, count: role.count, model: role.model, provider: role.provider }
}

/** Set one existing role's absolute count in the draft. */
export function setCount(draft: CouncilDraft, key: string, count: number): CouncilDraft {
  const roles = { ...draft.roles }
  const entry = { ...roles[key] }
  entry.count = count
  roles[key] = entry
  return { ...draft, roles }
}

/** Point one existing role at a provider + model pair ('' clears). */
export function setRoutePair(draft: CouncilDraft, key: string, provider: string, model: string): CouncilDraft {
  const roles = { ...draft.roles }
  const entry = { ...roles[key] }
  if (provider === '' && model === '') delete entry.model
  else entry.model = model
  if (provider === '') delete entry.provider
  else entry.provider = provider
  if (Object.keys(entry).length === 0) delete roles[key]
  else roles[key] = entry
  return { ...draft, roles }
}

/**
 * Override one EXISTING role's prompt for this session. Empty text removes
 * the override and re-inherits the composed prompt.
 */
export function setPromptTune(draft: CouncilDraft, key: string, prompt: string): CouncilDraft {
  const roles = { ...draft.roles }
  const entry = { ...roles[key] }
  if (prompt.trim() === '') delete entry.prompt
  else entry.prompt = prompt
  if (Object.keys(entry).length === 0) delete roles[key]
  else roles[key] = entry
  return { ...draft, roles }
}

/** Toggle the verify layer (preset-anchored drafts). */
export function setVerify(draft: CouncilDraft, presetHasVerify: boolean, enabled: boolean): CouncilDraft {
  return {
    ...draft,
    verifyEnabled: enabled && presetHasVerify,
    ...enabled ? {} : { quorum: undefined },
  }
}

/** Set the verify layer's quorum (preset-anchored drafts). */
export function setQuorum(draft: CouncilDraft, rule: QuorumRule, threshold?: number): CouncilDraft {
  const quorum: SessionQuorumTune = { rule }
  if (rule === 'threshold') {
    if (threshold !== undefined && Number.isInteger(threshold) && threshold >= 1) quorum.threshold = threshold
  }
  return { ...draft, quorum }
}

/** Every id already claimed (preset roles/layers plus authored nodes). */
export function claimedIds(preset: TopologyPreset | undefined, draft: CouncilDraft): Set<string> {
  const ids = new Set<string>()
  if (preset !== undefined) {
    for (const layer of preset.layers) {
      ids.add(layer.id)
      for (const role of layer.roles) ids.add(role.id)
    }
  }
  for (const layer of [...draft.addLayers, ...draft.topology]) {
    ids.add(layer.id)
    for (const role of layer.roles) ids.add(role.id)
  }
  for (const roles of Object.values(draft.addRoles)) {
    for (const role of roles) ids.add(role.id)
  }
  return ids
}

/** A URL-ish slug, lowercased, punctuation dropped. */
export function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/gu, '-').replace(/^-+|-+$/gu, '')
  return slug === '' ? 'role' : slug
}

/** Mint an id unique within the preset from a label. */
export function mintId(label: string, taken: Set<string>): string {
  const base = slugify(label)
  let candidate = base
  let copy = 2
  while (taken.has(candidate)) {
    candidate = `${base}-${copy}`
    copy += 1
  }
  return candidate
}

/** Append one authored role to an existing map/verify layer. */
export function addRole(draft: CouncilDraft, layerId: string, role: AuthoredRole): CouncilDraft {
  const addRoles = { ...draft.addRoles }
  addRoles[layerId] = [...(addRoles[layerId] ?? []), role]
  return { ...draft, addRoles }
}

/** Replace one authored role of an existing layer. */
export function updateRole(
  draft: CouncilDraft,
  layerId: string,
  roleId: string,
  patch: Partial<AuthoredRole>,
): CouncilDraft {
  const addRoles = { ...draft.addRoles }
  addRoles[layerId] = (addRoles[layerId] ?? []).map(role => (role.id === roleId ? { ...role, ...patch } : role))
  return { ...draft, addRoles }
}

/** Drop one authored role of an existing layer. */
export function removeRole(draft: CouncilDraft, layerId: string, roleId: string): CouncilDraft {
  const addRoles = { ...draft.addRoles }
  const roles = (addRoles[layerId] ?? []).filter(role => role.id !== roleId)
  if (roles.length === 0) delete addRoles[layerId]
  else addRoles[layerId] = roles
  return { ...draft, addRoles }
}

/** Append one authored map layer under the mirrored preset. */
export function addLayer(draft: CouncilDraft, layer: AuthoredLayer): CouncilDraft {
  return { ...draft, addLayers: [...draft.addLayers, layer] }
}

/** Drop one whole authored map layer under the mirrored preset. */
export function removeAuthoredLayer(draft: CouncilDraft, layerId: string): CouncilDraft {
  return { ...draft, addLayers: draft.addLayers.filter(layer => layer.id !== layerId) }
}

/** Append an authored role to an authored map layer. */
export function addLayerRole(draft: CouncilDraft, layerId: string, role: AuthoredRole): CouncilDraft {
  return {
    ...draft,
    addLayers: draft.addLayers.map(layer => layer.id === layerId
      ? { ...layer, roles: [...layer.roles, role] }
      : layer),
  }
}

/** Replace one authored role of an authored map layer. */
export function updateLayerRole(
  draft: CouncilDraft,
  layerId: string,
  roleId: string,
  patch: Partial<AuthoredRole>,
): CouncilDraft {
  return {
    ...draft,
    addLayers: draft.addLayers.map(layer => layer.id === layerId
      ? { ...layer, roles: layer.roles.map(role => role.id === roleId ? { ...role, ...patch } : role) }
      : layer),
  }
}

/** Drop one authored role of an authored map layer. */
export function removeLayerRole(draft: CouncilDraft, layerId: string, roleId: string): CouncilDraft {
  return {
    ...draft,
    addLayers: draft.addLayers.map(layer => layer.id === layerId
      ? { ...layer, roles: layer.roles.filter(role => role.id !== roleId) }
      : layer),
  }
}

/* ---------------- Custom (from-scratch) topology ops ---------------- */

/** Insert one authored node before the trailing reduce (or append). */
function insertBeforeReduce(topology: AuthoredLayer[], layer: AuthoredLayer): AuthoredLayer[] {
  const index = topology.findIndex(candidate => candidate.kind === 'reduce')
  const next = [...topology]
  next.splice(index === -1 ? next.length : index, 0, layer)
  return next
}

/** Append a node of the given kind to a custom topology. */
export function addCustomNode(draft: CouncilDraft, node: AuthoredLayer): CouncilDraft {
  if (node.kind === 'reduce') return { ...draft, topology: [...draft.topology, node] }
  return { ...draft, topology: insertBeforeReduce(draft.topology, node) }
}

/** Set a custom node's label or quorum. */
export function patchCustomNode(draft: CouncilDraft, nodeId: string, patch: Partial<AuthoredLayer>): CouncilDraft {
  return {
    ...draft,
    topology: draft.topology.map(node => node.id === nodeId ? { ...node, ...patch } : node),
  }
}

/** Append an authored role to a custom node. */
export function addCustomRole(draft: CouncilDraft, nodeId: string, role: AuthoredRole): CouncilDraft {
  return {
    ...draft,
    topology: draft.topology.map(node => node.id === nodeId
      ? { ...node, roles: [...node.roles, role] }
      : node),
  }
}

/** Replace one authored role of a custom node. */
export function updateCustomRole(
  draft: CouncilDraft,
  nodeId: string,
  roleId: string,
  patch: Partial<AuthoredRole>,
): CouncilDraft {
  return {
    ...draft,
    topology: draft.topology.map(node => node.id === nodeId
      ? { ...node, roles: node.roles.map(role => role.id === roleId ? { ...role, ...patch } : role) }
      : node),
  }
}

/** Drop one authored role of a custom node. */
export function removeCustomRole(draft: CouncilDraft, nodeId: string, roleId: string): CouncilDraft {
  return {
    ...draft,
    topology: draft.topology.map(node => node.id === nodeId
      ? { ...node, roles: node.roles.filter(role => role.id !== roleId) }
      : node),
  }
}

/** Drop a whole custom node. */
export function removeCustomNode(draft: CouncilDraft, nodeId: string): CouncilDraft {
  return { ...draft, topology: draft.topology.filter(node => node.id !== nodeId) }
}

/* ---------------- Projection ---------------- */

/** Serialize one authored role for the durable document. */
function serializeAuthor(role: AuthoredRole): SessionRoleAuthor {
  return {
    id: role.id,
    label: role.label === role.id ? role.id : role.label,
    prompt: role.prompt,
    ...role.count === undefined || role.count === 1 ? {} : { count: role.count },
    ...role.model === undefined || role.model === '' ? {} : { model: role.model },
    ...role.provider === undefined || role.provider === '' ? {} : { provider: role.provider },
  }
}

/** Serialize one authored layer for the durable document. */
function serializeLayer(layer: AuthoredLayer): SessionLayerAuthor {
  return {
    id: layer.id,
    label: layer.label === undefined || layer.label === layer.id ? layer.id : layer.label,
    ...layer.kind === undefined || layer.kind === 'map' ? {} : { kind: layer.kind },
    roles: layer.roles.map(serializeAuthor),
    ...layer.quorum === undefined || Object.keys(layer.quorum).length === 0 ? {} : { quorum: { ...layer.quorum } },
  }
}

/**
 * The durable document one Save should write for a draft.
 *
 * Fields equal to the preset's own composition are dropped. For a custom
 * council the whole authored topology is stored with its name. Authored roles
 * and layers are kept whole (minus their defaults).
 * @param preset - the mirrored preset the draft edits (undefined for custom).
 * @param draft - the draft.
 * @returns the normalized setup to store.
 */
export function projectSetup(preset: TopologyPreset | undefined, draft: CouncilDraft): SessionCouncilSetup {
  if (draft.custom) {
    return {
      presetId: '',
      ...draft.name === '' ? {} : { name: draft.name },
      topology: draft.topology.map(serializeLayer),
    }
  }
  const roles: Record<string, SessionRoleTune> = {}
  for (const [key, tune] of Object.entries(draft.roles)) {
    const baseline = preset === undefined ? undefined : baselineOf(preset, key)
    if (baseline === undefined) continue
    const out: SessionRoleTune = {}
    if (tune.count !== undefined && tune.count !== baseline.count) out.count = tune.count
    if (tune.model !== undefined && tune.model !== '' && tune.model !== baseline.model) out.model = tune.model
    if (tune.provider !== undefined && tune.provider !== '' && tune.provider !== baseline.provider) {
      out.provider = tune.provider
    }
    if (tune.prompt !== undefined && tune.prompt.trim() !== '') out.prompt = tune.prompt
    if (Object.keys(out).length > 0) roles[key] = out
  }
  const hasVerify = preset?.layers.some(layer => layer.kind === 'verify') === true
  const verify = preset === undefined ? undefined : verifyLayerOf(preset)
  let quorum: SessionQuorumTune | undefined
  if (draft.verifyEnabled && hasVerify && verify !== undefined) {
    const composedRule = verify.quorumRule ?? 'majority'
    const rule = draft.quorum?.rule ?? composedRule
    if (rule === 'threshold') {
      const threshold = draft.quorum?.threshold ?? verify.quorumThreshold
      if (rule !== composedRule || threshold !== verify.quorumThreshold) {
        quorum = { rule }
        if (threshold !== undefined) quorum.threshold = threshold
      }
    } else if (rule !== composedRule) {
      quorum = { rule }
    }
  }
  const addRoles: Record<string, SessionRoleAuthor[]> = {}
  for (const [layerId, authored] of Object.entries(draft.addRoles)) {
    if (authored.length > 0) addRoles[layerId] = authored.map(serializeAuthor)
  }
  const addLayers = draft.addLayers
    .map(layer => (layer.roles.length === 0 ? undefined : serializeLayer(layer)))
    .filter((layer): layer is SessionLayerAuthor => layer !== undefined)
  return {
    presetId: draft.presetId,
    ...draft.name === '' ? {} : { name: draft.name },
    ...hasVerify && !draft.verifyEnabled ? { verifyEnabled: false } : {},
    ...Object.keys(roles).length === 0 ? {} : { roles },
    ...quorum === undefined || Object.keys(quorum).length === 0 ? {} : { quorum },
    ...Object.keys(addRoles).length === 0 ? {} : { addRoles },
    ...addLayers.length === 0 ? {} : { addLayers },
  }
}

/** Whether two stored documents are the same normalized setup. */
export function setupsEqual(a: SessionCouncilSetup | undefined, b: SessionCouncilSetup | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** What the panel renders. */
export interface CouncilDesignState {
  readonly status: 'loading' | 'ready' | 'unavailable'
  readonly writable: boolean
  /** Preset id this council was published under — the designer's mode gate. */
  readonly councilPreset: string
  readonly presets: readonly TopologyPreset[]
  /** Preset the deployment runs when nothing is configured (read-only mirror). */
  readonly defaultPreset: string
  /** Per-layer member ceiling (read-only mirror). */
  readonly maxAgentsPerLayer: number
  /** Per-preset layer ceiling (read-only mirror) — the "add layer" gate. */
  readonly maxLayers: number
  readonly draft: CouncilDraft
  /** Whether anything is staged but unsaved. */
  readonly dirty: boolean
  /** Whether this session currently stores a setup at all. */
  readonly hasStored: boolean
  /** Normalized document the current Save would write. */
  readonly staged: SessionCouncilSetup
  /** "My roles" library, keyed by id. */
  readonly roleLibrary: Record<string, RoleTemplate>
  /** "My presets" library, keyed by id. */
  readonly presetLibrary: Record<string, PresetTemplate>
  /** Layers the staged draft would push past the ceiling. */
  readonly widthViolations: ReadonlyArray<{ readonly layerId: string; readonly width: number; readonly max: number }>
  /** A staged threshold the verify layer's own width cannot reach, if any. */
  readonly quorumViolation:
    | { readonly rule: QuorumRule; readonly threshold: number; readonly width: number }
    | undefined
  /** Structural problem of a custom topology, surfaced before the host would refuse. */
  readonly customError: string | undefined
  /** The last write's rejection, cleared on the next edit. */
  readonly error: string
}

/** Minimal observable the renderer binds into a `use…` hook. */
export interface Store<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

const EMPTY: CouncilDesignState = {
  status: 'loading',
  writable: false,
  councilPreset: 'map-reduce',
  presets: [],
  defaultPreset: '',
  maxAgentsPerLayer: 0,
  maxLayers: 6,
  draft: customDraft(),
  dirty: false,
  hasStored: false,
  staged: { presetId: '', topology: [] },
  roleLibrary: {},
  presetLibrary: {},
  widthViolations: [],
  quorumViolation: undefined,
  customError: undefined,
  error: '',
}

/** The custom-preset menu label prefix. */
export const CUSTOM_OPTION = 'custom' // sentinel used by the UI preset menu

/**
 * Bridge the `council` settings namespace onto one session's designer.
 *
 * The draft lives here; the scope is read at publish time (fresh on every
 * save, so two sessions never clobber each other's documents).
 */
export class SessionCouncilController {
  private listeners = new Set<() => void>()
  private snapshot: CouncilDesignState = EMPTY
  private draft: CouncilDraft | undefined
  private selected = ''
  private error = ''
  private detachScope: (() => void) | undefined
  private readonly sessionId: string

  constructor(
    private readonly scope: SettingsScope<CouncilSettings>,
    sessionId: string,
    private readonly partialSaveMessage: (error: string) => string = error => error,
  ) {
    this.sessionId = sessionId
    this.detachScope = scope.subscribe(() => { this.publish() })
    this.publish()
  }

  /** Detach from the scope. Owned by the dock entry's effect. */
  dispose(): void {
    this.detachScope?.()
    this.detachScope = undefined
    this.listeners.clear()
  }

  /** @returns the observable the renderer binds as `useCouncilDesign`. */
  store(): Store<CouncilDesignState> {
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
      /* Selection and modes */
      selectPreset: (presetId: string) => { this.openPreset(presetId) },
      startCustom: (fromTemplate?: PresetTemplate) => {
        this.selected = CUSTOM_OPTION
        this.error = ''
        this.draft = fromTemplate === undefined
          ? customDraft()
          : {
              ...customDraft(),
              name: fromTemplate.label,
              topology: fromTemplate.layers.map(authLayer),
            }
        this.publish()
      },
      setName: (name: string) => { this.edit(draft => ({ ...draft, name })) },
      /* Existing-role tuning */
      setCount: (key: string, count: number) => { this.edit(draft => setCount(draft, key, count)) },
      setRoutePair: (key: string, provider: string, model: string) => {
        this.edit(draft => setRoutePair(draft, key, provider, model))
      },
      setPrompt: (key: string, prompt: string) => {
        this.edit(draft => setPromptTune(draft, key, prompt))
      },
      setVerify: (enabled: boolean) => {
        const preset = presetOf(this.snapshot.presets, this.snapshot.draft.presetId)
        this.edit(draft => setVerify(draft, this.hasVerifyOf(preset), enabled))
      },
      setQuorum: (rule: QuorumRule, threshold?: number) => {
        this.edit(draft => setQuorum(draft, rule, threshold))
      },
      /* Authored roles under a preset */
      addRoleTo: (layerId: string, role: AuthoredRole) => { this.edit(draft => addRole(draft, layerId, role)) },
      editRole: (layerId: string, roleId: string, patch: Partial<AuthoredRole>) => {
        this.edit(draft => updateRole(draft, layerId, roleId, patch))
      },
      removeRole: (layerId: string, roleId: string) => {
        this.edit(draft => removeRole(draft, layerId, roleId))
      },
      addAuthoredLayer: (layer: AuthoredLayer) => { this.edit(draft => addLayer(draft, layer)) },
      removeAuthoredLayer: (layerId: string) => {
        this.edit(draft => removeAuthoredLayer(draft, layerId))
      },
      addLayerRole: (layerId: string, role: AuthoredRole) => {
        this.edit(draft => addLayerRole(draft, layerId, role))
      },
      editLayerRole: (layerId: string, roleId: string, patch: Partial<AuthoredRole>) => {
        this.edit(draft => updateLayerRole(draft, layerId, roleId, patch))
      },
      removeLayerRole: (layerId: string, roleId: string) => {
        this.edit(draft => removeLayerRole(draft, layerId, roleId))
      },
      /* Custom (from-scratch) topology */
      addCustomNode: (node: AuthoredLayer) => { this.edit(draft => addCustomNode(draft, node)) },
      patchCustomNode: (nodeId: string, patch: Partial<AuthoredLayer>) => {
        this.edit(draft => patchCustomNode(draft, nodeId, patch))
      },
      addCustomRole: (nodeId: string, role: AuthoredRole) => {
        this.edit(draft => addCustomRole(draft, nodeId, role))
      },
      editCustomRole: (nodeId: string, roleId: string, patch: Partial<AuthoredRole>) => {
        this.edit(draft => updateCustomRole(draft, nodeId, roleId, patch))
      },
      removeCustomRole: (nodeId: string, roleId: string) => {
        this.edit(draft => removeCustomRole(draft, nodeId, roleId))
      },
      removeCustomNode: (nodeId: string) => { this.edit(draft => removeCustomNode(draft, nodeId)) },
      /* Libraries */
      saveRoleToLibrary: (role: AuthoredRole) => { void this.saveRole(role) },
      deleteRoleFromLibrary: (roleId: string) => { void this.deleteRole(roleId) },
      savePresetToLibrary: () => { void this.savePreset() },
      deletePresetFromLibrary: (presetId: string) => { void this.deletePreset(presetId) },
      save: () => { void this.save() },
      discard: () => {
        this.selected = ''
        this.draft = undefined
        this.error = ''
        this.publish()
      },
      clear: () => {
        this.selected = ''
        this.draft = undefined
        this.error = ''
        void this.writeSetup(undefined)
      },
    }
  }

  /** Width cap a role stepper offers (the schema ceiling). */
  roleWidthCap(): number {
    return MAX_ROLE_WIDTH
  }

  private hasVerifyOf(preset: TopologyPreset | undefined): boolean {
    return preset?.layers.some(layer => layer.kind === 'verify') === true
  }

  private openPreset(presetId: string): void {
    this.selected = presetId
    this.error = ''
    const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
    const preset = presetOf(snapshot.value?.topology, presetId)
    const stored = snapshot.value?.sessionCouncil?.[this.sessionId]
    this.draft = stored?.presetId === presetId
      ? draftOf(presetId, this.hasVerifyOf(preset), stored)
      : emptyDraft(presetId, this.hasVerifyOf(preset))
    this.publish()
  }

  private edit(apply: (draft: CouncilDraft) => CouncilDraft): void {
    this.draft = apply(this.snapshot.draft)
    this.error = ''
    this.publish()
  }

  private async save(): Promise<void> {
    if (this.snapshot.dirty === false) return
    // Blocked saves are reported, never silent: the chip would otherwise stay
    // on with no visible reason.
    if (this.snapshot.customError !== undefined) {
      this.error = this.partialSaveMessage(this.snapshot.customError)
      this.publish()
      return
    }
    if (this.snapshot.widthViolations.length > 0 || this.snapshot.quorumViolation !== undefined) {
      this.error = this.partialSaveMessage('layer width or quorum ceiling reached')
      this.publish()
      return
    }
    try {
      await this.writeSetup(this.snapshot.staged)
      this.draft = undefined
      this.error = ''
      this.publish()
      // A landed save is by definition not dirty. The equality round-trip
      // should agree, but force the flag anyway so a normalization nuance can
      // never leave the "unsaved changes" chip lit after a successful write.
      this.snapshot = { ...this.snapshot, dirty: false, hasStored: true }
      for (const listener of this.listeners) listener()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      this.error = this.partialSaveMessage(message)
      this.publish()
    }
  }

  /** Write one session's setup into the `sessionCouncil` field. */
  private async writeSetup(setup: SessionCouncilSetup | undefined): Promise<void> {
    const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
    const map = { ...snapshot.value?.sessionCouncil }
    if (setup === undefined) delete map[this.sessionId]
    else map[this.sessionId] = setup
    await this.scope.set('sessionCouncil', map)
  }

  private async saveRole(role: AuthoredRole): Promise<void> {
    try {
      const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
      const library = { ...snapshot.value?.roleLibrary }
      library[role.id] = {
        id: role.id,
        label: role.label === '' ? role.id : role.label,
        prompt: role.prompt,
        count: role.count ?? 1,
        ...role.model === undefined || role.model === '' ? {} : { model: role.model },
        ...role.provider === undefined || role.provider === '' ? {} : { provider: role.provider },
      }
      await this.scope.set('roleLibrary', library)
    } catch (error: unknown) {
      this.error = this.partialSaveMessage(error instanceof Error ? error.message : String(error))
      this.publish()
    }
  }

  private async deleteRole(roleId: string): Promise<void> {
    try {
      const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
      const library = { ...snapshot.value?.roleLibrary }
      delete library[roleId]
      await this.scope.set('roleLibrary', library)
    } catch (error: unknown) {
      this.error = this.partialSaveMessage(error instanceof Error ? error.message : String(error))
      this.publish()
    }
  }

  private async savePreset(): Promise<void> {
    const draft = this.snapshot.draft
    if (!draft.custom) return
    const structural = customStructuralError(draft.topology)
    if (structural !== undefined) {
      this.error = this.partialSaveMessage(structural)
      this.publish()
      return
    }
    const label = draft.name.trim() === '' ? 'Custom' : draft.name.trim()
    const taken = new Set(Object.keys(this.snapshot.presetLibrary))
    try {
      const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
      const library = { ...snapshot.value?.presetLibrary }
      const id = mintId(label, taken)
      library[id] = {
        id,
        label,
        layers: draft.topology.map(serializeLayer),
      }
      await this.scope.set('presetLibrary', library)
    } catch (error: unknown) {
      this.error = this.partialSaveMessage(error instanceof Error ? error.message : String(error))
      this.publish()
    }
  }

  private async deletePreset(presetId: string): Promise<void> {
    try {
      const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
      const library = { ...snapshot.value?.presetLibrary }
      delete library[presetId]
      await this.scope.set('presetLibrary', library)
    } catch (error: unknown) {
      this.error = this.partialSaveMessage(error instanceof Error ? error.message : String(error))
      this.publish()
    }
  }

  private publish(): void {
    const snapshot: SettingsScopeSnapshot<CouncilSettings> = this.scope.getSnapshot()
    const presets = snapshot.value?.topology ?? []
    const maxAgentsPerLayer = snapshot.value?.maxAgentsPerLayer ?? 0
    const maxLayers = snapshot.value?.maxLayers ?? 6
    const defaultPreset = snapshot.value?.defaultPreset ?? presets[0]?.id ?? ''
    const stored = snapshot.value?.sessionCouncil?.[this.sessionId]
    const storedPreset = stored?.presetId
    const customStored = (stored?.topology?.length ?? 0) > 0 && (stored?.presetId ?? '') === ''
    const current = this.selected !== ''
      ? this.selected
      : customStored
        ? CUSTOM_OPTION
        : storedPreset ?? defaultPreset
    this.selected = current
    const preset = presetOf(presets, current)
    const storedDraft = this.draft === undefined
      ? current === CUSTOM_OPTION
        ? draftOf('', false, stored)
        : draftOf(current, this.hasVerifyOf(preset), stored)
      : this.draft
    this.draft = storedDraft
    const staged = preset === undefined && !storedDraft.custom
      ? { presetId: current }
      : projectSetup(preset, storedDraft)
    // A pristine draft of the deployment's own default preset is NOT a setup.
    // Custom drafts are always real choices once they carry anything.
    const pristineDefault = stored === undefined
      && !storedDraft.custom
      && preset !== undefined
      && staged.presetId === defaultPreset
      && staged.verifyEnabled !== false
      && staged.quorum === undefined
      && (staged.roles === undefined || Object.keys(staged.roles).length === 0)
      && Object.keys(staged.addRoles ?? {}).length === 0
      && (staged.addLayers ?? []).length === 0

    const customWidths = storedDraft.custom
      ? customWidthViolations(storedDraft.topology, maxAgentsPerLayer)
      : preset === undefined
        ? []
        : [...sessionWidthViolations(preset, staged, maxAgentsPerLayer)]
    const customQuorum = storedDraft.custom
      ? customQuorumViolation(storedDraft.topology)
      : preset === undefined
        ? undefined
        : sessionQuorumViolation(preset, staged)

    this.snapshot = {
      status: snapshot.status,
      writable: snapshot.writable,
      councilPreset: snapshot.value?.agentPresetId ?? 'map-reduce',
      presets,
      defaultPreset,
      maxAgentsPerLayer,
      maxLayers,
      draft: storedDraft,
      dirty: stored !== undefined ? !setupsEqual(staged, stored) : !pristineDefault,
      hasStored: stored !== undefined,
      staged,
      roleLibrary: snapshot.value?.roleLibrary ?? {},
      presetLibrary: snapshot.value?.presetLibrary ?? {},
      widthViolations: storedDraft.custom
        ? [...customWidths]
        : [...customWidths],
      quorumViolation: customQuorum === undefined
        ? undefined
        : { rule: 'threshold' as const, ...customQuorum },
      customError: storedDraft.custom ? customStructuralError(storedDraft.topology) : undefined,
      error: this.error,
    }
    for (const listener of this.listeners) listener()
  }
}
