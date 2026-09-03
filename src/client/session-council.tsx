/**
 * Per-session council designer, browser half.
 *
 * The only configuration surface the council has left: an expandable panel
 * above the composer, visible inside Map-Reduce sessions, that FIXES how the
 * council runs for this session. Pick one of the deployment's presets, a
 * saved custom preset from **My presets**, or build a council from scratch
 * (**Custom**): tune every preset role's width and model, append your own
 * roles (each with its own lens prompt), add whole extra map layers, switch
 * verification off, restate its quorum — then Save. Roles you author can be
 * stored into **My roles** and inserted into any layer of any later session
 * with one click; a finished custom topology can be saved as a reusable
 * preset template.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: brings the conversation SlotMap augmentation that declares
// `conversation.input.dock` and its `InputZone` owner share.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

import type { CouncilSettings, PresetTemplate, RoleTemplate, TopologyPreset } from '../settings.ts'
import { tunedCount } from '../settings.ts'
import type { LayerKind, QuorumRule } from '../types.ts'
import { NS } from './locales.ts'
import type { CouncilKey } from './locales.ts'
import {
  CUSTOM_OPTION, SessionCouncilController, mintId, presetOf,
} from './session-council-controller.ts'
import type { AuthoredRole, AuthoredLayer, CouncilDesignState, CouncilDraft } from './session-council-controller.ts'
import css from './session-council.module.css'

/** The dock entry's list id. */
export const COUNCIL_DESIGNER_SLOT_ID = 'council-design'

/** The injected business face: the settings scope and the model directory. */
export interface CouncilDesignerInjected {
  scope: SettingsScope<CouncilSettings>
  /** Resolver for the harness's per-session model directory, when composed. */
  modelDirectories?: { directoryFor(sessionId: string): ModelDirectoryLike }
}

type DockProps = PropsRuntime<'conversation.input.dock'>
  & PropsLocale<'council'>
  & InjectFace<CouncilDesignerInjected>

/** Translate narrowed to this namespace's own keys, for child components. */
type L = (key: CouncilKey, args?: Record<string, unknown>) => string

/** The preset id assumed when the deployment mirrored none. */
const FALLBACK_COUNCIL_PRESET = 'map-reduce'

/** Quorum rules, in menu order. */
const QUORUM_RULES: readonly QuorumRule[] = ['majority', 'unanimous', 'threshold']

/** The harness's per-session model directory, structurally (no value import). */
export interface ModelDirectoryLike {
  store: {
    getSnapshot(): {
      groups: readonly {
        readonly id: string
        readonly name: string
        readonly models: readonly { readonly id: string; readonly name: string }[]
      }[]
      status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
    }
    subscribe(listener: () => void): () => void
  }
  load(): Promise<unknown>
}

/** One row of a role in the panel, whatever its origin. */
export interface RoleRow {
  /** `${layerId}.${roleId}`. */
  readonly key: string
  readonly roleId: string
  readonly label: string
  readonly count: number
  readonly provider: string
  readonly model: string
  /** Lens prompt, present on authored roles only. */
  readonly prompt?: string
}

/** The ordered DAG a preset composes under a draft. */
export interface FlowNode {
  readonly id: string
  readonly kind: LayerKind
  readonly roles: readonly RoleRow[]
  /** Whole authored map layers and custom nodes are marked. */
  readonly authored: boolean
  readonly label?: string
}

/** One existing mirror role as its display row (tunings applied). */
function roleRowOf(
  layerId: string,
  role: { readonly id: string; readonly label: string; readonly count: number; readonly model: string; readonly provider: string },
  draft: CouncilDraft,
): RoleRow {
  const tune = draft.roles[`${layerId}.${role.id}`]
  return {
    key: `${layerId}.${role.id}`,
    roleId: role.id,
    label: role.label ?? role.id,
    count: tunedCount(role.count, tune),
    provider: tune?.provider !== undefined && tune.provider !== '' ? tune.provider : role.provider,
    model: tune?.model !== undefined && tune.model !== '' ? tune.model : role.model,
  }
}

/** An authored role as its display row. */
function authoredRow(layerId: string, role: AuthoredRole): RoleRow {
  return {
    key: `${layerId}.${role.id}`,
    roleId: role.id,
    label: role.label === '' ? role.id : role.label,
    count: role.count ?? 1,
    provider: role.provider ?? '',
    model: role.model ?? '',
    prompt: role.prompt,
  }
}

/** A custom topology node as its display row set. */
function customNodeRows(nodeId: string, roles: readonly AuthoredRole[]): RoleRow[] {
  return roles.map(role => authoredRow(nodeId, role))
}

/** The flow of a preset-anchored draft (mirror layers + authored map layers). */
export function flowOf(preset: TopologyPreset, draft: CouncilDraft): FlowNode[] {
  const kept: FlowNode[] = []
  for (const layer of preset.layers) {
    if (layer.kind === 'verify' && draft.verifyEnabled === false) continue
    const authored = (layer.kind === 'map' || layer.kind === 'verify')
      ? (draft.addRoles[layer.id] ?? []).map(role => authoredRow(layer.id, role))
      : []
    kept.push({
      id: layer.id,
      kind: layer.kind,
      roles: [...layer.roles.map(role => roleRowOf(layer.id, role, draft)), ...authored],
      authored: false,
    })
  }
  const extras: FlowNode[] = draft.addLayers.map(layer => ({
    id: layer.id,
    kind: 'map' as const,
    roles: layer.roles.map(role => authoredRow(layer.id, role)),
    authored: true,
    label: layer.label ?? layer.id,
  }))
  if (extras.length > 0) {
    const firstNonMap = kept.findIndex(node => node.kind !== 'map')
    kept.splice(firstNonMap === -1 ? kept.length : firstNonMap, 0, ...extras)
  }
  return kept
}

/** The flow of a custom (from-scratch) topology. */
export function customFlowOf(topology: readonly AuthoredLayer[]): FlowNode[] {
  return topology.map(layer => ({
    id: layer.id,
    kind: layer.kind ?? 'map',
    roles: customNodeRows(layer.id, layer.roles),
    authored: true,
    label: layer.label ?? layer.id,
  }))
}

/** One role's route choice, as the picker edits it. */
export interface ModelRoute {
  readonly provider: string
  readonly model: string
}

/**
 * The composer-dock designer for one Map-Reduce session.
 * @param props - the dock entry's composed props.
 * @returns the panel, or nothing outside Map-Reduce sessions.
 */
function CouncilDesigner(props: DockProps) {
  const { scope, t } = props
  const sessionId = props.session.sessionId
  const agentPreset = props.useSessions(state => state.byId[sessionId]?.agentPreset)
  const [open, setOpen] = useState(false)
  const modelDirectories = props.modelDirectories

  const [controller] = useState(
    () => new SessionCouncilController(scope, sessionId, error => t('saveFailed', { error })),
  )
  useEffect(() => () => { controller.dispose() }, [controller])

  // The designer matters before the session starts running: once a request
  // has been sent (or one is in flight) the expanded form is noise, so
  // collapse it. The compact header stays, so the setup can still be opened
  // between runs.
  const sessionEngaged = props.session.blank === false || props.session.running === true
  useEffect(() => {
    if (sessionEngaged) setOpen(false)
  }, [sessionEngaged])

  const [models] = useState<ModelDirectoryLike | undefined>(() =>
    modelDirectories?.directoryFor(sessionId))

  const store = controller.store()
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const actions = controller.actions()

  const isCouncil = agentPreset !== undefined
    && agentPreset === (state.councilPreset || FALLBACK_COUNCIL_PRESET)
  if (!isCouncil || state.status === 'loading') return null
  if (state.status !== 'ready') return null

  const draft = state.draft
  const preset = presetOf(state.presets, draft.presetId)
  const flow = draft.custom
    ? customFlowOf(draft.topology)
    : preset === undefined
      ? []
      : flowOf(preset, draft)

  const verifyNode = flow.find(node => node.kind === 'verify')
  const verifyWidth = (verifyNode?.roles ?? []).reduce((sum, role) => sum + role.count, 0)
  // Composed quorum of the preset's verify layer, for the effective display
  // when the session has not overridden it.
  const composedVerify = draft.custom ? undefined : preset?.layers.find(layer => layer.kind === 'verify')
  const effectiveRule = verifyNode === undefined
    ? undefined
    : draft.quorum?.rule ?? composedVerify?.quorumRule ?? 'majority'
  const effectiveThreshold = verifyNode === undefined
    ? undefined
    : draft.quorum?.threshold ?? composedVerify?.quorumThreshold

  // Menu options: mirrored presets, saved custom presets, then from-scratch.
  const presetOptions = [
    ...state.presets.map(candidate => ({ value: candidate.id, label: candidate.label })),
    ...Object.values(state.presetLibrary).map(template => ({ value: `template:${template.id}`, label: `★ ${template.label}` })),
    { value: CUSTOM_OPTION, label: t('designer.custom') },
  ]
  const chosenValue = draft.custom
    ? CUSTOM_OPTION
    : state.presets.some(p => p.id === draft.presetId)
      ? draft.presetId
      : ''
  const menuLabel = draft.custom
    ? draft.name === '' ? t('designer.custom') : draft.name
    : preset?.label ?? chosenValue

  return (
    <div className={css.panel} data-council-designer="">
      <button
        type="button"
        className={css.head}
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.title}>{t('designer.title')}</span>
        <span className={css.subtitle}>
          {t('designer.preset', { preset: menuLabel })}
          {state.dirty ? <span className={css.dirtyChip}>{t('designer.unsaved')}</span> : null}
        </span>
        <span className={css.chevron}>{open ? '▴' : '▾'}</span>
      </button>

      {!open ? null : (
        <div className={css.body}>
          <div className={css.row}>
            <span className={css.rowLabel}>{t('designer.presetLabel')}</span>
            <Menu
              value={chosenValue}
              options={presetOptions}
              onSelect={(value) => {
                if (value === CUSTOM_OPTION) {
                  actions.startCustom()
                  return
                }
                if (value.startsWith('template:')) {
                  const template = state.presetLibrary[value.slice('template:'.length)]
                  if (template !== undefined) actions.startCustom(template)
                  return
                }
                actions.selectPreset(value)
              }}
              disabled={!state.writable}
            />
          </div>

          <ol className={css.flow}>
            {flow.map((node, index) => (
              <LayerNode
                key={node.id}
                node={node}
                first={index === 0}
                preset={preset}
                draft={draft}
                custom={draft.custom}
                maxWidth={state.maxAgentsPerLayer}
                maxLayers={state.maxLayers}
                totalLayers={flow.length}
                library={Object.values(state.roleLibrary)}
                models={models}
                t={t}
                actions={actions}
              />
            ))}
          </ol>

          {!draft.custom ? null : (
            <CustomAddRow
              topology={draft.topology}
              maxLayers={state.maxLayers}
              t={t}
              actions={actions}
            />
          )}

          {draft.custom ? null : (
            <div className={css.row}>
              <span className={css.rowLabel}>{t('designer.quorum')}</span>
              {verifyNode === undefined ? (
                <span className={css.hint}>
                  {preset !== undefined && preset.layers.some(layer => layer.kind === 'verify')
                    && !draft.verifyEnabled ? t('designer.verifySkipped') : t('designer.noVerify')}
                </span>
              ) : (
                <>
                  <Menu
                    value={effectiveRule ?? 'majority'}
                    options={QUORUM_RULES.map(rule => ({
                      value: rule,
                      label: t(`quorumRule.${rule}` as CouncilKey),
                    }))}
                    onSelect={(value) => {
                      const rule = value as QuorumRule
                      if (rule === 'threshold') {
                        actions.setQuorum(rule, Math.max(1, Math.ceil(verifyWidth / 2)))
                      } else {
                        actions.setQuorum(rule)
                      }
                    }}
                    disabled={!state.writable}
                  />
                  {(effectiveRule ?? 'majority') !== 'threshold' ? null : (
                    <input
                      className={css.thresholdInput}
                      type="number"
                      min={1}
                      max={Math.max(1, verifyWidth)}
                      value={effectiveThreshold ?? ''}
                      disabled={!state.writable}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        if (Number.isInteger(next) && next >= 1) actions.setQuorum('threshold', next)
                      }}
                      aria-label={t('designer.threshold')}
                    />
                  )}
                  {effectiveRule !== 'threshold' ? null : (
                    <span className={css.hint}>
                      {t('designer.thresholdHint', { width: verifyWidth })}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {draft.custom && verifyNode === undefined
            && draft.topology.length > 0 ? (
            <p className={css.hint}>{t('designer.noVerifyHint')}</p>
          ) : null}

          {draft.custom && state.customError !== undefined ? (
            <p className={css.warn} role="alert">
              {t('designer.customError', { error: t(`custom.${state.customError}` as CouncilKey) })}
            </p>
          ) : null}
          {state.widthViolations.length === 0 ? null : (
            <p className={css.warn} role="alert">
              {t('designer.widthExceeded', {
                preset: draft.custom ? t('designer.custom') : draft.presetId,
                layer: state.widthViolations[0]?.layerId ?? '',
                width: state.widthViolations[0]?.width ?? 0,
                max: state.widthViolations[0]?.max ?? 0,
              })}
            </p>
          )}
          {state.quorumViolation === undefined ? null : (
            <p className={css.warn} role="alert">
              {t('designer.thresholdInvalid', {
                threshold: state.quorumViolation.threshold,
                width: state.quorumViolation.width,
              })}
            </p>
          )}
          {state.error === '' ? null : <p className={css.warn} role="alert">{state.error}</p>}

          <div className={css.footer}>
            <span className={css.summary}>{summaryOf(flow)}</span>
            {draft.custom ? (
              <input
                className={css.nameInput}
                placeholder={t('designer.namePlaceholder')}
                value={draft.name}
                onChange={(event) => { actions.setName(event.target.value) }}
              />
            ) : null}
            <span className={css.spacer} />
            {draft.custom ? (
              <button
                type="button"
                className={css.ghost}
                disabled={!state.writable || state.customError !== undefined}
                onClick={() => { void actions.savePresetToLibrary() }}
              >
                {t('designer.savePreset')}
              </button>
            ) : null}
            <button
              type="button"
              className={css.ghost}
              title={canClear(state) ? undefined : t('designer.clearDisabledHint')}
              onClick={() => { void actions.clear() }}
              disabled={!state.writable || !canClear(state)}
            >
              {t('designer.clear')}
            </button>
            {state.dirty ? (
              <>
                <button type="button" className={css.ghost} onClick={() => { actions.discard() }}>
                  {t('designer.discard')}
                </button>
                <button
                  type="button"
                  className={css.primary}
                  onClick={() => { actions.save() }}
                  disabled={!state.writable || state.widthViolations.length > 0
                    || state.quorumViolation !== undefined
                    || state.customError !== undefined}
                >
                  {t('designer.save')}
                </button>
              </>
            ) : null}
          </div>

          <RoleLibrary
            library={Object.values(state.roleLibrary)}
            presetLibrary={Object.values(state.presetLibrary)}
            t={t}
            actions={actions}
          />
        </div>
      )}
    </div>
  )
}

/** One-line layer summary for the footer. */
function summaryOf(flow: readonly FlowNode[]): string {
  return flow.map(node => `${node.kind} ${node.roles.reduce((sum, role) => sum + role.count, 0)}`).join(' · ')
}

/** Whether "Let the model pick the preset" has anything to revert. */
function canClear(state: CouncilDesignState): boolean {
  // A stored setup, unsaved edits, or an active from-scratch custom council
  // all fix the session in some way; only a clean untouched default has
  // nothing to clear.
  return state.hasStored || state.dirty || state.draft.custom
}

/** Buttons for growing a custom topology (map / verify / reduce nodes). */
function CustomAddRow(props: {
  topology: readonly AuthoredLayer[]
  maxLayers: number
  t: L
  actions: ReturnType<SessionCouncilController['actions']>
}) {
  const { topology, maxLayers, t, actions } = props
  const hasVerify = topology.some(layer => layer.kind === 'verify')
  const hasReduce = topology.some(layer => layer.kind === 'reduce')
  const taken = new Set(topology.map(layer => layer.id))
  const make = (kind: LayerKind, label: string): AuthoredLayer => {
    const id = mintId(label, taken)
    return kind === 'reduce'
      ? { id, kind, label: id, roles: [{ id: 'synthesizer', label: 'Synthesizer', prompt: t('custom.reduceSeed') }] }
      : { id, kind, label: id, roles: [], ...kind === 'verify' ? { quorum: { rule: 'majority' as const } } : {} }
  }
  return (
    <div className={css.row}>
      <span className={css.rowLabel}>{t('designer.nodes')}</span>
      <button
        type="button"
        className={css.addButton}
        disabled={topology.length >= maxLayers}
        onClick={() => { actions.addCustomNode(make('map', t('custom.mapNode'))) }}
      >
        {t('custom.addMap')}
      </button>
      <button
        type="button"
        className={css.addButton}
        disabled={hasVerify}
        onClick={() => { actions.addCustomNode(make('verify', t('custom.verifyNode'))) }}
      >
        {t('custom.addVerify')}
      </button>
      <button
        type="button"
        className={css.addButton}
        disabled={hasReduce}
        onClick={() => { actions.addCustomNode(make('reduce', t('custom.reduceNode'))) }}
      >
        {t('custom.addReduce')}
      </button>
    </div>
  )
}

interface LayerNodeProps {
  readonly node: FlowNode
  readonly first: boolean
  readonly preset: TopologyPreset | undefined
  readonly draft: CouncilDraft
  readonly custom: boolean
  readonly maxWidth: number
  readonly maxLayers: number
  readonly totalLayers: number
  readonly library: readonly RoleTemplate[]
  readonly models?: ModelDirectoryLike
  readonly t: L
  readonly actions: ReturnType<SessionCouncilController['actions']>
}

/** One layer node of the DAG. */
function LayerNode({
  node, first, preset, draft, custom, maxWidth, maxLayers, totalLayers, library, models, t, actions,
}: LayerNodeProps) {
  const width = node.roles.reduce((sum, role) => sum + role.count, 0)
  const kindLabel = t(`kind.${node.kind}` as CouncilKey)
  const heading = node.authored ? `${node.label ?? node.id} · ${kindLabel}` : `${node.id} · ${kindLabel}`

  return (
    <li className={css.nodeWrap}>
      {!first ? <div className={css.arrow} aria-hidden="true">↓</div> : null}
      <fieldset className={css.node} data-kind={node.kind}>
        <legend className={css.nodeHead}>
          <span>{heading}</span>
          {node.kind === 'verify' && !custom ? (
            <button
              type="button"
              className={css.verifyToggle}
              role="switch"
              aria-checked={draft.verifyEnabled}
              onClick={() => { actions.setVerify(!draft.verifyEnabled) }}
              disabled={!maxWidth}
            >
              {draft.verifyEnabled ? t('designer.verifyOn') : t('designer.verifyOff')}
            </button>
          ) : null}
          <span className={css.nodeWidth}>{t('designer.members', { n: width })}</span>
          {node.authored ? (
            <button
              type="button"
              className={css.iconButton}
              aria-label={t('designer.removeLayer')}
              title={t('designer.removeLayer')}
              onClick={() => {
                if (custom) actions.removeCustomNode(node.id)
                else actions.removeAuthoredLayer(node.id)
              }}
            >
              ✕
            </button>
          ) : null}
        </legend>
        <div className={css.roles}>
          {node.roles.map((row) => {
            const sink = sinkFor(node, row, preset, draft, custom, actions)
            const editable = node.authored || row.prompt !== undefined
            return (
              <RoleRow
                key={row.key}
                row={row}
                kind={node.kind}
                sink={sink}
                editable={editable}
                maxWidth={maxWidth}
                models={models}
                t={t}
                onSaveRole={() => {
                  actions.saveRoleToLibrary({
                    id: row.roleId,
                    label: row.label === '' ? row.roleId : row.label,
                    prompt: row.prompt ?? '',
                    count: row.count,
                    provider: row.provider,
                    model: row.model,
                  })
                }}
                overridePrompt={editable ? undefined : (draft.roles[row.key]?.prompt ?? '')}
                onPromptOverride={editable ? undefined : (text) => { actions.setPrompt(row.key, text) }}
              />
            )
          })}
        </div>
        {node.kind === 'reduce' ? null : (
          <AddRoleMenu
            node={node}
            custom={custom}
            maxWidth={maxWidth}
            library={library}
            t={t}
            actions={actions}
          />
        )}
      </fieldset>
    </li>
  )
}

/** Build the mutation sink for one role row depending on its origin. */
function sinkFor(
  node: FlowNode,
  row: RoleRow,
  preset: TopologyPreset | undefined,
  draft: CouncilDraft,
  custom: boolean,
  actions: ReturnType<SessionCouncilController['actions']>,
) {
  const layerId = node.id
  const roleId = row.roleId
  const authored = node.authored || row.prompt !== undefined
  if (!authored) {
    return {
      count: (next: number) => actions.setCount(row.key, next),
      route: (provider: string, model: string) => actions.setRoutePair(row.key, provider, model),
      patch: (_patch: Partial<AuthoredRole>) => {},
      remove: () => {},
    }
  }
  if (custom) {
    return {
      count: (next: number) => actions.editCustomRole(layerId, roleId, { count: next }),
      route: (provider: string, model: string) => actions.editCustomRole(layerId, roleId, { provider, model }),
      patch: (patch: Partial<AuthoredRole>) => actions.editCustomRole(layerId, roleId, patch),
      remove: () => actions.removeCustomRole(layerId, roleId),
    }
  }
  const intoExtra = node.authored
  return {
    count: (next: number) => {
      if (intoExtra) actions.editLayerRole(layerId, roleId, { count: next })
      else actions.editRole(layerId, roleId, { count: next })
    },
    route: (provider: string, model: string) => {
      const patch = { provider, model }
      if (intoExtra) actions.editLayerRole(layerId, roleId, patch)
      else actions.editRole(layerId, roleId, patch)
    },
    patch: (patch: Partial<AuthoredRole>) => {
      if (intoExtra) actions.editLayerRole(layerId, roleId, patch)
      else actions.editRole(layerId, roleId, patch)
    },
    remove: () => {
      if (intoExtra) actions.removeLayerRole(layerId, roleId)
      else actions.removeRole(layerId, roleId)
    },
  }
}

/** The per-node "Add role" control: a new role, or one from My roles. */
function AddRoleMenu(props: {
  node: FlowNode
  custom: boolean
  maxWidth: number
  library: readonly RoleTemplate[]
  t: L
  actions: ReturnType<SessionCouncilController['actions']>
}) {
  const { node, custom, maxWidth, library, t, actions } = props
  const [open, setOpen] = useState(false)
  const add = (seed: AuthoredRole) => {
    if (custom) actions.addCustomRole(node.id, seed)
    else if (node.authored) actions.addLayerRole(node.id, seed)
    else actions.addRoleTo(node.id, seed)
  }
  const insertLibrary = (template: RoleTemplate) => {
    const label = template.label ?? template.id
    add({ id: mintId(label, new Set([...node.roles.map(r => r.roleId)])), label, prompt: template.prompt })
    setOpen(false)
  }
  const newRole = () => {
    add({ id: mintId(t('designer.newRole'), new Set(node.roles.map(r => r.roleId))), label: t('designer.newRole'), prompt: t('designer.promptSeed', { role: t('designer.newRole') }) })
    setOpen(false)
  }
  const options = [
    ...library.map(role => ({ value: role.id, label: `My roles: ${role.label ?? role.id}` })),
  ]
  return (
    <span className={css.pickerWrap}>
      <button type="button" className={css.addRoleButton} disabled={!maxWidth}
        onClick={() => { setOpen(!open) }}>
        {t('designer.addRole')}
      </button>
      {!open ? null : (
        <div className={css.pickerMenu} role="menu">
          <div className={css.menuList} role="listbox">
            <button type="button" className={css.menuItem} onClick={newRole}>
              {t('designer.newRoleItem')}
            </button>
            {options.length === 0 ? null : <div className={css.providerTitle}>{t('designer.myRoles')}</div>}
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                className={css.menuItem}
                onClick={() => {
                  const role = library.find(candidate => candidate.id === option.value)
                  if (role !== undefined) insertLibrary(role)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}

/** One role row with its mutation sink. */
function RoleRow(props: {
  row: RoleRow
  kind: LayerKind
  sink: { count(next: number): void; route(provider: string, model: string): void; patch(patch: Partial<AuthoredRole>): void; remove(): void }
  editable: boolean
  maxWidth: number
  models?: ModelDirectoryLike
  t: L
  onSaveRole: () => void
  /** Current prompt override for a DEFAULT (non-authored) role, if any. */
  overridePrompt?: string
  /** Commit a prompt override for a default role ('' reverts to composed). */
  onPromptOverride?: (text: string) => void
}) {
  const { row, kind, sink, editable, maxWidth, models, t, onSaveRole, overridePrompt, onPromptOverride } = props
  const [editing, setEditing] = useState(false)
  const label = row.label === '' ? row.roleId : row.label
  return (
    <div className={css.roleRow} data-role="">
      <span className={css.roleLabel} title={label}>{label}</span>
      {kind === 'reduce' ? (
        <span className={css.fixedOne} title={t('designer.singleInstance')}>1×</span>
      ) : (
        <CountStepper
          value={row.count}
          max={maxWidth}
          onCommit={sink.count}
          t={t}
        />
      )}
      <ModelPicker
        value={{ provider: row.provider, model: row.model }}
        models={models}
        onPick={({ provider, model }) => sink.route(provider, model)}
        disabled={!maxWidth}
        t={t}
      />
      {!editable ? (
        <span className={css.roleActions}>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('designer.editPrompt')}
            title={t('designer.editPrompt')}
            onClick={() => { setEditing(!editing) }}
          >
            ✎
          </button>
        </span>
      ) : (
        <span className={css.roleActions}>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('designer.edit')}
            title={t('designer.edit')}
            onClick={() => { setEditing(!editing) }}
          >
            ✎
          </button>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('designer.saveRole')}
            title={t('designer.saveRole')}
            onClick={onSaveRole}
          >
            💾
          </button>
          {kind === 'reduce' ? null : (
            <button
              type="button"
              className={css.iconButton}
              aria-label={t('designer.removeRole')}
              title={t('designer.removeRole')}
              onClick={sink.remove}
            >
              ✕
            </button>
          )}
        </span>
      )}
      {!editing ? null : editable ? (
        <AuthoredRoleForm
          initialLabel={row.label}
          initialPrompt={row.prompt ?? ''}
          onPatch={sink.patch}
          t={t}
        />
      ) : (
        <PromptTuneForm
          initial={overridePrompt ?? ''}
          onChange={onPromptOverride ?? (() => {})}
          t={t}
        />
      )}
    </div>
  )
}

/** The reusable library section at the bottom of the panel. */
function RoleLibrary(props: {
  library: readonly RoleTemplate[]
  presetLibrary: readonly PresetTemplate[]
  t: L
  actions: ReturnType<SessionCouncilController['actions']>
}) {
  const { library, presetLibrary, t, actions } = props
  const [openRoles, setOpenRoles] = useState(false)
  const [openPresets, setOpenPresets] = useState(false)
  return (
    <div className={css.library}>
      <button type="button" className={css.libraryHead} onClick={() => { setOpenRoles(!openRoles) }}>
        <span>{t('designer.myRoles', { n: library.length })}</span>
        <span className={css.chevron}>{openRoles ? '▴' : '▾'}</span>
      </button>
      {!openRoles ? null : (
        <div className={css.libraryBody}>
          {library.length === 0 ? <span className={css.hint}>{t('designer.noSavedRoles')}</span> : null}
          {library.map(role => (
            <span key={role.id} className={css.chip}>
              <span className={css.chipLabel} title={role.label ?? role.id}>{role.label ?? role.id}</span>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('designer.deleteRole')}
                onClick={() => { void actions.deleteRoleFromLibrary(role.id) }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <button type="button" className={css.libraryHead} onClick={() => { setOpenPresets(!openPresets) }}>
        <span>{t('designer.myPresets', { n: presetLibrary.length })}</span>
        <span className={css.chevron}>{openPresets ? '▴' : '▾'}</span>
      </button>
      {!openPresets ? null : (
        <div className={css.libraryBody}>
          {presetLibrary.length === 0 ? <span className={css.hint}>{t('designer.noSavedPresets')}</span> : null}
          {presetLibrary.map(template => (
            <span key={template.id} className={css.chip}>
              <span className={css.chipLabel} title={template.label}>★ {template.label}</span>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('designer.deletePreset')}
                onClick={() => { void actions.deletePresetFromLibrary(template.id) }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** A minus/count/plus stepper that clamps into `1..max`. */
function CountStepper(props: { value: number; max: number; onCommit: (count: number) => void; t: L }) {
  const { value, max, onCommit, t } = props
  const up = () => { if (value < max) onCommit(value + 1) }
  const down = () => { if (value > 1) onCommit(value - 1) }
  return (
    <span className={css.stepper}>
      <button type="button" className={css.step} onClick={down} disabled={value <= 1} aria-label={t('designer.decrement')}>
        −
      </button>
      <span className={css.count}>{value}</span>
      <button type="button" className={css.step} onClick={up} disabled={value >= max} aria-label={t('designer.increment')}>
        +
      </button>
    </span>
  )
}

/** The single model picker: searchable provider groups from the session catalog. */
function ModelPicker(props: {
  value: ModelRoute
  models?: ModelDirectoryLike
  onPick: (route: ModelRoute) => void
  disabled: boolean
  t: L
}) {
  const { value, models, onPick, disabled, t } = props
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const directory = models

  useEffect(() => {
    if (!open || directory === undefined) return
    const state = directory.store.getSnapshot()
    if (state.status === 'loading') return
    void directory.load().catch(() => {})
  }, [open, directory])

  const snapshot = directory?.store.getSnapshot()
  const groups = snapshot?.groups ?? []
  const label = value.provider === '' || value.model === ''
    ? t('designer.inherit')
    : `${value.provider} · ${value.model}`

  const close = useCallback(() => { setOpen(false); setQuery('') }, [])
  const q = query.trim().toLowerCase()
  const shown = q === ''
    ? groups.map(group => ({ group, models: group.models }))
    : groups
        .map(group => ({
          group,
          models: group.models.filter(model =>
            model.id.toLowerCase().includes(q)
            || model.name.toLowerCase().includes(q)
            || group.name.toLowerCase().includes(q)),
        }))
        .filter(entry => entry.models.length > 0)

  return (
    <span className={css.pickerWrap}>
      <button
        type="button"
        className={css.pickerTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        disabled={disabled}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.pickerLabel}>{label}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" className={css.chevronIcon} aria-hidden="true">
          <path d="M3.6 5.4L7 8.8l3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!open ? null : (
        <div className={css.pickerMenu} role="menu">
          <input
            className={css.search}
            autoFocus
            placeholder={t('designer.search')}
            value={query}
            onChange={(event) => { setQuery(event.target.value) }}
            onKeyDown={(event) => { if (event.key === 'Escape') close() }}
          />
          <div className={css.menuList} role="listbox">
            <button
              type="button"
              role="option"
              aria-selected={value.provider === '' && value.model === ''}
              className={css.menuItem}
              onClick={() => { onPick({ provider: '', model: '' }); close() }}
            >
              {t('designer.inherit')}
            </button>
            {shown.map(entry => (
              <div className={css.providerGroup} key={entry.group.id}>
                <div className={css.providerTitle}>{entry.group.name}</div>
                {entry.models.map(model => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={value.provider === entry.group.id && value.model === model.id}
                    key={model.id}
                    className={css.menuItem}
                    onClick={() => { onPick({ provider: entry.group.id, model: model.id }); close() }}
                  >
                    <span className={css.modelName}>{model.name}</span>
                    <span className={css.modelId}>{model.id}</span>
                  </button>
                ))}
              </div>
            ))}
            {shown.length === 0 ? <div className={css.menuEmpty}>{t('designer.noModels')}</div> : null}
          </div>
        </div>
      )}
    </span>
  )
}

/** A styled select-like popover for preset/quorum pickers. */
function Menu(props: {
  value: string
  options: readonly { value: string; label: string }[]
  onSelect: (value: string) => void
  disabled: boolean
}) {
  const { value, options, onSelect, disabled } = props
  const [open, setOpen] = useState(false)
  const current = options.find(option => option.value === value)?.label ?? value
  return (
    <span className={css.pickerWrap}>
      <button
        type="button"
        className={css.pickerTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.pickerLabel}>{current}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" className={css.chevronIcon} aria-hidden="true">
          <path d="M3.6 5.4L7 8.8l3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!open ? null : (
        <div className={css.pickerMenu} role="menu">
          <div className={css.menuList} role="listbox">
            {options.map(option => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                key={option.value}
                className={css.menuItem}
                onClick={() => { onSelect(option.value); setOpen(false) }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}

/** Inline editor for an authored role: label + lens prompt. */
function AuthoredRoleForm(props: {
  initialLabel: string
  initialPrompt: string
  onPatch: (patch: Partial<AuthoredRole>) => void
  t: L
}) {
  const { initialLabel, initialPrompt, onPatch, t } = props
  const [label, setLabel] = useState(initialLabel)
  const [prompt, setPrompt] = useState(initialPrompt)
  return (
    <div className={css.authForm}>
      <input
        className={css.textInput}
        value={label}
        placeholder={t('designer.roleLabel')}
        onChange={(event) => { setLabel(event.target.value); onPatch({ label: event.target.value }) }}
      />
      <textarea
        className={css.promptInput}
        rows={6}
        value={prompt}
        placeholder={t('designer.promptSeed', { role: label })}
        onChange={(event) => { setPrompt(event.target.value); onPatch({ prompt: event.target.value }) }}
      />
    </div>
  )
}

/** Prompt override editor for an EXISTING (default) role; empty reverts. */
function PromptTuneForm(props: {
  initial: string
  onChange: (text: string) => void
  t: L
}) {
  const { initial, onChange, t } = props
  const [value, setValue] = useState(initial)
  return (
    <div className={css.authForm}>
      <textarea
        className={css.promptInput}
        rows={6}
        value={value}
        placeholder={t('designer.promptTunePlaceholder')}
        onChange={(event) => { setValue(event.target.value); onChange(event.target.value) }}
      />
      <span className={css.hint}>{t('designer.promptTuneHint')}</span>
    </div>
  )
}

/**
 * Register the council designer in the composer dock.
 * @param ctx - the browser plugin context.
 * @param scope - the bound `council` settings scope the designer reads and writes.
 */
export function registerCouncilDesigner(ctx: ClientContext, scope: SettingsScope<CouncilSettings>): void {
  // Optional seam: the model directory the harness composes
  // (ui-model-selection) feeds the per-role model menu.
  const rawCtx = ctx as unknown as { get?(name: string): unknown }
  const resolver = typeof rawCtx.get === 'function'
    ? rawCtx.get('modelDirectories') as { directoryFor(sessionId: string): ModelDirectoryLike } | undefined
    : undefined
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: COUNCIL_DESIGNER_SLOT_ID,
    order: 0,
    locale: NS,
    inject: () => ({
      scope,
      ...resolver === undefined ? {} : { modelDirectories: resolver },
    }),
  }, CouncilDesigner))
}
