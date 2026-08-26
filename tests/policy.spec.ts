/**
 * Tests for the deployment-policy validation that schemastery cannot express:
 * a trailing reduce layer only, at most one verify layer, and a threshold
 * between 1 and its layer's width — plus the threshold-default contract the
 * script and the host must share.
 */

import { describe, expect, it } from 'vitest'
import { expandLayers, resolveConfig } from '../src/policy.ts'
import type { LayerConfig, PresetConfig } from '../src/types.ts'

function layer(id: string, kind: LayerConfig['kind'], extra: Partial<LayerConfig> = {}): LayerConfig {
  return { id, kind, roles: [{ id: 'r', prompt: 'p' }], ...extra }
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
