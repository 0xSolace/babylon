/**
 * Game Context Builder
 *
 * Builds rich game context for NPC interactions.
 * This is a stub - the actual implementation was removed.
 */

import type { DbActorState } from '../types/common'

export interface BuildContextOptions {
  includeEventHistory?: boolean
  includeFeedHistory?: boolean
  maxEvents?: number
  maxPosts?: number
}

export interface FormatOptions {
  includeEventTimeline?: boolean
  includeFeedHistory?: boolean
  includeResolvedQuestions?: boolean
  includeNarrativeThreads?: boolean
}

export interface RichGameContext {
  contextText: string
  activeActors: DbActorState[]
  events: unknown[]
  posts: unknown[]
}

/**
 * Build rich game context from game state
 */
export async function buildRichGameContext(
  _currentDay: number,
  _gameId: string | undefined,
  _options?: BuildContextOptions,
): Promise<RichGameContext> {
  return {
    contextText: '',
    activeActors: [],
    events: [],
    posts: [],
  }
}

/**
 * Format rich game context as string
 */
export function formatRichGameContext(
  context: RichGameContext,
  _options?: FormatOptions,
): string {
  return context.contextText
}
