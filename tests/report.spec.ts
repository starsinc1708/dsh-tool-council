/**
 * Tests for the report's structural pass.
 *
 * This parser exists because the two obvious ways to render the synthesizer's
 * report are closed — the harness's renderer is a forbidden cross-plugin value
 * import, and a bundled Markdown parser puts model-authored text next to an
 * HTML-injection surface. So the parser's contract is narrow and its safety
 * argument is structural: it emits DATA, the view emits React elements, and no
 * HTML is ever built. The adversarial cases below are the ones that would
 * otherwise crash the tab, swallow the report, or smuggle markup through.
 */

import { describe, expect, it } from 'vitest'
import { parseReport, parseSpans } from '../src/client/report.ts'
import type { ReportBlock, ReportSpan } from '../src/client/report.ts'

/** Narrow a block to the list arm, failing the test rather than casting blindly. */
function listOf(block: ReportBlock | undefined): Extract<ReportBlock, { kind: 'list' }> {
  if (block === undefined || block.kind !== 'list') throw new Error(`expected a list, got ${String(block?.kind)}`)
  return block
}

/** All the literal text one block would render, code spans included. */
function textOf(block: ReportBlock): string {
  if (block.kind === 'code') return block.text
  const spans = block.kind === 'list' ? block.items.flat() : block.spans
  return spans.map((span: ReportSpan) => span.text).join('')
}

describe('parseSpans', () => {
  it('splits inline code out of the surrounding text', () => {
    expect(parseSpans('see `rank.py` now')).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'code', text: 'rank.py' },
      { kind: 'text', text: ' now' },
    ])
  })

  it('leaves an unpaired backtick as literal text', () => {
    // Eating the rest of the sentence is the failure mode here.
    expect(parseSpans('a ` b')).toEqual([{ kind: 'text', text: 'a ` b' }])
  })

  it('leaves an empty backtick pair alone rather than emitting empty code', () => {
    expect(parseSpans('a `` b')).toEqual([{ kind: 'text', text: 'a `` b' }])
  })

  it('returns nothing for an empty line', () => {
    expect(parseSpans('')).toEqual([])
  })
})

describe('parseReport structure', () => {
  it('recognizes the three heading levels and clamps deeper ones', () => {
    const blocks = parseReport('# One\n## Two\n### Three\n##### Five')
    expect(blocks.map(block => (block.kind === 'heading' ? block.level : 0))).toEqual([1, 2, 3, 3])
    expect(blocks.map(textOf)).toEqual(['One', 'Two', 'Three', 'Five'])
  })

  it('needs a space after the hashes, or it is prose', () => {
    const [block] = parseReport('#hashtag')
    expect(block?.kind).toBe('paragraph')
    expect(textOf(block as ReportBlock)).toBe('#hashtag')
  })

  it('groups consecutive bullets into one list', () => {
    const blocks = parseReport('- one\n* two\n+ three')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: false })
    expect(listOf(blocks[0]).items).toHaveLength(3)
  })

  it('starts a new list when the kind changes, so nothing is renumbered', () => {
    const blocks = parseReport('- one\n1. two')
    expect(blocks.map(block => (block.kind === 'list' ? block.ordered : null))).toEqual([false, true])
  })

  it('accepts both ordered markers', () => {
    const blocks = parseReport('1. one\n2) two')
    expect(blocks).toHaveLength(1)
    expect(listOf(blocks[0]).items).toHaveLength(2)
  })

  it('keeps paragraph whitespace and joins its lines', () => {
    const [block] = parseReport('  aligned one\n  aligned two')
    expect(block?.kind).toBe('paragraph')
    expect(textOf(block as ReportBlock)).toBe('  aligned one\n  aligned two')
  })

  it('separates paragraphs on a blank line', () => {
    expect(parseReport('one\n\ntwo').map(textOf)).toEqual(['one', 'two'])
  })

  it('reads a fenced code block verbatim, with its language', () => {
    const [block] = parseReport('```py\nprint(1)\n  indented\n```')
    expect(block).toEqual({ kind: 'code', language: 'py', text: 'print(1)\n  indented' })
  })

  it('does not parse structure inside a fence', () => {
    const [block] = parseReport('```\n# not a heading\n- not a list\n```')
    expect(block).toEqual({ kind: 'code', language: '', text: '# not a heading\n- not a list' })
  })

  it('returns no blocks for an empty report', () => {
    expect(parseReport('')).toEqual([])
    expect(parseReport('\n\n  \n')).toEqual([])
  })

  it('normalizes CRLF so a Windows-authored report is not one long line', () => {
    expect(parseReport('# One\r\n\r\ntext').map(block => block.kind)).toEqual(['heading', 'paragraph'])
  })
})

describe('parseReport adversarial input', () => {
  it('closes an unterminated fence at the end instead of swallowing the report', () => {
    const blocks = parseReport('intro\n\n```py\nprint(1)\nstill code')
    expect(blocks.map(block => block.kind)).toEqual(['paragraph', 'code'])
    // Nothing is lost: the trailing text is code, not silently dropped.
    expect(textOf(blocks[1] as ReportBlock)).toBe('print(1)\nstill code')
  })

  it('treats a lone line of backticks as an empty code block, not a crash', () => {
    expect(parseReport('```')).toEqual([{ kind: 'code', language: '', text: '' }])
    expect(parseReport('```\n```')).toEqual([{ kind: 'code', language: '', text: '' }])
    // A longer opening fence is closed only by one at least as long.
    expect(parseReport('````\n```\nstill\n````')).toEqual([
      { kind: 'code', language: '', text: '```\nstill' },
    ])
  })

  it('is not closed by an indented backtick run inside its own body', () => {
    // The code arm promises its body verbatim. A backtick line indented past
    // the opening fence is body text — CommonMark's rule — and treating it as
    // a close let the rest of the block escape into paragraphs.
    const report = ['```', 'a', '    ```', 'still code', '```'].join('\n')
    expect(parseReport(report)).toEqual([
      { kind: 'code', language: '', text: 'a\n    ```\nstill code' },
    ])
  })

  it('still closes on a fence indented within three columns of the opening one', () => {
    expect(parseReport(['  ```', 'body', '   ```', 'after'].join('\n'))).toEqual([
      { kind: 'code', language: '', text: 'body' },
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'after' }] },
    ])
  })

  it('keeps an HTML tag as literal text, in every arm', () => {
    // The report is written by a subagent. This is the reason the view renders
    // React elements from these blocks and never sets innerHTML: the markup
    // arrives here as characters and leaves as characters.
    const blocks = parseReport(
      '# <b>bold</b>\n\n- <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n```\n<b>x</b>\n```')
    expect(blocks.map(block => block.kind)).toEqual(['heading', 'list', 'paragraph', 'code'])
    expect(blocks.map(textOf)).toEqual([
      '<b>bold</b>',
      '<img src=x onerror=alert(1)>',
      '<script>alert(1)</script>',
      '<b>x</b>',
    ])
  })

  it('never loses a character of a report that has no structure at all', () => {
    const report = 'one\ntwo\nthree'
    expect(parseReport(report).map(textOf).join('')).toBe(report)
  })

  it('does not fold a plain line into the list above it', () => {
    // Folding would move the sentence under the wrong bullet.
    const blocks = parseReport('- item\ntrailing sentence')
    expect(blocks.map(block => block.kind)).toEqual(['list', 'paragraph'])
    expect(textOf(blocks[1] as ReportBlock)).toBe('trailing sentence')
  })

  it('survives a report that is only markers', () => {
    expect(() => parseReport('#\n-\n1.\n``\n`')).not.toThrow()
    // `#`, `-`, and `1.` with nothing after them are not headings or items.
    expect(parseReport('#\n-\n1.').map(block => block.kind)).toEqual(['paragraph'])
  })
})
