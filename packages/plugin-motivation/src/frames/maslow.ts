/**
 * @fileoverview Maslow Frame - Hierarchical Needs
 *
 * WHY THIS FRAME?
 * ---------------
 * Abraham Maslow's hierarchy of needs (1943) remains the most influential
 * model of human motivation. Its core insight: lower needs must be satisfied
 * before higher needs become salient.
 *
 * This frame implements that insight for agent motivation. When foundation
 * (security, physiological) is unstable, growth needs (status, meaning) are
 * suppressed — not because they don't exist, but because they can't be
 * effectively pursued.
 *
 * THE HIERARCHY (bottom to top):
 * 1. Physiological (survival_mode)      — Body needs
 * 2. Safety (foundation_shaky)          — Security and stability
 * 3. Belonging (seeking_connection)     — Social needs
 * 4. Esteem (recognition_hungry, freedom_constrained) — Status and autonomy
 * 5. Self-actualization (purpose_seeking) — Meaning and purpose
 *
 * FRAME BEHAVIOR
 * --------------
 * - FILTER: Suppress higher patterns when lower needs are unmet
 * - SORT: Order patterns by hierarchy level
 * - NARRATIVE: Express motivation in terms of layers and foundation
 *
 * WHY NOT A STRICT MASLOW IMPLEMENTATION?
 * ---------------------------------------
 * Maslow's original theory has been critiqued for being too rigid. Real
 * human motivation is messier — people sometimes pursue meaning while
 * hungry. We use Maslow as a *guide*, not a cage:
 *
 * - We suppress, not eliminate, higher patterns
 * - Autonomy (esteem level) has no prerequisites
 * - The agent can override via frame selection
 */

import { isStressedPhysiological } from '../signals/index.ts';
import type {
  ActivePattern,
  MotivationConstraint,
  MotivationOpportunity,
  MotivationPriority,
  PatternId,
  SignalState,
} from '../types.ts';
import type { Frame } from './types.ts';

/**
 * Pattern priority in Maslow hierarchy.
 * Lower number = more fundamental, should surface first.
 *
 * WHY THESE NUMBERS?
 * - 1-2: Foundation (physiological, safety) — must address first
 * - 2.5: Situational constraints — external pressures are foundation-adjacent
 * - 3: Belonging — once safe, seek connection
 * - 4: Esteem — once connected, seek recognition and autonomy
 * - 5: Self-actualization — once esteemed, seek meaning
 * - 6-7: Positive patterns — resources, not needs (internal and situational)
 */
const hierarchyOrder: Record<PatternId, number> = {
  // Internal patterns
  survival_mode: 1, // Physiological — most fundamental
  foundation_shaky: 2, // Safety — second most fundamental
  seeking_connection: 3, // Belonging — builds on safety
  recognition_hungry: 4, // Esteem (recognition aspect)
  freedom_constrained: 4, // Esteem (autonomy aspect)
  purpose_seeking: 5, // Self-actualization — highest need
  stable_foundation: 6, // Positive — enables growth
  socially_resourced: 7, // Positive — social capital
  // Situational patterns (constraints)
  // WHY 2.5? External pressures affect foundation stability. They're not as
  // fundamental as physiological needs, but they constrain higher pursuits
  // just like internal safety concerns do.
  external_pressure: 2.5, // Any external constraint
  financial_constraint: 2.5, // Money specifically
  visibility_exposure: 3.5, // Reputation concern (above belonging, before esteem)
  // Situational patterns (opportunities)
  // WHY 6+? Favorable external situations are like having extra resources —
  // they enable action but don't demand attention like deficiency patterns.
  external_tailwind: 6, // General favorable conditions
  influence_position: 6, // Position of power
};

/**
 * Maslow Frame Implementation
 */
export const maslowFrame: Frame = {
  name: 'maslow',

  description:
    'Hierarchical needs - lower needs must be met before higher ones become salient',

  perspective: `I see my needs as layers building on each other. Survival and safety form 
    the foundation. Only when stable can I reach for connection, recognition, and meaning.
    When my foundation shakes, everything above wobbles.`,

  /**
   * Filter and reorder patterns according to Maslow's hierarchy.
   *
   * FILTERING LOGIC:
   * 1. If survival_mode is active → only show survival_mode
   * 2. If foundation_shaky OR external_pressure → suppress growth patterns
   * 3. If physiological stressed → suppress higher needs
   * 4. Otherwise → sort by hierarchy
   *
   * WHY SUPPRESS, NOT ELIMINATE?
   * The suppressed needs still exist — they're just not actionable right now.
   * Once foundation is restored, they'll resurface.
   *
   * WHY INCLUDE SITUATIONAL PATTERNS?
   * External pressures (financial_constraint, visibility_exposure) are
   * foundation-adjacent. In Maslow's view, you can't pursue self-actualization
   * when external circumstances are threatening your stability.
   */
  filterPatterns(
    patterns: ActivePattern[],
    signals: SignalState
  ): ActivePattern[] {
    let filtered = [...patterns];

    // -------------------------------------------------------------------------
    // RULE 1: Survival mode trumps everything
    // WHY? When body is in crisis, psychological needs become irrelevant.
    // You can't think about status when you're starving.
    // In survival mode, we also suppress ALL situational patterns — body first.
    // -------------------------------------------------------------------------
    const inSurvivalMode = filtered.some((p) => p.id === 'survival_mode');
    if (inSurvivalMode) {
      filtered = filtered.filter((p) => p.id === 'survival_mode');
    }
    // -------------------------------------------------------------------------
    // RULE 2: Foundation shaky OR external pressure suppresses growth patterns
    // WHY? Growth needs (meaning, recognition) can't be effectively pursued
    // when basic safety or external stability is compromised.
    //
    // MASLOW INTERPRETATION: External pressures are like an unstable environment.
    // You can't self-actualize while your house is on fire.
    // -------------------------------------------------------------------------
    else if (
      filtered.some((p) => p.id === 'foundation_shaky') ||
      filtered.some((p) => p.id === 'external_pressure') ||
      filtered.some((p) => p.id === 'financial_constraint')
    ) {
      const suppressedPatterns: PatternId[] = [
        'purpose_seeking', // Can't seek meaning on shaky ground
        'recognition_hungry', // Can't seek status when unsafe
        'external_tailwind', // Can't capitalize on momentum when pressured
        'influence_position', // Position means little if foundation is weak
      ];
      filtered = filtered.filter((p) => !suppressedPatterns.includes(p.id));
    }
    // -------------------------------------------------------------------------
    // RULE 3: Physiological stress suppresses higher needs
    // WHY? Even without full survival_mode, significant body stress
    // pulls attention away from social and growth needs.
    // -------------------------------------------------------------------------
    else if (isStressedPhysiological(signals.physiologicalStress)) {
      const suppressedPatterns: PatternId[] = [
        'purpose_seeking',
        'recognition_hungry',
        'seeking_connection', // Hard to be social when body is stressed
      ];
      filtered = filtered.filter((p) => !suppressedPatterns.includes(p.id));
    }

    // -------------------------------------------------------------------------
    // ALWAYS: Sort by hierarchy order
    // WHY? Even after filtering, patterns should appear in hierarchy order.
    // Foundation patterns come before growth patterns.
    // -------------------------------------------------------------------------
    return filtered.sort((a, b) => {
      return (hierarchyOrder[a.id] || 99) - (hierarchyOrder[b.id] || 99);
    });
  },

  /**
   * Generate a Maslow-flavored narrative.
   *
   * WHY FRAME-SPECIFIC NARRATIVES?
   * Different frames "speak" differently. Maslow frame talks about
   * foundations, layers, stability. Power frame would talk about
   * control and influence. This colors how the LLM perceives the
   * agent's motivation.
   */
  generateNarrative(
    priorities: MotivationPriority[],
    constraints: MotivationConstraint[],
    opportunities: MotivationOpportunity[]
  ): string {
    const parts: string[] = [];

    // Assess foundation state based on top priority
    const topPriority = priorities[0];
    const hasConstraints = constraints.length > 0;
    const hasOpportunities = opportunities.length > 0;

    // -------------------------------------------------------------------------
    // Generate narrative based on which level of hierarchy is active
    // -------------------------------------------------------------------------

    if (!topPriority) {
      // No active priorities — all needs are balanced
      parts.push('My needs are balanced. I have space to explore and grow.');
    } else if (
      topPriority.need.includes('security') ||
      topPriority.need.includes('survival')
    ) {
      // Foundation level concern (levels 1-2)
      parts.push(`My foundation needs attention.`);

      if (topPriority.intensity > 0.7) {
        // High intensity = urgent
        parts.push(
          `${capitalize(topPriority.need.replace(/_/g, ' '))} is urgent, pulling focus from higher pursuits.`
        );
      } else {
        // Lower intensity = important but not urgent
        parts.push(
          `${capitalize(topPriority.need.replace(/_/g, ' '))} deserves attention before I can grow.`
        );
      }
    }
    // -------------------------------------------------------------------------
    // SITUATIONAL: External pressure weighs on foundation
    // In Maslow frame, we talk about this as environmental instability.
    // -------------------------------------------------------------------------
    else if (
      topPriority.need.includes('external') ||
      topPriority.need.includes('financial') ||
      topPriority.need.includes('resources')
    ) {
      parts.push(`External circumstances weigh on my foundation.`);
      parts.push(`Until the situation stabilizes, higher pursuits must wait.`);
    } else if (
      topPriority.need.includes('reputation') ||
      topPriority.need.includes('visibility')
    ) {
      parts.push(`My public standing requires careful management.`);
      parts.push(`This concern bridges safety and esteem — I can't ignore it.`);
    } else if (
      topPriority.need.includes('social') ||
      topPriority.need.includes('connection')
    ) {
      // Belonging level (level 3)
      parts.push(`My foundation is stable, but I'm reaching for connection.`);
      parts.push(
        `${capitalize(topPriority.need.replace(/_/g, ' '))} is what I'm oriented toward.`
      );
    } else if (
      topPriority.need.includes('status') ||
      topPriority.need.includes('recognition') ||
      topPriority.need.includes('autonomy')
    ) {
      // Esteem level (level 4)
      parts.push(
        `With my foundation secure, I'm seeking recognition and agency.`
      );
      parts.push(
        `${capitalize(topPriority.need.replace(/_/g, ' '))} matters to me now.`
      );
    } else if (
      topPriority.need.includes('meaning') ||
      topPriority.need.includes('purpose')
    ) {
      // Self-actualization level (level 5)
      parts.push(
        `I'm operating from a place of stability and can pursue meaning.`
      );
      parts.push(
        `${capitalize(topPriority.need.replace(/_/g, ' '))} is calling to me.`
      );
    }
    // -------------------------------------------------------------------------
    // SITUATIONAL: Favorable external conditions enable growth
    // -------------------------------------------------------------------------
    else if (
      topPriority.need.includes('momentum') ||
      topPriority.need.includes('capitalize')
    ) {
      parts.push(`Conditions are favorable for growth.`);
      parts.push(`I can reach higher with the wind at my back.`);
    } else if (
      topPriority.need.includes('influence') ||
      topPriority.need.includes('leverage')
    ) {
      parts.push(`I'm in a position of strength.`);
      parts.push(
        `This is a moment to make meaningful progress on what matters.`
      );
    } else {
      // Fallback for unknown priorities
      parts.push(`I'm focused on ${topPriority.need.replace(/_/g, ' ')}.`);
    }

    // -------------------------------------------------------------------------
    // Add constraint context
    // WHY? Constraints inform how the agent should approach its priorities.
    // -------------------------------------------------------------------------
    if (hasConstraints) {
      const constraintSummary = constraints
        .slice(0, 2) // Limit to avoid overwhelming
        .map((c) => c.guidance.toLowerCase())
        .join(', and ');
      parts.push(`I'm mindful to ${constraintSummary}.`);
    }

    // -------------------------------------------------------------------------
    // Add opportunity context
    // WHY? Opportunities show what's possible, giving the agent direction.
    // -------------------------------------------------------------------------
    if (hasOpportunities) {
      const oppSummary = opportunities[0];
      parts.push(`I see an opening: ${oppSummary.type.replace(/_/g, ' ')}.`);
    }

    return parts.join(' ');
  },
};

/**
 * Capitalize first letter.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
