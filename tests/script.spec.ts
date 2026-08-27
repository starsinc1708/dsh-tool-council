/**
 * End-to-end runs of the deployment-owned workflow script against stubbed
 * children: the vote path, the synthesis path (whose verify layer must actually
 * vote), the merge stage, the per-member cap, the bounded retry, the missing
 * report, and the run budget — plus the cross-copy contract that the script's
 * tally must agree with the host's authoritative `tally()` recomputation. This
 * is the guard the otherwise-silent drift between `script.ts` and `tally.ts`
 * needs.
 */

import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { COUNCIL_SCRIPT } from '../src/script.ts'
import { BUILTIN_PRESETS } from '../src/presets.ts'
import { expandLayers } from '../src/policy.ts'
import { tally } from '../src/tally.ts'
import type { PresetConfig } from '../src/types.ts'

interface AgentOptions {
  label: string
  schema?: { properties?: Record<string, unknown> }
}

type AgentImpl = (prompt: string, opts: AgentOptions) => unknown

function presetById(id: string): PresetConfig {
  const preset = BUILTIN_PRESETS.find(candidate => candidate.id === id)
  if (preset === undefined) throw new Error(`no such preset: ${id}`)
  return preset
}

interface RunOptions {
  readonly preset?: PresetConfig
  readonly args?: Record<string, unknown>
  readonly logs?: string[]
}

function runScript(agentImpl: AgentImpl, options: RunOptions = {}): Promise<Record<string, any>> {
  const preset = options.preset ?? presetById('bug-hunt')
  const logs = options.logs ?? []
  const context: Record<string, unknown> = {
    args: {
      framing: preset.framing ?? '',
      task: 'audit src',
      reduceMode: preset.reduceMode ?? 'vote',
      maxFindings: 200,
      maxFindingChars: 2000,
      maxFindingsPerMember: 50,
      maxRunMs: 0,
      retryFailedMembers: false,
      mergeSameLocation: false,
      maxMergeCandidates: 60,
      layers: expandLayers(preset),
      ...options.args,
    },
    phase: () => {},
    log: (message: string) => { logs.push(message) },
    agent: async (prompt: string, opts: AgentOptions) => agentImpl(prompt, opts),
    parallel: async (thunks: Array<() => Promise<unknown>>) => {
      const out: unknown[] = []
      for (const thunk of thunks) out.push(await thunk())
      return out
    },
  }
  vm.createContext(context)
  return vm.runInContext(`(async () => {\n${COUNCIL_SCRIPT}\n})()`, context, { timeout: 15000 }) as Promise<Record<string, any>>
}

function isFindings(opts: AgentOptions): boolean {
  return opts.schema?.properties?.findings !== undefined
}

function isVerdicts(opts: AgentOptions): boolean {
  return opts.schema?.properties?.verdicts !== undefined
}

function isMerge(opts: AgentOptions): boolean {
  return opts.schema?.properties?.merges !== undefined
}

function bug(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Bug', location: 'a.ts:1', claim: 'c', evidence: 'e',
    severity: 'high', confidence: 0.9, fix: 'f', ...overrides,
  }
}

describe('council script — vote path', () => {
  it('runs map -> verify -> reduce and its tally agrees with the host copy', async () => {
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) return opts.label === 'Correctness' ? { findings: [bug()] } : { findings: [] }
      if (isVerdicts(opts)) {
        return opts.label === 'Replicator'
          ? { verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: 'r' }] }
          : { verdicts: [] }
      }
      return 'report'
    })

    expect(result.findings).toHaveLength(1)
    expect(result.ballots).toHaveLength(3)
    // Three members answered with an empty list, which the prompt calls a valid
    // answer: they responded, they just did not report.
    expect(result.membersReporting).toBe(1)
    expect(result.membersResponding).toBe(4)
    expect(result.mapMembers).toBe(4)
    expect(result.stopReason).toBe('completed')
    expect(result.reportMissing).toBe(false)
    // V2 and V3 returned no verdict -> null votes, not undefined.
    expect(result.tally.rows[0].votes).toEqual(['confirmed', null, null])
    // One confirmation and two abstentions is a quorum of one.
    expect(result.tally.rows[0].participating).toBe(1)
    expect(result.tally.rows[0].outcome).toBe('insufficient')
    expect(result.tally).toEqual(tally(result.findings, result.ballots, { rule: 'majority' }))
  })

  it('caps each member before clustering', async () => {
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) {
        return opts.label === 'Correctness'
          ? { findings: [bug({ title: 'one' }), bug({ title: 'two' }), bug({ title: 'three' })] }
          : { findings: [] }
      }
      if (isVerdicts(opts)) return { verdicts: [] }
      return 'report'
    }, { args: { maxFindingsPerMember: 2 } })

    expect(result.findings.map((entry: { title: string }) => entry.title)).toEqual(['one', 'two'])
  })
})

describe('council script — synthesis path', () => {
  const design = presetById('feature-design')

  it('actually runs the verify layer and hands the reducer the verdict table', async () => {
    let reducerPrompt = ''
    const result = await runScript((prompt, opts) => {
      if (isFindings(opts)) {
        return opts.label === 'Minimal'
          ? { findings: [bug({ title: 'Option A', location: 'design.md' })] }
          : { findings: [] }
      }
      if (isVerdicts(opts)) {
        return { verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: `checked by ${opts.label}` }] }
      }
      reducerPrompt = prompt
      return 'decision record'
    }, { preset: design })

    // The defect this covers: synthesis used to skip deduplication, which left
    // the verify layer with nothing to verify and `findings` permanently empty.
    expect(result.findings).toHaveLength(1)
    expect(result.ballots).toHaveLength(2)
    expect(result.tally).not.toBeNull()
    expect(result.tally.rows[0].participating).toBe(2)
    expect(result.tally.rows[0].outcome).toBe('confirmed')
    expect(result.tally).toEqual(tally(result.findings, result.ballots, { rule: 'majority' }))
    expect(reducerPrompt).toContain('VERDICT TABLE')
    expect(result.report).toBe('decision record')
  })

  it('leaves the tally null when the preset declares no verify layer', async () => {
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) return { findings: [bug({ location: 'notes.md' })] }
      return 'summary'
    }, { preset: presetById('research') })

    expect(result.tally).toBeNull()
    expect(result.findings).toHaveLength(1)
    expect(result.report).toBe('summary')
  })
})

describe('council script — merge stage', () => {
  it('folds two wordings of one defect at the same location into one finding', async () => {
    let mergePrompt = ''
    const result = await runScript((prompt, opts) => {
      if (isFindings(opts)) {
        if (opts.label === 'Correctness') return { findings: [bug({ title: 'Greedy scoring inverted' })] }
        if (opts.label === 'Tests') return { findings: [bug({ title: 'Ranking uses residual entropy' })] }
        return { findings: [] }
      }
      if (isMerge(opts)) {
        mergePrompt = prompt
        return { merges: [{ ids: ['f1', 'f2'], reason: 'same root cause' }] }
      }
      if (isVerdicts(opts)) return { verdicts: [] }
      return 'report'
    }, { args: { mergeSameLocation: true } })

    expect(mergePrompt).toContain('CANDIDATE GROUPS')
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].reportedBy).toEqual(['correctness', 'tests'])
    expect(result.findings[0].variants).toEqual(['Greedy scoring inverted', 'Ranking uses residual entropy'])
  })

  it('does not spend a child when no two clusters share a location', async () => {
    let mergeCalls = 0
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) {
        return opts.label === 'Correctness' ? { findings: [bug()] } : { findings: [] }
      }
      if (isMerge(opts)) { mergeCalls += 1; return { merges: [] } }
      if (isVerdicts(opts)) return { verdicts: [] }
      return 'report'
    }, { args: { mergeSameLocation: true } })

    expect(mergeCalls).toBe(0)
    expect(result.findings).toHaveLength(1)
  })

  it('chains merge groups without losing a reporter', async () => {
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) {
        if (opts.label === 'Correctness') return { findings: [bug({ title: 'first wording' })] }
        if (opts.label === 'Tests') return { findings: [bug({ title: 'second wording' })] }
        if (opts.label === 'API contract') return { findings: [bug({ title: 'third wording' })] }
        return { findings: [] }
      }
      // f2 ≡ f3 stated before f1 ≡ f2: the survivor of the first group is
      // itself absorbed by the second, and must hand over what it absorbed.
      if (isMerge(opts)) {
        return { merges: [{ ids: ['f2', 'f3'], reason: 'same' }, { ids: ['f1', 'f2'], reason: 'same' }] }
      }
      if (isVerdicts(opts)) return { verdicts: [] }
      return 'report'
    }, { args: { mergeSameLocation: true } })

    expect(result.findings).toHaveLength(1)
    expect([...result.findings[0].reportedBy].sort()).toEqual(['api-contract', 'correctness', 'tests'])
    expect(result.findings[0].variants).toHaveLength(3)
  })

  it('shares the merge budget across locations instead of letting the first take it all', async () => {
    // One hot file with more ambiguous clusters than the whole budget used to
    // consume it, so every other ambiguous location was silently left unmerged.
    const hot = Array.from({ length: 8 }, (_unused, index) => bug({
      title: `hot wording ${index}`, location: 'hot.ts:1',
    }))
    const cold = Array.from({ length: 2 }, (_unused, index) => bug({
      title: `cold wording ${index}`, location: 'cold.ts:9',
    }))
    let mergePrompt = ''
    const logs: string[] = []
    await runScript((prompt, opts) => {
      if (isFindings(opts)) {
        return opts.label === 'Correctness' ? { findings: [...hot, ...cold] } : { findings: [] }
      }
      if (isMerge(opts)) { mergePrompt = prompt; return { merges: [] } }
      if (isVerdicts(opts)) return { verdicts: [] }
      return 'report'
    }, { args: { mergeSameLocation: true, maxMergeCandidates: 6 }, logs })

    expect(mergePrompt).toContain('## location: cold.ts:9')
    expect(mergePrompt).toContain('## location: hot.ts:1')
    // Nothing is dropped silently: what did not fit is named in the log.
    expect(logs.some(line => line.includes('exceeded maxMergeCandidates'))).toBe(true)
  })

  it('clusters once for the whole run, keeping the fold across two map layers', async () => {
    const twoMaps: PresetConfig = {
      id: 'two-maps',
      description: 'd',
      reduceMode: 'vote',
      layers: [
        { id: 'map', kind: 'map', roles: [{ id: 'first', label: 'First', prompt: 'p' }] },
        { id: 'map2', kind: 'map', roles: [{ id: 'second', label: 'Second', prompt: 'p' }] },
        { id: 'reduce', kind: 'reduce', roles: [{ id: 'synthesizer', label: 'Synthesizer', prompt: 'p' }] },
      ],
    }
    let mergeCalls = 0
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) {
        if (opts.label === 'First') return { findings: [bug({ title: 'first wording' })] }
        return { findings: [bug({ title: 'second wording' })] }
      }
      if (isMerge(opts)) {
        mergeCalls += 1
        return { merges: [{ ids: ['f1', 'f2'], reason: 'same' }] }
      }
      return 'report'
    }, { preset: twoMaps, args: { mergeSameLocation: true } })

    // One merge child for the run, and its fold survives — re-clustering per
    // layer used to rebuild the list and throw the previous decision away.
    expect(mergeCalls).toBe(1)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].reportedBy).toEqual(['first', 'second'])
  })

  it('keeps every cluster when the merge child dies', async () => {
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) {
        if (opts.label === 'Correctness') return { findings: [bug({ title: 'first wording' })] }
        if (opts.label === 'Tests') return { findings: [bug({ title: 'second wording' })] }
        return { findings: [] }
      }
      if (isMerge(opts)) return null
      if (isVerdicts(opts)) return { verdicts: [] }
      return 'report'
    }, { args: { mergeSameLocation: true } })

    expect(result.findings).toHaveLength(2)
  })
})

describe('council script — failure handling', () => {
  it('retries a dead child once and keeps the lens', async () => {
    const logs: string[] = []
    let attempts = 0
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) {
        if (opts.label !== 'Correctness') return { findings: [] }
        attempts += 1
        return attempts === 1 ? null : { findings: [bug()] }
      }
      if (isVerdicts(opts)) return { verdicts: [] }
      return 'report'
    }, { args: { retryFailedMembers: true }, logs })

    expect(attempts).toBe(2)
    expect(result.findings).toHaveLength(1)
    expect(logs.some(line => line.includes('retrying "Correctness"'))).toBe(true)
  })

  it('counts a member whose child never came back as not responding', async () => {
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) return opts.label === 'Correctness' ? null : { findings: [] }
      if (isVerdicts(opts)) return { verdicts: [] }
      return 'report'
    })

    expect(result.membersResponding).toBe(3)
    expect(result.mapMembers).toBe(4)
    expect(result.membersReporting).toBe(0)
  })

  it('reports a dead synthesizer as a missing report instead of an empty one', async () => {
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) return opts.label === 'Correctness' ? { findings: [bug()] } : { findings: [] }
      if (isVerdicts(opts)) return { verdicts: [] }
      return null
    })

    expect(result.report).toBe('')
    expect(result.reportMissing).toBe(true)
    expect(result.findings).toHaveLength(1)
  })

  it('treats a whitespace-only report as missing', async () => {
    const result = await runScript((_prompt, opts) => {
      if (isFindings(opts)) return { findings: [] }
      if (isVerdicts(opts)) return { verdicts: [] }
      return '   \n  '
    })
    expect(result.reportMissing).toBe(true)
  })
})

describe('council script — run budget', () => {
  it('skips remaining examine/verify layers past the budget but still writes a report', async () => {
    const logs: string[] = []
    const result = await runScript(async (_prompt, opts) => {
      if (isFindings(opts)) {
        await new Promise(resolve => setTimeout(resolve, 12))
        return opts.label === 'Correctness' ? { findings: [bug()] } : { findings: [] }
      }
      if (isVerdicts(opts)) return { verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: 'r' }] }
      return 'partial report'
    }, { args: { maxRunMs: 1 }, logs })

    expect(result.stopReason).toBe('deadline')
    // The verify layer never ran, so there is no table — but the findings the
    // map layer did gather survive, and the reducer still wrote something.
    expect(result.ballots).toHaveLength(0)
    expect(result.tally).toBeNull()
    expect(result.findings).toHaveLength(1)
    expect(result.report).toBe('partial report')
    expect(logs.some(line => line.includes('run budget'))).toBe(true)
  })

  it('still clusters when the budget skipped the last map layer, without a merge child', async () => {
    const twoMaps: PresetConfig = {
      id: 'two-maps',
      description: 'd',
      reduceMode: 'vote',
      layers: [
        { id: 'map', kind: 'map', roles: [{ id: 'first', label: 'First', prompt: 'p' }] },
        { id: 'map2', kind: 'map', roles: [{ id: 'second', label: 'Second', prompt: 'p' }] },
        { id: 'reduce', kind: 'reduce', roles: [{ id: 'synthesizer', label: 'Synthesizer', prompt: 'p' }] },
      ],
    }
    let mergeCalls = 0
    const result = await runScript(async (_prompt, opts) => {
      if (isFindings(opts)) {
        await new Promise(resolve => setTimeout(resolve, 12))
        return { findings: [bug({ title: 'first wording' })] }
      }
      if (isMerge(opts)) { mergeCalls += 1; return { merges: [] } }
      return 'partial report'
    }, { preset: twoMaps, args: { maxRunMs: 1, mergeSameLocation: true } })

    // The clustering the skipped layer would have done still has to happen, or
    // the reducer receives nothing at all.
    expect(result.stopReason).toBe('deadline')
    expect(result.findings).toHaveLength(1)
    expect(result.report).toBe('partial report')
    expect(mergeCalls).toBe(0)
  })
})
