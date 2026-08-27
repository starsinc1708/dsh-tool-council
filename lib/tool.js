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
/**
* Grace added to `maxRunMs` before the host cancels the run outright. The
* script's own budget check happens at layer boundaries, so it needs room to
* finish the layer it is in and write the report.
*/
const HARD_STOP_GRACE_MS = 6e4;
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
	maxFindingsPerMember: z.number().step(1).min(0).max(1e4).default(50),
	maxFindingChars: z.number().step(1).min(1).max(1e5).default(2e3),
	maxReportChars: z.number().step(1).min(1).max(1e6).default(32768),
	maxRunMs: z.number().step(1).min(0).max(864e5).default(0),
	retryFailedMembers: z.boolean().default(true),
	mergeSameLocation: z.boolean().default(true),
	maxMergeCandidates: z.number().step(1).min(2).max(1e3).default(60)
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
		const verifyAt = preset.layers.findIndex((layer) => layer.kind === "verify");
		if (verifyAt >= 0 && preset.layers.slice(verifyAt + 1).some((layer) => layer.kind === "map")) throw new TypeError(`${where}: a map layer may not follow the verify layer`);
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
		maxAgentsPerLayer,
		maxFindings: config.maxFindings ?? 200,
		maxFindingsPerMember: config.maxFindingsPerMember ?? 50,
		maxFindingChars: config.maxFindingChars ?? 2e3,
		maxReportChars: config.maxReportChars ?? 32768,
		maxRunMs: config.maxRunMs ?? 0,
		retryFailedMembers: config.retryFailedMembers ?? true,
		mergeSameLocation: config.mergeSameLocation ?? true,
		maxMergeCandidates: config.maxMergeCandidates ?? 60
	};
}
/**
* The run's `maxTotalAgents` ceiling.
*
* `maxTotalAgents` is a hard engine cap, not a budget: a call past it kills the
* run with `AGENT_CAP`. So it has to allow for everything the script may
* legitimately spend — one retry per member when `retryFailedMembers` is on,
* and one merge child when the merge stage is enabled — or a single dead child
* would turn a degraded run into a failed one.
* @param layers - the expanded layers of the preset being run.
* @param options - whether retries and the merge stage are enabled.
* @returns the ceiling to hand `WorkflowEngine.start`.
*/
function totalAgentBudget(layers, options) {
	const instances = layers.reduce((sum, layer) => sum + layer.instances.length, 0);
	const merge = options.mergeSameLocation ? 1 : 0;
	const attempts = options.retryFailedMembers ? 2 : 1;
	return (instances + merge) * attempts;
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
	const roleIds = /* @__PURE__ */ new Set();
	for (const layer of preset.layers) {
		if (layerIds.has(layer.id)) throw new TypeError(`${where}: duplicate layer id "${layer.id}"`);
		layerIds.add(layer.id);
		if (layer.roles.length === 0) throw new TypeError(`${where}: layer "${layer.id}" has no roles`);
		const width = layer.roles.reduce((sum, role) => sum + (role.count ?? 1), 0);
		if (width > maxAgentsPerLayer) throw new TypeError(`${where}: layer "${layer.id}" width ${width} exceeds maxAgentsPerLayer ${maxAgentsPerLayer}`);
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
/** How much of the task the run header keeps. */
const TASK_SNIPPET_CHARS = 80;
/**
* Reduce a task to one short single-line snippet.
* @param task - the model-supplied task text.
* @returns the first line, collapsed and truncated, or `''`.
*/
function taskSnippet(task) {
	const line = typeof task === "string" ? task.replace(/\s+/gu, " ").trim() : "";
	return line.length <= 80 ? line : `${line.slice(0, 79)}…`;
}
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
			ctx.logger.warn("dsh-tool-council: durable %s append failed: %s", type, String(error));
			return false;
		}
	};
	/** Mirror one high-frequency record, muting the stream after a failure. */
	const stream = (runId, type, data) => {
		const entry = active.get(runId);
		if (entry === void 0 || entry.streamFailed) return;
		if (!append(entry.session, type, data)) entry.streamFailed = true;
	};
	ctx.on("workflow/agent-start", (info, agent) => {
		stream(info.id, "tool-workflow/agent-start", {
			runId: info.id,
			seq: agent.seq,
			label: agent.label,
			...agent.phase === void 0 ? {} : { phase: agent.phase },
			childId: agent.childId
		});
	});
	ctx.on("workflow/agent-end", (info, agent) => {
		stream(info.id, "tool-workflow/agent-end", {
			runId: info.id,
			seq: agent.seq,
			outcome: agent.outcome
		});
	});
	ctx.on("workflow/phase", (info, title) => {
		stream(info.id, "tool-council/phase", {
			runId: info.id,
			title,
			at: Date.now()
		});
	});
	ctx.on("workflow/log", (info, message) => {
		stream(info.id, "tool-council/log", {
			runId: info.id,
			message,
			at: Date.now()
		});
	});
	return {
		start(session, run, info) {
			const workflowOpened = append(session, "tool-workflow/run-start", {
				runId: run.id,
				name: run.meta.name
			});
			const councilOpened = append(session, "tool-council/run-start", {
				runId: run.id,
				name: run.meta.name,
				preset: info.preset,
				task: taskSnippet(info.task),
				startedAt: Date.now(),
				layers: info.layers
			});
			if (workflowOpened || councilOpened) active.set(run.id, {
				session,
				streamFailed: false
			});
		},
		finish(runId, stopReason, result) {
			const entry = active.get(runId);
			if (entry === void 0) return;
			active.delete(runId);
			if (result !== void 0) append(entry.session, "tool-council/result", {
				runId,
				result
			});
			append(entry.session, "tool-workflow/run-end", {
				runId,
				stopReason
			});
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
* Cap how many findings one member contributes before clustering.
*
* Without it a single talkative member fills `maxFindings` and the quieter
* members' claims never reach the slice — the cap has to bite per member, not
* only on the merged list.
* @param reported - every map-layer finding, in stable child order.
* @param perMember - the ceiling per reporting instance; `0` disables the cap.
* @returns the same list with each member's tail beyond `perMember` dropped.
*/
function capPerMember(reported, perMember) {
	if (perMember <= 0) return [...reported];
	const seen = /* @__PURE__ */ new Map();
	const kept = [];
	for (const entry of reported) {
		const count = seen.get(entry.by) ?? 0;
		if (count >= perMember) continue;
		seen.set(entry.by, count + 1);
		kept.push(entry);
	}
	return kept;
}
/**
* Fold the merge layer's id groups into the clustered list.
*
* A group names ids that describe ONE defect in different words. The
* earliest-reported cluster in the group absorbs the others' reporters and
* title variants; ids are then reassigned `f1…fn` in first-seen order, because
* a finding id is a run-local table coordinate and a gap in it would read as a
* dropped row.
*
* Groups CHAIN: a cluster absorbed by one group may be named again by a later
* one, so each id is resolved to its current survivor before merging and an
* absorbed survivor hands over everything it had already absorbed. Without that
* hand-over, `[[f2,f3],[f1,f2]]` would silently lose f3's reporter — the exact
* kind of quiet deletion the merge step must never do.
* @param clustered - the deterministic clusters, in first-seen order.
* @param groups - id groups to fold; unknown ids and already-joined groups are ignored.
* @returns the folded clusters, renumbered in first-seen order.
*/
function mergeClusters(clustered, groups) {
	const order = new Map(clustered.map((finding, index) => [finding.id, index]));
	const byId = new Map(clustered.map((finding) => [finding.id, finding]));
	/** Absorbed id -> the id that absorbed it. */
	const absorbedBy = /* @__PURE__ */ new Map();
	const extra = /* @__PURE__ */ new Map();
	const rootOf = (id) => {
		let current = id;
		while (absorbedBy.has(current)) current = absorbedBy.get(current);
		return current;
	};
	for (const group of groups) {
		const roots = [...new Set(group.filter((id) => byId.has(id)).map(rootOf))];
		if (roots.length < 2) continue;
		const [survivor, ...absorbed] = roots.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
		/* v8 ignore next -- length >= 2 was checked above. */
		if (survivor === void 0) continue;
		const bucket = extra.get(survivor) ?? {
			reportedBy: [],
			variants: []
		};
		for (const id of absorbed) {
			absorbedBy.set(id, survivor);
			const source = byId.get(id);
			/* v8 ignore next -- roots are drawn from ids filtered against byId. */
			if (source === void 0) continue;
			const inherited = extra.get(id) ?? {
				reportedBy: [],
				variants: []
			};
			extra.delete(id);
			for (const by of [...source.reportedBy, ...inherited.reportedBy]) if (!bucket.reportedBy.includes(by)) bucket.reportedBy.push(by);
			for (const variant of [...source.variants, ...inherited.variants]) if (!bucket.variants.includes(variant)) bucket.variants.push(variant);
		}
		extra.set(survivor, bucket);
	}
	if (absorbedBy.size === 0) return [...clustered];
	return clustered.filter((finding) => !absorbedBy.has(finding.id)).map((finding, index) => {
		const bucket = extra.get(finding.id);
		const reportedBy = [...finding.reportedBy];
		const variants = [...finding.variants];
		if (bucket !== void 0) {
			for (const by of bucket.reportedBy) if (!reportedBy.includes(by)) reportedBy.push(by);
			for (const variant of bucket.variants) if (!variants.includes(variant)) variants.push(variant);
		}
		return {
			...finding,
			id: `f${index + 1}`,
			reportedBy,
			variants
		};
	});
}
/**
* Refuse a clustered list the script's own copy could not have produced.
*
* The tally guard recomputes the quorum but takes the CLUSTERING on trust, so a
* drift between the two copies of `dedupeFindings`/`mergeClusters` — or a
* corrupted payload across the structured-clone boundary — would change which
* findings a reader acts on with nothing to catch it. The host cannot recompute
* the clustering itself without carrying the whole raw finding list across the
* boundary (roughly doubling the payload), so it checks the invariants the
* clustering guarantees instead: contiguous ids in report order, one cluster
* per location+fingerprint key, and reporter/variant lists that are non-empty
* and duplicate-free. Drift that *changes* the key or the ordering is caught
* here; drift that produces a differently-but-validly clustered list is caught
* by the parity test the two copies share in CI.
* @param clusters - the clustered findings the script returned.
* @throws Error naming the first violated invariant.
*/
function assertClustersWellFormed(clusters) {
	const refuse = (why) => {
		throw new Error(`council: the workflow returned malformed clusters — ${why}`);
	};
	const keys = /* @__PURE__ */ new Set();
	for (const [index, cluster] of clusters.entries()) {
		const where = `finding ${index + 1}`;
		if (cluster.id !== `f${index + 1}`) refuse(`${where} has id "${cluster.id}", expected "f${index + 1}"`);
		const fp = fingerprint(cluster.title);
		const key = `${normalizeLocation(cluster.location)}|${fp === "" ? cluster.title.toLowerCase().trim() : fp}`;
		if (keys.has(key)) refuse(`${where} (${cluster.id}) repeats an earlier location+title key`);
		keys.add(key);
		if (cluster.reportedBy.length === 0) refuse(`${where} (${cluster.id}) has no reporter`);
		if (new Set(cluster.reportedBy).size !== cluster.reportedBy.length) refuse(`${where} (${cluster.id}) lists a reporter twice`);
		if (!cluster.variants.includes(cluster.title)) refuse(`${where} (${cluster.id}) does not list its own title among its variants`);
		if (new Set(cluster.variants).size !== cluster.variants.length) refuse(`${where} (${cluster.id}) lists a title variant twice`);
	}
}
/**
* Apply one quorum rule to one finding's counts.
*
* `participating` is the number of ballots that returned a verdict FOR THIS
* FINDING, not the number of ballots the layer collected: a verifier that
* answered nothing about a finding abstained on it, and counting that silence
* in the denominator would make one confirmation plus one abstention read as a
* quorum of two. Below two participating ballots the outcome is `insufficient`.
*
* `uncertain` never confirms: it only denies unanimity. When the rule does not
* confirm, the modal negative vote decides between `not-a-bug` (the fact holds
* but is not a defect) and `rejected` (the claim itself is wrong) — a
* distinction that changes the follow-up action, so it must survive the tally.
* With no negative vote at all the outcome is `insufficient` rather than
* `rejected`: a `threshold` of three that only two verifiers reached is
* unresolved, not refuted, and reporting it as refuted would invert what the
* verifiers actually said.
* @param counts - the vote counts for one finding.
* @param participating - how many ballots voted on THIS finding.
* @param quorum - the layer's rule and, for `threshold`, its required count.
* @returns the finding's outcome; `insufficient` when the bar was not met and nobody objected.
*/
function applyQuorum(counts, participating, quorum) {
	if (participating < 2) return "insufficient";
	if ((() => {
		switch (quorum.rule) {
			case "majority": return counts.confirmed > counts.rejected + counts.notABug;
			case "unanimous": return counts.confirmed === participating;
			case "threshold": return counts.confirmed >= (quorum.threshold ?? participating);
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
* visible in the report instead of being read as agreement, and its silence
* stays out of that row's quorum denominator. (`null`, not `undefined`: the
* workflow engine's result materializer rejects `undefined` as non-JSON data.)
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
		const participating = counts.confirmed + counts.rejected + counts.notABug + counts.uncertain;
		return {
			findingId: finding.id,
			votes,
			counts,
			participating,
			outcome: applyQuorum(counts, participating, quorum)
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
* The legend the verdict table needs to be read correctly — in particular that
* `·` is an abstention that does not count toward the quorum.
*/
const TABLE_LEGEND = "✅ confirmed · ❌ rejected · ➖ not a bug · ❔ uncertain · \"·\" no verdict returned (abstention). A quorum counts only the verifiers who voted on that row. INSUFFICIENT means unresolved, not refuted: the rule was not met and nobody argued against the finding — either fewer than two verifiers voted on it, or those who did could not reach the bar the rule sets.";
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
* Name the first field on which two tallies disagree.
* @param expected - the host's recomputation.
* @param actual - the tally the script returned.
* @returns the divergence description, or undefined when the two agree.
*/
function firstDivergence(expected, actual) {
	if (expected.verifiers.length !== actual.verifiers.length) return `verifier count ${expected.verifiers.length} vs ${actual.verifiers.length}`;
	for (const [index, verifier] of expected.verifiers.entries()) if (verifier !== actual.verifiers[index]) return `verifier column ${index + 1}: "${verifier}" vs "${String(actual.verifiers[index])}"`;
	if (expected.rows.length !== actual.rows.length) return `row count ${expected.rows.length} vs ${actual.rows.length}`;
	for (const [index, row] of expected.rows.entries()) {
		const other = actual.rows[index];
		/* v8 ignore next -- row counts were compared above. */
		if (other === void 0) return `row ${index + 1}: missing`;
		const where = `row ${index + 1} (${row.findingId})`;
		if (row.findingId !== other.findingId) return `${where}: findingId "${other.findingId}"`;
		if (row.votes.length !== other.votes.length) return `${where}: vote count ${row.votes.length} vs ${other.votes.length}`;
		for (const [column, vote] of row.votes.entries()) if (vote !== other.votes[column]) return `${where}: vote ${column + 1} ${String(vote)} vs ${String(other.votes[column])}`;
		for (const key of [
			"confirmed",
			"rejected",
			"notABug",
			"uncertain"
		]) if (row.counts[key] !== other.counts[key]) return `${where}: counts.${key} ${row.counts[key]} vs ${other.counts[key]}`;
		if (row.participating !== other.participating) return `${where}: participating ${row.participating} vs ${other.participating}`;
		if (row.outcome !== other.outcome) return `${where}: outcome ${row.outcome} vs ${other.outcome}`;
	}
}
/**
* Compare a script-produced tally against the host's own recomputation.
*
* The script's tally crosses a structured-clone boundary and is therefore data,
* not a result the host may trust. Any divergence means the two copies of the
* quorum logic have drifted, which would silently change which findings a
* reviewer acts on — so the message names the first field that differs rather
* than only reporting that something did.
* @param expected - the host's recomputation from the raw ballots.
* @param actual - the tally the workflow script returned.
* @throws Error when column order, row order, votes, counts, or outcomes differ.
*/
function assertTallyAgrees(expected, actual) {
	const divergence = firstDivergence(expected, actual);
	if (divergence !== void 0) throw new Error(`council: the script tally disagrees with the host recomputation — ${divergence}`);
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
	if (!isRecord(value) || !Array.isArray(value["findings"]) || !Array.isArray(value["ballots"]) || typeof value["report"] !== "string" || typeof value["reportMissing"] !== "boolean" || typeof value["membersReporting"] !== "number" || typeof value["membersResponding"] !== "number" || typeof value["mapMembers"] !== "number" || value["stopReason"] !== "completed" && value["stopReason"] !== "deadline") throw new Error("council: the workflow returned a malformed result");
	const table = value["tally"];
	if (table !== null && !isRecord(table)) throw new Error("council: the workflow returned a malformed tally");
	return {
		findings: value["findings"],
		ballots: value["ballots"],
		tally: table,
		report: value["report"],
		reportMissing: value["reportMissing"],
		membersReporting: value["membersReporting"],
		membersResponding: value["membersResponding"],
		mapMembers: value["mapMembers"],
		stopReason: value["stopReason"]
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
* The one-line participation summary, phrased as self-report, not certification.
*
* Answering and reporting are counted separately on purpose: the map prompt
* calls an empty list "a valid and respectable answer", so folding the two
* would make a clean run where nobody found anything read as four dead children.
* @param outcome - the validated script outcome.
* @returns the summary sentence.
*/
function summaryLine(outcome) {
	const answered = outcome.mapMembers === 0 ? `${outcome.membersResponding} council members answered` : `${outcome.membersResponding} of ${outcome.mapMembers} examining members answered`;
	const reported = outcome.findings.length === 0 ? "none reported a finding" : `${outcome.membersReporting} reported ${outcome.findings.length} distinct findings`;
	if (outcome.tally === null) return `${answered}; ${reported}.`;
	const confirmed = outcome.tally.rows.filter((row) => row.outcome === "confirmed").length;
	return `${answered}; ${reported}; ${outcome.ballots.length} verifiers voted, confirming ${confirmed}.`;
}
/**
* Render the council's result for the parent model.
*
* The quorum line is deliberately phrased as a count of members, not as a
* certification: verifiers are agents re-reading the same repository, and the
* table would otherwise read as an independent oracle. A run that lost its
* synthesizer or ran out of its budget says so here rather than presenting a
* partial council as a complete one.
* @param outcome - the validated script outcome.
* @param maxChars - the report ceiling.
* @returns the model-facing text.
*/
function renderOutcome(outcome, maxChars) {
	const parts = [summaryLine(outcome)];
	if (outcome.stopReason === "deadline") parts.push("INCOMPLETE: the run hit its time budget, so one or more layers did not run. Treat everything below as partial.");
	if (outcome.reportMissing) parts.push("NO REPORT: the synthesizer produced nothing, so there is no written conclusion — what follows is what the members and verifiers reported, unsynthesized.");
	if (outcome.findings.length > 0) {
		if (outcome.tally !== null) {
			const shown = Math.min(outcome.findings.length, MAX_RENDERED_ROWS);
			parts.push(renderTable(outcome.findings.slice(0, shown), {
				verifiers: outcome.tally.verifiers,
				rows: outcome.tally.rows.slice(0, shown)
			}), TABLE_LEGEND);
			if (shown < outcome.findings.length) parts.push(`Showing ${shown} of ${outcome.findings.length} findings; the rest are in the Council tab.`);
		} else if (outcome.reportMissing) {
			const shown = Math.min(outcome.findings.length, MAX_RENDERED_ROWS);
			parts.push(renderFindingList(outcome.findings.slice(0, shown)));
			if (shown < outcome.findings.length) parts.push(`Showing ${shown} of ${outcome.findings.length} findings; the rest are in the Council tab.`);
		}
	}
	if (outcome.report !== "") parts.push(outcome.report);
	return bound(parts.join("\n\n"), maxChars);
}
/**
* List findings that never reached a verdict table, so an unverified run still
* surfaces what its members actually said.
* @param findings - the deduplicated findings, in report order.
* @returns a Markdown list, one entry per finding.
*/
function renderFindingList(findings) {
	return findings.map((finding) => `- **${finding.title}** (${finding.location}, ${finding.severity}) — ${finding.claim} [reported by ${finding.reportedBy.join(", ")}]`).join("\n");
}
/** Ceiling on verdict rows carried into the durable record. */
const MAX_RECORD_ROWS = 200;
/**
* Ceiling on verdict rows rendered into the parent's context.
*
* `maxFindings` goes to 10 000, and `bound()` only trims the finished string —
* so without this the whole table is built and escaped before most of it is
* thrown away, and the reader gets a table cut off mid-row with no indication
* that anything is missing. Rows are dropped explicitly instead, and counted.
*/
const MAX_RENDERED_ROWS = 100;
/**
* Flatten a settled outcome into the durable record the Council tab reopens.
* @param outcome - the validated script outcome.
* @param context - the preset, the engine's stop reason, and the run's timings.
* @returns the record appended as `tool-council/result`.
*/
function buildResultRecord(outcome, context) {
	const rows = [];
	const counts = {
		findings: outcome.findings.length,
		confirmed: 0,
		rejected: 0,
		notABug: 0,
		insufficient: 0,
		unverified: 0
	};
	outcome.findings.forEach((finding, index) => {
		const row = outcome.tally?.rows[index];
		const outcomeLabel = row?.outcome ?? "unverified";
		if (outcomeLabel === "confirmed") counts.confirmed += 1;
		else if (outcomeLabel === "rejected") counts.rejected += 1;
		else if (outcomeLabel === "not-a-bug") counts.notABug += 1;
		else if (outcomeLabel === "insufficient") counts.insufficient += 1;
		else counts.unverified += 1;
		if (rows.length >= MAX_RECORD_ROWS) return;
		rows.push({
			findingId: finding.id,
			title: finding.title,
			location: finding.location,
			severity: finding.severity,
			votes: row?.votes.map((vote) => vote) ?? [],
			participating: row?.participating ?? 0,
			outcome: outcomeLabel,
			fix: finding.fix
		});
	});
	const report = bound(outcome.report, context.maxReportChars);
	return {
		preset: context.preset,
		stopReason: outcome.stopReason === "deadline" ? "deadline" : context.stopReason,
		agentsStarted: context.agentsStarted,
		durationMs: context.durationMs,
		membersReporting: outcome.membersReporting,
		membersResponding: outcome.membersResponding,
		mapMembers: outcome.mapMembers,
		reportMissing: outcome.reportMissing,
		counts,
		verifiers: outcome.tally?.verifiers ?? [],
		rows,
		rowsTruncated: rows.length < outcome.findings.length,
		report,
		reportTruncated: report.length < outcome.report.length
	};
}
/**
* The record left behind by a run that never produced a usable value.
* @param context - the preset, the failure's stop reason and message, and timings.
* @returns a record whose counts are zero and whose stop reason names the failure.
*/
function failureRecord(context) {
	return {
		preset: context.preset,
		stopReason: context.stopReason,
		error: context.error,
		agentsStarted: context.agentsStarted,
		durationMs: context.durationMs,
		membersReporting: 0,
		membersResponding: 0,
		mapMembers: 0,
		reportMissing: true,
		counts: {
			findings: 0,
			confirmed: 0,
			rejected: 0,
			notABug: 0,
			insufficient: 0,
			unverified: 0
		},
		verifiers: [],
		rows: [],
		rowsTruncated: false,
		report: "",
		reportTruncated: false
	};
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
	stopReason: {
		type: "string",
		required: true
	},
	result: {
		type: "json",
		required: true
	}
};
function presentCall(args) {
	const task = args.task.trim();
	const firstLine = task.split("\n", 1)[0] ?? "";
	return {
		card: "generic",
		title: `council: ${args.preset ?? "default preset"} — ${bound(firstLine, 80)}`,
		kind: "other",
		rawInput: task
	};
}
function presentResult(args, result) {
	const meta = result.meta;
	if (!isRecord(meta) || typeof meta["preset"] !== "string") return {
		card: "generic",
		title: `council: ${args.preset ?? "default preset"}`
	};
	const view = meta;
	const parts = [`${view.membersResponding}/${view.mapMembers} answered`, `${view.findings} findings`];
	if (view.findings > 0) parts.push(`${view.confirmed} confirmed`);
	parts.push(`${view.agentsStarted} agents`);
	if (view.stopReason !== "completed") parts.push(view.stopReason);
	if (view.reportMissing) parts.push("no report");
	return {
		card: "generic",
		title: `council: ${view.preset} — ${parts.join(" · ")}`
	};
}
/**
* Project one preset's expanded layers into the durable topology record.
* @param preset - the preset being run.
* @returns one entry per layer, in composition order.
*/
function layerRecords(preset) {
	return preset.layers.map((layer) => ({
		id: layer.id,
		kind: layer.kind,
		label: layer.label ?? layer.id,
		width: layer.roles.reduce((sum, role) => sum + (role.count ?? 1), 0)
	}));
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
			}],
			presentationMeta: (_args, value) => {
				const outcome = value.result;
				return {
					runId: value.runId,
					preset: value.preset,
					agentsStarted: value.agentsStarted,
					stopReason: value.stopReason,
					findings: outcome.findings.length,
					confirmed: outcome.tally === null ? 0 : outcome.tally.rows.filter((row) => row.outcome === "confirmed").length,
					membersReporting: outcome.membersReporting,
					membersResponding: outcome.membersResponding,
					mapMembers: outcome.mapMembers,
					reportMissing: outcome.reportMissing
				};
			}
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
				maxFindingsPerMember: resolved.maxFindingsPerMember,
				maxRunMs: resolved.maxRunMs,
				retryFailedMembers: resolved.retryFailedMembers,
				mergeSameLocation: resolved.mergeSameLocation,
				maxMergeCandidates: resolved.maxMergeCandidates,
				layers
			};
			const startedAt = Date.now();
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
				maxTotalAgents: totalAgentBudget(layers, resolved),
				parent,
				signal: exec.signal
			});
			recorder.start(parent.session, run, {
				preset: preset.id,
				task,
				layers: layerRecords(preset)
			});
			const onAbort = () => {
				run.cancel("parent step aborted");
			};
			exec.signal.addEventListener("abort", onAbort, { once: true });
			if (exec.signal.aborted) run.cancel("parent step aborted");
			const hardStop = resolved.maxRunMs > 0 ? setTimeout(() => {
				run.cancel(`council run exceeded maxRunMs ${resolved.maxRunMs}ms`);
			}, resolved.maxRunMs + HARD_STOP_GRACE_MS) : void 0;
			let settled;
			let record;
			try {
				settled = await run.result;
				const error = stopReasonError(settled);
				if (error !== void 0) throw new Error(error);
				const outcome = readOutcome(settled.value);
				assertClustersWellFormed(outcome.findings);
				if (outcome.tally !== null) {
					const quorum = preset.layers.find((layer) => layer.kind === "verify")?.quorum ?? { rule: "majority" };
					assertTallyAgrees(tally(outcome.findings, outcome.ballots, quorum), outcome.tally);
				}
				record = buildResultRecord(outcome, {
					preset: preset.id,
					stopReason: settled.stopReason,
					agentsStarted: settled.agentsStarted,
					durationMs: Date.now() - startedAt,
					maxReportChars: resolved.maxReportChars
				});
				return {
					runId: run.id,
					preset: preset.id,
					agentsStarted: settled.agentsStarted,
					stopReason: record.stopReason,
					result: outcome
				};
			} catch (error) {
				record = failureRecord({
					preset: preset.id,
					stopReason: settled?.stopReason ?? "error",
					error: error instanceof Error ? error.message : String(error),
					agentsStarted: settled?.agentsStarted ?? 0,
					durationMs: Date.now() - startedAt
				});
				throw error;
			} finally {
				if (hardStop !== void 0) clearTimeout(hardStop);
				exec.signal.removeEventListener("abort", onAbort);
				try {
					await run.dispose();
				} finally {
					recorder.finish(run.id, settled?.stopReason ?? "error", record);
					recorder.abandon(run.id);
				}
			}
		},
		presentCall,
		presentResult
	}));
}
//#endregion
export { BUILTIN_PRESETS, COUNCIL_NAMESPACE, Config, HARD_STOP_GRACE_MS, TABLE_LEGEND, TASK_SNIPPET_CHARS, apply, applyOverrides, applyQuorum, assertClustersWellFormed, buildResultRecord, capPerMember, dedupeFindings, expandLayers, failureRecord, fingerprint, inject, mergeClusters, name, normalizeLocation, presentCall, presentResult, readOutcome, renderOutcome, renderTable, resolveConfig, stopReasonError, summaryLine, tally, taskSnippet, totalAgentBudget };
