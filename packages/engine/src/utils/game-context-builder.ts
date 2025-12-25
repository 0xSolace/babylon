/**
 * Game Context Builder Stubs
 *
 * These functions were removed as unused exports.
 * If you need this functionality, import from context-builder.ts instead.
 */

import type { DbActorState } from '../types/common'

export interface RichGameContext {
  contextText: string
  activeActors: DbActorState[]
}

export function buildRichGameContext(): RichGameContext {
  return {
    contextText: '',
    activeActors: [],
  }
}

export function formatRichGameContext(context: RichGameContext): string {
  return context.contextText
}
