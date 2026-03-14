/**
 * @fileoverview Autonomous Integration - Helpers for plugin-autonomous
 *
 * This module provides helper functions for plugin-autonomous to consume
 * motivation state. It simplifies integration by providing typed access
 * and utility functions.
 *
 * ## Usage in plugin-autonomous
 *
 * ```typescript
 * import {
 *   getMotivationContext,
 *   shouldPrioritize,
 *   hasConstraint,
 *   getTopPriority,
 * } from '@elizaos/plugin-motivation/integration/autonomous';
 *
 * // In planning or response generation
 * const context = await getMotivationContext(runtime);
 * if (context && shouldPrioritize(context, 'social')) {
 *   // Boost social interactions
 * }
 * ```
 */

import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type {
  FrameType,
  MotivationConstraint,
  MotivationOpportunity,
  MotivationPriority,
  MotivationState,
} from '../types.ts';

/**
 * Motivation context for autonomous decision-making.
 */
export interface MotivationContext {
  /** Current frame (worldview) */
  frame: FrameType;

  /** Prioritized needs */
  priorities: MotivationPriority[];

  /** Active constraints */
  constraints: MotivationConstraint[];

  /** Available opportunities */
  opportunities: MotivationOpportunity[];

  /** Human-readable narrative */
  narrative: string;

  /** When computed */
  timestamp: number;

  /** Raw state for advanced use */
  raw: MotivationState;
}

/**
 * Get motivation context from the runtime.
 *
 * @param runtime - Agent runtime
 * @returns Motivation context or null if not available
 */
export async function getMotivationContext(
  runtime: IAgentRuntime
): Promise<MotivationContext | null> {
  // Try to get the motivation service directly
  const service = runtime.getService('motivation') as any;

  if (!service || typeof service.getState !== 'function') {
    return null;
  }

  const state = service.getState() as MotivationState;

  return {
    frame: state.dominantFrame,
    priorities: state.priorities,
    constraints: state.constraints,
    opportunities: state.opportunities,
    narrative: state.narrative,
    timestamp: state.timestamp,
    raw: state,
  };
}

/**
 * Get motivation context from composed state.
 * Use this when you already have state from composeState().
 *
 * @param state - State from composeState()
 * @returns Motivation context or null if not available
 */
export function getMotivationFromState(state: State): MotivationContext | null {
  const data = state?.data?.providers?.MOTIVATION?.data as
    | MotivationState
    | undefined;

  if (!data || !data.dominantFrame) {
    return null;
  }

  return {
    frame: data.dominantFrame,
    priorities: data.priorities || [],
    constraints: data.constraints || [],
    opportunities: data.opportunities || [],
    narrative: data.narrative || '',
    timestamp: data.timestamp || Date.now(),
    raw: data as MotivationState,
  };
}

/**
 * Check if a specific need type should be prioritized.
 *
 * @param context - Motivation context
 * @param needType - Type of need to check (e.g., 'social', 'security')
 * @param minIntensity - Minimum intensity to consider (default: 0.5)
 * @returns true if the need should be prioritized
 */
export function shouldPrioritize(
  context: MotivationContext,
  needType: string,
  minIntensity: number = 0.5
): boolean {
  return context.priorities.some(
    (p) =>
      p.need.toLowerCase().includes(needType.toLowerCase()) &&
      p.intensity >= minIntensity
  );
}

/**
 * Check if a specific constraint is active.
 *
 * @param context - Motivation context
 * @param constraintType - Type of constraint to check
 * @returns true if constraint is active
 */
export function hasConstraint(
  context: MotivationContext,
  constraintType: string
): boolean {
  return context.constraints.some((c) =>
    c.type.toLowerCase().includes(constraintType.toLowerCase())
  );
}

/**
 * Get the top priority, if any.
 *
 * @param context - Motivation context
 * @returns Top priority or null
 */
export function getTopPriority(
  context: MotivationContext
): MotivationPriority | null {
  return context.priorities[0] || null;
}

/**
 * Check if the agent is in a conservative/risk-averse state.
 *
 * @param context - Motivation context
 * @returns true if agent should be conservative
 */
export function isConservative(context: MotivationContext): boolean {
  // Check for explicit risk-averse constraint
  if (hasConstraint(context, 'risk_averse')) return true;
  if (hasConstraint(context, 'budget_conscious')) return true;
  if (hasConstraint(context, 'survival')) return true;

  // Check for survival-related priorities
  const top = getTopPriority(context);
  if (top && top.need.includes('survival') && top.intensity > 0.7) return true;
  if (top && top.need.includes('security') && top.intensity > 0.8) return true;

  // Survival frame is inherently conservative
  if (context.frame === 'survival') return true;

  return false;
}

/**
 * Check if an opportunity is available.
 *
 * @param context - Motivation context
 * @param opportunityType - Type of opportunity to check
 * @param minPotential - Minimum potential (default: 0.5)
 * @returns true if opportunity is available
 */
export function hasOpportunity(
  context: MotivationContext,
  opportunityType: string,
  minPotential: number = 0.5
): boolean {
  return context.opportunities.some(
    (o) =>
      o.type.toLowerCase().includes(opportunityType.toLowerCase()) &&
      o.potential >= minPotential
  );
}

/**
 * Get a relevance multiplier based on how well an action aligns with motivation.
 *
 * @param context - Motivation context
 * @param actionNeeds - What needs the action would satisfy
 * @returns Multiplier (0.5 to 2.0)
 */
export function getRelevanceMultiplier(
  context: MotivationContext,
  actionNeeds: string[]
): number {
  if (actionNeeds.length === 0) return 1.0;

  let multiplier = 1.0;

  // Check alignment with priorities
  for (const priority of context.priorities) {
    for (const need of actionNeeds) {
      if (priority.need.toLowerCase().includes(need.toLowerCase())) {
        // Higher intensity = higher boost
        multiplier += priority.intensity * 0.5;
      }
    }
  }

  // Check for constraint violations
  if (isConservative(context) && actionNeeds.includes('risk')) {
    multiplier *= 0.5;
  }

  // Cap at reasonable bounds
  return Math.max(0.5, Math.min(2.0, multiplier));
}

/**
 * Format motivation context for inclusion in an LLM prompt.
 *
 * @param context - Motivation context
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatForPrompt(
  context: MotivationContext,
  options: { brief?: boolean } = {}
): string {
  if (options.brief) {
    // Brief format for space-constrained prompts
    const top = getTopPriority(context);
    const constraintCount = context.constraints.length;

    let brief = `[Motivation: ${context.frame} frame`;
    if (top) {
      brief += `, focus: ${top.need} (${Math.round(top.intensity * 100)}%)`;
    }
    if (constraintCount > 0) {
      brief += `, ${constraintCount} constraint${constraintCount > 1 ? 's' : ''}`;
    }
    brief += ']';

    return brief;
  }

  // Full format (uses the narrative)
  return context.narrative;
}
