/**
 * Random Context Stubs
 *
 * These functions were removed as unused exports.
 * Minimal stubs provided to satisfy imports.
 */

export interface RandomMarketContext {
  marketName: string
  priceMovement: string
  gainers?: Array<{ name: string; change: number }>
  losers?: Array<{ name: string; change: number }>
  questions?: Array<{ question: string; probability: number }>
  posts?: Array<{ content: string }>
  events?: Array<{ name: string; description: string }>
}

export interface RandomContextOptions {
  includeGainers?: boolean
  includeLosers?: boolean
  includeQuestions?: boolean
  includePosts?: boolean
  includeEvents?: boolean
}

export function formatRandomContext(_context: RandomMarketContext): string {
  return ''
}

export async function generateRandomMarketContext(
  _options?: RandomContextOptions,
): Promise<RandomMarketContext> {
  return {
    marketName: '',
    priceMovement: '',
    gainers: [],
    losers: [],
    questions: [],
    posts: [],
    events: [],
  }
}
