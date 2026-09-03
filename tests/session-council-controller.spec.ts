/**
 * Tests for the composer-dock council designer: the staged draft model and
 * the controller that lands it in the `council` settings namespace. The dirty
 * flag, the projected document and the validation must never disagree — these
 * tests pin the projection rules the panel is built on.
 */

import { describe, expect, it } from 'vitest'
import {
  SessionCouncilController, addCustomNode, addRole, claimedIds, customDraft, draftOf, emptyDraft, mintId,
  presetOf, projectSetup, setCount, setQuorum, setRoutePair, setVerify, slugify,
} from '../src/client/session-council-controller.ts'
import { toTopology } from '../src/settings.ts'
import { BUILTIN_PRESETS } from '../src/presets.ts'
import type { CouncilSettings, SessionCouncilSetup } from '../src/settings.ts'

const PRESETS = toTopology(BUILTIN_PRESETS)
const bugHunt = presetOf(PRESETS, 'bug-hunt')
if (bugHunt === undefined) throw new Error('fixture: bug-hunt preset')

const research = presetOf(PRESETS, 'research')
if (research === undefined) throw new Error('fixture: research preset')

const CLEAN = {
  name: '',
  custom: false,
  roles: {},
  addRoles: {},
  addLayers: [],
  topology: [],
}

describe('draft helpers', () => {
  it('starts clean with verification on for a preset that has a verify layer', () => {
    expect(emptyDraft('bug-hunt', true)).toEqual({
      presetId: 'bug-hunt', verifyEnabled: true, ...CLEAN,
    })
    expect(emptyDraft('research', false)).toEqual({
      presetId: 'research', verifyEnabled: false, ...CLEAN,
    })
  })

  it('loads a stored setup, defaulting verification on', () => {
    const stored: SessionCouncilSetup = {
      presetId: 'bug-hunt',
      verifyEnabled: false,
      roles: { 'map.correctness': { count: 3 } },
    }
    expect(draftOf('bug-hunt', true, stored)).toEqual({
      presetId: 'bug-hunt',
      verifyEnabled: false,
      ...CLEAN,
      roles: { 'map.correctness': { count: 3 } },
    })
    expect(draftOf('bug-hunt', true, undefined)?.verifyEnabled).toBe(true)
  })

  it('clears a route override back to nothing when emptied', () => {
    let draft = setRoutePair(emptyDraft('bug-hunt', true), 'map.correctness', 'deepseek', 'deepseek-v4')
    expect(draft.roles['map.correctness']).toEqual({ provider: 'deepseek', model: 'deepseek-v4' })
    draft = setRoutePair(draft, 'map.correctness', '', '')
    expect(draft.roles['map.correctness']).toBeUndefined()
  })

  it('drops the quorum while verification is off', () => {
    const draft = setQuorum(emptyDraft('bug-hunt', true), 'threshold', 2)
    const off = setVerify(draft, true, false)
    expect(off.verifyEnabled).toBe(false)
    expect(off.quorum).toBeUndefined()
  })

  it('mints collision-free ids from labels', () => {
    const taken = new Set(['bug-hunt', 'correctness', 'data-flow'])
    expect(mintId('Data flow', taken)).toBe('data-flow-2')
    expect(mintId('!!!', taken)).toBe('role')
    expect(slugify('API contract')).toBe('api-contract')
  })
})

describe('projectSetup', () => {
  it('stores the preset id even for a pristine draft (fixing the session)', () => {
    expect(projectSetup(bugHunt, emptyDraft('bug-hunt', true))).toEqual({ presetId: 'bug-hunt' })
  })

  it('drops role tunings that equal the composed baseline', () => {
    const draft = {
      ...emptyDraft('bug-hunt', true),
      roles: {
        // correctness runs 1 by composition: tuning to 1 stores nothing.
        'map.correctness': { count: 1 },
        // tests runs 1 by composition: tuning to 3 stores the change.
        'map.tests': { count: 3 },
      },
    }
    expect(projectSetup(bugHunt, draft)).toEqual({
      presetId: 'bug-hunt',
      roles: { 'map.tests': { count: 3 } },
    })
  })

  it('stores route changes but not the composed route', () => {
    const draft = setRoutePair(emptyDraft('bug-hunt', true), 'map.tests', 'deepseek', 'deepseek-v4')
    // bug-hunt's tests role composes with no route, so any chosen route is a change.
    expect(projectSetup(bugHunt, draft)).toEqual({
      presetId: 'bug-hunt',
      roles: { 'map.tests': { provider: 'deepseek', model: 'deepseek-v4' } },
    })
  })

  it('records verification off and forgets a quorum override with it', () => {
    const draft = setQuorum(emptyDraft('bug-hunt', true), 'threshold', 2)
    const off = setVerify(draft, true, false)
    expect(projectSetup(bugHunt, off)).toEqual({ presetId: 'bug-hunt', verifyEnabled: false })
  })

  it('keeps the composed majority quorum out of the stored document', () => {
    const draft = setQuorum(emptyDraft('bug-hunt', true), 'majority')
    expect(projectSetup(bugHunt, draft)).toEqual({ presetId: 'bug-hunt' })
  })

  it('stores only a quorum that differs from the composition', () => {
    const draft = setQuorum(emptyDraft('bug-hunt', true), 'threshold', 2)
    expect(projectSetup(bugHunt, draft)).toEqual({
      presetId: 'bug-hunt',
      quorum: { rule: 'threshold', threshold: 2 },
    })
  })

  it('drops stale role keys whose roles the preset no longer has', () => {
    const draft = {
      ...emptyDraft('bug-hunt', true),
      roles: { 'gone-layer.gone-role': { count: 9 } },
    }
    expect(projectSetup(bugHunt, draft)).toEqual({ presetId: 'bug-hunt' })
  })

  it('a preset without a verify layer never stores verification state', () => {
    expect(projectSetup(research, emptyDraft('research', false))).toEqual({ presetId: 'research' })
  })

  it('stores authored roles per layer and whole authored layers', () => {
    let draft = emptyDraft('bug-hunt', true)
    draft = addRole(draft, 'map', {
      id: 'data-flow',
      label: 'Data flow',
      prompt: 'trace the data',
      count: 2,
      provider: 'deepseek',
      model: 'deepseek-v4',
    })
    expect(projectSetup(bugHunt, draft)).toEqual({
      presetId: 'bug-hunt',
      addRoles: {
        map: [{ id: 'data-flow', label: 'Data flow', prompt: 'trace the data', count: 2, provider: 'deepseek', model: 'deepseek-v4' }],
      },
    })
    // Defaults are dropped when a role is authored without them.
    const simple = addRole(emptyDraft('bug-hunt', true), 'verify', {
      id: 'V4', label: 'V4', prompt: 'double-check',
    })
    expect(projectSetup(bugHunt, simple)).toEqual({
      presetId: 'bug-hunt',
      addRoles: { verify: [{ id: 'V4', label: 'V4', prompt: 'double-check' }] },
    })
  })

  it('projects a custom (from-scratch) topology with its name', () => {
    const draft = {
      ...customDraft(),
      name: 'Release audit',
      topology: [
        { id: 'map', kind: 'map' as const, roles: [{ id: 'a', label: 'a', prompt: 'one' }] },
        { id: 'reduce', kind: 'reduce' as const, roles: [{ id: 'synthesizer', label: 'Synthesizer', prompt: 'two' }] },
      ],
    }
    expect(projectSetup(undefined, draft)).toEqual({
      presetId: '',
      name: 'Release audit',
      topology: [
        { id: 'map', label: 'map', roles: [{ id: 'a', label: 'a', prompt: 'one' }] },
        { id: 'reduce', label: 'reduce', kind: 'reduce', roles: [{ id: 'synthesizer', label: 'Synthesizer', prompt: 'two' }] },
      ],
    })
  })
})

describe('custom topology helpers', () => {
  it('inserts map/verify nodes before the reduce node and appends reduce', () => {
    let draft = customDraft()
    draft = addCustomNode(draft, { id: 'map', kind: 'map', roles: [] })
    draft = addCustomNode(draft, {
      id: 'reduce', kind: 'reduce',
      roles: [{ id: 'synthesizer', label: 'Synthesizer', prompt: 'write' }],
    })
    draft = addCustomNode(draft, { id: 'verify', kind: 'verify', roles: [], quorum: { rule: 'majority' } })
    expect(draft.topology.map(layer => layer.kind)).toEqual(['map', 'verify', 'reduce'])
  })

  it('mints collision-free ids for nodes and roles', () => {
    const draft = customDraft()
    expect(mintId('map', claimedIds(undefined, draft))).toBe('map')
    const withMap = addCustomNode(draft, { id: 'map', kind: 'map', roles: [] })
    expect(mintId('map', claimedIds(undefined, withMap))).toBe('map-2')
  })
})

/** A fake scope whose `set` mutates a user document and notifies listeners. */
function stubScope(initial: Partial<CouncilSettings> = {}) {
  const value: CouncilSettings = {
    defaultPreset: 'bug-hunt',
    maxAgentsPerLayer: 100,
    topology: PRESETS,
    ...initial,
  }
  let sessionCouncil = value.sessionCouncil ?? {}
  let revision = 1
  const listeners = new Set<() => void>()
  const snapshot = () => ({
    status: 'ready' as const,
    value,
    base: undefined,
    user: { sessionCouncil },
    revision,
    writable: true,
    mode: 'host' as const,
  })
  const scope = {
    getSnapshot: snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: async (field: string, next: unknown) => {
      if (field === 'sessionCouncil') {
        sessionCouncil = next as Record<string, SessionCouncilSetup>
        value.sessionCouncil = sessionCouncil
        revision += 1
        for (const listener of listeners) listener()
      }
    },
    unset: async () => {},
  }
  return scope
}

describe('SessionCouncilController', () => {
  it('starts clean on a session that fixed nothing, using the default preset', () => {
    const scope = stubScope()
    const controller = new SessionCouncilController(scope, 's-1')
    const state = controller.store().getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.dirty).toBe(false)
    expect(state.hasStored).toBe(false)
    expect(state.draft.presetId).toBe('bug-hunt')
    controller.dispose()
  })

  it('becomes dirty on an edit and saves the projected document', async () => {
    const scope = stubScope()
    const controller = new SessionCouncilController(scope, 's-1')
    const actions = controller.actions()
    actions.setCount('map.tests', 4)
    let state = controller.store().getSnapshot()
    expect(state.dirty).toBe(true)
    expect(state.staged).toEqual({ presetId: 'bug-hunt', roles: { 'map.tests': { count: 4 } } })

    actions.save()
    await new Promise(resolve => setTimeout(resolve, 0))
    state = controller.store().getSnapshot()
    expect(state.hasStored).toBe(true)
    expect(state.dirty).toBe(false)
    expect(state.staged).toEqual({ presetId: 'bug-hunt', roles: { 'map.tests': { count: 4 } } })
    controller.dispose()
  })

  it('refuses to save an over-wide layer', async () => {
    const scope = stubScope({ maxAgentsPerLayer: 5 })
    const controller = new SessionCouncilController(scope, 's-1')
    const actions = controller.actions()
    actions.setCount('map.tests', 20)
    const state = controller.store().getSnapshot()
    expect(state.widthViolations.length).toBeGreaterThan(0)
    let wrote = false
    const original = scope.set.bind(scope)
    scope.set = async () => { wrote = true }
    actions.save()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(wrote).toBe(false)
    scope.set = original
    controller.dispose()
  })

  it('lets the model pick the preset again by clearing the stored setup', async () => {
    const scope = stubScope({
      sessionCouncil: { 's-1': { presetId: 'bug-hunt', roles: { 'map.tests': { count: 4 } } } },
    })
    const controller = new SessionCouncilController(scope, 's-1')
    let state = controller.store().getSnapshot()
    expect(state.hasStored).toBe(true)
    expect(state.dirty).toBe(false)

    controller.actions().clear()
    await new Promise(resolve => setTimeout(resolve, 0))
    state = controller.store().getSnapshot()
    expect(state.hasStored).toBe(false)
    expect(state.dirty).toBe(false)
    controller.dispose()
  })
})
