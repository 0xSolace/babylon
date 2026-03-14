/**
 * Pattern Schema - Trust and behavioral pattern tracking per entity
 *
 * WHY THIS SCHEMA EXISTS:
 * ======================
 * Social intelligence requires knowing "who can I trust?"
 *
 * This schema tracks:
 * - trustScore: Numerical trust level (0-100)
 * - behaviors: Observed behavioral patterns
 * - trustSignals: Evidence that increased trust
 * - redFlags: Warning signs or concerning behaviors
 *
 * WHY ENTITY SCOPE:
 * ================
 * Trust is per-person. User A might be trustworthy while User B is not.
 * Using 'entity' scope means each user gets their own trust assessment.
 *
 * PROVIDER PRIMING:
 * ================
 * The provider doesn't just show trust scores—it primes behavior:
 * - "HIGH trust - be open and helpful" → agent is collaborative
 * - "LOW trust - be cautious" → agent is more reserved
 *
 * This is more powerful than just showing "Trust: 73".
 */
import { defineSchema } from '../schema.ts';

export const patternSchema = defineSchema({
  name: 'pattern',
  table: 'patterns',
  scope: 'entity', // WHY: Trust is per-person, not per-room or global

  fields: {
    /**
     * WHY: Needed to correlate with the entity being tracked.
     * Could query by memory.entityId, but having it in metadata
     * makes it available without joins.
     */
    entityId: { type: 'string', description: 'ID of the entity being tracked' },

    /**
     * WHY 0-100 RANGE: Intuitive percentage scale.
     * WHY MIN 0: Can't have negative trust.
     * WHY MAX 100: Certainty cap (even the most trustworthy has some risk).
     */
    trustScore: {
      type: 'number',
      min: 0,
      max: 100,
      description: 'Trust level (0-100)',
    },

    /**
     * WHY BEHAVIORS ARRAY: Trust is based on observed actions, not stated intentions.
     * Accumulates over time: ["helped with debugging", "shared useful resources"]
     */
    behaviors: { type: 'array', description: 'Observed behavioral patterns' },

    /**
     * WHY SEPARATE FROM BEHAVIORS: Positive signals specifically.
     * Used for: explaining trust score, debugging, priming provider.
     */
    trustSignals: {
      type: 'array',
      description: 'Signals that increased trust',
    },

    /**
     * WHY TRACK RED FLAGS: Negative signals deserve special attention.
     * Even if overall trust is okay, red flags should be visible.
     */
    redFlags: {
      type: 'array',
      description: 'Warning signs or concerning behaviors',
    },

    /**
     * WHY COUNT INTERACTIONS: Sample size matters.
     * Trust from 100 interactions is more reliable than trust from 2.
     */
    interactionCount: {
      type: 'number',
      description: 'Number of interactions observed',
    },

    /**
     * WHY TIMESTAMP: Recency matters. Trust from yesterday is more
     * relevant than trust from 6 months ago.
     */
    lastInteraction: { type: 'timestamp', description: 'When last observed' },
  },

  prompts: {
    /**
     * WHY "SKEPTICAL BY DEFAULT": Prevents the agent from being naive.
     * Trust must be earned, not assumed.
     */
    task: 'Analyze entity behavior patterns. Track trust signals, red flags, and overall trust score. Be skeptical by default.',
  },

  provider: {
    name: 'PATTERNS',
    description: 'Entity trust and behavioral patterns',
    headerText: '# Known entity patterns',
    emptyText: 'No behavioral patterns tracked.\n',
  },

  hooks: {
    /**
     * Custom provider formatting with PRIMING.
     *
     * WHY CUSTOM: Default formatting just lists fields.
     * We want to:
     * 1. Filter to the current entity (not all entities)
     * 2. Add priming text that guides agent behavior
     *
     * WHY PRIMING TEXT:
     * LLMs respond to framing. "Trust: 73" is abstract.
     * "HIGH trust - be open and helpful" directly influences response tone.
     */
    formatProvider: (memories, message, _runtime) => {
      // Only show patterns for the current message's sender
      const relevant = memories.filter(
        (m) => m.metadata.entityId === message.entityId
      );
      if (relevant.length === 0) return 'No patterns for this entity.\n';

      const m = relevant[0];
      const trust = m.metadata.trustScore as number;

      // WHY TIERED PRIMING: Different trust levels → different behavior
      const priming =
        trust >= 70
          ? 'HIGH trust - be open and helpful'
          : trust >= 40
            ? 'MODERATE trust - proceed normally'
            : 'LOW trust - be cautious and verify';

      return `# Entity trust\n- Trust: ${trust}/100 (${priming})\n- Signals: ${(m.metadata.trustSignals as string[])?.slice(0, 3).join(', ') || 'none'}\n`;
    },
  },
});
