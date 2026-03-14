/**
 * @fileoverview Type definitions for plugin-motivation
 *
 * Plugin-motivation interprets raw homeostasis state into actionable orientation.
 * It answers:
 * - "What matters most right now?" → Priorities
 * - "What limits acceptable action?" → Constraints
 * - "What possibilities exist?" → Opportunities
 *
 * This is an interpreter, not an executor. Light guide rails, not fixed algorithms.
 */

import type { UUID } from '@elizaos/core';

// Re-export appraisal types for convenience
export type {
  Appraisal,
  IAppraisalService,
} from './appraisal-types.ts';
export { APPRAISAL_SERVICE_TYPE } from './appraisal-types.ts';
// Re-export homeostasis types for convenience
export type {
  Drives,
  HomeostasisState,
  IHomeostasisService,
  Physiological,
  Resources,
} from './homeostasis-types.ts';

// =============================================================================
// SIGNAL TYPES (State → Categorical Buckets)
// =============================================================================

/**
 * Categorical signal levels for psychological drives.
 * Drives are 0-100 with 50 = balanced.
 */
export type DriveSignal =
  | 'critical'
  | 'low'
  | 'balanced'
  | 'satisfied'
  | 'abundant';

/**
 * Categorical signal levels for physiological state.
 * Physiological is 0-100 with 0 = satisfied, 100 = deprived.
 */
export type PhysiologicalSignal =
  | 'satisfied'
  | 'moderate'
  | 'high'
  | 'critical';

/**
 * Categorical signal levels for resources.
 */
export type ResourceSignal = 'low' | 'adequate' | 'abundant';

/**
 * Categorical signal levels for situational appraisals.
 *
 * WHY THESE LEVELS?
 * -----------------
 * Situational signals mirror the internal signal scale but are designed for
 * external circumstances rather than internal state:
 *
 * - `critical`: External situation demands immediate attention
 *   Example: Bank account nearly empty, reputation crisis
 *
 * - `strained`: External situation is concerning, limits options
 *   Example: Money tight, influence waning, reputation fragile
 *
 * - `stable`: External situation is neutral, no particular concern
 *   Example: Finances okay, power balanced, reputation intact
 *
 * - `favorable`: External situation is positive, enables action
 *   Example: Good financial runway, growing influence
 *
 * - `strong`: External situation is very favorable, enables bold action
 *   Example: Well-funded, position of power, excellent reputation
 *
 * WHY 5 LEVELS (same as internal)?
 * --------------------------------
 * Consistency with internal signals allows pattern definitions to use
 * similar logic for both internal and external factors. This makes the
 * system more predictable and easier to reason about.
 *
 * HOW PAYLOAD MAPS TO SIGNALS:
 * ----------------------------
 * Evaluator plugins use different vocabulary. We map common patterns:
 * - status: 'critical' | 'cautious' | 'stable' | 'secure'
 * - level: 'low' | 'moderate' | 'high'
 * - state: 'declining' | 'stable' | 'improving'
 *
 * The IndicatorMap in constants.ts defines the complete keyword mapping.
 */
export type SituationalSignal =
  | 'critical'
  | 'strained'
  | 'stable'
  | 'favorable'
  | 'strong';

/**
 * Complete signal state - categorical view of homeostasis and situational factors.
 */
export interface SignalState {
  // Psychological drive signals
  drives: {
    security: DriveSignal;
    social: DriveSignal;
    status: DriveSignal;
    autonomy: DriveSignal;
    meaning: DriveSignal;
  };

  // Physiological signals
  physiological: {
    hunger: PhysiologicalSignal;
    fatigue: PhysiologicalSignal;
    hydration: PhysiologicalSignal;
    health: PhysiologicalSignal;
  };

  // Overall physiological stress
  physiologicalStress: PhysiologicalSignal;

  // Resource signals (dynamic keys)
  resources: Record<string, ResourceSignal>;

  // Situational appraisal signals (dynamic keys by domain)
  // WHY SEPARATE FROM RESOURCES?
  // Resources are internal (what we have). Situational is external (what's happening).
  // A resource might be "low" while the situational appraisal of money might be "stable"
  // (we have little, but our financial situation is fine for now).
  situational: Record<string, SituationalSignal>;
}

// =============================================================================
// PATTERN TYPES
// =============================================================================

/**
 * Named patterns that emerge from signal combinations.
 * Patterns represent meaningful states, not just individual values.
 *
 * WHY PATTERNS?
 * -------------
 * Raw signals (security: 'low', social: 'balanced') don't tell a story.
 * Patterns recognize *meaningful combinations* that should influence behavior:
 *
 * - "social: low" alone might mean loneliness OR just preference for solitude
 * - "social: low + security: balanced" = safe enough to seek connection
 * - "social: low + security: low" = can't risk social exposure when unsafe
 *
 * Patterns encode this contextual meaning.
 *
 * INTERNAL PATTERNS (from homeostasis):
 * -------------------------------------
 * These capture internal psychological and physiological states:
 * - survival_mode through socially_resourced
 *
 * They're based on Maslow's hierarchy and self-determination theory.
 *
 * SITUATIONAL PATTERNS (from appraisals):
 * ---------------------------------------
 * These capture external circumstances that affect motivation:
 *
 * - **Universal patterns** work with ANY domain:
 *   - external_pressure: Something outside is constraining
 *   - external_tailwind: Something outside is favorable
 *
 * - **Specific patterns** fire for known domains with richer logic:
 *   - financial_constraint: Money strained + growth drive active
 *   - influence_position: Power strong + foundation stable
 *   - visibility_exposure: Notoriety strained + social/status drive
 *
 * WHY BOTH UNIVERSAL AND SPECIFIC?
 * --------------------------------
 * Universal patterns ensure we handle ANY domain (even unknown ones).
 * Specific patterns provide richer interpretation for common domains.
 *
 * Design rule: When a specific pattern fires, it suppresses the universal
 * pattern for that domain to avoid redundancy.
 */
export type PatternId =
  // -------------------------------------------------------------------------
  // Internal patterns (from homeostasis)
  // Based on Maslow's hierarchy: physiological → safety → belonging → esteem → self-actualization
  // -------------------------------------------------------------------------
  | 'survival_mode' // Any physiological critical — body needs dominate
  | 'foundation_shaky' // Security critical/low — safety is primary
  | 'seeking_connection' // Social low + security balanced — ready to reach out
  | 'recognition_hungry' // Status low + social balanced — want to be seen
  | 'freedom_constrained' // Autonomy low — agency blocked
  | 'purpose_seeking' // Meaning low + foundation stable — seeking significance
  | 'stable_foundation' // Security satisfied + physiological satisfied — can pursue growth
  | 'socially_resourced' // Social satisfied/abundant — have relational capital
  // -------------------------------------------------------------------------
  // Situational patterns (from appraisals) - Universal
  // These work with ANY domain — catch-all for unknown evaluators
  // -------------------------------------------------------------------------
  | 'external_pressure' // ANY domain strained/critical — something constrains
  | 'external_tailwind' // ANY domain favorable/strong + foundation stable — opportunity
  // -------------------------------------------------------------------------
  // Situational patterns (from appraisals) - Domain-specific
  // These fire for known domains with richer logic combining internal + external
  // -------------------------------------------------------------------------
  | 'financial_constraint' // money strained + growth drive active — can't afford risk
  | 'influence_position' // power strong + foundation stable — position of strength
  | 'visibility_exposure'; // notoriety strained + social/status drive — reputation at risk

/**
 * An active pattern with its trigger information.
 */
export interface ActivePattern {
  id: PatternId;
  triggers: string[]; // What signals triggered this pattern
  intensity: number; // 0-1, from signal buckets
}

// =============================================================================
// FRAME TYPES
// =============================================================================

/**
 * Interpretation frames - different lenses for viewing motivation.
 */
export type FrameType = 'maslow' | 'power' | 'notoriety' | 'survival';

/**
 * Frame definition - how a frame filters and interprets patterns.
 */
export interface Frame {
  name: FrameType;
  description: string;

  /**
   * Filter patterns based on this frame's worldview.
   * Returns patterns in priority order.
   */
  filterPatterns(
    patterns: ActivePattern[],
    signals: SignalState
  ): ActivePattern[];

  /**
   * Generate frame-specific narrative.
   */
  generateNarrative(
    priorities: MotivationPriority[],
    constraints: MotivationConstraint[],
    opportunities: MotivationOpportunity[]
  ): string;
}

// =============================================================================
// OUTPUT TYPES (The Contract)
// =============================================================================

/**
 * A prioritized need that matters right now.
 */
export interface MotivationPriority {
  /** The need being expressed, e.g., "restore_security" */
  need: string;

  /**
   * Intensity of the need (0-1).
   * From signal buckets: critical=0.9, low/high=0.6, moderate=0.3
   */
  intensity: number;

  /** Which state variables are driving this need */
  drivers: string[];

  /** Optional explanation of why this matters */
  rationale?: string;
}

/**
 * A constraint on acceptable action.
 */
export interface MotivationConstraint {
  /** Type of constraint, e.g., "risk_averse" */
  type: string;

  /** Why this constraint exists */
  because: string;

  /** What this means for action */
  guidance: string;
}

/**
 * An opportunity available right now.
 */
export interface MotivationOpportunity {
  /** Type of opportunity, e.g., "growth_available" */
  type: string;

  /** What enables this opportunity */
  because: string;

  /** Rough estimate of potential (0-1) */
  potential: number;
}

/**
 * Goal candidate - a suggestion for what might help.
 * (V3 feature - prepared for future implementation)
 */
export interface GoalCandidate {
  /** Suggested action */
  action: string;

  /** Why this would help */
  rationale: string;

  /** Which needs it would address */
  satisfies: string[];

  /** Suggested priority (0-1) */
  priority: number;

  /** Timeframe for the goal */
  timeframe: 'immediate' | 'short_term' | 'long_term';
}

/**
 * Complete motivation state - the output contract.
 */
export interface MotivationState {
  /** Prioritized needs */
  priorities: MotivationPriority[];

  /** Active constraints */
  constraints: MotivationConstraint[];

  /** Available opportunities */
  opportunities: MotivationOpportunity[];

  /** Which interpretation frame is active */
  dominantFrame: FrameType;

  /** Human-readable narrative for LLM context */
  narrative: string;

  /** Goal suggestions (V3) */
  goalCandidates?: GoalCandidate[];

  /** When this state was computed */
  timestamp: number;
}

// =============================================================================
// EVENT PAYLOAD TYPES
// =============================================================================

/**
 * Payload for MOTIVATION_UPDATED event.
 */
export interface MotivationUpdatedPayload {
  runtime: any;
  source: string;
  agentId: UUID;
  state: MotivationState;
  previousState?: MotivationState;
}

/**
 * Payload for MOTIVATION_PRIORITIES_CHANGED event.
 */
export interface PrioritiesChangedPayload {
  runtime: any;
  source: string;
  agentId: UUID;
  priorities: MotivationPriority[];
  previousPriorities: MotivationPriority[];
}

/**
 * Payload for MOTIVATION_CONSTRAINT_ACTIVATED event.
 */
export interface ConstraintActivatedPayload {
  runtime: any;
  source: string;
  agentId: UUID;
  constraint: MotivationConstraint;
}

/**
 * Payload for MOTIVATION_FRAME_SHIFTED event.
 */
export interface FrameShiftedPayload {
  runtime: any;
  source: string;
  agentId: UUID;
  newFrame: FrameType;
  previousFrame: FrameType;
  reason: string;
}

// =============================================================================
// RUNTIME CONTEXT (Optional Input)
// =============================================================================

/**
 * Optional runtime context that can influence motivation.
 * (V2 feature - prepared for future implementation)
 */
export interface RuntimeContext {
  /** Current task or activity */
  currentTask?: string;

  /** Environment description */
  environment?: string;

  /** Time pressure level */
  timePressure?: 'none' | 'low' | 'moderate' | 'high' | 'critical';

  /** Who's present */
  audience?: {
    present: string[];
    relationships?: Record<string, 'ally' | 'neutral' | 'rival' | 'unknown'>;
  };
}
