import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
//#region src/presets.ts
/**
* Shared contract every map child obeys. Kept in one place because a finding
* that omits `location` cannot be deduplicated and a finding that restates its
* own claim as `evidence` cannot be verified — both failures are silent.
*/
const MAP_CONTRACT = [
	"Report only what you verified yourself in the workspace. Open the files, run what you can.",
	"Every finding needs a concrete `location` as `path:line` (or `path` when the whole file is the subject) — it is the deduplication key, and a finding without one is discarded.",
	"`evidence` must be an observation: a quoted line, a reproduction, a failing assertion. Restating `claim` in other words is not evidence and will be voted down.",
	"Report nothing rather than something plausible. A speculative finding costs three verifiers their time and trains the reader to distrust the table.",
	"Stay inside your lens. Another role covers the ground you are tempted to stray into."
].join("\n");
/**
* Shared contract every verifier obeys. The independence clause is the point
* of the layer: a verifier that reasons from the finding text alone measures
* how convincing the wording is, not whether the claim holds.
*/
const VERIFY_CONTRACT = [
	"For each finding, go back to the cited location and form your own judgement from the source. Do not reason from the finding text alone.",
	"Vote `confirmed` only when you reproduced the problem or read the defect yourself.",
	"Vote `rejected` when the factual claim is wrong.",
	"Vote `not-a-bug` when the claim is factually right but the behaviour is correct, intended, or already handled elsewhere — say where.",
	"Vote `uncertain` when you could not reach the evidence. It is an honest answer and it never counts toward confirmation, so use it instead of guessing.",
	"`reason` is mandatory and must name what you looked at. \"Looks right\" is not a reason.",
	"You are graded on being right, not on agreeing. A well-argued rejection is the most valuable thing you can produce."
].join("\n");
/** The four shipped topologies. */
const BUILTIN_PRESETS = [
	{
		id: "bug-hunt",
		label: "Bug hunt",
		description: "Find defects in a diff, module, or design, then cross-verify each one independently. Use when the answer is a list of discrete problems.",
		reduceMode: "vote",
		framing: "A council of independent agents is auditing the subject below. You are one member. You share the workspace but no conversation.",
		layers: [
			{
				id: "map",
				kind: "map",
				roles: [
					{
						id: "correctness",
						label: "Correctness",
						prompt: `Your lens is logic and data flow. Look for inverted comparisons, wrong operands, off-by-one, sign errors, mixed-up units or estimators, unhandled empty and null cases, and state that is read before it is written.\n\n${MAP_CONTRACT}`
					},
					{
						id: "api-contract",
						label: "API contract",
						prompt: `Your lens is the seams between modules. Look for callers passing arguments the callee no longer accepts, renamed or reordered parameters, return shapes that changed, duplicated logic whose copies have already diverged, and invariants documented in one place and enforced in another.\n\n${MAP_CONTRACT}`
					},
					{
						id: "perf-scale",
						label: "Performance & scale",
						prompt: `Your lens is what happens at production size. Look for accidental quadratic work, per-row allocations in hot loops, unbounded collections, exact algorithms where an approximate one is assumed (and the reverse), and work repeated per call that could be hoisted.\n\n${MAP_CONTRACT}`
					},
					{
						id: "tests",
						label: "Tests",
						prompt: `Your lens is the test suite. Look for tests that will fail on this change, tests that assert the old behaviour, tolerances too tight or too loose for the arithmetic involved, and behaviour with no test at all. When a test must change, say whether the fix is the expectation or the tolerance — they are different bugs.\n\n${MAP_CONTRACT}`
					}
				]
			},
			{
				id: "verify",
				kind: "verify",
				quorum: { rule: "majority" },
				roles: [
					{
						id: "V1",
						label: "Replicator",
						prompt: `You re-derive. Go to each cited location and work out from the source whether the claim holds, as if you had never seen the finding. Ignore how confident the author sounded.\n\n${VERIFY_CONTRACT}`
					},
					{
						id: "V2",
						label: "Devil's advocate",
						prompt: `You argue the other side. For each finding, build the strongest case that it is NOT a defect: the behaviour is intended, the caller already guarantees the precondition, the path is unreachable, the author misread the code. Then vote honestly on whether your own case survived contact with the source. A finding you could not argue away is strong evidence, and saying so is the right answer.\n\n${VERIFY_CONTRACT}`
					},
					{
						id: "V3",
						label: "Impact",
						prompt: `You assume the claim is true and ask what it costs. Trace who reaches this code, under what inputs, and what a user sees when it goes wrong. A true statement about dead code, a debug-only path, or an already-guarded case is real but is \`not-a-bug\` for action purposes — vote that way and say why.\n\n${VERIFY_CONTRACT}`
					}
				]
			},
			{
				id: "reduce",
				kind: "reduce",
				roles: [{
					id: "synthesizer",
					label: "Synthesizer",
					prompt: [
						"You write the final report from the verdict table you are given. You do not re-litigate votes and you do not add findings of your own.",
						"",
						"Produce, in this order:",
						"1. One paragraph: what was audited and what the council concluded.",
						"2. The confirmed findings, ordered by what a maintainer should fix first — severity and blast radius, not the order they arrived in. For each: the defect in one line, the location, and the concrete change.",
						"3. Rejected and not-a-bug findings in one compact list with the one-line reason each was set aside. This section is why the reader can trust the first one; never drop it.",
						"4. Anything marked uncertain or insufficient, named as unresolved rather than silently omitted.",
						"",
						"Attribute conclusions to the council, not to certainty: \"two of three verifiers confirmed\", not \"confirmed\". Verifiers are agents re-reading the same repository, not an independent oracle."
					].join("\n")
				}]
			}
		]
	},
	{
		id: "research",
		label: "Research",
		description: "Investigate a question from several angles at once and merge the results into one document. Use when the answer is prose, not a defect list.",
		reduceMode: "synthesis",
		framing: "A council of independent researchers is investigating the question below. You are one member. Work only from sources you can actually reach.",
		layers: [{
			id: "map",
			kind: "map",
			roles: [
				{
					id: "prior-art",
					label: "Prior art",
					prompt: "Find what already exists — in this repository, in its dependencies, and in the documented state of the art. Report what each option actually does, with references. Say plainly when you found nothing."
				},
				{
					id: "constraints",
					label: "Constraints",
					prompt: "Establish the hard limits: what the current architecture, data volumes, dependencies, platform floors, and stated invariants make impossible or expensive. Cite where each constraint is written down or measured."
				},
				{
					id: "tradeoffs",
					label: "Trade-offs",
					prompt: "For the candidate directions, lay out what each one costs and what it buys — complexity, runtime, migration, ongoing maintenance. Refuse to declare a winner; that is the reducer's job and premature ranking hides the alternatives."
				},
				{
					id: "risks",
					label: "Risks & unknowns",
					prompt: "Name what could go wrong and what nobody has established yet. Distinguish \"we measured this and it is bad\" from \"nobody has measured this\". Unknowns are findings."
				}
			]
		}, {
			id: "reduce",
			kind: "reduce",
			roles: [{
				id: "synthesizer",
				label: "Synthesizer",
				prompt: "Merge the members' reports into one document: the question, what is established (with sources), where the members disagreed and on what evidence, what remains unknown, and what you would do next. Preserve disagreement instead of averaging it — two members contradicting each other is a result, not noise."
			}]
		}]
	},
	{
		id: "feature-design",
		label: "Feature design",
		description: "Explore competing designs for a feature, have them criticised, and pick one with the trade-offs written down. Use for ADRs and design reviews.",
		reduceMode: "synthesis",
		framing: "A design council is choosing an approach for the work below. You are one member. Ground every claim in this repository as it exists today.",
		layers: [
			{
				id: "map",
				kind: "map",
				roles: [
					{
						id: "minimal",
						label: "Minimal",
						prompt: "Design the smallest change that genuinely solves the problem. Reuse what exists. Name explicitly what you are choosing not to support and why that is acceptable."
					},
					{
						id: "idiomatic",
						label: "Idiomatic",
						prompt: "Design the version that fits this codebase's existing conventions and extension points best, even if it is larger. Cite the patterns you are following and where they are established."
					},
					{
						id: "ambitious",
						label: "Ambitious",
						prompt: "Design the version that would still be right in two years, then state honestly what it costs now and which parts could be deferred without painting the project into a corner."
					}
				]
			},
			{
				id: "verify",
				kind: "verify",
				quorum: { rule: "majority" },
				roles: [{
					id: "V1",
					label: "Feasibility",
					prompt: `Treat each proposal as a claim that it can be built here. Check its assumptions against the actual code: do the APIs it needs exist with those signatures, are the extension points real, does the build allow it? Vote \`rejected\` on a proposal resting on something that is not there.\n\n${VERIFY_CONTRACT}`
				}, {
					id: "V2",
					label: "Maintenance",
					prompt: `Judge each proposal by what it does to whoever maintains it. Look for duplicated invariants, config that must be kept in sync by hand, test surface that will rot, and abstractions with exactly one implementation. Vote \`not-a-bug\` when a cost is real but genuinely acceptable, and say why.\n\n${VERIFY_CONTRACT}`
				}]
			},
			{
				id: "reduce",
				kind: "reduce",
				roles: [{
					id: "synthesizer",
					label: "Synthesizer",
					prompt: "Write a decision record: the problem, the options as proposed, what the critics established about each, the recommendation, and the consequences the team accepts by taking it. If the critics killed every option, say that and describe what would have to change instead of picking the least damaged one."
				}]
			}
		]
	},
	{
		id: "refactor",
		label: "Refactor safety",
		description: "Plan a refactor and have the plan checked for regression risk before anything is changed. Use before touching code with weak test coverage.",
		reduceMode: "vote",
		framing: "A council is assessing the refactor described below. Nothing is being changed yet: the output is a plan and its risks.",
		layers: [
			{
				id: "map",
				kind: "map",
				roles: [{
					id: "plan",
					label: "Plan",
					prompt: `Produce the ordered sequence of mechanical steps, each independently reviewable and each leaving the tree building. Report each step as a finding whose \`location\` is the file it touches.\n\n${MAP_CONTRACT}`
				}, {
					id: "coupling",
					label: "Coupling",
					prompt: `Map what actually depends on the code being moved: callers, tests, generated artifacts, config that names symbols by string, and documentation asserting the current shape. Report each unnoticed dependency as a finding.\n\n${MAP_CONTRACT}`
				}]
			},
			{
				id: "verify",
				kind: "verify",
				quorum: { rule: "unanimous" },
				roles: [
					{
						id: "V1",
						label: "Behaviour",
						prompt: `For each step, decide whether it is genuinely behaviour-preserving. Look for silently changed evaluation order, defaults, error paths, and identity comparisons. Vote \`rejected\` on any step that changes observable behaviour while claiming not to.\n\n${VERIFY_CONTRACT}`
					},
					{
						id: "V2",
						label: "Coverage",
						prompt: `For each step, decide whether an existing test would actually catch a mistake in it. Untested surface is the finding, not the refactor itself. Vote \`uncertain\` when you cannot tell which test covers a path — that is exactly the signal the reader needs.\n\n${VERIFY_CONTRACT}`
					},
					{
						id: "V3",
						label: "Rollback",
						prompt: `For each step, decide whether it can be reverted alone once merged. Data migrations, on-disk format changes, and published contracts are one-way doors; flag them as such.\n\n${VERIFY_CONTRACT}`
					}
				]
			},
			{
				id: "reduce",
				kind: "reduce",
				roles: [{
					id: "synthesizer",
					label: "Synthesizer",
					prompt: "Write the refactor plan: the ordered steps that passed unanimously, then the steps that did not with the specific objection against each, then the one-way doors, then what to test first. A unanimous quorum means a single objection blocks a step — present blocked steps as work to be redesigned, not as work to be done carefully."
				}]
			}
		]
	}
];
//#endregion
//#region src/policy.ts
/**
* The council's deployment policy: the schema, the structural validation, and
* the role expansion. Owned here, apart from the tool and the host rows, so the
* always-composed host row can validate the same policy it publishes and mirrors
* without dragging in the tool's `ctx.tools`/workflow dependencies.
*
* @module @starsinc1708/dsh-tool-council
*/
const Quorum = z.object({
	rule: z.union([
		"majority",
		"unanimous",
		"threshold"
	]).default("majority"),
	threshold: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)
});
const Role = z.object({
	id: z.string().required(),
	label: z.string(),
	prompt: z.string().required(),
	count: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(1),
	model: z.string(),
	provider: z.string()
});
const Layer = z.object({
	id: z.string().required(),
	kind: z.union([
		"map",
		"verify",
		"reduce"
	]).required(),
	label: z.string(),
	roles: z.array(Role).default([]),
	quorum: Quorum.default(void 0)
});
const Preset = z.object({
	id: z.string().required(),
	label: z.string(),
	description: z.string().required(),
	reduceMode: z.union(["vote", "synthesis"]).default("vote"),
	framing: z.string().default(""),
	layers: z.array(Layer).default([])
});
/** Schemastery configuration for the council tool. */
const Config = z.object({
	toolName: z.string().default("council"),
	subagentProvider: z.string().default("spawn"),
	presets: z.array(Preset).default([...BUILTIN_PRESETS]),
	defaultPreset: z.string().default("bug-hunt"),
	maxAgentsPerLayer: z.number().step(1).min(1).max(64).default(12),
	maxLayers: z.number().step(1).min(1).max(16).default(6),
	maxFindings: z.number().step(1).min(1).max(1e4).default(200),
	maxFindingChars: z.number().step(1).min(1).max(1e5).default(2e3),
	maxReportChars: z.number().step(1).min(1).max(1e6).default(32768)
});
/**
* Validate the composition at load, not at call.
*
* Schemastery cannot express the structural rules a council depends on — one
* trailing reduce layer with exactly one role, a quorum exactly where a verify
* layer is, unique ids — and a topology that violates them produces a run that
* silently drops a layer instead of failing. A bad config must break the
* deployment.
* @param config - the loader-normalized configuration.
* @returns the validated policy every call reuses.
* @throws TypeError on any structural violation, naming the offending preset.
*/
function resolveConfig(config) {
	const presets = config.presets ?? [...BUILTIN_PRESETS];
	const maxAgentsPerLayer = config.maxAgentsPerLayer ?? 12;
	const maxLayers = config.maxLayers ?? 6;
	if (presets.length === 0) throw new TypeError("council: at least one preset is required");
	const ids = /* @__PURE__ */ new Set();
	for (const preset of presets) {
		const where = `council preset "${preset.id}"`;
		if (ids.has(preset.id)) throw new TypeError(`${where}: duplicate preset id`);
		ids.add(preset.id);
		if (preset.layers.length === 0) throw new TypeError(`${where}: has no layers`);
		if (preset.layers.length > maxLayers) throw new TypeError(`${where}: ${preset.layers.length} layers exceeds maxLayers ${maxLayers}`);
		const last = preset.layers[preset.layers.length - 1];
		/* v8 ignore next -- length was checked above; the index cannot be empty. */
		if (last === void 0) throw new TypeError(`${where}: has no layers`);
		if (last.kind !== "reduce") throw new TypeError(`${where}: the last layer must be a reduce layer`);
		if (preset.layers.slice(0, -1).some((layer) => layer.kind === "reduce")) throw new TypeError(`${where}: only the last layer may be a reduce layer`);
		const verifyCount = preset.layers.filter((layer) => layer.kind === "verify").length;
		if (verifyCount > 1) throw new TypeError(`${where}: at most one verify layer is supported (${verifyCount} declared)`);
		validateLayers(preset, maxAgentsPerLayer, where);
	}
	const defaultId = config.defaultPreset ?? "bug-hunt";
	const defaultPreset = presets.find((preset) => preset.id === defaultId);
	if (defaultPreset === void 0) throw new TypeError(`council: defaultPreset "${defaultId}" is not among the configured presets`);
	return {
		toolName: config.toolName ?? "council",
		subagentProvider: config.subagentProvider ?? "spawn",
		presets,
		defaultPreset,
		maxFindings: config.maxFindings ?? 200,
		maxFindingChars: config.maxFindingChars ?? 2e3,
		maxReportChars: config.maxReportChars ?? 32768
	};
}
/**
* Validate every layer of one preset.
* @param preset - the preset under validation.
* @param maxAgentsPerLayer - the deployment's width ceiling.
* @param where - the error prefix naming the preset.
* @throws TypeError on a duplicate id, a misplaced quorum, or an over-wide layer.
*/
function validateLayers(preset, maxAgentsPerLayer, where) {
	const layerIds = /* @__PURE__ */ new Set();
	for (const layer of preset.layers) {
		if (layerIds.has(layer.id)) throw new TypeError(`${where}: duplicate layer id "${layer.id}"`);
		layerIds.add(layer.id);
		if (layer.roles.length === 0) throw new TypeError(`${where}: layer "${layer.id}" has no roles`);
		const width = layer.roles.reduce((sum, role) => sum + (role.count ?? 1), 0);
		if (width > maxAgentsPerLayer) throw new TypeError(`${where}: layer "${layer.id}" width ${width} exceeds maxAgentsPerLayer ${maxAgentsPerLayer}`);
		const roleIds = /* @__PURE__ */ new Set();
		for (const role of layer.roles) {
			if (roleIds.has(role.id)) throw new TypeError(`${where}: layer "${layer.id}" has a duplicate role id "${role.id}"`);
			roleIds.add(role.id);
			if (role.prompt.trim().length === 0) throw new TypeError(`${where}: role "${role.id}" has an empty prompt`);
		}
		if (layer.kind === "verify" && layer.quorum === void 0) throw new TypeError(`${where}: verify layer "${layer.id}" needs a quorum`);
		if (layer.kind !== "verify" && layer.quorum !== void 0) throw new TypeError(`${where}: only a verify layer may declare a quorum ("${layer.id}")`);
		if (layer.kind === "verify" && layer.quorum?.rule === "threshold") {
			const threshold = layer.quorum.threshold;
			if (threshold === void 0 || threshold < 1 || threshold > width) throw new TypeError(`${where}: verify layer "${layer.id}" needs a threshold between 1 and its width ${width}`);
		}
		if (layer.kind === "reduce" && (layer.roles.length !== 1 || (layer.roles[0]?.count ?? 1) !== 1)) throw new TypeError(`${where}: reduce layer "${layer.id}" must have exactly one role instance`);
	}
}
/**
* Expand `RoleConfig.count` into the concrete instances the script fans out.
*
* A single-instance role keeps its bare id so the report's column header reads
* `V1`, not `V1#1`.
* @param preset - the preset whose layers are being expanded.
* @returns the script-facing layers, in composition order.
*/
function expandLayers(preset) {
	return preset.layers.map((layer) => {
		const instances = [];
		for (const role of layer.roles) {
			const count = role.count ?? 1;
			for (let copy = 1; copy <= count; copy += 1) {
				const instanceId = count === 1 ? role.id : `${role.id}#${copy}`;
				instances.push({
					instanceId,
					label: role.label ?? role.id,
					prompt: role.prompt,
					...role.model === void 0 ? {} : { model: role.model },
					...role.provider === void 0 ? {} : { provider: role.provider }
				});
			}
		}
		return {
			id: layer.id,
			kind: layer.kind,
			quorumRule: layer.quorum?.rule ?? "majority",
			quorumThreshold: layer.quorum?.threshold,
			instances
		};
	});
}
//#endregion
//#region src/recorder.ts
/**
* Create a recorder that mirrors each workflow event into the parent session.
* @param ctx - the council tool's plugin context.
* @returns the start/finish/abandon handle.
*/
function createCouncilRecorder(ctx) {
	const active = /* @__PURE__ */ new Map();
	const append = (session, type, data) => {
		try {
			session.append(type, data);
			return true;
		} catch (error) {
			ctx.logger.warn("dsh-tool-council: disabled durable record after %s append failed: %s", type, String(error));
			return false;
		}
	};
	ctx.on("workflow/agent-start", (info, agent) => {
		const session = active.get(info.id);
		if (session === void 0) return;
		if (!append(session, "tool-workflow/agent-start", {
			runId: info.id,
			seq: agent.seq,
			label: agent.label,
			...agent.phase === void 0 ? {} : { phase: agent.phase },
			childId: agent.childId
		})) active.delete(info.id);
	});
	ctx.on("workflow/agent-end", (info, agent) => {
		const session = active.get(info.id);
		if (session === void 0) return;
		if (!append(session, "tool-workflow/agent-end", {
			runId: info.id,
			seq: agent.seq,
			outcome: agent.outcome
		})) active.delete(info.id);
	});
	ctx.on("workflow/log", (info, message) => {
		const session = active.get(info.id);
		if (session === void 0) return;
		append(session, "tool-council/log", {
			runId: info.id,
			message
		});
	});
	return {
		start(session, run) {
			if (append(session, "tool-workflow/run-start", {
				runId: run.id,
				name: run.meta.name
			})) active.set(run.id, session);
			append(session, "tool-council/run-start", {
				runId: run.id,
				name: run.meta.name
			});
		},
		finish(runId, stopReason) {
			const session = active.get(runId);
			if (session !== void 0) append(session, "tool-workflow/run-end", {
				runId,
				stopReason
			});
			active.delete(runId);
		},
		abandon(runId) {
			active.delete(runId);
		}
	};
}
//#endregion
//#region src/settings.ts
/** The settings namespace this package serves. Also the settings-card slot key. */
const COUNCIL_NAMESPACE = "council";
/**
* Apply the user overlay to the composition's presets.
*
* Unknown preset, layer, or role keys are ignored rather than refused: a user
* document survives a composition change that removed a role, and the next
* write simply drops the stale key. Structural rules stay with the
* composition — an overlay may change a width or a model, never a topology.
* @param presets - the composition's presets.
* @param overrides - the user overlay, keyed by preset id.
* @returns presets with widths, models, and quorums overlaid.
*/
function applyOverrides(presets, overrides) {
	if (overrides === void 0) return [...presets];
	return presets.map((preset) => {
		const override = overrides[preset.id];
		if (override === void 0) return preset;
		return {
			...preset,
			layers: preset.layers.map((layer) => {
				const quorumOverride = override.quorums?.[layer.id];
				return {
					...layer,
					roles: layer.roles.map((role) => {
						const roleOverride = override.roles?.[`${layer.id}.${role.id}`];
						if (roleOverride === void 0) return role;
						return {
							...role,
							...roleOverride.count === void 0 ? {} : { count: roleOverride.count },
							...roleOverride.model === void 0 || roleOverride.model === "" ? {} : { model: roleOverride.model },
							...roleOverride.provider === void 0 || roleOverride.provider === "" ? {} : { provider: roleOverride.provider }
						};
					}),
					...layer.quorum === void 0 || quorumOverride === void 0 ? {} : { quorum: {
						rule: quorumOverride.rule ?? layer.quorum.rule,
						...(quorumOverride.threshold ?? layer.quorum.threshold) === void 0 ? {} : { threshold: quorumOverride.threshold ?? layer.quorum.threshold }
					} }
				};
			})
		};
	});
}
//#endregion
//#region src/script.ts
/** The plain-JS body handed to `WorkflowEngine.start`. */
const COUNCIL_SCRIPT = String.raw`
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
`;
//#endregion
//#region src/tally.ts
/** Tokens dropped before fingerprinting a title; they carry no discriminating signal. */
const STOP_WORDS = /* @__PURE__ */ new Set([
	"the",
	"a",
	"an",
	"is",
	"are",
	"in",
	"on",
	"of",
	"to",
	"for",
	"and",
	"or",
	"not",
	"не",
	"в",
	"на",
	"и",
	"или",
	"по",
	"из",
	"что",
	"это"
]);
/**
* Reduce a headline to an order-insensitive token signature.
* @param title - the finding's headline, in any case or word order.
* @returns sorted, deduplicated, stop-word-free lowercase tokens joined by `-`.
*/
function fingerprint(title) {
	const tokens = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((token) => token.length > 0 && !STOP_WORDS.has(token));
	return [...new Set(tokens)].sort().join("-");
}
/**
* Normalize a location so `./src/rank.py:521` and `src/rank.py:521` cluster.
* @param location - the reported path, optionally suffixed with `:line`.
* @returns the path without a leading `./`, with backslashes folded to `/`.
*/
function normalizeLocation(location) {
	return location.trim().replace(/\\/gu, "/").replace(/^\.\//u, "");
}
/**
* Cluster findings that name the same location and the same claim.
*
* The surviving representative is the first-seen member, because it is the one
* the verify layer's prompt already quoted when the script deduplicated. Later
* members contribute only their reporter and their title variant.
* @param reported - every map-layer finding, in stable child order.
* @returns one cluster per distinct `location|fingerprint` pair, first-seen order.
*/
function dedupeFindings(reported) {
	const clusters = /* @__PURE__ */ new Map();
	for (const { by, finding } of reported) {
		const fp = fingerprint(finding.title);
		const titleKey = fp === "" ? finding.title.toLowerCase().trim() : fp;
		const key = `${normalizeLocation(finding.location)}|${titleKey}`;
		const existing = clusters.get(key);
		if (existing === void 0) {
			clusters.set(key, {
				finding,
				reportedBy: [by],
				variants: [finding.title]
			});
			continue;
		}
		if (!existing.reportedBy.includes(by)) existing.reportedBy.push(by);
		if (!existing.variants.includes(finding.title)) existing.variants.push(finding.title);
	}
	return [...clusters.values()].map((cluster, index) => ({
		...cluster.finding,
		id: `f${index + 1}`,
		reportedBy: cluster.reportedBy,
		variants: cluster.variants
	}));
}
/**
* Apply one quorum rule to one finding's counts.
*
* `uncertain` never confirms: it only denies unanimity. When the rule does not
* confirm, the modal negative vote decides between `not-a-bug` (the fact holds
* but is not a defect) and `rejected` (the claim itself is wrong) — a
* distinction that changes the follow-up action, so it must survive the tally.
* @param counts - the vote counts for one finding.
* @param ballots - how many verifier ballots the layer actually collected.
* @param quorum - the layer's rule and, for `threshold`, its required count.
* @returns the finding's outcome, or `insufficient` below two ballots.
*/
function applyQuorum(counts, ballots, quorum) {
	if (ballots < 2) return "insufficient";
	if ((() => {
		switch (quorum.rule) {
			case "majority": return counts.confirmed > counts.rejected + counts.notABug;
			case "unanimous": return counts.confirmed === ballots;
			case "threshold": return counts.confirmed >= (quorum.threshold ?? ballots);
		}
	})()) return "confirmed";
	if (counts.rejected === 0 && counts.notABug === 0) return "insufficient";
	return counts.notABug > counts.rejected ? "not-a-bug" : "rejected";
}
/**
* Build the verdict table from the verify layer's ballots.
*
* A verifier that returned no verdict for a finding contributes `null` to that
* row rather than a silent abstention, so a partially answered ballot is
* visible in the report instead of being read as agreement. (`null`, not
* `undefined`: the workflow engine's result materializer rejects `undefined`
* as non-JSON data.)
* @param findings - the deduplicated findings, in report order.
* @param ballots - one entry per surviving verifier instance, in layer order.
* @param quorum - the verify layer's quorum policy.
* @returns the column headers and one row per finding.
*/
function tally(findings, ballots, quorum) {
	const byVerifier = ballots.map((ballot) => new Map(ballot.verdicts.map((verdict) => [verdict.findingId, verdict.vote])));
	const rows = findings.map((finding) => {
		const votes = byVerifier.map((map) => map.get(finding.id) ?? null);
		const counts = {
			confirmed: 0,
			rejected: 0,
			notABug: 0,
			uncertain: 0
		};
		for (const vote of votes) if (vote === "confirmed") counts.confirmed += 1;
		else if (vote === "rejected") counts.rejected += 1;
		else if (vote === "not-a-bug") counts.notABug += 1;
		else if (vote === "uncertain") counts.uncertain += 1;
		return {
			findingId: finding.id,
			votes,
			counts,
			outcome: applyQuorum(counts, ballots.length, quorum)
		};
	});
	return {
		verifiers: ballots.map((ballot) => ballot.verifier),
		rows
	};
}
const VOTE_MARK = {
	"confirmed": "✅",
	"rejected": "❌",
	"not-a-bug": "➖",
	"uncertain": "❔"
};
const OUTCOME_LABEL = {
	"confirmed": "CONFIRMED",
	"rejected": "REJECTED",
	"not-a-bug": "NOT A BUG",
	"insufficient": "INSUFFICIENT"
};
/**
* Render the tally as a Markdown table for the parent model and the report.
* @param findings - the deduplicated findings, in report order.
* @param result - the tally produced by {@link tally} over the same findings.
* @returns a Markdown table, one row per finding, one column per verifier.
*/
function renderTable(findings, result) {
	const header = [
		"#",
		"Finding",
		"Location",
		...result.verifiers,
		"Outcome",
		"Fix"
	];
	return [
		header,
		header.map(() => "---"),
		...findings.map((finding, index) => {
			const row = result.rows[index];
			/* v8 ignore next -- tally() emits one row per finding; a mismatch is a caller bug. */
			if (row === void 0) throw new Error(`council: no tally row for finding ${finding.id}`);
			return [
				String(index + 1),
				cell(finding.title),
				cell(finding.location),
				...row.votes.map((vote) => vote === null ? "·" : VOTE_MARK[vote]),
				OUTCOME_LABEL[row.outcome],
				finding.fix === "" ? "—" : cell(finding.fix)
			];
		})
	].map((cells) => `| ${cells.join(" | ")} |`).join("\n");
}
/** Escape a user-provided table cell so `|` and newlines cannot break the Markdown table. */
function cell(value) {
	return value.replace(/\\/gu, "\\\\").replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ");
}
/**
* Compare a script-produced tally against the host's own recomputation.
*
* The script's tally crosses a structured-clone boundary and is therefore data,
* not a result the host may trust. Any divergence means the two copies of the
* quorum logic have drifted, which would silently change which findings a
* reviewer acts on.
* @param expected - the host's recomputation from the raw ballots.
* @param actual - the tally the workflow script returned.
* @throws Error when column order, row order, votes, counts, or outcomes differ.
*/
function assertTallyAgrees(expected, actual) {
	const render = (value) => JSON.stringify(value);
	if (render(expected) !== render(actual)) throw new Error("council: the script tally disagrees with the host recomputation");
}
//#endregion
//#region src/tool.ts
const name = "tool-council";
const inject = [
	"tools",
	"workflowEngine",
	"subagents",
	"systemPrompt"
];
/**
* Require a provider that starts a genuinely fresh, structured-output child.
*
* A council member seeded with the parent's transcript would inherit the
* parent's framing of the problem, which is exactly the correlation the layer
* exists to break.
* @param ctx - the plugin context carrying `ctx.subagents`.
* @param provider - the configured provider name.
* @returns the registered provider.
* @throws Error when the provider is absent, unstructured, or context-inheriting.
*/
function requireFreshProvider(ctx, provider) {
	const registered = ctx.subagents.getProvider(provider);
	if (registered === void 0) throw new Error(`council: subagent provider "${provider}" is not registered`);
	if (!registered.capabilities.outputSchema) throw new Error(`council: subagent provider "${provider}" does not support structured output`);
	if (registered.inheritsParentContext) throw new Error(`council: subagent provider "${provider}" inherits parent context; council members must be fresh`);
	return registered;
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Defensively decode the script's terminal value across the realm boundary.
* @param value - the workflow result value, as plain cloned data.
* @returns the decoded outcome.
* @throws Error when the value does not match the script's declared shape.
*/
function readOutcome(value) {
	if (!isRecord(value) || !Array.isArray(value["findings"]) || !Array.isArray(value["ballots"]) || typeof value["report"] !== "string" || typeof value["membersReporting"] !== "number") throw new Error("council: the workflow returned a malformed result");
	const table = value["tally"];
	if (table !== null && !isRecord(table)) throw new Error("council: the workflow returned a malformed tally");
	return {
		findings: value["findings"],
		ballots: value["ballots"],
		tally: table,
		report: value["report"],
		membersReporting: value["membersReporting"]
	};
}
/**
* Map a non-clean workflow stop reason to an error message.
* @param result - the settled workflow result.
* @returns the message, or `undefined` when the run completed cleanly.
*/
function stopReasonError(result) {
	switch (result.stopReason) {
		case "completed": return;
		case "cancelled": return `council run was cancelled${result.error === void 0 ? "" : ` (${result.error})`}`;
		case "error": return `council run failed: ${result.error ?? "unknown error"}`;
		/* v8 ignore start -- WorkflowStopReason is closed; a future variant must fail loud here. */
		default: return `council run ended abnormally (${String(result.stopReason)})`;
	}
}
const TRUNCATION_NOTICE = "\n… [truncated]";
/**
* Bound the parent-facing text, marker included.
* @param text - the rendered report.
* @param maxChars - the deployment's ceiling.
* @returns `text`, or a truncated copy ending in the notice.
*/
function bound(text, maxChars) {
	if (text.length <= maxChars) return text;
	if (maxChars <= 14) return TRUNCATION_NOTICE.slice(0, maxChars);
	return `${text.slice(0, maxChars - 14)}${TRUNCATION_NOTICE}`;
}
/**
* Render the council's result for the parent model.
*
* The quorum line is deliberately phrased as a count of members, not as a
* certification: verifiers are agents re-reading the same repository, and the
* table would otherwise read as an independent oracle.
* @param outcome - the validated script outcome.
* @param maxChars - the report ceiling.
* @returns the model-facing text.
*/
function renderOutcome(outcome, maxChars) {
	const parts = [];
	if (outcome.tally !== null) {
		if (outcome.findings.length > 0) {
			const confirmed = outcome.tally.rows.filter((row) => row.outcome === "confirmed").length;
			parts.push(`${outcome.membersReporting} council members reported ${outcome.findings.length} distinct findings; ${outcome.ballots.length} verifiers voted, confirming ${confirmed}.`, renderTable(outcome.findings, outcome.tally));
		} else parts.push(`${outcome.membersReporting} council members reported no findings.`);
	}
	if (outcome.report !== "") parts.push(outcome.report);
	return bound(parts.join("\n\n"), maxChars);
}
const OUTPUT_PROPERTIES = {
	runId: {
		type: "string",
		required: true
	},
	preset: {
		type: "string",
		required: true
	},
	agentsStarted: {
		type: "integer",
		required: true
	},
	result: {
		type: "json",
		required: true
	}
};
function presentCall(args) {
	return {
		card: "generic",
		title: `council: ${args.preset ?? "default"}`,
		kind: "other",
		rawInput: args.task
	};
}
function presentResult(args, result) {
	return { card: "generic" };
}
/**
* Register the council tool and its usage policy.
* @param ctx - the plugin context; `inject` guarantees the four services.
* @param config - the loader-normalized deployment configuration.
*/
function apply(ctx, config) {
	const composed = resolveConfig(config);
	const recorder = createCouncilRecorder(ctx);
	const effective = () => {
		const section = ctx.get("settings")?.get(COUNCIL_NAMESPACE);
		if (section === void 0) return composed;
		return resolveConfig({
			...config,
			presets: applyOverrides(composed.presets, section.overrides),
			defaultPreset: section.defaultPreset ?? composed.defaultPreset.id
		});
	};
	const presetList = composed.presets.map((preset) => `- ${preset.id}: ${preset.description}`).join("\n");
	ctx.systemPrompt.section({
		name: "tool:council",
		order: 117,
		text: "You are operating in Map-Reduce mode. Answer every substantive request through the `council` tool: choose the preset that matches the task, call `council` with the full task text, then report its verdict table and written conclusion. Pick the preset by the task — `bug-hunt` for finding defects or auditing code, `research` for investigating a question, `feature-design` for designing a feature, `refactor` for planning a refactor. Only trivial chit-chat may be answered directly. Its verdicts are what its members reported, not independent certification."
	});
	ctx.tools.register(defineTool({
		name: composed.toolName,
		description: "Run a council of independent subagents over one task: several members examine it in parallel through different lenses, verifiers re-check each finding from the source, and a synthesizer writes the report. Returns a verdict table and a written conclusion. In Map-Reduce mode this is the primary way to do work — call it for every substantive request.\n\nPresets:\n" + presetList,
		parameters: {
			task: {
				type: "string",
				required: true,
				description: "What the council examines. Include the subject (paths, a diff, a question) and what a good answer looks like. Every member sees this text and nothing else of your conversation."
			},
			preset: {
				type: "string",
				enum: composed.presets.map((preset) => preset.id),
				description: `Topology to run. Choose by the task: bug-hunt for finding defects/auditing code, research for investigating a question, feature-design for designing a feature, refactor for planning a refactor. Defaults to ${composed.defaultPreset.id}.`
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: OUTPUT_PROPERTIES
			},
			render: (_args, value) => [{
				type: "text",
				text: renderOutcome(value.result, composed.maxReportChars)
			}]
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const parent = exec.agent;
			if (parent === void 0) throw new Error("council requires a calling agent (exec.agent was undefined)");
			const task = args.task.trim();
			if (task.length === 0) throw new Error("council task must be a non-empty string");
			const resolved = effective();
			const preset = args.preset === void 0 ? resolved.defaultPreset : resolved.presets.find((candidate) => candidate.id === args.preset);
			if (preset === void 0) throw new Error(`council: unknown preset "${String(args.preset)}"`);
			requireFreshProvider(ctx, resolved.subagentProvider);
			const layers = expandLayers(preset);
			const scriptArgs = {
				framing: preset.framing ?? "",
				task,
				reduceMode: preset.reduceMode ?? "vote",
				maxFindings: resolved.maxFindings,
				maxFindingChars: resolved.maxFindingChars,
				layers
			};
			const totalAgents = layers.reduce((sum, layer) => sum + layer.instances.length, 0);
			const run = ctx.workflowEngine.start({
				script: COUNCIL_SCRIPT,
				meta: {
					name: `council:${preset.id}`,
					description: preset.description,
					phases: layers.map((layer) => ({
						title: layer.id,
						detail: `${layer.kind} — ${layer.instances.map((instance) => instance.label).join(", ")}`
					}))
				},
				args: scriptArgs,
				subagentProvider: resolved.subagentProvider,
				maxTotalAgents: totalAgents,
				parent,
				signal: exec.signal
			});
			recorder.start(parent.session, run);
			const onAbort = () => {
				run.cancel("parent step aborted");
			};
			exec.signal.addEventListener("abort", onAbort, { once: true });
			if (exec.signal.aborted) run.cancel("parent step aborted");
			let settled;
			try {
				settled = await run.result;
				const error = stopReasonError(settled);
				if (error !== void 0) throw new Error(error);
				const outcome = readOutcome(settled.value);
				if (outcome.tally !== null) {
					const quorum = preset.layers.find((layer) => layer.kind === "verify")?.quorum ?? { rule: "majority" };
					assertTallyAgrees(tally(outcome.findings, outcome.ballots, quorum), outcome.tally);
				}
				return {
					runId: run.id,
					preset: preset.id,
					agentsStarted: settled.agentsStarted,
					result: outcome
				};
			} finally {
				exec.signal.removeEventListener("abort", onAbort);
				try {
					await run.dispose();
					if (settled !== void 0) recorder.finish(run.id, settled.stopReason);
				} finally {
					recorder.abandon(run.id);
				}
			}
		},
		presentCall,
		presentResult
	}));
}
//#endregion
export { BUILTIN_PRESETS, COUNCIL_NAMESPACE, Config, apply, applyOverrides, applyQuorum, dedupeFindings, expandLayers, fingerprint, inject, name, normalizeLocation, readOutcome, renderOutcome, renderTable, resolveConfig, tally };
