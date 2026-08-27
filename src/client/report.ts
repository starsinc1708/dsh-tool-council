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
export type ReportSpan =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }

/** One structural unit of a report. */
export type ReportBlock =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3; readonly spans: readonly ReportSpan[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly (readonly ReportSpan[])[] }
  | { readonly kind: 'code'; readonly language: string; readonly text: string }
  | { readonly kind: 'paragraph'; readonly spans: readonly ReportSpan[] }

/** `#` to `######`, then at least one space, then the title. */
const HEADING = /^(#{1,6})\s+(.*)$/u

/** `-`, `*`, or `+`, then at least one space. Leading indent is allowed. */
const BULLET = /^\s*[-*+]\s+(.*)$/u

/** `1.` or `1)`, then at least one space. Leading indent is allowed. */
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/u

/**
 * Three or more backticks, then an optional language word.
 *
 * The leading run of spaces is captured, not discarded: a fence's indentation
 * decides whether a later backtick line closes it — see {@link parseReport}.
 */
const FENCE = /^([ \t]*)(`{3,})[ \t]*(\S*)[ \t]*$/u

/**
 * How far a closing fence may be indented past its opening one.
 *
 * CommonMark's rule, and it is not pedantry here: without it any indented
 * backtick line INSIDE a code block closes it, and the rest of the block
 * escapes into paragraphs — which breaks the one promise the code arm makes,
 * that it reproduces its body verbatim.
 */
const MAX_CLOSING_INDENT = 3

/**
 * Split one line into text and inline-code spans.
 *
 * A backtick with no partner is not code: it stays in the text, because the
 * alternative is silently eating the rest of a sentence. `` `` `` (an empty
 * pair) is likewise left alone rather than becoming an empty code element.
 * @param line - one line of heading, item, or paragraph text.
 * @returns the spans, in order; never empty for a non-empty line.
 */
export function parseSpans(line: string): ReportSpan[] {
  const spans: ReportSpan[] = []
  let rest = line
  while (rest !== '') {
    const open = rest.indexOf('`')
    if (open === -1) break
    const close = rest.indexOf('`', open + 1)
    // No closing backtick on this line, or an empty pair: literal text.
    if (close === -1 || close === open + 1) break
    if (open > 0) spans.push({ kind: 'text', text: rest.slice(0, open) })
    spans.push({ kind: 'code', text: rest.slice(open + 1, close) })
    rest = rest.slice(close + 1)
  }
  if (rest !== '') spans.push({ kind: 'text', text: rest })
  return spans
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
export function parseReport(report: string): ReportBlock[] {
  const lines = report.replace(/\r\n?/gu, '\n').split('\n')
  const blocks: ReportBlock[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: ReportSpan[][] } | undefined

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return
    // Joined with newlines and rendered with preserved whitespace: an aligned
    // block the synthesizer laid out by hand stays aligned.
    blocks.push({ kind: 'paragraph', spans: parseSpans(paragraph.join('\n')) })
    paragraph = []
  }
  const flushList = (): void => {
    if (list === undefined) return
    blocks.push({ kind: 'list', ordered: list.ordered, items: list.items })
    list = undefined
  }
  const flush = (): void => { flushParagraph(); flushList() }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string

    const fence = FENCE.exec(line)
    if (fence !== null) {
      flush()
      const indent = (fence[1] as string).length
      const ticks = (fence[2] as string).length
      const language = fence[3] as string
      const body: string[] = []
      index += 1
      // A closing fence is at least as long as the opening one, carries no
      // language, and is not indented more than three columns past the opening
      // one — without that last rule an indented backtick line INSIDE the block
      // closes it and the rest of the body escapes into paragraphs. Running off
      // the end closes the block too, so an unterminated fence renders as code
      // instead of eating the rest of the report or dropping it.
      while (index < lines.length) {
        const candidate = lines[index] as string
        const closing = FENCE.exec(candidate)
        if (closing !== null
          && (closing[2] as string).length >= ticks
          && (closing[3] as string) === ''
          && (closing[1] as string).length <= indent + MAX_CLOSING_INDENT) break
        body.push(candidate)
        index += 1
      }
      blocks.push({ kind: 'code', language, text: body.join('\n') })
      continue
    }

    if (line.trim() === '') {
      flush()
      continue
    }

    const heading = HEADING.exec(line)
    if (heading !== null) {
      flush()
      // `####` and deeper clamp to the third level rather than falling out of
      // the heading arm: a report that nests six deep should still read as
      // headings, just not as six distinct sizes.
      const level = Math.min((heading[1] as string).length, 3) as 1 | 2 | 3
      blocks.push({ kind: 'heading', level, spans: parseSpans(heading[2] as string) })
      continue
    }

    const numbered = NUMBERED.exec(line)
    const bullet = numbered === null ? BULLET.exec(line) : null
    if (numbered !== null || bullet !== null) {
      flushParagraph()
      const ordered = numbered !== null
      const text = (numbered?.[1] ?? bullet?.[1] ?? '') as string
      // A list ends when its kind changes: `1.` after `-` is a new list, not a
      // continuation, and rendering it inside the first would renumber it.
      if (list !== undefined && list.ordered !== ordered) flushList()
      if (list === undefined) list = { ordered, items: [] }
      list.items.push(parseSpans(text))
      continue
    }

    // Anything else continues (or starts) a paragraph. A plain line directly
    // under a list item is NOT folded into that item: nesting is not modelled,
    // and pretending otherwise would move text under the wrong bullet.
    flushList()
    paragraph.push(line)
  }
  flush()
  return blocks
}
