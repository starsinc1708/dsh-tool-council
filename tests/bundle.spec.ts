/**
 * Guards the browser bundle's import discipline.
 *
 * The client build externalizes every bare specifier (`deps: { neverBundle }`),
 * and the loader's module table answers only a small set of seed words. A VALUE
 * import of anything else compiles, bundles, and then fails at load with:
 *
 *   client-modules: require("…") missed the module table — not a platform seed
 *   word, not a materialized module, and no registered package factory
 *
 * Type-only imports are erased before the bundle exists and are unrestricted;
 * value imports must be relative so they inline. Nothing else in the suite can
 * see the difference, because both compile identically.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Specifiers the loader's module table can answer.
 *
 * The harness's own shared table plus the CSS-module runtime; see the README's
 * Development section. Anything outside this set has to be inlined.
 */
const SEED_WORDS: ReadonlySet<string> = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
])

/** Every file under `src/client`. */
function clientSources(): string[] {
  const dir = 'src/client'
  return readdirSync(dir)
    .filter(name => name.endsWith('.ts') || name.endsWith('.tsx'))
    .map(name => join(dir, name))
}

/**
 * Bare specifiers a source file imports as VALUES.
 *
 * `import type …` and `import { type X }` are erased, so only statements that
 * survive to runtime count.
 * @param file - path to a client source file.
 * @returns the non-relative specifiers whose bindings reach the bundle.
 */
function valueImports(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const out: string[] = []
  for (const match of source.matchAll(/^import\s+([\s\S]*?)from\s+'([^']+)'/gmu)) {
    const clause = match[1] as string
    const specifier = match[2] as string
    if (specifier.startsWith('.')) continue
    // `import type { … } from` and the bare side-effect/type form.
    if (/^\s*type\s/u.test(clause)) continue
    if (/^\s*\{\s*\}\s*$/u.test(clause)) continue
    // A clause whose every named binding is `type X` is erased too.
    const named = clause.match(/\{([\s\S]*)\}/u)?.[1]
    if (named !== undefined && named.trim() !== ''
      && named.split(',').every(part => part.trim() === '' || /^type\s/u.test(part.trim()))) continue
    out.push(specifier)
  }
  return out
}

describe('client source imports', () => {
  it('imports values only from relative paths or the loader seed words', () => {
    const offenders: string[] = []
    for (const file of clientSources()) {
      for (const specifier of valueImports(file)) {
        if (!SEED_WORDS.has(specifier)) offenders.push(`${file}: ${specifier}`)
      }
    }
    expect(offenders, 'these would fail at load with "missed the module table"').toEqual([])
  })

  it('finds the value imports it is meant to police', () => {
    // Without this the check above could pass by simply matching nothing.
    const found = clientSources().flatMap(valueImports)
    expect(found.length).toBeGreaterThan(0)
    expect(found).toContain('react')
  })
})

describe('built client bundle', () => {
  const bundle = 'lib/client.js'

  it.runIf(existsSync(bundle))('requires nothing outside the loader seed words', () => {
    const source = readFileSync(bundle, 'utf8')
    const required = [...source.matchAll(/require\(\s*"([^"]+)"\s*\)/gu)].map(match => match[1] as string)
    expect(required.length).toBeGreaterThan(0)
    const missing = [...new Set(required)].filter(specifier => !SEED_WORDS.has(specifier))
    expect(missing, 'the loader cannot answer these').toEqual([])
  })

  it.runIf(existsSync(bundle))('is the lazy-CJS factory artifact the loader consumes', () => {
    const source = readFileSync(bundle, 'utf8')
    expect(source).toContain('__ModuleLoader__')
    expect(source).toContain('@starsinc1708/dsh-tool-council')
  })

  it.runIf(existsSync(bundle))('registers the settings card when driven like the real loader', () => {
    // The end-to-end proof: evaluate the SHIPPED artifact through the loader
    // protocol, resolve its requires from the seed table only, and apply it.
    // A missing card in Settings -> Plugins is exactly a missing `council` key
    // here, and the require shim below fails loudly on a module-table miss.
    const loaded = loadBundle(readFileSync(bundle, 'utf8'))
    expect(loaded.id).toBe('@starsinc1708/dsh-tool-council')
    expect(loaded.exports.inject).toEqual(expect.arrayContaining(['slots', 'locale', 'settingsScope', 'sessions']))

    const registered: Array<{ name: string; key: string }> = []
    loaded.exports.apply(stubClientContext(registered))
    // The plugins tab shows a namespace only when a card is registered under
    // its key AND the host serves it; this is the half this package owns.
    expect(registered).toContainEqual({ name: 'settings.plugin.item', key: 'council' })
    expect(registered).toContainEqual({ name: 'conversation.view', key: 'council' })
  })
})

/** The loader's seed modules, reduced to what the bundle actually touches. */
function seedModule(id: string): unknown {
  if (id === 'react') {
    return {
      useState: (initial: unknown) => [initial, () => {}],
      useCallback: (fn: unknown) => fn,
      useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
    }
  }
  if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' }
  throw new Error(`missed the module table: ${id}`)
}

/**
 * Evaluate the built bundle the way `window.__ModuleLoader__` does.
 * @param source - the bundle text.
 * @returns the registered module id and its exports.
 */
function loadBundle(source: string): { id: string; exports: { apply: (ctx: unknown) => void; inject: string[] } } {
  let registered: { id: string; factory: (require: (id: string) => unknown) => never } | undefined
  const doc = {
    createElement: () => ({ dataset: {} as Record<string, string>, setAttribute: () => {}, textContent: '' }),
    head: { appendChild: () => {} },
    querySelector: () => null,
    body: { append: () => {}, appendChild: () => {} },
  }
  const win = {
    __ModuleLoader__: { load: (module: typeof registered) => { registered = module } },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  // eslint-disable-next-line no-new-func -- evaluating the artifact IS the test.
  new Function('window', 'document', source)(win, doc)
  if (registered === undefined) throw new Error('the bundle registered no module')
  return { id: registered.id, exports: registered.factory(seedModule) as never }
}

/** A ClientContext stub that records what the plugin registers. */
function stubClientContext(registered: Array<{ name: string; key: string }>): unknown {
  const scope = {
    getSnapshot: () => ({
      status: 'ready', value: { defaultPreset: 'bug-hunt', topology: [], overrides: {} },
      base: undefined, user: undefined, revision: 1, writable: true, mode: 'host',
    }),
    subscribe: () => () => {},
    set: async () => {},
    unset: async () => {},
  }
  return {
    effect: (run: () => unknown) => run(),
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    settingsScope: { bind: () => scope },
    sessions: { binding: () => undefined },
    workspaces: { openPath: async () => {} },
    slots: {
      inject: (_name: string, run: () => unknown) => run(),
      register: (spec: { name: string; key?: string; id?: string }) => {
        registered.push({ name: spec.name, key: spec.key ?? spec.id ?? '' })
        return () => {}
      },
    },
  }
}
