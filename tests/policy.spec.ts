/**
 * Tests for the deployment-policy validation that schemastery cannot express:
 * a trailing reduce layer only, at most one verify layer, and a threshold
 * between 1 and its layer's width — plus the threshold-default contract the
 * script and the host must share.
 */

import { describe, expect, it } from 'vitest'
import { expandLayers, resolveConfig, totalAgentBudget } from '../src/policy.ts'
import type { LayerConfig, PresetConfig } from '../src/types.ts'

function layer(id: string, kind: LayerConfig['kind'], extra: Partial<LayerConfig> = {}): LayerConfig {
  return { id, kind, roles: [{ id: `${id}-r`, prompt: 'p' }], ...extra }
}

function preset(layers: LayerConfig[]): PresetConfig {
  return { id: 'x', description: 'd', layers }
}

const valid = (): PresetConfig => preset([
  layer('map', 'map'),
  layer('verify', 'verify', { quorum: { rule: 'majority' as const } }),
  layer('reduce', 'reduce'),
])

describe('resolveConfig structural rules', () => {
  it('accepts a well-formed preset', () => {
    expect(() => resolveConfig({ presets: [valid()], defaultPreset: 'x' })).not.toThrow()
  })

  it('rejects a reduce layer that is not last', () => {
    const p = preset([
      layer('r1', 'reduce'),
      layer('map', 'map'),
      layer('r2', 'reduce'),
    ])
    expect(() => resolveConfig({ presets: [p] })).toThrow('only the last layer may be a reduce layer')
  })

  it('rejects more than one verify layer', () => {
    const p = preset([
      layer('map', 'map'),
      layer('v1', 'verify', { quorum: { rule: 'majority' as const } }),
      layer('v2', 'verify', { quorum: { rule: 'majority' as const } }),
      layer('reduce', 'reduce'),
    ])
    expect(() => resolveConfig({ presets: [p] })).toThrow('at most one verify layer')
  })

  it('rejects a map layer after the verify layer', () => {
    // Every map layer re-clusters and renumbers f1…fn, so ballots cast before
    // it would name ids that no longer exist — and the host would only notice
    // at the very end, after every child had been paid for.
    const p = preset([
      layer('map', 'map'),
      layer('verify', 'verify', { quorum: { rule: 'majority' as const } }),
      layer('more', 'map'),
      layer('reduce', 'reduce'),
    ])
    expect(() => resolveConfig({ presets: [p] })).toThrow('a map layer may not follow the verify layer')
  })

  it('rejects a role id reused on another layer of the same preset', () => {
    // expandLayers derives the instance id from the role id alone, so a reuse
    // collapses two members into one for the per-member cap and for reportedBy.
    const p = preset([
      { id: 'map', kind: 'map', roles: [{ id: 'shared', prompt: 'p' }] },
      { id: 'second', kind: 'map', roles: [{ id: 'shared', prompt: 'p' }] },
      layer('reduce', 'reduce'),
    ])
    expect(() => resolveConfig({ presets: [p] })).toThrow('duplicate role id "shared"')
  })

  it('accepts every shipped preset', () => {
    expect(() => resolveConfig({})).not.toThrow()
  })

  it('rejects a threshold below 1', () => {
    const p = preset([
      layer('map', 'map'),
      layer('verify', 'verify', { quorum: { rule: 'threshold' as const, threshold: 0 } }),
      layer('reduce', 'reduce'),
    ])
    expect(() => resolveConfig({ presets: [p] })).toThrow('threshold between 1 and its width')
  })
})

describe('expandLayers threshold default', () => {
  it('leaves a missing threshold undefined so the script defaults to the ballot count', () => {
    const p = preset([
      layer('map', 'map'),
      layer('verify', 'verify', { quorum: { rule: 'threshold' as const } }),
      layer('reduce', 'reduce'),
    ])
    const verify = expandLayers(p).find(entry => entry.kind === 'verify')
    expect(verify?.quorumThreshold).toBeUndefined()
  })

  it('carries an explicit threshold through', () => {
    const p = preset([
      layer('map', 'map'),
      layer('verify', 'verify', { quorum: { rule: 'threshold' as const, threshold: 2 } }),
      layer('reduce', 'reduce'),
    ])
    const verify = expandLayers(p).find(entry => entry.kind === 'verify')
    expect(verify?.quorumThreshold).toBe(2)
  })
})

describe('run ceilings', () => {
  it('exposes the ceilings the script and the settings card both read', () => {
    const resolved = resolveConfig({ presets: [valid()], defaultPreset: 'x' })
    expect(resolved.maxAgentsPerLayer).toBe(12)
    expect(resolved.maxFindingsPerMember).toBe(50)
    expect(resolved.maxRunMs).toBe(0)
    expect(resolved.retryFailedMembers).toBe(true)
    expect(resolved.mergeSameLocation).toBe(true)
    // The mandate is what Map-Reduce mode IS, so it stays on by default.
    expect(resolved.councilEveryRequest).toBe(true)
    expect(resolveConfig({ presets: [valid()], defaultPreset: 'x', councilEveryRequest: false })
      .councilEveryRequest).toBe(false)
  })

  it('leaves room for one retry per member and for the merge child', () => {
    const layers = expandLayers(valid())
    expect(layers.reduce((sum, entry) => sum + entry.instances.length, 0)).toBe(3)
    // A tripped AGENT_CAP kills the run, so the ceiling has to cover everything
    // the script may legitimately spend — not only its first attempt.
    expect(totalAgentBudget(layers, { retryFailedMembers: true, mergeSameLocation: true })).toBe(8)
    expect(totalAgentBudget(layers, { retryFailedMembers: false, mergeSameLocation: true })).toBe(4)
    expect(totalAgentBudget(layers, { retryFailedMembers: false, mergeSameLocation: false })).toBe(3)
  })

  it('allows exactly one merge child however many map layers there are', () => {
    // The script clusters once, at the LAST map layer, so a second map layer
    // costs its own members and nothing else.
    const layers = expandLayers(preset([
      layer('map1', 'map'),
      layer('map2', 'map'),
      layer('reduce', 'reduce'),
    ]))
    expect(totalAgentBudget(layers, { retryFailedMembers: false, mergeSameLocation: true })).toBe(4)
  })
})
