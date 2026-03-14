/**
 * @fileoverview Pattern definitions
 *
 * WHY PATTERNS?
 * ------------
 * Raw signal values (security: 'low', social: 'balanced') don't tell a story.
 * Patterns recognize *meaningful combinations* of signals that should influence behavior.
 *
 * For example:
 * - "social: low" alone might mean loneliness OR just preference for solitude
 * - "social: low + security: balanced" = safe enough to seek connection
 * - "social: low + security: low" = can't risk social exposure when unsafe
 *
 * Patterns encode this kind of contextual meaning.
 *
 * PATTERN DESIGN PRINCIPLES
 * -------------------------
 * 1. NAMED STATES: Each pattern has a meaningful name that explains what it represents
 * 2. TRIGGER CONDITIONS: Explicit signal combinations that activate the pattern
 * 3. PREREQUISITES: Some patterns require other conditions (e.g., seeking_connection requires security)
 * 4. INTENSITY INHERITANCE: Pattern intensity comes from the triggering signals
 *
 * WHY NOT MORE PATTERNS?
 * ---------------------
 * We define 8 patterns because:
 * - They cover the core motivational states from psychology research
 * - They're testable and debuggable
 * - More patterns = more complexity without clear benefit
 *
 * Future patterns should emerge from observed agent behavior, not speculation.
 */

import { SignalIntensity } from '../constants.ts';
import {
  isConstrainedSituational,
  isDeficientDriveSignal,
  isFavorableSituational,
  isSatisfiedDriveSignal,
  isStressedPhysiological,
} from '../signals/index.ts';
import type {
  ActivePattern,
  PatternId,
  SignalState,
  SituationalSignal,
} from '../types.ts';

/**
 * Pattern definition - describes when a pattern activates and what it means.
 */
interface PatternDefinition {
  id: PatternId;
  description: string;

  /**
   * Check if this pattern should activate given the current signals.
   * Returns null if not active, or triggers array if active.
   *
   * WHY RETURN TRIGGERS?
   * The triggers array documents *why* this pattern activated. This is
   * useful for debugging ("why is survival_mode active?") and for
   * generating meaningful narratives ("hunger is driving survival mode").
   */
  check(signals: SignalState): string[] | null;

  /**
   * Calculate intensity for this pattern.
   *
   * WHY SEPARATE FROM CHECK?
   * A pattern might activate for multiple reasons with different intensities.
   * For example, survival_mode from hunger=critical has different intensity
   * than survival_mode from fatigue=critical + health=critical (compounding).
   */
  getIntensity(signals: SignalState, triggers: string[]): number;
}

/**
 * All pattern definitions.
 *
 * ORDER MATTERS: Patterns are checked in order, and the first match wins
 * for any given signal combination. More specific patterns should come first.
 */
export const patternDefinitions: PatternDefinition[] = [
  // =========================================================================
  // SURVIVAL MODE
  // =========================================================================
  //
  // WHY FIRST? Survival mode trumps everything. When the body is in distress,
  // psychological needs become irrelevant. This is why Maslow put physiological
  // needs at the base of his hierarchy.
  //
  // TRIGGERS: Any physiological variable at critical level
  //
  // REAL-WORLD ANALOG: Hunger, exhaustion, or illness that demands immediate
  // attention. You can't think about your social life when you're starving.
  // =========================================================================
  {
    id: 'survival_mode',
    description: 'Body needs dominate - physiological state is critical',

    check(signals: SignalState): string[] | null {
      const triggers: string[] = [];

      // Check each physiological variable
      if (signals.physiological.hunger === 'critical') triggers.push('hunger');
      if (signals.physiological.fatigue === 'critical')
        triggers.push('fatigue');
      if (signals.physiological.hydration === 'critical')
        triggers.push('hydration');
      if (signals.physiological.health === 'critical') triggers.push('health');

      return triggers.length > 0 ? triggers : null;
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      // Multiple critical physiological states compound the intensity
      // WHY COMPOUND? Being hungry AND exhausted is worse than either alone
      const base = SignalIntensity.physiological.critical;
      const bonus = Math.min(0.1 * (triggers.length - 1), 0.1);
      return Math.min(base + bonus, 1.0);
    },
  },

  // =========================================================================
  // FOUNDATION SHAKY
  // =========================================================================
  //
  // WHY THIS PATTERN? Security is the psychological equivalent of physiological
  // safety. When security is low, higher needs (social, status, meaning) become
  // harder to pursue because the agent is worried about basic safety.
  //
  // TRIGGERS: Security drive at critical or low level
  //
  // REAL-WORLD ANALOG: Job insecurity, financial stress, relationship instability.
  // You can't focus on self-actualization when you don't know where your next
  // paycheck is coming from.
  // =========================================================================
  {
    id: 'foundation_shaky',
    description: 'Safety is primary concern - security feels unstable',

    check(signals: SignalState): string[] | null {
      const triggers: string[] = [];

      if (isDeficientDriveSignal(signals.drives.security)) {
        triggers.push('security');
      }

      // Health problems also destabilize foundation
      // WHY? Poor health creates insecurity even if psychological security is fine
      if (isStressedPhysiological(signals.physiological.health)) {
        triggers.push('health');
      }

      return triggers.length > 0 ? triggers : null;
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      const securityIntensity =
        signals.drives.security === 'critical'
          ? SignalIntensity.drive.critical
          : SignalIntensity.drive.low;

      return securityIntensity;
    },
  },

  // =========================================================================
  // SEEKING CONNECTION
  // =========================================================================
  //
  // WHY PREREQUISITES? Social seeking only makes sense when security is stable.
  // Reaching out to others is risky — you might be rejected or taken advantage of.
  // An agent with low security shouldn't be seeking social connection.
  //
  // TRIGGERS: Social drive low + security at least balanced
  //
  // REAL-WORLD ANALOG: Loneliness when you're otherwise stable. You have the
  // safety to be vulnerable and reach out to others.
  // =========================================================================
  {
    id: 'seeking_connection',
    description: 'Ready to reach out - social needs unmet but safe to engage',

    check(signals: SignalState): string[] | null {
      // Need: social is deficient
      if (!isDeficientDriveSignal(signals.drives.social)) return null;

      // Condition: security is at least balanced (not deficient)
      // WHY? Can't risk social exposure when feeling unsafe
      if (isDeficientDriveSignal(signals.drives.security)) return null;

      // Condition: not in physiological stress
      // WHY? Hard to be social when body is in distress
      if (isStressedPhysiological(signals.physiologicalStress)) return null;

      return ['social'];
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      return signals.drives.social === 'critical'
        ? SignalIntensity.drive.critical
        : SignalIntensity.drive.low;
    },
  },

  // =========================================================================
  // RECOGNITION HUNGRY
  // =========================================================================
  //
  // WHY PREREQUISITES? Status-seeking requires a social foundation. You need
  // to be connected to others before you can seek recognition from them.
  //
  // TRIGGERS: Status drive low + social and security at least balanced
  //
  // REAL-WORLD ANALOG: Wanting recognition at work when you have job security
  // and good relationships with colleagues.
  // =========================================================================
  {
    id: 'recognition_hungry',
    description: 'Want to be seen - status needs unmet with social foundation',

    check(signals: SignalState): string[] | null {
      // Need: status is deficient
      if (!isDeficientDriveSignal(signals.drives.status)) return null;

      // Condition: social is at least balanced
      // WHY? Need social foundation to seek status
      if (isDeficientDriveSignal(signals.drives.social)) return null;

      // Condition: security is at least balanced
      // WHY? Status-seeking is risky when foundation is shaky
      if (isDeficientDriveSignal(signals.drives.security)) return null;

      return ['status'];
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      return signals.drives.status === 'critical'
        ? SignalIntensity.drive.critical
        : SignalIntensity.drive.low;
    },
  },

  // =========================================================================
  // FREEDOM CONSTRAINED
  // =========================================================================
  //
  // WHY NO PREREQUISITES? Autonomy is fundamental — feeling trapped is
  // distressing regardless of other needs. Unlike social or status (which
  // require foundation), autonomy deprivation is directly felt.
  //
  // TRIGGERS: Autonomy drive low
  //
  // REAL-WORLD ANALOG: Feeling micromanaged, having no choices, being
  // controlled by circumstances or others.
  // =========================================================================
  {
    id: 'freedom_constrained',
    description: 'Agency blocked - autonomy needs unmet',

    check(signals: SignalState): string[] | null {
      if (!isDeficientDriveSignal(signals.drives.autonomy)) return null;

      return ['autonomy'];
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      return signals.drives.autonomy === 'critical'
        ? SignalIntensity.drive.critical
        : SignalIntensity.drive.low;
    },
  },

  // =========================================================================
  // PURPOSE SEEKING
  // =========================================================================
  //
  // WHY STRICT PREREQUISITES? Self-actualization (finding meaning, purpose,
  // significance) is at the top of Maslow's hierarchy. It only emerges when
  // lower needs are well-met. You can't seek transcendence when you're
  // hungry, unsafe, or lonely.
  //
  // TRIGGERS: Meaning drive low + security satisfied + no physiological stress
  //
  // REAL-WORLD ANALOG: Mid-career professionals wondering "what's it all for?"
  // when their basic needs are met.
  // =========================================================================
  {
    id: 'purpose_seeking',
    description:
      'Looking for significance - meaning needs unmet with stable foundation',

    check(signals: SignalState): string[] | null {
      // Need: meaning is deficient
      if (!isDeficientDriveSignal(signals.drives.meaning)) return null;

      // Condition: security is satisfied (not just balanced)
      // WHY SATISFIED, NOT BALANCED? Purpose seeking needs a *solid* foundation
      if (!isSatisfiedDriveSignal(signals.drives.security)) return null;

      // Condition: not in physiological stress
      if (isStressedPhysiological(signals.physiologicalStress)) return null;

      return ['meaning'];
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      return signals.drives.meaning === 'critical'
        ? SignalIntensity.drive.critical
        : SignalIntensity.drive.low;
    },
  },

  // =========================================================================
  // STABLE FOUNDATION (Positive Pattern)
  // =========================================================================
  //
  // WHY POSITIVE PATTERNS? Not all patterns are about deficiency. Stable
  // foundation indicates *capacity* — the agent can pursue growth opportunities.
  // This affects constraints (less risk-averse) and opportunities (growth available).
  //
  // TRIGGERS: Security satisfied + physiological not stressed
  //
  // REAL-WORLD ANALOG: Financial security, good health, stable relationships —
  // the foundation that enables everything else.
  // =========================================================================
  {
    id: 'stable_foundation',
    description: 'Can pursue growth - foundation is solid',

    check(signals: SignalState): string[] | null {
      // Need: security is satisfied
      if (!isSatisfiedDriveSignal(signals.drives.security)) return null;

      // Need: physiological is not stressed
      if (isStressedPhysiological(signals.physiologicalStress)) return null;

      return ['security', 'physiological'];
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      // Positive pattern — intensity indicates strength of foundation
      // WHY 0.7? Strong enough to enable opportunities, but not so high
      // that it dominates the priority list
      return 0.7;
    },
  },

  // =========================================================================
  // SOCIALLY RESOURCED (Positive Pattern)
  // =========================================================================
  //
  // WHY THIS PATTERN? Social capital is a resource that enables action.
  // An agent with strong relationships can leverage them for collaboration,
  // support, or influence. This is an opportunity, not a need.
  //
  // TRIGGERS: Social drive satisfied or abundant
  //
  // REAL-WORLD ANALOG: Having a strong network you can call on for help,
  // advice, or collaboration.
  // =========================================================================
  {
    id: 'socially_resourced',
    description: 'Have relational capital - social connections are strong',

    check(signals: SignalState): string[] | null {
      if (!isSatisfiedDriveSignal(signals.drives.social)) return null;

      return ['social'];
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      // Abundant social is more leverage than just satisfied
      return signals.drives.social === 'abundant' ? 0.8 : 0.6;
    },
  },

  // =========================================================================
  // SITUATIONAL PATTERNS (from appraisals)
  //
  // These patterns incorporate external situational awareness from plugin-appraisal.
  // They work alongside internal patterns to give a complete picture.
  //
  // DESIGN PRINCIPLES:
  // 1. UNIVERSAL patterns work with ANY domain (external_pressure, external_tailwind)
  // 2. SPECIFIC patterns fire for known domains (financial_constraint, influence_position)
  // 3. SPECIFIC SUPPRESSES UNIVERSAL: When a specific pattern fires, it removes that
  //    domain from universal pattern triggers to avoid redundancy
  // =========================================================================

  // =========================================================================
  // EXTERNAL PRESSURE (Universal Situational Pattern)
  // =========================================================================
  //
  // WHY UNIVERSAL? We want to handle ANY external constraint, not just the ones
  // we know about. If plugin-relationships publishes a 'strained' appraisal,
  // we should incorporate that even without a specific pattern for relationships.
  //
  // TRIGGERS: ANY situational appraisal at 'critical' or 'strained' level
  // EXCLUDES: Domains that have their own specific patterns
  //
  // REAL-WORLD ANALOG: "Something external is putting pressure on me" — could be
  // finances, relationships, reputation, health context, etc.
  // =========================================================================
  {
    id: 'external_pressure',
    description:
      'External circumstances constrain options - something outside is strained',

    check(signals: SignalState): string[] | null {
      // Find all constrained situational domains
      const constrainedDomains = Object.entries(signals.situational)
        .filter(([_, signal]) => isConstrainedSituational(signal))
        .map(([domain, _]) => domain);

      // Exclude domains that have their own specific patterns
      // WHY? Specific patterns give more meaningful output. We don't want
      // external_pressure to fire for 'money' when financial_constraint exists.
      const specificDomains = new Set(['money', 'power', 'notoriety']);
      const universalTriggers = constrainedDomains.filter(
        (d) => !specificDomains.has(d)
      );

      return universalTriggers.length > 0 ? universalTriggers : null;
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      // More constrained domains = higher intensity
      // WHY? Multiple external pressures compound the constraint
      const criticalCount = triggers.filter(
        (d) => signals.situational[d] === 'critical'
      ).length;

      const base = 0.5 + triggers.length * 0.1;
      const criticalBonus = criticalCount * 0.1;

      return Math.min(base + criticalBonus, 0.9);
    },
  },

  // =========================================================================
  // EXTERNAL TAILWIND (Universal Situational Pattern)
  // =========================================================================
  //
  // WHY UNIVERSAL? Just like pressure, we want to recognize ANY favorable
  // external condition, not just known domains.
  //
  // TRIGGERS: ANY situational appraisal at 'favorable' or 'strong' level
  //           + stable_foundation (can't capitalize without foundation)
  // EXCLUDES: Domains that have their own specific patterns
  //
  // REAL-WORLD ANALOG: "Conditions are favorable" — tailwinds that enable
  // bold action.
  // =========================================================================
  {
    id: 'external_tailwind',
    description:
      'External circumstances are favorable - opportunity for bold action',

    check(signals: SignalState): string[] | null {
      // First check for foundation stability
      // WHY? Can't capitalize on favorable conditions if foundation is shaky
      if (isDeficientDriveSignal(signals.drives.security)) return null;
      if (isStressedPhysiological(signals.physiologicalStress)) return null;

      // Find all favorable situational domains
      const favorableDomains = Object.entries(signals.situational)
        .filter(([_, signal]) => isFavorableSituational(signal))
        .map(([domain, _]) => domain);

      // Exclude domains that have their own specific patterns
      const specificDomains = new Set(['money', 'power', 'notoriety']);
      const universalTriggers = favorableDomains.filter(
        (d) => !specificDomains.has(d)
      );

      return universalTriggers.length > 0 ? universalTriggers : null;
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      // More favorable domains = higher intensity
      const strongCount = triggers.filter(
        (d) => signals.situational[d] === 'strong'
      ).length;

      const base = 0.5 + triggers.length * 0.1;
      const strongBonus = strongCount * 0.1;

      return Math.min(base + strongBonus, 0.8);
    },
  },

  // =========================================================================
  // FINANCIAL CONSTRAINT (Specific Situational Pattern)
  // =========================================================================
  //
  // WHY SPECIFIC? Money is a common and important external factor. A specific
  // pattern allows us to:
  // 1. Combine money situation with internal drives (e.g., status drive)
  // 2. Generate specific constraints ("avoid resource-intensive actions")
  // 3. Provide specific narrative ("resources limit my options")
  //
  // TRIGGERS: money appraisal 'strained' or 'critical' + growth drive active
  //           (status or meaning drive is low)
  //
  // WHY COMBINE WITH DRIVES? "Low money" alone isn't necessarily a problem.
  // It becomes a constraint when the agent WANTS things that cost money
  // (status through spending, meaning through exploration, etc.)
  //
  // REAL-WORLD ANALOG: Wanting to make an impression or explore opportunities
  // but being limited by financial constraints.
  // =========================================================================
  {
    id: 'financial_constraint',
    description:
      'Financial situation limits options - money strained with growth drive active',

    check(signals: SignalState): string[] | null {
      const moneySignal = signals.situational.money;

      // Need: money is constrained
      if (!moneySignal || !isConstrainedSituational(moneySignal)) return null;

      // Condition: growth drive is active (status or meaning seeking)
      // WHY? Financial constraint matters when you want to spend/invest
      const hasGrowthDrive =
        isDeficientDriveSignal(signals.drives.status) ||
        isDeficientDriveSignal(signals.drives.meaning);

      if (!hasGrowthDrive) return null;

      const triggers = ['money'];
      if (isDeficientDriveSignal(signals.drives.status))
        triggers.push('status');
      if (isDeficientDriveSignal(signals.drives.meaning))
        triggers.push('meaning');

      return triggers;
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      const moneySignal = signals.situational.money;
      const base = moneySignal === 'critical' ? 0.8 : 0.6;

      // More growth drives active = higher constraint intensity
      const driveCount = triggers.filter((t) => t !== 'money').length;
      const driveBonus = driveCount * 0.05;

      return Math.min(base + driveBonus, 0.9);
    },
  },

  // =========================================================================
  // INFLUENCE POSITION (Specific Situational Pattern)
  // =========================================================================
  //
  // WHY SPECIFIC? Power is a valuable situational factor. When you have
  // influence, you can act decisively and leverage your position.
  //
  // TRIGGERS: power appraisal 'favorable' or 'strong' + stable foundation
  //
  // WHY REQUIRE FOUNDATION? Influence without stability is precarious.
  // You need a stable base to project power effectively.
  //
  // REAL-WORLD ANALOG: Being in a position of strength at work, having
  // leverage in a negotiation, having authority in a situation.
  // =========================================================================
  {
    id: 'influence_position',
    description:
      'Position of strength - power is favorable with stable foundation',

    check(signals: SignalState): string[] | null {
      const powerSignal = signals.situational.power;

      // Need: power is favorable
      if (!powerSignal || !isFavorableSituational(powerSignal)) return null;

      // Condition: foundation is stable
      if (isDeficientDriveSignal(signals.drives.security)) return null;
      if (isStressedPhysiological(signals.physiologicalStress)) return null;

      return ['power', 'security'];
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      const powerSignal = signals.situational.power;
      return powerSignal === 'strong' ? 0.8 : 0.7;
    },
  },

  // =========================================================================
  // VISIBILITY EXPOSURE (Specific Situational Pattern)
  // =========================================================================
  //
  // WHY SPECIFIC? Reputation/visibility is critical for social agents.
  // When visibility is strained, every public action carries risk.
  //
  // TRIGGERS: notoriety appraisal 'strained' or 'critical' + social/status drive active
  //
  // WHY COMBINE WITH DRIVES? Visibility only matters when you care about
  // perception (social drive) or recognition (status drive).
  //
  // REAL-WORLD ANALOG: Being under scrutiny at work, having a PR crisis,
  // reputation at risk in a community.
  // =========================================================================
  {
    id: 'visibility_exposure',
    description:
      'Reputation requires management - visibility strained with social/status drive active',

    check(signals: SignalState): string[] | null {
      const notorietySignal = signals.situational.notoriety;

      // Need: notoriety is constrained
      if (!notorietySignal || !isConstrainedSituational(notorietySignal))
        return null;

      // Condition: social or status drive is active (care about perception)
      const caresAboutPerception =
        isDeficientDriveSignal(signals.drives.social) ||
        isDeficientDriveSignal(signals.drives.status);

      if (!caresAboutPerception) return null;

      const triggers = ['notoriety'];
      if (isDeficientDriveSignal(signals.drives.social))
        triggers.push('social');
      if (isDeficientDriveSignal(signals.drives.status))
        triggers.push('status');

      return triggers;
    },

    getIntensity(signals: SignalState, triggers: string[]): number {
      const notorietySignal = signals.situational.notoriety;
      const base = notorietySignal === 'critical' ? 0.85 : 0.65;

      // More perception drives active = higher exposure intensity
      const driveCount = triggers.filter((t) => t !== 'notoriety').length;
      const driveBonus = driveCount * 0.05;

      return Math.min(base + driveBonus, 0.95);
    },
  },
];

/**
 * Detect all active patterns from signal state.
 *
 * WHY DETECT ALL?
 * Multiple patterns can be active simultaneously. An agent might have
 * stable_foundation AND seeking_connection AND freedom_constrained.
 * The frame decides which patterns surface to the top.
 */
export function detectPatterns(signals: SignalState): ActivePattern[] {
  const active: ActivePattern[] = [];

  for (const definition of patternDefinitions) {
    const triggers = definition.check(signals);

    if (triggers !== null) {
      active.push({
        id: definition.id,
        triggers,
        intensity: definition.getIntensity(signals, triggers),
      });
    }
  }

  // Sort by intensity (highest first)
  // WHY SORT HERE? Ensures consistent ordering before frame filtering
  active.sort((a, b) => b.intensity - a.intensity);

  return active;
}

/**
 * Get a pattern definition by ID.
 * Useful for debugging and testing.
 */
export function getPatternDefinition(
  id: PatternId
): PatternDefinition | undefined {
  return patternDefinitions.find((p) => p.id === id);
}
