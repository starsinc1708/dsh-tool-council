# @deepseek-ai/dsh-tool-council

A map-reduce council of subagents for the DeepSeek Harness: one task fans out to several fresh children through different lenses, verifiers re-check each finding from the source, and a quorum turns their votes into a verdict table.

The plugin is a Consumer over the workflow and subagent seams. Its script is deployment-owned and build-time constant: the model supplies the task text and, optionally, a preset name — it cannot change the topology, the schemas, the quorum, or the validation. Concurrency limiting, cancellation, worker termination, and the `workflow-run` conversation node come from `ctx.workflowEngine`.

## Install

This package is a **bundle**: its `cordis.patch.yml` mounts one always-composed host row, and its `dsh.client` field carries the browser settings card. Add it to a profile:

```jsonc
// profiles/<name>/package.json
{
  "dependencies": { "@deepseek-ai/dsh-tool-council": "^0.1.1-rc.2" },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@deepseek-ai/dsh-tool-council"
      ]
    }
  }
}
```

On load the host row derives a **Map-Reduce mode** agent preset from the `standard` roster entry, so the mode menu lists it beside Standard/Minimal/… without a restart. Selecting it composes the council tool (`dsh-tool-council/tool`) onto the standard agent plane.

## Config

```yaml
# profiles/<name>/cordis.patch.yml (or the bundle's own cordis.patch.yml)
- insert:
    - id: tool-council-host
      name: '@deepseek-ai/dsh-tool-council'
      config:
        installPreset: true
        presetId: map-reduce
        presetName: 'Map-Reduce mode'
        councilPolicy:
          subagentProvider: spawn
          toolName: council
          maxAgentsPerLayer: 12
          maxLayers: 6
          maxFindings: 200
          maxFindingChars: 2000
          maxReportChars: 32768
          defaultPreset: bug-hunt
          # presets: []   # replaces the four shipped topologies wholesale
```

`councilPolicy` is the tool's own configuration, owned by the always-composed host row so the settings card can mirror the deployment's real topology and the published preset can mount the tool with the same policy. Omit it for the four shipped topologies (`bug-hunt`, `research`, `feature-design`, `refactor`) and the default ceilings. There is no per-preset merge — declaring `presets` replaces them wholesale, because a partially overridden role prompt is a topology nobody reviewed.

Structural rules the schema cannot express are enforced at load and fail the deployment rather than the call: every preset ends in a reduce layer with exactly one role instance, a quorum appears on a verify layer and nowhere else, a `threshold` quorum is at most its layer's width, and preset, layer, and role ids are unique in their scope.

`subagentProvider` must be registered, must advertise `outputSchema`, and must not inherit parent context. A member seeded with the parent's transcript would inherit the parent's framing of the problem, which is what the layer exists to break.

## Layers

A layer is `map`, `verify`, or `reduce`. Its width is the sum of its roles' `count`, and each instance runs as one `agent()` call under the engine's concurrency limit.

A role differs from its neighbours by its `prompt` and its optional `model`/`provider`, and by nothing else: the workflow `agent()` hook accepts neither a persona nor a tool filter. Members do reach the workspace — a `spawn` child joins the parent's preset — which is what makes a verifier's vote worth counting: it re-reads the cited location rather than reasoning from the finding text.

## Findings and quorum

Map children return findings through a structured output schema, so nothing parses prose. Findings cluster on `normalizeLocation(location) + '|' + fingerprint(title)`; the first-seen member survives and later members contribute a reporter and a title variant.

Each verifier receives the whole deduplicated list, votes `confirmed`, `rejected`, `not-a-bug`, or `uncertain` per finding, and never sees another verifier's ballot. `uncertain` never confirms — it only denies unanimity. When a rule does not confirm, the modal negative vote decides between `not-a-bug` (the fact holds but the behaviour is correct) and `rejected` (the claim is wrong); the distinction changes the follow-up action, so it survives the tally. Below two ballots the outcome is `insufficient` rather than a quorum of one.

`./tally.ts` is the host's authoritative copy of that arithmetic. The script runs its own copy because the verify layer needs deduplicated findings during the run and cannot import this package; the host recomputes from the raw ballots and refuses a run whose script tally disagrees.

## Settings

The host row serves the `council` settings namespace. The section carries `defaultPreset`, a sparse `overrides` map keyed by preset, and a read-only `topology` mirror the host writes as the section's `base` layer — that mirror is what lets the browser card draw the deployment's real layers without a Remote namespace. An overlay may change a role's width or model and a layer's quorum; it may not change a topology, and one that trips `maxAgentsPerLayer` is refused at the write. The tool row reads the section fresh on every call, so an edit lands on the next run without a recomposition.

## Model Experience

### Council members

Nothing directly. Each member receives the preset's framing, its own role prompt, and the verbatim task text; no member sees the parent conversation or a sibling's output. One fresh child context per role instance per layer, bounded by `maxAgentsPerLayer` and the engine's concurrency limit — a `bug-hunt` run is eight children. None of them joins the parent history.

### Parent tool result

A one-line count of members and confirmations, the Markdown verdict table, and the synthesizer's report, bounded by `maxReportChars`. Individual member transcripts and per-verifier reasons stay out of the parent context. Wording attributes conclusions to the members — "two of three verifiers confirmed" — because verifiers are agents re-reading the same repository, not an independent oracle.

## Known Limitations and Deferred Work

- **A role cannot restrict its own tools or persona** — the workflow `agent()` hook exposes neither, so per-role isolation would mean leaving the workflow engine for `ctx.subagents.start()` and re-owning the concurrency gate, cancellation, and progress UI.
- **The settings card and the tool sit on different planes** — the card is served by the bare-name host row (host plane) and the tool runs inside the published preset (agent plane). The link between them is the `council` settings namespace: the host owns it, the tool reads it at call time. A deployment that mounts the tool row by hand without the host row gets the tool but no settings section.
- **Votes measure agreement among correlated agents** — distinct lenses and per-role model routes reduce the correlation between members but do not remove it. A quorum is a count of self-reports, not certification.
- **Deduplication is lexical** — two members describing one defect in unrelated words at the same location produce two findings, and each is verified separately. The design's second-stage merge agent is not implemented.
- **Topology is an acyclic chain** — there is no `verify → fix → re-verify` cycle. Iterative execution belongs to `@deepseek-ai/dsh-tool-ralph`.
- **Nothing crosses layers except findings and votes** — member transcripts are not carried forward; the workspace is the shared memory.
- **A long-lived peer team is a different shape** — `@deepseek-ai/dsh-experimental-agent-team` owns the roster, mailbox, and shared task DAG; this plugin is a bounded fan-out that settles in one call.
