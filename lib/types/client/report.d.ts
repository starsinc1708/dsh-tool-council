/**
 * A small structural pass over the synthesizer's report.
 *
 * The report is the one output a human actually reads, and the synthesizer is
 * prompted for numbered sections and lists — so rendering it as preformatted
 * monospace throws away the only structure it has. Both obvious ways to fix
 * that are closed:
 *
 * - importing the harness's own Markdown renderer is a cross-plugin VALUE
 *   import, which the bundle-purity gate forbids and which is not a declared
 *   dependency of this package either;
 * - bundling a Markdown parser adds real weight and, worse, an HTML-injection
 *   surface on **model-authored text** — the report is written by a subagent,
 *   which is exactly the input you do not want reaching `innerHTML`.
 *
 * So this module does the smallest thing that is honest: it turns the text into
 * a list of blocks, and the view renders those blocks as React ELEMENTS. No
 * HTML is ever constructed, `dangerouslySetInnerHTML` is never used, and every
 * span of text lands in a React text child — which React escapes. An `<b>` in
 * the report is therefore literal text, and the XSS surface does not exist
 * rather than being defended against.
 *
 * Deliberately NOT Markdown. It recognizes headings, ordered and unordered list
 * items, fenced code, and inline code; everything else is a paragraph whose
 * whitespace is preserved. Emphasis, links, tables, block quotes, and nested
 * list depth are not modelled and survive as the literal characters the
 * synthesizer wrote.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */
/** A run of text inside a heading, a list item, or a paragraph. */
export type ReportSpan = {
    readonly kind: 'text';
    readonly text: string;
} | {
    readonly kind: 'code';
    readonly text: string;
};
/** One structural unit of a report. */
export type ReportBlock = {
    readonly kind: 'heading';
    readonly level: 1 | 2 | 3;
    readonly spans: readonly ReportSpan[];
} | {
    readonly kind: 'list';
    readonly ordered: boolean;
    readonly items: readonly (readonly ReportSpan[])[];
} | {
    readonly kind: 'code';
    readonly language: string;
    readonly text: string;
} | {
    readonly kind: 'paragraph';
    readonly spans: readonly ReportSpan[];
};
/**
 * Split one line into text and inline-code spans.
 *
 * A backtick with no partner is not code: it stays in the text, because the
 * alternative is silently eating the rest of a sentence. `` `` `` (an empty
 * pair) is likewise left alone rather than becoming an empty code element.
 * @param line - one line of heading, item, or paragraph text.
 * @returns the spans, in order; never empty for a non-empty line.
 */
export declare function parseSpans(line: string): ReportSpan[];
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
export declare function parseReport(report: string): ReportBlock[];
