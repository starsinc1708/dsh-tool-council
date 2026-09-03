//#region src/settings.ts
/** The settings namespace this package serves. */
const COUNCIL_NAMESPACE = "council";
/**
* Project the composition's presets into the browser-facing mirror.
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
//#endregion
//#region src/types.ts
/** Marks a `tool/result` meta payload as one of this plugin's run artifacts. */
const COUNCIL_ARTIFACT_KIND = "council-run";
/** Artifact schema version, so a client can refuse a shape it cannot read. */
const COUNCIL_ARTIFACT_VERSION = 1;
//#endregion
export { COUNCIL_ARTIFACT_KIND, COUNCIL_ARTIFACT_VERSION, COUNCIL_NAMESPACE, toTopology };
