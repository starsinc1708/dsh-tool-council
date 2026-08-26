/**
 * End-to-end run of the deployment-owned workflow script against stubbed
 * children, plus the cross-copy contract: the script's tally must agree with
 * the host's authoritative `tally()` recomputation. This is the guard the
 * otherwise-silent drift between `script.ts` and `tally.ts` needs.
 */

import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { COUNCIL_SCRIPT } from '../src/script.ts'
import { BUILTIN_PRESETS } from '../src/presets.ts'
import { expandLayers } from '../src/policy.ts'
import { tally } from '../src/tally.ts'

interface AgentOptions {
  label: string
  schema?: { properties?: Record<string, unknown> }
}

function runScript(agentImpl: (_prompt: string, opts: AgentOptions) => unknown): Promise<Record<string, any>> {
  const preset = BUILTIN_PRESETS[0]
  const context: Record<string, unknown> = {
    args: {
      framing: preset.framing ?? '',
      task: 'audit src',
      reduceMode: 'vote',
      maxFindings: 200,
      maxFindingChars: 2000,
      layers: expandLayers(preset),
    },
    phase: () => {},
    log: () => {},
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

describe('council script', () => {
  it('runs map -> verify -> reduce and its tally agrees with the host copy', async () => {
    const result = await runScript((_prompt, opts) => {
      if (opts.schema?.properties?.findings) {
        return opts.label === 'Correctness'
          ? { findings: [{ title: 'Bug', location: 'a.ts:1', claim: 'c', evidence: 'e', severity: 'high', confidence: 0.9, fix: 'f' }] }
          : { findings: [] }
      }
      if (opts.schema?.properties?.verdicts) {
        return opts.label === 'Replicator'
          ? { verdicts: [{ findingId: 'f1', vote: 'confirmed', reason: 'r' }] }
          : { verdicts: [] }
      }
      return 'report'
    })

    expect(result.findings).toHaveLength(1)
    expect(result.ballots).toHaveLength(3)
    expect(result.membersReporting).toBe(1)
    // V2 and V3 returned no verdict -> null votes, not undefined.
    expect(result.tally.rows[0].votes).toEqual(['confirmed', null, null])
    expect(result.tally).toEqual(tally(result.findings, result.ballots, { rule: 'majority' }))
  })
})
