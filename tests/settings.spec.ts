/**
 * Tests for the settings overlay: the composition mirror the card draws from,
 * and the overlay the tool applies on every call. `applyOverrides` is the one
 * place a user preference reaches a live topology, so what it refuses matters
 * as much as what it applies — an overlay must never be able to change a
 * topology, only its widths, routes and quorum.
 */

import { describe, expect, it } from 'vitest'
import { applyOverrides, toTopology } from '../src/settings.ts'
import { BUILTIN_PRESETS } from '../src/presets.ts'
import { resolveConfig } from '../src/policy.ts'
import type { PresetConfig } from '../src/types.ts'

const preset: PresetConfig = {
  id: 'bug-hunt',
  label: 'Bug hunt',
  description: 'find defects',
  framing: 'you are a council member',
  layers: [
    {
      id: 'map',
      kind: 'map',
      roles: [
        { id: 'correctness', label: 'Correctness', prompt: 'lens one', count: 2 },
        { id: 'tests', prompt: 'lens two', model: 'composed-model' },
      ],
    },
    {
      id: 'verify',
      kind: 'verify',
      quorum: { rule: 'majority' },
      roles: [{ id: 'V1', label: 'Replicator', prompt: 'verify', count: 3 }],
    },
    { id: 'reduce', kind: 'reduce', roles: [{ id: 'synthesizer', prompt: 'write it' }] },
  ],
}

describe('toTopology', () => {
  it('projects labels, widths and routes, defaulting what the composition left out', () => {
    const [mirrored] = toTopology([preset])
    expect(mirrored?.label).toBe('Bug hunt')
    expect(mirrored?.layers[0]?.roles).toEqual([
      { id: 'correctness', label: 'Correctness', count: 2, model: '', provider: '' },
      // Absent label falls back to the id; absent route becomes '', which is
      // what the card renders as "inherit".
      { id: 'tests', label: 'tests', count: 1, model: 'composed-model', provider: '' },
    ])
  })

  it('carries the quorum only where a layer declares one', () => {
    const [mirrored] = toTopology([preset])
    expect(mirrored?.layers[0]?.quorumRule).toBeUndefined()
    expect(mirrored?.layers[1]?.quorumRule).toBe('majority')
    expect(mirrored?.layers[1]?.quorumThreshold).toBeUndefined()
  })

  it('never leaks a prompt or the framing into the browser mirror', () => {
    const serialized = JSON.stringify(toTopology(BUILTIN_PRESETS))
    expect(serialized).not.toContain('lens')
    expect(serialized).not.toContain('MAP_CONTRACT')
    for (const shipped of BUILTIN_PRESETS) {
      for (const layer of shipped.layers) {
        for (const role of layer.roles) expect(serialized).not.toContain(role.prompt.slice(0, 40))
      }
    }
  })
})

describe('applyOverrides', () => {
  it('returns the presets untouched when there is no overlay', () => {
    expect(applyOverrides([preset], undefined)).toEqual([preset])
    expect(applyOverrides([preset], {})).toEqual([preset])
  })

  it('applies width, model and provider to the named role only', () => {
    const [overlaid] = applyOverrides([preset], {
      'bug-hunt': { roles: { 'map.correctness': { count: 5, model: 'routed', provider: 'codex' } } },
    })
    expect(overlaid?.layers[0]?.roles[0]).toMatchObject({ count: 5, model: 'routed', provider: 'codex' })
    expect(overlaid?.layers[0]?.roles[1]?.count).toBeUndefined()
  })

  it('treats an empty route as inherit rather than as an override', () => {
    const [overlaid] = applyOverrides([preset], {
      'bug-hunt': { roles: { 'map.tests': { model: '', provider: '' } } },
    })
    // The composed model survives; '' must not overwrite it with nothing.
    expect(overlaid?.layers[0]?.roles[1]?.model).toBe('composed-model')
  })

  it('overrides a quorum rule and threshold, keeping what the overlay omits', () => {
    const [overlaid] = applyOverrides([preset], {
      'bug-hunt': { quorums: { verify: { rule: 'threshold', threshold: 2 } } },
    })
    expect(overlaid?.layers[1]?.quorum).toEqual({ rule: 'threshold', threshold: 2 })

    const [ruleOnly] = applyOverrides([preset], { 'bug-hunt': { quorums: { verify: { rule: 'unanimous' } } } })
    expect(ruleOnly?.layers[1]?.quorum).toEqual({ rule: 'unanimous' })
  })

  it('ignores a quorum aimed at a layer that has none', () => {
    const [overlaid] = applyOverrides([preset], {
      'bug-hunt': { quorums: { map: { rule: 'unanimous' } } },
    })
    // A quorum on a map layer is a topology change, and resolveConfig refuses
    // one — so the overlay must not be able to introduce it either.
    expect(overlaid?.layers[0]?.quorum).toBeUndefined()
  })

  it('ignores stale preset, layer and role keys instead of refusing the document', () => {
    const [overlaid] = applyOverrides([preset], {
      'gone-preset': { roles: { 'map.correctness': { count: 9 } } },
      'bug-hunt': { roles: { 'gone-layer.role': { count: 9 }, 'map.gone-role': { count: 9 } } },
    })
    // A user document has to survive a composition that dropped a role.
    expect(overlaid?.layers[0]?.roles[0]?.count).toBe(2)
  })

  it('cannot add, remove or reorder a layer or a role', () => {
    const [overlaid] = applyOverrides([preset], {
      'bug-hunt': { roles: { 'map.correctness': { count: 5 } }, quorums: { verify: { rule: 'unanimous' } } },
    })
    expect(overlaid?.layers.map(layer => layer.id)).toEqual(['map', 'verify', 'reduce'])
    expect(overlaid?.layers.map(layer => layer.kind)).toEqual(['map', 'verify', 'reduce'])
    expect(overlaid?.layers[0]?.roles.map(role => role.id)).toEqual(['correctness', 'tests'])
    expect(overlaid?.framing).toBe(preset.framing)
  })

  it('produces presets the deployment policy still accepts, or refuses at the write', () => {
    const widened = applyOverrides([preset], { 'bug-hunt': { roles: { 'map.correctness': { count: 4 } } } })
    expect(() => resolveConfig({ presets: widened, defaultPreset: 'bug-hunt' })).not.toThrow()

    const overWide = applyOverrides([preset], { 'bug-hunt': { roles: { 'map.correctness': { count: 40 } } } })
    expect(() => resolveConfig({ presets: overWide, defaultPreset: 'bug-hunt', maxAgentsPerLayer: 12 }))
      .toThrow('exceeds maxAgentsPerLayer')

    const badThreshold = applyOverrides([preset], {
      'bug-hunt': { quorums: { verify: { rule: 'threshold', threshold: 9 } } },
    })
    expect(() => resolveConfig({ presets: badThreshold, defaultPreset: 'bug-hunt' }))
      .toThrow('threshold between 1 and its width')
  })
})
