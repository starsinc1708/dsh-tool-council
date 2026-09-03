window.__ModuleLoader__.load({
	id: "@starsinc1708/dsh-tool-council",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
/**
* One role's tuned count under a setup.
*
* The count is ABSOLUTE — the role's width for the session. A value outside
* `1..MAX_ROLE_WIDTH` is treated as absent (the composed width stands) because
* the document is user-plane JSON that survived arbitrary edits; anything else
* would start a layer with a nonsense number of members.
* @param composed - the role's composed width, or undefined for the default 1.
* @param tune - the session's tuning of this role, or undefined.
* @returns the count to run.
*/
function tunedCount(composed, tune) {
	const count = tune?.count;
	return typeof count === "number" && Number.isInteger(count) && count >= 1 && count <= 64 ? count : composed ?? 1;
}
/**
* Whether a session setup drops a layer (only the verify layer can be dropped).
* @param kind - the layer kind.
* @param setup - the session setup, or undefined.
* @returns true when the layer should not run.
*/
function layerDropped(kind, setup) {
	return kind === "verify" && setup?.verifyEnabled === false;
}
/**
* The widths of every layer one mirrored preset composes under a setup —
* tuned existing roles, authored roles, authored map layers, verification
* dropped when off, and the reduce layer at its single instance. Shared by the
* width/quorum validators and the Council tab's "of N declared" readout, so
* what the designer blocks, what the tool runs and what the tab says can
* never disagree.
* @param preset - the mirrored preset.
* @param setup - the session setup, or undefined for the composed widths.
* @returns layer id -> width, in composition order.
*/
function sessionLayerWidthPlan(preset, setup) {
	const plan = preset.layers.filter((layer) => !layerDropped(layer.kind, setup)).map((layer) => ({
		id: layer.id,
		kind: layer.kind,
		width: layer.roles.reduce((sum, role) => sum + tunedCount(role.count, setup?.roles?.[`${layer.id}.${role.id}`]), 0) + (layer.kind === "reduce" ? 0 : (setup?.addRoles?.[layer.id] ?? []).reduce((sum, role) => sum + (role.count ?? 1), 0))
	}));
	const extras = (setup?.addLayers ?? []).map((layer) => ({
		id: layer.id,
		kind: "map",
		width: (layer.roles ?? []).reduce((sum, role) => sum + (role.count ?? 1), 0) + (setup?.addRoles?.[layer.id] ?? []).reduce((sum, role) => sum + (role.count ?? 1), 0)
	}));
	if (extras.length > 0) {
		const firstNonMap = plan.findIndex((layer) => layer.kind !== "map");
		plan.splice(firstNonMap === -1 ? plan.length : firstNonMap, 0, ...extras);
	}
	return plan;
}
/**
* Every planned layer whose width a session setup would push past the ceiling
* — the designer-side twin of `applySessionSetup`'s refusal, computed over the
* mirrored topology so the panel can disable Save before the Host would refuse
* the run.
* @param preset - the mirrored preset.
* @param setup - the staged session setup, or undefined.
* @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
* @returns one entry per offending layer, in composition order.
*/
function sessionWidthViolations(preset, setup, maxAgentsPerLayer) {
	if (maxAgentsPerLayer <= 0) return [];
	const out = [];
	for (const layer of sessionLayerWidthPlan(preset, setup)) if (layer.width > maxAgentsPerLayer) out.push({
		layerId: layer.id,
		width: layer.width,
		max: maxAgentsPerLayer
	});
	return out;
}
/**
* The declared width of every layer one mirrored preset composes under a
* session setup — what the Council tab's "of N declared" readouts should show.
* @param preset - the mirrored preset.
* @param setup - the session setup, or undefined for the composed widths.
* @returns layer id -> declared width, in composition order.
*/
function sessionLayerWidths(preset, setup) {
	return new Map(sessionLayerWidthPlan(preset, setup).map((layer) => [layer.id, layer.width]));
}
/**
* Whether a session's staged quorum for a verify layer is unreachable by its
* own width — the designer-side twin of `applySessionSetup`'s threshold check.
* @param preset - the mirrored preset.
* @param setup - the staged session setup, or undefined.
* @returns the violation, or undefined when the quorum is fine or absent.
*/
function sessionQuorumViolation(preset, setup) {
	if (setup?.quorum === void 0 || setup.quorum.rule !== "threshold") return void 0;
	const verify = sessionLayerWidthPlan(preset, setup).find((layer) => layer.kind === "verify");
	if (verify === void 0) return void 0;
	const composedThreshold = preset.layers.find((layer) => layer.kind === "verify")?.quorumThreshold;
	const threshold = setup.quorum.threshold ?? composedThreshold;
	if (threshold === void 0 || !Number.isInteger(threshold) || threshold < 1 || threshold > verify.width) return {
		rule: "threshold",
		threshold: threshold ?? 0,
		width: verify.width
	};
}
/**
* Every layer of a custom topology whose width exceeds the ceiling — the
* designer-side twin of `applyCustomSetup`'s refusal.
* @param layers - the authored topology.
* @param maxAgentsPerLayer - the deployment's per-layer width ceiling.
* @returns one entry per offending layer, in composition order.
*/
function customWidthViolations(layers, maxAgentsPerLayer) {
	if (maxAgentsPerLayer <= 0) return [];
	const out = [];
	for (const layer of layers) {
		const width = layer.roles.reduce((sum, role) => sum + (role.count ?? 1), 0);
		if (width > maxAgentsPerLayer) out.push({
			layerId: layer.id,
			width,
			max: maxAgentsPerLayer
		});
	}
	return out;
}
/**
* Whether a custom verify layer's threshold is unreachable by its own width.
* @param layers - the authored topology.
* @returns the violation, or undefined when fine or no threshold quorum.
*/
function customQuorumViolation(layers) {
	const verify = layers.find((layer) => layer.kind === "verify");
	if (verify === void 0 || verify.quorum?.rule !== "threshold") return void 0;
	const width = verify.roles.reduce((sum, role) => sum + (role.count ?? 1), 0);
	const threshold = verify.quorum.threshold ?? width;
	if (!Number.isInteger(threshold) || threshold < 1 || threshold > width) return {
		threshold,
		width
	};
}
/**
* The structural error of a custom topology the designer must surface before
* the host's `resolveConfig` would refuse the run, or undefined when the
* skeleton is sound (prompts/ids still checked host-side). Returns a stable
* machine code the UI translates.
* @param layers - the authored topology.
* @returns a short code, or undefined.
*/
function customStructuralError(layers) {
	if (layers.length === 0) return "no-layers";
	const last = layers[layers.length - 1];
	if (last === void 0 || last.kind !== "reduce") return "missing-reduce";
	if (last.roles.length !== 1) return "reduce-role";
	if (layers.filter((layer) => layer.kind === "verify").length > 1) return "too-many-verify";
	if (layers.findIndex((layer) => layer.kind === "reduce") !== layers.length - 1) return "reduce-not-last";
	const verifyAt = layers.findIndex((layer) => layer.kind === "verify");
	if (verifyAt >= 0 && layers.slice(verifyAt + 1).some((layer) => layer.kind === "map")) return "map-after-verify";
	if (layers.some((layer) => layer.roles.length === 0)) return "empty-layer";
}
//#endregion
//#region src/client/locales.ts
/**
* Council settings-card and graph-view dictionaries.
* @module @deepseek-ai/dsh-client-ui-council
*/
/** The locale namespace this plugin registers. */
const NS = "council";
/** English copy; its key set is the namespace's contract. */
const en = {
	"title": "Council",
	"description": "How many members examine a task, how many verify each finding, and what it takes to confirm one.",
	"defaultPreset": "Default preset",
	"width": "{n} members",
	"count": "copies",
	"model": "model",
	"modelInherit": "inherit",
	"provider": "provider",
	"providerInherit": "inherit",
	"quorum": "quorum",
	"threshold": "confirmations needed",
	"overridden": "overridden",
	"revert": "revert",
	"resetPreset": "Reset this preset",
	"resetAll": "Reset all",
	"overrideSummary.single": "1 override, in this preset",
	"overrideSummary.onePreset": "{total} overrides, all in one preset",
	"overrideSummary.many": "{total} overrides across {presets} presets",
	"noOverrides": "No overrides — every preset runs as this deployment composed it.",
	"discard": "Discard",
	"save": "Save",
	"totalAgents": "{n} agents per run",
	"widthExceeded": "Preset \"{preset}\", layer \"{layer}\" would start {width} members; this deployment allows {max}.",
	"thresholdInvalid": "Preset \"{preset}\", layer \"{layer}\": {threshold} confirmations cannot be reached by {width} verifiers.",
	"saveBlocked": "Fix the highlighted settings above before saving.",
	"transfer": "Overrides as JSON",
	"export": "Export",
	"import": "Import",
	"copied": "copied",
	"importInvalid": "That is not a valid overrides document.",
	"kind.map": "examine",
	"kind.verify": "verify",
	"kind.reduce": "synthesize",
	"kindHint.map": "Examines the task through its own lens and reports findings.",
	"kindHint.verify": "Re-checks each finding from the source and votes on it.",
	"kindHint.reduce": "Writes the final report from what the members and verifiers produced.",
	"quorumRule.majority": "simple majority",
	"quorumRule.unanimous": "unanimous",
	"quorumRule.threshold": "at least N confirmations",
	"status.loading": "Loading council settings…",
	"status.unavailable": "This deployment does not expose council settings.",
	"unsaved": "unsaved changes",
	"importConfirm": "Importing replaces every unsaved override you have staged. Continue?",
	"partialSave": "The overrides were saved but the default preset was not: {error}",
	"download": "Download",
	"copyFailed": "Could not reach the clipboard — use Download instead.",
	"cost": "~{amount} est.",
	"costRate": "cost estimate, $ per 1M tokens (0 = off)",
	"costHint": "A blended rate you supply. The token meter reports no price and the view does not know which route each member ran on, so this is your arithmetic, not a bill.",
	"startedAt": "started {time}",
	"chip.deadline": "over budget",
	"chip.failed": "failed",
	"live.elapsed": "{time} elapsed",
	"live.observed": "{time} watched here",
	"live.running": "{n} running",
	"live.done": "{n} done",
	"live.failed": "{n} failed",
	"live.stopped": "{n} stopped",
	"live.declared": "of {n} declared",
	"live.legend": "A running council reports what has already started — a layer's members appear as they are launched, so the counts grow. \"of N declared\" is the width this deployment currently configures for that layer, read from the council settings. \"watched here\" is time since this tab first saw the run, shown when the run's own start time could not be established; it restarts on reload.",
	"roleHint.correctness": "Reads logic and data flow: inverted conditions, off-by-one, null/empty cases, read-before-write.",
	"roleHint.api-contract": "Reads module seams: mismatched arguments, renamed parameters, drifted duplicates, broken invariants.",
	"roleHint.perf-scale": "Reads production-size behaviour: quadratic work, hot-loop allocations, unbounded collections.",
	"roleHint.tests": "Reads the test suite: tests that will break, assert old behaviour, or have no coverage.",
	"roleHint.prior-art": "Finds what already exists and what each option actually does, with references.",
	"roleHint.constraints": "Establishes the hard limits the architecture, data, and platform impose.",
	"roleHint.tradeoffs": "Lays out what each direction costs and buys; refuses to pick a winner.",
	"roleHint.risks": "Names what could go wrong and what nobody has measured yet.",
	"roleHint.minimal": "Designs the smallest change that genuinely solves the problem.",
	"roleHint.idiomatic": "Designs the version that fits the codebase conventions, even if larger.",
	"roleHint.ambitious": "Designs the version still right in two years, with its honest cost.",
	"roleHint.plan": "Produces ordered, independently reviewable mechanical steps.",
	"roleHint.coupling": "Maps everything that actually depends on the code being moved.",
	"roleHint.merge": "Decides which same-location findings are one defect described twice.",
	"roleHint.replicator": "Re-derives each claim from the source, as if the finding had never been written.",
	"roleHint.devils-advocate": "Builds the strongest case that each claim is NOT a defect, then votes honestly.",
	"roleHint.impact": "Assumes each claim is true and traces who reaches it and what a user sees.",
	"roleHint.feasibility": "Checks each proposal against the real APIs and extension points.",
	"roleHint.maintenance": "Judges each proposal by what it does to whoever maintains it.",
	"roleHint.behaviour": "Decides whether each refactor step is genuinely behaviour-preserving.",
	"roleHint.coverage": "Decides whether an existing test would catch a mistake in each step.",
	"roleHint.rollback": "Decides whether each step can be reverted alone once merged.",
	"roleHint.synthesizer": "Writes the final report from the verdict table; never re-litigates votes.",
	"table.caption": "Verdicts: one row per finding, one column per verifier.",
	"view.council": "Council",
	"onlyCouncilPreset": "The council graph is available in {preset} mode.",
	"noRuns": "No council run yet. Send a task to start one.",
	"tokens": "{n} tokens",
	"seconds": "{n}s",
	"status.running": "running",
	"status.completed": "done",
	"status.failed": "failed",
	"status.cancelled": "cancelled",
	"status.interrupted": "interrupted",
	"legend.status": "cancelled = stopped by you or by a budget · interrupted = the member's worker died",
	"verdicts": "Verdicts",
	"report": "Report",
	"summary": "{responding} of {members} members answered · {reporting} reported · {findings} findings · {confirmed} confirmed",
	"col.finding": "Finding",
	"col.location": "Location",
	"col.severity": "Severity",
	"col.outcome": "Outcome",
	"col.fix": "Fix",
	"severity.blocker": "blocker",
	"severity.high": "high",
	"severity.medium": "medium",
	"severity.low": "low",
	"filter.confirmed": "confirmed ({n})",
	"filter.unresolved": "unresolved ({n})",
	"filter.all": "all ({n})",
	"filter.none": "No finding of this run matches that filter.",
	"filter.legend": "Severity is the reporting member's own claim, not a verdict — a blocker nobody confirmed is still only a claim. \"unresolved\" collects INSUFFICIENT and NOT VERIFIED: the rows nobody argued against and nobody confirmed.",
	"location.copy": "copy this location",
	"location.open": "open this file",
	"location.openFailed": "The host could not open {path}.",
	"location.legend": "A location copies itself when clicked. The arrow hands the FILE to the host operating system's default application (ctx.workspaces.openPath) — the client runtime exposes no reveal-at-line seam, so the line number travels in the copy and not in the jump.",
	"checklist.label": "checklist",
	"checklist.title": "Confirmed findings — {preset}",
	"checklist.fix": "fix: {fix}",
	"checklist.none": "This run confirmed no findings.",
	"outcome.confirmed": "CONFIRMED",
	"outcome.rejected": "REJECTED",
	"outcome.not-a-bug": "NOT A BUG",
	"outcome.insufficient": "INSUFFICIENT",
	"outcome.unverified": "NOT VERIFIED",
	"tableLegend": "✅ confirmed · ❌ rejected · ➖ not a bug · ❔ uncertain · · abstained (not counted). INSUFFICIENT is unresolved, not refuted — the rule was not met and nobody argued against the finding, either because fewer than two verifiers voted on it or because those who did could not reach the bar. NOT VERIFIED means this preset declares no verify layer, so nobody was asked. These are member self-reports, not certification.",
	"noFindings": "The council reported no findings.",
	"noReport": "The synthesizer produced no report for this run.",
	"incomplete": "Incomplete: the run hit its time budget, so one or more layers did not run.",
	"runFailed": "This run did not finish: {error}",
	"rowsTruncated": "Showing {shown} of {total} findings.",
	"showAllRows": "Showing {shown} of {total} rows — show all",
	"reportTruncated": "The report was cut to the deployment ceiling.",
	"designer.title": "Council",
	"designer.unsaved": "unsaved changes",
	"designer.presetLabel": "Preset",
	"designer.preset": "{preset}",
	"designer.members": "{n} members",
	"designer.verifyOn": "verify on",
	"designer.verifyOff": "verify off",
	"designer.verifySkipped": "Verification is off for this session: runs go straight from the examining layer to the synthesizer, so nothing is cross-checked before it is reported.",
	"designer.clear": "Let the model pick the preset",
	"designer.discard": "Discard",
	"designer.save": "Save",
	"designer.inherit": "inherit",
	"designer.model": "model",
	"designer.provider": "provider",
	"designer.quorum": "Quorum",
	"designer.threshold": "confirmations",
	"designer.thresholdHint": "of {width} verifiers",
	"designer.increment": "more members",
	"designer.decrement": "fewer members",
	"designer.summary": "map {map} · verify {verify} · reduce {reduce} per run",
	"designer.widthExceeded": "Layer \"{layer}\" of preset \"{preset}\" would start {width} members; this deployment allows {max}.",
	"designer.thresholdInvalid": "{threshold} confirmations cannot be reached by {width} verifiers.",
	"saveFailed": "Could not save the council setup: {error}",
	"designer.newRole": "new role",
	"designer.newLayer": "new layer",
	"designer.roleLabel": "role name",
	"designer.promptSeed": "Focus your lens on: {role}. Read the workspace, run what you can, and report only what you verified — with a concrete `path:line` location and observed evidence.",
	"designer.layerCap": "up to {n} layers",
	"designer.edit": "edit lens",
	"designer.removeRole": "remove role",
	"designer.search": "Search models…",
	"designer.noModels": "No models available for this provider right now.",
	"designer.noVerify": "This preset declares no verify layer.",
	"designer.noVerifyHint": "Add a verify layer to cross-check findings before the synthesizer reports.",
	"designer.addRole": "Add role",
	"designer.addLayer": "Add layer",
	"designer.newRoleItem": "New role…",
	"designer.custom": "Custom (from scratch)",
	"designer.nodes": "Add node",
	"designer.removeLayer": "remove layer",
	"designer.namePlaceholder": "Name this custom council…",
	"designer.savePreset": "Save preset",
	"designer.myRoles": "My roles ({n})",
	"designer.noSavedRoles": "Nothing saved yet — use 💾 on an authored role to keep it here.",
	"designer.deleteRole": "delete from My roles",
	"designer.myPresets": "My presets ({n})",
	"designer.noSavedPresets": "Nothing saved yet — finish a custom council and press Save preset.",
	"designer.deletePreset": "delete from My presets",
	"designer.saveRole": "save to My roles",
	"designer.singleInstance": "Exactly one synthesizer runs — point it at a stronger model here.",
	"designer.clearDisabledHint": "Nothing is fixed for this session yet — the model already picks the preset per request.",
	"designer.customError": "{error}",
	"custom.mapNode": "map",
	"custom.verifyNode": "verify",
	"custom.reduceNode": "synthesizer",
	"custom.addMap": "+ map layer",
	"custom.addVerify": "+ verify layer",
	"custom.addReduce": "+ synthesizer",
	"custom.reduceSeed": "You write the final report from what the members and verifiers produced: the question, what is established and what remains unknown. Attribute conclusions to the council, not to certainty.",
	"custom.no-layers": "A custom council needs at least one layer.",
	"custom.missing-reduce": "The chain must end with a synthesizer layer.",
	"custom.reduce-role": "The synthesizer layer must hold exactly one role.",
	"custom.too-many-verify": "At most one verify layer is allowed.",
	"custom.reduce-not-last": "The synthesizer layer must stay last.",
	"custom.map-after-verify": "A map layer may not follow the verify layer.",
	"custom.empty-layer": "Every layer needs at least one role."
};
/** Chinese copy; must cover exactly {@link en}'s key set. */
const zh = {
	"title": "议事会",
	"description": "有多少成员审查任务、多少成员复核每条发现，以及确认一条发现需要什么。",
	"defaultPreset": "默认预设",
	"width": "{n} 名成员",
	"count": "副本数",
	"model": "模型",
	"modelInherit": "继承",
	"provider": "提供方",
	"providerInherit": "继承",
	"quorum": "法定人数",
	"threshold": "所需确认数",
	"overridden": "已覆盖",
	"revert": "还原",
	"resetPreset": "重置此预设",
	"resetAll": "全部重置",
	"overrideSummary.single": "1 项覆盖，位于本预设",
	"overrideSummary.onePreset": "{total} 项覆盖，全部位于同一个预设",
	"overrideSummary.many": "{presets} 个预设共 {total} 项覆盖",
	"noOverrides": "没有任何覆盖——每个预设都按本部署的组合运行。",
	"discard": "放弃",
	"save": "保存",
	"totalAgents": "每次运行 {n} 个智能体",
	"widthExceeded": "预设 “{preset}” 的层 “{layer}” 将启动 {width} 名成员；此部署上限为 {max}。",
	"thresholdInvalid": "预设 “{preset}” 的层 “{layer}”：{width} 名复核者无法达成 {threshold} 票确认。",
	"saveBlocked": "请先修正上面高亮的设置再保存。",
	"transfer": "以 JSON 导入导出覆盖项",
	"export": "导出",
	"import": "导入",
	"copied": "已复制",
	"importInvalid": "这不是有效的覆盖项文档。",
	"kind.map": "审查",
	"kind.verify": "复核",
	"kind.reduce": "综合",
	"kindHint.map": "以自己的视角审查任务并报告发现。",
	"kindHint.verify": "回到源码重新核对每条发现并投票。",
	"kindHint.reduce": "根据成员与复核者的产出撰写最终报告。",
	"quorumRule.majority": "简单多数",
	"quorumRule.unanimous": "一致同意",
	"quorumRule.threshold": "至少 N 票确认",
	"status.loading": "正在加载议事会设置…",
	"status.unavailable": "此部署未开放议事会设置。",
	"unsaved": "有未保存的更改",
	"importConfirm": "导入将替换你暂存的全部未保存覆盖项。是否继续？",
	"partialSave": "覆盖项已保存，但默认预设未保存：{error}",
	"download": "下载",
	"copyFailed": "无法访问剪贴板——请改用下载。",
	"cost": "约 {amount}（估算）",
	"costRate": "成本估算，每百万 tokens 美元（0 表示关闭）",
	"costHint": "由你提供的混合费率。计量器不报告价格，视图也不知道每位成员的实际路由，所以这是你的算术，不是账单。",
	"startedAt": "开始于 {time}",
	"chip.deadline": "超出预算",
	"chip.failed": "失败",
	"live.elapsed": "已运行 {time}",
	"live.observed": "本页已观察 {time}",
	"live.running": "{n} 运行中",
	"live.done": "{n} 完成",
	"live.failed": "{n} 失败",
	"live.stopped": "{n} 已停止",
	"live.declared": "共声明 {n}",
	"live.legend": "运行中的议事会只报告已经开始的部分——一层的成员随启动逐个出现，所以计数会增长。“共声明 N”是本部署当前为该层配置的宽度，读自议事会设置。“本页已观察”是本标签页首次看到该运行以来的时间，仅在无法确定运行自身开始时间时显示；刷新后会重新计时。",
	"roleHint.correctness": "审读逻辑与数据流：条件反转、差一错误、空值/空集、先读后写。",
	"roleHint.api-contract": "审读模块接缝：参数不匹配、参数改名、副本漂移、不变量被破坏。",
	"roleHint.perf-scale": "审读生产规模下的行为：意外的平方复杂度、热循环分配、无界集合。",
	"roleHint.tests": "审读测试套件：会失败的测试、断言旧行为的测试、完全没有覆盖的行为。",
	"roleHint.prior-art": "找出已经存在什么、每个选项实际做什么，并给出出处。",
	"roleHint.constraints": "确立架构、数据与平台施加的硬性限制。",
	"roleHint.tradeoffs": "列出每个方向的成本与收益；拒绝直接选出赢家。",
	"roleHint.risks": "指出可能出错之处，以及尚无人度量过的部分。",
	"roleHint.minimal": "设计真正解决问题的最小改动。",
	"roleHint.idiomatic": "设计最贴合本代码库既有约定的版本，即使更大。",
	"roleHint.ambitious": "设计两年后依然正确的版本，并如实说明当下代价。",
	"roleHint.plan": "产出有序、可独立评审的机械步骤。",
	"roleHint.coupling": "梳理真正依赖被移动代码的一切。",
	"roleHint.merge": "判断同一位置的哪些发现其实是同一个缺陷的两种说法。",
	"roleHint.replicator": "从源码重新推导每条主张，就像从未读过该发现一样。",
	"roleHint.devils-advocate": "为“这不是缺陷”构建最强论证，然后如实投票。",
	"roleHint.impact": "假定主张成立，追踪谁会走到这里、用户会看到什么。",
	"roleHint.feasibility": "对照真实的 API 与扩展点检查每个方案。",
	"roleHint.maintenance": "以维护者的负担来评判每个方案。",
	"roleHint.behaviour": "判断每个重构步骤是否真正保持行为不变。",
	"roleHint.coverage": "判断现有测试能否捕获每一步中的错误。",
	"roleHint.rollback": "判断每一步合并后能否单独回滚。",
	"roleHint.synthesizer": "依据裁决表撰写最终报告；绝不重新审理投票。",
	"table.caption": "裁决：每条发现一行，每位复核者一列。",
	"view.council": "议事会",
	"onlyCouncilPreset": "议事会图仅在 {preset} 模式下可用。",
	"noRuns": "尚无议事会运行。发送任务即可开始。",
	"tokens": "{n} tokens",
	"seconds": "{n} 秒",
	"status.running": "运行中",
	"status.completed": "完成",
	"status.failed": "失败",
	"status.cancelled": "已取消",
	"status.interrupted": "已中断",
	"legend.status": "已取消 = 由你或预算终止 · 已中断 = 该成员的工作线程终止",
	"verdicts": "裁决",
	"report": "报告",
	"summary": "{members} 名成员中 {responding} 名作答 · {reporting} 名有报告 · {findings} 条发现 · {confirmed} 条确认",
	"col.finding": "发现",
	"col.location": "位置",
	"col.severity": "严重程度",
	"col.outcome": "结论",
	"col.fix": "修复",
	"severity.blocker": "阻断",
	"severity.high": "高",
	"severity.medium": "中",
	"severity.low": "低",
	"filter.confirmed": "已确认（{n}）",
	"filter.unresolved": "未决（{n}）",
	"filter.all": "全部（{n}）",
	"filter.none": "本次运行没有发现符合该筛选条件。",
	"filter.legend": "严重程度是报告成员的自述主张，不是裁决——无人确认的“阻断”仍然只是主张。“未决”合并了“证据不足”与“未复核”：无人反对也无人确认的行。",
	"location.copy": "复制该位置",
	"location.open": "打开该文件",
	"location.openFailed": "宿主无法打开 {path}。",
	"location.legend": "点击位置即可复制。箭头会把该“文件”交给宿主操作系统的默认应用（ctx.workspaces.openPath）——客户端运行时没有“定位到行”的接缝，所以行号只随复制传递，不参与跳转。",
	"checklist.label": "清单",
	"checklist.title": "已确认的发现 — {preset}",
	"checklist.fix": "修复：{fix}",
	"checklist.none": "本次运行没有确认任何发现。",
	"outcome.confirmed": "已确认",
	"outcome.rejected": "已驳回",
	"outcome.not-a-bug": "并非缺陷",
	"outcome.insufficient": "证据不足",
	"outcome.unverified": "未复核",
	"tableLegend": "✅ 确认 · ❌ 驳回 · ➖ 并非缺陷 · ❔ 不确定 · · 弃权（不计入）。“证据不足”表示未决而非被驳回：规则未达成且无人反对该发现——或因参与投票的复核者少于两名，或因已投票者未能达到规则设定的门槛。“未复核”表示该预设没有复核层，无人被问及。这些是成员的自述，不是独立认证。",
	"noFindings": "议事会没有报告任何发现。",
	"noReport": "本次运行的综合者没有产出报告。",
	"incomplete": "未完成：本次运行触及时间预算，有层未执行。",
	"runFailed": "本次运行未完成：{error}",
	"rowsTruncated": "显示 {total} 条发现中的 {shown} 条。",
	"showAllRows": "已显示 {total} 行中的 {shown} 行——显示全部",
	"reportTruncated": "报告已被截断至部署上限。",
	"designer.title": "议事会",
	"designer.unsaved": "有未保存的更改",
	"designer.presetLabel": "预设",
	"designer.preset": "{preset}",
	"designer.members": "{n} 名成员",
	"designer.verifyOn": "复核开启",
	"designer.verifyOff": "复核关闭",
	"designer.verifySkipped": "本会话关闭了复核：运行直接从审查层到综合层，报告前没有任何交叉核对。",
	"designer.clear": "让模型自行选择预设",
	"designer.discard": "放弃",
	"designer.save": "保存",
	"designer.inherit": "继承",
	"designer.model": "模型",
	"designer.provider": "提供方",
	"designer.quorum": "法定人数",
	"designer.threshold": "确认数",
	"designer.thresholdHint": "（共 {width} 名复核者）",
	"designer.increment": "增加成员",
	"designer.decrement": "减少成员",
	"designer.summary": "每次运行：审查 {map} · 复核 {verify} · 综合 {reduce}",
	"designer.widthExceeded": "预设 “{preset}” 的层 “{layer}” 将启动 {width} 名成员；此部署上限为 {max}。",
	"designer.thresholdInvalid": "{width} 名复核者无法达成 {threshold} 票确认。",
	"saveFailed": "无法保存议事会设置：{error}",
	"designer.newRole": "新角色",
	"designer.newLayer": "新层",
	"designer.roleLabel": "角色名称",
	"designer.promptSeed": "将你的视角聚焦于：{role}。阅读工作区、尽量运行验证，只报告你亲自核实的内容——附上具体的 `path:line` 位置与观察到的证据。",
	"designer.layerCap": "最多 {n} 层",
	"designer.edit": "编辑视角",
	"designer.removeRole": "删除角色",
	"designer.search": "搜索模型…",
	"designer.noModels": "该提供方当前没有可用模型。",
	"designer.noVerify": "此预设没有复核层。",
	"designer.noVerifyHint": "添加复核层，在综合层出报告前交叉核对发现。",
	"designer.addRole": "添加角色",
	"designer.addLayer": "添加层",
	"designer.newRoleItem": "新角色…",
	"designer.custom": "自定义（从零构建）",
	"designer.nodes": "添加节点",
	"designer.removeLayer": "删除层",
	"designer.namePlaceholder": "为这个自定义议事会命名…",
	"designer.savePreset": "保存预设",
	"designer.myRoles": "我的角色（{n}）",
	"designer.noSavedRoles": "还没有保存——在自建角色上用 💾 即可保存到这里。",
	"designer.deleteRole": "从“我的角色”删除",
	"designer.myPresets": "我的预设（{n}）",
	"designer.noSavedPresets": "还没有保存——完成自定义议事会后点击“保存预设”。",
	"designer.deletePreset": "从“我的预设”删除",
	"designer.saveRole": "保存到“我的角色”",
	"designer.singleInstance": "合成器只运行一个实例——可在这里把它指向更强的模型。",
	"designer.clearDisabledHint": "本会话还没有固定任何设置——模型本来就会按请求自行选择预设。",
	"designer.customError": "{error}",
	"custom.mapNode": "审查",
	"custom.verifyNode": "复核",
	"custom.reduceNode": "综合",
	"custom.addMap": "+ 审查层",
	"custom.addVerify": "+ 复核层",
	"custom.addReduce": "+ 综合层",
	"custom.reduceSeed": "你根据成员与复核者产出的内容撰写最终报告：问题、已确证内容与仍属未知的内容。结论归因于议事会，而非确定无疑。",
	"custom.no-layers": "自定义议事会至少需要一个层。",
	"custom.missing-reduce": "链的末尾必须有一个综合层。",
	"custom.reduce-role": "综合层必须恰好包含一个角色。",
	"custom.too-many-verify": "最多只能有一个复核层。",
	"custom.reduce-not-last": "综合层必须保持在最后。",
	"custom.map-after-verify": "审查层不能位于复核层之后。",
	"custom.empty-layer": "每个层至少需要一个角色。"
};
//#endregion
//#region src/client/report.ts
/** `#` to `######`, then at least one space, then the title. */
const HEADING = /^(#{1,6})\s+(.*)$/u;
/** `-`, `*`, or `+`, then at least one space. Leading indent is allowed. */
const BULLET = /^\s*[-*+]\s+(.*)$/u;
/** `1.` or `1)`, then at least one space. Leading indent is allowed. */
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/u;
/**
* Three or more backticks, then an optional language word.
*
* The leading run of spaces is captured, not discarded: a fence's indentation
* decides whether a later backtick line closes it — see {@link parseReport}.
*/
const FENCE = /^([ \t]*)(`{3,})[ \t]*(\S*)[ \t]*$/u;
/**
* How far a closing fence may be indented past its opening one.
*
* CommonMark's rule, and it is not pedantry here: without it any indented
* backtick line INSIDE a code block closes it, and the rest of the block
* escapes into paragraphs — which breaks the one promise the code arm makes,
* that it reproduces its body verbatim.
*/
const MAX_CLOSING_INDENT = 3;
/**
* Split one line into text and inline-code spans.
*
* A backtick with no partner is not code: it stays in the text, because the
* alternative is silently eating the rest of a sentence. `` `` `` (an empty
* pair) is likewise left alone rather than becoming an empty code element.
* @param line - one line of heading, item, or paragraph text.
* @returns the spans, in order; never empty for a non-empty line.
*/
function parseSpans(line) {
	const spans = [];
	let rest = line;
	while (rest !== "") {
		const open = rest.indexOf("`");
		if (open === -1) break;
		const close = rest.indexOf("`", open + 1);
		if (close === -1 || close === open + 1) break;
		if (open > 0) spans.push({
			kind: "text",
			text: rest.slice(0, open)
		});
		spans.push({
			kind: "code",
			text: rest.slice(open + 1, close)
		});
		rest = rest.slice(close + 1);
	}
	if (rest !== "") spans.push({
		kind: "text",
		text: rest
	});
	return spans;
}
/**
* Turn a report into the blocks the view renders.
*
* Total by construction: every line reaches exactly one arm, an unterminated
* fence closes at the end of the text rather than swallowing it, and no input
* can make this throw. A report that is entirely unstructured comes back as one
* paragraph with its whitespace intact.
* @param report - the synthesizer's report, verbatim.
* @returns the blocks, in document order; empty for an empty report.
*/
function parseReport(report) {
	const lines = report.replace(/\r\n?/gu, "\n").split("\n");
	const blocks = [];
	let paragraph = [];
	let list;
	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		blocks.push({
			kind: "paragraph",
			spans: parseSpans(paragraph.join("\n"))
		});
		paragraph = [];
	};
	const flushList = () => {
		if (list === void 0) return;
		blocks.push({
			kind: "list",
			ordered: list.ordered,
			items: list.items
		});
		list = void 0;
	};
	const flush = () => {
		flushParagraph();
		flushList();
	};
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const fence = FENCE.exec(line);
		if (fence !== null) {
			flush();
			const indent = fence[1].length;
			const ticks = fence[2].length;
			const language = fence[3];
			const body = [];
			index += 1;
			while (index < lines.length) {
				const candidate = lines[index];
				const closing = FENCE.exec(candidate);
				if (closing !== null && closing[2].length >= ticks && closing[3] === "" && closing[1].length <= indent + MAX_CLOSING_INDENT) break;
				body.push(candidate);
				index += 1;
			}
			blocks.push({
				kind: "code",
				language,
				text: body.join("\n")
			});
			continue;
		}
		if (line.trim() === "") {
			flush();
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading !== null) {
			flush();
			const level = Math.min(heading[1].length, 3);
			blocks.push({
				kind: "heading",
				level,
				spans: parseSpans(heading[2])
			});
			continue;
		}
		const numbered = NUMBERED.exec(line);
		const bullet = numbered === null ? BULLET.exec(line) : null;
		if (numbered !== null || bullet !== null) {
			flushParagraph();
			const ordered = numbered !== null;
			const text = numbered?.[1] ?? bullet?.[1] ?? "";
			if (list !== void 0 && list.ordered !== ordered) flushList();
			if (list === void 0) list = {
				ordered,
				items: []
			};
			list.items.push(parseSpans(text));
			continue;
		}
		flushList();
		paragraph.push(line);
	}
	flush();
	return blocks;
}
//#endregion
//#region \0dsh-css:C:\git\map-reduce\src\client\council-view.module.css.mjs
const css$1 = ".dshc_646a84 { display: flex; flex-direction: column; gap: 20px; padding: 16px; overflow: auto; }\n.dshc_870338 { padding: 24px 16px; font-size: 12px; opacity: 0.6; }\n.dshc_7f2f0f { margin: 0; font-size: 12px; opacity: 0.65; }\n.dshc_f73f70 { margin: 0; font-size: 11px; opacity: 0.5; line-height: 1.5; }\n.dshc_cc7ef1 { margin: 0; font-size: 12px; color: var(--dsh-warning, #b26500); }\n.dshc_7056b0 { flex: 1 1 auto; }\n\n.dshc_e52d3d { display: flex; flex-direction: column; gap: 10px; }\n.dshc_7d84f5 { display: flex; flex-direction: column; gap: 10px; padding-top: 10px; }\n.dshc_0a185b { display: flex; align-items: center; gap: 10px; cursor: pointer; }\n.dshc_a785b3 { font-size: 13px; font-weight: 600; flex: none; }\n.dshc_0bb1de {\n  font-size: 12px; opacity: 0.65; min-width: 0; flex: 1 1 auto;\n  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.dshc_d31428, .dshc_d09552 {\n  font-size: 10px; padding: 1px 7px; border-radius: 999px; flex: none; text-transform: uppercase;\n  letter-spacing: 0.04em;\n}\n.dshc_d31428 {\n  color: var(--dsh-warning, #b26500);\n  background: color-mix(in srgb, var(--dsh-warning, #b26500) 14%, transparent);\n}\n.dshc_d09552 {\n  color: var(--dsh-danger, #c0392b);\n  background: color-mix(in srgb, var(--dsh-danger, #c0392b) 14%, transparent);\n}\n.dshc_eab06a { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; }\n.dshc_9e2609 { font-size: 11px; opacity: 0.5; font-variant-numeric: tabular-nums; flex: none; }\n/* The one number that moves on its own: kept a touch louder than the rest of\n   the header so a running council reads as running at a glance. */\n.dshc_e9dda6 {\n  font-size: 11px; opacity: 0.85; font-variant-numeric: tabular-nums; flex: none;\n  color: var(--dsh-info, #1565c0);\n}\n.dshc_7795bc { margin: 0; font-size: 12px; font-variant-numeric: tabular-nums; }\n.dshc_f79ef7 {\n  margin: 0; padding-left: 16px; font-size: 12px; opacity: 0.75;\n  font-variant-numeric: tabular-nums; display: flex; flex-direction: column; gap: 2px;\n}\n\n.dshc_f11d32 { display: flex; gap: 10px; align-items: stretch; overflow-x: auto; }\n.dshc_622ba5 {\n  flex: 1 1 0; min-width: 180px; margin: 0; padding: 8px 10px 10px; border-radius: 8px;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n}\n.dshc_622ba5 legend { padding: 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }\n.dshc_f12eaa {\n  display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; opacity: 0.5;\n  font-variant-numeric: tabular-nums; min-height: 1em;\n}\n.dshc_862cbd { color: var(--dsh-info, #1565c0); opacity: 0.9; }\n\n.dshc_20471c { display: flex; flex-direction: column; gap: 3px; padding: 6px 0; border-top: 1px solid var(--dsh-border, rgb(0 0 0 / 8%)); }\n.dshc_20471c:first-of-type { border-top: none; }\n.dshc_7fc35c { display: flex; align-items: center; gap: 6px; font-size: 12px; }\n.dshc_2e4b0b { font-weight: 500; }\n.dshc_a3d2c5 { font-size: 11px; opacity: 0.6; margin-left: auto; }\n.dshc_0e1c56 { font-size: 11px; opacity: 0.5; font-variant-numeric: tabular-nums; }\n.dshc_c73fc3 { margin: 0; font-size: 11px; opacity: 0.55; line-height: 1.4; }\n\n.dshc_b30f6f { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--dsh-muted, rgb(0 0 0 / 15%)); }\n.dshc_b30f6f[data-status='completed'] { background: var(--dsh-success, #2e7d32); }\n.dshc_b30f6f[data-status='running'] { background: var(--dsh-info, #1565c0); animation: pulse 1.2s ease-in-out infinite; }\n.dshc_b30f6f[data-status='failed'] { background: var(--dsh-danger, #c62828); }\n.dshc_b30f6f[data-status='cancelled'], .dshc_b30f6f[data-status='interrupted'] { background: var(--dsh-warning, #ef6c00); }\n\n@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }\n\n.dshc_0ee0be { display: flex; flex-direction: column; gap: 8px; }\n.dshc_546f24 { display: flex; align-items: center; gap: 8px; }\n.dshc_546f24 h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }\n.dshc_0ee0be h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }\n.dshc_546f24 button { font-size: 11px; padding: 2px 8px; }\n\n.dshc_0e11f8 {\n  align-self: flex-start; font-size: 11px; padding: 2px 8px; border-radius: 999px;\n  cursor: pointer; color: inherit; background: transparent;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%));\n}\n\n.dshc_9f7dcd { display: flex; flex-wrap: wrap; gap: 6px; }\n.dshc_3bb897, .dshc_0b9b15 {\n  font-size: 11px; padding: 2px 10px; border-radius: 999px; cursor: pointer; color: inherit;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%)); background: transparent;\n  font-variant-numeric: tabular-nums;\n}\n.dshc_3bb897:hover { background: var(--dsh-accent-soft, rgb(0 0 0 / 6%)); }\n.dshc_0b9b15 { border-color: transparent; background: var(--dsh-accent-soft, rgb(0 0 0 / 10%)); font-weight: 600; }\n\n/* One badge, four colours by attribute — an unknown level keeps the neutral\n   base rather than losing its styling, because the durable record's severity is\n   a plain string that a differently-configured build may have written. */\n.dshc_125f38 {\n  display: inline-block; font-size: 10px; padding: 1px 7px; border-radius: 999px; white-space: nowrap;\n  text-transform: uppercase; letter-spacing: 0.04em;\n  color: var(--dsh-muted-fg, inherit);\n  background: var(--dsh-accent-soft, rgb(0 0 0 / 8%));\n}\n.dshc_125f38[data-severity='blocker'] {\n  color: var(--dsh-danger, #c0392b);\n  background: color-mix(in srgb, var(--dsh-danger, #c0392b) 16%, transparent);\n  font-weight: 600;\n}\n.dshc_125f38[data-severity='high'] {\n  color: var(--dsh-warning, #b26500);\n  background: color-mix(in srgb, var(--dsh-warning, #b26500) 16%, transparent);\n}\n.dshc_125f38[data-severity='medium'] {\n  color: var(--dsh-info, #1565c0);\n  background: color-mix(in srgb, var(--dsh-info, #1565c0) 14%, transparent);\n}\n.dshc_125f38[data-severity='low'] { opacity: 0.7; }\n\n.dshc_0edfe5 { overflow-x: auto; }\n.dshc_12aa48 { border-collapse: collapse; font-size: 12px; width: 100%; }\n.dshc_12aa48 th, .dshc_12aa48 td {\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n  padding: 4px 8px; text-align: left; vertical-align: top;\n}\n.dshc_12aa48 th { font-weight: 500; opacity: 0.7; white-space: nowrap; }\n.dshc_91daf1 { caption-side: top; text-align: left; font-size: 11px; opacity: 0.55; padding-bottom: 4px; }\n.dshc_da511c { font-weight: 400; opacity: 0.6; text-align: right; }\n/* Long titles and fixes wrap instead of forcing the table wider than the tab. */\n.dshc_12aa48 td:nth-child(2), .dshc_12aa48 td:last-child { max-width: 22em; overflow-wrap: anywhere; }\n.dshc_12aa48 tr[data-outcome='confirmed'] td { background: color-mix(in srgb, var(--dsh-success, #2e7d32) 8%, transparent); }\n.dshc_12aa48 tr[data-outcome='insufficient'] td { opacity: 0.65; }\n.dshc_85c4a0 { text-align: center; white-space: nowrap; }\n\n.dshc_fa7f05 { display: inline-flex; align-items: center; gap: 4px; }\n/* The chip is a button, but must read as the path it carries — not as a control\n   competing with the export row above it. */\n.dshc_dfe0c5 {\n  font-family: var(--dsh-font-mono, ui-monospace, monospace);\n  font-size: 11px; white-space: nowrap; padding: 1px 6px; border-radius: 5px; cursor: pointer;\n  color: inherit; text-align: left;\n  border: 1px solid transparent; background: var(--dsh-accent-soft, rgb(0 0 0 / 6%));\n}\n.dshc_dfe0c5:hover { border-color: var(--dsh-border, rgb(0 0 0 / 20%)); }\n.dshc_baf91e {\n  font-size: 11px; line-height: 1; padding: 2px 5px; border-radius: 5px; cursor: pointer;\n  color: inherit; opacity: 0.55; background: transparent;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%));\n}\n.dshc_baf91e:hover { opacity: 1; }\n.dshc_45ddbc { font-size: 10px; opacity: 0.6; }\n\n/* The report is structure now, not a monospace wall: a prose container whose\n   children are real headings, lists, paragraphs, and code blocks. */\n.dshc_8fd10e {\n  display: flex; flex-direction: column; gap: 8px;\n  margin: 0; padding: 10px 12px; border-radius: 8px; font-size: 12px; line-height: 1.55;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n}\n.dshc_408740 { margin: 4px 0 0; font-size: 12px; font-weight: 600; line-height: 1.4; }\n.dshc_408740[data-level='1'] { font-size: 13px; }\n.dshc_408740[data-level='3'] { font-weight: 500; opacity: 0.85; }\n.dshc_408740:first-child { margin-top: 0; }\n/* Whitespace preserved: an aligned block the synthesizer laid out by hand stays\n   aligned, and a long line still wraps instead of widening the tab. */\n.dshc_ee7259 { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }\n.dshc_ae2f18 { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 3px; }\n.dshc_ae2f18 li { overflow-wrap: anywhere; }\n.dshc_70724d {\n  margin: 0; padding: 8px 10px; border-radius: 6px; overflow-x: auto;\n  font-family: var(--dsh-font-mono, ui-monospace, monospace); font-size: 11px; line-height: 1.45;\n  background: var(--dsh-accent-soft, rgb(0 0 0 / 6%));\n}\n.dshc_84e62e {\n  font-family: var(--dsh-font-mono, ui-monospace, monospace); font-size: 11px;\n  padding: 0 4px; border-radius: 4px; background: var(--dsh-accent-soft, rgb(0 0 0 / 8%));\n}\n";
const tagId$1 = "@starsinc1708/dsh-tool-council/council-view.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "@starsinc1708/dsh-tool-council";
	tag.dataset.pluginCss = tagId$1;
	tag.textContent = css$1;
	document.head.appendChild(tag);
}
var council_view_module_css_default = {
	"wrap": "dshc_646a84",
	"empty": "dshc_870338",
	"hint": "dshc_7f2f0f",
	"footnote": "dshc_f73f70",
	"warn": "dshc_cc7ef1",
	"spacer": "dshc_7056b0",
	"run": "dshc_e52d3d",
	"runBody": "dshc_7d84f5",
	"runHead": "dshc_0a185b",
	"runName": "dshc_a785b3",
	"runTask": "dshc_0bb1de",
	"chipWarn": "dshc_d31428",
	"chipDanger": "dshc_d09552",
	"runStatus": "dshc_eab06a",
	"runMeta": "dshc_9e2609",
	"runClock": "dshc_e9dda6",
	"runSummary": "dshc_7795bc",
	"runLog": "dshc_f79ef7",
	"layers": "dshc_f11d32",
	"layer": "dshc_622ba5",
	"layerMeta": "dshc_f12eaa",
	"liveMark": "dshc_862cbd",
	"member": "dshc_20471c",
	"memberRow": "dshc_7fc35c",
	"memberLabel": "dshc_2e4b0b",
	"memberStatus": "dshc_a3d2c5",
	"memberTokens": "dshc_0e1c56",
	"memberHint": "dshc_c73fc3",
	"dot": "dshc_b30f6f",
	"outcome": "dshc_0ee0be",
	"outcomeHead": "dshc_546f24",
	"showAll": "dshc_0e11f8",
	"chips": "dshc_9f7dcd",
	"chip": "dshc_3bb897",
	"chipOn": "dshc_0b9b15",
	"severity": "dshc_125f38",
	"tableWrap": "dshc_0edfe5",
	"table": "dshc_12aa48",
	"caption": "dshc_91daf1",
	"rowIndex": "dshc_da511c",
	"vote": "dshc_85c4a0",
	"location": "dshc_fa7f05",
	"locationChip": "dshc_dfe0c5",
	"locationOpen": "dshc_baf91e",
	"locationNote": "dshc_45ddbc",
	"report": "dshc_8fd10e",
	"reportHeading": "dshc_408740",
	"reportParagraph": "dshc_ee7259",
	"reportList": "dshc_ae2f18",
	"reportCode": "dshc_70724d",
	"reportInline": "dshc_84e62e"
};
//#endregion
//#region src/client/council-view.tsx
/**
* Council conversation view: a graph of the council's map → verify → reduce
* agents, followed by the run's verdict table and written report, rendered as
* a tab beside Chat and Trajectory.
*
* It reads two things the harness already persists: the `workflow-run` nodes
* the engine emits (member graph, live state, per-member tokens) and the run
* ARTIFACT the council tool ships as its `presentationMeta`, which the harness
* stores on the `tool/result` event. That artifact — topology, narration,
* per-layer timing and the settled outcome — is what makes a finished run
* reopenable, and it costs no private event type: a plugin cannot write one,
* because the session reader refuses a log carrying a type it does not know.
*
* @module @deepseek-ai/dsh-client-ui-council
*/
/** The published preset id assumed when the deployment mirrored none. */
const DEFAULT_COUNCIL_PRESET = "map-reduce";
/**
* Shipped role label -> locale key for its one-line explanation.
*
* Keyed by label because that is all the workflow-run node carries about a
* member. A deployment that renamed its roles falls through to the layer's
* kind hint, which still says what the member is for.
*/
const ROLE_HINT_KEYS = {
	"Correctness": "roleHint.correctness",
	"API contract": "roleHint.api-contract",
	"Performance & scale": "roleHint.perf-scale",
	"Tests": "roleHint.tests",
	"Prior art": "roleHint.prior-art",
	"Constraints": "roleHint.constraints",
	"Trade-offs": "roleHint.tradeoffs",
	"Risks & unknowns": "roleHint.risks",
	"Minimal": "roleHint.minimal",
	"Idiomatic": "roleHint.idiomatic",
	"Ambitious": "roleHint.ambitious",
	"Plan": "roleHint.plan",
	"Coupling": "roleHint.coupling",
	"Merge": "roleHint.merge",
	"Replicator": "roleHint.replicator",
	"Devil's advocate": "roleHint.devils-advocate",
	"Impact": "roleHint.impact",
	"Feasibility": "roleHint.feasibility",
	"Maintenance": "roleHint.maintenance",
	"Behaviour": "roleHint.behaviour",
	"Coverage": "roleHint.coverage",
	"Rollback": "roleHint.rollback",
	"Synthesizer": "roleHint.synthesizer"
};
/**
* Format a wall clock for the run header.
* @param at - epoch milliseconds recorded when the run opened.
* @returns a locale-formatted time, or the raw number if the platform refuses.
*/
function formatTime(at) {
	try {
		return new Date(at).toLocaleTimeString();
	} catch {
		/* v8 ignore next -- only a platform without Intl reaches this. */
		return String(at);
	}
}
/**
* Format an elapsed span for a running run's clock.
* @param ms - the span in milliseconds; negatives read as zero.
* @returns `12s`, `4:07`, or `1:02:03`.
*/
function formatDuration(ms) {
	const total = Math.max(0, Math.floor(ms / 1e3));
	const seconds = total % 60;
	const minutes = Math.floor(total / 60) % 60;
	const hours = Math.floor(total / 3600);
	const pad = (n) => n < 10 ? `0${n}` : String(n);
	if (total < 60) return `${seconds}s`;
	if (hours === 0) return `${minutes}:${pad(seconds)}`;
	return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}
/**
* The prefix `tool.ts` gives every council workflow run's `meta.name`.
*
* `RunData.name` is the only field of the live node that names the topology the
* run was started from, and the engine carries it verbatim from
* `tool-workflow/run-start`. Everything else about the topology arrives with the
* artifact, which does not exist until the run settles.
*/
const RUN_NAME_PREFIX = "council:";
/**
* Declared width of every layer of the preset a live run is executing.
*
* The width is NOT derivable from the run: `phase.members` holds only the
* instances that have already started, and the artifact's `layers` (which
* carries the real width) lands only when the run settles. The one live source
* is the `council` settings section — the deployment's read-only `topology`
* mirror composed with THIS session's designer setup, which is exactly the
* pair the tool itself resolves on every call — joined to the run through the
* preset id in `RunData.name`.
*
* It is a live READ, not a record of what launched: a setup edited while a
* run is in flight would make this disagree with the run's real width. That is
* why it is rendered as "of N declared" beside the observed counts rather than
* as a denominator like `2/3`.
* @param settings - the council settings section, as the designer mirrors it.
* @param sessionId - the session whose designer setup applies to the run.
* @param runName - the workflow run's name (`council:<presetId>`).
* @returns layer id -> declared width; empty when the preset cannot be identified.
*/
function declaredWidths(settings, sessionId, runName) {
	if (settings === void 0 || !runName.startsWith(RUN_NAME_PREFIX)) return /* @__PURE__ */ new Map();
	const presetId = runName.slice(8);
	const preset = settings.topology?.find((candidate) => candidate.id === presetId);
	if (preset === void 0) return /* @__PURE__ */ new Map();
	const setup = settings.sessionCouncil?.[sessionId];
	return sessionLayerWidths(preset, setup);
}
/**
* Count the member states a running layer is showing.
* @param members - the members the workflow-run node has published so far.
* @returns the four counts; `cancelled` and `interrupted` fold into `stopped`.
*/
function liveCounts(members) {
	let running = 0;
	let done = 0;
	let failed = 0;
	let stopped = 0;
	for (const member of members) if (member.status === "running") running += 1;
	else if (member.status === "completed") done += 1;
	else if (member.status === "failed") failed += 1;
	else stopped += 1;
	return {
		running,
		done,
		failed,
		stopped
	};
}
/**
* When the council call that owns one run was logged.
*
* Neither `RunData` nor the chat node carries a start time — `ConversationViewNode`
* has no `time` field and `anchorSeq` is a sequence number, not a clock. What the
* same snapshot does carry is the still-running `tool/call` head, whose `time` is
* the exact epoch millisecond the call was logged, a few milliseconds before the
* engine started the run.
*
* The join is by the call's own `turn`/`step` and is deliberately refused when it
* is not unique: two calls in flight in one step cannot be told apart from here,
* and a wrong start time is worse than an honest "since first seen".
* @param calls - every tool call still in flight, at any depth.
* @param turn - the run node's turn.
* @param step - the run node's step.
* @returns the call's log time, or undefined when the join is not unambiguous.
*/
function runStartFromCalls(calls, turn, step) {
	const matches = calls.filter((call) => call.turn === turn && call.step === step);
	return matches.length === 1 ? matches[0]?.time : void 0;
}
/**
* First moment this tab saw each run, keyed by run id.
*
* The honest fallback when the tool call cannot be joined: it measures how long
* the tab has been WATCHING the run, which is why it is labelled differently
* from the real elapsed time. Page-session scoped by construction — a reload
* restarts it, and the label says so rather than pretending otherwise.
*
* It holds an entry only for runs that are still going: {@link forgetObserved}
* drops each one as its run settles, which is what makes "one number per
* running run" true rather than merely intended. Dropping it on the live
* header's unmount would be wrong — the header also unmounts when the viewer
* switches tabs, and the clock would restart on the way back, which is the one
* thing this map exists to prevent.
*/
const FIRST_SEEN = /* @__PURE__ */ new Map();
/**
* Read (and on first sight record) when this tab first saw a run.
* @param runId - the workflow run's id.
* @param now - the current epoch time.
* @returns the first-observed time.
*/
function observedSince(runId, now) {
	const seen = FIRST_SEEN.get(runId);
	if (seen !== void 0) return seen;
	FIRST_SEEN.set(runId, now);
	return now;
}
/**
* Drop the observed start of every run that has settled.
*
* A settled run reads its real `startedAt` off its artifact and never asks
* again, so its entry is dead weight from that moment on.
* @param settled - run ids that are no longer running.
*/
function forgetObserved(settled) {
	for (const runId of settled) FIRST_SEEN.delete(runId);
}
/**
* Hand the viewer a file instead of only the clipboard.
*
* Clipboard access is permissioned and silently unavailable in some webviews;
* an export that can only ever fail quietly is not an export.
* @param name - suggested file name.
* @param text - the file's contents.
* @param type - the MIME type.
* @returns whether the download could be started.
*/
function downloadText(name, text, type) {
	try {
		const url = URL.createObjectURL(new Blob([text], { type }));
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = name;
		anchor.rel = "noopener";
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 0);
		return true;
	} catch {
		return false;
	}
}
const VOTE_MARK = {
	"confirmed": "✅",
	"rejected": "❌",
	"not-a-bug": "➖",
	"uncertain": "❔"
};
/**
* Severity levels this build has copy and a colour for.
*
* `CouncilResultRow.severity` is a plain `string` in the durable record, not the
* `FindingSeverity` union: the record is replayed from logs written by other
* builds. An unrecognized level renders its raw text in the neutral badge rather
* than resolving a locale key that does not exist.
*/
const SEVERITY_LEVELS = /* @__PURE__ */ new Set([
	"blocker",
	"high",
	"medium",
	"low"
]);
/** The three filters, in chip order. */
const ROW_FILTERS = [
	"confirmed",
	"unresolved",
	"all"
];
/**
* Whether one row belongs to one filter.
*
* `unresolved` deliberately covers BOTH unresolved arms: `insufficient` (a
* quorum was attempted and did not settle the row) and `unverified` (the preset
* declares no verify layer, so nobody was asked). They differ in why, not in
* what they leave the reader to do, and splitting them into two chips would put
* a chip permanently at zero on every preset.
* @param row - the verdict row.
* @param filter - the active filter.
* @returns whether the row is shown.
*/
function rowMatches(row, filter) {
	if (filter === "all") return true;
	if (filter === "confirmed") return row.outcome === "confirmed";
	return row.outcome === "insufficient" || row.outcome === "unverified";
}
/**
* How many rows each chip would show.
*
* Rendered on the chips themselves so an empty table always distinguishes "this
* filter has nothing" from "this run found nothing".
* @param rows - every verdict row of the run.
* @returns one count per filter.
*/
function filterCounts(rows) {
	const counts = {
		confirmed: 0,
		unresolved: 0,
		all: rows.length
	};
	for (const row of rows) if (rowMatches(row, "confirmed")) counts.confirmed += 1;
	else if (rowMatches(row, "unresolved")) counts.unresolved += 1;
	return counts;
}
/**
* Apply the chip, then the row window — in that order, and nowhere else.
*
* The order is the whole point and is why this is a function rather than two
* lines in the component: windowing first would take the first 50 rows of the
* WHOLE run and then filter those, so a blocker confirmed at row 60 would be
* missing from a `confirmed` chip that says it is showing it.
* @param rows - every verdict row of the run, in report order.
* @param filter - the active chip.
* @param showAll - whether the reader asked for the rest.
* @returns the filtered rows and the windowed slice actually drawn.
*/
function windowRows(rows, filter, showAll) {
	const filtered = rows.filter((row) => rowMatches(row, filter));
	return {
		filtered,
		visible: showAll ? filtered : filtered.slice(0, 50)
	};
}
/**
* Whether a path is already rooted, and therefore not workspace-relative.
*
* All three spellings the Host accepts: a POSIX absolute path, a Windows drive
* letter, and a UNC share.
* @param value - the candidate path.
* @returns whether it is already absolute.
*/
function isRooted(value) {
	return value.startsWith("/") || /^[A-Za-z]:[/\\]/u.test(value) || value.startsWith("\\\\");
}
/**
* Resolve a member's location against the session's workspace root.
*
* `ctx.workspaces.openPath` takes "an absolute or host-resolvable path", and the
* harness's own chat file-mention path resolves before calling it — a member
* reports `src/rank.py:521`, which means nothing without the workspace root.
*
* A deliberate in-plugin copy of the runtime's `resolveWorkspacePath`, NOT an
* import of it: the bundle-purity rule says collaborate through cordis services,
* and `ctx.workspaces` IS that service, while a value import of another bundle's
* helper would tie this plugin's load to that bundle's arrival — the failure
* that has already killed this card once. The cost is stated plainly: if the
* Host widens what spellings it accepts, this drifts, and the symptom is a file
* that does not open rather than anything silent.
* @param cwd - the session's workspace root, when the summary carries one.
* @param path - the finding's path, absolute or workspace-relative.
* @returns the path to hand the Host.
*/
function workspacePath(cwd, path) {
	if (isRooted(path)) return path;
	if (cwd === void 0 || cwd === "") return path;
	return `${cwd.replace(/[/\\]+$/u, "")}/${path.replace(/^[/\\]+/u, "")}`;
}
/**
* The file part of a finding's location.
*
* A location is `path:line`, `path:line:column`, or a bare `path`. Only a
* TRAILING numeric group is stripped, so a Windows drive letter (`C:\x\y.ts:12`)
* keeps its colon and loses only the line.
*
* The line itself is dropped on purpose and cannot be honoured: the one seam the
* client runtime exposes is `openPath(path)`, which hands the file to the
* operating system's default application. There is no reveal-at-line API to call.
* @param location - the finding's location as the member reported it.
* @returns the path, or `''` when the location is not one.
*/
function locationPath(location) {
	return location.trim().replace(/:\d+(?::\d+)?$/u, "");
}
/**
* Render an optional cost estimate for a token total.
* @param tokens - the token count.
* @param rate - $ per 1M tokens; 0 disables the estimate entirely.
* @returns the formatted estimate, or undefined when there is nothing to show.
*/
function estimateCost(tokens, rate) {
	if (!(rate > 0) || tokens === 0) return void 0;
	const amount = tokens / 1e6 * rate;
	return amount < .01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}
function totalOf(usage) {
	return usage === void 0 ? 0 : usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
function usageOf(sessions, childId) {
	return sessions.binding(childId)?.session?.projections.faceOf("tokenUsage")?.getSnapshot();
}
/** Build the live token-usage hooks bound to child-session projections. */
function makeUsageHooks(sessions) {
	const useMemberUsage = (childId) => {
		const subscribe = (0, react.useCallback)((onChange) => sessions.binding(childId)?.session?.projections.faceOf("tokenUsage")?.subscribe(onChange) ?? (() => {}), [childId]);
		return (0, react.useSyncExternalStore)(subscribe, () => usageOf(sessions, childId));
	};
	const useLayerTokens = (childIds) => {
		const key = childIds.join(",");
		const subscribe = (0, react.useCallback)((onChange) => {
			const disposers = key === "" ? [] : key.split(",").map((id) => sessions.binding(id)?.session?.projections.faceOf("tokenUsage")?.subscribe(onChange) ?? (() => {}));
			return () => {
				for (const dispose of disposers) dispose();
			};
		}, [key]);
		return (0, react.useSyncExternalStore)(subscribe, () => childIds.reduce((sum, id) => sum + totalOf(usageOf(sessions, id)), 0));
	};
	return {
		useMemberUsage,
		useLayerTokens
	};
}
/** Build the hooks reading the council settings section. */
function makeSettingsHooks(scope) {
	const subscribe = (listener) => scope.subscribe(listener);
	return {
		useCouncilPreset: () => (0, react.useSyncExternalStore)(subscribe, () => scope.getSnapshot().value?.agentPresetId ?? DEFAULT_COUNCIL_PRESET),
		useCostRate: () => (0, react.useSyncExternalStore)(subscribe, () => scope.getSnapshot().value?.costPerMillionTokens ?? 0),
		useCouncilTopology: () => (0, react.useSyncExternalStore)(subscribe, () => scope.getSnapshot().value)
	};
}
/**
* Register the Council conversation-view tab.
* @param ctx - the browser plugin context.
* @param scope - the bound `council` settings scope the preset gate reads.
*/
function registerCouncilView(ctx, scope) {
	const t = ctx.locale.bind(NS);
	const { useMemberUsage, useLayerTokens } = makeUsageHooks(ctx.sessions);
	const { useCouncilPreset, useCostRate, useCouncilTopology } = makeSettingsHooks(scope);
	const openLocation = (path, cwd) => ctx.workspaces.openPath(workspacePath(cwd, path));
	ctx.slots.inject("conversation.view", () => ctx.slots.register({
		name: "conversation.view",
		id: "council",
		order: 20,
		locale: NS,
		label: () => t("view.council"),
		inject: () => ({
			useMemberUsage,
			useLayerTokens,
			useCouncilPreset,
			useCostRate,
			useCouncilTopology,
			openLocation
		})
	}, CouncilView));
}
/**
* Collect the tool calls still in flight, at any depth.
*
* The running arm of `ToolCallBlock` has no `kind` discriminator at all, so it
* is recognized by the absence of the settled one plus the three fields the
* clock needs.
* @param block - one tool call block, possibly with sub-calls.
* @param into - accumulator.
*/
function collectRunningCalls(block, into) {
	if (block === void 0) return;
	if (block.kind !== "tool-result" && typeof block.time === "number" && typeof block.turn === "number" && typeof block.step === "number") into.push({
		turn: block.turn,
		step: block.step,
		time: block.time
	});
	for (const child of block.subCalls ?? []) collectRunningCalls(child, into);
}
/**
* The turn and step one chat node was anchored in.
* @param location - the node's engine-resolved location.
* @returns the step coordinates, or undefined when the node is not step-scoped.
*/
function stepOf(location) {
	return location.kind === "step" ? {
		turn: location.step.turn,
		step: location.step.step
	} : void 0;
}
/**
* Collect this plugin's run artifacts from the settled tool results in a chat.
*
* The artifact rides `tool/result`'s `meta`, which the harness persists for
* exactly this purpose — so a finished run reopens from the session log without
* the plugin writing a single record of its own.
* @param block - one tool call block, possibly with sub-calls.
* @param into - accumulator keyed by run id.
*/
function collectArtifacts(block, into) {
	if (block === void 0) return;
	const meta = block.meta;
	if (isArtifact(meta)) into.set(meta.runId, meta);
	for (const child of block.subCalls ?? []) collectArtifacts(child, into);
}
/**
* Recognize a council artifact in a persisted `meta` payload.
*
* This is a TYPE GUARD over data, not a sanity check: everything it admits is
* dereferenced unconditionally below — `result.counts.findings`,
* `result.verifiers.map`, `row.votes[column]`, `locationPath(row.location)`,
* `parseReport(result.report)`. A record that carries the right `kind` and
* `version` but a missing field therefore does not degrade, it throws inside
* the tab's render and blanks the whole view.
*
* The input class is real and the codebase already says so: artifacts are
* replayed from session logs a DIFFERENT build wrote (see `SEVERITY_LEVELS`,
* which exists for exactly that reason). `version` alone cannot police it,
* because a build that shipped a bug wrote version 1 too. So the guard checks
* every field the view reads, rows included — 200 rows at most, which is
* nothing beside the render it protects.
* @param meta - the tool result's presentation payload.
* @returns whether it is an artifact this build can read.
*/
function isArtifact(meta) {
	if (typeof meta !== "object" || meta === null) return false;
	const candidate = meta;
	return candidate.kind === "council-run" && candidate.version === 1 && typeof candidate.runId === "string" && typeof candidate.preset === "string" && typeof candidate.report === "string" && typeof candidate.counts === "object" && candidate.counts !== null && Array.isArray(candidate.layers) && Array.isArray(candidate.phases) && Array.isArray(candidate.messages) && Array.isArray(candidate.verifiers) && Array.isArray(candidate.rows) && candidate.rows.every(isArtifactRow);
}
/**
* Whether one persisted verdict row carries everything the table renders.
* @param row - one entry of the artifact's `rows`.
* @returns whether every field the table dereferences is present.
*/
function isArtifactRow(row) {
	if (typeof row !== "object" || row === null) return false;
	const candidate = row;
	return typeof candidate.findingId === "string" && typeof candidate.title === "string" && typeof candidate.location === "string" && typeof candidate.severity === "string" && typeof candidate.outcome === "string" && typeof candidate.fix === "string" && Array.isArray(candidate.votes);
}
/** Render the Council graph tab. */
function CouncilView(props) {
	const { useSession, useSessions, sessionId, t, useMemberUsage, useLayerTokens, useCouncilPreset, useCostRate, useCouncilTopology, openLocation } = props;
	const preset = useSessions((state) => state.byId[sessionId]?.agentPreset);
	const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
	const councilPreset = useCouncilPreset();
	const costRate = useCostRate();
	const settings = useCouncilTopology();
	const chat = useSession((state) => state.chat);
	if (preset !== councilPreset) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: council_view_module_css_default.empty,
		children: t("onlyCouncilPreset", { preset: councilPreset })
	});
	const artifacts = /* @__PURE__ */ new Map();
	const running = [];
	const runs = [];
	for (const node of chat.nodes.values()) if (node.kind === "workflow-run") runs.push({
		key: node.key,
		id: node.id,
		data: node.data,
		at: stepOf(node.location),
		artifact: null,
		startedAt: 0
	});
	else if (node.kind === "tool") {
		const root = node.data.root;
		collectArtifacts(root, artifacts);
		collectRunningCalls(root, running);
	}
	for (const run of runs) {
		run.artifact = artifacts.get(run.id) ?? null;
		run.startedAt = run.at === void 0 ? 0 : runStartFromCalls(running, run.at.turn, run.at.step) ?? 0;
	}
	forgetObserved(runs.filter((run) => run.data.status !== "running").map((run) => run.id));
	if (runs.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: council_view_module_css_default.empty,
		children: t("noRuns")
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: council_view_module_css_default.wrap,
		children: [
			runs.map((run, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Run, {
				run,
				defaultOpen: index === runs.length - 1,
				costRate,
				widths: declaredWidths(settings, sessionId, run.data.name),
				cwd,
				openLocation,
				t,
				useMemberUsage,
				useLayerTokens
			}, run.key)),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.footnote,
				children: t("legend.status")
			}),
			runs.some((run) => run.data.status === "running") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.footnote,
				children: t("live.legend")
			}) : null
		]
	});
}
function Run({ run, defaultOpen, costRate, widths, cwd, openLocation, t, useMemberUsage, useLayerTokens }) {
	const [open, setOpen] = (0, react.useState)(defaultOpen);
	const live = run.data.status === "running";
	const result = run.artifact;
	const layers = new Map((result?.layers ?? []).map((layer) => [layer.id, layer]));
	const endedAt = result === null ? 0 : result.startedAt + result.durationMs;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
		className: council_view_module_css_default.run,
		open,
		onToggle: (event) => {
			setOpen(event.currentTarget.open);
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
			className: council_view_module_css_default.runHead,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.runName,
					children: run.data.name
				}),
				result === null || result.task === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.runTask,
					children: result.task
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.runStatus,
					children: t(`status.${run.data.status}`)
				}),
				result?.stopReason === "deadline" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.chipWarn,
					children: t("chip.deadline")
				}) : null,
				result?.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.chipDanger,
					children: t("chip.failed")
				}),
				result === null || result.startedAt === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.runMeta,
					children: t("startedAt", { time: formatTime(result.startedAt) })
				}),
				result !== null || !live || run.startedAt === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.runMeta,
					children: t("startedAt", { time: formatTime(run.startedAt) })
				}),
				result === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.runMeta,
					children: t("seconds", { n: Math.round(result.durationMs / 1e3) })
				}),
				!live ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RunLive, {
					runId: run.id,
					startedAt: run.startedAt,
					childIds: run.data.phases.flatMap((phase) => phase.members.map((member) => member.childId)),
					costRate,
					t,
					useLayerTokens
				})
			]
		}), !open ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: council_view_module_css_default.runBody,
			children: [
				result === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: council_view_module_css_default.runSummary,
					children: t("summary", {
						responding: result.membersResponding,
						reporting: result.membersReporting,
						members: result.mapMembers,
						findings: result.counts.findings,
						confirmed: result.counts.confirmed
					})
				}),
				result?.stopReason === "deadline" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: council_view_module_css_default.warn,
					children: t("incomplete")
				}) : null,
				result?.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: council_view_module_css_default.warn,
					children: t("runFailed", { error: result.error })
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: council_view_module_css_default.layers,
					children: run.data.phases.map((phase) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Layer, {
						phase,
						layer: phase.phase === null ? void 0 : layers.get(phase.phase),
						durationMs: phaseDuration(result, phase.phase, endedAt),
						costRate,
						live,
						declared: phase.phase === null ? void 0 : widths.get(phase.phase),
						t,
						useMemberUsage,
						useLayerTokens
					}, phase.key))
				}),
				result === null || result.messages.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: council_view_module_css_default.runLog,
					children: result.messages.map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: line.text }, index))
				}),
				result === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Outcome, {
					result,
					cwd,
					openLocation,
					t
				})
			]
		})]
	});
}
/** How often the run clock re-renders while a run is in flight. */
const TICK_MS = 1e3;
/**
* The live half of a running run's header: a ticking clock, the run's token
* total, and the optional cost estimate.
*
* Rendered only while the run's status is `running`, so the interval and the
* token subscriptions exist exactly as long as there is something to watch.
* @param props - the run's identity, its members, and the viewer's rate.
* @returns the live header cells.
*/
function RunLive({ runId, startedAt, childIds, costRate, t, useLayerTokens }) {
	const tokens = useLayerTokens(childIds);
	const [now, setNow] = (0, react.useState)(() => Date.now());
	(0, react.useEffect)(() => {
		const timer = setInterval(() => {
			setNow(Date.now());
		}, TICK_MS);
		return () => {
			clearInterval(timer);
		};
	}, []);
	const cost = estimateCost(tokens, costRate);
	const exact = startedAt > 0;
	const since = exact ? startedAt : observedSince(runId, now);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: council_view_module_css_default.runClock,
			children: exact ? t("live.elapsed", { time: formatDuration(now - since) }) : t("live.observed", { time: formatDuration(now - since) })
		}),
		tokens === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: council_view_module_css_default.runMeta,
			children: t("tokens", { n: tokens })
		}),
		cost === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: council_view_module_css_default.runMeta,
			children: t("cost", { amount: cost })
		})
	] });
}
/**
* How long one phase took, from the script's own phase marks.
*
* Matched by TITLE, not by position: a layer can enter a phase and start no
* agents at all (a verify layer with nothing to verify), which leaves a phase
* mark with no matching group in the workflow-run node and would shift every
* later duration by one.
* @param artifact - the run's artifact, when it has settled.
* @param title - the phase's title, which is the layer id.
* @param endedAt - when the run settled, for the last phase.
* @returns the duration in milliseconds, or 0 when it cannot be established.
*/
function phaseDuration(artifact, title, endedAt) {
	if (artifact === null || title === null) return 0;
	const index = artifact.phases.findIndex((mark) => mark.title === title);
	const mark = artifact.phases[index];
	if (mark === void 0 || mark.at === 0) return 0;
	const next = artifact.phases[index + 1]?.at ?? endedAt;
	return next > mark.at ? next - mark.at : 0;
}
function Layer({ phase, layer, durationMs, costRate, live, declared, t, useMemberUsage, useLayerTokens }) {
	const tokens = useLayerTokens(phase.members.map((member) => member.childId));
	const cost = estimateCost(tokens, costRate);
	const heading = layer === void 0 ? phase.phase ?? "—" : `${layer.label} · ${t(`kind.${layer.kind}`)}`;
	const counts = liveCounts(phase.members);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
		className: council_view_module_css_default.layer,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: heading }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: council_view_module_css_default.layerMeta,
				children: [
					!live ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						counts.running === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: council_view_module_css_default.liveMark,
							children: t("live.running", { n: counts.running })
						}),
						counts.done === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("live.done", { n: counts.done }) }),
						counts.failed === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("live.failed", { n: counts.failed }) }),
						counts.stopped === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("live.stopped", { n: counts.stopped }) }),
						declared === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("live.declared", { n: declared }) })
					] }),
					tokens === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tokens", { n: tokens }) }),
					cost === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("cost", { amount: cost }) }),
					durationMs === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("seconds", { n: Math.round(durationMs / 1e3) }) })
				]
			}),
			phase.members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Member, {
				label: member.label,
				status: member.status,
				childId: member.childId,
				kind: layer?.kind,
				useMemberUsage,
				t
			}, member.seq))
		]
	});
}
function Member({ label, status, childId, kind, useMemberUsage, t }) {
	const usage = useMemberUsage(childId);
	const hintKey = ROLE_HINT_KEYS[label] ?? (kind === void 0 ? void 0 : `kindHint.${kind}`);
	const explanation = hintKey === void 0 ? void 0 : t(hintKey);
	const total = usage === void 0 ? void 0 : totalOf(usage);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: council_view_module_css_default.member,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: council_view_module_css_default.memberRow,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.dot,
					"data-status": status
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.memberLabel,
					children: label
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.memberStatus,
					children: t(`status.${status}`)
				}),
				total === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: council_view_module_css_default.memberTokens,
					children: t("tokens", { n: total })
				})
			]
		}), explanation === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: council_view_module_css_default.memberHint,
			children: explanation
		})]
	});
}
const EXPORT_FILE = {
	md: {
		extension: "md",
		type: "text/markdown"
	},
	json: {
		extension: "json",
		type: "application/json"
	},
	checklist: {
		extension: "checklist.md",
		type: "text/markdown"
	}
};
function Outcome({ result, cwd, openLocation, t }) {
	const [copied, setCopied] = (0, react.useState)("");
	const [showAll, setShowAll] = (0, react.useState)(false);
	const [filter, setFilter] = (0, react.useState)("all");
	const counts = filterCounts(result.rows);
	const { filtered, visible } = windowRows(result.rows, filter, showAll);
	const numbers = new Map(result.rows.map((row, index) => [row.findingId, index + 1]));
	const [copyError, setCopyError] = (0, react.useState)(false);
	const [openError, setOpenError] = (0, react.useState)("");
	const render = (format) => {
		if (format === "md") return toMarkdown(result, t);
		if (format === "checklist") return toChecklist(result, t);
		return JSON.stringify(result, null, 2);
	};
	const copyText = (text, mark) => {
		setCopyError(false);
		const write = navigator.clipboard?.writeText(text);
		if (write === void 0) {
			setCopyError(true);
			return;
		}
		write.then(() => {
			setCopied(mark);
		}, () => {
			setCopyError(true);
		});
	};
	const copy = (format) => {
		copyText(render(format), format);
	};
	const download = (format) => {
		const { extension, type } = EXPORT_FILE[format];
		setCopyError(!downloadText(`council-${result.preset}.${extension}`, render(format), type));
	};
	const open = (path) => {
		setOpenError("");
		openLocation(path, cwd).catch(() => {
			setOpenError(path);
		});
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: council_view_module_css_default.outcome,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: council_view_module_css_default.outcomeHead,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("verdicts") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: council_view_module_css_default.spacer }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							copy("md");
						},
						children: copied === "md" ? t("copied") : `${t("export")} MD`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							copy("json");
						},
						children: copied === "json" ? t("copied") : `${t("export")} JSON`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							copy("checklist");
						},
						children: copied === "checklist" ? t("copied") : `${t("export")} ${t("checklist.label")}`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							download("md");
						},
						children: `${t("download")} MD`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							download("json");
						},
						children: `${t("download")} JSON`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							download("checklist");
						},
						children: `${t("download")} ${t("checklist.label")}`
					})
				]
			}),
			copyError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.warn,
				role: "alert",
				children: t("copyFailed")
			}) : null,
			openError === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.warn,
				role: "alert",
				children: t("location.openFailed", { path: openError })
			}),
			result.rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.hint,
				children: t("noFindings")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: council_view_module_css_default.chips,
				children: ROW_FILTERS.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": candidate === filter,
					className: candidate === filter ? council_view_module_css_default.chipOn : council_view_module_css_default.chip,
					onClick: () => {
						setFilter(candidate);
						setShowAll(false);
					},
					children: t(`filter.${candidate}`, { n: counts[candidate] })
				}, candidate))
			}), filtered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.hint,
				children: t("filter.none")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: council_view_module_css_default.tableWrap,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
					className: council_view_module_css_default.table,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("caption", {
							className: council_view_module_css_default.caption,
							children: t("table.caption")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: "#"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("col.finding")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("col.location")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("col.severity")
							}),
							result.verifiers.map((verifier) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: verifier
							}, verifier)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("col.outcome")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("col.fix")
							})
						] }) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: visible.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
							"data-outcome": row.outcome,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "row",
									className: council_view_module_css_default.rowIndex,
									children: numbers.get(row.findingId)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: row.title }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocationCell, {
									location: row.location,
									copied: copied === `at:${row.findingId}`,
									onCopy: () => {
										copyText(row.location, `at:${row.findingId}`);
									},
									onOpen: open,
									t
								}) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: council_view_module_css_default.severity,
									"data-severity": row.severity,
									children: SEVERITY_LEVELS.has(row.severity) ? t(`severity.${row.severity}`) : row.severity
								}) }),
								result.verifiers.map((verifier, column) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: council_view_module_css_default.vote,
									children: row.votes[column] === null || row.votes[column] === void 0 ? "·" : VOTE_MARK[row.votes[column]] ?? "?"
								}, verifier)),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: t(`outcome.${row.outcome}`) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: row.fix === "" ? "—" : row.fix })
							]
						}, row.findingId)) })
					]
				})
			})] }),
			visible.length === filtered.length ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: council_view_module_css_default.showAll,
				onClick: () => {
					setShowAll(true);
				},
				children: t("showAllRows", {
					shown: visible.length,
					total: filtered.length
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.footnote,
				children: t("tableLegend")
			}),
			result.rows.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.footnote,
				children: t("filter.legend")
			}),
			result.rows.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.footnote,
				children: t("location.legend")
			}),
			result.rowsTruncated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.warn,
				children: t("rowsTruncated", {
					shown: result.rows.length,
					total: result.counts.findings
				})
			}) : null,
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("report") }),
			result.reportMissing || result.report === "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.warn,
				children: t("noReport")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Report, { text: result.report }),
			result.reportTruncated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: council_view_module_css_default.footnote,
				children: t("reportTruncated")
			}) : null
		]
	});
}
/**
* One finding's location: a monospace chip that copies itself, and — when the
* location names a file — a control that opens it.
*
* `rank.py:521` retyped by hand is how a verdict table stops being something you
* act on. Opening goes through `ctx.workspaces.openPath`, which hands the file
* to the operating system's default application; there is no reveal-at-line
* seam, so the LINE is copied but never jumped to.
* @param props - the location, its copied state, and the two actions.
* @returns the location cell.
*/
function LocationCell({ location, copied, onCopy, onOpen, t }) {
	const path = locationPath(location);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: council_view_module_css_default.location,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: council_view_module_css_default.locationChip,
				title: t("location.copy"),
				onClick: onCopy,
				children: location
			}),
			copied ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: council_view_module_css_default.locationNote,
				children: t("copied")
			}) : null,
			path === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: council_view_module_css_default.locationOpen,
				title: t("location.open"),
				"aria-label": t("location.open"),
				onClick: () => {
					onOpen(path);
				},
				children: "↗"
			})
		]
	});
}
/**
* Render one line's spans.
*
* Every span becomes a React text child, which React escapes. That is the whole
* XSS story for this feature: no HTML is built, so `<script>` in a model-written
* report is five characters of text.
* @param spans - the parsed spans of one heading, item, or paragraph.
* @returns the span elements.
*/
function Spans({ spans }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: spans.map((span, index) => span.kind === "code" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
		className: council_view_module_css_default.reportInline,
		children: span.text
	}, index) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: span.text }, index)) });
}
/**
* Render one structural block of the report.
* @param block - the parsed block.
* @returns its element.
*/
function Block({ block }) {
	if (block.kind === "heading") {
		const Tag = block.level === 1 ? "h5" : "h6";
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tag, {
			className: council_view_module_css_default.reportHeading,
			"data-level": block.level,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Spans, { spans: block.spans })
		});
	}
	if (block.kind === "code") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
		className: council_view_module_css_default.reportCode,
		"data-language": block.language === "" ? void 0 : block.language,
		children: block.text
	});
	if (block.kind === "list") {
		const Tag = block.ordered ? "ol" : "ul";
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tag, {
			className: council_view_module_css_default.reportList,
			children: block.items.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Spans, { spans: item }) }, index))
		});
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: council_view_module_css_default.reportParagraph,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Spans, { spans: block.spans })
	});
}
/**
* Render the synthesizer's report as structure rather than as a monospace wall.
* @param props - the report text, verbatim from the durable record.
* @returns the rendered report.
*/
function Report({ text }) {
	const blocks = parseReport(text);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: council_view_module_css_default.report,
		children: blocks.map((block, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Block, { block }, index))
	});
}
/** Escape a cell so `|` and newlines cannot break the exported Markdown table. */
function cell(value) {
	return value.replace(/\\/gu, "\\\\").replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ");
}
/**
* Collapse a member-authored string onto one line.
*
* The checklist is a list of line-oriented items, so a newline inside a title is
* not a formatting nuisance: a title containing `\n- [ ] already fixed` would
* forge an extra checklist entry that no member ever reported.
* @param value - the member-authored text.
* @returns the same text with every run of whitespace collapsed to one space.
*/
function oneLine(value) {
	return value.replace(/\s+/gu, " ").trim();
}
/**
* Render the confirmed findings as a Markdown task list.
*
* Confirmed only, and deliberately: this is the list somebody works through, and
* an unresolved row is not yet work. The unresolved rows stay one chip away in
* the table and in the full Markdown export.
* @param result - the durable outcome record.
* @param t - the locale binder.
* @returns the checklist text.
*/
function toChecklist(result, t) {
	const confirmed = result.rows.filter((row) => row.outcome === "confirmed");
	const lines = [`# ${t("checklist.title", { preset: result.preset })}`, ""];
	if (confirmed.length === 0) {
		lines.push(t("checklist.none"));
		return lines.join("\n");
	}
	for (const row of confirmed) {
		const title = oneLine(row.title);
		const location = oneLine(row.location);
		lines.push(location === "" ? `- [ ] ${title}` : `- [ ] ${title} — ${location}`);
		const fix = oneLine(row.fix);
		if (fix !== "") lines.push(`  - ${t("checklist.fix", { fix })}`);
	}
	return lines.join("\n");
}
/**
* Render one settled run as a self-contained Markdown document.
* @param result - the durable outcome record.
* @param t - the locale binder, so the export reads in the viewer's language.
* @returns the Markdown text.
*/
function toMarkdown(result, t) {
	const lines = [
		`# council: ${result.preset}`,
		"",
		t("summary", {
			responding: result.membersResponding,
			reporting: result.membersReporting,
			members: result.mapMembers,
			findings: result.counts.findings,
			confirmed: result.counts.confirmed
		}),
		""
	];
	if (result.stopReason === "deadline") lines.push(t("incomplete"), "");
	if (result.error !== void 0) lines.push(t("runFailed", { error: result.error }), "");
	if (result.rows.length > 0) {
		const header = [
			"#",
			t("col.finding"),
			t("col.location"),
			t("col.severity"),
			...result.verifiers,
			t("col.outcome"),
			t("col.fix")
		];
		lines.push(`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...result.rows.map((row, index) => `| ${[
			String(index + 1),
			cell(row.title),
			cell(row.location),
			SEVERITY_LEVELS.has(row.severity) ? t(`severity.${row.severity}`) : cell(row.severity),
			...result.verifiers.map((_verifier, column) => {
				const vote = row.votes[column];
				return vote === null || vote === void 0 ? "·" : VOTE_MARK[vote] ?? "?";
			}),
			t(`outcome.${row.outcome}`),
			row.fix === "" ? "—" : cell(row.fix)
		].join(" | ")} |`), "", t("tableLegend"), "");
	} else lines.push(t("noFindings"), "");
	lines.push(`## ${t("report")}`, "");
	lines.push(result.reportMissing || result.report === "" ? t("noReport") : result.report);
	return lines.join("\n");
}
//#endregion
//#region src/client/session-council-controller.ts
/** The value one session chose, or the empty draft. */
function emptyDraft(presetId, hasVerify) {
	return {
		presetId,
		name: "",
		custom: false,
		verifyEnabled: hasVerify,
		roles: {},
		addRoles: {},
		addLayers: [],
		topology: []
	};
}
/** A fresh custom (from-scratch) draft: empty chain, nothing anchored. */
function customDraft() {
	return {
		presetId: "",
		name: "",
		custom: true,
		verifyEnabled: true,
		roles: {},
		addRoles: {},
		addLayers: [],
		topology: []
	};
}
/** Clone one authored role. */
function auth(role) {
	return {
		...role,
		label: role.label ?? role.id,
		prompt: role.prompt
	};
}
/** Clone one authored layer (stored shape). */
function authLayer(layer) {
	return {
		id: layer.id,
		...layer.label === void 0 || layer.label === layer.id ? {} : { label: layer.label },
		...layer.kind === void 0 || layer.kind === "map" ? {} : { kind: layer.kind },
		roles: layer.roles.map(auth),
		...layer.quorum === void 0 || Object.keys(layer.quorum).length === 0 ? {} : { quorum: { ...layer.quorum } }
	};
}
/**
* Load a session's stored setup into an editable draft.
* @param presetId - the preset the draft should edit ('' for custom).
* @param presetHasVerify - whether that preset declares a verify layer.
* @param stored - the stored setup, or undefined.
* @returns the draft.
*/
function draftOf(presetId, presetHasVerify, stored) {
	if (stored === void 0) return emptyDraft(presetId, presetHasVerify);
	const custom = (stored.topology ?? []).length > 0 && (stored.presetId ?? "") === "";
	return {
		...custom ? customDraft() : emptyDraft(stored.presetId ?? presetId, presetHasVerify),
		presetId: stored.presetId ?? "",
		name: stored.name ?? "",
		verifyEnabled: custom ? true : stored.verifyEnabled !== false && presetHasVerify,
		roles: { ...stored.roles },
		quorum: stored.quorum === void 0 ? void 0 : { ...stored.quorum },
		addRoles: Object.fromEntries(Object.entries(stored.addRoles ?? {}).map(([layerId, roles]) => [layerId, roles.map(auth)])),
		addLayers: (stored.addLayers ?? []).map(authLayer),
		topology: custom ? (stored.topology ?? []).map(authLayer) : []
	};
}
/** Find one mirrored preset by id. */
function presetOf(presets, id) {
	return presets?.find((preset) => preset.id === id);
}
/** A verify layer's composed quorum, for effective-value display. */
function verifyLayerOf(preset) {
	return preset.layers.find((layer) => layer.kind === "verify");
}
/** The mirror data of one existing role inside a preset, when it exists. */
function baselineOf(preset, key) {
	const [layerId, roleId] = key.split(".");
	const layer = preset.layers.find((candidate) => candidate.id === layerId);
	const role = layer?.roles.find((candidate) => candidate.id === roleId);
	if (layer === void 0 || role === void 0) return void 0;
	return {
		layerId,
		roleId,
		count: role.count,
		model: role.model,
		provider: role.provider
	};
}
/** Set one existing role's absolute count in the draft. */
function setCount(draft, key, count) {
	const roles = { ...draft.roles };
	const entry = { ...roles[key] };
	entry.count = count;
	roles[key] = entry;
	return {
		...draft,
		roles
	};
}
/** Point one existing role at a provider + model pair ('' clears). */
function setRoutePair(draft, key, provider, model) {
	const roles = { ...draft.roles };
	const entry = { ...roles[key] };
	if (provider === "" && model === "") delete entry.model;
	else entry.model = model;
	if (provider === "") delete entry.provider;
	else entry.provider = provider;
	if (Object.keys(entry).length === 0) delete roles[key];
	else roles[key] = entry;
	return {
		...draft,
		roles
	};
}
/** Toggle the verify layer (preset-anchored drafts). */
function setVerify(draft, presetHasVerify, enabled) {
	return {
		...draft,
		verifyEnabled: enabled && presetHasVerify,
		...enabled ? {} : { quorum: void 0 }
	};
}
/** Set the verify layer's quorum (preset-anchored drafts). */
function setQuorum(draft, rule, threshold) {
	const quorum = { rule };
	if (rule === "threshold") {
		if (threshold !== void 0 && Number.isInteger(threshold) && threshold >= 1) quorum.threshold = threshold;
	}
	return {
		...draft,
		quorum
	};
}
/** A URL-ish slug, lowercased, punctuation dropped. */
function slugify(value) {
	const slug = value.trim().toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/gu, "-").replace(/^-+|-+$/gu, "");
	return slug === "" ? "role" : slug;
}
/** Mint an id unique within the preset from a label. */
function mintId(label, taken) {
	const base = slugify(label);
	let candidate = base;
	let copy = 2;
	while (taken.has(candidate)) {
		candidate = `${base}-${copy}`;
		copy += 1;
	}
	return candidate;
}
/** Append one authored role to an existing map/verify layer. */
function addRole(draft, layerId, role) {
	const addRoles = { ...draft.addRoles };
	addRoles[layerId] = [...addRoles[layerId] ?? [], role];
	return {
		...draft,
		addRoles
	};
}
/** Replace one authored role of an existing layer. */
function updateRole(draft, layerId, roleId, patch) {
	const addRoles = { ...draft.addRoles };
	addRoles[layerId] = (addRoles[layerId] ?? []).map((role) => role.id === roleId ? {
		...role,
		...patch
	} : role);
	return {
		...draft,
		addRoles
	};
}
/** Drop one authored role of an existing layer. */
function removeRole(draft, layerId, roleId) {
	const addRoles = { ...draft.addRoles };
	const roles = (addRoles[layerId] ?? []).filter((role) => role.id !== roleId);
	if (roles.length === 0) delete addRoles[layerId];
	else addRoles[layerId] = roles;
	return {
		...draft,
		addRoles
	};
}
/** Append one authored map layer under the mirrored preset. */
function addLayer(draft, layer) {
	return {
		...draft,
		addLayers: [...draft.addLayers, layer]
	};
}
/** Drop one whole authored map layer under the mirrored preset. */
function removeAuthoredLayer(draft, layerId) {
	return {
		...draft,
		addLayers: draft.addLayers.filter((layer) => layer.id !== layerId)
	};
}
/** Append an authored role to an authored map layer. */
function addLayerRole(draft, layerId, role) {
	return {
		...draft,
		addLayers: draft.addLayers.map((layer) => layer.id === layerId ? {
			...layer,
			roles: [...layer.roles, role]
		} : layer)
	};
}
/** Replace one authored role of an authored map layer. */
function updateLayerRole(draft, layerId, roleId, patch) {
	return {
		...draft,
		addLayers: draft.addLayers.map((layer) => layer.id === layerId ? {
			...layer,
			roles: layer.roles.map((role) => role.id === roleId ? {
				...role,
				...patch
			} : role)
		} : layer)
	};
}
/** Drop one authored role of an authored map layer. */
function removeLayerRole(draft, layerId, roleId) {
	return {
		...draft,
		addLayers: draft.addLayers.map((layer) => layer.id === layerId ? {
			...layer,
			roles: layer.roles.filter((role) => role.id !== roleId)
		} : layer)
	};
}
/** Insert one authored node before the trailing reduce (or append). */
function insertBeforeReduce(topology, layer) {
	const index = topology.findIndex((candidate) => candidate.kind === "reduce");
	const next = [...topology];
	next.splice(index === -1 ? next.length : index, 0, layer);
	return next;
}
/** Append a node of the given kind to a custom topology. */
function addCustomNode(draft, node) {
	if (node.kind === "reduce") return {
		...draft,
		topology: [...draft.topology, node]
	};
	return {
		...draft,
		topology: insertBeforeReduce(draft.topology, node)
	};
}
/** Set a custom node's label or quorum. */
function patchCustomNode(draft, nodeId, patch) {
	return {
		...draft,
		topology: draft.topology.map((node) => node.id === nodeId ? {
			...node,
			...patch
		} : node)
	};
}
/** Append an authored role to a custom node. */
function addCustomRole(draft, nodeId, role) {
	return {
		...draft,
		topology: draft.topology.map((node) => node.id === nodeId ? {
			...node,
			roles: [...node.roles, role]
		} : node)
	};
}
/** Replace one authored role of a custom node. */
function updateCustomRole(draft, nodeId, roleId, patch) {
	return {
		...draft,
		topology: draft.topology.map((node) => node.id === nodeId ? {
			...node,
			roles: node.roles.map((role) => role.id === roleId ? {
				...role,
				...patch
			} : role)
		} : node)
	};
}
/** Drop one authored role of a custom node. */
function removeCustomRole(draft, nodeId, roleId) {
	return {
		...draft,
		topology: draft.topology.map((node) => node.id === nodeId ? {
			...node,
			roles: node.roles.filter((role) => role.id !== roleId)
		} : node)
	};
}
/** Drop a whole custom node. */
function removeCustomNode(draft, nodeId) {
	return {
		...draft,
		topology: draft.topology.filter((node) => node.id !== nodeId)
	};
}
/** Serialize one authored role for the durable document. */
function serializeAuthor(role) {
	return {
		id: role.id,
		label: role.label === role.id ? role.id : role.label,
		prompt: role.prompt,
		...role.count === void 0 || role.count === 1 ? {} : { count: role.count },
		...role.model === void 0 || role.model === "" ? {} : { model: role.model },
		...role.provider === void 0 || role.provider === "" ? {} : { provider: role.provider }
	};
}
/** Serialize one authored layer for the durable document. */
function serializeLayer(layer) {
	return {
		id: layer.id,
		label: layer.label === void 0 || layer.label === layer.id ? layer.id : layer.label,
		...layer.kind === void 0 || layer.kind === "map" ? {} : { kind: layer.kind },
		roles: layer.roles.map(serializeAuthor),
		...layer.quorum === void 0 || Object.keys(layer.quorum).length === 0 ? {} : { quorum: { ...layer.quorum } }
	};
}
/**
* The durable document one Save should write for a draft.
*
* Fields equal to the preset's own composition are dropped. For a custom
* council the whole authored topology is stored with its name. Authored roles
* and layers are kept whole (minus their defaults).
* @param preset - the mirrored preset the draft edits (undefined for custom).
* @param draft - the draft.
* @returns the normalized setup to store.
*/
function projectSetup(preset, draft) {
	if (draft.custom) return {
		presetId: "",
		...draft.name === "" ? {} : { name: draft.name },
		topology: draft.topology.map(serializeLayer)
	};
	const roles = {};
	for (const [key, tune] of Object.entries(draft.roles)) {
		const baseline = preset === void 0 ? void 0 : baselineOf(preset, key);
		if (baseline === void 0) continue;
		const out = {};
		if (tune.count !== void 0 && tune.count !== baseline.count) out.count = tune.count;
		if (tune.model !== void 0 && tune.model !== "" && tune.model !== baseline.model) out.model = tune.model;
		if (tune.provider !== void 0 && tune.provider !== "" && tune.provider !== baseline.provider) out.provider = tune.provider;
		if (Object.keys(out).length > 0) roles[key] = out;
	}
	const hasVerify = preset?.layers.some((layer) => layer.kind === "verify") === true;
	const verify = preset === void 0 ? void 0 : verifyLayerOf(preset);
	let quorum;
	if (draft.verifyEnabled && hasVerify && verify !== void 0) {
		const composedRule = verify.quorumRule ?? "majority";
		const rule = draft.quorum?.rule ?? composedRule;
		if (rule === "threshold") {
			const threshold = draft.quorum?.threshold ?? verify.quorumThreshold;
			if (rule !== composedRule || threshold !== verify.quorumThreshold) {
				quorum = { rule };
				if (threshold !== void 0) quorum.threshold = threshold;
			}
		} else if (rule !== composedRule) quorum = { rule };
	}
	const addRoles = {};
	for (const [layerId, authored] of Object.entries(draft.addRoles)) if (authored.length > 0) addRoles[layerId] = authored.map(serializeAuthor);
	const addLayers = draft.addLayers.map((layer) => layer.roles.length === 0 ? void 0 : serializeLayer(layer)).filter((layer) => layer !== void 0);
	return {
		presetId: draft.presetId,
		...draft.name === "" ? {} : { name: draft.name },
		...hasVerify && !draft.verifyEnabled ? { verifyEnabled: false } : {},
		...Object.keys(roles).length === 0 ? {} : { roles },
		...quorum === void 0 || Object.keys(quorum).length === 0 ? {} : { quorum },
		...Object.keys(addRoles).length === 0 ? {} : { addRoles },
		...addLayers.length === 0 ? {} : { addLayers }
	};
}
/** Whether two stored documents are the same normalized setup. */
function setupsEqual(a, b) {
	return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
const EMPTY = {
	status: "loading",
	writable: false,
	councilPreset: "map-reduce",
	presets: [],
	defaultPreset: "",
	maxAgentsPerLayer: 0,
	maxLayers: 6,
	draft: customDraft(),
	dirty: false,
	hasStored: false,
	staged: {
		presetId: "",
		topology: []
	},
	roleLibrary: {},
	presetLibrary: {},
	widthViolations: [],
	quorumViolation: void 0,
	customError: void 0,
	error: ""
};
/** The custom-preset menu label prefix. */
const CUSTOM_OPTION = "custom";
/**
* Bridge the `council` settings namespace onto one session's designer.
*
* The draft lives here; the scope is read at publish time (fresh on every
* save, so two sessions never clobber each other's documents).
*/
var SessionCouncilController = class {
	scope;
	partialSaveMessage;
	listeners = /* @__PURE__ */ new Set();
	snapshot = EMPTY;
	draft;
	selected = "";
	error = "";
	detachScope;
	sessionId;
	constructor(scope, sessionId, partialSaveMessage = (error) => error) {
		this.scope = scope;
		this.partialSaveMessage = partialSaveMessage;
		this.sessionId = sessionId;
		this.detachScope = scope.subscribe(() => {
			this.publish();
		});
		this.publish();
	}
	/** Detach from the scope. Owned by the dock entry's effect. */
	dispose() {
		this.detachScope?.();
		this.detachScope = void 0;
		this.listeners.clear();
	}
	/** @returns the observable the renderer binds as `useCouncilDesign`. */
	store() {
		return {
			getSnapshot: () => this.snapshot,
			subscribe: (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
		};
	}
	/** @returns the actions the slot injects alongside the store. */
	actions() {
		return {
			selectPreset: (presetId) => {
				this.openPreset(presetId);
			},
			startCustom: (fromTemplate) => {
				this.selected = CUSTOM_OPTION;
				this.error = "";
				this.draft = fromTemplate === void 0 ? customDraft() : {
					...customDraft(),
					name: fromTemplate.label,
					topology: fromTemplate.layers.map(authLayer)
				};
				this.publish();
			},
			setName: (name) => {
				this.edit((draft) => ({
					...draft,
					name
				}));
			},
			setCount: (key, count) => {
				this.edit((draft) => setCount(draft, key, count));
			},
			setRoutePair: (key, provider, model) => {
				this.edit((draft) => setRoutePair(draft, key, provider, model));
			},
			setVerify: (enabled) => {
				const preset = presetOf(this.snapshot.presets, this.snapshot.draft.presetId);
				this.edit((draft) => setVerify(draft, this.hasVerifyOf(preset), enabled));
			},
			setQuorum: (rule, threshold) => {
				this.edit((draft) => setQuorum(draft, rule, threshold));
			},
			addRoleTo: (layerId, role) => {
				this.edit((draft) => addRole(draft, layerId, role));
			},
			editRole: (layerId, roleId, patch) => {
				this.edit((draft) => updateRole(draft, layerId, roleId, patch));
			},
			removeRole: (layerId, roleId) => {
				this.edit((draft) => removeRole(draft, layerId, roleId));
			},
			addAuthoredLayer: (layer) => {
				this.edit((draft) => addLayer(draft, layer));
			},
			removeAuthoredLayer: (layerId) => {
				this.edit((draft) => removeAuthoredLayer(draft, layerId));
			},
			addLayerRole: (layerId, role) => {
				this.edit((draft) => addLayerRole(draft, layerId, role));
			},
			editLayerRole: (layerId, roleId, patch) => {
				this.edit((draft) => updateLayerRole(draft, layerId, roleId, patch));
			},
			removeLayerRole: (layerId, roleId) => {
				this.edit((draft) => removeLayerRole(draft, layerId, roleId));
			},
			addCustomNode: (node) => {
				this.edit((draft) => addCustomNode(draft, node));
			},
			patchCustomNode: (nodeId, patch) => {
				this.edit((draft) => patchCustomNode(draft, nodeId, patch));
			},
			addCustomRole: (nodeId, role) => {
				this.edit((draft) => addCustomRole(draft, nodeId, role));
			},
			editCustomRole: (nodeId, roleId, patch) => {
				this.edit((draft) => updateCustomRole(draft, nodeId, roleId, patch));
			},
			removeCustomRole: (nodeId, roleId) => {
				this.edit((draft) => removeCustomRole(draft, nodeId, roleId));
			},
			removeCustomNode: (nodeId) => {
				this.edit((draft) => removeCustomNode(draft, nodeId));
			},
			saveRoleToLibrary: (role) => {
				this.saveRole(role);
			},
			deleteRoleFromLibrary: (roleId) => {
				this.deleteRole(roleId);
			},
			savePresetToLibrary: () => {
				this.savePreset();
			},
			deletePresetFromLibrary: (presetId) => {
				this.deletePreset(presetId);
			},
			save: () => {
				this.save();
			},
			discard: () => {
				this.selected = "";
				this.draft = void 0;
				this.error = "";
				this.publish();
			},
			clear: () => {
				this.selected = "";
				this.draft = void 0;
				this.error = "";
				this.writeSetup(void 0);
			}
		};
	}
	/** Width cap a role stepper offers (the schema ceiling). */
	roleWidthCap() {
		return 64;
	}
	hasVerifyOf(preset) {
		return preset?.layers.some((layer) => layer.kind === "verify") === true;
	}
	openPreset(presetId) {
		this.selected = presetId;
		this.error = "";
		const snapshot = this.scope.getSnapshot();
		const preset = presetOf(snapshot.value?.topology, presetId);
		const stored = snapshot.value?.sessionCouncil?.[this.sessionId];
		this.draft = stored?.presetId === presetId ? draftOf(presetId, this.hasVerifyOf(preset), stored) : emptyDraft(presetId, this.hasVerifyOf(preset));
		this.publish();
	}
	edit(apply) {
		this.draft = apply(this.snapshot.draft);
		this.error = "";
		this.publish();
	}
	async save() {
		if (this.snapshot.dirty === false) return;
		if (this.snapshot.customError !== void 0) return;
		if (this.snapshot.widthViolations.length > 0 || this.snapshot.quorumViolation !== void 0) return;
		try {
			await this.writeSetup(this.snapshot.staged);
			this.draft = void 0;
			this.error = "";
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.error = this.partialSaveMessage(message);
		}
		this.publish();
	}
	/** Write one session's setup into the `sessionCouncil` field. */
	async writeSetup(setup) {
		const map = { ...this.scope.getSnapshot().value?.sessionCouncil };
		if (setup === void 0) delete map[this.sessionId];
		else map[this.sessionId] = setup;
		await this.scope.set("sessionCouncil", map);
	}
	async saveRole(role) {
		try {
			const library = { ...this.scope.getSnapshot().value?.roleLibrary };
			library[role.id] = {
				id: role.id,
				label: role.label === "" ? role.id : role.label,
				prompt: role.prompt,
				count: role.count ?? 1,
				...role.model === void 0 || role.model === "" ? {} : { model: role.model },
				...role.provider === void 0 || role.provider === "" ? {} : { provider: role.provider }
			};
			await this.scope.set("roleLibrary", library);
		} catch (error) {
			this.error = this.partialSaveMessage(error instanceof Error ? error.message : String(error));
			this.publish();
		}
	}
	async deleteRole(roleId) {
		try {
			const library = { ...this.scope.getSnapshot().value?.roleLibrary };
			delete library[roleId];
			await this.scope.set("roleLibrary", library);
		} catch (error) {
			this.error = this.partialSaveMessage(error instanceof Error ? error.message : String(error));
			this.publish();
		}
	}
	async savePreset() {
		const draft = this.snapshot.draft;
		if (!draft.custom) return;
		const structural = customStructuralError(draft.topology);
		if (structural !== void 0) {
			this.error = this.partialSaveMessage(structural);
			this.publish();
			return;
		}
		const label = draft.name.trim() === "" ? "Custom" : draft.name.trim();
		const taken = new Set(Object.keys(this.snapshot.presetLibrary));
		try {
			const library = { ...this.scope.getSnapshot().value?.presetLibrary };
			const id = mintId(label, taken);
			library[id] = {
				id,
				label,
				layers: draft.topology.map(serializeLayer)
			};
			await this.scope.set("presetLibrary", library);
		} catch (error) {
			this.error = this.partialSaveMessage(error instanceof Error ? error.message : String(error));
			this.publish();
		}
	}
	async deletePreset(presetId) {
		try {
			const library = { ...this.scope.getSnapshot().value?.presetLibrary };
			delete library[presetId];
			await this.scope.set("presetLibrary", library);
		} catch (error) {
			this.error = this.partialSaveMessage(error instanceof Error ? error.message : String(error));
			this.publish();
		}
	}
	publish() {
		const snapshot = this.scope.getSnapshot();
		const presets = snapshot.value?.topology ?? [];
		const maxAgentsPerLayer = snapshot.value?.maxAgentsPerLayer ?? 0;
		const maxLayers = snapshot.value?.maxLayers ?? 6;
		const defaultPreset = snapshot.value?.defaultPreset ?? presets[0]?.id ?? "";
		const stored = snapshot.value?.sessionCouncil?.[this.sessionId];
		const storedPreset = stored?.presetId;
		const customStored = (stored?.topology?.length ?? 0) > 0 && (stored?.presetId ?? "") === "";
		const current = this.selected !== "" ? this.selected : customStored ? CUSTOM_OPTION : storedPreset ?? defaultPreset;
		this.selected = current;
		const preset = presetOf(presets, current);
		const storedDraft = this.draft === void 0 ? current === "custom" ? draftOf("", false, stored) : draftOf(current, this.hasVerifyOf(preset), stored) : this.draft;
		this.draft = storedDraft;
		const staged = preset === void 0 && !storedDraft.custom ? { presetId: current } : projectSetup(preset, storedDraft);
		const pristineDefault = stored === void 0 && !storedDraft.custom && preset !== void 0 && staged.presetId === defaultPreset && staged.verifyEnabled !== false && staged.quorum === void 0 && (staged.roles === void 0 || Object.keys(staged.roles).length === 0) && Object.keys(staged.addRoles ?? {}).length === 0 && (staged.addLayers ?? []).length === 0;
		const customWidths = storedDraft.custom ? customWidthViolations(storedDraft.topology, maxAgentsPerLayer) : preset === void 0 ? [] : [...sessionWidthViolations(preset, staged, maxAgentsPerLayer)];
		const customQuorum = storedDraft.custom ? customQuorumViolation(storedDraft.topology) : preset === void 0 ? void 0 : sessionQuorumViolation(preset, staged);
		this.snapshot = {
			status: snapshot.status,
			writable: snapshot.writable,
			councilPreset: snapshot.value?.agentPresetId ?? "map-reduce",
			presets,
			defaultPreset,
			maxAgentsPerLayer,
			maxLayers,
			draft: storedDraft,
			dirty: stored !== void 0 ? !setupsEqual(staged, stored) : !pristineDefault,
			hasStored: stored !== void 0,
			staged,
			roleLibrary: snapshot.value?.roleLibrary ?? {},
			presetLibrary: snapshot.value?.presetLibrary ?? {},
			widthViolations: storedDraft.custom ? [...customWidths] : [...customWidths],
			quorumViolation: customQuorum === void 0 ? void 0 : {
				rule: "threshold",
				...customQuorum
			},
			customError: storedDraft.custom ? customStructuralError(storedDraft.topology) : void 0,
			error: this.error
		};
		for (const listener of this.listeners) listener();
	}
};
//#endregion
//#region \0dsh-css:C:\git\map-reduce\src\client\session-council.module.css.mjs
const css = "/* Per-session council designer above the composer card.\n   Theme-safe by construction: the palette is built from `currentColor` /\n   `Canvas`/`CanvasText` (which follow the host's light or dark scheme) and the\n   harness's own --dsh-* tokens when they exist — never hard-coded white or\n   black, so the popovers and layer outlines stay visible in both themes. */\n.dshc_5259d2 {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  font-size: 12px;\n  color-scheme: inherit;\n}\n.dshc_5259d2, .dshc_5259d2 *, .dshc_5259d2 *::before, .dshc_5259d2 *::after { box-sizing: border-box; }\n\n.dshc_1db5e9 {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 4px 2px;\n  border: none;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  font-size: 12px;\n  text-align: left;\n  width: 100%;\n}\n.dshc_5da005 { font-weight: 600; opacity: 0.92; }\n.dshc_22d0e4 { display: inline-flex; align-items: center; gap: 6px; opacity: 0.65; min-width: 0; flex: 1 1 auto; }\n.dshc_9c2f79 {\n  font-size: 10px; font-style: normal; padding: 0 6px; border-radius: 999px;\n  color: var(--dsh-warning, currentColor);\n  background: color-mix(in srgb, var(--dsh-warning, currentColor) 16%, transparent);\n  flex: none;\n}\n.dshc_ffcb11 { font-size: 10px; opacity: 0.55; flex: none; }\n\n.dshc_624e59 {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 10px;\n  border-radius: 10px;\n  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);\n  background: color-mix(in srgb, currentColor 3%, transparent);\n}\n\n.dshc_79d7ee { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n.dshc_e79647 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }\n\n.dshc_b99153 { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }\n.dshc_366773 { display: flex; flex-direction: column; }\n.dshc_a0455e { text-align: center; font-size: 11px; opacity: 0.45; line-height: 1.2; }\n\n.dshc_26372e {\n  margin: 0;\n  padding: 6px 10px 8px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, currentColor 34%, transparent);\n  background: color-mix(in srgb, currentColor 4%, transparent);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.dshc_26372e[data-kind='map'] { border-color: color-mix(in srgb, var(--dsh-info, currentColor) 42%, transparent); }\n.dshc_26372e[data-kind='verify'] { border-color: color-mix(in srgb, var(--dsh-warning, currentColor) 46%, transparent); }\n.dshc_26372e[data-kind='reduce'] { border-color: color-mix(in srgb, currentColor 30%, transparent); }\n\n.dshc_7d0dbe {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 0;\n  font-size: 10px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n  opacity: 0.85;\n}\n.dshc_d3d779 { margin-left: auto; font-size: 11px; opacity: 0.75; font-variant-numeric: tabular-nums; }\n\n.dshc_f5fc42 {\n  font-size: 10px;\n  padding: 0 8px;\n  border-radius: 999px;\n  cursor: pointer;\n  color: inherit;\n  background: transparent;\n  border: 1px solid color-mix(in srgb, currentColor 34%, transparent);\n  text-transform: none;\n  font-weight: 500;\n  letter-spacing: 0;\n}\n.dshc_f5fc42:hover:not(:disabled) { background: color-mix(in srgb, currentColor 8%, transparent); }\n.dshc_f5fc42[aria-checked='false'] { opacity: 0.6; }\n\n.dshc_a7279d { display: flex; flex-direction: column; gap: 7px; padding-top: 2px; }\n\n.dshc_8da7a6 {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n.dshc_93a2f9 {\n  font-size: 12px; font-weight: 500;\n  min-width: 70px; max-width: 160px;\n  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.dshc_3fb2b4 { font-size: 11px; opacity: 0.6; font-variant-numeric: tabular-nums; }\n\n.dshc_e6bc07 { display: inline-flex; align-items: center; gap: 2px; flex: none; }\n.dshc_c2b954 { min-width: 20px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }\n.dshc_e20d0e {\n  width: 18px; height: 18px; padding: 0; border-radius: 5px;\n  font-size: 13px; line-height: 1; cursor: pointer;\n  color: inherit; background: transparent;\n  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);\n  display: inline-flex; align-items: center; justify-content: center;\n}\n.dshc_e20d0e:hover:not(:disabled) { background: color-mix(in srgb, currentColor 10%, transparent); }\n.dshc_e20d0e:disabled { opacity: 0.4; cursor: default; }\n\n/* Model/preset/menu chrome. Menus sit on Canvas (theme-aware) so white text\n   never lands on a hard-coded light panel in a dark session. */\n.dshc_226d98 { position: relative; display: inline-flex; }\n.dshc_8f9e9b {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  max-width: 240px;\n  padding: 2px 8px;\n  border-radius: 7px;\n  border: 1px solid color-mix(in srgb, currentColor 32%, transparent);\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  font-size: 12px;\n  line-height: 1.5;\n}\n.dshc_8f9e9b:hover:not(:disabled) { background: color-mix(in srgb, currentColor 8%, transparent); }\n.dshc_8f9e9b:disabled { opacity: 0.5; cursor: default; }\n.dshc_6a0195 {\n  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n  font-variant-numeric: tabular-nums;\n}\n.dshc_9a93df { flex: none; opacity: 0.6; color: currentColor; }\n\n.dshc_8e5f60 {\n  position: absolute;\n  z-index: 30;\n  top: calc(100% + 5px);\n  left: 0;\n  min-width: max(240px, 100%);\n  width: max-content;\n  max-width: min(360px, calc(100vw - 24px));\n  max-height: 340px;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 8px;\n  border-radius: 10px;\n  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);\n  background: Canvas;\n  color: CanvasText;\n  box-shadow: 0 8px 24px color-mix(in srgb, CanvasText 22%, transparent);\n}\n.dshc_8e5f60 .dshc_24730c,\n.dshc_8e5f60 .dshc_d43c6c,\n.dshc_8e5f60 .dshc_bec006,\n.dshc_8e5f60 .dshc_a3c9e6 {\n  color: inherit;\n}\n\n.dshc_24730c {\n  width: 100%;\n  flex: none;\n  padding: 5px 9px;\n  border-radius: 6px;\n  border: 1px solid color-mix(in srgb, currentColor 26%, transparent);\n  background: color-mix(in srgb, currentColor 6%, transparent);\n  color: inherit;\n  font-size: 12px;\n  caret-color: currentColor;\n}\n.dshc_24730c::placeholder { opacity: 0.55; }\n.dshc_aed5da {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  overflow-y: auto;\n  overflow-x: hidden;\n}\n.dshc_0addd9 {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  min-width: 0;\n  padding: 5px 9px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  font-size: 12px;\n  text-align: left;\n}\n.dshc_0addd9:hover { background: color-mix(in srgb, currentColor 10%, transparent); }\n.dshc_0addd9[aria-selected='true'] { background: color-mix(in srgb, currentColor 15%, transparent); font-weight: 600; }\n.dshc_868d4b { padding: 8px 9px; font-size: 12px; opacity: 0.6; }\n\n.dshc_597c28 { display: flex; flex-direction: column; margin-top: 3px; }\n.dshc_0165a2 {\n  padding: 2px 9px 4px;\n  font-size: 10px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n  opacity: 0.55;\n}\n.dshc_da6858 { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.dshc_c76f14 { margin-left: auto; flex: none; font-size: 11px; opacity: 0.55; font-variant-numeric: tabular-nums; }\n\n.dshc_e4dbd0 {\n  width: 20px; height: 20px;\n  padding: 0;\n  border: none;\n  border-radius: 5px;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  font-size: 12px;\n  opacity: 0.65;\n  flex: none;\n}\n.dshc_e4dbd0:hover { background: color-mix(in srgb, currentColor 10%, transparent); opacity: 1; }\n\n.dshc_de9233, .dshc_08f532 {\n  align-self: flex-start;\n  font-size: 11px;\n  padding: 2px 9px;\n  border-radius: 999px;\n  cursor: pointer;\n  color: var(--dsh-info, currentColor);\n  background: color-mix(in srgb, var(--dsh-info, currentColor) 10%, transparent);\n  border: 1px solid color-mix(in srgb, var(--dsh-info, currentColor) 40%, transparent);\n}\n.dshc_de9233:hover:not(:disabled), .dshc_08f532:hover:not(:disabled) {\n  background: color-mix(in srgb, var(--dsh-info, currentColor) 18%, transparent);\n}\n.dshc_de9233:disabled, .dshc_08f532:disabled { opacity: 0.45; cursor: default; }\n\n.dshc_b5b1ba { display: flex; flex-direction: column; gap: 5px; flex-basis: 100%; padding: 6px 2px 2px 6px; }\n.dshc_bec006, .dshc_a3c9e6, .dshc_d43c6c {\n  padding: 4px 8px;\n  border-radius: 6px;\n  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);\n  background: color-mix(in srgb, currentColor 5%, transparent);\n  color: inherit;\n  font-size: 12px;\n  font-family: inherit;\n  caret-color: currentColor;\n}\n.dshc_bec006 {\n  /* Compact single-line name field — the row's width, never the column's\n     height: in the column flex this must be height-agnostic, so width is\n     explicit and flex shrinks nothing vertical. */\n  flex: 0 0 auto;\n  width: min(260px, 100%);\n  height: auto;\n}\n.dshc_a3c9e6 {\n  resize: vertical;\n  width: 100%;\n  min-height: 140px;\n  max-height: 320px;\n  line-height: 1.5;\n}\n.dshc_d43c6c { width: 64px; }\n\n.dshc_15a37d { margin: 0; font-size: 11px; opacity: 0.6; }\n.dshc_67e6e4 { margin: 0; font-size: 12px; color: var(--dsh-danger, #e05353); }\n\n.dshc_e58bd8 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n.dshc_4d8369 { flex: 1 1 auto; }\n.dshc_4c44dd { font-size: 11px; opacity: 0.7; font-variant-numeric: tabular-nums; }\n\n.dshc_d519a0, .dshc_6c4ba8 {\n  font-size: 11px;\n  padding: 3px 10px;\n  border-radius: 7px;\n  cursor: pointer;\n}\n.dshc_d519a0 {\n  color: #fff;\n  background: var(--dsh-accent, #4a7dff);\n  border: 1px solid transparent;\n  font-weight: 600;\n}\n.dshc_d519a0:disabled { opacity: 0.5; cursor: default; }\n.dshc_6c4ba8 {\n  color: inherit;\n  background: transparent;\n  border: 1px solid color-mix(in srgb, currentColor 32%, transparent);\n}\n.dshc_6c4ba8:hover:not(:disabled) { background: color-mix(in srgb, currentColor 8%, transparent); }\n.dshc_6c4ba8:disabled { opacity: 0.45; cursor: default; }\n\n/* Custom name field and the library sections. */\n.dshc_ed13c1 {\n  flex: 1 1 220px;\n  min-width: 160px;\n  padding: 3px 8px;\n  border-radius: 7px;\n  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);\n  background: color-mix(in srgb, currentColor 5%, transparent);\n  color: inherit;\n  font-size: 12px;\n  font-family: inherit;\n  caret-color: currentColor;\n}\n.dshc_ed13c1::placeholder { opacity: 0.55; }\n\n.dshc_49171a { display: flex; flex-direction: column; gap: 2px; border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent); padding-top: 6px; }\n.dshc_6ed820 {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 3px 2px;\n  border: none;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  font-size: 11px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: 0.04em;\n  opacity: 0.8;\n  text-align: left;\n}\n.dshc_0bc334 { display: flex; flex-wrap: wrap; gap: 5px; padding: 2px 0 4px; }\n.dshc_b087f7 {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 1px 4px 1px 8px;\n  border-radius: 999px;\n  border: 1px solid color-mix(in srgb, currentColor 26%, transparent);\n  background: color-mix(in srgb, currentColor 6%, transparent);\n  font-size: 11px;\n}\n.dshc_b3a10a { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n/* Role rows align into even columns — name | members | model | actions — and\n   the same column widths repeat in every layer node, so the numbers and the\n   model triggers line up down the whole DAG. */\n.dshc_8da7a6 {\n  display: grid;\n  grid-template-columns: minmax(84px, 1fr) 80px minmax(150px, 208px) auto;\n  column-gap: 12px;\n  align-items: center;\n  row-gap: 4px;\n}\n.dshc_8da7a6 .dshc_93a2f9 { grid-column: 1; min-width: 0; max-width: none; }\n.dshc_8da7a6 .dshc_3fb2b4 { grid-column: 2; text-align: center; }\n.dshc_8da7a6 .dshc_e6bc07 { grid-column: 2; justify-self: center; }\n.dshc_8da7a6 .dshc_226d98 { grid-column: 3; width: 100%; max-width: none; }\n.dshc_8da7a6 .dshc_8f9e9b { width: 100%; max-width: 100%; }\n.dshc_8da7a6 .dshc_4963f6 { grid-column: 4; display: inline-flex; align-items: center; gap: 2px; justify-self: end; }\n.dshc_8da7a6 .dshc_b5b1ba { grid-column: 1 / -1; }\n";
const tagId = "@starsinc1708/dsh-tool-council/session-council.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "@starsinc1708/dsh-tool-council";
	tag.dataset.pluginCss = tagId;
	tag.textContent = css;
	document.head.appendChild(tag);
}
var session_council_module_css_default = {
	"panel": "dshc_5259d2",
	"head": "dshc_1db5e9",
	"title": "dshc_5da005",
	"subtitle": "dshc_22d0e4",
	"dirtyChip": "dshc_9c2f79",
	"chevron": "dshc_ffcb11",
	"body": "dshc_624e59",
	"row": "dshc_79d7ee",
	"rowLabel": "dshc_e79647",
	"flow": "dshc_b99153",
	"nodeWrap": "dshc_366773",
	"arrow": "dshc_a0455e",
	"node": "dshc_26372e",
	"nodeHead": "dshc_7d0dbe",
	"nodeWidth": "dshc_d3d779",
	"verifyToggle": "dshc_f5fc42",
	"roles": "dshc_a7279d",
	"roleRow": "dshc_8da7a6",
	"roleLabel": "dshc_93a2f9",
	"fixedOne": "dshc_3fb2b4",
	"stepper": "dshc_e6bc07",
	"count": "dshc_c2b954",
	"step": "dshc_e20d0e",
	"pickerWrap": "dshc_226d98",
	"pickerTrigger": "dshc_8f9e9b",
	"pickerLabel": "dshc_6a0195",
	"chevronIcon": "dshc_9a93df",
	"pickerMenu": "dshc_8e5f60",
	"search": "dshc_24730c",
	"thresholdInput": "dshc_d43c6c",
	"textInput": "dshc_bec006",
	"promptInput": "dshc_a3c9e6",
	"menuList": "dshc_aed5da",
	"menuItem": "dshc_0addd9",
	"menuEmpty": "dshc_868d4b",
	"providerGroup": "dshc_597c28",
	"providerTitle": "dshc_0165a2",
	"modelName": "dshc_da6858",
	"modelId": "dshc_c76f14",
	"iconButton": "dshc_e4dbd0",
	"addRoleButton": "dshc_de9233",
	"addButton": "dshc_08f532",
	"authForm": "dshc_b5b1ba",
	"hint": "dshc_15a37d",
	"warn": "dshc_67e6e4",
	"footer": "dshc_e58bd8",
	"spacer": "dshc_4d8369",
	"summary": "dshc_4c44dd",
	"primary": "dshc_d519a0",
	"ghost": "dshc_6c4ba8",
	"nameInput": "dshc_ed13c1",
	"library": "dshc_49171a",
	"libraryHead": "dshc_6ed820",
	"libraryBody": "dshc_0bc334",
	"chip": "dshc_b087f7",
	"chipLabel": "dshc_b3a10a",
	"roleActions": "dshc_4963f6"
};
//#endregion
//#region src/client/session-council.tsx
/**
* Per-session council designer, browser half.
*
* The only configuration surface the council has left: an expandable panel
* above the composer, visible inside Map-Reduce sessions, that FIXES how the
* council runs for this session. Pick one of the deployment's presets, a
* saved custom preset from **My presets**, or build a council from scratch
* (**Custom**): tune every preset role's width and model, append your own
* roles (each with its own lens prompt), add whole extra map layers, switch
* verification off, restate its quorum — then Save. Roles you author can be
* stored into **My roles** and inserted into any layer of any later session
* with one click; a finished custom topology can be saved as a reusable
* preset template.
*
* @module @deepseek-ai/dsh-client-ui-council
*/
/** The dock entry's list id. */
const COUNCIL_DESIGNER_SLOT_ID = "council-design";
/** The preset id assumed when the deployment mirrored none. */
const FALLBACK_COUNCIL_PRESET = "map-reduce";
/** Quorum rules, in menu order. */
const QUORUM_RULES = [
	"majority",
	"unanimous",
	"threshold"
];
/** One existing mirror role as its display row (tunings applied). */
function roleRowOf(layerId, role, draft) {
	const tune = draft.roles[`${layerId}.${role.id}`];
	return {
		key: `${layerId}.${role.id}`,
		roleId: role.id,
		label: role.label ?? role.id,
		count: tunedCount(role.count, tune),
		provider: tune?.provider !== void 0 && tune.provider !== "" ? tune.provider : role.provider,
		model: tune?.model !== void 0 && tune.model !== "" ? tune.model : role.model
	};
}
/** An authored role as its display row. */
function authoredRow(layerId, role) {
	return {
		key: `${layerId}.${role.id}`,
		roleId: role.id,
		label: role.label === "" ? role.id : role.label,
		count: role.count ?? 1,
		provider: role.provider ?? "",
		model: role.model ?? "",
		prompt: role.prompt
	};
}
/** A custom topology node as its display row set. */
function customNodeRows(nodeId, roles) {
	return roles.map((role) => authoredRow(nodeId, role));
}
/** The flow of a preset-anchored draft (mirror layers + authored map layers). */
function flowOf(preset, draft) {
	const kept = [];
	for (const layer of preset.layers) {
		if (layer.kind === "verify" && draft.verifyEnabled === false) continue;
		const authored = layer.kind === "map" || layer.kind === "verify" ? (draft.addRoles[layer.id] ?? []).map((role) => authoredRow(layer.id, role)) : [];
		kept.push({
			id: layer.id,
			kind: layer.kind,
			roles: [...layer.roles.map((role) => roleRowOf(layer.id, role, draft)), ...authored],
			authored: false
		});
	}
	const extras = draft.addLayers.map((layer) => ({
		id: layer.id,
		kind: "map",
		roles: layer.roles.map((role) => authoredRow(layer.id, role)),
		authored: true,
		label: layer.label ?? layer.id
	}));
	if (extras.length > 0) {
		const firstNonMap = kept.findIndex((node) => node.kind !== "map");
		kept.splice(firstNonMap === -1 ? kept.length : firstNonMap, 0, ...extras);
	}
	return kept;
}
/** The flow of a custom (from-scratch) topology. */
function customFlowOf(topology) {
	return topology.map((layer) => ({
		id: layer.id,
		kind: layer.kind ?? "map",
		roles: customNodeRows(layer.id, layer.roles),
		authored: true,
		label: layer.label ?? layer.id
	}));
}
/**
* The composer-dock designer for one Map-Reduce session.
* @param props - the dock entry's composed props.
* @returns the panel, or nothing outside Map-Reduce sessions.
*/
function CouncilDesigner(props) {
	const { scope, t } = props;
	const sessionId = props.session.sessionId;
	const agentPreset = props.useSessions((state) => state.byId[sessionId]?.agentPreset);
	const [open, setOpen] = (0, react.useState)(false);
	const modelDirectories = props.modelDirectories;
	const [controller] = (0, react.useState)(() => new SessionCouncilController(scope, sessionId, (error) => t("saveFailed", { error })));
	(0, react.useEffect)(() => () => {
		controller.dispose();
	}, [controller]);
	const [models] = (0, react.useState)(() => modelDirectories?.directoryFor(sessionId));
	const store = controller.store();
	const state = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
	const actions = controller.actions();
	if (!(agentPreset !== void 0 && agentPreset === (state.councilPreset || FALLBACK_COUNCIL_PRESET)) || state.status === "loading") return null;
	if (state.status !== "ready") return null;
	const draft = state.draft;
	const preset = presetOf(state.presets, draft.presetId);
	const flow = draft.custom ? customFlowOf(draft.topology) : preset === void 0 ? [] : flowOf(preset, draft);
	const verifyNode = flow.find((node) => node.kind === "verify");
	const verifyWidth = (verifyNode?.roles ?? []).reduce((sum, role) => sum + role.count, 0);
	const composedVerify = draft.custom ? void 0 : preset?.layers.find((layer) => layer.kind === "verify");
	const effectiveRule = verifyNode === void 0 ? void 0 : draft.quorum?.rule ?? composedVerify?.quorumRule ?? "majority";
	const effectiveThreshold = verifyNode === void 0 ? void 0 : draft.quorum?.threshold ?? composedVerify?.quorumThreshold;
	const presetOptions = [
		...state.presets.map((candidate) => ({
			value: candidate.id,
			label: candidate.label
		})),
		...Object.values(state.presetLibrary).map((template) => ({
			value: `template:${template.id}`,
			label: `★ ${template.label}`
		})),
		{
			value: CUSTOM_OPTION,
			label: t("designer.custom")
		}
	];
	const chosenValue = draft.custom ? CUSTOM_OPTION : state.presets.some((p) => p.id === draft.presetId) ? draft.presetId : "";
	const menuLabel = draft.custom ? draft.name === "" ? t("designer.custom") : draft.name : preset?.label ?? chosenValue;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: session_council_module_css_default.panel,
		"data-council-designer": "",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: session_council_module_css_default.head,
			"aria-expanded": open,
			onClick: () => {
				setOpen(!open);
			},
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: session_council_module_css_default.title,
					children: t("designer.title")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: session_council_module_css_default.subtitle,
					children: [t("designer.preset", { preset: menuLabel }), state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: session_council_module_css_default.dirtyChip,
						children: t("designer.unsaved")
					}) : null]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: session_council_module_css_default.chevron,
					children: open ? "▴" : "▾"
				})
			]
		}), !open ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: session_council_module_css_default.body,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: session_council_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: session_council_module_css_default.rowLabel,
						children: t("designer.presetLabel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Menu, {
						value: chosenValue,
						options: presetOptions,
						onSelect: (value) => {
							if (value === "custom") {
								actions.startCustom();
								return;
							}
							if (value.startsWith("template:")) {
								const template = state.presetLibrary[value.slice(9)];
								if (template !== void 0) actions.startCustom(template);
								return;
							}
							actions.selectPreset(value);
						},
						disabled: !state.writable
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
					className: session_council_module_css_default.flow,
					children: flow.map((node, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LayerNode, {
						node,
						first: index === 0,
						preset,
						draft,
						custom: draft.custom,
						maxWidth: state.maxAgentsPerLayer,
						maxLayers: state.maxLayers,
						totalLayers: flow.length,
						library: Object.values(state.roleLibrary),
						models,
						t,
						actions
					}, node.id))
				}),
				!draft.custom ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CustomAddRow, {
					topology: draft.topology,
					maxLayers: state.maxLayers,
					t,
					actions
				}),
				draft.custom ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: session_council_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: session_council_module_css_default.rowLabel,
						children: t("designer.quorum")
					}), verifyNode === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: session_council_module_css_default.hint,
						children: preset !== void 0 && preset.layers.some((layer) => layer.kind === "verify") && !draft.verifyEnabled ? t("designer.verifySkipped") : t("designer.noVerify")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Menu, {
							value: effectiveRule ?? "majority",
							options: QUORUM_RULES.map((rule) => ({
								value: rule,
								label: t(`quorumRule.${rule}`)
							})),
							onSelect: (value) => {
								const rule = value;
								if (rule === "threshold") actions.setQuorum(rule, Math.max(1, Math.ceil(verifyWidth / 2)));
								else actions.setQuorum(rule);
							},
							disabled: !state.writable
						}),
						(effectiveRule ?? "majority") !== "threshold" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: session_council_module_css_default.thresholdInput,
							type: "number",
							min: 1,
							max: Math.max(1, verifyWidth),
							value: effectiveThreshold ?? "",
							disabled: !state.writable,
							onChange: (event) => {
								const next = Number(event.target.value);
								if (Number.isInteger(next) && next >= 1) actions.setQuorum("threshold", next);
							},
							"aria-label": t("designer.threshold")
						}),
						effectiveRule !== "threshold" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: session_council_module_css_default.hint,
							children: t("designer.thresholdHint", { width: verifyWidth })
						})
					] })]
				}),
				draft.custom && verifyNode === void 0 && draft.topology.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: session_council_module_css_default.hint,
					children: t("designer.noVerifyHint")
				}) : null,
				draft.custom && state.customError !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: session_council_module_css_default.warn,
					role: "alert",
					children: t("designer.customError", { error: t(`custom.${state.customError}`) })
				}) : null,
				state.widthViolations.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: session_council_module_css_default.warn,
					role: "alert",
					children: t("designer.widthExceeded", {
						preset: draft.custom ? t("designer.custom") : draft.presetId,
						layer: state.widthViolations[0]?.layerId ?? "",
						width: state.widthViolations[0]?.width ?? 0,
						max: state.widthViolations[0]?.max ?? 0
					})
				}),
				state.quorumViolation === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: session_council_module_css_default.warn,
					role: "alert",
					children: t("designer.thresholdInvalid", {
						threshold: state.quorumViolation.threshold,
						width: state.quorumViolation.width
					})
				}),
				state.error === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: session_council_module_css_default.warn,
					role: "alert",
					children: state.error
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: session_council_module_css_default.footer,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: session_council_module_css_default.summary,
							children: summaryOf(flow)
						}),
						draft.custom ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: session_council_module_css_default.nameInput,
							placeholder: t("designer.namePlaceholder"),
							value: draft.name,
							onChange: (event) => {
								actions.setName(event.target.value);
							}
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: session_council_module_css_default.spacer }),
						draft.custom ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: session_council_module_css_default.ghost,
							disabled: !state.writable || state.customError !== void 0,
							onClick: () => {
								actions.savePresetToLibrary();
							},
							children: t("designer.savePreset")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: session_council_module_css_default.ghost,
							title: canClear(state) ? void 0 : t("designer.clearDisabledHint"),
							onClick: () => {
								actions.clear();
							},
							disabled: !state.writable || !canClear(state),
							children: t("designer.clear")
						}),
						state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: session_council_module_css_default.ghost,
							onClick: () => {
								actions.discard();
							},
							children: t("designer.discard")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: session_council_module_css_default.primary,
							onClick: () => {
								actions.save();
							},
							disabled: !state.writable || state.widthViolations.length > 0 || state.quorumViolation !== void 0 || state.customError !== void 0,
							children: t("designer.save")
						})] }) : null
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleLibrary, {
					library: Object.values(state.roleLibrary),
					presetLibrary: Object.values(state.presetLibrary),
					t,
					actions
				})
			]
		})]
	});
}
/** One-line layer summary for the footer. */
function summaryOf(flow) {
	return flow.map((node) => `${node.kind} ${node.roles.reduce((sum, role) => sum + role.count, 0)}`).join(" · ");
}
/** Whether "Let the model pick the preset" has anything to revert. */
function canClear(state) {
	return state.hasStored || state.dirty || state.draft.custom;
}
/** Buttons for growing a custom topology (map / verify / reduce nodes). */
function CustomAddRow(props) {
	const { topology, maxLayers, t, actions } = props;
	const hasVerify = topology.some((layer) => layer.kind === "verify");
	const hasReduce = topology.some((layer) => layer.kind === "reduce");
	const taken = new Set(topology.map((layer) => layer.id));
	const make = (kind, label) => {
		const id = mintId(label, taken);
		return kind === "reduce" ? {
			id,
			kind,
			label: id,
			roles: [{
				id: "synthesizer",
				label: "Synthesizer",
				prompt: t("custom.reduceSeed")
			}]
		} : {
			id,
			kind,
			label: id,
			roles: [],
			...kind === "verify" ? { quorum: { rule: "majority" } } : {}
		};
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: session_council_module_css_default.row,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: session_council_module_css_default.rowLabel,
				children: t("designer.nodes")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: session_council_module_css_default.addButton,
				disabled: topology.length >= maxLayers,
				onClick: () => {
					actions.addCustomNode(make("map", t("custom.mapNode")));
				},
				children: t("custom.addMap")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: session_council_module_css_default.addButton,
				disabled: hasVerify,
				onClick: () => {
					actions.addCustomNode(make("verify", t("custom.verifyNode")));
				},
				children: t("custom.addVerify")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: session_council_module_css_default.addButton,
				disabled: hasReduce,
				onClick: () => {
					actions.addCustomNode(make("reduce", t("custom.reduceNode")));
				},
				children: t("custom.addReduce")
			})
		]
	});
}
/** One layer node of the DAG. */
function LayerNode({ node, first, preset, draft, custom, maxWidth, maxLayers, totalLayers, library, models, t, actions }) {
	const width = node.roles.reduce((sum, role) => sum + role.count, 0);
	const kindLabel = t(`kind.${node.kind}`);
	const heading = node.authored ? `${node.label ?? node.id} · ${kindLabel}` : `${node.id} · ${kindLabel}`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: session_council_module_css_default.nodeWrap,
		children: [!first ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: session_council_module_css_default.arrow,
			"aria-hidden": "true",
			children: "↓"
		}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
			className: session_council_module_css_default.node,
			"data-kind": node.kind,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
					className: session_council_module_css_default.nodeHead,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: heading }),
						node.kind === "verify" && !custom ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: session_council_module_css_default.verifyToggle,
							role: "switch",
							"aria-checked": draft.verifyEnabled,
							onClick: () => {
								actions.setVerify(!draft.verifyEnabled);
							},
							disabled: !maxWidth,
							children: draft.verifyEnabled ? t("designer.verifyOn") : t("designer.verifyOff")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: session_council_module_css_default.nodeWidth,
							children: t("designer.members", { n: width })
						}),
						node.authored ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: session_council_module_css_default.iconButton,
							"aria-label": t("designer.removeLayer"),
							title: t("designer.removeLayer"),
							onClick: () => {
								if (custom) actions.removeCustomNode(node.id);
								else actions.removeAuthoredLayer(node.id);
							},
							children: "✕"
						}) : null
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: session_council_module_css_default.roles,
					children: node.roles.map((row) => {
						const sink = sinkFor(node, row, preset, draft, custom, actions);
						const editable = node.authored || row.prompt !== void 0;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleRow, {
							row,
							kind: node.kind,
							sink,
							editable,
							maxWidth,
							models,
							t,
							onSaveRole: () => {
								actions.saveRoleToLibrary({
									id: row.roleId,
									label: row.label === "" ? row.roleId : row.label,
									prompt: row.prompt ?? "",
									count: row.count,
									provider: row.provider,
									model: row.model
								});
							}
						}, row.key);
					})
				}),
				node.kind === "reduce" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AddRoleMenu, {
					node,
					custom,
					maxWidth,
					library,
					t,
					actions
				})
			]
		})]
	});
}
/** Build the mutation sink for one role row depending on its origin. */
function sinkFor(node, row, preset, draft, custom, actions) {
	const layerId = node.id;
	const roleId = row.roleId;
	if (!(node.authored || row.prompt !== void 0)) return {
		count: (next) => actions.setCount(row.key, next),
		route: (provider, model) => actions.setRoutePair(row.key, provider, model),
		patch: (_patch) => {},
		remove: () => {}
	};
	if (custom) return {
		count: (next) => actions.editCustomRole(layerId, roleId, { count: next }),
		route: (provider, model) => actions.editCustomRole(layerId, roleId, {
			provider,
			model
		}),
		patch: (patch) => actions.editCustomRole(layerId, roleId, patch),
		remove: () => actions.removeCustomRole(layerId, roleId)
	};
	const intoExtra = node.authored;
	return {
		count: (next) => {
			if (intoExtra) actions.editLayerRole(layerId, roleId, { count: next });
			else actions.editRole(layerId, roleId, { count: next });
		},
		route: (provider, model) => {
			const patch = {
				provider,
				model
			};
			if (intoExtra) actions.editLayerRole(layerId, roleId, patch);
			else actions.editRole(layerId, roleId, patch);
		},
		patch: (patch) => {
			if (intoExtra) actions.editLayerRole(layerId, roleId, patch);
			else actions.editRole(layerId, roleId, patch);
		},
		remove: () => {
			if (intoExtra) actions.removeLayerRole(layerId, roleId);
			else actions.removeRole(layerId, roleId);
		}
	};
}
/** The per-node "Add role" control: a new role, or one from My roles. */
function AddRoleMenu(props) {
	const { node, custom, maxWidth, library, t, actions } = props;
	const [open, setOpen] = (0, react.useState)(false);
	const add = (seed) => {
		if (custom) actions.addCustomRole(node.id, seed);
		else if (node.authored) actions.addLayerRole(node.id, seed);
		else actions.addRoleTo(node.id, seed);
	};
	const insertLibrary = (template) => {
		const label = template.label ?? template.id;
		add({
			id: mintId(label, /* @__PURE__ */ new Set([...node.roles.map((r) => r.roleId)])),
			label,
			prompt: template.prompt
		});
		setOpen(false);
	};
	const newRole = () => {
		add({
			id: mintId(t("designer.newRole"), new Set(node.roles.map((r) => r.roleId))),
			label: t("designer.newRole"),
			prompt: t("designer.promptSeed", { role: t("designer.newRole") })
		});
		setOpen(false);
	};
	const options = [...library.map((role) => ({
		value: role.id,
		label: `My roles: ${role.label ?? role.id}`
	}))];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: session_council_module_css_default.pickerWrap,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			className: session_council_module_css_default.addRoleButton,
			disabled: !maxWidth,
			onClick: () => {
				setOpen(!open);
			},
			children: t("designer.addRole")
		}), !open ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: session_council_module_css_default.pickerMenu,
			role: "menu",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: session_council_module_css_default.menuList,
				role: "listbox",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: session_council_module_css_default.menuItem,
						onClick: newRole,
						children: t("designer.newRoleItem")
					}),
					options.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: session_council_module_css_default.providerTitle,
						children: t("designer.myRoles")
					}),
					options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: session_council_module_css_default.menuItem,
						onClick: () => {
							const role = library.find((candidate) => candidate.id === option.value);
							if (role !== void 0) insertLibrary(role);
						},
						children: option.label
					}, option.value))
				]
			})
		})]
	});
}
/** One role row with its mutation sink. */
function RoleRow(props) {
	const { row, kind, sink, editable, maxWidth, models, t, onSaveRole } = props;
	const [editing, setEditing] = (0, react.useState)(false);
	const label = row.label === "" ? row.roleId : row.label;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: session_council_module_css_default.roleRow,
		"data-role": "",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: session_council_module_css_default.roleLabel,
				title: label,
				children: label
			}),
			kind === "reduce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: session_council_module_css_default.fixedOne,
				title: t("designer.singleInstance"),
				children: "1×"
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CountStepper, {
				value: row.count,
				max: maxWidth,
				onCommit: sink.count,
				t
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelPicker, {
				value: {
					provider: row.provider,
					model: row.model
				},
				models,
				onPick: ({ provider, model }) => sink.route(provider, model),
				disabled: !maxWidth,
				t
			}),
			!editable ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: session_council_module_css_default.roleActions,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: session_council_module_css_default.iconButton,
						"aria-label": t("designer.edit"),
						title: t("designer.edit"),
						onClick: () => {
							setEditing(!editing);
						},
						children: "✎"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: session_council_module_css_default.iconButton,
						"aria-label": t("designer.saveRole"),
						title: t("designer.saveRole"),
						onClick: onSaveRole,
						children: "💾"
					}),
					kind === "reduce" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: session_council_module_css_default.iconButton,
						"aria-label": t("designer.removeRole"),
						title: t("designer.removeRole"),
						onClick: sink.remove,
						children: "✕"
					})
				]
			}),
			!editing || !editable ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AuthoredRoleForm, {
				initialLabel: row.label,
				initialPrompt: row.prompt ?? "",
				onPatch: sink.patch,
				t
			})
		]
	});
}
/** The reusable library section at the bottom of the panel. */
function RoleLibrary(props) {
	const { library, presetLibrary, t, actions } = props;
	const [openRoles, setOpenRoles] = (0, react.useState)(false);
	const [openPresets, setOpenPresets] = (0, react.useState)(false);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: session_council_module_css_default.library,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: session_council_module_css_default.libraryHead,
				onClick: () => {
					setOpenRoles(!openRoles);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("designer.myRoles", { n: library.length }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: session_council_module_css_default.chevron,
					children: openRoles ? "▴" : "▾"
				})]
			}),
			!openRoles ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: session_council_module_css_default.libraryBody,
				children: [library.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: session_council_module_css_default.hint,
					children: t("designer.noSavedRoles")
				}) : null, library.map((role) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: session_council_module_css_default.chip,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: session_council_module_css_default.chipLabel,
						title: role.label ?? role.id,
						children: role.label ?? role.id
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: session_council_module_css_default.iconButton,
						"aria-label": t("designer.deleteRole"),
						onClick: () => {
							actions.deleteRoleFromLibrary(role.id);
						},
						children: "✕"
					})]
				}, role.id))]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: session_council_module_css_default.libraryHead,
				onClick: () => {
					setOpenPresets(!openPresets);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("designer.myPresets", { n: presetLibrary.length }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: session_council_module_css_default.chevron,
					children: openPresets ? "▴" : "▾"
				})]
			}),
			!openPresets ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: session_council_module_css_default.libraryBody,
				children: [presetLibrary.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: session_council_module_css_default.hint,
					children: t("designer.noSavedPresets")
				}) : null, presetLibrary.map((template) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: session_council_module_css_default.chip,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: session_council_module_css_default.chipLabel,
						title: template.label,
						children: ["★ ", template.label]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: session_council_module_css_default.iconButton,
						"aria-label": t("designer.deletePreset"),
						onClick: () => {
							actions.deletePresetFromLibrary(template.id);
						},
						children: "✕"
					})]
				}, template.id))]
			})
		]
	});
}
/** A minus/count/plus stepper that clamps into `1..max`. */
function CountStepper(props) {
	const { value, max, onCommit, t } = props;
	const up = () => {
		if (value < max) onCommit(value + 1);
	};
	const down = () => {
		if (value > 1) onCommit(value - 1);
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: session_council_module_css_default.stepper,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: session_council_module_css_default.step,
				onClick: down,
				disabled: value <= 1,
				"aria-label": t("designer.decrement"),
				children: "−"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: session_council_module_css_default.count,
				children: value
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: session_council_module_css_default.step,
				onClick: up,
				disabled: value >= max,
				"aria-label": t("designer.increment"),
				children: "+"
			})
		]
	});
}
/** The single model picker: searchable provider groups from the session catalog. */
function ModelPicker(props) {
	const { value, models, onPick, disabled, t } = props;
	const [open, setOpen] = (0, react.useState)(false);
	const [query, setQuery] = (0, react.useState)("");
	const directory = models;
	(0, react.useEffect)(() => {
		if (!open || directory === void 0) return;
		if (directory.store.getSnapshot().status === "loading") return;
		directory.load().catch(() => {});
	}, [open, directory]);
	const groups = (directory?.store.getSnapshot())?.groups ?? [];
	const label = value.provider === "" || value.model === "" ? t("designer.inherit") : `${value.provider} · ${value.model}`;
	const close = (0, react.useCallback)(() => {
		setOpen(false);
		setQuery("");
	}, []);
	const q = query.trim().toLowerCase();
	const shown = q === "" ? groups.map((group) => ({
		group,
		models: group.models
	})) : groups.map((group) => ({
		group,
		models: group.models.filter((model) => model.id.toLowerCase().includes(q) || model.name.toLowerCase().includes(q) || group.name.toLowerCase().includes(q))
	})).filter((entry) => entry.models.length > 0);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: session_council_module_css_default.pickerWrap,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: session_council_module_css_default.pickerTrigger,
			"aria-haspopup": "menu",
			"aria-expanded": open,
			title: label,
			disabled,
			onClick: () => {
				setOpen(!open);
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: session_council_module_css_default.pickerLabel,
				children: label
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				className: session_council_module_css_default.chevronIcon,
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.6 5.4L7 8.8l3.4-3.4",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.4",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			})]
		}), !open ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: session_council_module_css_default.pickerMenu,
			role: "menu",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: session_council_module_css_default.search,
				autoFocus: true,
				placeholder: t("designer.search"),
				value: query,
				onChange: (event) => {
					setQuery(event.target.value);
				},
				onKeyDown: (event) => {
					if (event.key === "Escape") close();
				}
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: session_council_module_css_default.menuList,
				role: "listbox",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "option",
						"aria-selected": value.provider === "" && value.model === "",
						className: session_council_module_css_default.menuItem,
						onClick: () => {
							onPick({
								provider: "",
								model: ""
							});
							close();
						},
						children: t("designer.inherit")
					}),
					shown.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: session_council_module_css_default.providerGroup,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: session_council_module_css_default.providerTitle,
							children: entry.group.name
						}), entry.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "option",
							"aria-selected": value.provider === entry.group.id && value.model === model.id,
							className: session_council_module_css_default.menuItem,
							onClick: () => {
								onPick({
									provider: entry.group.id,
									model: model.id
								});
								close();
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: session_council_module_css_default.modelName,
								children: model.name
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: session_council_module_css_default.modelId,
								children: model.id
							})]
						}, model.id))]
					}, entry.group.id)),
					shown.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: session_council_module_css_default.menuEmpty,
						children: t("designer.noModels")
					}) : null
				]
			})]
		})]
	});
}
/** A styled select-like popover for preset/quorum pickers. */
function Menu(props) {
	const { value, options, onSelect, disabled } = props;
	const [open, setOpen] = (0, react.useState)(false);
	const current = options.find((option) => option.value === value)?.label ?? value;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: session_council_module_css_default.pickerWrap,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: session_council_module_css_default.pickerTrigger,
			"aria-haspopup": "menu",
			"aria-expanded": open,
			disabled,
			onClick: () => {
				setOpen(!open);
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: session_council_module_css_default.pickerLabel,
				children: current
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				className: session_council_module_css_default.chevronIcon,
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.6 5.4L7 8.8l3.4-3.4",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.4",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			})]
		}), !open ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: session_council_module_css_default.pickerMenu,
			role: "menu",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: session_council_module_css_default.menuList,
				role: "listbox",
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "option",
					"aria-selected": option.value === value,
					className: session_council_module_css_default.menuItem,
					onClick: () => {
						onSelect(option.value);
						setOpen(false);
					},
					children: option.label
				}, option.value))
			})
		})]
	});
}
/** Inline editor for an authored role: label + lens prompt. */
function AuthoredRoleForm(props) {
	const { initialLabel, initialPrompt, onPatch, t } = props;
	const [label, setLabel] = (0, react.useState)(initialLabel);
	const [prompt, setPrompt] = (0, react.useState)(initialPrompt);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: session_council_module_css_default.authForm,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
			className: session_council_module_css_default.textInput,
			value: label,
			placeholder: t("designer.roleLabel"),
			onChange: (event) => {
				setLabel(event.target.value);
				onPatch({ label: event.target.value });
			}
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
			className: session_council_module_css_default.promptInput,
			rows: 6,
			value: prompt,
			placeholder: t("designer.promptSeed", { role: label }),
			onChange: (event) => {
				setPrompt(event.target.value);
				onPatch({ prompt: event.target.value });
			}
		})]
	});
}
/**
* Register the council designer in the composer dock.
* @param ctx - the browser plugin context.
* @param scope - the bound `council` settings scope the designer reads and writes.
*/
function registerCouncilDesigner(ctx, scope) {
	const rawCtx = ctx;
	const resolver = typeof rawCtx.get === "function" ? rawCtx.get("modelDirectories") : void 0;
	ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
		name: "conversation.input.dock",
		id: COUNCIL_DESIGNER_SLOT_ID,
		order: 0,
		locale: NS,
		inject: () => ({
			scope,
			...resolver === void 0 ? {} : { modelDirectories: resolver }
		})
	}, CouncilDesigner));
}
//#endregion
//#region src/client/index.ts
/**
* Required services: slot registry, locale, the settings-scope binder, session
* token reads for the graph tab, and `workspaces` for opening a finding's file.
*/
const inject = [
	"slots",
	"locale",
	"connection",
	"settingsScope",
	"sessions",
	"workspaces"
];
/**
* Contribute the composer-dock council designer and the council graph view.
* @param ctx - the browser plugin context.
*/
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "ui-council: dictionaries");
	const scope = ctx.settingsScope.bind({ namespace: "council" });
	registerCouncilDesigner(ctx, scope);
	registerCouncilView(ctx, scope);
}
//#endregion
exports.apply = apply;
exports.inject = inject;

		return module.exports;
	}
});