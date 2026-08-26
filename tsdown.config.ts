/**
 * Build config for @starsinc1708/dsh-tool-council.
 *
 * Two passes:
 *   1. host — four ESM entries (`index`, `tool`, `types`, `invariant`) bundled
 *      from `src/`, externalizing every npm dependency and Node builtin. The
 *      `.d.ts` tree is produced separately by `tsc -p tsconfig.json`.
 *   2. client — the browser settings card, bundled into the `__ModuleLoader__`
 *      lazy-CJS format the client module system consumes
 *      (`window.__ModuleLoader__.load({ id, factory })`). The id is the bare
 *      package name, because the loader serves a package's browser bundle only
 *      under its own name.
 *
 * CSS modules are handled here (Lightning-free): each `*.module.css` import
 * becomes a deterministic class-name map plus a one-shot `<style>` injection,
 * matching the shape the harness's own bundles emit.
 */

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, resolve } from 'node:path'
import type { Plugin } from 'rolldown'
import type { UserConfig } from 'tsdown'

const PACKAGE_NAME = '@starsinc1708/dsh-tool-council'

const EXTERNAL_DEPS = { neverBundle: true } as const

/** Short deterministic class-name hash, stable per (file, class). */
function hashClass(fileId: string, className: string): string {
  return createHash('sha1').update(fileId).update('\u0000').update(className).digest('hex').slice(0, 6)
}

/**
 * Turn a `*.module.css` import into a JS module: inject the rewritten CSS once
 * and export the `{ original: hashed }` map the card's `css.foo` references.
 */
function cssModulesPlugin(): Plugin {
  return {
    name: 'dsh-css-modules',
    resolveId(source: string, importer?: string) {
      if (!source.endsWith('.module.css')) return null
      // Resolve to a virtual id ending in `.mjs` so tsdown's css-guard (which
      // rejects any id ending in `.css` unless @tsdown/css is installed) never
      // sees the file.
      const absolute = resolve(importer === undefined ? process.cwd() : dirname(importer), source)
      return `\u0000dsh-css:${absolute}.mjs`
    },
    async load(id: string) {
      if (!id.startsWith('\u0000dsh-css:')) return null
      const file = id.slice('\u0000dsh-css:'.length, -'.mjs'.length)
      const css = readFileSync(file, 'utf8')
      const classMap = new Map<string, string>()
      const rewritten = css.replace(/\.(-?[_a-zA-Z][\w-]*)/g, (_match, className: string) => {
        const existing = classMap.get(className)
        if (existing !== undefined) return `.${existing}`
        const hashed = `dshc_${hashClass(file, className)}`
        classMap.set(className, hashed)
        return `.${hashed}`
      })
      const tagId = `${PACKAGE_NAME}/${basename(file)}`
      const exportsJson = JSON.stringify(Object.fromEntries(classMap))
      return [
        `const css = ${JSON.stringify(rewritten)};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        `if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {`,
        `  const tag = document.createElement("style");`,
        `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_NAME)};`,
        `  tag.dataset.pluginCss = tagId;`,
        `  tag.textContent = css;`,
        `  document.head.appendChild(tag);`,
        `}`,
        `export default ${exportsJson};`,
      ].join('\n')
    },
  }
}

/**
 * The `window.__ModuleLoader__.load({...})` opening. The `var module` /
 * `var exports` intro lives here; the `Object.defineProperty(exports,
 * Symbol.toStringTag, …)` line is added by rolldown's CJS output itself, so it
 * is deliberately absent to avoid a duplicate.
 */
const MODULE_LOADER_BANNER = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(PACKAGE_NAME)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
].join('\n')

const MODULE_LOADER_FOOTER = [
  '\t\treturn module.exports;',
  '\t}',
  '});',
].join('\n')

/**
 * One host entry per build: a single-entry build bundles every local module it
 * reaches into a self-contained `lib/<name>.js`, matching the harness's own
 * output (no shared chunks). A multi-entry build would split the shared
 * policy/settings modules into hashed chunks.
 */
function hostEntry(name: string, source: string): UserConfig {
  return {
    name: `host-${name}`,
    entry: { [name]: source },
    format: 'esm',
    platform: 'node',
    outDir: 'lib',
    fixedExtension: false,
    clean: false,
    dts: false,
    sourcemap: false,
    deps: EXTERNAL_DEPS,
  }
}

const clientBuild: UserConfig = {
  name: 'client',
  entry: { client: 'src/client/index.ts' },
  format: 'cjs',
  platform: 'browser',
  outDir: 'lib',
  fixedExtension: false,
  outExtensions: () => ({ js: '.js' }),
  clean: false,
  dts: false,
  sourcemap: false,
  deps: EXTERNAL_DEPS,
  banner: MODULE_LOADER_BANNER,
  footer: MODULE_LOADER_FOOTER,
  plugins: [cssModulesPlugin()],
}

export default [
  hostEntry('index', 'src/index.ts'),
  hostEntry('tool', 'src/tool.ts'),
  hostEntry('types', 'src/types.ts'),
  hostEntry('invariant', 'src/invariant.ts'),
  clientBuild,
]
