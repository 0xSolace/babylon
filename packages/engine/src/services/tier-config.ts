/**
 * Tiered Group System Configuration
 *
 * Defines the three tiers of NPC groups:
 * - Tier 1 (Inner Circle): Exclusive, highest engagement, full alpha
 * - Tier 2 (Community): Medium engagement, partial alpha
 * - Tier 3 (Followers): Low barrier, public-facing content
 */

export const TIER_CONFIG = {
  1: {
    name: 'Inner Circle',
    suffix: "'s Inner Circle",
    maxMembers: 12,
    minEngagementScore: 80,
    messageFrequency: 0.25, // 25% chance per tick
    alphaLevel: 'full' as const,
    inviteProbability: 0.005, // 0.5% per tick for eligible users
    promotionWaitDays: 30, // Days in Tier 2 before eligible for Tier 1
    demotionInactiveDays: 30, // Days inactive before demotion to Tier 2
  },
  2: {
    name: 'Community',
    suffix: "'s Community",
    maxMembers: 50,
    minEngagementScore: 50,
    messageFrequency: 0.15, // 15% chance per tick
    alphaLevel: 'partial' as const,
    inviteProbability: 0.02, // 2% per tick for eligible users
    promotionWaitDays: 14, // Days in Tier 3 before eligible for Tier 2
    demotionInactiveDays: 60, // Days inactive before demotion to Tier 3
  },
  3: {
    name: 'Followers',
    suffix: "'s Followers",
    maxMembers: 500,
    minEngagementScore: 20,
    messageFrequency: 0.05, // 5% chance per tick
    alphaLevel: 'public' as const,
    inviteProbability: 0.1, // 10% per tick for eligible users
    promotionWaitDays: 0, // Immediate entry
    demotionInactiveDays: 90, // Days inactive before removal
  },
} as const;

export type TierLevel = 1 | 2 | 3;
export type AlphaLevel = 'full' | 'partial' | 'public';

export interface TierConfig {
  name: string;
  suffix: string;
  maxMembers: number;
  minEngagementScore: number;
  messageFrequency: number;
  alphaLevel: AlphaLevel;
  inviteProbability: number;
  promotionWaitDays: number;
  demotionInactiveDays: number;
}

/**
 * Get configuration for a specific tier
 */
export function getTierConfig(tier: TierLevel): TierConfig {
  return TIER_CONFIG[tier];
}

/**
 * Get the tier name suffix for an NPC (e.g., "'s Inner Circle")
 */
export function getTierSuffix(tier: TierLevel): string {
  return TIER_CONFIG[tier].suffix;
}

/**
 * Get the full group name for an NPC at a specific tier
 */
export function getTierGroupName(npcName: string, tier: TierLevel): string {
  return `${npcName}${TIER_CONFIG[tier].suffix}`;
}

/**
 * Determine which tier a user qualifies for based on engagement score
 */
export function getTierForEngagementScore(score: number): TierLevel | null {
  if (score >= TIER_CONFIG[1].minEngagementScore) return 1;
  if (score >= TIER_CONFIG[2].minEngagementScore) return 2;
  if (score >= TIER_CONFIG[3].minEngagementScore) return 3;
  return null; // Not eligible for any tier
}

/**
 * Check if a user is eligible for promotion to the next tier
 */
export function isEligibleForPromotion(
  currentTier: TierLevel,
  engagementScore: number,
  daysInCurrentTier: number
): boolean {
  if (currentTier === 1) return false; // Already at top tier

  const targetTier = (currentTier - 1) as TierLevel;
  const targetConfig = TIER_CONFIG[targetTier];
  const currentConfig = TIER_CONFIG[currentTier];

  return (
    engagementScore >= targetConfig.minEngagementScore &&
    daysInCurrentTier >= currentConfig.promotionWaitDays
  );
}

/**
 * Check if a user should be demoted due to inactivity
 */
export function shouldDemote(
  currentTier: TierLevel,
  daysSinceLastActivity: number
): boolean {
  const config = TIER_CONFIG[currentTier];
  return daysSinceLastActivity >= config.demotionInactiveDays;
}

/**
 * Get the next lower tier (for demotion)
 */
export function getLowerTier(currentTier: TierLevel): TierLevel | null {
  if (currentTier === 3) return null; // Already at lowest, would be removed
  return (currentTier + 1) as TierLevel;
}

/**
 * Get the next higher tier (for promotion)
 */
export function getHigherTier(currentTier: TierLevel): TierLevel | null {
  if (currentTier === 1) return null; // Already at top
  return (currentTier - 1) as TierLevel;
}

/**
 * Calculate total capacity across all tiers for one NPC
 */
export function getTotalNpcCapacity(): number {
  return (
    TIER_CONFIG[1].maxMembers +
    TIER_CONFIG[2].maxMembers +
    TIER_CONFIG[3].maxMembers
  );
}

/**
 * All tier levels in order (highest to lowest)
 */
export const ALL_TIERS: TierLevel[] = [1, 2, 3];

/**
 * User limits
 */
export const MAX_ACTIVE_USER_GROUPS = 5; // Max groups a user can be in
export const INVITE_COOLDOWN_HOURS = 4; // Hours between invites for same user
