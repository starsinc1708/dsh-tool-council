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
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { CouncilKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Council settings-card and graph-view copy. */
        council: CouncilKey;
    }
}
/** Required services: card slot, graph view slot, log node, session token reads, locale. */
export declare const inject: string[];
/**
 * Contribute the council settings card and the council graph conversation view.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
