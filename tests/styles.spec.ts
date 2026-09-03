/**
 * Guards the two stylesheets against the failure mode CSS modules make silent:
 * `css.typo` is `undefined`, React renders `class="undefined"`, and the element
 * simply loses its styling with no error anywhere. Nothing else in the suite can
 * see that, because the components are never rendered.
 *
 * Also the reverse direction: a class nobody references is dead weight, and
 * usually the leftover of a rename that half-landed.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Class names a stylesheet defines. */
function definedClasses(cssPath: string): Set<string> {
  const source = readFileSync(cssPath, 'utf8')
  // Strip declaration blocks so `.dot[data-status='x']` inside a value cannot
  // be mistaken for a selector.
  const selectors = source.replace(/\{[^}]*\}/gu, ' ')
  return new Set([...selectors.matchAll(/\.([A-Za-z][\w-]*)/gu)].map(match => match[1] as string))
}

/** Class names a component reads off its imported stylesheet. */
function referencedClasses(tsxPath: string): Set<string> {
  const source = readFileSync(tsxPath, 'utf8')
  return new Set([...source.matchAll(/\bcss\.([A-Za-z][\w$]*)/gu)].map(match => match[1] as string))
}

const PAIRS: ReadonlyArray<{ readonly name: string; readonly tsx: string; readonly css: string }> = [
  {
    name: 'council-view',
    tsx: 'src/client/council-view.tsx',
    css: 'src/client/council-view.module.css',
  },
  {
    name: 'session-council',
    tsx: 'src/client/session-council.tsx',
    css: 'src/client/session-council.module.css',
  },
]

describe.each(PAIRS)('$name stylesheet', ({ tsx, css }) => {
  const defined = definedClasses(css)
  const referenced = referencedClasses(tsx)

  it('defines every class the component references', () => {
    const missing = [...referenced].filter(name => !defined.has(name)).sort()
    expect(missing, `undefined in ${css}`).toEqual([])
  })

  it('references every class it defines', () => {
    const unused = [...defined].filter(name => !referenced.has(name)).sort()
    expect(unused, `unused in ${css}`).toEqual([])
  })
})
