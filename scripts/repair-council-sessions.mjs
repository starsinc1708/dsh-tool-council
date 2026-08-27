/**
 * Mark stray `tool-council/*` records ignorable so a session log written by an
 * older build of this plugin can be read again.
 *
 * Why this exists. Versions up to and including 0.1.1-rc.2 appended a private
 * `tool-council/*` event family to the parent session. That family is outside
 * the harness's `KNOWN_SESSION_EVENT_TYPES`, and `Session.append()` gives an
 * out-of-repo plugin no way to set the envelope's `ignorable` marker — so the
 * read path correctly refuses to interpret the whole log rather than silently
 * skip a record that might change how the rest is read:
 *
 *   SessionFormatUnsupportedError: session "…" contains event type
 *   "tool-council/run-start" (seq …) unknown to this harness and not marked
 *   ignorable; refusing to interpret the log
 *
 * The plugin no longer writes those events. This repairs the logs that already
 * carry them, by adding `"ignorable": true` to exactly those records. Sequence
 * numbers, ordering, framing, and every other record are left as they were, and
 * the original file is copied to `*.bak` before anything is written.
 *
 * A session log is a CONCATENATION of independent zstd frames — one per append
 * batch, each a whole number of JSON lines — so each frame is decoded, repaired
 * and re-encoded on its own, preserving the file's append structure.
 *
 * Usage:
 *   node scripts/repair-council-sessions.mjs            # scan $DSH_HOME, report
 *   node scripts/repair-council-sessions.mjs --write    # repair in place
 *   node scripts/repair-council-sessions.mjs --write <session.jsonl.zstd ...>
 */

import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'

/** Event-type prefix this plugin should never have written. */
const PREFIX = 'tool-council/'

/** Start-of-frame magic for a zstd frame. */
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/**
 * Split a session log into its individual zstd frames.
 *
 * A frame boundary is a magic sequence that actually starts a decodable frame;
 * the same four bytes can occur inside compressed data, so a candidate that
 * fails to decode is folded into the previous frame instead of being trusted.
 * @param buf - the whole file.
 * @returns one decoded chunk per frame, with the byte range it came from.
 */
function decodeFrames(buf) {
  const candidates = []
  for (let at = buf.indexOf(MAGIC, 0); at !== -1; at = buf.indexOf(MAGIC, at + 4)) candidates.push(at)
  if (candidates.length === 0 || candidates[0] !== 0) {
    throw new Error('not a zstd frame stream')
  }
  const frames = []
  let start = 0
  for (let index = 1; index <= candidates.length; index += 1) {
    const end = index < candidates.length ? candidates[index] : buf.length
    try {
      frames.push({ text: zstdDecompressSync(buf.subarray(start, end)).toString('utf8') })
      start = end
    } catch {
      // `end` was a magic sequence inside compressed data, not a boundary:
      // keep `start` and try the next candidate as the frame's end.
    }
  }
  if (start !== buf.length) throw new Error('trailing bytes after the last decodable frame')
  return frames
}

/**
 * Add the ignorable marker to every `tool-council/*` record in one text chunk.
 * @param text - decoded frame text (whole JSON lines).
 * @returns the repaired text and how many records changed.
 */
function repairText(text) {
  const trailing = text.endsWith('\n')
  const lines = (trailing ? text.slice(0, -1) : text).split('\n')
  let touched = 0
  const repaired = lines.map((line) => {
    if (line === '') return line
    let event
    try {
      event = JSON.parse(line)
    } catch {
      return line
    }
    if (typeof event?.type !== 'string' || !event.type.startsWith(PREFIX)) return line
    if (event.ignorable === true) return line
    touched += 1
    // Field order is not significant: the reader validates the envelope by key.
    return JSON.stringify({ ...event, ignorable: true })
  })
  return { text: repaired.join('\n') + (trailing ? '\n' : ''), touched }
}

/**
 * Repair one session log.
 * @param file - path to `session.jsonl.zstd`.
 * @param write - whether to persist the repair.
 * @returns records changed, or -1 when the file could not be processed.
 */
function repairFile(file, write) {
  let frames
  try {
    frames = decodeFrames(readFileSync(file))
  } catch (error) {
    console.error(`  ! cannot read ${file}: ${String(error)}`)
    return -1
  }
  let touched = 0
  const encoded = frames.map((frame) => {
    const result = repairText(frame.text)
    touched += result.touched
    return result.touched === 0
      ? zstdCompressSync(Buffer.from(frame.text, 'utf8'))
      : zstdCompressSync(Buffer.from(result.text, 'utf8'))
  })
  if (touched > 0 && write) {
    copyFileSync(file, `${file}.bak`)
    writeFileSync(file, Buffer.concat(encoded))
  }
  return touched
}

/**
 * Every session log under a sessions root.
 * @param root - the `$DSH_HOME/sessions` directory.
 * @returns absolute paths of `session.jsonl.zstd` files.
 */
function findSessions(root) {
  const out = []
  let projects
  try {
    projects = readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const projectDir = join(root, project.name)
    for (const session of readdirSync(projectDir, { withFileTypes: true })) {
      if (!session.isDirectory()) continue
      const file = join(projectDir, session.name, 'session.jsonl.zstd')
      try {
        if (statSync(file).isFile()) out.push(file)
      } catch {
        // A session directory without a log is simply not one we repair.
      }
    }
  }
  return out
}

const args = process.argv.slice(2)
const write = args.includes('--write')
const explicit = args.filter(arg => arg !== '--write')
const home = process.env['DSH_HOME'] ?? join(homedir(), '.dsh')
const files = explicit.length > 0 ? explicit : findSessions(join(home, 'sessions'))

console.log(`${write ? 'Repairing' : 'Scanning'} ${files.length} session log(s)`)
let affected = 0
for (const file of files) {
  const touched = repairFile(file, write)
  if (touched > 0) {
    affected += 1
    console.log(`  ${write ? 'repaired' : 'would repair'} ${touched} record(s): ${file}`)
  }
}
console.log(affected === 0
  ? 'No session carries a tool-council/* record.'
  : `${affected} session(s) ${write ? 'repaired — originals kept as *.bak' : 'need --write to repair'}.`)
