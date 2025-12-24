/**
 * Plugin Experience
 *
 * Provides evaluators for agent experience and learning.
 */

import type { Plugin } from '@elizaos/core'
import { marketOutcomeEvaluator } from './evaluators/marketOutcomeEvaluator'

export { marketOutcomeEvaluator }

/**
 * Experience plugin for ElizaOS
 *
 * Provides evaluators for agent experience tracking and learning from market outcomes.
 */
export const experiencePlugin: Plugin = {
  name: 'experience',
  description: 'Agent experience tracking and learning plugin',
  actions: [],
  providers: [],
  evaluators: [marketOutcomeEvaluator],
  services: [],
}
