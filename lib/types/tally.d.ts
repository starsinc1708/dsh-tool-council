/**
 * Pure deduplication and quorum arithmetic — the host's authoritative copy.
 *
 * The workflow script runs the same logic inside its worker, because the
 * verify layer needs deduplicated findings *during* the run and the script
 * cannot import this module. The host then recomputes from the raw ballots and
 * refuses a run whose script-side tally disagrees. The duplication is
 * deliberate and follows `dsh-tool-ralph`, which likewise validates its
 * structured handoff on both sides of the realm boundary; this copy is the one
 * the coverage gate exercises.
 *
 * @module @starsinc1708/dsh-tool-council
 */
import type { ClusteredFinding, Finding, Outcome, QuorumConfig, Tally, VerifierBallot } from './types.ts';
/**
 * Reduce a headline to an order-insensitive token signature.
 * @param title - the finding's headline, in any case or word order.
 * @returns sorted, deduplicated, stop-word-free lowercase tokens joined by `-`.
 */
export declare function fingerprint(title: string): string;
/**
 * Normalize a location so `./src/rank.py:521` and `src/rank.py:521` cluster.
 * @param location - the reported path, optionally suffixed with `:line`.
 * @returns the path without a leading `./`, with backslashes folded to `/`.
 */
export declare function normalizeLocation(location: string): string;
/** A finding tagged with the role instance that reported it. */
export interface ReportedFinding {
    readonly by: string;
    readonly finding: Finding;
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
export declare function dedupeFindings(reported: readonly ReportedFinding[]): ClusteredFinding[];
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
export declare function capPerMember(reported: readonly ReportedFinding[], perMember: number): ReportedFinding[];
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
export declare function mergeClusters(clustered: readonly ClusteredFinding[], groups: readonly (readonly string[])[]): ClusteredFinding[];
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
export declare function assertClustersWellFormed(clusters: readonly ClusteredFinding[]): void;
/** Vote counts for one finding. */
interface Counts {
    confirmed: number;
    rejected: number;
    notABug: number;
    uncertain: number;
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
export declare function applyQuorum(counts: Counts, participating: number, quorum: QuorumConfig): Outcome;
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
export declare function tally(findings: readonly ClusteredFinding[], ballots: readonly VerifierBallot[], quorum: QuorumConfig): Tally;
/**
 * The legend the verdict table needs to be read correctly — in particular that
 * `·` is an abstention that does not count toward the quorum.
 */
export declare const TABLE_LEGEND: string;
/**
 * Render the tally as a Markdown table for the parent model and the report.
 * @param findings - the deduplicated findings, in report order.
 * @param result - the tally produced by {@link tally} over the same findings.
 * @returns a Markdown table, one row per finding, one column per verifier.
 */
export declare function renderTable(findings: readonly ClusteredFinding[], result: Tally): string;
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
export declare function assertTallyAgrees(expected: Tally, actual: Tally): void;
export {};
