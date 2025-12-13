/**
 * Group Chat Configuration Tests
 * Verifies the configuration system works correctly
 */

import { describe, expect, test } from 'bun:test';
import {
  getGroupChatConfigSummary,
  GroupChatServiceConfig,
  GroupInviteConfig,
  NPCGroupDynamicsConfig,
  validateGroupChatConfig,
} from '@babylon/engine';

describe('Group Chat Configuration', () => {
  describe('GroupInviteConfig', () => {
    test('has valid default values', () => {
      expect(GroupInviteConfig.baseInviteProbability).toBeGreaterThan(0);
      expect(GroupInviteConfig.baseInviteProbability).toBeLessThanOrEqual(1);
      expect(GroupInviteConfig.candidateExpiryHours).toBeGreaterThan(0);
      expect(GroupInviteConfig.maxCandidatesPerTick).toBeGreaterThan(0);
      expect(GroupInviteConfig.minEngagementScore).toBeGreaterThanOrEqual(0);
      expect(GroupInviteConfig.minEngagementScore).toBeLessThanOrEqual(100);
      expect(GroupInviteConfig.maxActiveUserGroups).toBeGreaterThan(0);
      expect(GroupInviteConfig.inviteCooldownHours).toBeGreaterThanOrEqual(0);
    });

    test('has valid tier multipliers', () => {
      const tiers = ['S_TIER', 'A_TIER', 'B_TIER', 'C_TIER', 'NONE'];
      for (const tier of tiers) {
        const mult = GroupInviteConfig.tierMultipliers[tier];
        expect(mult).toBeDefined();
        expect(mult).toBeGreaterThan(0);
        expect(mult).toBeLessThanOrEqual(2);
      }
    });

    test('tier multipliers are ordered correctly (S_TIER most selective)', () => {
      expect(GroupInviteConfig.tierMultipliers.S_TIER).toBeLessThan(
        GroupInviteConfig.tierMultipliers.A_TIER
      );
      expect(GroupInviteConfig.tierMultipliers.A_TIER).toBeLessThan(
        GroupInviteConfig.tierMultipliers.B_TIER
      );
      expect(GroupInviteConfig.tierMultipliers.B_TIER).toBeLessThan(
        GroupInviteConfig.tierMultipliers.C_TIER
      );
      expect(GroupInviteConfig.tierMultipliers.C_TIER).toBeLessThanOrEqual(
        GroupInviteConfig.tierMultipliers.NONE
      );
    });
  });

  describe('NPCGroupDynamicsConfig', () => {
    test('has valid probability defaults', () => {
      expect(NPCGroupDynamicsConfig.formNewGroupChance).toBeGreaterThan(0);
      expect(NPCGroupDynamicsConfig.formNewGroupChance).toBeLessThanOrEqual(1);
      expect(NPCGroupDynamicsConfig.joinGroupChance).toBeGreaterThan(0);
      expect(NPCGroupDynamicsConfig.joinGroupChance).toBeLessThanOrEqual(1);
      expect(NPCGroupDynamicsConfig.leaveGroupChance).toBeGreaterThan(0);
      expect(NPCGroupDynamicsConfig.leaveGroupChance).toBeLessThanOrEqual(1);
      expect(NPCGroupDynamicsConfig.postMessageChance).toBeGreaterThan(0);
      expect(NPCGroupDynamicsConfig.postMessageChance).toBeLessThanOrEqual(1);
      expect(NPCGroupDynamicsConfig.inviteUserChance).toBeGreaterThan(0);
      expect(NPCGroupDynamicsConfig.inviteUserChance).toBeLessThanOrEqual(1);
      expect(NPCGroupDynamicsConfig.kickCheckChance).toBeGreaterThan(0);
      expect(NPCGroupDynamicsConfig.kickCheckChance).toBeLessThanOrEqual(1);
    });

    test('has valid group size defaults', () => {
      expect(NPCGroupDynamicsConfig.minGroupSize).toBeGreaterThan(0);
      expect(NPCGroupDynamicsConfig.maxGroupSize).toBeGreaterThan(
        NPCGroupDynamicsConfig.minGroupSize
      );
      expect(NPCGroupDynamicsConfig.idealGroupSize).toBeGreaterThanOrEqual(
        NPCGroupDynamicsConfig.minGroupSize
      );
      expect(NPCGroupDynamicsConfig.idealGroupSize).toBeLessThanOrEqual(
        NPCGroupDynamicsConfig.maxGroupSize
      );
    });
  });

  describe('GroupChatServiceConfig', () => {
    test('has valid kick probability defaults', () => {
      expect(GroupChatServiceConfig.baseKickProbability).toBeGreaterThan(0);
      expect(GroupChatServiceConfig.baseKickProbability).toBeLessThan(1);
    });

    test('has valid inactivity defaults', () => {
      expect(GroupChatServiceConfig.inactivityGracePeriodTicks).toBeGreaterThan(0);
      expect(GroupChatServiceConfig.inactivityMaxTicks).toBeGreaterThan(
        GroupChatServiceConfig.inactivityGracePeriodTicks
      );
    });

    test('has valid activity sweet spot defaults', () => {
      expect(GroupChatServiceConfig.activitySweetSpotMin).toBeGreaterThanOrEqual(0);
      expect(GroupChatServiceConfig.activitySweetSpotMax).toBeGreaterThan(
        GroupChatServiceConfig.activitySweetSpotMin
      );
      expect(GroupChatServiceConfig.activityHardCap).toBeGreaterThan(
        GroupChatServiceConfig.activitySweetSpotMax
      );
    });
  });

  describe('getGroupChatConfigSummary', () => {
    test('returns all expected keys', () => {
      const summary = getGroupChatConfigSummary();
      
      expect(summary['invite.baseInviteProbability']).toBeDefined();
      expect(summary['invite.candidateExpiryHours']).toBeDefined();
      expect(summary['invite.maxCandidatesPerTick']).toBeDefined();
      expect(summary['invite.minEngagementScore']).toBeDefined();
      expect(summary['invite.maxActiveUserGroups']).toBeDefined();
      expect(summary['invite.inviteCooldownHours']).toBeDefined();
      expect(summary['dynamics.formNewGroupChance']).toBeDefined();
      expect(summary['dynamics.joinGroupChance']).toBeDefined();
      expect(summary['dynamics.leaveGroupChance']).toBeDefined();
      expect(summary['dynamics.postMessageChance']).toBeDefined();
      expect(summary['dynamics.inviteUserChance']).toBeDefined();
      expect(summary['dynamics.kickCheckChance']).toBeDefined();
      expect(summary['dynamics.minGroupSize']).toBeDefined();
      expect(summary['dynamics.maxGroupSize']).toBeDefined();
      expect(summary['service.baseKickProbability']).toBeDefined();
      expect(summary['service.inactivityGracePeriodTicks']).toBeDefined();
    });

    test('returns numeric values', () => {
      const summary = getGroupChatConfigSummary();
      for (const value of Object.values(summary)) {
        expect(typeof value).toBe('number');
        expect(Number.isNaN(value)).toBe(false);
      }
    });
  });

  describe('validateGroupChatConfig', () => {
    test('returns valid for default config', () => {
      const result = validateGroupChatConfig();
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });
  });
});

describe('Configuration Expected Behavior', () => {
  test('default invite probability gives reasonable invite rate', () => {
    const prob = GroupInviteConfig.baseInviteProbability;
    const ticksPerHour = 60;
    const expectedInvitesPerHour = prob * ticksPerHour * 20; // Assuming 20 candidates processed per tick max
    
    // Should invite somewhere between 1 and 100 users per hour with defaults
    expect(expectedInvitesPerHour).toBeGreaterThan(0);
    expect(expectedInvitesPerHour).toBeLessThan(200);
  });

  test('candidate expiry gives users time to be processed', () => {
    const expiryHours = GroupInviteConfig.candidateExpiryHours;
    const ticksPerHour = 60;
    const candidatesPerTick = GroupInviteConfig.maxCandidatesPerTick;
    
    // Should be able to process many candidates before expiry
    const totalProcessableBeforeExpiry = expiryHours * ticksPerHour * candidatesPerTick;
    expect(totalProcessableBeforeExpiry).toBeGreaterThan(1000);
  });

  test('group size limits are reasonable', () => {
    const min = NPCGroupDynamicsConfig.minGroupSize;
    const max = NPCGroupDynamicsConfig.maxGroupSize;
    const ideal = NPCGroupDynamicsConfig.idealGroupSize;
    
    // Min should be at least 2 (not a group otherwise)
    expect(min).toBeGreaterThanOrEqual(2);
    // Max shouldn't be too large
    expect(max).toBeLessThanOrEqual(50);
    // Ideal should be in middle range
    expect(ideal).toBeGreaterThanOrEqual(min);
    expect(ideal).toBeLessThanOrEqual(max);
  });
});

