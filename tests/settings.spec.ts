/**
 * Tests for the per-session council setup: the mirrored topology the designer
 * draws from, and the composition the tool applies on every call.
 * `applySessionSetup` is the one place a session's preference reaches a live
 * topology, so what it refuses matters as much as what it applies — a setup
 * must never be able to change a topology, only widths, routes, the verify
 * layer's presence, and its quorum.
 */

import { describe, expect, it } from 'vitest'
import {
  MAX_ROLE_WIDTH, applySessionSetup, layerDropped, sessionQuorumViolation, sessionWidthViolations,
  toTopology, tunedCount,
} from '../src/settings.ts'
import { BUILTIN_PRESETS } from '../src/presets.ts'
import { resolveConfig } from '../src/policy.ts'
import type { PresetConfig } from '../src/types.ts'
import type { SessionCouncilSetup } from '../src/settings.ts'

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

const noVerify: PresetConfig = {
  ...preset,
  id: 'research',
  layers: [
    {
      id: 'map',
      kind: 'map',
      roles: [{ id: 'prior-art', prompt: 'find prior work' }],
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
      // what the designer renders as "inherit".
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

describe('tunedCount', () => {
  it('keeps the composed width without a tune', () => {
    expect(tunedCount(2, undefined)).toBe(2)
    expect(tunedCount(undefined, undefined)).toBe(1)
  })

  it('treats an out-of-range count as absent rather than as a request', () => {
    for (const bad of [0, -1, 1.5, MAX_ROLE_WIDTH + 1]) {
      expect(tunedCount(2, { count: bad })).toBe(2)
    }
  })
})

describe('layerDropped', () => {
  it('drops only the verify layer, and only when verifyEnabled is false', () => {
    expect(layerDropped('map', undefined)).toBe(false)
    expect(layerDropped('verify', undefined)).toBe(false)
    expect(layerDropped('verify', { presetId: 'bug-hunt', verifyEnabled: false })).toBe(true)
    expect(layerDropped('verify', { presetId: 'bug-hunt', verifyEnabled: true })).toBe(false)
    expect(layerDropped('map', { presetId: 'bug-hunt', verifyEnabled: false })).toBe(false)
  })
})

describe('applySessionSetup', () => {
  it('returns the preset untouched without a setup', () => {
    expect(applySessionSetup(preset, undefined, 100)).toBe(preset)
  })

  it('applies absolute counts and routes to the named roles only', () => {
    const setup: SessionCouncilSetup = {
      presetId: 'bug-hunt',
      roles: {
        'map.correctness': { count: 5, model: 'routed', provider: 'codex' },
      },
    }
    const composed = applySessionSetup(preset, setup, 100)
    expect(composed.layers[0]?.roles[0]).toMatchObject({ count: 5, model: 'routed', provider: 'codex' })
    // Untouched role keeps its composed model and its implicit (absent) width.
    expect(composed.layers[0]?.roles[1]).toMatchObject({ model: 'composed-model' })
    expect(composed.layers[0]?.roles[1]?.count).toBeUndefined()
    expect(composed.layers[1]?.roles[0]?.count).toBe(3)
  })

  it('drops the verify layer when verifyEnabled is false', () => {
    const composed = applySessionSetup(preset, { presetId: 'bug-hunt', verifyEnabled: false }, 100)
    expect(composed.layers.map(layer => layer.kind)).toEqual(['map', 'reduce'])
  })

  it('restates the quorum only when the session overrides it', () => {
    const majority = applySessionSetup(preset, {
      presetId: 'bug-hunt',
      roles: { 'verify.V1': { count: 4 } },
      quorum: { rule: 'threshold', threshold: 2 },
    }, 100)
    expect(majority.layers[1]?.quorum).toEqual({ rule: 'threshold', threshold: 2 })

    const unchanged = applySessionSetup(preset, {
      presetId: 'bug-hunt',
      quorum: { rule: 'majority' },
    }, 100)
    expect(unchanged.layers[1]?.quorum).toEqual({ rule: 'majority' })
  })

  it('refuses a setup that would push a layer past the ceiling', () => {
    // map width after the tune: 5 + 1 = 6; ceiling 5 refuses, 6 accepts.
    const setup: SessionCouncilSetup = { presetId: 'bug-hunt', roles: { 'map.correctness': { count: 5 } } }
    expect(() => applySessionSetup(preset, setup, 5)).toThrow(/at most 5 per layer/)
    expect(() => applySessionSetup(preset, setup, 6)).not.toThrow()
  })

  it('refuses a threshold its own width cannot reach', () => {
    const setup: SessionCouncilSetup = {
      presetId: 'bug-hunt',
      roles: { 'verify.V1': { count: 2 } },
      quorum: { rule: 'threshold', threshold: 3 },
    }
    expect(() => applySessionSetup(preset, setup, 100)).toThrow(/threshold between 1 and its width 2/)
  })

  it('refuses a setup that tries to widen the reduce role', () => {
    const setup: SessionCouncilSetup = { presetId: 'bug-hunt', roles: { 'reduce.synthesizer': { count: 3 } } }
    expect(() => applySessionSetup(preset, setup, 100)).toThrow(/exactly one instance/)
  })

  it('ignores stale role keys and presets with no verify stay valid', () => {
    const composed = applySessionSetup(preset, {
      presetId: 'bug-hunt',
      roles: { 'map.gone-role': { count: 9 }, 'verify.V1': { count: 4 } },
    }, 100)
    expect(composed.layers[0]?.roles.map(role => role.count)).toEqual([2, undefined])
    expect(composed.layers[1]?.roles[0]?.count).toBe(4)

    // verifyEnabled: false on a preset that has no verify layer is a no-op.
    const research = applySessionSetup(noVerify, { presetId: 'research', verifyEnabled: false }, 100)
    expect(research.layers.map(layer => layer.kind)).toEqual(['map', 'reduce'])
  })

  it('produces presets the deployment policy still accepts', () => {
    const composed = applySessionSetup(preset, {
      presetId: 'bug-hunt',
      roles: { 'map.correctness': { count: 4 } },
      quorum: { rule: 'threshold', threshold: 2 },
    }, 100)
    expect(() => resolveConfig({ presets: [composed], defaultPreset: 'bug-hunt' })).not.toThrow()
  })

  it('appends authored roles and inserts authored map layers in DAG order', () => {
    const composed = applySessionSetup(preset, {
      presetId: 'bug-hunt',
      addRoles: {
        map: [
          { id: 'data-flow', label: 'Data flow', prompt: 'trace the data', count: 2 },
        ],
        verify: [{ id: 'V4', label: 'Fourth', prompt: 'double-check' }],
      },
      addLayers: [
        { id: 'map-2', label: 'Second pass', roles: [{ id: 'logs', label: 'Logs', prompt: 'read the logs' }] },
      ],
    }, 100)
    expect(composed.layers.map(layer => layer.id)).toEqual(['map', 'map-2', 'verify', 'reduce'])
    expect(composed.layers[0]?.roles.map(role => role.id)).toEqual(['correctness', 'tests', 'data-flow'])
    expect(composed.layers[1]?.kind).toBe('map')
    expect(composed.layers[2]?.roles.map(role => role.id)).toEqual(['V1', 'V4'])
    // The authored composition is fully validatable: unique ids, prompts,
    // layer ordering and the quorum all hold.
    expect(() => resolveConfig({ presets: [composed], defaultPreset: 'bug-hunt' })).not.toThrow()
  })

  it('drops authored verify roles together with the verify layer', () => {
    const composed = applySessionSetup(preset, {
      presetId: 'bug-hunt',
      verifyEnabled: false,
      addRoles: { verify: [{ id: 'V9', label: 'Nine', prompt: 'vote' }] },
    }, 100)
    expect(composed.layers.map(layer => layer.id)).toEqual(['map', 'reduce'])
  })

  it('validates an authored topology like a composed one (duplicate id refused)', () => {
    const composed = applySessionSetup(preset, {
      presetId: 'bug-hunt',
      addRoles: { map: [{ id: 'correctness', label: 'Copy', prompt: 'same id' }] },
    }, 100)
    expect(() => resolveConfig({ presets: [composed], defaultPreset: 'bug-hunt' }))
      .toThrow(/duplicate role id/)
  })
})

describe('mirror-side validation', () => {
  const mirrored = toTopology([preset])[0]
  if (mirrored === undefined) throw new Error('fixture')

  it('finds layers a setup would push past the ceiling', () => {
    expect(sessionWidthViolations(mirrored, undefined, 100)).toEqual([])
    const violations = sessionWidthViolations(mirrored, {
      presetId: 'bug-hunt',
      roles: { 'map.correctness': { count: 40 } },
    }, 12)
    expect(violations).toEqual([
      { layerId: 'map', width: 41, max: 12 },
    ])
    // Dropped layers never violate.
    expect(sessionWidthViolations(mirrored, { presetId: 'bug-hunt', verifyEnabled: false }, 2)).toEqual([
      { layerId: 'map', width: 3, max: 2 },
    ])
  })

  it('matches the host refusal for an unreachable threshold', () => {
    expect(sessionQuorumViolation(mirrored, undefined)).toBeUndefined()
    expect(sessionQuorumViolation(mirrored, {
      presetId: 'bug-hunt',
      roles: { 'verify.V1': { count: 2 } },
      quorum: { rule: 'threshold', threshold: 3 },
    })).toEqual({ rule: 'threshold', threshold: 3, width: 2 })
    expect(sessionQuorumViolation(mirrored, {
      presetId: 'bug-hunt',
      roles: { 'verify.V1': { count: 4 } },
      quorum: { rule: 'threshold', threshold: 3 },
    })).toBeUndefined()
  })
})
