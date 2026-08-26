# @deepseek-ai/dsh-tool-council

A map-reduce council of subagents for the DeepSeek Harness: one task fans out to several fresh children through different lenses, verifiers re-check each finding from the source, and a quorum turns their votes into a verdict table.

The plugin is a Consumer over the workflow and subagent seams. Its script is deployment-owned and build-time constant: the model supplies the task text and, optionally, a preset name — it cannot change the topology, the schemas, the quorum, or the validation. Concurrency limiting, cancellation, worker termination, and the `workflow-run` conversation node come from `ctx.workflowEngine`.

## Install

One command, into the profile `dsh web` boots:

```sh
dsh plugin --profile web add github:starsinc1708/dsh-tool-council
```

Then start the harness and pick the mode:

```sh
dsh web
```

**Map-Reduce mode** appears in the composer's mode menu beside Standard, PTC,
Minimal and Creator. Selecting it composes the council onto the standard agent
plane; every other mode is left exactly as it was.

No build step and no pnpm `allowBuilds` allowance is needed: this repository
commits its `lib/` output, so the install resolves to prebuilt artifacts. Pin a
commit if you would rather a later push could not change what you run:

```sh
dsh plugin --profile web add github:starsinc1708/dsh-tool-council#<sha>
```

### Requirements

- DeepSeek Harness `0.1.1-rc.2` (`dsh --version`), with `pnpm` on `PATH`.
- The `web` profile, which composes `@deepseek-ai/dsh-base` and
  `@deepseek-ai/dsh-web-app`. Everything the council needs — the workflow
  engine, the subagent registry with the `spawn` provider, the settings
  provider, and the `workflow-run` conversation node — is already in those two
  bundles. Nothing else to install.

### Verify it landed

```sh
dsh --profile web --dump-config | grep -A3 dsh-tool-council
```

A `# == @deepseek-ai/dsh-tool-council` layer with a `tool-council-host` row
means the bundle composed. After the first `dsh web` start, the published preset
is on disk:

```sh
ls "$DSH_HOME/.agent-presets/map-reduce"     # agent.cordis.yml  preset.yml
```

`$DSH_HOME` defaults to `~/.dsh`. Publication happens at plugin load, a second
or two into boot, and preset discovery is unmemoized — the mode shows up without
a restart.

### Other install sources

```sh
dsh plugin --profile web add ./dsh-tool-council      # a local checkout
dsh plugin --profile web add ./dsh-tool-council-0.1.1-rc.2.tgz   # pnpm pack output
```

Both skip the git fetch and need no build allowance either. Use a local checkout
while developing: `pnpm build` then restart `dsh web`.

### Update and remove

```sh
dsh plugin --profile web update @deepseek-ai/dsh-tool-council
dsh plugin --profile web remove @deepseek-ai/dsh-tool-council
```

`remove` drops the dependency and the bundle layer, so the tool and the settings
card disappear on the next start. It does **not** delete the published preset —
`$DSH_HOME/.agent-presets/map-reduce` is yours once written, and the roster would
list it as broken with the plugin gone. Delete that directory too:

```sh
rm -rf "$DSH_HOME/.agent-presets/map-reduce"
```

### What installing this does to your machine

Two things worth stating plainly, because both are outside the agent sandbox:

1. **It writes one directory into `$DSH_HOME/.agent-presets`.** A preset is a
   composition, so the harness treats authoring one as carrying the same trust as
   shell access. The directory is regenerated whenever the source `standard`
   preset or this plugin's rows change, and hand edits to it are lost — copy it
   under a new id to diverge, and set `installPreset: false` to stop the plugin
   writing at all.
2. **A run starts fresh subagents that can read and run commands in your
   workspace.** That is the point — a verifier re-reads the file it is voting on
   — but it means a council run costs real tokens and real tool calls: a
   `bug-hunt` is eight children.

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

## Development

```sh
pnpm install
pnpm build        # tsc -> lib/types, tsdown -> lib/*.js (host halves + client bundle)
pnpm test         # vitest: tally arithmetic, policy resolution, script body
```

`pnpm build` emits both halves. The host entries are ordinary ESM; the browser
entry is not — `lib/client.js` must be the loader's lazy-CJS factory artifact
(`window.__ModuleLoader__.load({ id, factory })`), which is what
[`tsdown.config.ts`](tsdown.config.ts) reproduces. The harness's own
`clientBundle` preset is not published, so an out-of-tree package owns that
format itself. Two rules the config encodes:

- The shared module table is small — `react`, `react/jsx-runtime`, `react-dom`,
  `react-dom/client`, `@deepseek-ai/cordis`, `dsh-client-ui-slots`,
  `dsh-client-ui-primitives`, plus the preloaded `dsh-client-runtime/client`.
  Everything else must inline, or the factory throws on a `require` the table
  cannot answer.
- Cross-plugin **value** imports are forbidden. Collaborate through cordis
  services and keep the rest type-only.

The `@deepseek-ai/dsh-*` packages are `devDependencies` on purpose. At runtime
they resolve to the harness installation through the profile's Node parent-walk,
so declaring them as runtime dependencies would install a second, older copy into
the profile and shadow the one the harness is actually running.

To iterate against a live harness, install the checkout and rebuild in place:

```sh
dsh plugin --profile web add .
pnpm build && dsh web
```

## Known Limitations and Deferred Work

- **A role cannot restrict its own tools or persona** — the workflow `agent()` hook exposes neither, so per-role isolation would mean leaving the workflow engine for `ctx.subagents.start()` and re-owning the concurrency gate, cancellation, and progress UI.
- **The settings card and the tool sit on different planes** — the card is served by the bare-name host row (host plane) and the tool runs inside the published preset (agent plane). The link between them is the `council` settings namespace: the host owns it, the tool reads it at call time. A deployment that mounts the tool row by hand without the host row gets the tool but no settings section.
- **Votes measure agreement among correlated agents** — distinct lenses and per-role model routes reduce the correlation between members but do not remove it. A quorum is a count of self-reports, not certification.
- **Deduplication is lexical** — two members describing one defect in unrelated words at the same location produce two findings, and each is verified separately. The design's second-stage merge agent is not implemented.
- **Topology is an acyclic chain** — there is no `verify → fix → re-verify` cycle. Iterative execution belongs to `@deepseek-ai/dsh-tool-ralph`.
- **Nothing crosses layers except findings and votes** — member transcripts are not carried forward; the workspace is the shared memory.
- **A long-lived peer team is a different shape** — `@deepseek-ai/dsh-experimental-agent-team` owns the roster, mailbox, and shared task DAG; this plugin is a bounded fan-out that settles in one call.
