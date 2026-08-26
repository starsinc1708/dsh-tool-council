/**
 * Conversation node definition folding the council's narration lines into one
 * `council-log` Chat node per run, so the graph view can show intermediate
 * findings counts live.
 *
 * @module @deepseek-ai/dsh-client-ui-council
 */

import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'

/** State folded from one council run's `tool-council/*` events. */
interface CouncilLogState {
  readonly name: string
  readonly messages: readonly string[]
}

/** The node payload the graph view reads. */
export interface CouncilLogData {
  readonly name: string
  readonly messages: readonly string[]
}

/** Fold `tool-council/run-start` + `tool-council/log` into one node per run. */
export const councilLogDefinition: ConversationNodeDefinition<CouncilLogState> = {
  kind: 'council-log',
  target: 'chat',
  match(event) {
    if (event.type === 'tool-council/run-start') {
      return { id: String((event.data as { runId: string }).runId), role: 'start' }
    }
    if (event.type === 'tool-council/log') {
      return { id: String((event.data as { runId: string }).runId), role: 'update' }
    }
    return null
  },
  start(context, match) {
    const { name } = match.event.data as { name: string }
    return { name, messages: [] }
  },
  update(context, match) {
    const { message } = match.event.data as { message: string }
    return { name: context.state.name, messages: [...context.state.messages, message] }
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
      data: { name: context.state.name, messages: context.state.messages },
    }
  },
}
