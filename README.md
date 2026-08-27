# @starsinc1708/dsh-tool-council

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

A `# == @starsinc1708/dsh-tool-council` layer with a `tool-council-host` row
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
dsh plugin --profile web add ./starsinc1708-dsh-tool-council-0.1.1-rc.2.tgz   # pnpm pack output
```

Both skip the git fetch and need no build allowance either. Use a local checkout
while developing: `pnpm build` then restart `dsh web`.

### Update and remove

```sh
dsh plugin --profile web update @starsinc1708/dsh-tool-council
dsh plugin --profile web remove @starsinc1708/dsh-tool-council
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
      name: '@starsinc1708/dsh-tool-council'
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
          maxFindingsPerMember: 50
          maxFindingChars: 2000
          maxReportChars: 32768
          maxRunMs: 0            # 0 disables the wall-clock budget
          retryFailedMembers: true
          mergeSameLocation: true
          maxMergeCandidates: 60
          councilEveryRequest: true   # false = offer the council, do not mandate it
          defaultPreset: bug-hunt
          # presets: []   # replaces the four shipped topologies wholesale
```

`councilPolicy` is the tool's own configuration, owned by the always-composed host row so the settings card can mirror the deployment's real topology and the published preset can mount the tool with the same policy. Omit it for the four shipped topologies (`bug-hunt`, `research`, `feature-design`, `refactor`) and the default ceilings. There is no per-preset merge — declaring `presets` replaces them wholesale, because a partially overridden role prompt is a topology nobody reviewed.

Structural rules the schema cannot express are enforced at load and fail the deployment rather than the call: every preset ends in a reduce layer with exactly one role instance, at most one verify layer is declared and no map layer follows it, a quorum appears on a verify layer and nowhere else, a `threshold` quorum is at most its layer's width, and preset, layer, and role ids are unique within a preset. The last two are not pedantry — a map layer after the verify layer re-clusters and renumbers the findings the ballots were cast against, and a role id reused on a second layer collapses two members into one instance id. Both would otherwise fail at the *end* of a run, after every child had been paid for.

`subagentProvider` must be registered, must advertise `outputSchema`, and must not inherit parent context. A member seeded with the parent's transcript would inherit the parent's framing of the problem, which is what the layer exists to break.

### Budget and failure ceilings

`maxRunMs` is a wall-clock budget for one run; `0` (the default) leaves it off. It is enforced twice, on purpose. The script checks it at each **layer boundary** and skips the remaining examine/verify layers while still running the trailing reduce layer, so an over-budget run returns the findings it did gather, flagged `deadline`, instead of nothing. The host keeps a hard `run.cancel()` backstop at `maxRunMs + 60s` for the case the script's own check cannot help — a single layer that never settles. Children already in flight are never killed mid-layer.

`retryFailedMembers` (default on) re-issues one `agent()` call whose child died. A dead child resolves its call to `null` rather than throwing, so without the retry one transport failure silently removes a whole lens and nothing in the report says so. `maxTotalAgents` is sized to cover the retries and the single merge child, because a tripped `AGENT_CAP` kills the run rather than degrading it.

A reduce child that returns nothing is reported as a **missing report**, not as an empty one: the tool result says so above the table and the durable record carries `reportMissing`.

## Layers

A layer is `map`, `verify`, or `reduce`. Its width is the sum of its roles' `count`, and each instance runs as one `agent()` call under the engine's concurrency limit.

A role differs from its neighbours by its `prompt` and its optional `model`/`provider`, and by nothing else: the workflow `agent()` hook accepts neither a persona nor a tool filter. Members do reach the workspace — a `spawn` child joins the parent's preset — which is what makes a verifier's vote worth counting: it re-reads the cited location rather than reasoning from the finding text.

## Findings and quorum

Map children return findings through a structured output schema, so nothing parses prose. Each member's list is capped at `maxFindingsPerMember` as it is read, so one talkative member cannot fill the slice and crowd the quieter ones out — and cannot grow the accumulated list past `instances × maxFindingsPerMember` either. Findings then cluster on `normalizeLocation(location) + '|' + fingerprint(title)`; the first-seen member survives and later members contribute a reporter and a title variant.

Clustering is lexical, so two members describing one defect in unrelated words at the same location still arrive as two findings. When `mergeSameLocation` is on (the default), a **merge child** receives exactly those groups — clusters sharing a location but not a fingerprint — and returns the id sets that are one defect; the earliest cluster absorbs the others' reporters and variants, and the ids are renumbered. Merge groups chain: told `f1 ≡ f2` and `f2 ≡ f3`, the fold produces one finding carrying all three reporters, in whichever order the groups arrive. A merge child that dies leaves every cluster standing.

`maxMergeCandidates` is shared *across* the ambiguous locations rather than handed out first-come, so one hot file cannot consume the budget and leave every other location unmerged; whatever still does not fit is named in the run log rather than dropped quietly. The whole step runs **once per run**, at the last map layer — clustering per layer would rebuild the list from scratch and throw the previous layer's merge decisions away with it, since the ids they were expressed in no longer exist after renumbering. Both reduce modes run this pipeline: `vote` renders the verdict table as the answer, `synthesis` asks the reduce role for prose and hands it the same table as evidence.

Each verifier receives the whole deduplicated list, votes `confirmed`, `rejected`, `not-a-bug`, or `uncertain` per finding, and never sees another verifier's ballot. `uncertain` never confirms — it only denies unanimity. When a rule does not confirm, the modal negative vote decides between `not-a-bug` (the fact holds but the behaviour is correct) and `rejected` (the claim is wrong); the distinction changes the follow-up action, so it survives the tally.

**Abstentions do not count.** The quorum's denominator is the number of verifiers who voted on *that finding*, not the number of ballots the layer collected: a verifier that returned no verdict for a row abstained on it, and its silence would otherwise make one confirmation plus one abstention read as a quorum of two. A `·` in the table is that abstention, and the rendered legend says so.

`insufficient` is the **unresolved** arm, not a negative one — the rule was not met *and* nobody argued against the finding. Two situations reach it: fewer than two verifiers voted on the row, or the ones who did could not clear the bar the rule sets (a `threshold` of three that only two verifiers reached, unanimity denied by an `uncertain`). Neither is `rejected`, because nobody said the claim was wrong. A preset with no verify layer at all reports `unverified` instead: nobody was ever asked.

`./tally.ts` is the host's authoritative copy of that arithmetic. The script runs its own copy because the verify layer needs deduplicated findings during the run and cannot import this package. That duplication is guarded on both sides of the boundary. At **runtime** the host recomputes the quorum from the raw ballots and refuses a run whose script tally disagrees, naming the first row and field that differ; it also refuses clusters that break the invariants clustering guarantees — contiguous ids in report order, one cluster per location+fingerprint key, duplicate-free reporter and variant lists. At **build time** `tests/parity.spec.ts` runs both copies of all five duplicated functions over thousands of seeded inputs and compares every output, so drift fails the commit rather than the run. The host does not recompute the clustering itself at runtime: that would mean carrying the whole raw finding list back across the boundary and roughly doubling the payload, which is not worth it once the parity gate makes silent drift a build failure.

## Settings

The host row serves the `council` settings namespace. The section carries `defaultPreset`, a sparse `overrides` map keyed by preset, and three read-only mirrors the host writes as the section's `base` layer: `topology`, `maxAgentsPerLayer`, and `agentPresetId`. Those mirrors are what let the browser card draw the deployment's real layers without a Remote namespace, bound its width input against the real ceiling, and gate the Council tab on the preset id this deployment actually published rather than the shipped `map-reduce`.

The card stages edits locally and lands them in one save, marks itself `unsaved changes` while anything is staged, and holds a `beforeunload` guard so closing the tab asks first. An overlay may change a role's width, model, or provider and a layer's quorum; it may not change a topology. An overlay the host would refuse is refused twice: the card names the offending preset and layer and disables Save before the write — for a width past `maxAgentsPerLayer` and for a `threshold` its own layer cannot reach — and the host refuses the write itself for any client that does not. The three read-only mirrors are refused as user writes too, so a raw API call cannot shadow what the card believes without changing what the tool runs. Clearing a model or provider field removes the override rather than storing an empty string, so the role stops being marked as overridden. The whole overlay can be copied, downloaded, or re-imported as JSON from the card; an import that would discard staged work asks first. Model and provider are free-text fields with a `datalist` of the routes this deployment already names — a closed list would hide every valid custom id. The tool row reads the section fresh on every call, so an edit lands on the next run without a recomposition.

## The Council tab

The Council conversation view renders each run as a graph of its layers and members — live status, per-member and per-layer tokens, per-layer duration, and a one-line role explanation — followed by the run's **verdict table and written report**, with Markdown and JSON export. Each run's header carries its task snippet, start time, and an over-budget or failed chip, so a collapsed list of runs is still readable. Only the newest run is expanded; older ones collapse, which is also what stops a finished run from holding live token subscriptions open for the rest of the session. Long verdict tables draw their first 50 rows with the rest one click away. Both exports are offered as a clipboard copy and as a file download, because clipboard access is permissioned and silently unavailable in some webviews.

That last part is durable. The tool result lives in the parent model's context and disappears with it, so the tool also appends a `tool-council/result` record (bounded counts, verdict rows, and the report) to the parent session alongside `tool-council/run-start`, `/phase`, and `/log`. A finished run therefore reopens with its table intact from a fresh client session, which is the difference between a fan-out that returned some text and an audit you can go back to.

## Model Experience

### Council members

Nothing directly. Each member receives the preset's framing, its own role prompt, and the verbatim task text; no member sees the parent conversation or a sibling's output. One fresh child context per role instance per layer, bounded by `maxAgentsPerLayer` and the engine's concurrency limit — a `bug-hunt` run is eight children. None of them joins the parent history.

### Parent tool result

A one-line count — `N of M examining members answered; K reported … distinct findings; … verifiers voted, confirming …` — then the Markdown verdict table with its legend, then the synthesizer's report, all bounded by `maxReportChars`. Answering and reporting are counted separately because the map prompt calls an empty list a valid answer, and folding them would make a clean run where nobody found anything read as four dead children. A run that hit its budget or lost its synthesizer says so above the table rather than presenting a partial council as a complete one; when there is no verdict table and no report, the findings themselves are listed rather than silently dropped. Individual member transcripts and per-verifier reasons stay out of the parent context. Wording attributes conclusions to the members — "two of three verifiers confirmed" — because verifiers are agents re-reading the same repository, not an independent oracle.

## Development

```sh
pnpm install
pnpm build        # tsc -> lib/types, tsdown -> lib/*.js (host halves + client bundle)
pnpm test         # vitest: parity gate, tally arithmetic, policy rules, script body,
                  #         host rendering, recorder, settings overlay + card, client fold
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
- **Votes measure agreement among correlated agents** — distinct lenses and per-role model and provider routes reduce the correlation between members but do not remove it. A quorum is a count of self-reports, not certification.
- **The merge step is a judgement, not a proof** — the deterministic key is lexical, and the merge child that resolves same-location ambiguity is an LLM with its own failure modes. It is scoped to the one decision the key cannot make, its candidates are capped, and a wrong merge is the way a finding can silently disappear. Set `mergeSameLocation: false` to keep the lexical behaviour.
- **The run budget is checked between layers** — `maxRunMs` cannot stop a layer that is already running; it stops the next one and falls back on a host `cancel()` after a grace period. It is a ceiling on how long a run keeps spending, not a deadline it will hit precisely.
- **The parent's table is capped at 100 rows** — a deployment that raises `maxFindings` above that gets a counted truncation notice and the full table in the Council tab, rather than a table the report ceiling cuts off mid-row.
- **The Council tab is read-only** — it shows and exports a run; it cannot cancel or re-run one. A cancel button would have to reach for `session.cancel`, which stops the parent's whole turn rather than this run, so a documented instruction is honestly better than a button that does something else. Precise cancel and one-click re-run both need a Host RPC namespace, which is the Client composition owner's call, not this package's. Cancel the parent step instead: the tool cancels its run with it.
- **The provider suggestions are a boot snapshot** — `availableProviders` is read once at composition and the settings seam has no way to refresh a base layer, so a provider registered later appears only after a restart. That is exactly why both route fields are a `datalist` and never a `<select>`: the list is a hint, and any valid id can still be typed.
- **The cost figure is your arithmetic, not a bill** — `costPerMillionTokens` is off by default and blended by construction. The meter reports no price and the view cannot know which route each member actually ran on, so a per-route figure is impossible here; what is shown is your rate times real token counts, labelled as an estimate.
- **The Council tab mirrors two renderer contracts by hand** — `workflow-run`'s member/phase payload shapes and its status union are restated in `council-view.tsx` because the package exports them only from a subpath its `exports` map does not publish. Fixing that needs an upstream export; until then a change to those shapes shows up as a rendering bug, not a type error.
- **A verify layer always spends every ballot** — all verifiers of a layer start in one `parallel()`, so there is nothing to stop early once a majority has decided. Spending fewer would mean not starting them, which is a width change, not a runtime one.
- **Topology is an acyclic chain** — there is no `verify → fix → re-verify` cycle, at most one verify layer, and exactly one trailing reduce role. Iterative execution belongs to `@deepseek-ai/dsh-tool-ralph`.
- **Nothing crosses layers except findings and votes** — member transcripts are not carried forward; the workspace is the shared memory.
- **A long-lived peer team is a different shape** — `@deepseek-ai/dsh-experimental-agent-team` owns the roster, mailbox, and shared task DAG; this plugin is a bounded fan-out that settles in one call.
