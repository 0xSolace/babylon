import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { db } from '@babylon/db'
import type { AuthenticatedAgent } from '@babylon/mcp'
import {
  executeAcceptGroupInvite,
  executeDeclineGroupInvite,
  executeGetGroupInvites,
} from '@babylon/mcp'
import { generateSnowflakeId } from '@jejunetwork/shared'

const testIds = {
  userIds: [] as string[],
  chatIds: [] as string[],
  inviteIds: [] as string[],
  participantIds: [] as string[],
  membershipIds: [] as string[],
}

async function createTestUser(options: {
  isAgent?: boolean
  username?: string
  displayName?: string
}) {
  const id = await generateSnowflakeId()
  const username = options.username || `test-mcp-user-${id.slice(-6)}`
  const displayName = options.displayName || `MCP User ${id.slice(-6)}`
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
  })
  testIds.userIds.push(id)
  return { id, username, displayName }
}

async function createTestNPC(options: { name?: string }) {
  const id = await generateSnowflakeId()
  const name = options.name || `Test MCP NPC ${id.slice(-6)}`
  await db.user.create({
    data: {
      id,
      username: name.toLowerCase().replace(/\s+/g, '-'),
      displayName: name,
      isActor: true,
      isTest: true,
      updatedAt: new Date(),
    },
  })
  testIds.userIds.push(id)
  return { id, name }
}

async function createTestGroupChat(options: {
  name?: string
  npcAdminId: string
}) {
  const id = await generateSnowflakeId()
  const name = options.name || `MCP Test Group ${id.slice(-6)}`
  await db.chat.create({
    data: {
      id,
      name,
      type: 'group',
      description: null,
      isGroup: true,
      npcAdminId: options.npcAdminId,
      gameId: null,
      metadata: null,
      imageUrl: null,
      groupOwnerId: null,
      createdBy: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      participantCount: 0,
      isArchived: false,
      archivedAt: null,
      updatedAt: new Date(),
    },
  })
  const participantId = await generateSnowflakeId()
  await db.chatParticipant.create({
    data: { id: participantId, chatId: id, userId: options.npcAdminId },
  })
  testIds.participantIds.push(participantId)
  testIds.chatIds.push(id)
  return { id, name }
}

function createMockAgent(userId: string): AuthenticatedAgent {
  return { userId, agentId: userId }
}

async function cleanupTestData() {
  if (testIds.membershipIds.length > 0)
    await db.groupChatMembership.deleteMany({
      where: { id: { in: testIds.membershipIds } },
    })
  if (testIds.participantIds.length > 0)
    await db.chatParticipant.deleteMany({
      where: { id: { in: testIds.participantIds } },
    })
  if (testIds.inviteIds.length > 0) {
    await db.chatInvite.deleteMany({
      where: { id: { in: testIds.inviteIds } },
    })
    await db.userGroupInvite.deleteMany({
      where: { id: { in: testIds.inviteIds } },
    })
  }
  if (testIds.chatIds.length > 0) {
    await db.chatParticipant.deleteMany({
      where: { chatId: { in: testIds.chatIds } },
    })
    await db.chat.deleteMany({ where: { id: { in: testIds.chatIds } } })
  }
  if (testIds.userIds.length > 0)
    await db.user.deleteMany({ where: { id: { in: testIds.userIds } } })
  testIds.userIds = []
  testIds.chatIds = []
  testIds.inviteIds = []
  testIds.participantIds = []
  testIds.membershipIds = []
}

describe('MCP Group Invite Handlers', () => {
  beforeEach(async () => {
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('executeGetGroupInvites', () => {
    test('should return empty array when no invites exist', async () => {
      const user = await createTestUser({ displayName: 'No Invites User' })
      const agent = createMockAgent(user.id)

      const result = await executeGetGroupInvites(agent, {})

      expect(result.invites).toEqual([])
    })

    test('should return user-initiated (chatInvite) invites with source=user', async () => {
      const inviter = await createTestUser({ displayName: 'Inviter' })
      const invitee = await createTestUser({ displayName: 'Invitee' })
      const npc = await createTestNPC({ name: 'Group NPC' })
      const chat = await createTestGroupChat({
        name: 'User Invite Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.chatInvite.create({
        data: {
          id: inviteId,
          chatId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: inviter.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const agent = createMockAgent(invitee.id)
      const result = await executeGetGroupInvites(agent, {})

      expect(result.invites.length).toBe(1)
      expect(result.invites[0]?.id).toBe(inviteId)
      expect(result.invites[0]?.groupId).toBe(chat.id)
      expect(result.invites[0]?.groupName).toBe(chat.name)
      expect(result.invites[0]?.inviterId).toBe(inviter.id)
      expect(result.invites[0]?.source).toBe('user')
    })

    test('should return NPC-initiated (userGroupInvite) invites with source=npc', async () => {
      const invitee = await createTestUser({ displayName: 'NPC Invitee' })
      const npc = await createTestNPC({ name: 'Inviting NPC' })
      const chat = await createTestGroupChat({
        name: 'NPC Invite Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const agent = createMockAgent(invitee.id)
      const result = await executeGetGroupInvites(agent, {})

      expect(result.invites.length).toBe(1)
      expect(result.invites[0]?.id).toBe(inviteId)
      expect(result.invites[0]?.groupId).toBe(chat.id)
      expect(result.invites[0]?.groupName).toBe(chat.name)
      expect(result.invites[0]?.inviterId).toBe(npc.id)
      expect(result.invites[0]?.source).toBe('npc')
    })

    test('should return combined invites from both sources', async () => {
      const invitee = await createTestUser({ displayName: 'Multi Invitee' })
      const userInviter = await createTestUser({ displayName: 'User Inviter' })
      const npc = await createTestNPC({ name: 'Multi NPC' })
      const chat1 = await createTestGroupChat({
        name: 'User Group',
        npcAdminId: npc.id,
      })
      const chat2 = await createTestGroupChat({
        name: 'NPC Group',
        npcAdminId: npc.id,
      })

      // User invite
      const userInviteId = await generateSnowflakeId()
      await db.chatInvite.create({
        data: {
          id: userInviteId,
          chatId: chat1.id,
          invitedUserId: invitee.id,
          invitedBy: userInviter.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(userInviteId)

      // NPC invite
      const npcInviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: npcInviteId,
          groupId: chat2.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(npcInviteId)

      const agent = createMockAgent(invitee.id)
      const result = await executeGetGroupInvites(agent, {})

      expect(result.invites.length).toBe(2)
      const sources = result.invites.map((i) => i.source).sort()
      expect(sources).toEqual(['npc', 'user'])
    })

    test('should not return non-pending invites', async () => {
      const invitee = await createTestUser({ displayName: 'Status Test User' })
      const npc = await createTestNPC({ name: 'Status NPC' })
      const chat1 = await createTestGroupChat({
        name: 'Status Group Accepted',
        npcAdminId: npc.id,
      })
      const chat2 = await createTestGroupChat({
        name: 'Status Group Declined',
        npcAdminId: npc.id,
      })

      // Create accepted invite (different group)
      const acceptedId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: acceptedId,
          groupId: chat1.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'accepted',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(acceptedId)

      // Create declined invite (different group)
      const declinedId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: declinedId,
          groupId: chat2.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'declined',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(declinedId)

      const agent = createMockAgent(invitee.id)
      const result = await executeGetGroupInvites(agent, {})

      expect(result.invites.length).toBe(0)
    })

    test('should not return invites for other users', async () => {
      const invitee = await createTestUser({ displayName: 'Real Invitee' })
      const otherUser = await createTestUser({ displayName: 'Other User' })
      const npc = await createTestNPC({ name: 'Access NPC' })
      const chat = await createTestGroupChat({
        name: 'Access Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      // Other user tries to get invites
      const agent = createMockAgent(otherUser.id)
      const result = await executeGetGroupInvites(agent, {})

      expect(result.invites.length).toBe(0)
    })
  })

  describe('executeAcceptGroupInvite', () => {
    test('should accept user-initiated invite and create participant', async () => {
      const inviter = await createTestUser({ displayName: 'Accept Inviter' })
      const invitee = await createTestUser({ displayName: 'Accept Invitee' })
      const npc = await createTestNPC({ name: 'Accept NPC' })
      const chat = await createTestGroupChat({
        name: 'Accept Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.chatInvite.create({
        data: {
          id: inviteId,
          chatId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: inviter.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const agent = createMockAgent(invitee.id)
      const result = await executeAcceptGroupInvite(agent, { inviteId })

      expect(result.success).toBe(true)
      expect(result.chatId).toBe(chat.id)

      // Verify invite status updated
      const invite = await db.chatInvite.findUnique({
        where: { id: inviteId },
      })
      expect(invite?.status).toBe('accepted')

      // Verify participant created
      const participant = await db.chatParticipant.findFirst({
        where: { chatId: chat.id, userId: invitee.id },
      })
      expect(participant).not.toBeNull()
      if (participant) testIds.participantIds.push(participant.id)
    })

    test('should accept NPC-initiated invite and create participant + membership', async () => {
      const invitee = await createTestUser({
        displayName: 'NPC Accept Invitee',
      })
      const npc = await createTestNPC({ name: 'NPC Accept NPC' })
      const chat = await createTestGroupChat({
        name: 'NPC Accept Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const agent = createMockAgent(invitee.id)
      const result = await executeAcceptGroupInvite(agent, { inviteId })

      expect(result.success).toBe(true)
      expect(result.chatId).toBe(chat.id)

      // Verify invite status and respondedAt
      const invite = await db.userGroupInvite.findUnique({
        where: { id: inviteId },
      })
      expect(invite?.status).toBe('accepted')
      expect(invite?.respondedAt).not.toBeNull()

      // Verify participant created
      const participant = await db.chatParticipant.findFirst({
        where: { chatId: chat.id, userId: invitee.id },
      })
      expect(participant).not.toBeNull()
      if (participant) testIds.participantIds.push(participant.id)

      // Verify membership created (NPC invites create memberships)
      const membership = await db.groupChatMembership.findFirst({
        where: { chatId: chat.id, userId: invitee.id },
      })
      expect(membership).not.toBeNull()
      expect(membership?.isActive).toBe(true)
      expect(membership?.messageCount).toBe(0)
      expect(membership?.qualityScore).toBe(1.0)
      if (membership) testIds.membershipIds.push(membership.id)
    })

    test('should throw error for non-existent invite', async () => {
      const user = await createTestUser({ displayName: 'No Invite User' })
      const agent = createMockAgent(user.id)
      const fakeInviteId = await generateSnowflakeId()

      await expect(
        executeAcceptGroupInvite(agent, { inviteId: fakeInviteId }),
      ).rejects.toThrow('Invite not found or access denied')
    })

    test('should throw error when accepting invite for another user', async () => {
      const invitee = await createTestUser({ displayName: 'Real Accept' })
      const attacker = await createTestUser({ displayName: 'Attacker' })
      const npc = await createTestNPC({ name: 'Security NPC' })
      const chat = await createTestGroupChat({
        name: 'Security Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const attackerAgent = createMockAgent(attacker.id)

      await expect(
        executeAcceptGroupInvite(attackerAgent, { inviteId }),
      ).rejects.toThrow('Invite not found or access denied')

      // Verify invite unchanged
      const invite = await db.userGroupInvite.findUnique({
        where: { id: inviteId },
      })
      expect(invite?.status).toBe('pending')
    })
  })

  describe('executeDeclineGroupInvite', () => {
    test('should decline user-initiated invite', async () => {
      const inviter = await createTestUser({ displayName: 'Decline Inviter' })
      const invitee = await createTestUser({ displayName: 'Decline Invitee' })
      const npc = await createTestNPC({ name: 'Decline NPC' })
      const chat = await createTestGroupChat({
        name: 'Decline Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.chatInvite.create({
        data: {
          id: inviteId,
          chatId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: inviter.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const agent = createMockAgent(invitee.id)
      const result = await executeDeclineGroupInvite(agent, { inviteId })

      expect(result.success).toBe(true)

      // Verify invite status updated
      const invite = await db.chatInvite.findUnique({
        where: { id: inviteId },
      })
      expect(invite?.status).toBe('declined')
    })

    test('should decline NPC-initiated invite with respondedAt', async () => {
      const invitee = await createTestUser({
        displayName: 'NPC Decline Invitee',
      })
      const npc = await createTestNPC({ name: 'NPC Decline NPC' })
      const chat = await createTestGroupChat({
        name: 'NPC Decline Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const beforeDecline = new Date()
      const agent = createMockAgent(invitee.id)
      const result = await executeDeclineGroupInvite(agent, { inviteId })
      const afterDecline = new Date()

      expect(result.success).toBe(true)

      // Verify invite status and respondedAt
      const invite = await db.userGroupInvite.findUnique({
        where: { id: inviteId },
      })
      expect(invite?.status).toBe('declined')
      expect(invite?.respondedAt).not.toBeNull()
      expect(invite?.respondedAt?.getTime()).toBeGreaterThanOrEqual(
        beforeDecline.getTime(),
      )
      expect(invite?.respondedAt?.getTime()).toBeLessThanOrEqual(
        afterDecline.getTime(),
      )
    })

    test('should throw error for non-existent invite', async () => {
      const user = await createTestUser({ displayName: 'No Decline User' })
      const agent = createMockAgent(user.id)
      const fakeInviteId = await generateSnowflakeId()

      await expect(
        executeDeclineGroupInvite(agent, { inviteId: fakeInviteId }),
      ).rejects.toThrow('Invite not found or access denied')
    })

    test('should throw error when declining invite for another user', async () => {
      const invitee = await createTestUser({ displayName: 'Real Decline' })
      const attacker = await createTestUser({
        displayName: 'Decline Attacker',
      })
      const npc = await createTestNPC({ name: 'Decline Security NPC' })
      const chat = await createTestGroupChat({
        name: 'Decline Security Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: chat.id,
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const attackerAgent = createMockAgent(attacker.id)

      await expect(
        executeDeclineGroupInvite(attackerAgent, { inviteId }),
      ).rejects.toThrow('Invite not found or access denied')

      // Verify invite unchanged
      const invite = await db.userGroupInvite.findUnique({
        where: { id: inviteId },
      })
      expect(invite?.status).toBe('pending')
    })
  })

  describe('Edge Cases', () => {
    test('should handle missing group chat gracefully', async () => {
      const invitee = await createTestUser({
        displayName: 'Missing Chat User',
      })
      const npc = await createTestNPC({ name: 'Missing Chat NPC' })

      const inviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: 'non-existent-chat-id',
          invitedUserId: invitee.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const agent = createMockAgent(invitee.id)
      const result = await executeGetGroupInvites(agent, {})

      // Should still return invite, but with null group name
      expect(result.invites.length).toBe(1)
      expect(result.invites[0]?.groupName).toBeNull()
    })

    test('should handle agent users same as regular users', async () => {
      const agentUser = await createTestUser({
        isAgent: true,
        displayName: 'Agent User',
      })
      const npc = await createTestNPC({ name: 'Agent NPC' })
      const chat = await createTestGroupChat({
        name: 'Agent Group',
        npcAdminId: npc.id,
      })

      const inviteId = await generateSnowflakeId()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: chat.id,
          invitedUserId: agentUser.id,
          invitedBy: npc.id,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
      testIds.inviteIds.push(inviteId)

      const agent = createMockAgent(agentUser.id)

      // Get invites
      const getResult = await executeGetGroupInvites(agent, {})
      expect(getResult.invites.length).toBe(1)

      // Accept invite
      const acceptResult = await executeAcceptGroupInvite(agent, { inviteId })
      expect(acceptResult.success).toBe(true)

      // Verify membership was created for agent
      const membership = await db.groupChatMembership.findFirst({
        where: { userId: agentUser.id, chatId: chat.id },
      })
      expect(membership).not.toBeNull()
      if (membership) testIds.membershipIds.push(membership.id)
    })
  })
})
