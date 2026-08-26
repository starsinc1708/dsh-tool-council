/**
 * Council conversation view: a graph of the council's map → verify → reduce
 * agents, rendered as a tab beside Chat and Trajectory. It reads the durable
 * `workflow-run` conversation nodes (emitted by the workflow engine), shows
 * each member's role, live state, spent tokens, and a role explanation, and is
 * gated to the Map-Reduce preset.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: brings the `workflow-run` ChatNodeDataMap augmentation.
import type {} from '@deepseek-ai/dsh-client-ui-workflow-run/client'
import type { CouncilKey } from './locales.ts'
import { NS } from './locales.ts'
import css from './council-view.module.css'

/** The published preset id this view is for. */
const COUNCIL_PRESET = 'map-reduce'

/** Durable workflow-run member data (mirrors ui-workflow-run's renderer shape). */
interface MemberData {
  readonly seq: number
  readonly label: string
  readonly childId: string
  readonly status: string
}

/** Durable workflow-run phase group. */
interface PhaseData {
  readonly key: string
  readonly phase: string | null
  readonly members: readonly MemberData[]
}

/** Durable workflow-run Chat node payload. */
interface RunData {
  readonly name: string
  readonly status: string
  readonly phases: readonly PhaseData[]
}

/** Short explanation per shipped role label, shown under each member. */
const ROLE_GLOSSARY: Record<string, string> = {
  'Correctness': 'Reads logic and data flow: inverted conditions, off-by-one, null/empty cases, read-before-write.',
  'API contract': 'Reads module seams: mismatched arguments, renamed parameters, drifted duplicates, broken invariants.',
  'Performance & scale': 'Reads production-size behaviour: quadratic work, hot-loop allocations, unbounded collections.',
  'Tests': 'Reads the test suite: tests that will break, assert old behaviour, or have no coverage.',
  'Prior art': 'Finds what already exists and what each option actually does, with references.',
  'Constraints': 'Establishes the hard limits the architecture, data, and platform impose.',
  'Trade-offs': 'Lays out what each direction costs and buys; refuses to pick a winner.',
  'Risks & unknowns': 'Names what could go wrong and what nobody has measured yet.',
  'Minimal': 'Designs the smallest change that genuinely solves the problem.',
  'Idiomatic': 'Designs the version that fits the codebase conventions, even if larger.',
  'Ambitious': 'Designs the version still right in two years, with its honest cost.',
  'Plan': 'Produces ordered, independently reviewable mechanical steps.',
  'Coupling': 'Maps everything that actually depends on the code being moved.',
  'Replicator': 'Re-derives each claim from the source, as if the finding had never been written.',
  "Devil's advocate": 'Builds the strongest case that each claim is NOT a defect, then votes honestly.',
  'Impact': 'Assumes each claim is true and traces who reaches it and what a user sees.',
  'Feasibility': 'Checks each proposal against the real APIs and extension points.',
  'Maintenance': 'Judges each proposal by what it does to whoever maintains it.',
  'Behaviour': 'Decides whether each refactor step is genuinely behaviour-preserving.',
  'Coverage': 'Decides whether an existing test would catch a mistake in each step.',
  'Rollback': 'Decides whether each step can be reverted alone once merged.',
  'Synthesizer': 'Writes the final report from the verdict table; never re-litigates votes.',
}

/** Everything the view's slot registration injects. */
export interface CouncilViewInjected {
  /** Read one member's cumulative token usage from its child session. */
  readMemberUsage: (childId: string) => TokenUsageProjection | undefined
}

/** Register the Council conversation-view tab. */
export function registerCouncilView(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'council',
    order: 20,
    locale: NS,
    label: () => t('view.council'),
    inject: () => ({
      readMemberUsage: (childId: string) => {
        const sessions = ctx.sessions as unknown as {
          binding(id: string): { session?: { projections: { get(key: string): unknown } } } | undefined
        }
        return sessions.binding(childId)?.session?.projections.get('tokenUsage') as TokenUsageProjection | undefined
      },
    }),
  }, CouncilView))
}

/** One workflow-run node, extracted for rendering. */
interface CouncilRun {
  readonly key: string
  readonly data: RunData
}

/** Render the Council graph tab. */
function CouncilView(
  props: ConvViewProps & PropsLocale<'council'> & InjectFace<CouncilViewInjected>,
) {
  const { useSession, useSessions, sessionId, t, readMemberUsage } = props
  const preset = useSessions(state => state.byId[sessionId]?.agentPreset)
  const chat = useSession(state => state.chat)

  if (preset !== COUNCIL_PRESET) {
    return <div className={css.empty}>{t('onlyMapReduce')}</div>
  }

  const runs: CouncilRun[] = []
  for (const node of chat.nodes.values()) {
    if (node.kind === 'workflow-run') runs.push({ key: node.key, data: node.data as unknown as RunData })
  }
  if (runs.length === 0) return <div className={css.empty}>{t('noRuns')}</div>

  return (
    <div className={css.wrap}>
      {runs.map(run => (
        <section key={run.key} className={css.run}>
          <header className={css.runHead}>
            <span className={css.runName}>{run.data.name}</span>
            <span className={css.runStatus}>{t(`status.${run.data.status}` as CouncilKey)}</span>
          </header>
          <div className={css.layers}>
            {run.data.phases.map(phase => (
              <fieldset key={phase.key} className={css.layer}>
                <legend>{phase.phase ?? '—'}</legend>
                {phase.members.map(member => (
                  <Member
                    key={member.seq}
                    label={member.label}
                    status={member.status}
                    usage={readMemberUsage(member.childId)}
                    t={t}
                  />
                ))}
              </fieldset>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

interface MemberProps {
  readonly label: string
  readonly status: string
  readonly usage: TokenUsageProjection | undefined
  readonly t: (key: CouncilKey, args?: Record<string, unknown>) => string
}

function Member({ label, status, usage, t }: MemberProps) {
  const explanation = ROLE_GLOSSARY[label]
  const total = usage === undefined ? undefined
    : usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
  return (
    <div className={css.member}>
      <div className={css.memberRow}>
        <span className={css.dot} data-status={status} />
        <span className={css.memberLabel}>{label}</span>
        <span className={css.memberStatus}>{t(`status.${status}` as CouncilKey)}</span>
        {total === undefined ? null : <span className={css.memberTokens}>{t('tokens', { n: total })}</span>}
      </div>
      {explanation === undefined ? null : <p className={css.memberHint}>{explanation}</p>}
    </div>
  )
}
