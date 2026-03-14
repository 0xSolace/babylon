/**
 * @fileoverview Pattern → Priority mapping
 *
 * Converts active patterns to structured priority output.
 *
 * WHY PRIORITIES?
 * ---------------
 * Priorities are the main output of motivation — they answer:
 * "What matters most to the agent right now?"
 *
 * Each priority has:
 * - need: What the agent is oriented toward (e.g., "restore_security")
 * - intensity: How urgent this need is (0-1)
 * - drivers: Which state variables contribute to this need
 * - rationale: Optional explanation of WHY this matters
 *
 * HOW PATTERNS BECOME PRIORITIES:
 * -------------------------------
 * Each active pattern maps to a priority:
 *
 *   pattern "foundation_shaky"
 *   → priority { need: "restore_security", intensity: 0.8 }
 *
 * The frame filters and orders patterns, so priorities reflect both
 * raw state AND the interpretive lens.
 *
 * INTERNAL VS SITUATIONAL PRIORITIES:
 * -----------------------------------
 * Internal patterns (from homeostasis) create internal priorities:
 * - "restore_security" from foundation_shaky
 * - "seek_connection" from seeking_connection
 *
 * Situational patterns (from appraisals) create contextual priorities:
 * - "manage_resources_carefully" from financial_constraint
 * - "leverage_influence" from influence_position
 *
 * The LLM sees both, creating integrated decision-making context.
 */

import type { ActivePattern, MotivationPriority, PatternId } from '../types.ts';

/**
 * Mapping from pattern ID to priority need name.
 *
 * WHY NAMED NEEDS?
 * Pattern IDs are implementation details (e.g., "foundation_shaky").
 * Need names are action-oriented (e.g., "restore_security").
 * This makes priorities meaningful for decision-making.
 */
const patternToNeed: Record<PatternId, string> = {
  // Internal patterns (from homeostasis)
  survival_mode: 'address_survival_needs',
  foundation_shaky: 'restore_security',
  seeking_connection: 'seek_connection',
  recognition_hungry: 'gain_recognition',
  freedom_constrained: 'restore_autonomy',
  purpose_seeking: 'find_meaning',
  stable_foundation: 'maintain_stability',
  socially_resourced: 'leverage_connections',
  // Situational patterns (from appraisals) - Universal
  external_pressure: 'address_external_pressure',
  external_tailwind: 'capitalize_on_momentum',
  // Situational patterns (from appraisals) - Domain-specific
  financial_constraint: 'manage_resources_carefully',
  influence_position: 'leverage_influence',
  visibility_exposure: 'manage_reputation',
};

/**
 * Mapping from pattern ID to rationale.
 *
 * WHY RATIONALES?
 * Rationales explain WHY the priority exists. This helps:
 * 1. LLMs understand context for decision-making
 * 2. Users understand agent behavior
 * 3. Debugging motivation issues
 */
const patternRationale: Record<PatternId, string> = {
  // Internal patterns (from homeostasis)
  survival_mode:
    'Physiological needs are critical and require immediate attention',
  foundation_shaky: 'Security feels unstable, creating foundational concern',
  seeking_connection:
    'Social needs are unmet, ready to reach out for connection',
  recognition_hungry: 'Status needs attention, seeking recognition and respect',
  freedom_constrained: 'Autonomy is blocked, agency needs to be restored',
  purpose_seeking:
    'Looking for significance and meaning with stable foundation',
  stable_foundation: 'Foundation is solid, can pursue growth opportunities',
  socially_resourced:
    'Social capital is strong, relationships can be leveraged',
  // Situational patterns (from appraisals) - Universal
  external_pressure:
    'External circumstances are constraining options and demand attention',
  external_tailwind:
    'External circumstances are favorable, creating opportunity for bold action',
  // Situational patterns (from appraisals) - Domain-specific
  financial_constraint:
    'Financial situation limits risk-taking, resource-intensive actions should be avoided',
  influence_position:
    'Position of influence allows for decisive action and leverage',
  visibility_exposure:
    'Visibility situation requires careful reputation management',
};

/**
 * Convert active patterns to motivation priorities.
 */
export function patternsToPriorities(
  patterns: ActivePattern[]
): MotivationPriority[] {
  return patterns.map((pattern) => ({
    need: patternToNeed[pattern.id] || pattern.id,
    intensity: pattern.intensity,
    drivers: pattern.triggers,
    rationale: patternRationale[pattern.id],
  }));
}

/**
 * Check if a pattern represents a deficiency (need) vs. a positive state.
 *
 * WHY DISTINGUISH?
 * Deficiency patterns require action to resolve. Positive patterns
 * represent states to maintain or leverage. This distinction affects
 * how frames filter and prioritize patterns.
 */
export function isDeficiencyPattern(patternId: PatternId): boolean {
  const deficiencyPatterns: PatternId[] = [
    // Internal deficiencies
    'survival_mode',
    'foundation_shaky',
    'seeking_connection',
    'recognition_hungry',
    'freedom_constrained',
    'purpose_seeking',
    // Situational constraints (external pressure counts as deficiency)
    'external_pressure',
    'financial_constraint',
    'visibility_exposure',
  ];
  return deficiencyPatterns.includes(patternId);
}

/**
 * Check if a pattern represents a positive/resourced state.
 */
export function isPositivePattern(patternId: PatternId): boolean {
  const positivePatterns: PatternId[] = [
    // Internal positive states
    'stable_foundation',
    'socially_resourced',
    // Situational opportunities
    'external_tailwind',
    'influence_position',
  ];
  return positivePatterns.includes(patternId);
}
