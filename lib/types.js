//#region src/settings.ts
/** The settings namespace this package serves. Also the settings-card slot key. */
const COUNCIL_NAMESPACE = "council";
/**
* Project the composition's presets into the card-facing mirror.
* @param presets - the deployment's resolved presets.
* @returns the same topology with prompts and framing dropped.
*/
function toTopology(presets) {
	return presets.map((preset) => ({
		id: preset.id,
		label: preset.label ?? preset.id,
		description: preset.description,
		layers: preset.layers.map((layer) => ({
			id: layer.id,
			kind: layer.kind,
			roles: layer.roles.map((role) => ({
				id: role.id,
				label: role.label ?? role.id,
				count: role.count ?? 1,
				model: role.model ?? "",
				provider: role.provider ?? ""
			})),
			...layer.quorum === void 0 ? {} : {
				quorumRule: layer.quorum.rule,
				...layer.quorum.threshold === void 0 ? {} : { quorumThreshold: layer.quorum.threshold }
			}
		}))
	}));
}
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
export { COUNCIL_NAMESPACE, applyOverrides, toTopology };
