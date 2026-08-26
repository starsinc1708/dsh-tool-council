/**
 * The council settings card: a preset picker, then that preset's layers as
 * rows of roles with an editable instance count and model route, plus the
 * quorum control on a verify layer.
 *
 * The card draws the deployment's real topology, which it reads from the
 * section's read-only `topology` mirror — so a composition that replaced the
 * shipped presets renders correctly without this plugin knowing anything about
 * them.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { QuorumRule } from '@deepseek-ai/dsh-tool-council/types'
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
  setQuorum: (layerId: string, rule: QuorumRule, threshold?: number) => void
  resetPreset: () => void
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

/**
 * Render the card.
 * @param props - the runtime kit, the locale binder, and the injected face.
 * @returns the settings card element.
 */
export function CouncilCard(props: CouncilCardProps) {
  const { t } = props
  const state = props.useCouncilCard(snapshot => snapshot)
  if (state.status !== 'ready') return <div className={css.empty}>{t(`status.${state.status}` as CouncilKey)}</div>

  const preset = state.presets.find(candidate => candidate.id === state.selected)
  const override = state.overrides[state.selected]
  const disabled = !state.writable
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
        <h3>{t('title')}</h3>
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
                    <span className={css.roleName}>
                      {role.label}
                      {roleOverride === undefined ? null : <em className={css.badge}>{t('overridden')}</em>}
                    </span>
                    <label>
                      <span>{t('count')}</span>
                      <input
                        type="number"
                        min={1}
                        max={16}
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
                    <label>
                      <span>{t('model')}</span>
                      <input
                        type="text"
                        placeholder={t('modelInherit')}
                        disabled={disabled}
                        value={roleOverride?.model ?? role.model}
                        onChange={(event) => { props.setRoleModel(layer.id, role.id, event.target.value) }}
                      />
                    </label>
                  </div>
                )
              })}

              {layer.quorumRule === undefined ? null : (
                <div className={css.role}>
                  <span className={css.roleName}>{t('quorum')}</span>
                  <select
                    disabled={disabled}
                    value={override?.quorums?.[layer.id]?.rule ?? layer.quorumRule}
                    onChange={(event) => { props.setQuorum(layer.id, event.target.value as QuorumRule) }}
                  >
                    {QUORUM_RULES.map(rule => (
                      <option key={rule} value={rule}>{t(`quorumRule.${rule}` as CouncilKey)}</option>
                    ))}
                  </select>
                  {(override?.quorums?.[layer.id]?.rule ?? layer.quorumRule) !== 'threshold' ? null : (
                    <label>
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
              )}
            </fieldset>
          ))}
        </div>
      )}

      {state.error === '' ? null : <p className={css.error} role="alert">{state.error}</p>}

      <footer className={css.foot}>
        <button type="button" disabled={disabled} onClick={() => { props.resetPreset() }}>
          {t('resetPreset')}
        </button>
        <span className={css.spacer} />
        <button type="button" disabled={!state.dirty} onClick={() => { props.discard() }}>
          {t('discard')}
        </button>
        <button type="button" disabled={!state.dirty || disabled} onClick={() => { props.save() }}>
          {t('save')}
        </button>
      </footer>
    </section>
  )
}
