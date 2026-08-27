/**
 * The cross-copy parity gate.
 *
 * Five functions are duplicated: the host owns `src/tally.ts`, and the workflow
 * script carries a second copy because the verify layer needs clustered
 * findings DURING the run and the worker cannot import this package. Only the
 * quorum half of that duplication is re-checked at runtime — the host takes the
 * clustering on trust rather than carrying the whole raw finding list back
 * across the boundary. So the clustering half is guarded here instead, before
 * the drift can ship: both copies are run over the same generated inputs and
 * every output compared.
 *
 * The generator is seeded, not random: a parity failure has to be reproducible
 * from the test name alone.
 */

import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { COUNCIL_SCRIPT } from '../src/script.ts'
import * as host from '../src/tally.ts'
import type { Finding, QuorumConfig, VerifierBallot, Vote } from '../src/types.ts'
import type { ReportedFinding } from '../src/tally.ts'

/** The subset of the script prelude this gate compares. */
interface ScriptCopy {
  fingerprint(title: string): string
  normalizeLocation(location: string): string
  capPerMember(reported: readonly ReportedFinding[], perMember: number): ReportedFinding[]
  dedupeFindings(reported: readonly ReportedFinding[]): unknown[]
  mergeClusters(clustered: readonly unknown[], groups: readonly (readonly string[])[]): unknown[]
  applyQuorum(counts: unknown, participating: number, rule: string, threshold?: number): string
  tally(findings: readonly unknown[], ballots: readonly VerifierBallot[], rule: string, threshold?: number): unknown
}

/**
 * Evaluate the script's prelude — everything above its `// ---- run ----`
 * marker — and hand back the functions it defines.
 * @returns the worker-realm copy of the duplicated arithmetic.
 */
function loadScriptCopy(): ScriptCopy {
  const marker = COUNCIL_SCRIPT.indexOf('// ---- run ----')
  expect(marker).toBeGreaterThan(0)
  const prelude = COUNCIL_SCRIPT.slice(0, marker)
  const context: Record<string, unknown> = {
    args: { maxFindingChars: 2_000, retryFailedMembers: false },
    log: () => {},
    agent: async () => null,
  }
  vm.createContext(context)
  return vm.runInContext(
    `${prelude}\n({ fingerprint, normalizeLocation, capPerMember, dedupeFindings, mergeClusters, applyQuorum, tally })`,
    context,
  ) as ScriptCopy
}

const script = loadScriptCopy()

/** Deterministic 32-bit PRNG, so a failure reproduces from the seed alone. */
function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

const WORDS = ['greedy', 'scoring', 'inverted', 'the', 'quadratic', 'rescan', 'не', 'в', 'ranking', 'entropy', '']
const PATHS = ['rank.py:521', './rank.py:521', '.\\src\\rank.py:521', 'src/rank.py', 'stats.py:12', '  x.ts:1  ']
const MEMBERS = ['correctness', 'tests', 'perf-scale', 'api-contract']
const VOTES: Vote[] = ['confirmed', 'rejected', 'not-a-bug', 'uncertain']
const RULES: QuorumConfig['rule'][] = ['majority', 'unanimous', 'threshold']

function pick<T>(next: () => number, list: readonly T[]): T {
  return list[Math.floor(next() * list.length)] as T
}

function makeFinding(next: () => number): Finding {
  const words = Array.from({ length: 1 + Math.floor(next() * 3) }, () => pick(next, WORDS))
  return {
    title: words.join(' '),
    location: pick(next, PATHS),
    claim: 'c',
    evidence: 'e',
    severity: 'high',
    confidence: 0.5,
    fix: next() < 0.5 ? '' : 'f',
  }
}

function makeReported(next: () => number, count: number): ReportedFinding[] {
  return Array.from({ length: count }, () => ({ by: pick(next, MEMBERS), finding: makeFinding(next) }))
}

describe('script/host parity', () => {
  it('agrees on fingerprint and normalizeLocation over generated titles and paths', () => {
    const next = rng(1)
    for (let round = 0; round < 2_000; round += 1) {
      const title = Array.from({ length: 1 + Math.floor(next() * 4) }, () => pick(next, WORDS)).join('  ')
      expect(script.fingerprint(title)).toBe(host.fingerprint(title))
      const location = pick(next, PATHS)
      expect(script.normalizeLocation(location)).toBe(host.normalizeLocation(location))
    }
  })

  it('agrees on capPerMember and dedupeFindings over generated report lists', () => {
    const next = rng(2)
    for (let round = 0; round < 1_000; round += 1) {
      const reported = makeReported(next, Math.floor(next() * 12))
      const perMember = Math.floor(next() * 4)
      expect(script.capPerMember(reported, perMember)).toEqual(host.capPerMember(reported, perMember))
      const capped = host.capPerMember(reported, perMember)
      expect(script.dedupeFindings(capped)).toEqual(host.dedupeFindings(capped))
    }
  })

  it('agrees on mergeClusters over generated id groups, including chained ones', () => {
    const next = rng(3)
    for (let round = 0; round < 1_000; round += 1) {
      const clustered = host.dedupeFindings(makeReported(next, 2 + Math.floor(next() * 8)))
      const ids = clustered.map(entry => entry.id)
      const groups = Array.from({ length: Math.floor(next() * 4) }, () =>
        Array.from({ length: Math.floor(next() * 4) }, () =>
          next() < 0.1 ? 'f99' : pick(next, ids)))
      expect(script.mergeClusters(clustered, groups)).toEqual(host.mergeClusters(clustered, groups))
    }
  })

  it('agrees on applyQuorum over every rule and count combination', () => {
    const next = rng(4)
    for (let round = 0; round < 4_000; round += 1) {
      const counts = {
        confirmed: Math.floor(next() * 5),
        rejected: Math.floor(next() * 5),
        notABug: Math.floor(next() * 5),
        uncertain: Math.floor(next() * 5),
      }
      const participating = counts.confirmed + counts.rejected + counts.notABug + counts.uncertain
      const rule = pick(next, RULES)
      const threshold = next() < 0.5 ? undefined : Math.floor(next() * 6)
      const quorum: QuorumConfig = { rule, ...threshold === undefined ? {} : { threshold } }
      expect(script.applyQuorum(counts, participating, rule, threshold))
        .toBe(host.applyQuorum(counts, participating, quorum))
    }
  })

  it('agrees on the whole tally, including abstentions and stale verdict ids', () => {
    const next = rng(5)
    for (let round = 0; round < 500; round += 1) {
      const clustered = host.dedupeFindings(makeReported(next, 1 + Math.floor(next() * 6)))
      const ids = clustered.map(entry => entry.id)
      const ballots: VerifierBallot[] = Array.from({ length: Math.floor(next() * 4) }, (_unused, index) => ({
        verifier: `V${index + 1}`,
        verdicts: Array.from({ length: Math.floor(next() * (ids.length + 1)) }, () => ({
          // A stale id must be ignored identically by both copies.
          findingId: next() < 0.1 ? 'f99' : pick(next, ids),
          vote: pick(next, VOTES),
          reason: 'r',
        })),
      }))
      const rule = pick(next, RULES)
      const threshold = next() < 0.5 ? undefined : Math.floor(next() * 5)
      const quorum: QuorumConfig = { rule, ...threshold === undefined ? {} : { threshold } }
      expect(script.tally(clustered, ballots, rule, threshold))
        .toEqual(host.tally(clustered, ballots, quorum))
    }
  })

  it('produces clusters the host guard accepts', () => {
    const next = rng(6)
    for (let round = 0; round < 200; round += 1) {
      const clustered = host.dedupeFindings(makeReported(next, Math.floor(next() * 10)))
      const ids = clustered.map(entry => entry.id)
      const groups = Array.from({ length: Math.floor(next() * 3) }, () =>
        Array.from({ length: Math.floor(next() * 3) }, () => pick(next, ids)))
      const merged = host.mergeClusters(clustered, groups)
      expect(() => { host.assertClustersWellFormed(merged) }).not.toThrow()
    }
  })
})

describe('assertClustersWellFormed', () => {
  const good = host.dedupeFindings([
    { by: 'a', finding: { ...makeFinding(rng(7)), title: 'one', location: 'a.ts:1' } },
    { by: 'b', finding: { ...makeFinding(rng(8)), title: 'two', location: 'b.ts:2' } },
  ])

  it('accepts a well-formed list', () => {
    expect(() => { host.assertClustersWellFormed(good) }).not.toThrow()
  })

  it('refuses a gap in the id sequence', () => {
    const drifted = good.map((entry, index) => index === 1 ? { ...entry, id: 'f7' } : entry)
    expect(() => { host.assertClustersWellFormed(drifted) }).toThrow('has id "f7", expected "f2"')
  })

  it('refuses two clusters that should have been one', () => {
    const drifted = [good[0], { ...good[1], title: 'one', location: 'a.ts:1' }] as typeof good
    expect(() => { host.assertClustersWellFormed(drifted) })
      .toThrow('repeats an earlier location+title key')
  })

  it('refuses a cluster with no reporter, a repeated reporter, or a lost title', () => {
    expect(() => { host.assertClustersWellFormed([{ ...good[0]!, reportedBy: [] }]) }).toThrow('has no reporter')
    expect(() => { host.assertClustersWellFormed([{ ...good[0]!, reportedBy: ['a', 'a'] }]) })
      .toThrow('lists a reporter twice')
    expect(() => { host.assertClustersWellFormed([{ ...good[0]!, variants: ['other'] }]) })
      .toThrow('does not list its own title')
  })
})
