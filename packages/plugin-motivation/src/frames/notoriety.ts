/**
 * @fileoverview Notoriety Frame - Reputation and Visibility
 *
 * The Notoriety frame sees everything through the lens of reputation.
 * Status and social patterns surface first.
 * Everything is about how one is perceived.
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
 * Pattern priority in Notoriety frame.
 * Visibility-related patterns surface first.
 *
 * WHY THIS ORDER?
 * Notoriety frame prioritizes visibility and perception. Recognition is first
 * because it's about being seen. Social patterns follow because relationships
 * are how reputation spreads.
 *
 * SITUATIONAL PATTERNS: In notoriety frame, visibility_exposure is CRITICAL
 * (reputation at risk). External_tailwind is valuable (good conditions for
 * raising profile). Influence_position matters less than visibility itself.
 */
const notorietyPriority: Record<PatternId, number> = {
  // Internal patterns
  recognition_hungry: 1, // Status = visibility
  seeking_connection: 2, // Social = audience
  socially_resourced: 3, // Social capital
  foundation_shaky: 4, // Security = exposure risk
  survival_mode: 5,
  freedom_constrained: 6,
  purpose_seeking: 7,
  stable_foundation: 8,
  // Situational patterns (constraints) — reputation risks
  visibility_exposure: 0.5, // HIGHEST priority — reputation at risk!
  external_pressure: 3.5, // External pressure affects image
  financial_constraint: 5.5, // Financial issues are embarrassing but secondary
  // Situational patterns (opportunities) — profile enhancement
  external_tailwind: 2.5, // Good conditions for raising profile
  influence_position: 4.5, // Position enables visibility
};

/**
 * Notoriety Frame Implementation
 */
export const notorietyFrame: Frame = {
  name: 'notoriety',

  description: 'Reputation and visibility - how am I perceived?',

  perspective: `I am seen. My actions ripple through others' perceptions of me.
    My reputation precedes and follows me. Status is about visibility.
    Social connections are my audience and my mirrors.`,

  filterPatterns(
    patterns: ActivePattern[],
    signals: SignalState
  ): ActivePattern[] {
    // In notoriety frame, status and social patterns surface prominently
    const sorted = [...patterns].sort((a, b) => {
      return (notorietyPriority[a.id] || 99) - (notorietyPriority[b.id] || 99);
    });

    // Boost intensity of visibility-related patterns
    // WHY BOOST? Notoriety frame amplifies reputation concerns. A visibility_exposure
    // pattern is VERY urgent; recognition_hungry is amplified because it's core to this frame.
    return sorted.map((p) => {
      if (
        p.id === 'recognition_hungry' ||
        p.id === 'seeking_connection' ||
        p.id === 'socially_resourced' ||
        p.id === 'visibility_exposure' // Situational: reputation at risk!
      ) {
        return { ...p, intensity: Math.min(p.intensity * 1.2, 1.0) };
      }
      // External tailwind is also boosted — good conditions for profile-raising
      if (p.id === 'external_tailwind') {
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
      parts.push('My reputation is solid.');
      parts.push('I am seen as I wish to be seen.');
    }
    // Situational: visibility_exposure is reputation emergency
    else if (
      topPriority.need.includes('visibility') ||
      topPriority.need.includes('reputation')
    ) {
      parts.push('My reputation requires careful management.');
      parts.push('Every action now reflects on how I am perceived.');
    } else if (
      topPriority.need.includes('status') ||
      topPriority.need.includes('recognition')
    ) {
      parts.push('I need to be seen.');
      parts.push(
        'My visibility requires attention - I should demonstrate my worth.'
      );
    } else if (
      topPriority.need.includes('social') ||
      topPriority.need.includes('connection')
    ) {
      parts.push('I need to connect with my audience.');
      parts.push('Relationships are how reputation spreads.');
    }
    // Situational: external_pressure through reputation lens
    else if (
      topPriority.need.includes('external') ||
      topPriority.need.includes('pressure')
    ) {
      parts.push('External factors threaten my image.');
      parts.push('I must navigate this carefully to protect my standing.');
    } else if (topPriority.need.includes('security')) {
      parts.push('My position feels exposed.');
      parts.push('I need to protect my reputation from vulnerability.');
    } else {
      parts.push(`I'm focused on ${topPriority.need.replace(/_/g, ' ')}.`);
    }

    // Frame opportunities as visibility opportunities
    // Situational: external_tailwind means good conditions for raising profile
    const profileOpp = opportunities.find(
      (o) =>
        o.type.includes('momentum') ||
        o.type.includes('bold') ||
        o.type.includes('visibility')
    );
    if (profileOpp) {
      parts.push('Conditions favor raising my profile.');
    } else if (opportunities.length > 0) {
      parts.push('There is an opportunity to enhance my visibility.');
    }

    return parts.join(' ');
  },
};
