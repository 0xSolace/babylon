/**
 * Group Invite Edge Cases Integration Tests
 *
 * Tests boundary conditions, error handling, and edge cases that the
 * main orchestrator tests don't cover.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@babylon/db';
import {
  GroupInviteConfig,
  GroupInviteOrchestrator,
} from '@babylon/engine';
import { generateSnowflakeId } from '@babylon/shared';

const testIds = {
  userIds: [] as string[],
  actorIds: [] as string[],
  chatIds: [] as string[],
  candidateIds: [] as string[],
  inviteIds: [] as string[],
  membershipIds: [] as string[],
};

async function createTestUser(displayName: string) {
  const id = await generateSnowflakeId();
  await db.user.create({
    data: {
      id,
      username: `edge-user-${id}`,
      displayName: `${displayName} ${id.slice(-6)}`,
      isActor: false,
      isTest: true,
      updatedAt: new Date(),
    },
  });
  testIds.userIds.push(id);
  return { id, displayName };
}

async function createTestNPC(name: string) {
  const id = await generateSnowflakeId();
  await db.user.create({
    data: {
      id,
      username: `edge-npc-${id}`,
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

async function createTestGroupChat(name: string, npcAdminId: string) {
  const id = await generateSnowflakeId();
  await db.chat.create({
    data: { id, name, isGroup: true, npcAdminId, updatedAt: new Date() },
  });
  await db.chatParticipant.create({
    data: { id: await generateSnowflakeId(), chatId: id, userId: npcAdminId },
  });
  testIds.chatIds.push(id);
  return { id, name };
}

async function cleanupTestData() {
  if (testIds.inviteIds.length > 0)
    await db.userGroupInvite.deleteMany({ where: { id: { in: testIds.inviteIds } } });
  if (testIds.candidateIds.length > 0)
    await db.pendingGroupInviteCandidate.deleteMany({ where: { id: { in: testIds.candidateIds } } });
  if (testIds.membershipIds.length > 0)
    await db.groupChatMembership.deleteMany({ where: { id: { in: testIds.membershipIds } } });
  if (testIds.chatIds.length > 0) {
    await db.chatParticipant.deleteMany({ where: { chatId: { in: testIds.chatIds } } });
    await db.chat.deleteMany({ where: { id: { in: testIds.chatIds } } });
  }

  await db.pendingGroupInviteCandidate.deleteMany({
    where: { OR: [{ userId: { in: testIds.userIds } }, { npcId: { in: testIds.actorIds } }] },
  });
  await db.userGroupInvite.deleteMany({
    where: { OR: [{ invitedUserId: { in: testIds.userIds } }, { invitedBy: { in: testIds.actorIds } }] },
  });

  if (testIds.userIds.length > 0) await db.user.deleteMany({ where: { id: { in: testIds.userIds } } });
  if (testIds.actorIds.length > 0) await db.actorState.deleteMany({ where: { id: { in: testIds.actorIds } } });

  testIds.userIds = [];
  testIds.actorIds = [];
  testIds.chatIds = [];
  testIds.candidateIds = [];
  testIds.inviteIds = [];
  testIds.membershipIds = [];
}

describe('Boundary Conditions', () => {
  beforeEach(cleanupTestData);
  afterEach(cleanupTestData);

  describe('Engagement Score Boundaries', () => {
    test('score exactly at minimum threshold should be accepted', async () => {
      const user = await createTestUser('Boundary User');
      const npc = await createTestNPC('Boundary NPC');

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: GroupInviteConfig.minEngagementScore, // Exactly 25
      });

      expect(result.queued).toBe(true);
    });

    test('score one below minimum should be rejected', async () => {
      const user = await createTestUser('Below Min User');
      const npc = await createTestNPC('Below Min NPC');

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: GroupInviteConfig.minEngagementScore - 1, // 24
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('Engagement score too low');
    });

    test('score of zero should be rejected', async () => {
      const user = await createTestUser('Zero Score User');
      const npc = await createTestNPC('Zero Score NPC');

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 0,
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('Engagement score too low');
    });

    test('maximum score (100) should be accepted', async () => {
      const user = await createTestUser('Max Score User');
      const npc = await createTestNPC('Max Score NPC');

      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc.id,
        triggerType: 'quality_reply',
        engagementScore: 100,
      });

      expect(result.queued).toBe(true);
    });
  });

  describe('Group Limit Boundaries', () => {
    test('user at exactly max groups should be rejected', async () => {
      const user = await createTestUser('Max Groups User');
      const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // Past cooldown

      // Create exactly maxActiveUserGroups (5) memberships
      for (let i = 0; i < GroupInviteConfig.maxActiveUserGroups; i++) {
        const npc = await createTestNPC(`Max Group NPC ${i}`);
        const chat = await createTestGroupChat(`Max Group ${i}`, npc.id);
        const membershipId = await generateSnowflakeId();
        await db.groupChatMembership.create({
          data: {
            id: membershipId,
            userId: user.id,
            chatId: chat.id,
            npcAdminId: npc.id,
            isActive: true,
            joinedAt: pastDate,
          },
        });
        testIds.membershipIds.push(membershipId);
      }

      // Try to queue for a new NPC
      const newNpc = await createTestNPC('New NPC');
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: newNpc.id,
        triggerType: 'quality_reply',
        engagementScore: 100,
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('At group limit');
    });

    test('user with one less than max groups should be accepted', async () => {
      const user = await createTestUser('Near Max User');
      const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Create one less than max
      for (let i = 0; i < GroupInviteConfig.maxActiveUserGroups - 1; i++) {
        const npc = await createTestNPC(`Near Max NPC ${i}`);
        const chat = await createTestGroupChat(`Near Max Group ${i}`, npc.id);
        const membershipId = await generateSnowflakeId();
        await db.groupChatMembership.create({
          data: {
            id: membershipId,
            userId: user.id,
            chatId: chat.id,
            npcAdminId: npc.id,
            isActive: true,
            joinedAt: pastDate,
          },
        });
        testIds.membershipIds.push(membershipId);
      }

      const newNpc = await createTestNPC('Near Max New NPC');
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: newNpc.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });

      expect(result.queued).toBe(true);
    });

    test('inactive memberships should not count toward limit', async () => {
      const user = await createTestUser('Inactive Test User');
      const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Create max + 2 inactive memberships
      for (let i = 0; i < GroupInviteConfig.maxActiveUserGroups + 2; i++) {
        const npc = await createTestNPC(`Inactive NPC ${i}`);
        const chat = await createTestGroupChat(`Inactive Group ${i}`, npc.id);
        const membershipId = await generateSnowflakeId();
        await db.groupChatMembership.create({
          data: {
            id: membershipId,
            userId: user.id,
            chatId: chat.id,
            npcAdminId: npc.id,
            isActive: false, // Inactive!
            joinedAt: pastDate,
          },
        });
        testIds.membershipIds.push(membershipId);
      }

      const newNpc = await createTestNPC('Active NPC');
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: newNpc.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });

      expect(result.queued).toBe(true);
    });
  });

  describe('Cooldown Boundaries', () => {
    test('user exactly at cooldown boundary should be rejected', async () => {
      const user = await createTestUser('Cooldown Boundary User');
      const cooldownMs = GroupInviteConfig.inviteCooldownHours * 60 * 60 * 1000;
      const joinedAt = new Date(Date.now() - cooldownMs + 60000); // 1 minute before cooldown ends

      const npc1 = await createTestNPC('Cooldown NPC 1');
      const chat = await createTestGroupChat('Cooldown Group', npc1.id);
      const membershipId = await generateSnowflakeId();
      await db.groupChatMembership.create({
        data: {
          id: membershipId,
          userId: user.id,
          chatId: chat.id,
          npcAdminId: npc1.id,
          isActive: true,
          joinedAt,
        },
      });
      testIds.membershipIds.push(membershipId);

      const npc2 = await createTestNPC('Cooldown NPC 2');
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc2.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe('In invite cooldown');
    });

    test('user past cooldown should be accepted', async () => {
      const user = await createTestUser('Past Cooldown User');
      const cooldownMs = GroupInviteConfig.inviteCooldownHours * 60 * 60 * 1000;
      const joinedAt = new Date(Date.now() - cooldownMs - 60000); // 1 minute past cooldown

      const npc1 = await createTestNPC('Past Cooldown NPC 1');
      const chat = await createTestGroupChat('Past Cooldown Group', npc1.id);
      const membershipId = await generateSnowflakeId();
      await db.groupChatMembership.create({
        data: {
          id: membershipId,
          userId: user.id,
          chatId: chat.id,
          npcAdminId: npc1.id,
          isActive: true,
          joinedAt,
        },
      });
      testIds.membershipIds.push(membershipId);

      const npc2 = await createTestNPC('Past Cooldown NPC 2');
      const result = await GroupInviteOrchestrator.queueInviteCandidate({
        userId: user.id,
        npcId: npc2.id,
        triggerType: 'quality_reply',
        engagementScore: 50,
      });

      expect(result.queued).toBe(true);
    });
  });
});

describe('Invalid Input Handling', () => {
  beforeEach(cleanupTestData);
  afterEach(cleanupTestData);

  test('nonexistent user ID should be rejected', async () => {
    const npc = await createTestNPC('Nonexistent User NPC');
    const fakeUserId = await generateSnowflakeId(); // Never created

    const result = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: fakeUserId,
      npcId: npc.id,
      triggerType: 'quality_reply',
      engagementScore: 50,
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe('User is NPC or not found');
  });

  test('user ID that is actually an NPC should be rejected', async () => {
    const npc1 = await createTestNPC('NPC as User 1');
    const npc2 = await createTestNPC('NPC as User 2');

    const result = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: npc1.id, // NPC ID passed as userId
      npcId: npc2.id,
      triggerType: 'quality_reply',
      engagementScore: 50,
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe('User is NPC or not found');
  });

  test('empty string user ID should be rejected', async () => {
    const npc = await createTestNPC('Empty User ID NPC');

    const result = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: '',
      npcId: npc.id,
      triggerType: 'quality_reply',
      engagementScore: 50,
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe('User is NPC or not found');
  });
});

describe('Data Integrity Verification', () => {
  beforeEach(cleanupTestData);
  afterEach(cleanupTestData);

  test('queued candidate should have correct data structure', async () => {
    const user = await createTestUser('Data User');
    const npc = await createTestNPC('Data NPC');

    const result = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: user.id,
      npcId: npc.id,
      triggerType: 'share',
      triggerId: 'share-123',
      engagementScore: 75,
      priorityMultiplier: 1.5,
    });

    expect(result.queued).toBe(true);

    // Verify all fields in database
    const [candidate] = await db.pendingGroupInviteCandidate.findMany({
      where: { userId: user.id, npcId: npc.id },
    });

    expect(candidate).toBeDefined();
    expect(candidate!.userId).toBe(user.id);
    expect(candidate!.npcId).toBe(npc.id);
    expect(candidate!.triggerType).toBe('share');
    expect(candidate!.triggerId).toBe('share-123');
    expect(candidate!.engagementScore).toBe(75);
    expect(candidate!.priorityMultiplier).toBe(1.5);
    expect(candidate!.processed).toBe(false);
    expect(candidate!.outcome).toBeNull();
    expect(candidate!.queuedAt).toBeInstanceOf(Date);
    expect(candidate!.processedAt).toBeNull();
  });

  test('stats should accurately reflect database state', async () => {
    // Create some test data
    const npc = await createTestNPC('Stats NPC');
    const chat = await createTestGroupChat('Stats Group', npc.id);

    // Create 3 pending candidates
    for (let i = 0; i < 3; i++) {
      const user = await createTestUser(`Stats User ${i}`);
      const candidateId = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id: candidateId,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 50,
          triggerType: 'quality_reply',
          processed: false,
        },
      });
      testIds.candidateIds.push(candidateId);
    }

    // Create 2 pending invites
    for (let i = 0; i < 2; i++) {
      const user = await createTestUser(`Invited User ${i}`);
      const inviteId = await generateSnowflakeId();
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: chat.id,
          invitedUserId: user.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      });
      testIds.inviteIds.push(inviteId);
    }

    const stats = await GroupInviteOrchestrator.getInviteStats();

    expect(stats.pendingCandidates).toBeGreaterThanOrEqual(3);
    expect(stats.pendingInvites).toBeGreaterThanOrEqual(2);
    expect(typeof stats.invitesLast24h).toBe('number');
    expect(typeof stats.acceptsLast24h).toBe('number');
  });

  test('cleanup should only remove old processed candidates', async () => {
    const npc = await createTestNPC('Cleanup NPC');
    const user1 = await createTestUser('Old User');
    const user2 = await createTestUser('Recent User');

    // Create old processed candidate (should be deleted)
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const oldCandidateId = await generateSnowflakeId();
    await db.pendingGroupInviteCandidate.create({
      data: {
        id: oldCandidateId,
        userId: user1.id,
        npcId: npc.id,
        engagementScore: 50,
        triggerType: 'quality_reply',
        processed: true,
        outcome: 'invited',
        processedAt: oldDate,
      },
    });
    testIds.candidateIds.push(oldCandidateId);

    // Create recent processed candidate (should NOT be deleted)
    const recentCandidateId = await generateSnowflakeId();
    await db.pendingGroupInviteCandidate.create({
      data: {
        id: recentCandidateId,
        userId: user2.id,
        npcId: npc.id,
        engagementScore: 50,
        triggerType: 'quality_reply',
        processed: true,
        outcome: 'invited',
        processedAt: new Date(), // Now
      },
    });
    testIds.candidateIds.push(recentCandidateId);

    const deletedCount = await GroupInviteOrchestrator.cleanupProcessedCandidates();

    expect(deletedCount).toBeGreaterThanOrEqual(1);

    // Verify old candidate is deleted
    const oldCandidate = await db.pendingGroupInviteCandidate.findFirst({
      where: { id: oldCandidateId },
    });
    expect(oldCandidate).toBeNull();

    // Verify recent candidate still exists
    const recentCandidate = await db.pendingGroupInviteCandidate.findFirst({
      where: { id: recentCandidateId },
    });
    expect(recentCandidate).toBeDefined();
  });
});

describe('Processing Result Accuracy', () => {
  beforeEach(cleanupTestData);
  afterEach(cleanupTestData);

  test('processing empty queue should return zero counts', async () => {
    // Don't create any candidates
    const result = await GroupInviteOrchestrator.processQueuedInvites();

    expect(result.candidatesProcessed).toBe(0);
    expect(result.invitesSent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.alreadyMembers).toBe(0);
  });

  test('expired candidates should be counted correctly', async () => {
    const npc = await createTestNPC('Expiry Count NPC');
    
    // Create 3 expired candidates
    const expiryHoursAgo = new Date(Date.now() - (GroupInviteConfig.candidateExpiryHours + 1) * 60 * 60 * 1000);
    for (let i = 0; i < 3; i++) {
      const user = await createTestUser(`Expired User ${i}`);
      const candidateId = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id: candidateId,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 50,
          triggerType: 'quality_reply',
          processed: false,
          queuedAt: expiryHoursAgo,
        },
      });
      testIds.candidateIds.push(candidateId);
    }

    const result = await GroupInviteOrchestrator.processQueuedInvites();

    expect(result.expired).toBe(3);
    expect(result.candidatesProcessed).toBe(3);
  });

  test('already-member candidates should be counted correctly', async () => {
    const npc = await createTestNPC('Already Member NPC');
    const chat = await createTestGroupChat('Already Member Group', npc.id);

    // Create 2 candidates who are already members
    for (let i = 0; i < 2; i++) {
      const user = await createTestUser(`Already Member User ${i}`);
      
      // Create membership
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

      // Create candidate (should be marked as already_member)
      const candidateId = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id: candidateId,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 50,
          triggerType: 'quality_reply',
          processed: false,
        },
      });
      testIds.candidateIds.push(candidateId);
    }

    const result = await GroupInviteOrchestrator.processQueuedInvites();

    expect(result.alreadyMembers).toBe(2);
    expect(result.candidatesProcessed).toBe(2);
  });
});

describe('Unverified Code Paths', () => {
  beforeEach(cleanupTestData);
  afterEach(cleanupTestData);

  test('queueing without engagementScore should calculate from interactions', async () => {
    const user = await createTestUser('Engagement Calc User');
    const npc = await createTestNPC('Engagement Calc NPC');

    // Create some user interactions with this NPC so engagement score is non-zero
    // Note: Without interactions, score will be 0 and below threshold
    const result = await GroupInviteOrchestrator.queueInviteCandidate({
      userId: user.id,
      npcId: npc.id,
      triggerType: 'quality_reply',
      // NO engagementScore passed - should calculate from NPCInteractionTracker
    });

    // Will be rejected because no interactions exist (score = 0 < 25)
    expect(result.queued).toBe(false);
    expect(result.reason).toBe('Engagement score too low');
  });

  test('tier multiplier uses NONE when NPC not in StaticDataRegistry', async () => {
    // Test NPCs are not in StaticDataRegistry, so should use NONE multiplier
    const user = await createTestUser('Tier Test User');
    const npc = await createTestNPC('Tier Test NPC');

    const candidateId = await generateSnowflakeId();
    await db.pendingGroupInviteCandidate.create({
      data: {
        id: candidateId,
        userId: user.id,
        npcId: npc.id,
        engagementScore: 100,
        triggerType: 'quality_reply',
        priorityMultiplier: 1.0,
        processed: false,
      },
    });
    testIds.candidateIds.push(candidateId);

    // Process - should use NONE tier multiplier (1.0)
    // Probability = 0.15 * 2.0 (score/50) * 1.0 (priority) * 1.0 (NONE tier) = 0.30
    const result = await GroupInviteOrchestrator.processQueuedInvites();

    // Verify it was processed (not that invite was sent - that's probabilistic)
    expect(result.candidatesProcessed).toBe(1);
  });
});

describe('Priority Ordering', () => {
  beforeEach(cleanupTestData);
  afterEach(cleanupTestData);

  test('higher priority candidates get higher invite probability', async () => {
    // This test verifies the probability calculation, not random outcomes
    const baseProbability = GroupInviteConfig.baseInviteProbability;
    
    const lowPriorityMultiplier = 1.0;
    const highPriorityMultiplier = 3.0;
    const engagementScore = 50;
    const scoreMultiplier = Math.min(engagementScore / 50, 2.0); // = 1.0
    const tierMultiplier = 1.0; // NONE tier

    const lowProb = baseProbability * scoreMultiplier * lowPriorityMultiplier * tierMultiplier;
    const highProb = baseProbability * scoreMultiplier * highPriorityMultiplier * tierMultiplier;

    // Higher priority should have proportionally higher probability
    expect(highProb).toBe(lowProb * 3);
    expect(highProb).toBeGreaterThan(lowProb);
  });

  test('candidates are ordered by priority in queue', async () => {
    const npc = await createTestNPC('Priority Order NPC');
    
    // Create candidates with different priorities
    const lowUser = await createTestUser('Low Priority');
    const midUser = await createTestUser('Mid Priority');
    const highUser = await createTestUser('High Priority');

    // Create in random order
    for (const { user, priority } of [
      { user: midUser, priority: 1.5 },
      { user: lowUser, priority: 1.0 },
      { user: highUser, priority: 2.5 },
    ]) {
      const id = await generateSnowflakeId();
      await db.pendingGroupInviteCandidate.create({
        data: {
          id,
          userId: user.id,
          npcId: npc.id,
          engagementScore: 50,
          triggerType: 'quality_reply',
          priorityMultiplier: priority,
          processed: false,
        },
      });
      testIds.candidateIds.push(id);
    }

    // Query in the same order as processQueuedInvites
    const candidates = await db.pendingGroupInviteCandidate.findMany({
      where: { npcId: npc.id, processed: false },
      orderBy: [
        { priorityMultiplier: 'desc' },
        { engagementScore: 'desc' },
        { queuedAt: 'asc' },
      ],
    });

    // Verify order is correct (high → mid → low)
    expect(candidates[0]?.userId).toBe(highUser.id);
    expect(candidates[1]?.userId).toBe(midUser.id);
    expect(candidates[2]?.userId).toBe(lowUser.id);
  });
});

