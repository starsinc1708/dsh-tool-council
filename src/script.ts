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
  /** Per-member finding ceiling applied before clustering; `0` disables it. */
  readonly maxFindingsPerMember: number
  /** Wall-clock budget checked at each layer boundary; `0` disables it. */
  readonly maxRunMs: number
  /** Re-issue one `agent()` call whose child died before giving up on it. */
  readonly retryFailedMembers: boolean
  /** Run the same-location merge stage between clustering and verification. */
  readonly mergeSameLocation: boolean
  /** Ceiling on clusters handed to the merge stage. */
  readonly maxMergeCandidates: number
  readonly layers: readonly ScriptLayer[]
}

/** Why the script stopped: cleanly, or because it ran out of its time budget. */
export type ScriptStopReason = 'completed' | 'deadline'

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

function capPerMember(reported, perMember) {
  if (!(perMember > 0)) return reported.slice()
  const seen = new Map()
  const kept = []
  for (const entry of reported) {
    const count = seen.get(entry.by) ?? 0
    if (count >= perMember) continue
    seen.set(entry.by, count + 1)
    kept.push(entry)
  }
  return kept
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

function mergeClusters(clustered, groups) {
  const order = new Map(clustered.map((f, index) => [f.id, index]))
  const byId = new Map(clustered.map(f => [f.id, f]))
  const absorbedBy = new Map()
  const extra = new Map()
  const rootOf = (id) => {
    let current = id
    while (absorbedBy.has(current)) current = absorbedBy.get(current)
    return current
  }
  for (const group of groups) {
    const roots = [...new Set(group.filter(id => byId.has(id)).map(rootOf))]
    if (roots.length < 2) continue
    const sorted = roots.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    const survivor = sorted[0]
    const bucket = extra.get(survivor) ?? { reportedBy: [], variants: [] }
    for (const id of sorted.slice(1)) {
      absorbedBy.set(id, survivor)
      const source = byId.get(id)
      if (source === undefined) continue
      const inherited = extra.get(id) ?? { reportedBy: [], variants: [] }
      extra.delete(id)
      for (const by of [...source.reportedBy, ...inherited.reportedBy]) {
        if (!bucket.reportedBy.includes(by)) bucket.reportedBy.push(by)
      }
      for (const v of [...source.variants, ...inherited.variants]) {
        if (!bucket.variants.includes(v)) bucket.variants.push(v)
      }
    }
    extra.set(survivor, bucket)
  }
  if (absorbedBy.size === 0) return clustered.slice()
  return clustered.filter(f => !absorbedBy.has(f.id)).map((f, index) => {
    const bucket = extra.get(f.id)
    const reportedBy = f.reportedBy.slice()
    const variants = f.variants.slice()
    if (bucket !== undefined) {
      for (const by of bucket.reportedBy) if (!reportedBy.includes(by)) reportedBy.push(by)
      for (const v of bucket.variants) if (!variants.includes(v)) variants.push(v)
    }
    return { ...f, id: 'f' + (index + 1), reportedBy, variants }
  })
}

function applyQuorum(counts, participating, rule, threshold) {
  if (participating < 2) return 'insufficient'
  let confirmed
  if (rule === 'majority') confirmed = counts.confirmed > counts.rejected + counts.notABug
  else if (rule === 'unanimous') confirmed = counts.confirmed === participating
  else confirmed = counts.confirmed >= (threshold ?? participating)
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
    const participating = counts.confirmed + counts.rejected + counts.notABug + counts.uncertain
    return {
      findingId: finding.id, votes, counts, participating,
      outcome: applyQuorum(counts, participating, rule, threshold),
    }
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

const mergeSchema = {
  type: 'object',
  properties: {
    merges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['ids', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['merges'],
  additionalProperties: false,
}

const MERGE_PROMPT = [
  'You are the council\'s merge step. Several members examined the same subject independently, so',
  'one defect can arrive twice in different words. Below are groups of findings that name the SAME',
  'location but were worded differently enough that the deterministic pass kept them apart.',
  '',
  'For each group, return the id sets that describe ONE AND THE SAME defect — same root cause, same',
  'fix. Two different defects that merely live on the same line are NOT one finding; a symptom and',
  'its cause are NOT one finding. Return an empty list when nothing should be merged: that is the',
  'common and correct answer, and a wrong merge silently deletes a finding nobody will ever see.',
  'Never invent an id and never put an id in two sets.',
].join('\n')

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

// A dead child resolves its agent() call to null rather than throwing, so a
// single transport failure would silently remove a whole lens from the run.
// One bounded retry is the difference between a degraded council and a quiet one.
async function callAgent(prompt, options) {
  const first = await agent(prompt, options)
  if (first !== null || !args.retryFailedMembers) return first
  log('retrying "' + options.label + '" once after its child failed')
  return await agent(prompt, options)
}

// A worker without a clock cannot enforce the layer-boundary budget; the host's
// hard cancel is the only backstop then, and it returns nothing rather than
// partial findings. Guarded rather than assumed, because throwing here would
// cost the whole run instead of one feature.
function now() {
  return typeof Date === 'function' && typeof Date.now === 'function' ? Date.now() : 0
}

// ---- run ----

const startedAt = now()
const deadline = args.maxRunMs > 0 && startedAt > 0 ? startedAt + args.maxRunMs : 0
let stopReason = 'completed'
let findings = []
let perMemberCount = new Map()
let clustered = []
let clusteredReady = false
let ballots = []
let table = null
let report = ''
let reportMissing = false
let mapMembers = 0
let respondingMembers = new Set()
let reportingMembers = new Set()

// Clustering happens ONCE, at the last map layer — not after every one.
// Re-clustering per layer rebuilt the list from scratch and threw away the
// previous layer's merge decisions (the ids they were expressed in no longer
// exist after renumbering), and it re-walked the whole accumulated list each
// time. The verify and reduce layers are the only readers and both run after
// every map layer, so once is also all that is needed.
let lastMapIndex = -1
for (let i = 0; i < args.layers.length; i += 1) {
  if (args.layers[i].kind === 'map') lastMapIndex = i
}

// Split the merge budget across the locations that need it instead of letting
// the first bucket take all of it: one hot file with maxMergeCandidates
// clusters would otherwise starve every other ambiguous location in the run.
function mergeGroups(list) {
  const byLocation = new Map()
  for (const f of list) {
    const key = normalizeLocation(f.location)
    const bucket = byLocation.get(key)
    if (bucket === undefined) byLocation.set(key, [f])
    else bucket.push(f)
  }
  const candidates = [...byLocation.entries()].filter(entry => entry[1].length >= 2)
  if (candidates.length === 0) return { groups: [], dropped: 0 }
  const share = Math.max(2, Math.floor(args.maxMergeCandidates / candidates.length))
  const groups = []
  let budget = args.maxMergeCandidates
  let dropped = 0
  for (const [location, bucket] of candidates) {
    const take = Math.min(bucket.length, share, budget)
    if (take < 2) { dropped += bucket.length; continue }
    budget -= take
    dropped += bucket.length - take
    groups.push({ location, findings: bucket.slice(0, take) })
  }
  return { groups, dropped }
}

// Deduplicate, optionally merge, then cap. allowMerge is false on the paths
// where no budget is left to spend a child (a deadline skipped the last map
// layer), so the findings still reach the reducer, just unmerged.
async function clusterFindings(phaseId, allowMerge) {
  clustered = dedupeFindings(capPerMember(findings, args.maxFindingsPerMember))
  if (allowMerge && args.mergeSameLocation && clustered.length > 1) {
    const candidates = mergeGroups(clustered)
    if (candidates.dropped > 0) {
      log('merge step: ' + candidates.dropped + ' same-location clusters exceeded maxMergeCandidates ('
        + args.maxMergeCandidates + ') and were left unmerged')
    }
    if (candidates.groups.length > 0) {
      const listing = candidates.groups
        .map(g => '## location: ' + g.location + '\n\n' + renderFindings(g.findings)).join('\n\n')
      const raw = await callAgent(
        args.framing + '\n\n' + MERGE_PROMPT + '\n\nCANDIDATE GROUPS:\n\n' + listing,
        { label: 'Merge', phase: phaseId, schema: mergeSchema },
      )
      const merges = raw !== null && typeof raw === 'object' && Array.isArray(raw.merges) ? raw.merges : []
      const idGroups = merges
        .filter(entry => entry !== null && typeof entry === 'object' && Array.isArray(entry.ids))
        .map(entry => entry.ids.filter(id => typeof id === 'string'))
      const beforeMerge = clustered.length
      clustered = mergeClusters(clustered, idGroups)
      if (clustered.length !== beforeMerge) {
        log('merge step: ' + beforeMerge + ' clusters folded into ' + clustered.length)
      }
    }
  }
  if (clustered.length > args.maxFindings) {
    log('capped ' + clustered.length + ' distinct findings to maxFindings ' + args.maxFindings)
    clustered = clustered.slice(0, args.maxFindings)
  }
  clusteredReady = true
}

for (const [layerIndex, layer] of args.layers.entries()) {
  // The budget is checked at layer boundaries: children already in flight are
  // not killed, and the trailing reduce layer still runs, so an over-budget run
  // returns the findings it did gather instead of nothing at all.
  if (deadline > 0 && now() > deadline && layer.kind !== 'reduce') {
    if (stopReason !== 'deadline') log('run budget of ' + args.maxRunMs + 'ms exhausted; skipping remaining examine/verify layers')
    stopReason = 'deadline'
    continue
  }

  phase(layer.id)

  if (layer.kind === 'map') {
    mapMembers += layer.instances.length
    const outputs = await parallel(layer.instances.map(instance => async () => {
      const prompt = preamble(instance, layer) + '\n\n' + instance.prompt
        + (args.reduceMode === 'vote'
          ? '\n\nReturn your findings. An empty list is a valid and respectable answer.'
          : '\n\nReturn your findings. Use "location" for whatever you are describing — a path, a file, or the'
            + ' design area — and "evidence" for the observation behind it. A finding with an empty "location"'
            + ' or "evidence" is discarded before anyone reads it.')
      const options = { label: instance.label, phase: layer.id }
      if (instance.model !== undefined) options.model = instance.model
      if (instance.provider !== undefined) options.provider = instance.provider
      options.schema = findingsSchema
      const raw = await callAgent(prompt, options)
      return { instanceId: instance.instanceId, raw }
    }))

    let acceptedHere = 0
    let respondedHere = 0
    for (const output of outputs) {
      if (output === null || output.raw === null || typeof output.raw !== 'object') continue
      // A member that answered with an empty list DID its job — the map prompt
      // calls that a respectable answer — so it counts as responding even though
      // it reported nothing. Conflating the two reads as four dead children.
      respondingMembers.add(output.instanceId)
      respondedHere += 1
      const list = Array.isArray(output.raw.findings) ? output.raw.findings : []
      for (const candidate of list) {
        const finding = readFinding(candidate)
        if (finding === null) continue
        // The per-member cap bites HERE, not at clustering time, so a member
        // that returns thousands of findings cannot grow the accumulated list
        // past (instances x maxFindingsPerMember) in the first place.
        const taken = perMemberCount.get(output.instanceId) ?? 0
        if (args.maxFindingsPerMember > 0 && taken >= args.maxFindingsPerMember) continue
        perMemberCount.set(output.instanceId, taken + 1)
        findings.push({ by: output.instanceId, finding })
        reportingMembers.add(output.instanceId)
        acceptedHere += 1
      }
    }
    log('map layer "' + layer.id + '": ' + respondedHere + ' of ' + layer.instances.length
      + ' members answered with ' + acceptedHere + ' findings')
    // Both reduce modes deduplicate, merge and cap. A synthesis preset that
    // skipped this had an unreachable verify layer (nothing to verify) and
    // handed the reducer an uncapped, undeduplicated list.
    if (layerIndex === lastMapIndex) {
      await clusterFindings(layer.id, true)
      log('deduplicated ' + findings.length + ' findings into ' + clustered.length + ' distinct')
    }
    continue
  }

  if (layer.kind === 'verify') {
    // Only reachable when a deadline skipped the last map layer; the findings
    // gathered before it still deserve a verdict, just without a merge child.
    if (!clusteredReady) await clusterFindings(layer.id, false)
    if (clustered.length === 0) { log('verify layer "' + layer.id + '": nothing to verify'); continue }
    const listing = renderFindings(clustered)
    const outputs = await parallel(layer.instances.map(instance => async () => {
      const prompt = preamble(instance, layer)
      + '\n\n' + instance.prompt
      + '\n\nFINDINGS TO VERIFY — return exactly one verdict per id, and no id that is not listed:\n\n' + listing
      const options = { label: instance.label, phase: layer.id, schema: verdictsSchema }
      if (instance.model !== undefined) options.model = instance.model
      if (instance.provider !== undefined) options.provider = instance.provider
      const raw = await callAgent(prompt, options)
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
  if (!clusteredReady) await clusterFindings(layer.id, false)
  const instance = layer.instances[0]
  const sections = []
  if (table !== null) {
    sections.push('VERDICT TABLE (votes in verifier order ' + JSON.stringify(table.verifiers) + '):\n'
      + JSON.stringify({ findings: clustered, ballots: ballots, tally: table }, null, 2))
  } else {
    sections.push('MEMBER REPORTS:\n' + JSON.stringify({ findings: clustered }, null, 2))
  }
  if (stopReason === 'deadline') {
    sections.push('NOTE: the run hit its time budget, so one or more layers did not run. '
      + 'Say so in your report instead of presenting this as a complete council.')
  }
  const options = { label: instance.label, phase: layer.id }
  if (instance.model !== undefined) options.model = instance.model
  if (instance.provider !== undefined) options.provider = instance.provider
  const written = await callAgent(
    preamble(instance, layer) + '\n\n' + instance.prompt + '\n\n' + sections.join('\n\n'),
    options,
  )
  if (typeof written === 'string' && written.trim().length > 0) {
    report = written
  } else {
    reportMissing = true
    log('reduce layer "' + layer.id + '": the synthesizer returned no report')
  }
}

return {
  findings: clustered,
  ballots: ballots,
  tally: table,
  report: report,
  reportMissing: reportMissing,
  membersReporting: reportingMembers.size,
  membersResponding: respondingMembers.size,
  mapMembers: mapMembers,
  stopReason: stopReason,
}
`
