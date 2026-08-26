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
 * `uncertain` never confirms: it only denies unanimity. When the rule does not
 * confirm, the modal negative vote decides between `not-a-bug` (the fact holds
 * but is not a defect) and `rejected` (the claim itself is wrong) — a
 * distinction that changes the follow-up action, so it must survive the tally.
 * @param counts - the vote counts for one finding.
 * @param ballots - how many verifier ballots the layer actually collected.
 * @param quorum - the layer's rule and, for `threshold`, its required count.
 * @returns the finding's outcome, or `insufficient` below two ballots.
 */
export declare function applyQuorum(counts: Counts, ballots: number, quorum: QuorumConfig): Outcome;
/**
 * Build the verdict table from the verify layer's ballots.
 *
 * A verifier that returned no verdict for a finding contributes `null` to that
 * row rather than a silent abstention, so a partially answered ballot is
 * visible in the report instead of being read as agreement. (`null`, not
 * `undefined`: the workflow engine's result materializer rejects `undefined`
 * as non-JSON data.)
 * @param findings - the deduplicated findings, in report order.
 * @param ballots - one entry per surviving verifier instance, in layer order.
 * @param quorum - the verify layer's quorum policy.
 * @returns the column headers and one row per finding.
 */
export declare function tally(findings: readonly ClusteredFinding[], ballots: readonly VerifierBallot[], quorum: QuorumConfig): Tally;
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
 * reviewer acts on.
 * @param expected - the host's recomputation from the raw ballots.
 * @param actual - the tally the workflow script returned.
 * @throws Error when column order, row order, votes, counts, or outcomes differ.
 */
export declare function assertTallyAgrees(expected: Tally, actual: Tally): void;
export {};
