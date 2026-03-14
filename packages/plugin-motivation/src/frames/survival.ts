/**
 * @fileoverview Survival Frame - Emergency Mode
 *
 * The Survival frame auto-activates when physiological distress is high.
 * It suppresses all non-immediate needs and maximizes constraints.
 * This is the agent's emergency mode.
 */

import { Defaults } from '../constants.ts';
import type {
  ActivePattern,
  MotivationConstraint,
  MotivationOpportunity,
  MotivationPriority,
  SignalState,
} from '../types.ts';
import type { Frame } from './types.ts';

/**
 * Survival Frame Implementation
 */
export const survivalFrame: Frame = {
  name: 'survival',

  description: 'Emergency mode - only immediate survival needs matter',

  perspective: `All that matters right now is immediate survival. 
    Everything else fades into the background. I need to address what's urgent 
    before I can think about anything else.`,

  filterPatterns(
    patterns: ActivePattern[],
    signals: SignalState
  ): ActivePattern[] {
    // Only allow survival-related patterns
    const survivalPatterns = patterns.filter(
      (p) => p.id === 'survival_mode' || p.id === 'foundation_shaky'
    );

    // If no survival patterns, return empty (shouldn't happen if frame activated correctly)
    return survivalPatterns.length > 0
      ? survivalPatterns
      : patterns.slice(0, 1);
  },

  generateNarrative(
    priorities: MotivationPriority[],
    constraints: MotivationConstraint[],
    opportunities: MotivationOpportunity[]
  ): string {
    const parts: string[] = [];

    parts.push('I am in survival mode.');

    const topPriority = priorities[0];
    if (topPriority) {
      const drivers = topPriority.drivers.join(', ');
      parts.push(`My ${drivers} needs immediate attention.`);
    }

    parts.push('Everything else must wait.');
    parts.push('I need to focus on what is most urgent right now.');

    return parts.join(' ');
  },

  shouldActivate(signals: SignalState): boolean {
    // Auto-activate when any physiological is critical
    return signals.physiologicalStress === 'critical';
  },
};
