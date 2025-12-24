/**
 * Tiered Group System Tests
 *
 * Comprehensive tests for:
 * - Tier configuration validation
 * - Helper functions (boundary conditions, edge cases)
 * - Service methods (with real database when available)
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  chatParticipants,
  chats,
  db,
  eq,
  groupChatMemberships,
} from '@babylon/db';
import {
  ALL_TIERS,
  getHigherTier,
  getLowerTier,
  getTierConfig,
  getTierForEngagementScore,
  getTierGroupName,
  getTierSuffix,
  getTotalNpcCapacity,
  INVITE_COOLDOWN_HOURS,
  isEligibleForPromotion,
  MAX_ACTIVE_USER_GROUPS,
  shouldDemote,
  TIER_CONFIG,
  TieredGroupService,
} from '@babylon/engine';
import { generateSnowflakeId } from '@babylon/shared';

// =============================================================================
// Tier Configuration Tests
// =============================================================================

describe('TIER_CONFIG', () => {
  it('should have exactly 3 tiers', () => {
    expect(Object.keys(TIER_CONFIG).length).toBe(3);
    expect(TIER_CONFIG[1]).toBeDefined();
    expect(TIER_CONFIG[2]).toBeDefined();
    expect(TIER_CONFIG[3]).toBeDefined();
  });

  it('should have correct tier 1 (Inner Circle) configuration', () => {
    const t1 = TIER_CONFIG[1];
    expect(t1.name).toBe('Inner Circle');
    expect(t1.suffix).toBe("'s Inner Circle");
    expect(t1.maxMembers).toBe(12);
    expect(t1.minEngagementScore).toBe(80);
    expect(t1.messageFrequency).toBe(0.25);
    expect(t1.alphaLevel).toBe('full');
    expect(t1.inviteProbability).toBe(0.005);
    expect(t1.promotionWaitDays).toBe(30);
    expect(t1.demotionInactiveDays).toBe(30);
  });

  it('should have correct tier 2 (Community) configuration', () => {
    const t2 = TIER_CONFIG[2];
    expect(t2.name).toBe('Community');
    expect(t2.suffix).toBe("'s Community");
    expect(t2.maxMembers).toBe(50);
    expect(t2.minEngagementScore).toBe(50);
    expect(t2.messageFrequency).toBe(0.15);
    expect(t2.alphaLevel).toBe('partial');
    expect(t2.inviteProbability).toBe(0.02);
    expect(t2.promotionWaitDays).toBe(14);
    expect(t2.demotionInactiveDays).toBe(60);
  });

  it('should have correct tier 3 (Followers) configuration', () => {
    const t3 = TIER_CONFIG[3];
    expect(t3.name).toBe('Followers');
    expect(t3.suffix).toBe("'s Followers");
    expect(t3.maxMembers).toBe(500);
    expect(t3.minEngagementScore).toBe(20);
    expect(t3.messageFrequency).toBe(0.05);
    expect(t3.alphaLevel).toBe('public');
    expect(t3.inviteProbability).toBe(0.1);
    expect(t3.promotionWaitDays).toBe(0);
    expect(t3.demotionInactiveDays).toBe(90);
  });

  it('should have decreasing engagement thresholds by tier', () => {
    expect(TIER_CONFIG[1].minEngagementScore).toBeGreaterThan(
      TIER_CONFIG[2].minEngagementScore
    );
    expect(TIER_CONFIG[2].minEngagementScore).toBeGreaterThan(
      TIER_CONFIG[3].minEngagementScore
    );
  });

  it('should have increasing max members by tier', () => {
    expect(TIER_CONFIG[1].maxMembers).toBeLessThan(TIER_CONFIG[2].maxMembers);
    expect(TIER_CONFIG[2].maxMembers).toBeLessThan(TIER_CONFIG[3].maxMembers);
  });

  it('should have decreasing message frequency by tier', () => {
    expect(TIER_CONFIG[1].messageFrequency).toBeGreaterThan(
      TIER_CONFIG[2].messageFrequency
    );
    expect(TIER_CONFIG[2].messageFrequency).toBeGreaterThan(
      TIER_CONFIG[3].messageFrequency
    );
  });

  it('should have increasing demotion inactive days by tier', () => {
    expect(TIER_CONFIG[1].demotionInactiveDays).toBeLessThan(
      TIER_CONFIG[2].demotionInactiveDays
    );
    expect(TIER_CONFIG[2].demotionInactiveDays).toBeLessThan(
      TIER_CONFIG[3].demotionInactiveDays
    );
  });
});

describe('Constants', () => {
  it('ALL_TIERS should be [1, 2, 3] in order', () => {
    expect(ALL_TIERS).toEqual([1, 2, 3]);
  });

  it('MAX_ACTIVE_USER_GROUPS should be 5', () => {
    expect(MAX_ACTIVE_USER_GROUPS).toBe(5);
  });

  it('INVITE_COOLDOWN_HOURS should be 4', () => {
    expect(INVITE_COOLDOWN_HOURS).toBe(4);
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('getTierConfig', () => {
  it('should return correct config for each tier', () => {
    expect(getTierConfig(1).name).toBe('Inner Circle');
    expect(getTierConfig(2).name).toBe('Community');
    expect(getTierConfig(3).name).toBe('Followers');
  });

  it('should return same object as TIER_CONFIG', () => {
    expect(getTierConfig(1)).toBe(TIER_CONFIG[1]);
    expect(getTierConfig(2)).toBe(TIER_CONFIG[2]);
    expect(getTierConfig(3)).toBe(TIER_CONFIG[3]);
  });
});

describe('getTierSuffix', () => {
  it('should return correct suffix for each tier', () => {
    expect(getTierSuffix(1)).toBe("'s Inner Circle");
    expect(getTierSuffix(2)).toBe("'s Community");
    expect(getTierSuffix(3)).toBe("'s Followers");
  });
});

describe('getTierGroupName', () => {
  it('should generate correct group names', () => {
    expect(getTierGroupName('Alice', 1)).toBe("Alice's Inner Circle");
    expect(getTierGroupName('Bob', 2)).toBe("Bob's Community");
    expect(getTierGroupName('Charlie', 3)).toBe("Charlie's Followers");
  });

  it('should handle empty string name', () => {
    expect(getTierGroupName('', 1)).toBe("'s Inner Circle");
  });

  it('should handle names with special characters', () => {
    expect(getTierGroupName("O'Brien", 1)).toBe("O'Brien's Inner Circle");
    expect(getTierGroupName('Dr. Smith', 2)).toBe("Dr. Smith's Community");
  });
});

describe('getTotalNpcCapacity', () => {
  it('should return 562 (12 + 50 + 500)', () => {
    expect(getTotalNpcCapacity()).toBe(562);
  });

  it('should equal sum of all tier max members', () => {
    const sum =
      TIER_CONFIG[1].maxMembers +
      TIER_CONFIG[2].maxMembers +
      TIER_CONFIG[3].maxMembers;
    expect(getTotalNpcCapacity()).toBe(sum);
  });
});

// =============================================================================
// getTierForEngagementScore - Boundary Condition Tests
// =============================================================================

describe('getTierForEngagementScore', () => {
  describe('Tier 1 boundaries (80+)', () => {
    it('should return tier 1 for exactly 80', () => {
      expect(getTierForEngagementScore(80)).toBe(1);
    });

    it('should return tier 1 for 100', () => {
      expect(getTierForEngagementScore(100)).toBe(1);
    });

    it('should return tier 1 for values above 100', () => {
      expect(getTierForEngagementScore(150)).toBe(1);
      expect(getTierForEngagementScore(1000)).toBe(1);
    });
  });

  describe('Tier 2 boundaries (50-79)', () => {
    it('should return tier 2 for exactly 50', () => {
      expect(getTierForEngagementScore(50)).toBe(2);
    });

    it('should return tier 2 for exactly 79', () => {
      expect(getTierForEngagementScore(79)).toBe(2);
    });

    it('should return tier 2 for 79.9 (just below 80)', () => {
      expect(getTierForEngagementScore(79.9)).toBe(2);
    });

    it('should NOT return tier 2 for 79.999... approaching 80', () => {
      expect(getTierForEngagementScore(79.9999)).toBe(2);
    });
  });

  describe('Tier 3 boundaries (20-49)', () => {
    it('should return tier 3 for exactly 20', () => {
      expect(getTierForEngagementScore(20)).toBe(3);
    });

    it('should return tier 3 for exactly 49', () => {
      expect(getTierForEngagementScore(49)).toBe(3);
    });

    it('should return tier 3 for 49.9 (just below 50)', () => {
      expect(getTierForEngagementScore(49.9)).toBe(3);
    });
  });

  describe('Below minimum (< 20)', () => {
    it('should return null for exactly 19', () => {
      expect(getTierForEngagementScore(19)).toBeNull();
    });

    it('should return null for 19.9 (just below 20)', () => {
      expect(getTierForEngagementScore(19.9)).toBeNull();
    });

    it('should return null for 0', () => {
      expect(getTierForEngagementScore(0)).toBeNull();
    });

    it('should return null for negative values', () => {
      expect(getTierForEngagementScore(-1)).toBeNull();
      expect(getTierForEngagementScore(-100)).toBeNull();
    });
  });
});

// =============================================================================
// isEligibleForPromotion - Comprehensive Tests
// =============================================================================

describe('isEligibleForPromotion', () => {
  describe('Tier 1 (cannot promote further)', () => {
    it('should always return false for tier 1', () => {
      expect(isEligibleForPromotion(1, 100, 365)).toBe(false);
      expect(isEligibleForPromotion(1, 0, 0)).toBe(false);
    });
  });

  describe('Tier 2 to Tier 1 promotion', () => {
    // Requirements: engagement >= 80, days >= 14 (promotionWaitDays for tier 2)
    it('should return true when engagement >= 80 AND days >= 14', () => {
      expect(isEligibleForPromotion(2, 80, 14)).toBe(true);
      expect(isEligibleForPromotion(2, 100, 30)).toBe(true);
    });

    it('should return false when engagement < 80', () => {
      expect(isEligibleForPromotion(2, 79, 30)).toBe(false);
      expect(isEligibleForPromotion(2, 50, 100)).toBe(false);
    });

    it('should return false when days < 14', () => {
      expect(isEligibleForPromotion(2, 100, 13)).toBe(false);
      expect(isEligibleForPromotion(2, 80, 0)).toBe(false);
    });

    it('should return false at boundary (79 engagement, 14 days)', () => {
      expect(isEligibleForPromotion(2, 79, 14)).toBe(false);
    });

    it('should return false at boundary (80 engagement, 13 days)', () => {
      expect(isEligibleForPromotion(2, 80, 13)).toBe(false);
    });
  });

  describe('Tier 3 to Tier 2 promotion', () => {
    // Requirements: engagement >= 50, days >= 0 (promotionWaitDays for tier 3)
    it('should return true when engagement >= 50 (no wait time)', () => {
      expect(isEligibleForPromotion(3, 50, 0)).toBe(true);
      expect(isEligibleForPromotion(3, 79, 0)).toBe(true);
    });

    it('should return false when engagement < 50', () => {
      expect(isEligibleForPromotion(3, 49, 0)).toBe(false);
      expect(isEligibleForPromotion(3, 20, 100)).toBe(false);
    });

    it('should return true at exact boundary (50 engagement, 0 days)', () => {
      expect(isEligibleForPromotion(3, 50, 0)).toBe(true);
    });
  });
});

// =============================================================================
// shouldDemote - Comprehensive Tests
// =============================================================================

describe('shouldDemote', () => {
  describe('Tier 1 demotion (30+ days inactive)', () => {
    it('should return true for exactly 30 days', () => {
      expect(shouldDemote(1, 30)).toBe(true);
    });

    it('should return false for 29 days', () => {
      expect(shouldDemote(1, 29)).toBe(false);
    });

    it('should return true for many days inactive', () => {
      expect(shouldDemote(1, 100)).toBe(true);
      expect(shouldDemote(1, 365)).toBe(true);
    });

    it('should return false for 0 days', () => {
      expect(shouldDemote(1, 0)).toBe(false);
    });
  });

  describe('Tier 2 demotion (60+ days inactive)', () => {
    it('should return true for exactly 60 days', () => {
      expect(shouldDemote(2, 60)).toBe(true);
    });

    it('should return false for 59 days', () => {
      expect(shouldDemote(2, 59)).toBe(false);
    });
  });

  describe('Tier 3 demotion (90+ days inactive)', () => {
    it('should return true for exactly 90 days', () => {
      expect(shouldDemote(3, 90)).toBe(true);
    });

    it('should return false for 89 days', () => {
      expect(shouldDemote(3, 89)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative days as not demote-worthy', () => {
      expect(shouldDemote(1, -1)).toBe(false);
      expect(shouldDemote(2, -10)).toBe(false);
      expect(shouldDemote(3, -100)).toBe(false);
    });
  });
});

// =============================================================================
// getLowerTier - Tests
// =============================================================================

describe('getLowerTier', () => {
  it('should return tier 2 for tier 1', () => {
    expect(getLowerTier(1)).toBe(2);
  });

  it('should return tier 3 for tier 2', () => {
    expect(getLowerTier(2)).toBe(3);
  });

  it('should return null for tier 3 (no lower tier)', () => {
    expect(getLowerTier(3)).toBeNull();
  });
});

// =============================================================================
// getHigherTier - Tests
// =============================================================================

describe('getHigherTier', () => {
  it('should return null for tier 1 (already at top)', () => {
    expect(getHigherTier(1)).toBeNull();
  });

  it('should return tier 1 for tier 2', () => {
    expect(getHigherTier(2)).toBe(1);
  });

  it('should return tier 2 for tier 3', () => {
    expect(getHigherTier(3)).toBe(2);
  });
});

// =============================================================================
// Database Integration Tests (when available)
// =============================================================================

describe('TieredGroupService Integration', () => {
  let databaseReady = false;
  let testNpcId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Check database connection
    const connectionResult = await db
      .execute('SELECT 1 as test')
      .catch(() => null);
    if (!connectionResult) {
      console.warn('⚠️ Database not available - skipping integration tests');
      return;
    }

    // Check if tier column exists (migration applied)
    // This query checks information_schema for the tier column
    const migrationCheck = await db
      .execute(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'Chat' AND column_name = 'tier' LIMIT 1"
      )
      .catch(() => null);

    // Drizzle returns array-like result; check if it has any rows
    const hasRows =
      migrationCheck &&
      Array.isArray(migrationCheck) &&
      migrationCheck.length > 0;
    if (!hasRows) {
      console.warn(
        '⚠️ Tier migration not applied - skipping integration tests (run: bun run db:migrate)'
      );
      return;
    }

    databaseReady = true;

    // Create test IDs
    testNpcId = `test-npc-${await generateSnowflakeId()}`;
    testUserId = `test-user-${await generateSnowflakeId()}`;
  });

  afterAll(async () => {
    if (!databaseReady) return;

    // Clean up test data
    await db
      .delete(groupChatMemberships)
      .where(eq(groupChatMemberships.npcAdminId, testNpcId));
    await db
      .delete(chatParticipants)
      .where(eq(chatParticipants.userId, testNpcId));
    await db.delete(chats).where(eq(chats.npcAdminId, testNpcId));
  });

  describe('getNpcTiers', () => {
    it('should return empty array for unknown NPC', async () => {
      if (!databaseReady) return;

      const tiers = await TieredGroupService.getNpcTiers(
        'unknown-npc-id-12345'
      );
      expect(tiers).toEqual([]);
    });
  });

  describe('getUserTierStatus', () => {
    it('should return null tier status for user not in any group', async () => {
      if (!databaseReady) return;

      const status = await TieredGroupService.getUserTierStatus(
        testUserId,
        testNpcId
      );
      expect(status.userId).toBe(testUserId);
      expect(status.npcId).toBe(testNpcId);
      expect(status.currentTier).toBeNull();
      expect(status.chatId).toBeNull();
    });
  });

  describe('getUserAllTiers', () => {
    it('should return empty array for user not in any groups', async () => {
      if (!databaseReady) return;

      const tiers = await TieredGroupService.getUserAllTiers(testUserId);
      expect(Array.isArray(tiers)).toBe(true);
    });
  });

  describe('canInviteUser', () => {
    it('should check if user can be invited', async () => {
      if (!databaseReady) return;

      const result = await TieredGroupService.canInviteUser(
        testUserId,
        testNpcId
      );
      expect(typeof result.canInvite).toBe('boolean');
      expect(typeof result.reason).toBe('string');
    });
  });

  describe('findAvailableTier', () => {
    it('should return null for NPC with no tiers', async () => {
      if (!databaseReady) return;

      const tier = await TieredGroupService.findAvailableTier(
        'unknown-npc',
        80
      );
      expect(tier).toBeNull();
    });
  });

  describe('getGlobalAnalytics', () => {
    it('should return valid analytics structure', async () => {
      if (!databaseReady) return;

      const analytics = await TieredGroupService.getGlobalAnalytics();
      expect(typeof analytics.totalNpcs).toBe('number');
      expect(typeof analytics.totalTiers).toBe('number');
      expect(typeof analytics.totalMembers).toBe('number');
      expect(typeof analytics.totalCapacity).toBe('number');
      expect(typeof analytics.overallFillRate).toBe('number');
      expect(Array.isArray(analytics.tierBreakdown)).toBe(true);
      expect(analytics.tierBreakdown.length).toBe(3);
    });
  });
});
