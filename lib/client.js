window.__ModuleLoader__.load({
	id: "@starsinc1708/dsh-tool-council",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
//#region \0dsh-css:C:\git\map-reduce\src\client\CouncilCard.module.css.mjs
const css$1 = ".dshc_067793 { display: flex; flex-direction: column; gap: 14px; }\n\n.dshc_2e09d6 { display: flex; flex-direction: column; gap: 2px; }\n.dshc_02c1fa { display: flex; align-items: baseline; gap: 8px; }\n.dshc_2e09d6 h3 { margin: 0; font-size: 14px; font-weight: 600; }\n.dshc_393c51 {\n  font-size: 10px; font-style: normal; padding: 1px 7px; border-radius: 999px;\n  color: var(--dsh-warning, #b26500);\n  background: color-mix(in srgb, var(--dsh-warning, #b26500) 14%, transparent);\n}\n.dshc_437632 { margin: 0; font-size: 12px; opacity: 0.7; line-height: 1.5; }\n.dshc_ef8715 { padding: 12px; font-size: 12px; opacity: 0.7; }\n\n.dshc_fa04c0 { display: flex; align-items: center; gap: 8px; font-size: 12px; }\n.dshc_fa04c0 > span { opacity: 0.7; }\n.dshc_fa04c0 select { flex: 0 0 auto; }\n.dshc_5f952d { width: 90px; }\n\n.dshc_a8a0c1 { display: flex; flex-wrap: wrap; gap: 4px; }\n.dshc_ac31e3, .dshc_4327b6 {\n  padding: 3px 10px; border-radius: 999px; font-size: 12px; cursor: pointer;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%)); background: transparent; color: inherit;\n}\n.dshc_4327b6 { border-color: transparent; background: var(--dsh-accent-soft, rgb(0 0 0 / 8%)); font-weight: 600; }\n/* Loud enough to find a tab by, quiet enough not to compete with its name. */\n.dshc_7b2095 {\n  margin-left: 4px; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums;\n  color: var(--dsh-warning, #b26500);\n}\n\n.dshc_1f825f { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n.dshc_94c768 { font-size: 11px; opacity: 0.7; font-variant-numeric: tabular-nums; }\n.dshc_244d70 {\n  font-size: 10px; padding: 1px 8px; border-radius: 999px; cursor: pointer; color: inherit;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%)); background: transparent;\n}\n.dshc_244d70:hover:not(:disabled) { background: var(--dsh-accent-soft, rgb(0 0 0 / 8%)); }\n.dshc_244d70:disabled { opacity: 0.45; cursor: default; }\n\n.dshc_018bf8 { display: flex; flex-direction: column; gap: 10px; }\n.dshc_4b7516 {\n  margin: 0; align-self: flex-start; font-size: 11px; padding: 2px 8px; border-radius: 999px;\n  opacity: 0.75; font-variant-numeric: tabular-nums;\n  background: var(--dsh-accent-soft, rgb(0 0 0 / 6%));\n}\n\n.dshc_67ee29 {\n  margin: 0; padding: 4px 12px 12px; border-radius: 8px;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n  display: flex; flex-direction: column; gap: 10px;\n}\n.dshc_67ee29 legend {\n  padding: 0 6px; font-size: 10px; font-weight: 600;\n  text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.55;\n}\n\n/* Two stacked bands per role: the name, then a fixed three-column field grid.\n   The fields therefore align down the whole layer instead of each row wrapping\n   at a different point, which is what made the card look ragged. */\n.dshc_561825 { display: flex; flex-direction: column; gap: 5px; }\n.dshc_561825 + .dshc_561825 { padding-top: 10px; border-top: 1px solid var(--dsh-border, rgb(0 0 0 / 8%)); }\n.dshc_154cad { display: flex; align-items: center; gap: 6px; min-height: 18px; }\n.dshc_67d8f3 { font-size: 12px; font-weight: 500; }\n\n.dshc_e945ff {\n  font-size: 10px; font-style: normal; padding: 0 6px; border-radius: 999px;\n  opacity: 0.85; background: var(--dsh-accent-soft, rgb(0 0 0 / 8%));\n}\n.dshc_4c88b5 {\n  font-size: 10px; padding: 0 7px; border-radius: 999px; cursor: pointer; color: inherit;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%)); background: transparent;\n}\n.dshc_4c88b5:hover:not(:disabled) { background: var(--dsh-accent-soft, rgb(0 0 0 / 8%)); }\n\n.dshc_b8ac30 { display: grid; grid-template-columns: 68px minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }\n.dshc_b1ff30, .dshc_923dc0 { display: flex; flex-direction: column; gap: 2px; min-width: 0; }\n.dshc_923dc0 { grid-column: span 2; }\n.dshc_b1ff30 > span, .dshc_923dc0 > span {\n  font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.55;\n}\n.dshc_b1ff30 input, .dshc_923dc0 input, .dshc_923dc0 select {\n  width: 100%; min-width: 0; box-sizing: border-box; font-size: 12px;\n}\n\n/* One column below the settings panel's narrow breakpoint, so nothing is ever\n   squeezed to an unusable width. */\n@media (max-width: 460px) {\n  .dshc_b8ac30 { grid-template-columns: minmax(0, 1fr); }\n  .dshc_923dc0 { grid-column: auto; }\n}\n\n.dshc_d88fd5 { font-size: 12px; }\n.dshc_d88fd5 summary { cursor: pointer; opacity: 0.7; }\n.dshc_c2aeea {\n  width: 100%; margin-top: 6px; box-sizing: border-box; resize: vertical;\n  font-family: var(--dsh-font-mono, ui-monospace, monospace); font-size: 11px;\n}\n.dshc_04943f { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 6px; }\n.dshc_733a8d { font-size: 11px; opacity: 0.7; }\n\n.dshc_731929 { margin: 0; font-size: 12px; color: var(--dsh-danger, #c0392b); }\n\n.dshc_5b065e { display: flex; align-items: center; gap: 8px; }\n.dshc_d61b9f { flex: 1 1 auto; }\n";
const tagId$1 = "@starsinc1708/dsh-tool-council/CouncilCard.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "@starsinc1708/dsh-tool-council";
	tag.dataset.pluginCss = tagId$1;
	tag.textContent = css$1;
	document.head.appendChild(tag);
}
var CouncilCard_module_css_default = {
	"card": "dshc_067793",
	"head": "dshc_2e09d6",
	"headRow": "dshc_02c1fa",
	"dirty": "dshc_393c51",
	"hint": "dshc_437632",
	"empty": "dshc_ef8715",
	"row": "dshc_fa04c0",
	"costInput": "dshc_5f952d",
	"tabs": "dshc_a8a0c1",
	"tab": "dshc_ac31e3",
	"tabSelected": "dshc_4327b6",
	"tabCount": "dshc_7b2095",
	"overrideRow": "dshc_1f825f",
	"overrideSummary": "dshc_94c768",
	"resetAll": "dshc_244d70",
	"layers": "dshc_018bf8",
	"total": "dshc_4b7516",
	"layer": "dshc_67ee29",
	"role": "dshc_561825",
	"roleName": "dshc_154cad",
	"roleLabel": "dshc_67d8f3",
	"badge": "dshc_e945ff",
	"revert": "dshc_4c88b5",
	"roleFields": "dshc_b8ac30",
	"field": "dshc_b1ff30",
	"fieldWide": "dshc_923dc0",
	"transfer": "dshc_d88fd5",
	"transferBox": "dshc_c2aeea",
	"transferRow": "dshc_04943f",
	"transferNote": "dshc_733a8d",
	"error": "dshc_731929",
	"foot": "dshc_5b065e",
	"spacer": "dshc_d61b9f"
};
//#endregion
//#region src/client/CouncilCard.tsx
/**
* The council settings card: a preset picker, then that preset's layers as
* rows of roles with an editable instance count, model route, and provider
* route, plus the quorum control on a verify layer and a JSON transfer for the
* whole overlay.
*
* The card draws the deployment's real topology, which it reads from the
* section's read-only `topology` mirror — so a composition that replaced the
* shipped presets renders correctly without this plugin knowing anything about
* them. It bounds the width input against the mirrored `maxAgentsPerLayer` and
* refuses an over-wide save itself, because the Host's refusal arrives as a raw
* TypeError after the fact.
*
* @module @deepseek-ai/dsh-client-ui-council
*/
const QUORUM_RULES = [
	"majority",
	"unanimous",
	"threshold"
];
/** Element ids for the two suggestion lists the route inputs read. */
const MODEL_LIST_ID = "council-models";
const PROVIDER_LIST_ID = "council-providers";
/**
* Ask before an import throws away staged work.
* @param message - the question to put to the viewer.
* @returns true when the import may proceed.
*/
function confirmOverwrite(message) {
	return typeof window === "undefined" || typeof window.confirm !== "function" || window.confirm(message);
}
/**
* Hand the viewer a file. Mirrors the Council tab's exporter, which lives in a
* different module: a value import across client plugin files is fine, but this
* card must not depend on the conversation view.
* @param name - suggested file name.
* @param text - the JSON document.
* @returns whether the download could be started.
*/
function downloadText$1(name, text) {
	try {
		const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
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
/**
* Every distinct route already named somewhere in the deployment.
*
* There is no catalogue the settings plane can reach: the subagent registry is
* not published on the host plane at composition time, so a mirror of it would
* be empty by construction. The suggestions are therefore what this deployment
* already uses — the composition's own routes plus anything the user staged.
* Free text stays free: a `datalist` suggests, a `<select>` would silently hide
* every valid id nobody listed.
* @param state - the card's current snapshot.
* @param field - which route to collect.
* @returns the distinct values, sorted, with the empty one dropped.
*/
function routeSuggestions(state, field) {
	const seen = /* @__PURE__ */ new Set();
	for (const preset of state.presets) for (const layer of preset.layers) for (const role of layer.roles) {
		seen.add(role[field]);
		seen.add(state.overrides[preset.id]?.roles?.[`${layer.id}.${role.id}`]?.[field] ?? "");
	}
	seen.delete("");
	return [...seen].sort((a, b) => a.localeCompare(b));
}
/**
* Which of the three summary phrasings one overlay needs.
*
* `total` is never below `presets`, so a single override is always in a single
* preset — three cases cover every overlay without a plural library.
* @param counts - the controller's override counts.
* @returns the locale-key suffix.
* @internal
*/
function summaryCase(counts) {
	if (counts.total === 1) return "single";
	return counts.presets === 1 ? "onePreset" : "many";
}
/**
* Render the card.
* @param props - the runtime kit, the locale binder, and the injected face.
* @returns the settings card element.
*/
function CouncilCard(props) {
	const { t } = props;
	const state = props.useCouncilCard((snapshot) => snapshot);
	const [transfer, setTransfer] = (0, react.useState)("");
	const [transferNote, setTransferNote] = (0, react.useState)("");
	if (state.status !== "ready") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: CouncilCard_module_css_default.empty,
		children: t(`status.${state.status}`)
	});
	const preset = state.presets.find((candidate) => candidate.id === state.selected);
	const override = state.overrides[state.selected];
	const disabled = !state.writable;
	const blocked = state.widthViolations.length > 0 || state.quorumViolations.length > 0;
	const widthCeiling = state.maxAgentsPerLayer > 0 ? state.maxAgentsPerLayer : void 0;
	const width = (layerId) => {
		return (preset?.layers.find((candidate) => candidate.id === layerId))?.roles.reduce((sum, role) => sum + (override?.roles?.[`${layerId}.${role.id}`]?.count ?? role.count), 0) ?? 0;
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: CouncilCard_module_css_default.card,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: CouncilCard_module_css_default.head,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: CouncilCard_module_css_default.headRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("title") }), state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", {
						className: CouncilCard_module_css_default.dirty,
						children: t("unsaved")
					}) : null]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
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
				children: state.presets.map((candidate) => {
					const count = state.overrideCounts.byPreset[candidate.id] ?? 0;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": candidate.id === state.selected,
						className: candidate.id === state.selected ? CouncilCard_module_css_default.tabSelected : CouncilCard_module_css_default.tab,
						onClick: () => {
							props.selectPreset(candidate.id);
						},
						children: [candidate.label, count === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CouncilCard_module_css_default.tabCount,
							children: `·${count}`
						})]
					}, candidate.id);
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CouncilCard_module_css_default.overrideRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: CouncilCard_module_css_default.overrideSummary,
					children: state.overrideCounts.total === 0 ? t("noOverrides") : t(`overrideSummary.${summaryCase(state.overrideCounts)}`, {
						total: state.overrideCounts.total,
						presets: state.overrideCounts.presets
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: CouncilCard_module_css_default.resetAll,
					disabled: disabled || state.overrideCounts.total === 0,
					onClick: () => {
						props.resetAll();
					},
					children: t("resetAll")
				})]
			}),
			preset === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CouncilCard_module_css_default.layers,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: CouncilCard_module_css_default.hint,
						children: preset.description
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: CouncilCard_module_css_default.total,
						children: t("totalAgents", { n: state.totalAgents })
					}),
					preset.layers.map((layer) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
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
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CouncilCard_module_css_default.roleName,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: CouncilCard_module_css_default.roleLabel,
											children: role.label
										}), roleOverride === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", {
											className: CouncilCard_module_css_default.badge,
											children: t("overridden")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: CouncilCard_module_css_default.revert,
											disabled,
											onClick: () => {
												props.revertRole(layer.id, role.id);
											},
											children: t("revert")
										})] })]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CouncilCard_module_css_default.roleFields,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: CouncilCard_module_css_default.field,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("count") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "number",
													min: 1,
													max: widthCeiling,
													disabled: disabled || layer.kind === "reduce",
													value: roleOverride?.count ?? role.count,
													onChange: (event) => {
														const next = Number(event.target.value);
														if (Number.isSafeInteger(next) && next >= 1) props.setRoleCount(layer.id, role.id, next);
													}
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: CouncilCard_module_css_default.field,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("model") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "text",
													list: `${MODEL_LIST_ID}-${state.selected}`,
													placeholder: t("modelInherit"),
													disabled,
													value: roleOverride?.model ?? role.model,
													onChange: (event) => {
														props.setRoleModel(layer.id, role.id, event.target.value);
													}
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: CouncilCard_module_css_default.field,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("provider") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "text",
													list: PROVIDER_LIST_ID,
													placeholder: t("providerInherit"),
													disabled,
													value: roleOverride?.provider ?? role.provider,
													onChange: (event) => {
														props.setRoleProvider(layer.id, role.id, event.target.value);
													}
												})]
											})
										]
									})]
								}, role.id);
							}),
							layer.quorumRule === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CouncilCard_module_css_default.role,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: CouncilCard_module_css_default.roleName,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: CouncilCard_module_css_default.roleLabel,
										children: t("quorum")
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CouncilCard_module_css_default.roleFields,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: CouncilCard_module_css_default.fieldWide,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("quorum") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
											disabled,
											value: override?.quorums?.[layer.id]?.rule ?? layer.quorumRule,
											onChange: (event) => {
												props.setQuorum(layer.id, event.target.value);
											},
											children: QUORUM_RULES.map((rule) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: rule,
												children: t(`quorumRule.${rule}`)
											}, rule))
										})]
									}), (override?.quorums?.[layer.id]?.rule ?? layer.quorumRule) !== "threshold" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: CouncilCard_module_css_default.field,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("threshold") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "number",
											min: 1,
											max: width(layer.id),
											disabled,
											value: override?.quorums?.[layer.id]?.threshold ?? layer.quorumThreshold ?? width(layer.id),
											onChange: (event) => {
												props.setQuorum(layer.id, "threshold", Number(event.target.value));
											}
										})]
									})]
								})]
							})
						]
					}, layer.id))
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
				id: `${MODEL_LIST_ID}-${state.selected}`,
				children: routeSuggestions(state, "model").map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value }, value))
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
				id: PROVIDER_LIST_ID,
				children: routeSuggestions(state, "provider").map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value }, value))
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: CouncilCard_module_css_default.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("costRate") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "number",
					min: 0,
					step: .01,
					className: CouncilCard_module_css_default.costInput,
					disabled,
					value: state.costPerMillionTokens,
					onChange: (event) => {
						props.setCostRate(Number(event.target.value));
					}
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: CouncilCard_module_css_default.hint,
				children: t("costHint")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: CouncilCard_module_css_default.transfer,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("transfer") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: CouncilCard_module_css_default.transferBox,
						rows: 6,
						spellCheck: false,
						value: transfer,
						onChange: (event) => {
							setTransfer(event.target.value);
							setTransferNote("");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CouncilCard_module_css_default.transferRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									const text = props.exportOverrides();
									setTransfer(text);
									setTransferNote("");
									const write = navigator.clipboard?.writeText(text);
									if (write === void 0) {
										setTransferNote(t("copyFailed"));
										return;
									}
									write.then(() => {
										setTransferNote(t("copied"));
									}, () => {
										setTransferNote(t("copyFailed"));
									});
								},
								children: t("export")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									const text = props.exportOverrides();
									setTransfer(text);
									setTransferNote(downloadText$1("council-overrides.json", text) ? "" : t("copyFailed"));
								},
								children: t("download")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: disabled || transfer.trim() === "",
								onClick: () => {
									if (state.dirty && !confirmOverwrite(t("importConfirm"))) return;
									setTransferNote(props.importOverrides(transfer) ? "" : t("importInvalid"));
								},
								children: t("import")
							}),
							transferNote === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: CouncilCard_module_css_default.transferNote,
								children: transferNote
							})
						]
					})
				]
			}),
			state.widthViolations.map((violation) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: CouncilCard_module_css_default.error,
				role: "alert",
				children: t("widthExceeded", {
					preset: violation.presetId,
					layer: violation.layerId,
					width: violation.width,
					max: violation.max
				})
			}, `${violation.presetId}.${violation.layerId}`)),
			state.quorumViolations.map((violation) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: CouncilCard_module_css_default.error,
				role: "alert",
				children: t("thresholdInvalid", {
					preset: violation.presetId,
					layer: violation.layerId,
					threshold: violation.threshold,
					width: violation.width
				})
			}, `${violation.presetId}.${violation.layerId}`)),
			blocked ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: CouncilCard_module_css_default.error,
				children: t("saveBlocked")
			}) : null,
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
						disabled: disabled || (state.overrideCounts.byPreset[state.selected] ?? 0) === 0,
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
						disabled: !state.dirty || disabled || blocked,
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
/**
* Count the role and quorum overrides in an overlay.
*
* Roles and quorums are counted together because they are the same thing to the
* reader: a difference from what this deployment composed. An entry that
* survived with empty maps counts as nothing and is left out of `byPreset`, so
* `presets` never counts a preset whose badge would read `·0`.
* @param overrides - the staged (or saved) overlay.
* @returns the per-preset counts and the two totals.
*/
function countOverrides(overrides) {
	const byPreset = {};
	let total = 0;
	for (const [presetId, override] of Object.entries(overrides)) {
		const count = Object.keys(override.roles ?? {}).length + Object.keys(override.quorums ?? {}).length;
		if (count === 0) continue;
		byPreset[presetId] = count;
		total += count;
	}
	return {
		byPreset,
		total,
		presets: Object.keys(byPreset).length
	};
}
const EMPTY = {
	status: "loading",
	writable: false,
	presets: [],
	selected: "",
	defaultPreset: "",
	overrides: {},
	overrideCounts: {
		byPreset: {},
		total: 0,
		presets: 0
	},
	maxAgentsPerLayer: 0,
	costPerMillionTokens: 0,
	totalAgents: 0,
	widthViolations: [],
	quorumViolations: [],
	dirty: false,
	error: ""
};
/**
* Drop the keys an override no longer carries.
*
* An empty string means "inherit", not "override with nothing": leaving the
* key behind would keep the role marked `overridden` for ever and would send
* the Host a field it has to ignore.
* @param override - the patched role override.
* @returns the same override without empty routes, or undefined when nothing is left.
*/
function pruneRole(override) {
	const next = {};
	if (override.count !== void 0) next.count = override.count;
	if (override.model !== void 0 && override.model !== "") next.model = override.model;
	if (override.provider !== void 0 && override.provider !== "") next.provider = override.provider;
	return Object.keys(next).length === 0 ? void 0 : next;
}
/** Drop a preset entry whose role and quorum maps are both empty. */
function prunePreset(override) {
	const roles = override.roles ?? {};
	const quorums = override.quorums ?? {};
	if (Object.keys(roles).length === 0 && Object.keys(quorums).length === 0) return void 0;
	return {
		roles,
		quorums
	};
}
/**
* Recognize an overrides document pasted into the card.
* @param value - parsed JSON of unknown shape.
* @returns the document, or undefined when it is not one.
*/
function readOverridesDocument(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const out = {};
	for (const [presetId, raw] of Object.entries(value)) {
		if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
		const entry = raw;
		const roles = {};
		const quorums = {};
		if (entry.roles !== void 0) {
			if (typeof entry.roles !== "object" || entry.roles === null || Array.isArray(entry.roles)) return void 0;
			for (const [key, role] of Object.entries(entry.roles)) {
				if (typeof role !== "object" || role === null || Array.isArray(role)) return void 0;
				const { count, model, provider } = role;
				if (count !== void 0 && (!Number.isSafeInteger(count) || count < 1)) return void 0;
				if (model !== void 0 && typeof model !== "string") return void 0;
				if (provider !== void 0 && typeof provider !== "string") return void 0;
				const pruned = pruneRole({
					count,
					model,
					provider
				});
				if (pruned !== void 0) roles[key] = pruned;
			}
		}
		if (entry.quorums !== void 0) {
			if (typeof entry.quorums !== "object" || entry.quorums === null || Array.isArray(entry.quorums)) return void 0;
			for (const [key, quorum] of Object.entries(entry.quorums)) {
				if (typeof quorum !== "object" || quorum === null || Array.isArray(quorum)) return void 0;
				const { rule, threshold } = quorum;
				if (rule !== void 0 && ![
					"majority",
					"unanimous",
					"threshold"
				].includes(rule)) return void 0;
				if (threshold !== void 0 && (!Number.isSafeInteger(threshold) || threshold < 1)) return void 0;
				if (rule === void 0 && threshold === void 0) continue;
				quorums[key] = {
					...rule === void 0 ? {} : { rule },
					...threshold === void 0 ? {} : { threshold }
				};
			}
		}
		const pruned = prunePreset({
			roles,
			quorums
		});
		if (pruned !== void 0) out[presetId] = pruned;
	}
	return out;
}
/**
* Every layer of every preset whose overlaid width exceeds the ceiling.
* @param presets - the mirrored topology.
* @param overrides - the staged overlay.
* @param max - the deployment's `maxAgentsPerLayer`.
* @returns one entry per offending layer, in composition order.
*/
function widthViolations(presets, overrides, max) {
	if (max <= 0) return [];
	const out = [];
	for (const preset of presets) {
		const override = overrides[preset.id];
		for (const layer of preset.layers) {
			const width = layer.roles.reduce((sum, role) => sum + (override?.roles?.[`${layer.id}.${role.id}`]?.count ?? role.count), 0);
			if (width > max) out.push({
				presetId: preset.id,
				layerId: layer.id,
				width,
				max
			});
		}
	}
	return out;
}
/**
* Every verify layer whose overlaid threshold its own width cannot satisfy.
*
* The bounds match `resolveConfig`'s: a `threshold` quorum needs a whole number
* between 1 and the layer's width, counting the staged width overrides.
* @param presets - the mirrored topology.
* @param overrides - the staged overlay.
* @returns one entry per offending verify layer, in composition order.
*/
function quorumViolations(presets, overrides) {
	const out = [];
	for (const preset of presets) {
		const override = overrides[preset.id];
		for (const layer of preset.layers) {
			if (layer.quorumRule === void 0) continue;
			const staged = override?.quorums?.[layer.id];
			if ((staged?.rule ?? layer.quorumRule) !== "threshold") continue;
			const width = layer.roles.reduce((sum, role) => sum + (override?.roles?.[`${layer.id}.${role.id}`]?.count ?? role.count), 0);
			const threshold = staged?.threshold ?? layer.quorumThreshold;
			if (threshold === void 0) continue;
			if (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > width) out.push({
				presetId: preset.id,
				layerId: layer.id,
				threshold,
				width
			});
		}
	}
	return out;
}
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
	partialSaveMessage;
	listeners = /* @__PURE__ */ new Set();
	snapshot = EMPTY;
	staged;
	stagedDefault;
	stagedCost;
	selected = "";
	error = "";
	detachUnloadGuard;
	/**
	* Release for the settings-scope subscription.
	*
	* Held, not discarded: a controller that keeps publishing after `dispose()`
	* is not merely wasteful. `syncUnloadGuard` would see it dirty with no guard
	* attached and attach a FRESH `beforeunload` handler whose detach closure
	* nothing can ever call again — one hot reload with staged edits and the
	* browser asks "leave site?" for the rest of the session.
	*/
	detachScope;
	constructor(scope, partialSaveMessage = (error) => error) {
		this.scope = scope;
		this.partialSaveMessage = partialSaveMessage;
		this.detachScope = scope.subscribe(() => {
			this.publish();
		});
		this.publish();
	}
	/**
	* Detach from the scope and drop the unload guard. Owned by the client
	* plugin's effect, which calls it on dispose and on hot reload.
	*/
	dispose() {
		this.detachScope?.();
		this.detachScope = void 0;
		this.detachUnloadGuard?.();
		this.detachUnloadGuard = void 0;
		this.listeners.clear();
	}
	/**
	* Keep a `beforeunload` guard attached exactly while edits are staged.
	*
	* The browser shows only its own generic dialog and an in-app route change
	* never reaches this event — so the badge in the card, not this, is the
	* primary signal. This catches the one case the badge cannot: closing the tab.
	* @param dirty - whether anything is staged but unsaved.
	*/
	syncUnloadGuard(dirty) {
		if (typeof window === "undefined") return;
		if (dirty === (this.detachUnloadGuard !== void 0)) return;
		if (!dirty) {
			this.detachUnloadGuard?.();
			this.detachUnloadGuard = void 0;
			return;
		}
		const handler = (event) => {
			event.preventDefault();
		};
		window.addEventListener("beforeunload", handler);
		this.detachUnloadGuard = () => {
			window.removeEventListener("beforeunload", handler);
		};
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
			/** Stage the viewer's blended token rate; `0` turns the estimate off. */
			setCostRate: (rate) => {
				this.stagedCost = Number.isFinite(rate) && rate >= 0 ? rate : 0;
				this.error = "";
				this.publish();
			},
			setRoleCount: (layerId, roleId, count) => {
				this.editRole(layerId, roleId, { count });
			},
			setRoleModel: (layerId, roleId, model) => {
				this.editRole(layerId, roleId, { model });
			},
			setRoleProvider: (layerId, roleId, provider) => {
				this.editRole(layerId, roleId, { provider });
			},
			/** Drop every override for one role and re-inherit the composition. */
			revertRole: (layerId, roleId) => {
				const preset = this.currentPresetId();
				const next = this.draft();
				const entry = next[preset];
				if (entry?.roles === void 0) return;
				const roles = { ...entry.roles };
				delete roles[`${layerId}.${roleId}`];
				this.commit(next, preset, {
					...entry,
					roles
				});
			},
			setQuorum: (layerId, rule, threshold) => {
				const preset = this.currentPresetId();
				const next = this.draft();
				const entry = next[preset] ?? {};
				this.commit(next, preset, {
					...entry,
					quorums: {
						...entry.quorums,
						[layerId]: {
							rule,
							...threshold === void 0 ? {} : { threshold }
						}
					}
				});
			},
			discard: () => {
				this.staged = void 0;
				this.stagedDefault = void 0;
				this.stagedCost = void 0;
				this.error = "";
				this.publish();
			},
			save: () => {
				this.save();
			},
			/** Drop every override for the shown preset and re-inherit the composition. */
			resetPreset: () => {
				const next = this.draft();
				if (next[this.currentPresetId()] === void 0) return;
				delete next[this.currentPresetId()];
				this.staged = next;
				this.error = "";
				this.publish();
			},
			/**
			* Drop the WHOLE overlay, every preset at once.
			*
			* Staged like every other edit rather than written straight through: it
			* is the most destructive control on the card, so it has to be
			* discardable, and it has to mark the card dirty so the badge and the
			* unload guard both say something is pending.
			*/
			resetAll: () => {
				this.staged = {};
				this.error = "";
				this.publish();
			},
			/** @returns the current overrides map as an indented JSON document. */
			exportOverrides: () => JSON.stringify(this.snapshot.overrides, null, 2),
			/**
			* Stage a whole overrides document pasted by the user.
			* @param text - the JSON document.
			* @returns true when it parsed; false leaves the staging untouched.
			*/
			importOverrides: (text) => {
				let parsed;
				try {
					parsed = JSON.parse(text);
				} catch {
					return false;
				}
				const document = readOverridesDocument(parsed);
				if (document === void 0) return false;
				this.staged = document;
				this.error = "";
				this.publish();
				return true;
			}
		};
	}
	editRole(layerId, roleId, patch) {
		const preset = this.currentPresetId();
		const next = this.draft();
		const entry = next[preset] ?? {};
		const key = `${layerId}.${roleId}`;
		const merged = pruneRole({
			...entry.roles?.[key],
			...patch
		});
		const roles = { ...entry.roles };
		if (merged === void 0) delete roles[key];
		else roles[key] = merged;
		this.commit(next, preset, {
			...entry,
			roles
		});
	}
	/** Write one preset's entry into the draft, pruning it away when it is empty. */
	commit(draft, presetId, entry) {
		const pruned = prunePreset(entry);
		if (pruned === void 0) delete draft[presetId];
		else draft[presetId] = pruned;
		this.staged = draft;
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
		if (this.snapshot.widthViolations.length > 0 || this.snapshot.quorumViolations.length > 0) return;
		let landed = false;
		try {
			if (this.staged !== void 0) {
				await this.scope.set("overrides", this.staged);
				this.staged = void 0;
				landed = true;
			}
			if (this.stagedDefault !== void 0) {
				await this.scope.set("defaultPreset", this.stagedDefault);
				this.stagedDefault = void 0;
				landed = true;
			}
			if (this.stagedCost !== void 0) {
				await this.scope.set("costPerMillionTokens", this.stagedCost);
				this.stagedCost = void 0;
				landed = true;
			}
			this.error = "";
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const pending = this.staged !== void 0 || this.stagedDefault !== void 0 || this.stagedCost !== void 0;
			this.error = landed && pending ? this.partialSaveMessage(message) : message;
		}
		this.publish();
	}
	publish() {
		const snapshot = this.scope.getSnapshot();
		const presets = snapshot.value?.topology ?? [];
		const first = presets[0]?.id ?? "";
		const selected = presets.some((preset) => preset.id === this.selected) ? this.selected : first;
		this.selected = selected;
		const overrides = this.staged ?? snapshot.value?.overrides ?? {};
		const maxAgentsPerLayer = snapshot.value?.maxAgentsPerLayer ?? 0;
		const shown = presets.find((preset) => preset.id === selected);
		const override = overrides[selected];
		this.snapshot = {
			status: snapshot.status,
			writable: snapshot.writable,
			presets,
			selected,
			defaultPreset: this.stagedDefault ?? snapshot.value?.defaultPreset ?? first,
			overrides,
			overrideCounts: countOverrides(overrides),
			maxAgentsPerLayer,
			costPerMillionTokens: this.stagedCost ?? snapshot.value?.costPerMillionTokens ?? 0,
			totalAgents: shown === void 0 ? 0 : shown.layers.reduce((total, layer) => total + layer.roles.reduce((sum, role) => sum + (override?.roles?.[`${layer.id}.${role.id}`]?.count ?? role.count), 0), 0),
			widthViolations: widthViolations(presets, overrides, maxAgentsPerLayer),
			quorumViolations: quorumViolations(presets, overrides),
			dirty: this.staged !== void 0 || this.stagedDefault !== void 0 || this.stagedCost !== void 0,
			error: this.error
		};
		this.syncUnloadGuard(this.snapshot.dirty);
		for (const listener of this.listeners) listener();
	}
};
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
	"reportTruncated": "The report was cut to the deployment ceiling."
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
	"reportTruncated": "报告已被截断至部署上限。"
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
const css = ".dshc_646a84 { display: flex; flex-direction: column; gap: 20px; padding: 16px; overflow: auto; }\n.dshc_870338 { padding: 24px 16px; font-size: 12px; opacity: 0.6; }\n.dshc_7f2f0f { margin: 0; font-size: 12px; opacity: 0.65; }\n.dshc_f73f70 { margin: 0; font-size: 11px; opacity: 0.5; line-height: 1.5; }\n.dshc_cc7ef1 { margin: 0; font-size: 12px; color: var(--dsh-warning, #b26500); }\n.dshc_7056b0 { flex: 1 1 auto; }\n\n.dshc_e52d3d { display: flex; flex-direction: column; gap: 10px; }\n.dshc_7d84f5 { display: flex; flex-direction: column; gap: 10px; padding-top: 10px; }\n.dshc_0a185b { display: flex; align-items: center; gap: 10px; cursor: pointer; }\n.dshc_a785b3 { font-size: 13px; font-weight: 600; flex: none; }\n.dshc_0bb1de {\n  font-size: 12px; opacity: 0.65; min-width: 0; flex: 1 1 auto;\n  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.dshc_d31428, .dshc_d09552 {\n  font-size: 10px; padding: 1px 7px; border-radius: 999px; flex: none; text-transform: uppercase;\n  letter-spacing: 0.04em;\n}\n.dshc_d31428 {\n  color: var(--dsh-warning, #b26500);\n  background: color-mix(in srgb, var(--dsh-warning, #b26500) 14%, transparent);\n}\n.dshc_d09552 {\n  color: var(--dsh-danger, #c0392b);\n  background: color-mix(in srgb, var(--dsh-danger, #c0392b) 14%, transparent);\n}\n.dshc_eab06a { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; }\n.dshc_9e2609 { font-size: 11px; opacity: 0.5; font-variant-numeric: tabular-nums; flex: none; }\n/* The one number that moves on its own: kept a touch louder than the rest of\n   the header so a running council reads as running at a glance. */\n.dshc_e9dda6 {\n  font-size: 11px; opacity: 0.85; font-variant-numeric: tabular-nums; flex: none;\n  color: var(--dsh-info, #1565c0);\n}\n.dshc_7795bc { margin: 0; font-size: 12px; font-variant-numeric: tabular-nums; }\n.dshc_f79ef7 {\n  margin: 0; padding-left: 16px; font-size: 12px; opacity: 0.75;\n  font-variant-numeric: tabular-nums; display: flex; flex-direction: column; gap: 2px;\n}\n\n.dshc_f11d32 { display: flex; gap: 10px; align-items: stretch; overflow-x: auto; }\n.dshc_622ba5 {\n  flex: 1 1 0; min-width: 180px; margin: 0; padding: 8px 10px 10px; border-radius: 8px;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n}\n.dshc_622ba5 legend { padding: 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }\n.dshc_f12eaa {\n  display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; opacity: 0.5;\n  font-variant-numeric: tabular-nums; min-height: 1em;\n}\n.dshc_862cbd { color: var(--dsh-info, #1565c0); opacity: 0.9; }\n\n.dshc_20471c { display: flex; flex-direction: column; gap: 3px; padding: 6px 0; border-top: 1px solid var(--dsh-border, rgb(0 0 0 / 8%)); }\n.dshc_20471c:first-of-type { border-top: none; }\n.dshc_7fc35c { display: flex; align-items: center; gap: 6px; font-size: 12px; }\n.dshc_2e4b0b { font-weight: 500; }\n.dshc_a3d2c5 { font-size: 11px; opacity: 0.6; margin-left: auto; }\n.dshc_0e1c56 { font-size: 11px; opacity: 0.5; font-variant-numeric: tabular-nums; }\n.dshc_c73fc3 { margin: 0; font-size: 11px; opacity: 0.55; line-height: 1.4; }\n\n.dshc_b30f6f { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--dsh-muted, rgb(0 0 0 / 15%)); }\n.dshc_b30f6f[data-status='completed'] { background: var(--dsh-success, #2e7d32); }\n.dshc_b30f6f[data-status='running'] { background: var(--dsh-info, #1565c0); animation: pulse 1.2s ease-in-out infinite; }\n.dshc_b30f6f[data-status='failed'] { background: var(--dsh-danger, #c62828); }\n.dshc_b30f6f[data-status='cancelled'], .dshc_b30f6f[data-status='interrupted'] { background: var(--dsh-warning, #ef6c00); }\n\n@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }\n\n.dshc_0ee0be { display: flex; flex-direction: column; gap: 8px; }\n.dshc_546f24 { display: flex; align-items: center; gap: 8px; }\n.dshc_546f24 h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }\n.dshc_0ee0be h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }\n.dshc_546f24 button { font-size: 11px; padding: 2px 8px; }\n\n.dshc_0e11f8 {\n  align-self: flex-start; font-size: 11px; padding: 2px 8px; border-radius: 999px;\n  cursor: pointer; color: inherit; background: transparent;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%));\n}\n\n.dshc_9f7dcd { display: flex; flex-wrap: wrap; gap: 6px; }\n.dshc_3bb897, .dshc_0b9b15 {\n  font-size: 11px; padding: 2px 10px; border-radius: 999px; cursor: pointer; color: inherit;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%)); background: transparent;\n  font-variant-numeric: tabular-nums;\n}\n.dshc_3bb897:hover { background: var(--dsh-accent-soft, rgb(0 0 0 / 6%)); }\n.dshc_0b9b15 { border-color: transparent; background: var(--dsh-accent-soft, rgb(0 0 0 / 10%)); font-weight: 600; }\n\n/* One badge, four colours by attribute — an unknown level keeps the neutral\n   base rather than losing its styling, because the durable record's severity is\n   a plain string that a differently-configured build may have written. */\n.dshc_125f38 {\n  display: inline-block; font-size: 10px; padding: 1px 7px; border-radius: 999px; white-space: nowrap;\n  text-transform: uppercase; letter-spacing: 0.04em;\n  color: var(--dsh-muted-fg, inherit);\n  background: var(--dsh-accent-soft, rgb(0 0 0 / 8%));\n}\n.dshc_125f38[data-severity='blocker'] {\n  color: var(--dsh-danger, #c0392b);\n  background: color-mix(in srgb, var(--dsh-danger, #c0392b) 16%, transparent);\n  font-weight: 600;\n}\n.dshc_125f38[data-severity='high'] {\n  color: var(--dsh-warning, #b26500);\n  background: color-mix(in srgb, var(--dsh-warning, #b26500) 16%, transparent);\n}\n.dshc_125f38[data-severity='medium'] {\n  color: var(--dsh-info, #1565c0);\n  background: color-mix(in srgb, var(--dsh-info, #1565c0) 14%, transparent);\n}\n.dshc_125f38[data-severity='low'] { opacity: 0.7; }\n\n.dshc_0edfe5 { overflow-x: auto; }\n.dshc_12aa48 { border-collapse: collapse; font-size: 12px; width: 100%; }\n.dshc_12aa48 th, .dshc_12aa48 td {\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n  padding: 4px 8px; text-align: left; vertical-align: top;\n}\n.dshc_12aa48 th { font-weight: 500; opacity: 0.7; white-space: nowrap; }\n.dshc_91daf1 { caption-side: top; text-align: left; font-size: 11px; opacity: 0.55; padding-bottom: 4px; }\n.dshc_da511c { font-weight: 400; opacity: 0.6; text-align: right; }\n/* Long titles and fixes wrap instead of forcing the table wider than the tab. */\n.dshc_12aa48 td:nth-child(2), .dshc_12aa48 td:last-child { max-width: 22em; overflow-wrap: anywhere; }\n.dshc_12aa48 tr[data-outcome='confirmed'] td { background: color-mix(in srgb, var(--dsh-success, #2e7d32) 8%, transparent); }\n.dshc_12aa48 tr[data-outcome='insufficient'] td { opacity: 0.65; }\n.dshc_85c4a0 { text-align: center; white-space: nowrap; }\n\n.dshc_fa7f05 { display: inline-flex; align-items: center; gap: 4px; }\n/* The chip is a button, but must read as the path it carries — not as a control\n   competing with the export row above it. */\n.dshc_dfe0c5 {\n  font-family: var(--dsh-font-mono, ui-monospace, monospace);\n  font-size: 11px; white-space: nowrap; padding: 1px 6px; border-radius: 5px; cursor: pointer;\n  color: inherit; text-align: left;\n  border: 1px solid transparent; background: var(--dsh-accent-soft, rgb(0 0 0 / 6%));\n}\n.dshc_dfe0c5:hover { border-color: var(--dsh-border, rgb(0 0 0 / 20%)); }\n.dshc_baf91e {\n  font-size: 11px; line-height: 1; padding: 2px 5px; border-radius: 5px; cursor: pointer;\n  color: inherit; opacity: 0.55; background: transparent;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 15%));\n}\n.dshc_baf91e:hover { opacity: 1; }\n.dshc_45ddbc { font-size: 10px; opacity: 0.6; }\n\n/* The report is structure now, not a monospace wall: a prose container whose\n   children are real headings, lists, paragraphs, and code blocks. */\n.dshc_8fd10e {\n  display: flex; flex-direction: column; gap: 8px;\n  margin: 0; padding: 10px 12px; border-radius: 8px; font-size: 12px; line-height: 1.55;\n  border: 1px solid var(--dsh-border, rgb(0 0 0 / 12%));\n}\n.dshc_408740 { margin: 4px 0 0; font-size: 12px; font-weight: 600; line-height: 1.4; }\n.dshc_408740[data-level='1'] { font-size: 13px; }\n.dshc_408740[data-level='3'] { font-weight: 500; opacity: 0.85; }\n.dshc_408740:first-child { margin-top: 0; }\n/* Whitespace preserved: an aligned block the synthesizer laid out by hand stays\n   aligned, and a long line still wraps instead of widening the tab. */\n.dshc_ee7259 { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }\n.dshc_ae2f18 { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 3px; }\n.dshc_ae2f18 li { overflow-wrap: anywhere; }\n.dshc_70724d {\n  margin: 0; padding: 8px 10px; border-radius: 6px; overflow-x: auto;\n  font-family: var(--dsh-font-mono, ui-monospace, monospace); font-size: 11px; line-height: 1.45;\n  background: var(--dsh-accent-soft, rgb(0 0 0 / 6%));\n}\n.dshc_84e62e {\n  font-family: var(--dsh-font-mono, ui-monospace, monospace); font-size: 11px;\n  padding: 0 4px; border-radius: 4px; background: var(--dsh-accent-soft, rgb(0 0 0 / 8%));\n}\n";
const tagId = "@starsinc1708/dsh-tool-council/council-view.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "@starsinc1708/dsh-tool-council";
	tag.dataset.pluginCss = tagId;
	tag.textContent = css;
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
* mirror plus the saved `overrides` overlay, which is exactly the pair the tool
* itself resolves on every call — joined to the run through the preset id in
* `RunData.name`.
*
* It is a live READ, not a record of what launched: an overlay edited while a
* run is in flight would make this disagree with the run's real width. That is
* why it is rendered as "of N declared" beside the observed counts rather than
* as a denominator like `2/3`.
* @param settings - the council settings section, as the card mirrors it.
* @param runName - the workflow run's name (`council:<presetId>`).
* @returns layer id -> declared width; empty when the preset cannot be identified.
*/
function declaredWidths(settings, runName) {
	const out = /* @__PURE__ */ new Map();
	if (settings === void 0 || !runName.startsWith(RUN_NAME_PREFIX)) return out;
	const presetId = runName.slice(8);
	const preset = settings.topology?.find((candidate) => candidate.id === presetId);
	if (preset === void 0) return out;
	const override = settings.overrides?.[presetId];
	for (const layer of preset.layers) out.set(layer.id, layer.roles.reduce((sum, role) => sum + (override?.roles?.[`${layer.id}.${role.id}`]?.count ?? role.count), 0));
	return out;
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
				widths: declaredWidths(settings, run.data.name),
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
//#region src/client/index.ts
/**
* Required services: card slot, graph view slot, session token reads, locale,
* and `workspaces` for opening a finding's file from the verdict table.
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
* Contribute the council settings card and the council graph conversation view.
* @param ctx - the browser plugin context.
*/
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "ui-council: dictionaries");
	const scope = ctx.settingsScope.bind({ namespace: "council" });
	const t = ctx.locale.bind(NS);
	const controller = new CouncilCardController(scope, (error) => t("partialSave", { error }));
	ctx.effect(() => () => {
		controller.dispose();
	}, "ui-council: settings card lifetime");
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
	registerCouncilView(ctx, scope);
}
//#endregion
exports.apply = apply;
exports.inject = inject;

		return module.exports;
	}
});