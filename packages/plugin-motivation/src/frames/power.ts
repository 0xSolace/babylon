/**
 * @fileoverview Power Frame - Control and Influence
 *
 * The Power frame sees everything through the lens of control and influence.
 * Status and autonomy are primary concerns.
 * Security is about control, social is about alliances.
 */

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
 * Pattern priority in Power frame.
 * Control-related patterns surface first.
 *
 * WHY THIS ORDER?
 * Power frame prioritizes control and influence. Agency (freedom_constrained)
 * is paramount — without agency, you can't project power. Status follows
 * because it reflects your position of strength.
 *
 * SITUATIONAL PATTERNS: In power frame, influence_position is highly valued
 * (it's a position of strength to leverage). External_pressure is a threat
 * to control that must be addressed. Financial_constraint limits power
 * projection.
 */
const powerPriority: Record<PatternId, number> = {
  // Internal patterns
  freedom_constrained: 1, // Agency is paramount
  recognition_hungry: 2, // Status = power
  foundation_shaky: 3, // Security = control
  survival_mode: 4, // Even survival is about control
  seeking_connection: 5, // Social = alliances
  purpose_seeking: 6,
  stable_foundation: 7,
  socially_resourced: 8,
  // Situational patterns (constraints) — threats to power
  external_pressure: 2.5, // External threats to control
  financial_constraint: 3.5, // Resources constrain power projection
  visibility_exposure: 4, // Reputation risk threatens position
  // Situational patterns (opportunities) — leverage
  influence_position: 0.5, // HIGHEST priority — position of strength!
  external_tailwind: 5.5, // Favorable conditions to exploit
};

/**
 * Power Frame Implementation
 */
export const powerFrame: Frame = {
  name: 'power',

  description: 'Control and influence - status and autonomy are primary',

  perspective: `I navigate a field of forces and influences. 
    My position depends on what I control and who respects my agency.
    Security means having control. Relationships are strategic alliances.`,

  filterPatterns(
    patterns: ActivePattern[],
    signals: SignalState
  ): ActivePattern[] {
    // In power frame, status and autonomy patterns always surface prominently
    const sorted = [...patterns].sort((a, b) => {
      return (powerPriority[a.id] || 99) - (powerPriority[b.id] || 99);
    });

    // Boost intensity of control-related patterns
    // WHY BOOST? Power frame amplifies power-related concerns. An influence_position
    // pattern is VERY important; a freedom_constrained pattern is urgent.
    return sorted.map((p) => {
      if (
        p.id === 'freedom_constrained' ||
        p.id === 'recognition_hungry' ||
        p.id === 'influence_position' // Situational: position of strength
      ) {
        return { ...p, intensity: Math.min(p.intensity * 1.2, 1.0) };
      }
      // External pressure is also amplified — threats to control are serious
      if (p.id === 'external_pressure' || p.id === 'financial_constraint') {
        return { ...p, intensity: Math.min(p.intensity * 1.1, 1.0) };
      }
      return p;
    });
  },

  generateNarrative(
    priorities: MotivationPriority[],
    constraints: MotivationConstraint[],
    opportunities: MotivationOpportunity[]
  ): string {
    const parts: string[] = [];

    const topPriority = priorities[0];

    if (!topPriority) {
      parts.push('I am in a position of strength.');
      parts.push('My control is secure, my influence intact.');
    }
    // Situational: influence_position takes precedence
    else if (
      topPriority.need.includes('leverage') &&
      topPriority.need.includes('influence')
    ) {
      parts.push('I have leverage to act decisively.');
      parts.push('This is the moment to consolidate power.');
    } else if (
      topPriority.need.includes('autonomy') ||
      topPriority.need.includes('freedom')
    ) {
      parts.push('My agency is being constrained.');
      parts.push('I need to reassert control over my situation.');
    } else if (
      topPriority.need.includes('status') ||
      topPriority.need.includes('recognition')
    ) {
      parts.push('My position needs strengthening.');
      parts.push('I should demonstrate competence and assert my standing.');
    }
    // Situational: external_pressure as threat to control
    else if (
      topPriority.need.includes('external') ||
      topPriority.need.includes('pressure')
    ) {
      parts.push('External factors constrain my control.');
      parts.push('I must address these threats before projecting power.');
    }
    // Situational: financial_constraint limits power projection
    else if (
      topPriority.need.includes('financial') ||
      topPriority.need.includes('resources')
    ) {
      parts.push('Resources limit my ability to project power.');
      parts.push('I need to secure my position before bold moves.');
    } else if (topPriority.need.includes('security')) {
      parts.push("I'm losing ground on control.");
      parts.push('Need to reassert stability before others sense weakness.');
    } else if (
      topPriority.need.includes('social') ||
      topPriority.need.includes('connection')
    ) {
      parts.push('My alliance network needs attention.');
      parts.push('Strategic relationships require cultivation.');
    } else {
      parts.push(`I'm focused on ${topPriority.need.replace(/_/g, ' ')}.`);
    }

    // Add opportunity framing — in power frame, opportunities are leverage points
    const leverageOpp = opportunities.find(
      (o) =>
        o.type.includes('leverage') ||
        o.type.includes('influence') ||
        o.type.includes('decisive')
    );
    if (leverageOpp) {
      parts.push('I see an opportunity to consolidate influence.');
    } else if (opportunities.length > 0) {
      parts.push('Conditions favor assertive action.');
    }

    return parts.join(' ');
  },
};
