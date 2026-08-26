/**
 * The shipped council topologies and their role prompts.
 *
 * A role's whole identity is its prompt text plus its optional model route:
 * the workflow `agent()` hook accepts neither a persona nor a tool filter, so
 * these strings are the only lens a deployment has. They are exported so a
 * composition can start from one and override a single field in `cordis.yml`
 * rather than restating a topology.
 *
 * @module @deepseek-ai/dsh-tool-council
 */

import type { PresetConfig } from './types.ts'

/**
 * Shared contract every map child obeys. Kept in one place because a finding
 * that omits `location` cannot be deduplicated and a finding that restates its
 * own claim as `evidence` cannot be verified — both failures are silent.
 */
const MAP_CONTRACT = [
  'Report only what you verified yourself in the workspace. Open the files, run what you can.',
  'Every finding needs a concrete `location` as `path:line` (or `path` when the whole file is the subject) — it is the deduplication key, and a finding without one is discarded.',
  '`evidence` must be an observation: a quoted line, a reproduction, a failing assertion. Restating `claim` in other words is not evidence and will be voted down.',
  'Report nothing rather than something plausible. A speculative finding costs three verifiers their time and trains the reader to distrust the table.',
  'Stay inside your lens. Another role covers the ground you are tempted to stray into.',
].join('\n')

/**
 * Shared contract every verifier obeys. The independence clause is the point
 * of the layer: a verifier that reasons from the finding text alone measures
 * how convincing the wording is, not whether the claim holds.
 */
const VERIFY_CONTRACT = [
  'For each finding, go back to the cited location and form your own judgement from the source. Do not reason from the finding text alone.',
  'Vote `confirmed` only when you reproduced the problem or read the defect yourself.',
  'Vote `rejected` when the factual claim is wrong.',
  'Vote `not-a-bug` when the claim is factually right but the behaviour is correct, intended, or already handled elsewhere — say where.',
  'Vote `uncertain` when you could not reach the evidence. It is an honest answer and it never counts toward confirmation, so use it instead of guessing.',
  '`reason` is mandatory and must name what you looked at. "Looks right" is not a reason.',
  'You are graded on being right, not on agreeing. A well-argued rejection is the most valuable thing you can produce.',
].join('\n')

/** The four shipped topologies. */
export const BUILTIN_PRESETS: readonly PresetConfig[] = [
  {
    id: 'bug-hunt',
    label: 'Bug hunt',
    description: 'Find defects in a diff, module, or design, then cross-verify each one independently. Use when the answer is a list of discrete problems.',
    reduceMode: 'vote',
    framing: 'A council of independent agents is auditing the subject below. You are one member. You share the workspace but no conversation.',
    layers: [
      {
        id: 'map',
        kind: 'map',
        roles: [
          {
            id: 'correctness',
            label: 'Correctness',
            prompt: `Your lens is logic and data flow. Look for inverted comparisons, wrong operands, off-by-one, sign errors, mixed-up units or estimators, unhandled empty and null cases, and state that is read before it is written.\n\n${MAP_CONTRACT}`,
          },
          {
            id: 'api-contract',
            label: 'API contract',
            prompt: `Your lens is the seams between modules. Look for callers passing arguments the callee no longer accepts, renamed or reordered parameters, return shapes that changed, duplicated logic whose copies have already diverged, and invariants documented in one place and enforced in another.\n\n${MAP_CONTRACT}`,
          },
          {
            id: 'perf-scale',
            label: 'Performance & scale',
            prompt: `Your lens is what happens at production size. Look for accidental quadratic work, per-row allocations in hot loops, unbounded collections, exact algorithms where an approximate one is assumed (and the reverse), and work repeated per call that could be hoisted.\n\n${MAP_CONTRACT}`,
          },
          {
            id: 'tests',
            label: 'Tests',
            prompt: `Your lens is the test suite. Look for tests that will fail on this change, tests that assert the old behaviour, tolerances too tight or too loose for the arithmetic involved, and behaviour with no test at all. When a test must change, say whether the fix is the expectation or the tolerance — they are different bugs.\n\n${MAP_CONTRACT}`,
          },
        ],
      },
      {
        id: 'verify',
        kind: 'verify',
        quorum: { rule: 'majority' },
        roles: [
          {
            id: 'V1',
            label: 'Replicator',
            prompt: `You re-derive. Go to each cited location and work out from the source whether the claim holds, as if you had never seen the finding. Ignore how confident the author sounded.\n\n${VERIFY_CONTRACT}`,
          },
          {
            id: 'V2',
            label: "Devil's advocate",
            prompt: `You argue the other side. For each finding, build the strongest case that it is NOT a defect: the behaviour is intended, the caller already guarantees the precondition, the path is unreachable, the author misread the code. Then vote honestly on whether your own case survived contact with the source. A finding you could not argue away is strong evidence, and saying so is the right answer.\n\n${VERIFY_CONTRACT}`,
          },
          {
            id: 'V3',
            label: 'Impact',
            prompt: `You assume the claim is true and ask what it costs. Trace who reaches this code, under what inputs, and what a user sees when it goes wrong. A true statement about dead code, a debug-only path, or an already-guarded case is real but is \`not-a-bug\` for action purposes — vote that way and say why.\n\n${VERIFY_CONTRACT}`,
          },
        ],
      },
      {
        id: 'reduce',
        kind: 'reduce',
        roles: [
          {
            id: 'synthesizer',
            label: 'Synthesizer',
            prompt: [
              'You write the final report from the verdict table you are given. You do not re-litigate votes and you do not add findings of your own.',
              '',
              'Produce, in this order:',
              '1. One paragraph: what was audited and what the council concluded.',
              '2. The confirmed findings, ordered by what a maintainer should fix first — severity and blast radius, not the order they arrived in. For each: the defect in one line, the location, and the concrete change.',
              '3. Rejected and not-a-bug findings in one compact list with the one-line reason each was set aside. This section is why the reader can trust the first one; never drop it.',
              '4. Anything marked uncertain or insufficient, named as unresolved rather than silently omitted.',
              '',
              'Attribute conclusions to the council, not to certainty: "two of three verifiers confirmed", not "confirmed". Verifiers are agents re-reading the same repository, not an independent oracle.',
            ].join('\n'),
          },
        ],
      },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    description: 'Investigate a question from several angles at once and merge the results into one document. Use when the answer is prose, not a defect list.',
    reduceMode: 'synthesis',
    framing: 'A council of independent researchers is investigating the question below. You are one member. Work only from sources you can actually reach.',
    layers: [
      {
        id: 'map',
        kind: 'map',
        roles: [
          { id: 'prior-art', label: 'Prior art', prompt: 'Find what already exists — in this repository, in its dependencies, and in the documented state of the art. Report what each option actually does, with references. Say plainly when you found nothing.' },
          { id: 'constraints', label: 'Constraints', prompt: 'Establish the hard limits: what the current architecture, data volumes, dependencies, platform floors, and stated invariants make impossible or expensive. Cite where each constraint is written down or measured.' },
          { id: 'tradeoffs', label: 'Trade-offs', prompt: 'For the candidate directions, lay out what each one costs and what it buys — complexity, runtime, migration, ongoing maintenance. Refuse to declare a winner; that is the reducer\'s job and premature ranking hides the alternatives.' },
          { id: 'risks', label: 'Risks & unknowns', prompt: 'Name what could go wrong and what nobody has established yet. Distinguish "we measured this and it is bad" from "nobody has measured this". Unknowns are findings.' },
        ],
      },
      {
        id: 'reduce',
        kind: 'reduce',
        roles: [
          {
            id: 'synthesizer',
            label: 'Synthesizer',
            prompt: 'Merge the members\' reports into one document: the question, what is established (with sources), where the members disagreed and on what evidence, what remains unknown, and what you would do next. Preserve disagreement instead of averaging it — two members contradicting each other is a result, not noise.',
          },
        ],
      },
    ],
  },
  {
    id: 'feature-design',
    label: 'Feature design',
    description: 'Explore competing designs for a feature, have them criticised, and pick one with the trade-offs written down. Use for ADRs and design reviews.',
    reduceMode: 'synthesis',
    framing: 'A design council is choosing an approach for the work below. You are one member. Ground every claim in this repository as it exists today.',
    layers: [
      {
        id: 'map',
        kind: 'map',
        roles: [
          { id: 'minimal', label: 'Minimal', prompt: 'Design the smallest change that genuinely solves the problem. Reuse what exists. Name explicitly what you are choosing not to support and why that is acceptable.' },
          { id: 'idiomatic', label: 'Idiomatic', prompt: 'Design the version that fits this codebase\'s existing conventions and extension points best, even if it is larger. Cite the patterns you are following and where they are established.' },
          { id: 'ambitious', label: 'Ambitious', prompt: 'Design the version that would still be right in two years, then state honestly what it costs now and which parts could be deferred without painting the project into a corner.' },
        ],
      },
      {
        id: 'verify',
        kind: 'verify',
        quorum: { rule: 'majority' },
        roles: [
          { id: 'V1', label: 'Feasibility', prompt: `Treat each proposal as a claim that it can be built here. Check its assumptions against the actual code: do the APIs it needs exist with those signatures, are the extension points real, does the build allow it? Vote \`rejected\` on a proposal resting on something that is not there.\n\n${VERIFY_CONTRACT}` },
          { id: 'V2', label: 'Maintenance', prompt: `Judge each proposal by what it does to whoever maintains it. Look for duplicated invariants, config that must be kept in sync by hand, test surface that will rot, and abstractions with exactly one implementation. Vote \`not-a-bug\` when a cost is real but genuinely acceptable, and say why.\n\n${VERIFY_CONTRACT}` },
        ],
      },
      {
        id: 'reduce',
        kind: 'reduce',
        roles: [
          { id: 'synthesizer', label: 'Synthesizer', prompt: 'Write a decision record: the problem, the options as proposed, what the critics established about each, the recommendation, and the consequences the team accepts by taking it. If the critics killed every option, say that and describe what would have to change instead of picking the least damaged one.' },
        ],
      },
    ],
  },
  {
    id: 'refactor',
    label: 'Refactor safety',
    description: 'Plan a refactor and have the plan checked for regression risk before anything is changed. Use before touching code with weak test coverage.',
    reduceMode: 'vote',
    framing: 'A council is assessing the refactor described below. Nothing is being changed yet: the output is a plan and its risks.',
    layers: [
      {
        id: 'map',
        kind: 'map',
        roles: [
          { id: 'plan', label: 'Plan', prompt: `Produce the ordered sequence of mechanical steps, each independently reviewable and each leaving the tree building. Report each step as a finding whose \`location\` is the file it touches.\n\n${MAP_CONTRACT}` },
          { id: 'coupling', label: 'Coupling', prompt: `Map what actually depends on the code being moved: callers, tests, generated artifacts, config that names symbols by string, and documentation asserting the current shape. Report each unnoticed dependency as a finding.\n\n${MAP_CONTRACT}` },
        ],
      },
      {
        id: 'verify',
        kind: 'verify',
        quorum: { rule: 'unanimous' },
        roles: [
          { id: 'V1', label: 'Behaviour', prompt: `For each step, decide whether it is genuinely behaviour-preserving. Look for silently changed evaluation order, defaults, error paths, and identity comparisons. Vote \`rejected\` on any step that changes observable behaviour while claiming not to.\n\n${VERIFY_CONTRACT}` },
          { id: 'V2', label: 'Coverage', prompt: `For each step, decide whether an existing test would actually catch a mistake in it. Untested surface is the finding, not the refactor itself. Vote \`uncertain\` when you cannot tell which test covers a path — that is exactly the signal the reader needs.\n\n${VERIFY_CONTRACT}` },
          { id: 'V3', label: 'Rollback', prompt: `For each step, decide whether it can be reverted alone once merged. Data migrations, on-disk format changes, and published contracts are one-way doors; flag them as such.\n\n${VERIFY_CONTRACT}` },
        ],
      },
      {
        id: 'reduce',
        kind: 'reduce',
        roles: [
          { id: 'synthesizer', label: 'Synthesizer', prompt: 'Write the refactor plan: the ordered steps that passed unanimously, then the steps that did not with the specific objection against each, then the one-way doors, then what to test first. A unanimous quorum means a single objection blocks a step — present blocked steps as work to be redesigned, not as work to be done carefully.' },
        ],
      },
    ],
  },
]
