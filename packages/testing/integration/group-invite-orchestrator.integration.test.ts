import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@babylon/db';
import { GroupInviteOrchestrator, StaticDataRegistry } from '@babylon/engine';
import { generateSnowflakeId } from '@babylon/shared';

const testIds = {
  userIds: [] as string[],
  actorIds: [] as string[],
  chatIds: [] as string[],
  candidateIds: [] as string[],
  inviteIds: [] as string[],
  membershipIds: [] as string[],
};

async function createTestUser(options: {
  isAgent?: boolean;
  username?: string;
  displayName?: string;
}) {
  const id = await generateSnowflakeId();
  const username = options.username || `test-user-${id.slice(-6)}`;
  const displayName = options.displayName || `Test User ${id.slice(-6)}`;
  await db.user.create({
    data: {
      id,
      username,
      displayName,
      isActor: false,
      isAgent: options.isAgent || false,
      isTest: true,
      updatedAt: new Date(),
    },
  });
  testIds.userIds.push(id);
  return { id, username, displayName, isAgent: options.isAgent || false };
}

async function createTestActor(options: { name?: string }) {
  const id = await generateSnowflakeId();
  const name = options.name || `Test NPC`;
  await db.user.create({
    data: {
      id,
      username: `test-npc-${id}`,
      displayName: `${name} ${id.slice(-6)}`,
      isActor: true,
      isTest: true,
      updatedAt: new Date(),
    },
  });
  await db.actorState.create({ data: { id, updatedAt: new Date() } });
  testIds.actorIds.push(id);
  testIds.userIds.push(id);
  return { id, name };
}

async function createTestGroupChat(options: {
  name?: string;
  npcAdminId: string;
}) {
  const id = await generateSnowflakeId();
  const name = options.name || `Test Group ${id.slice(-6)}`;
  await db.chat.create({
    data: {
      id,
      name,
      isGroup: true,
      npcAdminId: options.npcAdminId,
      updatedAt: new Date(),
    },
  });
  await db.chatParticipant.create({
    data: {
      id: await generateSnowflakeId(),
      chatId: id,
      userId: options.npcAdminId,
    },
  });
  testIds.chatIds.push(id);
  return { id, name };
}

async function cleanupTestData() {
  if (testIds.inviteIds.length > 0)
    await db.userGroupInvite.deleteMany({
      where: { id: { in: testIds.inviteIds } },
    });
  if (testIds.candidateIds.length > 0)
    await db.pendingGroupInviteCandidate.deleteMany({
      where: { id: { in: testIds.candidateIds } },
    });
  if (testIds.membershipIds.length > 0)
    await db.groupChatMembership.deleteMany({
      where: { id: { in: testIds.membershipIds } },
    });
  if (testIds.chatIds.length > 0) {
    await db.chatParticipant.deleteMany({
      where: { chatId: { in: testIds.chatIds } },
    });
    await db.chat.deleteMany({ where: { id: { in: testIds.chatIds } } });
  }
  if (testIds.userIds.length > 0)
    await db.user.deleteMany({ where: { id: { in: testIds.userIds } } });
  if (testIds.actorIds.length > 0)
    await db.actorState.deleteMany({ where: { id: { in: testIds.actorIds } } });

  await db.pendingGroupInviteCandidate.deleteMany({
    where: {
      OR: [
        { userId: { in: testIds.userIds } },
        { npcId: { in: testIds.actorIds } },
      ],
    },
  });
  await db.userGroupInvite.deleteMany({
    where: {
      OR: [
        { invitedUserId: { in: testIds.userIds } },
        { invitedBy: { in: testIds.actorIds } },
      ],
    },
  });

  testIds.userIds = [];
  testIds.actorIds = [];
  testIds.chatIds = [];
  testIds.candidateIds = [];
  testIds.inviteIds = [];
  testIds.membershipIds = [];
}

describe('Group Invite Orchestrator Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Candidate Queueing', () => {
    test('should queue user as invite candidate after quality interaction', async () => {
      const npc = await createTestActor({ name: 'Queue Test NPC' });
      const user = await createTestUser({ displayName: 'Quality User' });

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        triggerId: 'test-comment-123',
        engagementScore: 75,
        priorityMultiplier: 1.2,
      });

      expect(result.queued).toBe(true);

      // Verify candidate was created
      const candidates = await db.pendingGroupInviteCandidate.findMany({
        where: { userId: user.id, npcId: npc.id, processed: false },
      });

      expect(candidates.length).toBe(1);
      expect(candidates[0]?.triggerType).toBe('quality_reply');
      expect(candidates[0]?.engagementScore).toBe(75);
      expect(candidates[0]?.priorityMultiplier).toBe(1.2);
    });

    test('should not queue NPCs as invite candidates', async () => {
      const npc1 = await createTestActor({ name: 'NPC 1' });
      const npc2 = await createTestActor({ name: 'NPC 2' });

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: npc2.id, // Trying to queue an NPC
        npcId: npc1.id,
        triggerType: 'quality_reply',
        engagementScore: 80,
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('User is NPC or not found');
    });

    test('should not queue user already in group with NPC', async () => {
      const npc = await createTestActor({ name: 'Member Test NPC' });
      const user = await createTestUser({ displayName: 'Already Member' });
      const chat = await createTestGroupChat({
        name: 'Test Group',
        npcAdminId: npc.id,
      });

      // Add user as member
      const membershipId = await generateSnowflakeId();
      await db.groupChatMembership.create({
        data: {
          id: membershipId,
          userId: user.id,
          chatId: chat.id,
          npcAdminId: npc.id,
          isActive: true,
        },
      });
      testIds.membershipIds.push(membershipId);

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'follow',
        engagementScore: 90,
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('Already a member');
    });

    test('should update priority if already queued', async () => {
      const npc = await createTestActor({ name: 'Priority Test NPC' });
      const user = await createTestUser({ displayName: 'Priority User' });

      // First queue
      await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
        priorityMultiplier: 1.0,
      });

      // Second queue with higher priority
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'follow',
        engagementScore: 50,
        priorityMultiplier: 2.0,
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('Already queued (priority updated)');

      // Verify priority was updated
      const candidates = await db.pendingGroupInviteCandidate.findMany({
        where: { userId: user.id, npcId: npc.id, processed: false },
      });

      expect(candidates.length).toBe(1);
      expect(candidates[0]?.priorityMultiplier).toBe(2.0);
      expect(candidates[0]?.triggerType).toBe('follow');
    });

    test('should reject candidates with low engagement score', async () => {
      const npc = await createTestActor({ name: 'Low Score NPC' });
      const user = await createTestUser({ displayName: 'Low Score User' });

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'like_streak',
        engagementScore: 10, // Below MIN_ENGAGEMENT_SCORE of 25
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('Engagement score too low');
    });
  });

  describe('Candidate Processing', () => {
    test('should process queued candidates', async () => {
      const npc = await createTestActor({ name: 'Process Test NPC' });
      const user = await createTestUser({ displayName: 'Process User' });

      // Create a candidate manually
      const candidateId = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id: candidateId,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 80,
          triggerType: 'quality_reply',
          priorityMultiplier: 1.5,
          processed: false,
        },
      });
      testIds.candidateIds.push(candidateId);

      const result = await GroupInviteOrchestrator.processQueuedInvites();

      expect(result.candidatesProcessed).toBeGreaterThanOrEqual(1);
      // Result is probabilistic, so we just verify processing happened
    });

    test('should expire old candidates', async () => {
      const npc = await createTestActor({ name: 'Expire Test NPC' });
      const user = await createTestUser({ displayName: 'Expire User' });

      // Create an old candidate (3 days ago, beyond 48-hour expiry)
      const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const candidateId = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id: candidateId,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 80,
          triggerType: 'quality_reply',
          priorityMultiplier: 1.0,
          queuedAt: oldDate,
          processed: false,
        },
      });
      testIds.candidateIds.push(candidateId);

      const result = await GroupInviteOrchestrator.processQueuedInvites();

      expect(result.expired).toBeGreaterThanOrEqual(1);

      // Verify candidate was marked as expired
      const candidate = await db.pendingGroupInviteCandidate.findUnique({
        where: { id: candidateId },
      });
      expect(candidate?.processed).toBe(true);
      expect(candidate?.outcome).toBe('expired');
    });
  });

  describe('User Limits', () => {
    test('should respect maximum active groups limit', async () => {
      const user = await createTestUser({ displayName: 'Limit User' });

      // Create 5 active memberships (at the limit)
      for (let i = 0; i < 5; i++) {
        const npc = await createTestActor({ name: `Limit NPC ${i}` });
        const chat = await createTestGroupChat({
          name: `Limit Group ${i}`,
          npcAdminId: npc.id,
        });

        const membershipId = await generateSnowflakeId();
        await db.groupChatMembership.create({
          data: {
            id: membershipId,
            userId: user.id,
            chatId: chat.id,
            npcAdminId: npc.id,
            isActive: true,
          },
        });
        testIds.membershipIds.push(membershipId);
      }

      // Try to queue for a 6th group
      const newNpc = await createTestActor({ name: 'New NPC' });
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: newNpc.id,
        triggerType: 'quality_reply',
        engagementScore: 90,
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('At group limit');
    });
  });

  describe('Invite Expiration Cleanup', () => {
    test('should expire old pending invites', async () => {
      const npc = await createTestActor({ name: 'Cleanup NPC' });
      const user = await createTestUser({ displayName: 'Cleanup User' });

      // Create an old pending invite (4 days ago, beyond 3-day expiry)
      const oldDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const inviteId = await generateSnowflakeId();
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: 'dummy-group-id',
          invitedUserId: user.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: oldDate,
        },
      });
      testIds.inviteIds.push(inviteId);

      const expiredCount = await GroupInviteOrchestrator.expireOldInvites();

      expect(expiredCount).toBeGreaterThanOrEqual(1);

      // Verify invite was marked as expired
      const invite = await db.userGroupInvite.findUnique({
        where: { id: inviteId },
      });
      expect(invite?.status).toBe('expired');
    });

    test('should cleanup old processed candidates', async () => {
      const npc = await createTestActor({ name: 'Cleanup Candidate NPC' });
      const user = await createTestUser({
        displayName: 'Cleanup Candidate User',
      });

      // Create an old processed candidate (10 days ago, beyond 7-day cleanup)
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const candidateId = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id: candidateId,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 80,
          triggerType: 'quality_reply',
          priorityMultiplier: 1.0,
          processed: true,
          processedAt: oldDate,
          outcome: 'invited',
        },
      });
      testIds.candidateIds.push(candidateId);

      const cleanedCount =
        await GroupInviteOrchestrator.cleanupProcessedCandidates();

      expect(cleanedCount).toBeGreaterThanOrEqual(1);

      // Verify candidate was deleted
      const candidate = await db.pendingGroupInviteCandidate.findUnique({
        where: { id: candidateId },
      });
      expect(candidate).toBeNull();
    });
  });

  describe('Statistics', () => {
    test('should return invite statistics', async () => {
      const stats = await GroupInviteOrchestrator.getInviteStats();

      expect(typeof stats.pendingCandidates).toBe('number');
      expect(typeof stats.pendingInvites).toBe('number');
      expect(typeof stats.invitesLast24h).toBe('number');
      expect(typeof stats.acceptsLast24h).toBe('number');
    });

    test('should count pending candidates accurately', async () => {
      const npc = await createTestActor({ name: 'Stats NPC' });
      const user1 = await createTestUser({ displayName: 'Stats User 1' });
      const user2 = await createTestUser({ displayName: 'Stats User 2' });

      // Queue two candidates
      await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user1.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });
      await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user2.id,
        npcId: npc.id,
        triggerType: 'follow',
        engagementScore: 60,
      });

      const stats = await GroupInviteOrchestrator.getInviteStats();
      expect(stats.pendingCandidates).toBeGreaterThanOrEqual(2);
    });

    test('should use correct tier multipliers from StaticDataRegistry', async () => {
      // Verify StaticDataRegistry has actors with different tiers
      const allActors = StaticDataRegistry.getAllActors();
      expect(allActors.length).toBeGreaterThan(0);

      // Find actors with different tiers
      const sTierActor = allActors.find((a) => a.tier === 'S_TIER');
      const cTierActor = allActors.find((a) => a.tier === 'C_TIER');

      expect(sTierActor).toBeDefined();
      expect(cTierActor).toBeDefined();

      // Verify the tier lookup works
      const sTierLookup = StaticDataRegistry.getActor(sTierActor!.id);
      const cTierLookup = StaticDataRegistry.getActor(cTierActor!.id);

      expect(sTierLookup?.tier).toBe('S_TIER');
      expect(cTierLookup?.tier).toBe('C_TIER');
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle engagement score exactly at minimum threshold (25)', async () => {
      const npc = await createTestActor({ name: 'Boundary NPC' });
      const user = await createTestUser({ displayName: 'Boundary User' });

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 25, // Exactly at MIN_ENGAGEMENT_SCORE
      });

      expect(result.queued).toBe(true);
    });

    test('should reject engagement score one below minimum (24)', async () => {
      const npc = await createTestActor({ name: 'Boundary NPC 2' });
      const user = await createTestUser({ displayName: 'Boundary User 2' });

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 24, // One below threshold
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('Engagement score too low');
    });

    test('should handle maximum engagement score (100)', async () => {
      const npc = await createTestActor({ name: 'Max Score NPC' });
      const user = await createTestUser({ displayName: 'Max Score User' });

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 100,
      });

      expect(result.queued).toBe(true);

      // Verify stored correctly
      const candidates = await db.pendingGroupInviteCandidate.findMany({
        where: { userId: user.id, npcId: npc.id },
      });
      expect(candidates[0]?.engagementScore).toBe(100);
    });

    test('should handle exactly 4 active groups (one below limit)', async () => {
      const user = await createTestUser({ displayName: 'Near Limit User' });

      // Set joinedAt to 5 hours ago to avoid cooldown check (INVITE_COOLDOWN_HOURS = 4)
      const pastJoinedAt = new Date(Date.now() - 5 * 60 * 60 * 1000);

      // Create 4 active memberships
      for (let i = 0; i < 4; i++) {
        const npc = await createTestActor({ name: `Near Limit NPC ${i}` });
        const chat = await createTestGroupChat({
          name: `Near Limit Group ${i}`,
          npcAdminId: npc.id,
        });
        const membershipId = await generateSnowflakeId();
        await db.groupChatMembership.create({
          data: {
            id: membershipId,
            userId: user.id,
            chatId: chat.id,
            npcAdminId: npc.id,
            isActive: true,
            joinedAt: pastJoinedAt,
          },
        });
        testIds.membershipIds.push(membershipId);
      }

      // Should still be able to queue for 5th
      const newNpc = await createTestActor({ name: 'Fifth NPC' });
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: newNpc.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });

      expect(result.queued).toBe(true);
    });

    test('should handle candidate queued at exactly expiry boundary', async () => {
      const npc = await createTestActor({ name: 'Expiry Boundary NPC' });
      const user = await createTestUser({
        displayName: 'Expiry Boundary User',
      });

      // Create candidate at exactly 48 hours ago (CANDIDATE_EXPIRY_HOURS)
      const exactlyExpiredDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const candidateId = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id: candidateId,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 80,
          triggerType: 'quality_reply',
          priorityMultiplier: 1.0,
          queuedAt: exactlyExpiredDate,
          processed: false,
        },
      });
      testIds.candidateIds.push(candidateId);

      const result = await GroupInviteOrchestrator.processQueuedInvites();

      // Should be expired (threshold is < not <=)
      expect(result.expired).toBeGreaterThanOrEqual(1);
    });

    test('should handle invite cooldown exactly at boundary', async () => {
      const user = await createTestUser({
        displayName: 'Cooldown Boundary User',
      });
      const npc1 = await createTestActor({ name: 'Cooldown NPC 1' });
      const npc2 = await createTestActor({ name: 'Cooldown NPC 2' });
      const chat = await createTestGroupChat({
        name: 'Cooldown Group',
        npcAdminId: npc1.id,
      });

      // Create membership from exactly 4 hours ago (INVITE_COOLDOWN_HOURS)
      const exactlyCooldownDate = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const membershipId = await generateSnowflakeId();
      await db.groupChatMembership.create({
        data: {
          id: membershipId,
          userId: user.id,
          chatId: chat.id,
          npcAdminId: npc1.id,
          isActive: true,
          joinedAt: exactlyCooldownDate,
        },
      });
      testIds.membershipIds.push(membershipId);

      // Should be allowed (cooldown expired)
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc2.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });

      expect(result.queued).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent user gracefully', async () => {
      const npc = await createTestActor({ name: 'Error Test NPC' });
      const fakeUserId = await generateSnowflakeId();

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: fakeUserId,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('User is NPC or not found');
    });

    test('should handle inactive membership correctly', async () => {
      const npc = await createTestActor({ name: 'Inactive Membership NPC' });
      const user = await createTestUser({
        displayName: 'Inactive Membership User',
      });
      const chat = await createTestGroupChat({
        name: 'Inactive Group',
        npcAdminId: npc.id,
      });

      // Create INACTIVE membership
      const membershipId = await generateSnowflakeId();
      await db.groupChatMembership.create({
        data: {
          id: membershipId,
          userId: user.id,
          chatId: chat.id,
          npcAdminId: npc.id,
          isActive: false, // Inactive
        },
      });
      testIds.membershipIds.push(membershipId);

      // Should be allowed since membership is inactive
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });

      expect(result.queued).toBe(true);
    });

    test('should not update priority if new multiplier is <= 1.0', async () => {
      const npc = await createTestActor({ name: 'No Update NPC' });
      const user = await createTestUser({ displayName: 'No Update User' });

      // First queue with 1.5 priority
      await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
        priorityMultiplier: 1.5,
      });

      // Second queue with 1.0 priority - should NOT update
      await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'share',
        engagementScore: 50,
        priorityMultiplier: 1.0,
      });

      const candidates = await db.pendingGroupInviteCandidate.findMany({
        where: { userId: user.id, npcId: npc.id, processed: false },
      });

      expect(candidates[0]?.priorityMultiplier).toBe(1.5); // Original value
      expect(candidates[0]?.triggerType).toBe('quality_reply'); // Original trigger
    });
  });

  describe('Concurrent Behavior', () => {
    test('should handle concurrent queueing for same user-npc pair', async () => {
      const npc = await createTestActor({ name: 'Concurrent NPC' });
      const user = await createTestUser({ displayName: 'Concurrent User' });

      // Queue concurrently
      const results = await Promise.all([
        GroupInviteOrchestrator.queueInviteCandidate({
          userId: user.id,
          npcId: npc.id,
          triggerType: 'quality_reply',
          engagementScore: 50,
        }),
        GroupInviteOrchestrator.queueInviteCandidate({
          userId: user.id,
          npcId: npc.id,
          triggerType: 'follow',
          engagementScore: 60,
        }),
        GroupInviteOrchestrator.queueInviteCandidate({
          userId: user.id,
          npcId: npc.id,
          triggerType: 'share',
          engagementScore: 55,
        }),
      ]);

      // At most one should succeed
      const successCount = results.filter((r) => r.queued).length;
      expect(successCount).toBeLessThanOrEqual(1);

      // Verify only one candidate exists
      const candidates = await db.pendingGroupInviteCandidate.findMany({
        where: { userId: user.id, npcId: npc.id, processed: false },
      });
      expect(candidates.length).toBe(1);
    });

    test('should handle concurrent processing runs', async () => {
      const npc = await createTestActor({ name: 'Concurrent Process NPC' });

      // Create multiple candidates
      for (let i = 0; i < 5; i++) {
        const user = await createTestUser({
          displayName: `Concurrent Process User ${i}`,
        });
        await GroupInviteOrchestrator.queueInviteCandidate({
          userId: user.id,
          npcId: npc.id,
          triggerType: 'quality_reply',
          engagementScore: 50 + i * 10,
        });
      }

      // Run processing concurrently - verify it doesn't throw
      const results = await Promise.all([
        GroupInviteOrchestrator.processQueuedInvites(),
        GroupInviteOrchestrator.processQueuedInvites(),
      ]);

      // Both should return valid results (not throw)
      expect(results.length).toBe(2);
      expect(typeof results[0]?.candidatesProcessed).toBe('number');
      expect(typeof results[1]?.candidatesProcessed).toBe('number');
      expect(results[0]?.candidatesProcessed).toBeGreaterThanOrEqual(0);
      expect(results[1]?.candidatesProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Verification', () => {
    test('should store all candidate fields correctly', async () => {
      const npc = await createTestActor({ name: 'Data Verify NPC' });
      const user = await createTestUser({ displayName: 'Data Verify User' });
      const chat = await createTestGroupChat({
        name: 'Data Verify Group',
        npcAdminId: npc.id,
      });

      const beforeQueue = new Date();
      await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        triggerId: 'trigger-123',
        engagementScore: 75.5,
        priorityMultiplier: 1.8,
      });
      const afterQueue = new Date();

      const [candidate] = await db.pendingGroupInviteCandidate.findMany({
        where: { userId: user.id, npcId: npc.id },
      });

      expect(candidate).toBeDefined();
      expect(candidate?.userId).toBe(user.id);
      expect(candidate?.npcId).toBe(npc.id);
      expect(candidate?.groupChatId).toBe(chat.id);
      expect(candidate?.triggerType).toBe('quality_reply');
      expect(candidate?.triggerId).toBe('trigger-123');
      expect(candidate?.engagementScore).toBe(75.5);
      expect(candidate?.priorityMultiplier).toBe(1.8);
      expect(candidate?.processed).toBe(false);
      expect(candidate?.outcome).toBeNull();
      expect(candidate?.processedAt).toBeNull();

      // Verify queuedAt is within expected range
      expect(candidate?.queuedAt.getTime()).toBeGreaterThanOrEqual(
        beforeQueue.getTime()
      );
      expect(candidate?.queuedAt.getTime()).toBeLessThanOrEqual(
        afterQueue.getTime()
      );
    });

    test('should mark processed candidates with correct outcome and timestamp', async () => {
      const npc = await createTestActor({ name: 'Outcome Verify NPC' });
      const user = await createTestUser({ displayName: 'Outcome Verify User' });

      // Create expired candidate
      const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const candidateId = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id: candidateId,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 80,
          triggerType: 'quality_reply',
          priorityMultiplier: 1.0,
          queuedAt: oldDate,
          processed: false,
        },
      });
      testIds.candidateIds.push(candidateId);

      const beforeProcess = new Date();
      await GroupInviteOrchestrator.processQueuedInvites();
      const afterProcess = new Date();

      const candidate = await db.pendingGroupInviteCandidate.findUnique({
        where: { id: candidateId },
      });

      expect(candidate?.processed).toBe(true);
      expect(candidate?.outcome).toBe('expired');
      expect(candidate?.processedAt).toBeDefined();
      expect(candidate?.processedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeProcess.getTime()
      );
      expect(candidate?.processedAt!.getTime()).toBeLessThanOrEqual(
        afterProcess.getTime()
      );
    });

    test('should update invite status and respondedAt on expiration', async () => {
      const npc = await createTestActor({ name: 'Invite Status NPC' });
      const user = await createTestUser({ displayName: 'Invite Status User' });

      const oldDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const inviteId = await generateSnowflakeId();
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: 'dummy-group',
          invitedUserId: user.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: oldDate,
        },
      });
      testIds.inviteIds.push(inviteId);

      const beforeExpire = new Date();
      await GroupInviteOrchestrator.expireOldInvites();
      const afterExpire = new Date();

      const invite = await db.userGroupInvite.findUnique({
        where: { id: inviteId },
      });

      expect(invite?.status).toBe('expired');
      expect(invite?.respondedAt).toBeDefined();
      expect(invite?.respondedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeExpire.getTime()
      );
      expect(invite?.respondedAt!.getTime()).toBeLessThanOrEqual(
        afterExpire.getTime()
      );
    });
  });

  describe('All Trigger Types', () => {
    test.each([
      'quality_reply',
      'follow',
      'trade',
      'share',
      'like_streak',
      'manual',
    ] as const)('should accept trigger type: %s', async (triggerType) => {
      const npc = await createTestActor({ name: `Trigger ${triggerType} NPC` });
      const user = await createTestUser({
        displayName: `Trigger ${triggerType} User`,
      });

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType,
        engagementScore: 50,
      });

      expect(result.queued).toBe(true);

      const [candidate] = await db.pendingGroupInviteCandidate.findMany({
        where: { userId: user.id, npcId: npc.id },
      });
      expect(candidate?.triggerType).toBe(triggerType);
    });
  });
});

describe('Agent Invite Parity', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  test('agents should be queued for invites same as regular users', async () => {
    const npc = await createTestActor({ name: 'Agent Parity NPC' });
    const regularUser = await createTestUser({
      isAgent: false,
      displayName: 'Regular User',
    });
    const agentUser = await createTestUser({
      isAgent: true,
      displayName: 'Agent User',
    });

    // Both should be able to be queued
    const regularResult = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: regularUser.id,
      npcId: npc.id,
      triggerType: 'quality_reply',
      engagementScore: 70,
    });

    const agentResult = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: agentUser.id,
      npcId: npc.id,
      triggerType: 'quality_reply',
      engagementScore: 70,
    });

    expect(regularResult.queued).toBe(true);
    expect(agentResult.queued).toBe(true);
  });

  test('agents should have same limit behavior as regular users', async () => {
    const agent = await createTestUser({
      isAgent: true,
      displayName: 'Limited Agent',
    });

    // Create 5 active memberships (at limit)
    for (let i = 0; i < 5; i++) {
      const npc = await createTestActor({ name: `Agent Limit NPC ${i}` });
      const chat = await createTestGroupChat({
        name: `Agent Limit Group ${i}`,
        npcAdminId: npc.id,
      });
      const membershipId = await generateSnowflakeId();
      await db.groupChatMembership.create({
        data: {
          id: membershipId,
          userId: agent.id,
          chatId: chat.id,
          npcAdminId: npc.id,
          isActive: true,
        },
      });
      testIds.membershipIds.push(membershipId);
    }

    const newNpc = await createTestActor({ name: 'New Agent Limit NPC' });
    const result = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: agent.id,
      npcId: newNpc.id,
      triggerType: 'quality_reply',
      engagementScore: 90,
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe('At group limit');
  });

  test('agents should be processed same as users in queue', async () => {
    const npc = await createTestActor({ name: 'Agent Process NPC' });
    const user = await createTestUser({
      isAgent: false,
      displayName: 'Process User',
    });
    const agent = await createTestUser({
      isAgent: true,
      displayName: 'Process Agent',
    });

    // Queue both
    await GroupInviteOrchestrator.queueInviteCandidate({
      userId: user.id,
      npcId: npc.id,
      triggerType: 'quality_reply',
      engagementScore: 50,
    });
    await GroupInviteOrchestrator.queueInviteCandidate({
      userId: agent.id,
      npcId: npc.id,
      triggerType: 'quality_reply',
      engagementScore: 50,
    });

    // Both should be in queue
    const candidates = await db.pendingGroupInviteCandidate.findMany({
      where: { npcId: npc.id, processed: false },
    });

    expect(candidates.length).toBe(2);
    expect(candidates.map((c) => c.userId).sort()).toEqual(
      [user.id, agent.id].sort()
    );
  });
});

describe('Cleanup Edge Cases', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  test('should not delete candidates processed less than 7 days ago', async () => {
    const npc = await createTestActor({ name: 'Recent Cleanup NPC' });
    const user = await createTestUser({ displayName: 'Recent Cleanup User' });

    // Create candidate processed 6 days ago (should NOT be cleaned)
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const candidateId = await generateSnowflakeId();
    await db.pendingGroupInviteCandidate.create({
      data: {
        id: candidateId,
        userId: user.id,
        npcId: npc.id,
        engagementScore: 80,
        triggerType: 'quality_reply',
        priorityMultiplier: 1.0,
        processed: true,
        processedAt: sixDaysAgo,
        outcome: 'invited',
      },
    });
    testIds.candidateIds.push(candidateId);

    await GroupInviteOrchestrator.cleanupProcessedCandidates();

    // Should still exist
    const candidate = await db.pendingGroupInviteCandidate.findUnique({
      where: { id: candidateId },
    });
    expect(candidate).not.toBeNull();
  });

  test('should not expire invites less than 3 days old', async () => {
    const npc = await createTestActor({ name: 'Recent Invite NPC' });
    const user = await createTestUser({ displayName: 'Recent Invite User' });

    // Create invite from 2 days ago (should NOT be expired)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const inviteId = await generateSnowflakeId();
    await db.userGroupInvite.create({
      data: {
        id: inviteId,
        groupId: 'dummy-group',
        invitedUserId: user.id,
        invitedBy: npc.id,
        status: 'pending',
        invitedAt: twoDaysAgo,
      },
    });
    testIds.inviteIds.push(inviteId);

    await GroupInviteOrchestrator.expireOldInvites();

    // Should still be pending
    const invite = await db.userGroupInvite.findUnique({
      where: { id: inviteId },
    });
    expect(invite?.status).toBe('pending');
  });

  test('should not affect non-pending invites', async () => {
    const npc = await createTestActor({ name: 'Accepted Invite NPC' });
    const user = await createTestUser({ displayName: 'Accepted Invite User' });

    // Create old but already accepted invite
    const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const inviteId = await generateSnowflakeId();
    await db.userGroupInvite.create({
      data: {
        id: inviteId,
        groupId: 'dummy-group',
        invitedUserId: user.id,
        invitedBy: npc.id,
        status: 'accepted',
        invitedAt: oldDate,
      },
    });
    testIds.inviteIds.push(inviteId);

    await GroupInviteOrchestrator.expireOldInvites();

    // Should still be accepted (not changed to expired)
    const invite = await db.userGroupInvite.findUnique({
      where: { id: inviteId },
    });
    expect(invite?.status).toBe('accepted');
  });

  test('should not affect unprocessed candidates in cleanup', async () => {
    const npc = await createTestActor({ name: 'Unprocessed Cleanup NPC' });
    const user = await createTestUser({
      displayName: 'Unprocessed Cleanup User',
    });

    // Create old but unprocessed candidate
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const candidateId = await generateSnowflakeId();
    await db.pendingGroupInviteCandidate.create({
      data: {
        id: candidateId,
        userId: user.id,
        npcId: npc.id,
        engagementScore: 80,
        triggerType: 'quality_reply',
        priorityMultiplier: 1.0,
        queuedAt: oldDate,
        processed: false, // Not processed
      },
    });
    testIds.candidateIds.push(candidateId);

    await GroupInviteOrchestrator.cleanupProcessedCandidates();

    // Should still exist (cleanup only removes processed candidates)
    const candidate = await db.pendingGroupInviteCandidate.findUnique({
      where: { id: candidateId },
    });
    expect(candidate).not.toBeNull();
    expect(candidate?.processed).toBe(false);
  });
});

describe('Full Flow Integration', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  test('complete flow: queue → process → invite → accept', async () => {
    // 1. Create user and NPC with group
    const npc = await createTestActor({ name: 'Flow Test NPC' });
    const user = await createTestUser({ displayName: 'Flow Test User' });
    const chat = await createTestGroupChat({
      name: 'Flow Test Group',
      npcAdminId: npc.id,
    });

    // 2. Queue the user via orchestrator (simulates trigger from reply/follow/share)
    const queueResult = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: user.id,
      npcId: npc.id,
      triggerType: 'quality_reply',
      engagementScore: 100, // Max score to guarantee high probability
      priorityMultiplier: 10.0, // Very high priority to ensure selection
    });
    expect(queueResult.queued).toBe(true);

    // 3. Verify candidate exists in queue
    const [candidate] = await db.pendingGroupInviteCandidate.findMany({
      where: { userId: user.id, npcId: npc.id, processed: false },
    });
    expect(candidate).toBeDefined();
    expect(candidate?.engagementScore).toBe(100);

    // 4. Process the queue multiple times to ensure invite is sent (probability-based)
    let inviteSent = false;
    for (let attempt = 0; attempt < 20 && !inviteSent; attempt++) {
      const result = await GroupInviteOrchestrator.processQueuedInvites();
      if (result.invitesSent > 0) {
        inviteSent = true;
      }
    }
    expect(inviteSent).toBe(true);

    // 5. Verify invite was created
    const [invite] = await db.userGroupInvite.findMany({
      where: { invitedUserId: user.id, invitedBy: npc.id, status: 'pending' },
    });
    expect(invite).toBeDefined();
    expect(invite?.groupId).toBe(chat.id);
    testIds.inviteIds.push(invite!.id);

    // 6. Verify candidate is marked as processed
    const processedCandidate = await db.pendingGroupInviteCandidate.findUnique({
      where: { id: candidate!.id },
    });
    expect(processedCandidate?.processed).toBe(true);
    expect(processedCandidate?.outcome).toBe('invited');

    // 7. Accept the invite (simulates user accepting via UI/API)
    await db.userGroupInvite.update({
      where: { id: invite!.id },
      data: { status: 'accepted', respondedAt: new Date() },
    });
    const membershipId = await generateSnowflakeId();
    await db.chatParticipant.create({
      data: {
        id: await generateSnowflakeId(),
        chatId: chat.id,
        userId: user.id,
        invitedBy: npc.id,
      },
    });
    await db.groupChatMembership.create({
      data: {
        id: membershipId,
        userId: user.id,
        chatId: chat.id,
        npcAdminId: npc.id,
        isActive: true,
      },
    });
    testIds.membershipIds.push(membershipId);

    // 8. Verify user is now a member
    const membership = await db.groupChatMembership.findUnique({
      where: { id: membershipId },
    });
    expect(membership?.isActive).toBe(true);

    // 9. Verify user can no longer be queued for same NPC (already a member)
    const reQueueResult = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: user.id,
      npcId: npc.id,
      triggerType: 'follow',
      engagementScore: 100,
    });
    expect(reQueueResult.queued).toBe(false);
    expect(reQueueResult.reason).toBe('Already a member');
  });
});
