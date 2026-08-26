/**
 * The fixed council orchestration script.
 *
 * Deployment-owned and build-time constant: the model supplies the task text
 * and nothing else, so it cannot change the topology, the schemas, the quorum,
 * or the validation. The script body runs in the workflow engine's worker,
 * where it can reach `args`, `agent`, `parallel`, `phase`, and `log` and
 * nothing else — it cannot import this package, which is why the clustering and
 * quorum arithmetic appear here a second time. `./tally.ts` is the host's
 * authoritative copy and the one under test; the host recomputes and refuses a
 * run whose script tally disagrees.
 *
 * @module @starsinc1708/dsh-tool-council
 */

/** One role instance the host expanded from `RoleConfig.count`. */
export interface ScriptInstance {
  /** `V1`, or `correctness#2` for the second copy of a role. */
  readonly instanceId: string
  readonly label: string
  readonly prompt: string
  readonly model?: string
  readonly provider?: string
}

/** One layer, with its roles already expanded into concrete instances. */
export interface ScriptLayer {
  readonly id: string
  readonly kind: 'map' | 'verify' | 'reduce'
  readonly quorumRule: 'majority' | 'unanimous' | 'threshold'
  readonly quorumThreshold?: number
  readonly instances: readonly ScriptInstance[]
}

/** Everything the script reads from its `args` global. */
export interface ScriptArgs {
  readonly framing: string
  readonly task: string
  readonly reduceMode: 'vote' | 'synthesis'
  readonly maxFindings: number
  readonly maxFindingChars: number
  readonly layers: readonly ScriptLayer[]
}

/** The plain-JS body handed to `WorkflowEngine.start`. */
export const COUNCIL_SCRIPT = String.raw`
const STOP_WORDS = new Set([
  'the','a','an','is','are','in','on','of','to','for','and','or','not',
  'не','в','на','и','или','по','из','что','это',
])

function fingerprint(title) {
  const tokens = String(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ')
    .filter(t => t.length > 0 && !STOP_WORDS.has(t))
  return [...new Set(tokens)].sort().join('-')
}

function normalizeLocation(location) {
  return String(location).trim().replace(/\\/gu, '/').replace(/^\.\//u, '')
}

function normalizedText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

const SEVERITIES = ['blocker', 'high', 'medium', 'low']

function readFinding(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const location = typeof raw.location === 'string' ? raw.location.trim() : ''
  const claim = typeof raw.claim === 'string' ? raw.claim.trim() : ''
  const evidence = typeof raw.evidence === 'string' ? raw.evidence.trim() : ''
  const fix = typeof raw.fix === 'string' ? raw.fix.trim() : ''
  if (title.length === 0 || location.length === 0 || claim.length === 0 || evidence.length === 0) return null
  if (!SEVERITIES.includes(raw.severity)) return null
  if (typeof raw.confidence !== 'number' || !(raw.confidence >= 0) || !(raw.confidence <= 1)) return null
  const finding = {
    title, location, claim, evidence, severity: raw.severity, confidence: raw.confidence, fix,
  }
  return JSON.stringify(finding).length > args.maxFindingChars ? null : finding
}

function dedupeFindings(reported) {
  const clusters = new Map()
  for (const entry of reported) {
    const fp = fingerprint(entry.finding.title)
    const titleKey = fp === '' ? entry.finding.title.toLowerCase().trim() : fp
    const key = normalizeLocation(entry.finding.location) + '|' + titleKey
    const existing = clusters.get(key)
    if (existing === undefined) {
      clusters.set(key, { finding: entry.finding, reportedBy: [entry.by], variants: [entry.finding.title] })
      continue
    }
    if (!existing.reportedBy.includes(entry.by)) existing.reportedBy.push(entry.by)
    if (!existing.variants.includes(entry.finding.title)) existing.variants.push(entry.finding.title)
  }
  return [...clusters.values()].map((cluster, index) => ({
    ...cluster.finding, id: 'f' + (index + 1),
    reportedBy: cluster.reportedBy, variants: cluster.variants,
  }))
}

function applyQuorum(counts, ballots, rule, threshold) {
  if (ballots < 2) return 'insufficient'
  let confirmed
  if (rule === 'majority') confirmed = counts.confirmed > counts.rejected + counts.notABug
  else if (rule === 'unanimous') confirmed = counts.confirmed === ballots
  else confirmed = counts.confirmed >= (threshold ?? ballots)
  if (confirmed) return 'confirmed'
  if (counts.rejected === 0 && counts.notABug === 0) return 'insufficient'
  return counts.notABug > counts.rejected ? 'not-a-bug' : 'rejected'
}

function tally(findings, ballots, rule, threshold) {
  const maps = ballots.map(b => new Map(b.verdicts.map(v => [v.findingId, v.vote])))
  const rows = findings.map((finding) => {
    const votes = maps.map(m => m.get(finding.id) ?? null)
    const counts = { confirmed: 0, rejected: 0, notABug: 0, uncertain: 0 }
    for (const vote of votes) {
      if (vote === 'confirmed') counts.confirmed += 1
      else if (vote === 'rejected') counts.rejected += 1
      else if (vote === 'not-a-bug') counts.notABug += 1
      else if (vote === 'uncertain') counts.uncertain += 1
    }
    return { findingId: finding.id, votes, counts, outcome: applyQuorum(counts, ballots.length, rule, threshold) }
  })
  return { verifiers: ballots.map(b => b.verifier), rows }
}

const findingsSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          location: { type: 'string' },
          claim: { type: 'string' },
          evidence: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          confidence: { type: 'number' },
          fix: { type: 'string' },
        },
        required: ['title', 'location', 'claim', 'evidence', 'severity', 'confidence', 'fix'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
}

const verdictsSchema = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          findingId: { type: 'string' },
          vote: { type: 'string', enum: ['confirmed', 'rejected', 'not-a-bug', 'uncertain'] },
          reason: { type: 'string' },
        },
        required: ['findingId', 'vote', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
}

function preamble(instance, layer) {
  return [
    args.framing,
    'You are council member "' + instance.label + '" (' + instance.instanceId + ') on layer "' + layer.id + '".',
    'You have no parent conversation and you cannot see the other members. The shared workspace is the only common ground.',
    'THE TASK:\n' + args.task,
  ].join('\n\n')
}

function renderFindings(findings) {
  return findings.map(f => [
    '### ' + f.id + ' — ' + f.title,
    'location: ' + f.location,
    'reported by: ' + f.reportedBy.join(', '),
    'claim: ' + f.claim,
    'evidence: ' + f.evidence,
    'severity: ' + f.severity + ' (author confidence ' + f.confidence + ')',
    'proposed fix: ' + (f.fix === '' ? '(none)' : f.fix),
  ].join('\n')).join('\n\n')
}

// ---- run ----

let findings = []
let clustered = []
let ballots = []
let table = null
let reportingMembers = new Set()

for (const layer of args.layers) {
  phase(layer.id)

  if (layer.kind === 'map') {
    const outputs = await parallel(layer.instances.map(instance => async () => {
      const prompt = preamble(instance, layer) + '\n\n' + instance.prompt
        + (args.reduceMode === 'vote'
          ? '\n\nReturn your findings. An empty list is a valid and respectable answer.'
          : '\n\nReturn your findings; use the location field for whatever you are describing.')
      const options = { label: instance.label, phase: layer.id }
      if (instance.model !== undefined) options.model = instance.model
      if (instance.provider !== undefined) options.provider = instance.provider
      options.schema = findingsSchema
      const raw = await agent(prompt, options)
      return { instanceId: instance.instanceId, raw }
    }))

    for (const output of outputs) {
      if (output === null || output.raw === null || typeof output.raw !== 'object') continue
      const list = Array.isArray(output.raw.findings) ? output.raw.findings : []
      for (const candidate of list) {
        const finding = readFinding(candidate)
        if (finding === null) continue
        findings.push({ by: output.instanceId, finding })
        reportingMembers.add(output.instanceId)
      }
    }
    if (args.reduceMode === 'vote') {
      clustered = dedupeFindings(findings)
      if (clustered.length > args.maxFindings) clustered = clustered.slice(0, args.maxFindings)
    }
    log('map layer "' + layer.id + '": ' + findings.length + ' findings from '
      + reportingMembers.size + ' members'
      + (args.reduceMode === 'vote' ? ', ' + clustered.length + ' after deduplication' : ''))
    continue
  }

  if (layer.kind === 'verify') {
    if (clustered.length === 0) { log('verify layer "' + layer.id + '": nothing to verify'); continue }
    const listing = renderFindings(clustered)
    const outputs = await parallel(layer.instances.map(instance => async () => {
      const prompt = preamble(instance, layer)
      + '\n\n' + instance.prompt
      + '\n\nFINDINGS TO VERIFY — return exactly one verdict per id, and no id that is not listed:\n\n' + listing
      const options = { label: instance.label, phase: layer.id, schema: verdictsSchema }
      if (instance.model !== undefined) options.model = instance.model
      if (instance.provider !== undefined) options.provider = instance.provider
      const raw = await agent(prompt, options)
      return { verifier: instance.instanceId, raw }
    }))

    const ids = new Set(clustered.map(f => f.id))
    for (const output of outputs) {
      if (output === null || output.raw === null || typeof output.raw !== 'object') continue
      const list = Array.isArray(output.raw.verdicts) ? output.raw.verdicts : []
      const seen = new Set()
      const verdicts = []
      for (const candidate of list) {
        if (candidate === null || typeof candidate !== 'object') continue
        if (!ids.has(candidate.findingId) || seen.has(candidate.findingId)) continue
        if (!['confirmed', 'rejected', 'not-a-bug', 'uncertain'].includes(candidate.vote)) continue
        if (!normalizedText(candidate.reason)) continue
        seen.add(candidate.findingId)
        verdicts.push({ findingId: candidate.findingId, vote: candidate.vote, reason: candidate.reason })
      }
      ballots.push({ verifier: output.verifier, verdicts })
    }
    table = tally(clustered, ballots, layer.quorumRule, layer.quorumThreshold)
    log('verify layer "' + layer.id + '": ' + ballots.length + ' of '
      + layer.instances.length + ' ballots returned')
    continue
  }

  // reduce
  const instance = layer.instances[0]
  const body = args.reduceMode === 'vote' && table !== null
    ? 'VERDICT TABLE (votes in verifier order ' + JSON.stringify(table.verifiers) + '):\n'
      + JSON.stringify({ findings: clustered, ballots: ballots, tally: table }, null, 2)
    : 'MEMBER REPORTS:\n' + JSON.stringify({ findings }, null, 2)
  const options = { label: instance.label, phase: layer.id }
  if (instance.model !== undefined) options.model = instance.model
  if (instance.provider !== undefined) options.provider = instance.provider
  const report = await agent(preamble(instance, layer) + '\n\n' + instance.prompt + '\n\n' + body, options)
  return {
    findings: clustered,
    ballots: ballots,
    tally: table,
    report: typeof report === 'string' ? report : '',
    membersReporting: reportingMembers.size,
  }
}

return {
  findings: clustered,
  ballots: ballots,
  tally: table,
  report: '',
  membersReporting: reportingMembers.size,
}
`
