/**
 * Smoke test for the browser plugin's `apply`.
 *
 * A throw here removes the settings card and the Council tab from the UI with
 * no compile error and no failing unit test anywhere else — the same class of
 * silent breakage as the session-event and module-table regressions. This
 * drives `apply` against a stub ClientContext and asserts it registers what it
 * promises.
 */

import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'

/** What the stub context recorded during one `apply`. */
interface Recorded {
  readonly slots: string[]
  readonly slotKeys: string[]
  readonly locales: string[]
  readonly effects: string[]
  readonly bound: string[]
}

function stubContext(overrides: Record<string, unknown> = {}) {
  const recorded: Recorded = { slots: [], slotKeys: [], locales: [], effects: [], bound: [] }
  const scope = {
    getSnapshot: () => ({
      status: 'ready' as const,
      value: { defaultPreset: 'bug-hunt', topology: [], overrides: {} },
      base: undefined,
      user: undefined,
      revision: 1,
      writable: true,
      mode: 'host' as const,
    }),
    subscribe: () => () => {},
    set: async () => {},
    unset: async () => {},
  }
  const ctx = {
    effect: (run: () => unknown, label?: string) => { recorded.effects.push(label ?? ''); return run() },
    locale: {
      register: (ns: string) => { recorded.locales.push(ns); return () => {} },
      bind: () => (key: string) => key,
    },
    settingsScope: {
      bind: (spec: { namespace: string }) => { recorded.bound.push(spec.namespace); return scope },
    },
    slots: {
      inject: (_name: string, run: () => unknown) => run(),
      register: (spec: { name: string; key?: string; id?: string }) => {
        recorded.slots.push(spec.name)
        recorded.slotKeys.push(spec.key ?? spec.id ?? '')
        return () => {}
      },
    },
    sessions: { binding: () => undefined },
    workspaces: { openPath: async () => {} },
    ...overrides,
  }
  return { ctx, recorded }
}

describe('client apply', () => {
  it('registers the composer-dock designer and the Council view without throwing', () => {
    const { ctx, recorded } = stubContext()
    expect(() => { apply(ctx as never) }).not.toThrow()

    // The council is configured in the composer dock (per Map-Reduce session),
    // NOT in Settings -> Plugins — a Settings card would be a regression here.
    expect(recorded.slots).not.toContain('settings.plugin.item')
    // The designer and the results tab both ride conversation seats; a
    // registration throw removes them from every Map-Reduce session with no
    // other signal.
    expect(recorded.slots).toContain('conversation.input.dock')
    expect(recorded.slotKeys).toContain('council-design')
    expect(recorded.slots).toContain('conversation.view')
    expect(recorded.locales).toContain('council')
    expect(recorded.bound).toContain('council')
  })

  it('declares every service it actually uses', () => {
    // A service used but not injected is undefined at apply time; a service
    // injected but unused keeps a dependency the deployment must satisfy.
    // `get` is the cordis Context API for OPTIONAL service lookups (the model
    // directory seam), not an injectable service — same exemption as `then`.
    const used = new Set<string>()
    const { ctx } = stubContext()
    const probe = new Proxy(ctx as Record<string, unknown>, {
      get(target, key: string) {
        if (typeof key === 'string' && key !== 'effect' && key !== 'get') used.add(key)
        return target[key]
      },
    })
    apply(probe as never)
    const declared = new Set(inject)
    const undeclared = [...used].filter(name => !declared.has(name) && name !== 'then')
    expect(undeclared, 'used but not declared in `inject`').toEqual([])
  })
})
