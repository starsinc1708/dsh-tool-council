/**
 * Conversation node definition folding one council run's `tool-council/*`
 * records into a single `council-log` Chat node: the topology it started with,
 * its phase transitions and narration lines, and — once it settles — its
 * durable outcome (the verdict rows and the written report).
 *
 * That last part is what lets the Council tab reopen a finished run instead of
 * showing only the member graph: the tool result lives in the parent model's
 * context, not in the UI's.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import type { CouncilLayerRecord, CouncilResultRecord } from '@starsinc1708/dsh-tool-council/types'

/** One narration line with the wall clock it was emitted at. */
export interface CouncilLogLine {
  readonly text: string
  readonly at: number
}

/** One phase transition with the wall clock it happened at. */
export interface CouncilPhaseMark {
  readonly title: string
  readonly at: number
}

/** The node payload the graph view reads. */
export interface CouncilLogData {
  readonly name: string
  readonly preset: string
  /** Truncated first line of the task — what tells two runs apart in a list. */
  readonly task: string
  readonly startedAt: number
  readonly layers: readonly CouncilLayerRecord[]
  readonly phases: readonly CouncilPhaseMark[]
  readonly messages: readonly CouncilLogLine[]
  /** The settled outcome, or null while the run is still going. */
  readonly result: CouncilResultRecord | null
}

/** State folded from one council run's `tool-council/*` events. */
type CouncilLogState = CouncilLogData

const COUNCIL_EVENTS = new Set([
  'tool-council/run-start', 'tool-council/phase', 'tool-council/log', 'tool-council/result',
])

/** Fold the whole `tool-council/*` family into one node per run. */
export const councilLogDefinition: ConversationNodeDefinition<CouncilLogState> = {
  kind: 'council-log',
  target: 'chat',
  match(event) {
    if (!COUNCIL_EVENTS.has(event.type)) return null
    const id = String((event.data as { runId: string }).runId)
    return { id, role: event.type === 'tool-council/run-start' ? 'start' : 'update' }
  },
  start(context, match) {
    const data = match.event.data as {
      name: string
      preset?: string
      task?: string
      startedAt?: number
      layers?: readonly CouncilLayerRecord[]
    }
    return {
      name: data.name,
      preset: data.preset ?? '',
      task: data.task ?? '',
      startedAt: data.startedAt ?? 0,
      layers: data.layers ?? [],
      phases: [],
      messages: [],
      result: null,
    }
  },
  update(context, match) {
    const state = context.state
    if (match.event.type === 'tool-council/phase') {
      const { title, at } = match.event.data as { title: string; at?: number }
      return { ...state, phases: [...state.phases, { title, at: at ?? 0 }] }
    }
    if (match.event.type === 'tool-council/result') {
      const { result } = match.event.data as { result: CouncilResultRecord }
      return { ...state, result }
    }
    const { message, at } = match.event.data as { message: string; at?: number }
    return { ...state, messages: [...state.messages, { text: message, at: at ?? 0 }] }
  },
  buildViewNode(context) {
    if (context.start === undefined || context.state === undefined) return null
    return {
      key: context.key,
      kind: 'council-log',
      id: context.id,
      target: 'chat',
      anchorSeq: context.start.event.seq,
      location: context.start.location,
      visibility: 'visible',
      data: context.state satisfies CouncilLogData,
    }
  },
}
