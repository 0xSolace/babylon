/**
 * @fileoverview Pattern → Constraint mapping
 *
 * Converts active patterns to constraint output.
 * Constraints limit what actions are acceptable.
 *
 * WHY CONSTRAINTS?
 * ----------------
 * Priorities tell the agent what to pursue.
 * Constraints tell the agent what to avoid.
 *
 * Together, they provide:
 * - PRIORITIES: "Seek connection" (positive direction)
 * - CONSTRAINTS: "But avoid high-risk social situations" (guardrail)
 *
 * This prevents the agent from blindly pursuing priorities without
 * considering context that might make certain approaches harmful.
 *
 * CONSTRAINT STRUCTURE:
 * ---------------------
 * - type: Category of constraint (e.g., "risk_averse")
 * - because: What's causing this constraint (e.g., "security_unstable")
 * - guidance: What to do about it (e.g., "Avoid high-variance actions")
 *
 * The "guidance" field is what the LLM actually uses for decision-making.
 *
 * INTERNAL VS SITUATIONAL CONSTRAINTS:
 * ------------------------------------
 * Internal patterns create internal constraints:
 * - foundation_shaky → risk_averse: "Avoid high-variance actions"
 * - survival_mode → immediate_only: "Focus only on immediate survival"
 *
 * Situational patterns create contextual constraints:
 * - financial_constraint → budget_conscious: "Avoid resource-intensive actions"
 * - visibility_exposure → reputation_careful: "Consider perception implications"
 * - external_pressure → external_caution: "Exercise caution due to circumstances"
 *
 * WHY SITUATIONAL CONSTRAINTS MATTER:
 * -----------------------------------
 * An agent might have high status drive (wants recognition) but low money
 * (financial_constraint pattern). Without the constraint, the agent might
 * pursue expensive status-seeking behavior. With it, the LLM knows to find
 * low-cost ways to gain recognition.
 */

import type {
  ActivePattern,
  MotivationConstraint,
  PatternId,
} from '../types.ts';

/**
 * Constraint definitions triggered by patterns.
 */
interface ConstraintDefinition {
  type: string;
  because: string;
  guidance: string;
}

/**
 * Mapping from pattern to constraints it triggers.
 *
 * WHY CONSTRAINTS?
 * Constraints are "guardrails" that limit acceptable actions.
 * They're negative guidance: "don't do X" rather than "do Y".
 * This helps agents avoid actions that would worsen their situation.
 *
 * WHY PARTIAL RECORD?
 * Not all patterns generate constraints. Positive patterns like
 * stable_foundation don't constrain — they enable.
 */
const patternConstraints: Partial<Record<PatternId, ConstraintDefinition[]>> = {
  // -----------------------------
  // Internal pattern constraints
  // -----------------------------
  survival_mode: [
    {
      type: 'immediate_only',
      because: 'physiological_critical',
      guidance: 'Focus only on immediate survival needs',
    },
    {
      type: 'conserve_resources',
      because: 'survival_mode',
      guidance: 'Preserve energy and resources for essentials',
    },
  ],

  foundation_shaky: [
    {
      type: 'risk_averse',
      because: 'security_unstable',
      guidance: 'Avoid high-variance actions until stability returns',
    },
  ],

  freedom_constrained: [
    {
      type: 'agency_seeking',
      because: 'autonomy_low',
      guidance: 'Prioritize actions that restore choice and agency',
    },
  ],

  // -----------------------------
  // Situational pattern constraints (from appraisals)
  //
  // WHY SITUATIONAL CONSTRAINTS?
  // External circumstances can limit options just like internal state.
  // Low money constrains spending; high visibility constrains risk.
  // -----------------------------
  external_pressure: [
    {
      type: 'external_caution',
      because: 'external_situation_strained',
      guidance: 'Exercise caution due to unfavorable external circumstances',
    },
  ],

  financial_constraint: [
    {
      type: 'budget_conscious',
      because: 'financial_situation_strained',
      guidance: 'Avoid resource-intensive actions; preserve financial runway',
    },
  ],

  visibility_exposure: [
    {
      type: 'reputation_careful',
      because: 'visibility_at_risk',
      guidance: 'Consider perception implications of all public actions',
    },
  ],
};

/**
 * Generate constraints from active patterns.
 */
export function patternsToConstraints(
  patterns: ActivePattern[]
): MotivationConstraint[] {
  const constraints: MotivationConstraint[] = [];
  const seenTypes = new Set<string>();

  for (const pattern of patterns) {
    const patternConstraintDefs = patternConstraints[pattern.id];

    if (patternConstraintDefs) {
      for (const def of patternConstraintDefs) {
        // Avoid duplicate constraint types
        if (!seenTypes.has(def.type)) {
          constraints.push({
            type: def.type,
            because: def.because,
            guidance: def.guidance,
          });
          seenTypes.add(def.type);
        }
      }
    }
  }

  // Add intensity-based constraints
  const highIntensityPatterns = patterns.filter((p) => p.intensity >= 0.8);
  if (highIntensityPatterns.length > 0 && !seenTypes.has('high_urgency')) {
    constraints.push({
      type: 'high_urgency',
      because: 'high_intensity_needs',
      guidance: 'Address urgent needs before pursuing other goals',
    });
  }

  return constraints;
}
