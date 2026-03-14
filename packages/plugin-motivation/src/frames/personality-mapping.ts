/**
 * @fileoverview Personality to Frame Mapping
 *
 * Maps character personality traits to recommended motivation frames.
 * Used for automatic frame selection based on character definition.
 *
 * ## Why This Exists
 *
 * Different character personalities naturally align with different
 * interpretive frames:
 * - A power-hungry politician naturally views the world through a power lens
 * - A nurturing caregiver naturally uses Maslow's hierarchy
 * - A fame-seeking influencer naturally focuses on notoriety
 *
 * This utility allows automatic frame selection based on character adjectives
 * and traits, reducing the need for explicit frame configuration.
 *
 * ## Usage
 *
 * ```typescript
 * import { inferDefaultFrame } from './personality-mapping.ts';
 *
 * const character = runtime.character;
 * const defaultFrame = inferDefaultFrame(character.adjectives, character.traits);
 * // Returns 'power', 'maslow', 'notoriety', or 'survival'
 * ```
 */

import type { FrameType } from '../types.ts';

/**
 * Keywords that suggest a power-focused frame.
 * Characters with these traits tend to view the world through dominance/influence.
 */
const POWER_KEYWORDS = [
  'ambitious',
  'dominant',
  'commanding',
  'authoritative',
  'controlling',
  'powerful',
  'leader',
  'boss',
  'ruler',
  'competitive',
  'assertive',
  'strategic',
  'influential',
  'manipulative',
  'cunning',
  'calculating',
  'driven',
  'ruthless',
  'determined',
  'forceful',
  'aggressive',
  'political',
  'executive',
  'commanding',
  'imperial',
  'machiavellian',
];

/**
 * Keywords that suggest a notoriety-focused frame.
 * Characters with these traits focus on reputation and public perception.
 */
const NOTORIETY_KEYWORDS = [
  'famous',
  'celebrity',
  'popular',
  'charismatic',
  'glamorous',
  'attention-seeking',
  'showman',
  'performer',
  'entertainer',
  'diva',
  'influencer',
  'trendsetter',
  'socialite',
  'star',
  'spotlight',
  'narcissistic',
  'vain',
  'public',
  'notorious',
  'legendary',
  'flashy',
  'ostentatious',
  'dramatic',
  'theatrical',
  'flamboyant',
];

/**
 * Keywords that suggest a survival-focused frame.
 * Characters with these traits prioritize basic needs and safety.
 */
const SURVIVAL_KEYWORDS = [
  'cautious',
  'paranoid',
  'fearful',
  'defensive',
  'survivalist',
  'anxious',
  'stressed',
  'desperate',
  'frugal',
  'resourceful',
  'pragmatic',
  'practical',
  'realistic',
  'grounded',
  'risk-averse',
  'protective',
  'vigilant',
  'careful',
  'conservative',
  'guarded',
  'homeless',
  'struggling',
  'impoverished',
  'hungry',
  'exhausted',
];

/**
 * Keywords that suggest a Maslow-focused frame (default).
 * Characters with these traits focus on holistic well-being and growth.
 */
const MASLOW_KEYWORDS = [
  'nurturing',
  'caring',
  'empathetic',
  'compassionate',
  'wise',
  'balanced',
  'thoughtful',
  'introspective',
  'mindful',
  'spiritual',
  'philosophical',
  'humanistic',
  'growth-oriented',
  'self-aware',
  'supportive',
  'mentoring',
  'parental',
  'guidance',
  'wholesome',
  'authentic',
  'genuine',
  'sincere',
  'heartfelt',
  'warm',
];

/**
 * Infer the default frame based on character personality traits.
 *
 * @param adjectives - Character's adjectives array
 * @param traits - Character's traits array (optional)
 * @param bio - Character's bio array (optional)
 * @returns The recommended FrameType
 */
export function inferDefaultFrame(
  adjectives?: string[],
  traits?: string[],
  bio?: string[]
): FrameType {
  // Combine all personality indicators
  const allTraits: string[] = [];

  if (adjectives) {
    allTraits.push(...adjectives.map((a) => a.toLowerCase()));
  }
  if (traits) {
    allTraits.push(...traits.map((t) => t.toLowerCase()));
  }
  if (bio) {
    // Extract keywords from bio
    const bioText = bio.join(' ').toLowerCase();
    allTraits.push(...bioText.split(/\s+/));
  }

  // Score each frame
  const scores: Record<FrameType, number> = {
    power: 0,
    notoriety: 0,
    survival: 0,
    maslow: 0,
  };

  for (const trait of allTraits) {
    if (POWER_KEYWORDS.some((k) => trait.includes(k))) {
      scores.power++;
    }
    if (NOTORIETY_KEYWORDS.some((k) => trait.includes(k))) {
      scores.notoriety++;
    }
    if (SURVIVAL_KEYWORDS.some((k) => trait.includes(k))) {
      scores.survival++;
    }
    if (MASLOW_KEYWORDS.some((k) => trait.includes(k))) {
      scores.maslow++;
    }
  }

  // Find highest scoring frame
  const maxScore = Math.max(...Object.values(scores));

  // If no strong match, default to maslow
  if (maxScore < 2) {
    return 'maslow';
  }

  // Return highest scoring frame (ties go to maslow)
  if (scores.maslow >= maxScore) return 'maslow';
  if (scores.power >= maxScore) return 'power';
  if (scores.notoriety >= maxScore) return 'notoriety';
  if (scores.survival >= maxScore) return 'survival';

  return 'maslow';
}

/**
 * Get the character's explicit or inferred default frame.
 *
 * Priority:
 * 1. Explicit setting: MOTIVATION_DEFAULT_FRAME
 * 2. Inferred from personality traits
 * 3. Global default: maslow
 *
 * @param character - The character definition
 * @returns The FrameType to use as default
 */
export function getCharacterDefaultFrame(character?: {
  adjectives?: string[];
  traits?: string[];
  bio?: string[];
  settings?: Record<string, unknown>;
}): FrameType {
  if (!character) {
    return 'maslow';
  }

  // Check explicit setting
  const explicitFrame = character.settings?.MOTIVATION_DEFAULT_FRAME as
    | FrameType
    | undefined;
  if (
    explicitFrame &&
    ['maslow', 'power', 'notoriety', 'survival'].includes(explicitFrame)
  ) {
    return explicitFrame;
  }

  // Infer from personality
  return inferDefaultFrame(
    character.adjectives,
    character.traits,
    Array.isArray(character.bio) ? character.bio : undefined
  );
}
