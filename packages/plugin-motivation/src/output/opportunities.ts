/**
 * @fileoverview Pattern → Opportunity mapping
 *
 * Converts active patterns to opportunity output.
 * Opportunities represent what's possible right now.
 *
 * WHY OPPORTUNITIES?
 * ------------------
 * Priorities tell the agent what to pursue (needs to address).
 * Constraints tell the agent what to avoid (guardrails).
 * Opportunities tell the agent what's enabled (possibilities).
 *
 * This three-part structure provides complete decision context:
 * - PRIORITIES: "I want connection" (what I'm seeking)
 * - CONSTRAINTS: "But I'm risk-averse" (what limits me)
 * - OPPORTUNITIES: "I have social capital to leverage" (what's possible)
 *
 * Without opportunities, agents might not recognize when conditions
 * are favorable for action. "Everything looks fine" ≠ "I can act boldly."
 *
 * OPPORTUNITY STRUCTURE:
 * ----------------------
 * - type: Category of opportunity (e.g., "growth_available")
 * - because: What enables this (e.g., "security_stable")
 * - potential: Rough estimate of how significant (0-1)
 *
 * The "potential" field helps the LLM weigh opportunities against each other.
 *
 * INTERNAL VS SITUATIONAL OPPORTUNITIES:
 * --------------------------------------
 * Internal patterns (positive states) create internal opportunities:
 * - stable_foundation → growth_available: Foundation solid, can pursue growth
 * - socially_resourced → leverage_connections: Social capital to deploy
 *
 * Situational patterns create contextual opportunities:
 * - external_tailwind → momentum_available: Favorable conditions for bold action
 * - influence_position → leverage_influence: Position of strength to exploit
 *
 * WHY SITUATIONAL OPPORTUNITIES MATTER:
 * -------------------------------------
 * An agent with stable internal state might not realize external conditions
 * are favorable. The influence_position pattern tells the LLM: "You're in
 * a position of power — this is a good time for decisive action."
 *
 * Without situational opportunities, agents would miss windows of opportunity
 * created by favorable external circumstances.
 */

import { isSatisfiedDriveSignal } from '../signals/index.ts';
import type {
  ActivePattern,
  MotivationOpportunity,
  PatternId,
  SignalState,
} from '../types.ts';

/**
 * Opportunity definitions triggered by patterns.
 */
interface OpportunityDefinition {
  type: string;
  because: string;
  potential: number;
}

/**
 * Mapping from positive patterns to opportunities.
 *
 * WHY OPPORTUNITIES?
 * Opportunities represent what's enabled by current state.
 * They're positive guidance: "you could do X" rather than "don't do Y".
 * This helps agents identify actions that leverage their situation.
 *
 * WHY PARTIAL RECORD?
 * Not all patterns enable opportunities. Deficiency patterns like
 * survival_mode constrain — they don't enable.
 */
const patternOpportunities: Partial<
  Record<PatternId, OpportunityDefinition[]>
> = {
  // -----------------------------
  // Internal pattern opportunities
  // -----------------------------
  stable_foundation: [
    {
      type: 'growth_available',
      because: 'security_stable',
      potential: 0.7,
    },
    {
      type: 'exploration_possible',
      because: 'foundation_solid',
      potential: 0.6,
    },
  ],

  socially_resourced: [
    {
      type: 'leverage_connections',
      because: 'social_capital',
      potential: 0.6,
    },
    {
      type: 'collaborative_action',
      because: 'strong_relationships',
      potential: 0.5,
    },
  ],

  // -----------------------------
  // Situational pattern opportunities (from appraisals)
  //
  // WHY SITUATIONAL OPPORTUNITIES?
  // Favorable external circumstances create openings for bold action.
  // Strong influence enables leverage; good momentum supports growth.
  // -----------------------------
  external_tailwind: [
    {
      type: 'momentum_available',
      because: 'external_conditions_favorable',
      potential: 0.7,
    },
    {
      type: 'bold_action_enabled',
      because: 'circumstances_support_growth',
      potential: 0.6,
    },
  ],

  influence_position: [
    {
      type: 'leverage_influence',
      because: 'position_of_strength',
      potential: 0.8,
    },
    {
      type: 'decisive_action_available',
      because: 'influence_capital_high',
      potential: 0.7,
    },
  ],
};

/**
 * Generate opportunities from active patterns and signals.
 */
export function patternsToOpportunities(
  patterns: ActivePattern[],
  signals: SignalState
): MotivationOpportunity[] {
  const opportunities: MotivationOpportunity[] = [];
  const seenTypes = new Set<string>();

  // Pattern-based opportunities
  for (const pattern of patterns) {
    const patternOpportunityDefs = patternOpportunities[pattern.id];

    if (patternOpportunityDefs) {
      for (const def of patternOpportunityDefs) {
        if (!seenTypes.has(def.type)) {
          opportunities.push({
            type: def.type,
            because: def.because,
            potential: def.potential,
          });
          seenTypes.add(def.type);
        }
      }
    }
  }

  // Signal-based opportunities (state combinations that enable possibilities)

  // High security + low meaning = growth opportunity
  if (
    isSatisfiedDriveSignal(signals.drives.security) &&
    (signals.drives.meaning === 'low' ||
      signals.drives.meaning === 'critical') &&
    !seenTypes.has('purpose_exploration')
  ) {
    opportunities.push({
      type: 'purpose_exploration',
      because: 'stable_seeking_meaning',
      potential: 0.6,
    });
    seenTypes.add('purpose_exploration');
  }

  // High social + low status = recognition opportunity
  if (
    isSatisfiedDriveSignal(signals.drives.social) &&
    (signals.drives.status === 'low' || signals.drives.status === 'critical') &&
    !seenTypes.has('recognition_through_network')
  ) {
    opportunities.push({
      type: 'recognition_through_network',
      because: 'social_capital_for_status',
      potential: 0.5,
    });
    seenTypes.add('recognition_through_network');
  }

  // High autonomy = freedom to explore
  if (
    signals.drives.autonomy === 'abundant' &&
    !seenTypes.has('self_directed_action')
  ) {
    opportunities.push({
      type: 'self_directed_action',
      because: 'high_autonomy',
      potential: 0.7,
    });
    seenTypes.add('self_directed_action');
  }

  // Sort by potential (highest first)
  opportunities.sort((a, b) => b.potential - a.potential);

  return opportunities;
}
