/**
 * Tests for the settings card's staged-form controller: the override pruning
 * that keeps a cleared route from sticking as an override, the per-role revert,
 * the pre-save width check the Host would otherwise refuse after the fact, and
 * the JSON transfer's round trip.
 */

import { describe, expect, it } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import {
  CouncilCardController, quorumViolations, readOverridesDocument, widthViolations,
} from '../src/client/controller.ts'
import type { CouncilSettings, PresetOverride, TopologyPreset } from '../src/settings.ts'

const TOPOLOGY: TopologyPreset[] = [{
  id: 'bug-hunt',
  label: 'Bug hunt',
  description: 'find defects',
  layers: [
    {
      id: 'map',
      kind: 'map',
      roles: [
        { id: 'correctness', label: 'Correctness', count: 1, model: '', provider: '' },
        { id: 'tests', label: 'Tests', count: 1, model: '', provider: '' },
      ],
    },
    {
      id: 'verify',
      kind: 'verify',
      quorumRule: 'majority',
      roles: [{ id: 'V1', label: 'Replicator', count: 3, model: '', provider: '' }],
    },
    {
      id: 'reduce',
      kind: 'reduce',
      roles: [{ id: 'synthesizer', label: 'Synthesizer', count: 1, model: '', provider: '' }],
    },
  ],
}]

/** A settings scope that records writes and can be told to refuse them. */
class FakeScope implements SettingsScope<CouncilSettings> {
  readonly writes: Array<{ field: string; value: unknown }> = []
  rejection: Error | undefined
  private listeners = new Set<() => void>()
  private snapshot: SettingsScopeSnapshot<CouncilSettings>

  constructor(value: CouncilSettings) {
    this.snapshot = {
      status: 'ready', value, base: undefined, user: undefined,
      revision: 1, writable: true, mode: 'host',
    }
  }

  getSnapshot(): SettingsScopeSnapshot<CouncilSettings> {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set(field: string, value: unknown): Promise<void> {
    if (this.rejection !== undefined) throw this.rejection
    this.writes.push({ field, value })
    this.snapshot = { ...this.snapshot, value: { ...this.snapshot.value, [field]: value } }
    for (const listener of this.listeners) listener()
  }

  async unset(field: string): Promise<void> {
    await this.set(field, undefined)
  }
}

function controller(overrides: Record<string, PresetOverride> = {}, maxAgentsPerLayer = 12) {
  const scope = new FakeScope({
    defaultPreset: 'bug-hunt',
    topology: TOPOLOGY,
    maxAgentsPerLayer,
    agentPresetId: 'map-reduce',
    overrides,
  })
  const card = new CouncilCardController(scope)
  return { scope, card, actions: card.actions(), store: card.store() }
}

describe('CouncilCardController override pruning', () => {
  it('drops the model key when the field is cleared, taking the overridden badge with it', () => {
    const { actions, store } = controller()
    actions.setRoleModel('map', 'correctness', 'deepseek-reasoner')
    expect(store.getSnapshot().overrides['bug-hunt']?.roles?.['map.correctness'])
      .toEqual({ model: 'deepseek-reasoner' })

    actions.setRoleModel('map', 'correctness', '')
    // Not `{ model: '' }`: an empty route means inherit, and a key left behind
    // would keep the role marked overridden for ever.
    expect(store.getSnapshot().overrides['bug-hunt']).toBeUndefined()
    expect(store.getSnapshot().dirty).toBe(true)
  })

  it('keeps a sibling override when one route is cleared', () => {
    const { actions, store } = controller()
    actions.setRoleCount('map', 'correctness', 2)
    actions.setRoleProvider('map', 'correctness', 'codex')
    actions.setRoleProvider('map', 'correctness', '')
    expect(store.getSnapshot().overrides['bug-hunt']?.roles?.['map.correctness']).toEqual({ count: 2 })
  })

  it('reverts one role without touching the others', () => {
    const { actions, store } = controller()
    actions.setRoleCount('map', 'correctness', 3)
    actions.setRoleCount('map', 'tests', 2)
    actions.revertRole('map', 'correctness')
    const roles = store.getSnapshot().overrides['bug-hunt']?.roles
    expect(roles?.['map.correctness']).toBeUndefined()
    expect(roles?.['map.tests']).toEqual({ count: 2 })
  })
})

describe('CouncilCardController width ceiling', () => {
  it('names the offending layer before the write and blocks the save', async () => {
    const { actions, store, scope } = controller({}, 4)
    actions.setRoleCount('map', 'correctness', 5)
    const state = store.getSnapshot()
    // The preset is named because every shipped preset has a layer called
    // `map`: without it the card blocks Save over a layer the user cannot see.
    expect(state.widthViolations).toEqual([{ presetId: 'bug-hunt', layerId: 'map', width: 6, max: 4 }])

    actions.save()
    await Promise.resolve()
    expect(scope.writes).toHaveLength(0)
  })

  it('saves once the width is back inside the ceiling', async () => {
    const { actions, store, scope } = controller({}, 4)
    actions.setRoleCount('map', 'correctness', 5)
    actions.setRoleCount('map', 'correctness', 2)
    expect(store.getSnapshot().widthViolations).toEqual([])
    actions.save()
    await Promise.resolve()
    await Promise.resolve()
    expect(scope.writes).toEqual([{ field: 'overrides', value: { 'bug-hunt': { roles: { 'map.correctness': { count: 2 } }, quorums: {} } } }])
  })

  it('reports totals for the shown preset', () => {
    const { actions, store } = controller()
    expect(store.getSnapshot().totalAgents).toBe(6)
    actions.setRoleCount('verify', 'V1', 5)
    expect(store.getSnapshot().totalAgents).toBe(8)
  })

  it('surfaces a Host rejection the card does not model', async () => {
    const { actions, store, scope } = controller()
    scope.rejection = new TypeError('council preset "bug-hunt": something else')
    actions.setRoleCount('map', 'tests', 2)
    actions.save()
    await Promise.resolve()
    await Promise.resolve()
    expect(store.getSnapshot().error).toContain('something else')
  })
})

describe('CouncilCardController JSON transfer', () => {
  it('round-trips the overrides document', () => {
    const { actions, store } = controller()
    actions.setRoleCount('map', 'correctness', 3)
    actions.setRoleModel('map', 'tests', 'deepseek-chat')
    const exported = actions.exportOverrides()

    const fresh = controller()
    expect(fresh.actions.importOverrides(exported)).toBe(true)
    expect(fresh.store.getSnapshot().overrides).toEqual(store.getSnapshot().overrides)
  })

  it('refuses a document that is not an overrides map and leaves the staging alone', () => {
    const { actions, store } = controller()
    actions.setRoleCount('map', 'correctness', 3)
    const before = store.getSnapshot().overrides
    expect(actions.importOverrides('not json')).toBe(false)
    expect(actions.importOverrides('[1,2,3]')).toBe(false)
    expect(actions.importOverrides('{"bug-hunt":{"roles":{"map.tests":{"count":"many"}}}}')).toBe(false)
    expect(store.getSnapshot().overrides).toBe(before)
  })

  it('accepts an empty document', () => {
    const { actions, store } = controller({ 'bug-hunt': { roles: { 'map.tests': { count: 2 } } } })
    expect(actions.importOverrides('{}')).toBe(true)
    expect(store.getSnapshot().overrides).toEqual({})
  })
})

describe('readOverridesDocument', () => {
  it('drops role entries that carry nothing but empty routes', () => {
    expect(readOverridesDocument({ 'bug-hunt': { roles: { 'map.tests': { model: '' } } } })).toEqual({})
  })

  it('refuses a quorum rule outside the union', () => {
    expect(readOverridesDocument({ x: { quorums: { verify: { rule: 'plurality' } } } })).toBeUndefined()
  })
})

describe('widthViolations', () => {
  it('is empty when the deployment mirrored no ceiling', () => {
    expect(widthViolations(TOPOLOGY, { 'bug-hunt': { roles: { 'map.tests': { count: 99 } } } }, 0)).toEqual([])
  })
})

describe('quorumViolations', () => {
  it('ignores layers with no quorum at all', () => {
    expect(quorumViolations(TOPOLOGY, { 'bug-hunt': { quorums: { map: { rule: 'threshold', threshold: 9 } } } }))
      .toEqual([])
  })

  it('counts the staged width, not the composed one', () => {
    // Widening the layer in the same staging is what makes the threshold legal.
    expect(quorumViolations(TOPOLOGY, {
      'bug-hunt': {
        roles: { 'verify.V1': { count: 6 } },
        quorums: { verify: { rule: 'threshold', threshold: 6 } },
      },
    })).toEqual([])
  })
})

describe('CouncilCardController quorum threshold', () => {
  it('names a threshold its own layer cannot reach and blocks the save', async () => {
    // The Host refuses this too, but its refusal is a raw English TypeError
    // that arrives only after the write.
    const { actions, store, scope } = controller()
    actions.setQuorum('verify', 'threshold', 5)
    expect(store.getSnapshot().quorumViolations)
      .toEqual([{ presetId: 'bug-hunt', layerId: 'verify', threshold: 5, width: 3 }])
    actions.save()
    await Promise.resolve()
    expect(scope.writes).toHaveLength(0)
  })

  it('clears once the layer is wide enough for the threshold', () => {
    const { actions, store } = controller()
    actions.setQuorum('verify', 'threshold', 5)
    actions.setRoleCount('verify', 'V1', 5)
    expect(store.getSnapshot().quorumViolations).toEqual([])
  })

  it('refuses a threshold below one or not a whole number', () => {
    const { actions, store } = controller()
    actions.setQuorum('verify', 'threshold', 0)
    expect(store.getSnapshot().quorumViolations).toHaveLength(1)
    actions.setQuorum('verify', 'threshold', Number.NaN)
    expect(store.getSnapshot().quorumViolations).toHaveLength(1)
  })

  it('leaves a majority or unanimous quorum alone, and an absent threshold legal', () => {
    const { actions, store } = controller()
    actions.setQuorum('verify', 'unanimous')
    expect(store.getSnapshot().quorumViolations).toEqual([])
    // `threshold` with no number defaults to the live ballot count in both
    // quorum copies, so it is a valid document.
    actions.setQuorum('verify', 'threshold')
    expect(store.getSnapshot().quorumViolations).toEqual([])
  })
})
