/**
 * @fileoverview Goals Integration
 *
 * Utilities for connecting motivation priorities and opportunities to the
 * goals system (plugin-goals).
 *
 * ## Why This Exists
 *
 * Motivation generates priorities and opportunities. These are transient
 * interpretations of the current state. Goals are persistent objectives
 * that the agent actively pursues.
 *
 * This integration bridges the gap:
 * - Convert urgent priorities into goal candidates
 * - Generate goals from detected opportunities
 * - Suggest goal updates based on changing priorities
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────┐
 * │   Motivation    │
 * │                 │
 * │  - Priorities   │──────────┐
 * │  - Constraints  │          │
 * │  - Opportunities│──────────┼──▶ Goal Candidates
 * └─────────────────┘          │
 *                              │
 * ┌─────────────────┐          │
 * │  GoalDataService│◀─────────┘
 * │  (plugin-goals) │
 * │                 │
 * │  - createGoal() │
 * │  - updateGoal() │
 * └─────────────────┘
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { generateGoalCandidates, convertPriorityToGoal } from '@elizaos/plugin-motivation';
 *
 * // Generate goal candidates from current motivation state
 * const candidates = generateGoalCandidates(motivationState);
 *
 * // Convert a specific priority to a goal
 * const goalParams = convertPriorityToGoal(priority, agentId);
 * await goalService.createGoal(goalParams);
 * ```
 */

import type { UUID } from '@elizaos/core';
import type {
  MotivationConstraint,
  MotivationOpportunity,
  MotivationPriority,
  MotivationState,
} from '../types.ts';

/**
 * Goal candidate - a potential goal derived from motivation.
 * Not yet a goal, but ready to be created via plugin-goals.
 */
export interface GoalCandidate {
  /** Suggested goal name */
  name: string;
  /** Suggested description */
  description: string;
  /** Source of this candidate */
  source: 'priority' | 'opportunity' | 'constraint';
  /** Reference to the source need/type */
  sourceId: string;
  /** Suggested priority (1-5, 1=highest) */
  suggestedPriority: number;
  /** Suggested goal type */
  suggestedType: 'objective' | 'milestone' | 'action';
  /** Relevance score (0-1) */
  relevance: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Goal creation parameters compatible with plugin-goals.
 */
export interface GoalCreationParams {
  agentId: UUID;
  ownerType: 'agent' | 'entity';
  ownerId: UUID;
  name: string;
  description?: string;
  parentId?: UUID;
  goalType: 'objective' | 'milestone' | 'action';
  priority: number;
  metadata: Record<string, unknown>;
  tags: string[];
}

/**
 * Generate goal candidates from current motivation state.
 * Returns candidates sorted by relevance (highest first).
 *
 * @param state - Current motivation state
 * @param options - Generation options
 * @returns Array of goal candidates
 */
export function generateGoalCandidates(
  state: MotivationState,
  options?: {
    /** Minimum intensity to consider (0-1, default: 0.4) */
    minIntensity?: number;
    /** Maximum candidates to return (default: 5) */
    maxCandidates?: number;
    /** Include opportunity-based candidates (default: true) */
    includeOpportunities?: boolean;
    /** Include constraint-avoidance goals (default: false) */
    includeConstraintGoals?: boolean;
  }
): GoalCandidate[] {
  const candidates: GoalCandidate[] = [];
  const minIntensity = options?.minIntensity ?? 0.4;
  const maxCandidates = options?.maxCandidates ?? 5;

  // Convert priorities to candidates
  for (const priority of state.priorities) {
    if (priority.intensity >= minIntensity) {
      candidates.push(priorityToCandidate(priority));
    }
  }

  // Convert opportunities to candidates
  if (options?.includeOpportunities !== false) {
    for (const opportunity of state.opportunities) {
      if (opportunity.potential >= 0.5) {
        candidates.push(opportunityToCandidate(opportunity));
      }
    }
  }

  // Convert constraints to avoidance goals
  if (options?.includeConstraintGoals) {
    for (const constraint of state.constraints) {
      candidates.push(constraintToCandidate(constraint));
    }
  }

  // Sort by relevance and limit
  return candidates
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxCandidates);
}

/**
 * Convert a motivation priority to goal creation parameters.
 *
 * @param priority - The motivation priority
 * @param agentId - Agent UUID
 * @param parentId - Optional parent goal ID
 * @returns Goal creation parameters for plugin-goals
 */
export function convertPriorityToGoal(
  priority: MotivationPriority,
  agentId: UUID,
  parentId?: UUID
): GoalCreationParams {
  return {
    agentId,
    ownerType: 'agent',
    ownerId: agentId,
    name: priorityToGoalName(priority),
    description: priority.rationale || `Address ${priority.need}`,
    parentId,
    goalType: priorityToGoalType(priority.intensity),
    priority: intensityToPriority(priority.intensity),
    metadata: {
      source: 'motivation',
      sourceType: 'priority',
      sourceNeed: priority.need,
      intensity: priority.intensity,
      drivers: priority.drivers,
      createdFrom: 'motivation-integration',
    },
    tags: ['motivation', 'priority', ...priority.drivers.slice(0, 3)],
  };
}

/**
 * Convert a motivation opportunity to goal creation parameters.
 *
 * @param opportunity - The motivation opportunity
 * @param agentId - Agent UUID
 * @param parentId - Optional parent goal ID
 * @returns Goal creation parameters for plugin-goals
 */
export function convertOpportunityToGoal(
  opportunity: MotivationOpportunity,
  agentId: UUID,
  parentId?: UUID
): GoalCreationParams {
  return {
    agentId,
    ownerType: 'agent',
    ownerId: agentId,
    name: `Pursue: ${opportunity.type}`,
    description: opportunity.because,
    parentId,
    goalType: 'action',
    priority: Math.round(5 - opportunity.potential * 4), // High potential = high priority
    metadata: {
      source: 'motivation',
      sourceType: 'opportunity',
      opportunityType: opportunity.type,
      potential: opportunity.potential,
      createdFrom: 'motivation-integration',
    },
    tags: ['motivation', 'opportunity', opportunity.type],
  };
}

/**
 * Check if a goal should be updated based on changing motivation state.
 *
 * @param goalMetadata - Existing goal's metadata
 * @param currentState - Current motivation state
 * @returns Update suggestion or null if no update needed
 */
export function suggestGoalUpdate(
  goalMetadata: Record<string, unknown>,
  currentState: MotivationState
): {
  action: 'deprioritize' | 'prioritize' | 'complete' | 'cancel';
  reason: string;
} | null {
  const sourceType = goalMetadata.sourceType as string;
  const sourceNeed = goalMetadata.sourceNeed as string;
  const opportunityType = goalMetadata.opportunityType as string;

  if (!sourceType) {
    return null;
  }

  if (sourceType === 'priority') {
    // Check if the source priority still exists and is still urgent
    const priority = currentState.priorities.find((p) => p.need === sourceNeed);
    if (!priority) {
      return {
        action: 'deprioritize',
        reason: 'Source priority no longer active',
      };
    }
    if (priority.intensity < 0.3) {
      return {
        action: 'deprioritize',
        reason: 'Source priority intensity reduced',
      };
    }
  }

  if (sourceType === 'opportunity') {
    // Check if the opportunity is still relevant
    const opportunity = currentState.opportunities.find(
      (o) => o.type === opportunityType
    );
    if (!opportunity) {
      return {
        action: 'cancel',
        reason: 'Opportunity no longer available',
      };
    }
    if (opportunity.potential < 0.3) {
      return {
        action: 'deprioritize',
        reason: 'Opportunity potential decreased',
      };
    }
  }

  return null;
}

// =============================================================================
// Helper Functions
// =============================================================================

function intensityToPriority(intensity: number): number {
  // Convert 0-1 intensity to 1-5 priority (1=highest)
  if (intensity >= 0.8) return 1;
  if (intensity >= 0.6) return 2;
  if (intensity >= 0.4) return 3;
  if (intensity >= 0.2) return 4;
  return 5;
}

function priorityToCandidate(priority: MotivationPriority): GoalCandidate {
  return {
    name: priorityToGoalName(priority),
    description: priority.rationale || `Address ${priority.need}`,
    source: 'priority',
    sourceId: priority.need,
    suggestedPriority: intensityToPriority(priority.intensity),
    suggestedType: priorityToGoalType(priority.intensity),
    relevance: priority.intensity,
    metadata: {
      need: priority.need,
      drivers: priority.drivers,
      intensity: priority.intensity,
    },
  };
}

function opportunityToCandidate(
  opportunity: MotivationOpportunity
): GoalCandidate {
  return {
    name: `Pursue: ${opportunity.type}`,
    description: opportunity.because,
    source: 'opportunity',
    sourceId: opportunity.type,
    suggestedPriority: Math.round(5 - opportunity.potential * 4),
    suggestedType: 'action',
    relevance: opportunity.potential,
    metadata: {
      type: opportunity.type,
      potential: opportunity.potential,
    },
  };
}

function constraintToCandidate(
  constraint: MotivationConstraint
): GoalCandidate {
  return {
    name: `Avoid: ${constraint.type}`,
    description: `${constraint.because}. ${constraint.guidance}`,
    source: 'constraint',
    sourceId: constraint.type,
    suggestedPriority: 2, // Constraints are usually important
    suggestedType: 'objective',
    relevance: 0.7,
    metadata: {
      type: constraint.type,
      guidance: constraint.guidance,
    },
  };
}

function priorityToGoalName(priority: MotivationPriority): string {
  // Generate a readable goal name from the need
  const need = priority.need;
  // Convert snake_case to Title Case
  return need
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function priorityToGoalType(
  intensity: number
): 'objective' | 'milestone' | 'action' {
  // High intensity priorities become immediate actions
  if (intensity >= 0.8) return 'action';
  // Medium priorities become milestones (trackable progress)
  if (intensity >= 0.5) return 'milestone';
  // Lower ones become objectives (longer-term)
  return 'objective';
}
