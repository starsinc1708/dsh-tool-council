window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-tool-council",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react_jsx_runtime = require("react/jsx-runtime");
let react = require("react");
//#region \0dsh-css:C:\git\map-reduce\src\client\CouncilCard.module.css.mjs
const css$1 = ".dshc_067793 { display: flex; flex-direction: column; gap: 12px; }\n.dshc_2e09d6 h3 { margin: 0; font-size: 14px; font-weight: 600; }\n.dshc_437632 { margin: 2px 0 0; font-size: 12px; opacity: 0.7; }\n.dshc_ef8715 { padding: 12px; font-size: 12px; opacity: 0.7; }\n\n.dshc_fa04c0 { display: flex; align-items: center; gap: 8px; font-size: 12px; }\n.dshc_fa04c0 select { flex: 0 0 auto; }\n\n.dshc_a8a0c1 { display: flex; flex-wrap: wrap; gap: 4px; }\n.dshc_ac31e3, .dshc_4327b6 {\n  padding: 3px 10px; border-radius: 999px; font-size: 12px; cursor: pointer;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%)); background: transparent; color: inherit;\n}\n.dshc_4327b6 { border-color: transparent; background: var(--dsh-accent-soft, rgb(0 0 0 / 8%)); font-weight: 600; }\n\n.dshc_018bf8 { display: flex; flex-direction: column; gap: 8px; }\n.dshc_67ee29 {\n  margin: 0; padding: 8px 10px 10px; border-radius: 8px;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n}\n.dshc_67ee29 legend { padding: 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }\n\n.dshc_561825 { display: flex; align-items: center; gap: 10px; padding: 3px 0; font-size: 12px; }\n.dshc_561825 label { display: flex; align-items: center; gap: 4px; }\n.dshc_561825 label span { opacity: 0.6; }\n.dshc_561825 input[type=\"number\"] { width: 52px; }\n.dshc_561825 input[type=\"text\"] { width: 150px; }\n.dshc_154cad { flex: 1 1 auto; display: flex; align-items: center; gap: 6px; }\n.dshc_e945ff { font-size: 10px; font-style: normal; opacity: 0.6; }\n\n.dshc_731929 { margin: 0; font-size: 12px; color: var(--dsh-danger, #c0392b); }\n\n.dshc_5b065e { display: flex; align-items: center; gap: 8px; }\n.dshc_d61b9f { flex: 1 1 auto; }\n";
const tagId$1 = "@deepseek-ai/dsh-tool-council/CouncilCard.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "@deepseek-ai/dsh-tool-council";
	tag.dataset.pluginCss = tagId$1;
	tag.textContent = css$1;
	document.head.appendChild(tag);
}
var CouncilCard_module_css_default = {
	"card": "dshc_067793",
	"head": "dshc_2e09d6",
	"hint": "dshc_437632",
	"empty": "dshc_ef8715",
	"row": "dshc_fa04c0",
	"tabs": "dshc_a8a0c1",
	"tab": "dshc_ac31e3",
	"tabSelected": "dshc_4327b6",
	"layers": "dshc_018bf8",
	"layer": "dshc_67ee29",
	"role": "dshc_561825",
	"roleName": "dshc_154cad",
	"badge": "dshc_e945ff",
	"error": "dshc_731929",
	"foot": "dshc_5b065e",
	"spacer": "dshc_d61b9f"
};
//#endregion
//#region src/client/CouncilCard.tsx
const QUORUM_RULES = [
	"majority",
	"unanimous",
	"threshold"
];
/**
* Render the card.
* @param props - the runtime kit, the locale binder, and the injected face.
* @returns the settings card element.
*/
function CouncilCard(props) {
	const { t } = props;
	const state = props.useCouncilCard((snapshot) => snapshot);
	if (state.status !== "ready") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: CouncilCard_module_css_default.empty,
		children: t(`status.${state.status}`)
	});
	const preset = state.presets.find((candidate) => candidate.id === state.selected);
	const override = state.overrides[state.selected];
	const disabled = !state.writable;
	const width = (layerId) => {
		return (preset?.layers.find((candidate) => candidate.id === layerId))?.roles.reduce((sum, role) => sum + (override?.roles?.[`${layerId}.${role.id}`]?.count ?? role.count), 0) ?? 0;
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: CouncilCard_module_css_default.card,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: CouncilCard_module_css_default.head,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: CouncilCard_module_css_default.hint,
					children: t("description")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: CouncilCard_module_css_default.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("defaultPreset") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
					value: state.defaultPreset,
					disabled,
					onChange: (event) => {
						props.setDefaultPreset(event.target.value);
					},
					children: state.presets.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: candidate.id,
						children: candidate.label
					}, candidate.id))
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
				className: CouncilCard_module_css_default.tabs,
				children: state.presets.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": candidate.id === state.selected,
					className: candidate.id === state.selected ? CouncilCard_module_css_default.tabSelected : CouncilCard_module_css_default.tab,
					onClick: () => {
						props.selectPreset(candidate.id);
					},
					children: candidate.label
				}, candidate.id))
			}),
			preset === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CouncilCard_module_css_default.layers,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: CouncilCard_module_css_default.hint,
					children: preset.description
				}), preset.layers.map((layer) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
					className: CouncilCard_module_css_default.layer,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", { children: [
							layer.id,
							" · ",
							t(`kind.${layer.kind}`),
							" · ",
							t("width", { n: width(layer.id) })
						] }),
						layer.roles.map((role) => {
							const key = `${layer.id}.${role.id}`;
							const roleOverride = override?.roles?.[key];
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CouncilCard_module_css_default.role,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: CouncilCard_module_css_default.roleName,
										children: [role.label, roleOverride === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", {
											className: CouncilCard_module_css_default.badge,
											children: t("overridden")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("count") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "number",
										min: 1,
										max: 16,
										disabled: disabled || layer.kind === "reduce",
										value: roleOverride?.count ?? role.count,
										onChange: (event) => {
											const next = Number(event.target.value);
											if (Number.isSafeInteger(next) && next >= 1) props.setRoleCount(layer.id, role.id, next);
										}
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("model") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										placeholder: t("modelInherit"),
										disabled,
										value: roleOverride?.model ?? role.model,
										onChange: (event) => {
											props.setRoleModel(layer.id, role.id, event.target.value);
										}
									})] })
								]
							}, role.id);
						}),
						layer.quorumRule === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CouncilCard_module_css_default.role,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: CouncilCard_module_css_default.roleName,
									children: t("quorum")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									disabled,
									value: override?.quorums?.[layer.id]?.rule ?? layer.quorumRule,
									onChange: (event) => {
										props.setQuorum(layer.id, event.target.value);
									},
									children: QUORUM_RULES.map((rule) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: rule,
										children: t(`quorumRule.${rule}`)
									}, rule))
								}),
								(override?.quorums?.[layer.id]?.rule ?? layer.quorumRule) !== "threshold" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("threshold") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "number",
									min: 1,
									max: width(layer.id),
									disabled,
									value: override?.quorums?.[layer.id]?.threshold ?? layer.quorumThreshold ?? width(layer.id),
									onChange: (event) => {
										props.setQuorum(layer.id, "threshold", Number(event.target.value));
									}
								})] })
							]
						})
					]
				}, layer.id))]
			}),
			state.error === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: CouncilCard_module_css_default.error,
				role: "alert",
				children: state.error
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
				className: CouncilCard_module_css_default.foot,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled,
						onClick: () => {
							props.resetPreset();
						},
						children: t("resetPreset")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: CouncilCard_module_css_default.spacer }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: !state.dirty,
						onClick: () => {
							props.discard();
						},
						children: t("discard")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: !state.dirty || disabled,
						onClick: () => {
							props.save();
						},
						children: t("save")
					})
				]
			})
		]
	});
}
//#endregion
//#region src/client/controller.ts
const EMPTY = {
	status: "loading",
	writable: false,
	presets: [],
	selected: "",
	defaultPreset: "",
	overrides: {},
	dirty: false,
	error: ""
};
/**
* Bridge the `council` settings namespace onto the card.
*
* Edits stage locally and land in one `set('overrides', …)` write, because the
* overrides map is a single scalar field from the settings document's point of
* view: writing it per-role would let a rejected write leave the map half
* applied.
*/
var CouncilCardController = class {
	scope;
	listeners = /* @__PURE__ */ new Set();
	snapshot = EMPTY;
	staged;
	stagedDefault;
	selected = "";
	error = "";
	constructor(scope) {
		this.scope = scope;
		scope.subscribe(() => {
			this.publish();
		});
		this.publish();
	}
	/** @returns the observable the renderer binds as `useCouncilCard`. */
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
				this.selected = presetId;
				this.publish();
			},
			setDefaultPreset: (presetId) => {
				this.stagedDefault = presetId;
				this.error = "";
				this.publish();
			},
			setRoleCount: (layerId, roleId, count) => {
				this.editRole(layerId, roleId, { count });
			},
			setRoleModel: (layerId, roleId, model) => {
				this.editRole(layerId, roleId, { model });
			},
			setQuorum: (layerId, rule, threshold) => {
				const preset = this.currentPresetId();
				const next = this.draft();
				const entry = next[preset] ?? {};
				next[preset] = {
					...entry,
					quorums: {
						...entry.quorums,
						[layerId]: {
							rule,
							...threshold === void 0 ? {} : { threshold }
						}
					}
				};
				this.staged = next;
				this.error = "";
				this.publish();
			},
			discard: () => {
				this.staged = void 0;
				this.stagedDefault = void 0;
				this.error = "";
				this.publish();
			},
			save: () => {
				this.save();
			},
			/** Drop every override for the shown preset and re-inherit the composition. */
			resetPreset: () => {
				const next = this.draft();
				delete next[this.currentPresetId()];
				this.staged = next;
				this.error = "";
				this.publish();
			}
		};
	}
	editRole(layerId, roleId, patch) {
		const preset = this.currentPresetId();
		const next = this.draft();
		const entry = next[preset] ?? {};
		const key = `${layerId}.${roleId}`;
		next[preset] = {
			...entry,
			roles: {
				...entry.roles,
				[key]: {
					...entry.roles?.[key],
					...patch
				}
			}
		};
		this.staged = next;
		this.error = "";
		this.publish();
	}
	draft() {
		return structuredClone(this.staged ?? this.scope.getSnapshot().value?.overrides ?? {});
	}
	currentPresetId() {
		return this.snapshot.selected;
	}
	async save() {
		try {
			if (this.stagedDefault !== void 0) await this.scope.set("defaultPreset", this.stagedDefault);
			if (this.staged !== void 0) await this.scope.set("overrides", this.staged);
			this.staged = void 0;
			this.stagedDefault = void 0;
			this.error = "";
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
		}
		this.publish();
	}
	publish() {
		const snapshot = this.scope.getSnapshot();
		const presets = snapshot.value?.topology ?? [];
		const first = presets[0]?.id ?? "";
		const selected = presets.some((preset) => preset.id === this.selected) ? this.selected : first;
		this.selected = selected;
		this.snapshot = {
			status: snapshot.status,
			writable: snapshot.writable,
			presets,
			selected,
			defaultPreset: this.stagedDefault ?? snapshot.value?.defaultPreset ?? first,
			overrides: this.staged ?? snapshot.value?.overrides ?? {},
			dirty: this.staged !== void 0 || this.stagedDefault !== void 0,
			error: this.error
		};
		for (const listener of this.listeners) listener();
	}
};
//#endregion
//#region src/client/council-log-definition.ts
/** Fold `tool-council/run-start` + `tool-council/log` into one node per run. */
const councilLogDefinition = {
	kind: "council-log",
	target: "chat",
	match(event) {
		if (event.type === "tool-council/run-start") return {
			id: String(event.data.runId),
			role: "start"
		};
		if (event.type === "tool-council/log") return {
			id: String(event.data.runId),
			role: "update"
		};
		return null;
	},
	start(context, match) {
		const { name } = match.event.data;
		return {
			name,
			messages: []
		};
	},
	update(context, match) {
		const { message } = match.event.data;
		return {
			name: context.state.name,
			messages: [...context.state.messages, message]
		};
	},
	buildViewNode(context) {
		if (context.start === void 0 || context.state === void 0) return null;
		return {
			key: context.key,
			kind: "council-log",
			id: context.id,
			target: "chat",
			anchorSeq: context.start.event.seq,
			location: context.start.location,
			visibility: "visible",
			data: {
				name: context.state.name,
				messages: context.state.messages
			}
		};
	}
};
//#endregion
//#region src/client/locales.ts
/**
* Council settings-card dictionaries.
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
	"quorum": "quorum",
	"threshold": "needs",
	"overridden": "overridden",
	"resetPreset": "Reset this preset",
	"discard": "Discard",
	"save": "Save",
	"kind.map": "examine",
	"kind.verify": "verify",
	"kind.reduce": "synthesize",
	"quorumRule.majority": "simple majority",
	"quorumRule.unanimous": "unanimous",
	"quorumRule.threshold": "at least N confirmations",
	"status.loading": "Loading council settings…",
	"status.unavailable": "This deployment does not expose council settings.",
	"view.council": "Council",
	"onlyMapReduce": "The council graph is available in Map-Reduce mode.",
	"noRuns": "No council run yet. Send a task to start one.",
	"tokens": "{n} tokens",
	"status.running": "running",
	"status.completed": "done",
	"status.failed": "failed",
	"status.cancelled": "cancelled",
	"status.interrupted": "interrupted"
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
	"quorum": "法定人数",
	"threshold": "需要",
	"overridden": "已覆盖",
	"resetPreset": "重置此预设",
	"discard": "放弃",
	"save": "保存",
	"kind.map": "审查",
	"kind.verify": "复核",
	"kind.reduce": "综合",
	"quorumRule.majority": "简单多数",
	"quorumRule.unanimous": "一致同意",
	"quorumRule.threshold": "至少 N 票确认",
	"status.loading": "正在加载议事会设置…",
	"status.unavailable": "此部署未开放议事会设置。",
	"view.council": "议事会",
	"onlyMapReduce": "议事会图仅在 Map-Reduce 模式下可用。",
	"noRuns": "尚无议事会运行。发送任务即可开始。",
	"tokens": "{n} tokens",
	"status.running": "运行中",
	"status.completed": "完成",
	"status.failed": "失败",
	"status.cancelled": "已取消",
	"status.interrupted": "已中断"
};
//#endregion
//#region \0dsh-css:C:\git\map-reduce\src\client\council-view.module.css.mjs
const css = ".dshc_646a84 { display: flex; flex-direction: column; gap: 16px; padding: 16px; overflow: auto; }\n.dshc_870338 { padding: 24px 16px; font-size: 12px; opacity: 0.6; }\n\n.dshc_e52d3d { display: flex; flex-direction: column; gap: 10px; }\n.dshc_0a185b { display: flex; align-items: center; gap: 10px; }\n.dshc_a785b3 { font-size: 13px; font-weight: 600; }\n.dshc_eab06a { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; }\n.dshc_f79ef7 { margin: 0; font-size: 12px; opacity: 0.75; font-variant-numeric: tabular-nums; }\n\n.dshc_f11d32 { display: flex; gap: 10px; align-items: stretch; overflow-x: auto; }\n.dshc_622ba5 {\n  flex: 1 1 0; min-width: 180px; margin: 0; padding: 8px 10px 10px; border-radius: 8px;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n}\n.dshc_622ba5 legend { padding: 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }\n\n.dshc_20471c { display: flex; flex-direction: column; gap: 3px; padding: 6px 0; border-top: 1px solid var(--dsh-border, rgb(0 0 0 / 8%)); }\n.dshc_20471c:first-child { border-top: none; }\n.dshc_7fc35c { display: flex; align-items: center; gap: 6px; font-size: 12px; }\n.dshc_2e4b0b { font-weight: 500; }\n.dshc_a3d2c5 { font-size: 11px; opacity: 0.6; margin-left: auto; }\n.dshc_0e1c56 { font-size: 11px; opacity: 0.5; font-variant-numeric: tabular-nums; }\n.dshc_c73fc3 { margin: 0; font-size: 11px; opacity: 0.55; line-height: 1.4; }\n\n.dshc_b30f6f { width: 8px; height: 8px; border-radius: 50%; flex: none; background: rgb(0 0 0 / 15%); }\n.dshc_b30f6f[data-status='completed'] { background: #2e7d32; }\n.dshc_b30f6f[data-status='running'] { background: #1565c0; animation: pulse 1.2s ease-in-out infinite; }\n.dshc_b30f6f[data-status='failed'] { background: #c62828; }\n.dshc_b30f6f[data-status='cancelled'], .dshc_b30f6f[data-status='interrupted'] { background: #ef6c00; }\n\n@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }\n";
const tagId = "@deepseek-ai/dsh-tool-council/council-view.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "@deepseek-ai/dsh-tool-council";
	tag.dataset.pluginCss = tagId;
	tag.textContent = css;
	document.head.appendChild(tag);
}
var council_view_module_css_default = {
	"wrap": "dshc_646a84",
	"empty": "dshc_870338",
	"run": "dshc_e52d3d",
	"runHead": "dshc_0a185b",
	"runName": "dshc_a785b3",
	"runStatus": "dshc_eab06a",
	"runLog": "dshc_f79ef7",
	"layers": "dshc_f11d32",
	"layer": "dshc_622ba5",
	"member": "dshc_20471c",
	"memberRow": "dshc_7fc35c",
	"memberLabel": "dshc_2e4b0b",
	"memberStatus": "dshc_a3d2c5",
	"memberTokens": "dshc_0e1c56",
	"memberHint": "dshc_c73fc3",
	"dot": "dshc_b30f6f"
};
//#endregion
//#region src/client/council-view.tsx
/**
* Council conversation view: a graph of the council's map → verify → reduce
* agents, rendered as a tab beside Chat and Trajectory. It reads the durable
* `workflow-run` conversation nodes (emitted by the workflow engine), shows
* each member's role, live state, spent tokens, and a role explanation, and is
* gated to the Map-Reduce preset.
*
* @module @deepseek-ai/dsh-client-ui-council
*/
/** The published preset id this view is for. */
const COUNCIL_PRESET = "map-reduce";
/** Short explanation per shipped role label, shown under each member. */
const ROLE_GLOSSARY = {
	"Correctness": "Reads logic and data flow: inverted conditions, off-by-one, null/empty cases, read-before-write.",
	"API contract": "Reads module seams: mismatched arguments, renamed parameters, drifted duplicates, broken invariants.",
	"Performance & scale": "Reads production-size behaviour: quadratic work, hot-loop allocations, unbounded collections.",
	"Tests": "Reads the test suite: tests that will break, assert old behaviour, or have no coverage.",
	"Prior art": "Finds what already exists and what each option actually does, with references.",
	"Constraints": "Establishes the hard limits the architecture, data, and platform impose.",
	"Trade-offs": "Lays out what each direction costs and buys; refuses to pick a winner.",
	"Risks & unknowns": "Names what could go wrong and what nobody has measured yet.",
	"Minimal": "Designs the smallest change that genuinely solves the problem.",
	"Idiomatic": "Designs the version that fits the codebase conventions, even if larger.",
	"Ambitious": "Designs the version still right in two years, with its honest cost.",
	"Plan": "Produces ordered, independently reviewable mechanical steps.",
	"Coupling": "Maps everything that actually depends on the code being moved.",
	"Replicator": "Re-derives each claim from the source, as if the finding had never been written.",
	"Devil's advocate": "Builds the strongest case that each claim is NOT a defect, then votes honestly.",
	"Impact": "Assumes each claim is true and traces who reaches it and what a user sees.",
	"Feasibility": "Checks each proposal against the real APIs and extension points.",
	"Maintenance": "Judges each proposal by what it does to whoever maintains it.",
	"Behaviour": "Decides whether each refactor step is genuinely behaviour-preserving.",
	"Coverage": "Decides whether an existing test would catch a mistake in each step.",
	"Rollback": "Decides whether each step can be reverted alone once merged.",
	"Synthesizer": "Writes the final report from the verdict table; never re-litigates votes."
};
/** Build the live token-usage hook bound to one child session's projection. */
function makeUseMemberUsage(sessions) {
	return function useMemberUsage(childId) {
		return (0, react.useSyncExternalStore)((onChange) => sessions.binding(childId)?.session?.projections.faceOf("tokenUsage")?.subscribe(onChange) ?? (() => {}), () => sessions.binding(childId)?.session?.projections.faceOf("tokenUsage")?.getSnapshot());
	};
}
/** Register the Council conversation-view tab. */
function registerCouncilView(ctx) {
	const t = ctx.locale.bind(NS);
	const useMemberUsage = makeUseMemberUsage(ctx.sessions);
	ctx.slots.inject("conversation.view", () => ctx.slots.register({
		name: "conversation.view",
		id: "council",
		order: 20,
		locale: NS,
		label: () => t("view.council"),
		inject: () => ({ useMemberUsage })
	}, CouncilView));
}
/** Render the Council graph tab. */
function CouncilView(props) {
	const { useSession, useSessions, sessionId, t, useMemberUsage } = props;
	const preset = useSessions((state) => state.byId[sessionId]?.agentPreset);
	const chat = useSession((state) => state.chat);
	if (preset !== COUNCIL_PRESET) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: council_view_module_css_default.empty,
		children: t("onlyMapReduce")
	});
	const logs = /* @__PURE__ */ new Map();
	const runs = [];
	for (const node of chat.nodes.values()) if (node.kind === "workflow-run") runs.push({
		key: node.key,
		id: node.id,
		data: node.data,
		latestLog: null
	});
	else if (node.kind === "council-log") {
		const data = node.data;
		logs.set(node.id, data.messages[data.messages.length - 1] ?? "");
	}
	for (const run of runs) run.latestLog = logs.get(run.id) ?? null;
	if (runs.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: council_view_module_css_default.empty,
		children: t("noRuns")
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: council_view_module_css_default.wrap,
		children: runs.map((run) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: council_view_module_css_default.run,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: council_view_module_css_default.runHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: council_view_module_css_default.runName,
						children: run.data.name
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: council_view_module_css_default.runStatus,
						children: t(`status.${run.data.status}`)
					})]
				}),
				run.latestLog === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: council_view_module_css_default.runLog,
					children: run.latestLog
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: council_view_module_css_default.layers,
					children: run.data.phases.map((phase) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
						className: council_view_module_css_default.layer,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: phase.phase ?? "—" }), phase.members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Member, {
							label: member.label,
							status: member.status,
							childId: member.childId,
							useMemberUsage,
							t
						}, member.seq))]
					}, phase.key))
				})
			]
		}, run.key))
	});
}
function Member({ label, status, childId, useMemberUsage, t }) {
	const usage = useMemberUsage(childId);
	const explanation = ROLE_GLOSSARY[label];
	const total = usage === void 0 ? void 0 : usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
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
//#endregion
//#region src/client/index.ts
/** Required services: card slot, graph view slot, log node, session token reads, locale. */
const inject = [
	"slots",
	"locale",
	"connection",
	"settingsScope",
	"sessions",
	"conversationEvents"
];
/**
* Contribute the council settings card and the council graph conversation view.
* @param ctx - the browser plugin context.
*/
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "ui-council: dictionaries");
	ctx.effect(() => ctx.conversationEvents.register(councilLogDefinition), "ui-council: council-log definition");
	const controller = new CouncilCardController(ctx.settingsScope.bind({ namespace: "council" }));
	const face = () => ({
		hooks: { councilCard: controller.store() },
		...controller.actions()
	});
	ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
		name: "settings.plugin.item",
		key: "council",
		locale: NS,
		inject: face
	}, CouncilCard));
	registerCouncilView(ctx);
}
//#endregion
exports.apply = apply;
exports.inject = inject;

		return module.exports;
	}
});