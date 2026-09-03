/**
 * Council surfaces, browser half.
 *
 * Two seats, both keyed to the `council` settings namespace the always-
 * composed host row serves:
 *
 *  - the composer-dock **designer** (per-session council setup) — the only
 *    configuration surface left by design, because a council is configured
 *    where it runs, at the start of a Map-Reduce session, not in Settings;
 *  - the **Council conversation view** that renders each finished run as a
 *    graph, verdict table and report.
 *
 * There is deliberately NO Settings → Plugins card anymore: the deployment's
 * topologies are the designer's palette, and the old global overlay was the
 * one thing this plugin let you set that no session could undo.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { CouncilKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Council designer and graph-view copy. */
        council: CouncilKey;
    }
}
/**
 * Required services: slot registry, locale, the settings-scope binder, session
 * token reads for the graph tab, and `workspaces` for opening a finding's file.
 */
export declare const inject: string[];
/**
 * Contribute the composer-dock council designer and the council graph view.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
