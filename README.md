# @starsinc1708/dsh-tool-council

A map-reduce council of subagents for the DeepSeek Harness: one task fans out to several fresh children through different lenses, verifiers re-check each finding from the source, and a quorum turns their votes into a verdict table.

The plugin is a Consumer over the workflow and subagent seams. Its script is deployment-owned and build-time constant: the model supplies the task text and, optionally, a preset name — it cannot change the topology, the schemas, the quorum, or the validation. How the council runs is decided by the USER at the start of each Map-Reduce session, in the composer-dock designer (preset, per-role widths and routes, verification, quorum) — never by model arguments. Concurrency limiting, cancellation, worker termination, and the `workflow-run` conversation node come from `ctx.workflowEngine`.

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
          maxAgentsPerLayer: 100
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

`councilPolicy` is the tool's own configuration, owned by the always-composed host row so the session designer can render the deployment's real topology and the published preset can mount the tool with the same policy. Omit it for the four shipped topologies (`bug-hunt`, `research`, `feature-design`, `refactor`) and the default ceilings. There is no per-preset merge — declaring `presets` replaces them wholesale, because a partially overridden role prompt is a topology nobody reviewed.

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

## Session designer

There is no global council configuration anymore — **a council is configured where it runs**, at the start of a Map-Reduce session, and Settings → Plugins is deliberately empty of Council. The host row still owns the `council` settings namespace, but only to mirror the deployment (read-only `topology`, `maxAgentsPerLayer`, `maxLayers`, `agentPresetId`, `defaultPreset`) and to carry each session's own setup in the user layer (`sessionCouncil`, keyed by session id). The mirrors are what let the composer-dock designer draw the real presets and layers without a Remote namespace and bound every width and layer input against the real ceilings; a user layer that shadows any of them is refused (`assertMirrorsUnchanged`), so a raw API call cannot move what the designer renders without moving what the tool runs.

An expandable **Council** panel sits above the composer card in every Map-Reduce session. Collapsed it names the preset the session runs; expanded it is a small DAG editor, read the way the council reads — a chain of layer nodes (examining → verify → synthesize), each holding one row per role:

- **Each role row** carries its own member count (stepper) and one **model picker**: a DSH-styled trigger that opens a searchable menu of provider groups fed by the harness's own per-session model directory (the same source the composer's model select reads), with `inherit` clearing the role's route. The count is the role's ABSOLUTE width: `tests: 3` starts three test-examiners, whatever the preset composed. A row tuned back to its composed value stops being an override the moment you edit it.
- **Add roles where a lens is missing.** Every map and verify node has **Add role**: a row appears with its own name and lens prompt (both editable, the prompt via the ✎ editor), its count and its model route, and a ✕ to drop it again. The prompt is exactly what an authored member runs on, so it is stored with the role.
- **Add layers when one pass is not enough.** **Add layer** below the chain inserts a whole authored map layer after the preset's own map layers — another examining pass before verification — up to the deployment's mirrored `maxLayers`.
- **The verify node** has a switch. Off, the session runs map → reduce only: nothing is cross-checked before the synthesizer reports, which is cheaper and what a session wants when it is exploring rather than certifying.
- **The quorum row** restates the verify layer's rule (`majority`, `unanimous`, a `threshold` with its own confirmations count). The designer refuses to Save a threshold its own width cannot reach, and refuses any layer pushed past `maxAgentsPerLayer` — the same two refusals the host would otherwise land on the next run.

Above the layers a **preset select** picks which deployment topology the session edits, one of your saved **Custom** presets (`★ …`), or **Custom (from scratch)** — an empty chain you build yourself: add map layers, a verify layer and a final synthesizer (`+ map layer / verify layer / synthesizer`), each with its own roles. A custom council is validated like any other (one trailing synthesizer, at most one verify, no map after verify, every layer non-empty and within the mirrored ceilings); give it a name and Save. Saving FIXES that topology for the session: from then on every council run in the session executes it, and the model's per-request preset choice stops applying (the tool ignores the `preset` argument while a setup exists). A pristine panel over the deployment's own default preset is not a setup — the session stays clean, the model keeps choosing per request, and runs behave exactly as before — until you make a real choice. **"Let the model pick the preset"** clears the session's entry and restores that behaviour.

Two libraries at the bottom of the panel survive across sessions:

- **My roles** — the 💾 button on any authored role stores it (name, lens prompt, count, model route); the **Add role** menu of every map/verify node then offers **My roles** entries to insert a copy with one click. ✕ removes a library entry.
- **My presets** — while editing a custom council, **Save preset** stores it (its whole authored topology under your name); it then appears as `★ …` in every session's preset menu, and selecting it copies the template into the session to edit and run. ✕ removes a saved template.

The whole document is one field write per Save (`sessionCouncil[sessionId]`), validated structurally by the designer before the write and by the tool at call time after it, so two sessions never share a topology and a reopened session keeps its own. The tool row reads the section fresh on every call, so a Save lands on the next run without a recomposition.

## The Council tab

The Council conversation view renders each run as a graph of its layers and members — live status, per-member and per-layer tokens, per-layer duration, and a one-line role explanation — followed by the run's **verdict table and written report**, with Markdown and JSON export. Each run's header carries its task snippet, start time, and an over-budget or failed chip, so a collapsed list of runs is still readable.

A run **in flight** shows a ticking clock, its running token total and cost estimate in the header, and per-layer member counts (`1 running · 3 done`) beside the layer's tokens. Two things about those numbers are worth stating, because neither is derivable from the live run and both are reported honestly rather than guessed:

- **The counts are of what has STARTED, never a `2/3` fraction.** The `workflow-run` node publishes a member only once it launches, and the artifact that carries each layer's real width lands only when the run settles. The declared width shown as `of N declared` comes from the `council` settings section — the deployment's `topology` mirror composed with THIS session's designer setup, which is the same pair the tool resolves on every call — joined to the run by the preset id in the run's name (`council:<presetId>`). It is a live read, so a setup edited mid-run would make it disagree with what that run actually launched; that is why it sits beside the counts instead of under them as a denominator.
- **The clock says which clock it is.** Neither `RunData` nor the chat node carries a start time — `ConversationViewNode` has no `time` field and `anchorSeq` is a sequence number. What the same snapshot does carry is the still-running `tool/call` head, whose `time` is the exact millisecond the council call was logged; the view joins it by the call's own turn and step and **refuses the join when that step holds more than one call in flight**, because nothing there can tell which call owns which run. When the join is refused the header falls back to when this tab first saw the run and says `watched here` rather than `elapsed` — a clock that resets on reload has to admit it.

The timer exists only while the run's status is `running`: the live header is a separate component, so settling unmounts it, which is what clears the interval and drops the token subscriptions it opened. Only the newest run is expanded; older ones collapse, which is also what stops a finished run from holding live token subscriptions open for the rest of the session. Long verdict tables draw their first 50 rows with the rest one click away. Both exports are offered as a clipboard copy and as a file download, because clipboard access is permissioned and silently unavailable in some webviews.

Each row carries the reporting member's **severity** as a coloured badge (`blocker`, `high`, `medium`, `low`), and three chips above the table filter it: `confirmed`, `unresolved`, and `all`. `unresolved` is both unresolved arms together — `INSUFFICIENT` and `NOT VERIFIED` — because they differ in *why* nobody settled the row, not in what they leave the reader to do; splitting them would leave one chip permanently at zero on every preset. Every chip carries the count it would show, so an empty table never reads as an empty run. The chip is applied **before** the 50-row window (`windowRows` owns that order, and a test pins it) — windowing first would drop a blocker confirmed at row 60 from a `confirmed` chip claiming to show it — and "show all" counts the filtered total. Rows keep their number from the whole run, so `#7` is the same finding under every chip and in the export.

A finding is something you act on, so each **location is a chip that copies itself**, and an adjacent arrow **opens the file**. Opening goes through the one seam the client runtime exposes for this — `ctx.workspaces.openPath(path)` on the injected `workspaces` service, which hands the path to the host operating system's default application. It is the same call the harness's own chat makes for a file mention. Locations are workspace-relative, so the path is joined against the session's `cwd` before the call; a session with no workspace root sends the path unchanged rather than guessing a root and opening the wrong file. Both the chip and the exports share one clipboard path, so a permissioned clipboard that refuses says `copyFailed` instead of failing silently.

Beside the two exports there is a third: **the confirmed findings as a Markdown checklist** (`- [ ] {title} — {location}`, with the fix as a sub-item when the member proposed one), offered as a copy and as a download. Confirmed only, because an unresolved row is not yet work. `toChecklist` is a pure exported function with its own tests, including that a newline inside a member-authored title is collapsed — otherwise a title containing `\n- [ ] already fixed` would forge a checklist entry nobody reported.

Severity is a self-report: the member that filed the finding chose it, and a `blocker` nobody confirmed is still only a claim. The durable record stores it as a plain string, so a level written by a differently-configured build renders its own text in the neutral badge instead of resolving a locale key that does not exist. The Markdown export carries the severity column too; **the parent model's table does not** — `renderTable` in `tool.ts` is a token-budget decision, not a UI one, and it is deliberately left alone.

The **report renders as structure, not as a `<pre>`**. The synthesizer is prompted for numbered sections and lists, so preformatted monospace throws away the only shape its output has — but both obvious fixes are closed. Importing the harness's Markdown renderer is a cross-plugin value import the bundle-purity gate forbids (and not a declared dependency here), and bundling a Markdown parser adds weight plus an HTML-injection surface on **model-authored text**, which is precisely the input you do not want near `innerHTML`.

So [`report.ts`](src/client/report.ts) does the smallest honest thing: a pure function from report text to a block list — headings (`#`…`###`, deeper levels clamped), ordered and unordered lists, fenced code, inline code, and everything else a paragraph with its whitespace preserved — and the view renders those blocks as **React elements**. No HTML is constructed and `dangerouslySetInnerHTML` never appears, so a `<script>` in a report is nine characters of text and the XSS surface does not exist rather than being defended against. It is deliberately not Markdown: emphasis, links, tables, block quotes, and nested list depth are not modelled and survive as the literal characters the synthesizer wrote. `tests/report.spec.ts` drives the parser directly, including unclosed fences (they close at end of text instead of swallowing the report), a lone line of backticks, an unpaired inline backtick, and HTML tags in every arm. **`toMarkdown` still exports the raw report unchanged** — the export is the record, not the rendering.

That last part is durable, and it travels through the one channel a plugin actually has. The run's artifact — topology, narration, per-layer timing, verdict rows and the report — is the tool's `presentationMeta`, which the harness persists on the `tool/result` event it writes anyway; the tab reads it back from there. A finished run therefore reopens with its table intact from a fresh client session.

**The plugin writes no private event types, and must not.** The session reader validates every record against the harness's `KNOWN_SESSION_EVENT_TYPES` and refuses to interpret a log containing an unknown type that is not marked `ignorable` — and `Session.append()` gives an out-of-repo plugin no way to set that marker (`dsh-session` says so: *"a registration surface for them is deferred until such a consumer exists"*). Versions up to 0.1.1-rc.2 appended a `tool-council/*` family and so made their own session logs unreadable on the next start:

```
SessionFormatUnsupportedError: session "…" contains event type "tool-council/run-start"
(seq …) unknown to this harness and not marked ignorable; refusing to interpret the log
```

If you hit that, repair the affected logs in place — it only adds the `ignorable` marker to those records, and keeps the original as `*.bak`:

```sh
node scripts/repair-council-sessions.mjs           # scan and report
node scripts/repair-council-sessions.mjs --write   # repair
```

Only `tool-workflow/*` records are appended now, and `tests/recorder.spec.ts` checks the appended vocabulary against the harness's own catalogue rather than a hand-written allowlist.

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
                  #         host rendering, recorder, session-setup composition,
                  #         designer controller, client fold
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
- The same rule catches the package's OWN subpath. `deps: { neverBundle }`
  externalizes every bare specifier, so a value import of
  `@starsinc1708/dsh-tool-council/types` from `src/client` compiles, bundles,
  and then fails at load with `require(…) missed the module table`. Import
  values from `../types.ts` relatively so they inline; the specifier is fine
  for `import type`, which is erased before the bundle exists.
  `tests/bundle.spec.ts` enforces both directions.

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
- **The designer and the tool sit on different planes** — the designer is served by the bare-name host row (host plane) and the tool runs inside the published preset (agent plane). The link between them is the `council` settings namespace: the host owns it, the tool reads it at call time. A deployment that mounts the tool row by hand without the host row gets the tool but no designer and no session setups.
- **Votes measure agreement among correlated agents** — distinct lenses and per-role model and provider routes reduce the correlation between members but do not remove it. A quorum is a count of self-reports, not certification.
- **The merge step is a judgement, not a proof** — the deterministic key is lexical, and the merge child that resolves same-location ambiguity is an LLM with its own failure modes. It is scoped to the one decision the key cannot make, its candidates are capped, and a wrong merge is the way a finding can silently disappear. Set `mergeSameLocation: false` to keep the lexical behaviour.
- **The run budget is checked between layers** — `maxRunMs` cannot stop a layer that is already running; it stops the next one and falls back on a host `cancel()` after a grace period. It is a ceiling on how long a run keeps spending, not a deadline it will hit precisely.
- **The parent's table is capped at 100 rows** — a deployment that raises `maxFindings` above that gets a counted truncation notice and the full table in the Council tab, rather than a table the report ceiling cuts off mid-row.
- **The Council tab is read-only** — it shows and exports a run; it cannot cancel or re-run one. A cancel button would have to reach for `session.cancel`, which stops the parent's whole turn rather than this run, so a documented instruction is honestly better than a button that does something else. Precise cancel and one-click re-run both need a Host RPC namespace, which is the Client composition owner's call, not this package's. Cancel the parent step instead: the tool cancels its run with it.
- **The model menu needs the harness's model directory to be composed** — the picker is fed by `modelDirectories` (ui-model-selection, part of the standard web profile). A deployment without it shows only `inherit`; nothing else breaks, but there is no provider-grouped catalog to search.
- **The cost figure is your arithmetic, not a bill** — `costPerMillionTokens` is off by default (no editor remains for it) and blended by construction. The meter reports no price and the view cannot know which route each member actually ran on, so a per-route figure is impossible here; what is shown is your rate times real token counts, labelled as an estimate.
- **A persisted artifact is validated, not trusted** — `isArtifact` checks every field the tab dereferences, rows included, not just `kind`/`version`/`runId`. `version` alone cannot police the input: a build that shipped a bug wrote version 1 too, and artifacts are replayed from logs other builds wrote. A record that fails the check is ignored, so the run degrades to its live member graph instead of throwing inside the render and blanking the whole tab.
- **A location opens its file, but never at its line** — `ctx.workspaces.openPath(path)` is the whole seam the client runtime exposes: it hands a path to the operating system's default application. There is no reveal-at-line or open-in-editor API anywhere on that face (`IWorkspaces` is workspace registration, directory browsing, session connection, and this one open), so `rank.py:521` opens `rank.py` and the line survives only in what the chip copies. Jumping to the line needs an upstream seam — an editor/reveal capability on the Host — and no amount of client work substitutes for it. What the file opens *in* is also the operating system's choice, not this plugin's.
- **The Council tab mirrors two renderer contracts by hand** — `workflow-run`'s member/phase payload shapes and its status union are restated in `council-view.tsx` because the package exports them only from a subpath its `exports` map does not publish. Fixing that needs an upstream export; until then a change to those shapes shows up as a rendering bug, not a type error.
- **Live "of N declared" readouts mirror a saved setup, not the draft** — the declared width beside a running layer composes the session's SAVED setup (its own `sessionCouncil` entry); edits staged in the designer but not yet saved, and a setup edited mid-run, both make the live figure disagree with what the run actually launched. The run's artifact carries the real layers once it settles, so the finished table is always exact; that is why the live figure sits beside the observed counts as a declared hint rather than under them as a denominator.
- **The composer designer shows only inside sessions running the council mode** — it gates on the same agent-preset identity as the Council tab, so a deployment that mounts the tool row into a general-purpose mode gets no panel (the section entry can still be written, and the tool honours it).
- **The session authors roles and map layers, but cannot remove preset ones or reorder** — a session may tune every preset role's width and route, append its own roles (with their lens prompts) to map and verify layers, add whole authored map layers, drop the verify layer, and restate the quorum; it cannot remove a role the preset composed or move a layer past verification. Authored prompts run on fresh children with the same access as any member, so they are authored at the session's own risk — the same trust the model's own instructions already carry.
- **A verify layer always spends every ballot** — all verifiers of a layer start in one `parallel()`, so there is nothing to stop early once a majority has decided. Spending fewer would mean not starting them, which is a width change, not a runtime one.
- **Topology is an acyclic chain** — there is no `verify → fix → re-verify` cycle, at most one verify layer, and exactly one trailing reduce role. Iterative execution belongs to `@deepseek-ai/dsh-tool-ralph`.
- **Nothing crosses layers except findings and votes** — member transcripts are not carried forward; the workspace is the shared memory.
- **A long-lived peer team is a different shape** — `@deepseek-ai/dsh-experimental-agent-team` owns the roster, mailbox, and shared task DAG; this plugin is a bounded fan-out that settles in one call.
