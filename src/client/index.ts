/**
 * Council settings card, browser half.
 *
 * The card joins the "Plugin configuration" tab through the keyed
 * `settings.plugin.item` slot: that tab dispatches one slot key per settings
 * namespace the Host serves, so a deployment that does not mount
 * `@deepseek-ai/dsh-tool-council` renders nothing here and no repository file
 * needs editing to add the card.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { CouncilSettings } from '@deepseek-ai/dsh-tool-council/types'
// Type-only: the keyed slot's declaration and the `locale` service's Context
// augmentation. A value import across client plugins fails the purity gate.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'

import { CouncilCard } from './CouncilCard.tsx'
import type { CouncilCardFace } from './CouncilCard.tsx'
import { CouncilCardController } from './controller.ts'
import { NS, en, zh } from './locales.ts'
import type { CouncilKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Council settings-card copy. */
    council: CouncilKey
  }
}

/** Required services for the card registration, its scope, and its copy. */
export const inject = ['slots', 'locale', 'connection', 'settingsScope']

/**
 * Contribute the council card to the plugin-configuration tab.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-council: dictionaries')

  const controller = new CouncilCardController(
    ctx.settingsScope.bind<CouncilSettings>({ namespace: 'council' }),
  )
  const face = (): CouncilCardFace => ({
    hooks: { councilCard: controller.store() },
    ...controller.actions(),
  })

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'council',
    locale: NS,
    inject: face,
  }, CouncilCard))
}
