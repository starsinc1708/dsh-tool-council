/**
 * The council settings card: a preset picker, then that preset's layers as
 * rows of roles with an editable instance count, model route, and provider
 * route, plus the quorum control on a verify layer and a JSON transfer for the
 * whole overlay.
 *
 * The card draws the deployment's real topology, which it reads from the
 * section's read-only `topology` mirror — so a composition that replaced the
 * shipped presets renders correctly without this plugin knowing anything about
 * them. It bounds the width input against the mirrored `maxAgentsPerLayer` and
 * refuses an over-wide save itself, because the Host's refusal arrives as a raw
 * TypeError after the fact.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import { useState } from 'react'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { QuorumRule } from '@starsinc1708/dsh-tool-council/types'
import type { CouncilCardState } from './controller.ts'
import type { CouncilKey } from './locales.ts'
import css from './CouncilCard.module.css'

/** Everything the slot's `inject` factory hands the card. */
export interface CouncilCardFace {
  hooks: { councilCard: HostObservable<CouncilCardState> }
  selectPreset: (presetId: string) => void
  setDefaultPreset: (presetId: string) => void
  setRoleCount: (layerId: string, roleId: string, count: number) => void
  setRoleModel: (layerId: string, roleId: string, model: string) => void
  setRoleProvider: (layerId: string, roleId: string, provider: string) => void
  setCostRate: (rate: number) => void
  revertRole: (layerId: string, roleId: string) => void
  setQuorum: (layerId: string, rule: QuorumRule, threshold?: number) => void
  resetPreset: () => void
  exportOverrides: () => string
  importOverrides: (text: string) => boolean
  discard: () => void
  save: () => void
}

/**
 * Props the renderer binds for the council card. The `hooks` compartment is
 * bound by the framework into `useCouncilCard` (see {@link InjectFace}); the
 * actions pass through verbatim.
 */
export type CouncilCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'council'>
  & InjectFace<CouncilCardFace>

const QUORUM_RULES: readonly QuorumRule[] = ['majority', 'unanimous', 'threshold']

/** Element ids for the two suggestion lists the route inputs read. */
const MODEL_LIST_ID = 'council-models'
const PROVIDER_LIST_ID = 'council-providers'

/**
 * Ask before an import throws away staged work.
 * @param message - the question to put to the viewer.
 * @returns true when the import may proceed.
 */
function confirmOverwrite(message: string): boolean {
  // A host without `confirm` (a non-browser test renderer) must not be blocked
  // out of the feature; it simply proceeds, as it did before the guard existed.
  return typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(message)
}

/**
 * Hand the viewer a file. Mirrors the Council tab's exporter, which lives in a
 * different module: a value import across client plugin files is fine, but this
 * card must not depend on the conversation view.
 * @param name - suggested file name.
 * @param text - the JSON document.
 * @returns whether the download could be started.
 */
function downloadText(name: string, text: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.rel = 'noopener'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => { URL.revokeObjectURL(url) }, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Every distinct route already named somewhere in the deployment.
 *
 * There is no catalogue the settings plane can reach: the subagent registry is
 * not published on the host plane at composition time, so a mirror of it would
 * be empty by construction. The suggestions are therefore what this deployment
 * already uses — the composition's own routes plus anything the user staged.
 * Free text stays free: a `datalist` suggests, a `<select>` would silently hide
 * every valid id nobody listed.
 * @param state - the card's current snapshot.
 * @param field - which route to collect.
 * @returns the distinct values, sorted, with the empty one dropped.
 */
export function routeSuggestions(state: CouncilCardState, field: 'model' | 'provider'): string[] {
  const seen = new Set<string>()
  for (const preset of state.presets) {
    for (const layer of preset.layers) {
      for (const role of layer.roles) {
        seen.add(role[field])
        seen.add(state.overrides[preset.id]?.roles?.[`${layer.id}.${role.id}`]?.[field] ?? '')
      }
    }
  }
  seen.delete('')
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/**
 * Render the card.
 * @param props - the runtime kit, the locale binder, and the injected face.
 * @returns the settings card element.
 */
export function CouncilCard(props: CouncilCardProps) {
  const { t } = props
  const state = props.useCouncilCard(snapshot => snapshot)
  const [transfer, setTransfer] = useState('')
  const [transferNote, setTransferNote] = useState('')
  if (state.status !== 'ready') return <div className={css.empty}>{t(`status.${state.status}` as CouncilKey)}</div>

  const preset = state.presets.find(candidate => candidate.id === state.selected)
  const override = state.overrides[state.selected]
  const disabled = !state.writable
  const blocked = state.widthViolations.length > 0 || state.quorumViolations.length > 0
  const widthCeiling = state.maxAgentsPerLayer > 0 ? state.maxAgentsPerLayer : undefined
  const width = (layerId: string) => {
    const layer = preset?.layers.find(candidate => candidate.id === layerId)
    return layer?.roles.reduce(
      (sum, role) => sum + (override?.roles?.[`${layerId}.${role.id}`]?.count ?? role.count),
      0,
    ) ?? 0
  }

  return (
    <section className={css.card}>
      <header className={css.head}>
        <div className={css.headRow}>
          <h3>{t('title')}</h3>
          {/* The badge, not the browser's unload dialog, is the signal a viewer
              actually sees while working. */}
          {state.dirty ? <em className={css.dirty}>{t('unsaved')}</em> : null}
        </div>
        <p className={css.hint}>{t('description')}</p>
      </header>

      <label className={css.row}>
        <span>{t('defaultPreset')}</span>
        <select
          value={state.defaultPreset}
          disabled={disabled}
          onChange={(event) => { props.setDefaultPreset(event.target.value) }}
        >
          {state.presets.map(candidate => (
            <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
          ))}
        </select>
      </label>

      <nav className={css.tabs}>
        {state.presets.map(candidate => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidate.id === state.selected}
            className={candidate.id === state.selected ? css.tabSelected : css.tab}
            onClick={() => { props.selectPreset(candidate.id) }}
          >
            {candidate.label}
          </button>
        ))}
      </nav>

      {preset === undefined ? null : (
        <div className={css.layers}>
          <p className={css.hint}>{preset.description}</p>
          <p className={css.total}>{t('totalAgents', { n: state.totalAgents })}</p>
          {preset.layers.map(layer => (
            <fieldset key={layer.id} className={css.layer}>
              <legend>
                {layer.id} · {t(`kind.${layer.kind}` as CouncilKey)} · {t('width', { n: width(layer.id) })}
              </legend>

              {layer.roles.map((role) => {
                const key = `${layer.id}.${role.id}`
                const roleOverride = override?.roles?.[key]
                return (
                  <div key={role.id} className={css.role}>
                    <div className={css.roleName}>
                      <span className={css.roleLabel}>{role.label}</span>
                      {roleOverride === undefined ? null : (
                        <>
                          <em className={css.badge}>{t('overridden')}</em>
                          <button
                            type="button"
                            className={css.revert}
                            disabled={disabled}
                            onClick={() => { props.revertRole(layer.id, role.id) }}
                          >
                            {t('revert')}
                          </button>
                        </>
                      )}
                    </div>
                    {/* One grid, three columns: the fields line up down the
                        whole layer instead of wrapping differently per role. */}
                    <div className={css.roleFields}>
                      <label className={css.field}>
                        <span>{t('count')}</span>
                        <input
                          type="number"
                          min={1}
                          max={widthCeiling}
                          disabled={disabled || layer.kind === 'reduce'}
                          value={roleOverride?.count ?? role.count}
                          onChange={(event) => {
                            const next = Number(event.target.value)
                            if (Number.isSafeInteger(next) && next >= 1) {
                              props.setRoleCount(layer.id, role.id, next)
                            }
                          }}
                        />
                      </label>
                      <label className={css.field}>
                        <span>{t('model')}</span>
                        {/* A datalist, never a select: the catalogue is advisory
                            and a closed list would hide every valid custom id. */}
                        <input
                          type="text"
                          list={`${MODEL_LIST_ID}-${state.selected}`}
                          placeholder={t('modelInherit')}
                          disabled={disabled}
                          value={roleOverride?.model ?? role.model}
                          onChange={(event) => { props.setRoleModel(layer.id, role.id, event.target.value) }}
                        />
                      </label>
                      <label className={css.field}>
                        <span>{t('provider')}</span>
                        <input
                          type="text"
                          list={PROVIDER_LIST_ID}
                          placeholder={t('providerInherit')}
                          disabled={disabled}
                          value={roleOverride?.provider ?? role.provider}
                          onChange={(event) => { props.setRoleProvider(layer.id, role.id, event.target.value) }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}

              {layer.quorumRule === undefined ? null : (
                <div className={css.role}>
                  <div className={css.roleName}>
                    <span className={css.roleLabel}>{t('quorum')}</span>
                  </div>
                  <div className={css.roleFields}>
                    <label className={css.fieldWide}>
                      <span>{t('quorum')}</span>
                      <select
                        disabled={disabled}
                        value={override?.quorums?.[layer.id]?.rule ?? layer.quorumRule}
                        onChange={(event) => { props.setQuorum(layer.id, event.target.value as QuorumRule) }}
                      >
                        {QUORUM_RULES.map(rule => (
                          <option key={rule} value={rule}>{t(`quorumRule.${rule}` as CouncilKey)}</option>
                        ))}
                      </select>
                    </label>
                    {(override?.quorums?.[layer.id]?.rule ?? layer.quorumRule) !== 'threshold' ? null : (
                      <label className={css.field}>
                        <span>{t('threshold')}</span>
                        <input
                          type="number"
                          min={1}
                          max={width(layer.id)}
                          disabled={disabled}
                          value={override?.quorums?.[layer.id]?.threshold ?? layer.quorumThreshold ?? width(layer.id)}
                          onChange={(event) => {
                            props.setQuorum(layer.id, 'threshold', Number(event.target.value))
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </fieldset>
          ))}
        </div>
      )}

      <datalist id={`${MODEL_LIST_ID}-${state.selected}`}>
        {routeSuggestions(state, 'model').map(value => <option key={value} value={value} />)}
      </datalist>
      <datalist id={PROVIDER_LIST_ID}>
        {routeSuggestions(state, 'provider').map(value => <option key={value} value={value} />)}
      </datalist>

      <label className={css.row}>
        <span>{t('costRate')}</span>
        <input
          type="number"
          min={0}
          step={0.01}
          className={css.costInput}
          disabled={disabled}
          value={state.costPerMillionTokens}
          onChange={(event) => { props.setCostRate(Number(event.target.value)) }}
        />
      </label>
      <p className={css.hint}>{t('costHint')}</p>

      <details className={css.transfer}>
        <summary>{t('transfer')}</summary>
        <textarea
          className={css.transferBox}
          rows={6}
          spellCheck={false}
          value={transfer}
          onChange={(event) => { setTransfer(event.target.value); setTransferNote('') }}
        />
        <div className={css.transferRow}>
          <button
            type="button"
            onClick={() => {
              const text = props.exportOverrides()
              setTransfer(text)
              setTransferNote('')
              const write = navigator.clipboard?.writeText(text)
              if (write === undefined) { setTransferNote(t('copyFailed')); return }
              void write.then(() => { setTransferNote(t('copied')) }, () => { setTransferNote(t('copyFailed')) })
            }}
          >
            {t('export')}
          </button>
          <button
            type="button"
            onClick={() => {
              const text = props.exportOverrides()
              setTransfer(text)
              setTransferNote(downloadText('council-overrides.json', text) ? '' : t('copyFailed'))
            }}
          >
            {t('download')}
          </button>
          <button
            type="button"
            disabled={disabled || transfer.trim() === ''}
            onClick={() => {
              // Import replaces the WHOLE staged map, so unsaved work would go
              // without a word. Ask first, and only when there is something to lose.
              if (state.dirty && !confirmOverwrite(t('importConfirm'))) return
              setTransferNote(props.importOverrides(transfer) ? '' : t('importInvalid'))
            }}
          >
            {t('import')}
          </button>
          {transferNote === '' ? null : <span className={css.transferNote}>{transferNote}</span>}
        </div>
      </details>

      {state.widthViolations.map(violation => (
        <p key={`${violation.presetId}.${violation.layerId}`} className={css.error} role="alert">
          {t('widthExceeded', {
            preset: violation.presetId,
            layer: violation.layerId,
            width: violation.width,
            max: violation.max,
          })}
        </p>
      ))}
      {state.quorumViolations.map(violation => (
        <p key={`${violation.presetId}.${violation.layerId}`} className={css.error} role="alert">
          {t('thresholdInvalid', {
            preset: violation.presetId,
            layer: violation.layerId,
            threshold: violation.threshold,
            width: violation.width,
          })}
        </p>
      ))}
      {blocked ? <p className={css.error}>{t('saveBlocked')}</p> : null}
      {state.error === '' ? null : <p className={css.error} role="alert">{state.error}</p>}

      <footer className={css.foot}>
        <button type="button" disabled={disabled} onClick={() => { props.resetPreset() }}>
          {t('resetPreset')}
        </button>
        <span className={css.spacer} />
        <button type="button" disabled={!state.dirty} onClick={() => { props.discard() }}>
          {t('discard')}
        </button>
        <button type="button" disabled={!state.dirty || disabled || blocked} onClick={() => { props.save() }}>
          {t('save')}
        </button>
      </footer>
    </section>
  )
}
