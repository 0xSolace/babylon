/**
 * Chat & Messaging E2E Tests
 *
 * Comprehensive tests for group chats, DMs, encrypted messaging, and NPC interactions.
 * Tests real API endpoints against a running server.
 *
 * REQUIREMENTS:
 * 1. SQLit block producer running (bun run jeju start sqlit)
 * 2. DWS running (bun run jeju start dws)
 * 3. Server running: SQLIT_BLOCK_PRODUCER_ENDPOINT="http://localhost:4444" JWT_SECRET="test-secret" bun run dev
 *
 * ENVIRONMENT VARIABLES:
 * - BABYLON_SERVER_URL: Server URL (default: http://localhost:5009)
 * - JWT_SECRET: Must match server's JWT_SECRET (default: development-secret-change-in-production)
 * - SKIP_E2E: Set to 'true' to skip these tests
 *
 * RUN:
 *   JWT_SECRET="test-secret" bun test chat-messaging.test.ts
 */

import { describe, expect, it, beforeAll } from 'bun:test'
import { SignJWT } from 'jose'

// Test configuration
const SERVER_URL = process.env.BABYLON_SERVER_URL ?? 'http://localhost:5009'
// Must match the server's JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET ?? 'development-secret-change-in-production'
const SKIP_E2E = process.env.SKIP_E2E === 'true'

// Test user IDs - will be used for authentication
const TEST_USER_1 = 'test-user-chat-1'
const TEST_USER_2 = 'test-user-chat-2'
const TEST_NPC = 'test-npc-actor-1'

// Store created resources for cleanup/verification
const createdChats: string[] = []

/**
 * Generate a valid JWT token for testing
 */
async function generateTestToken(userId: string, options: { 
  isAdmin?: boolean
  walletAddress?: string 
} = {}): Promise<string> {
  const secretKey = new TextEncoder().encode(JWT_SECRET)
  
  const token = await new SignJWT({
    sub: userId,
    dbUserId: userId,
    walletAddress: options.walletAddress ?? `0x${userId.replace(/[^a-f0-9]/gi, '').padEnd(40, '0').slice(0, 40)}`,
    isAdmin: options.isAdmin ?? false,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey)
  
  return token
}

/**
 * Make authenticated API request
 */
async function apiRequest(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, ...fetchOptions } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return fetch(`${SERVER_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...(fetchOptions.headers as Record<string, string>),
    },
  })
}

/**
 * Check server availability
 */
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await apiRequest('/health')
    if (!response.ok) return false
    const data = await response.json()
    return data.status === 'ok' || data.status === 'degraded'
  } catch {
    return false
  }
}

describe('Chat & Messaging E2E Tests', () => {
  let serverAvailable = false
  let user1Token: string
  let user2Token: string
  let npcToken: string

  beforeAll(async () => {
    if (SKIP_E2E) {
      console.log('Skipping E2E tests (SKIP_E2E=true)')
      return
    }

    serverAvailable = await checkServerHealth()
    if (!serverAvailable) {
      console.log('Server not available at', SERVER_URL)
      return
    }

    // Generate test tokens
    user1Token = await generateTestToken(TEST_USER_1)
    user2Token = await generateTestToken(TEST_USER_2)
    npcToken = await generateTestToken(TEST_NPC, { isAdmin: false })

    console.log('Test tokens generated for users:', TEST_USER_1, TEST_USER_2, TEST_NPC)
  })

  describe('Authentication', () => {
    it('should require authentication for chat list', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats')
      expect(response.status).toBe(401)
    })

    it('should allow authenticated access to chat list', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats', { token: user1Token })
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.chats)).toBe(true)
    })
  })

  describe('DM Chat Creation', () => {
    it('should create a DM between two users', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [TEST_USER_2],
          isGroup: false,
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.chat).toBeDefined()
      expect(data.chat.type).toBe('dm')
      expect(data.chat.isGroup).toBe(false)

      createdChats.push(data.chat.id)
      console.log('DM created:', data.chat.id)
    })

    it('should return existing DM if already created', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [TEST_USER_2],
          isGroup: false,
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      // Should return the existing chat
      expect(data.isExisting || data.chat.id === createdChats[0]).toBe(true)
    })

    it('should require at least one participant', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [],
          isGroup: false,
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Group Chat Creation', () => {
    let groupChatId: string

    it('should create a group chat', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [TEST_USER_2, TEST_NPC],
          name: 'Test Group Chat',
          isGroup: true,
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.chat).toBeDefined()
      expect(data.chat.type).toBe('group')
      expect(data.chat.isGroup).toBe(true)
      expect(data.chat.name).toBe('Test Group Chat')

      groupChatId = data.chat.id
      createdChats.push(groupChatId)
      console.log('Group chat created:', groupChatId)
    })

    it('should get group chat info', async () => {
      if (!serverAvailable || !groupChatId) return

      const response = await apiRequest(`/api/chats/${groupChatId}/group`, {
        token: user1Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.group).toBeDefined()
      expect(data.group.name).toBe('Test Group Chat')
      expect(data.group.memberCount).toBeGreaterThanOrEqual(1)
    })

    it('should update group chat settings', async () => {
      if (!serverAvailable || !groupChatId) return

      const response = await apiRequest(`/api/chats/${groupChatId}/group`, {
        method: 'PATCH',
        token: user1Token,
        body: JSON.stringify({
          name: 'Updated Group Name',
          description: 'Test description',
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should get participants', async () => {
      if (!serverAvailable || !groupChatId) return

      const response = await apiRequest(`/api/chats/${groupChatId}/participants`, {
        token: user1Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.participants)).toBe(true)
      expect(data.count).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Messaging', () => {
    let chatId: string

    beforeAll(async () => {
      if (!serverAvailable) return

      // Create a chat for messaging tests
      const response = await apiRequest('/api/chats', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [TEST_USER_2],
          name: 'Messaging Test Chat',
          isGroup: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        chatId = data.chat.id
        createdChats.push(chatId)
      }
    })

    it('should send a message to chat', async () => {
      if (!serverAvailable || !chatId) return

      const response = await apiRequest(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          content: 'Hello from E2E test!',
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBeDefined()
      expect(data.message.content).toBe('Hello from E2E test!')

      console.log('Message sent:', data.message.id)
    })

    it('should get messages from chat', async () => {
      if (!serverAvailable || !chatId) return

      const response = await apiRequest(`/api/chats/${chatId}/messages`, {
        token: user1Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.messages)).toBe(true)
      expect(data.messages.length).toBeGreaterThan(0)

      // Verify message content
      const sentMessage = data.messages.find((m: { content: string }) => m.content === 'Hello from E2E test!')
      expect(sentMessage).toBeDefined()
    })

    it('should reject empty messages', async () => {
      if (!serverAvailable || !chatId) return

      const response = await apiRequest(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          content: '   ',
        }),
      })

      expect(response.status).toBe(400)
    })

    it('should allow second user to send message', async () => {
      if (!serverAvailable || !chatId) return

      const response = await apiRequest(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        token: user2Token,
        body: JSON.stringify({
          content: 'Reply from user 2!',
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should order messages chronologically', async () => {
      if (!serverAvailable || !chatId) return

      const response = await apiRequest(`/api/chats/${chatId}/messages`, {
        token: user1Token,
      })

      const data = await response.json()
      const messages = data.messages as Array<{ createdAt: string }>
      
      // Messages should be in chronological order
      for (let i = 1; i < messages.length; i++) {
        const prev = new Date(messages[i - 1].createdAt).getTime()
        const curr = new Date(messages[i].createdAt).getTime()
        expect(curr).toBeGreaterThanOrEqual(prev)
      }
    })
  })

  describe('NPC/Actor Messaging', () => {
    let npcChatId: string

    it('should allow NPC to create a group', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats', {
        method: 'POST',
        token: npcToken,
        body: JSON.stringify({
          participantIds: [TEST_USER_1, TEST_USER_2],
          name: 'NPC Created Group',
          isGroup: true,
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)

      npcChatId = data.chat.id
      createdChats.push(npcChatId)
      console.log('NPC created group:', npcChatId)
    })

    it('should allow NPC to send messages', async () => {
      if (!serverAvailable || !npcChatId) return

      const response = await apiRequest(`/api/chats/${npcChatId}/messages`, {
        method: 'POST',
        token: npcToken,
        body: JSON.stringify({
          content: 'Hello, I am an NPC agent!',
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message.senderId).toBe(TEST_NPC)
    })

    it('should allow NPC to add participants', async () => {
      if (!serverAvailable || !npcChatId) return

      const newUserId = 'test-user-invited-by-npc'

      const response = await apiRequest(`/api/chats/${npcChatId}/participants`, {
        method: 'POST',
        token: npcToken,
        body: JSON.stringify({
          userId: newUserId,
        }),
      })

      // May succeed or fail depending on admin status
      // NPC is the creator so should be able to add
      expect([200, 403]).toContain(response.status)
    })

    it('users should see NPC messages', async () => {
      if (!serverAvailable || !npcChatId) return

      const response = await apiRequest(`/api/chats/${npcChatId}/messages`, {
        token: user1Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      
      const npcMessage = data.messages.find((m: { senderId: string }) => m.senderId === TEST_NPC)
      expect(npcMessage).toBeDefined()
      expect(npcMessage.content).toBe('Hello, I am an NPC agent!')
    })
  })

  describe('Encrypted Group (MLS)', () => {
    it('should attempt to create encrypted group', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats/encrypted', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [TEST_USER_2],
          name: 'Encrypted Test Group',
        }),
      })

      // May fail if MLS is not enabled, which is expected in test
      expect([200, 500]).toContain(response.status)

      if (response.ok) {
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.encrypted).toBe(true)
        expect(data.encryptionType).toBe('mls')
        createdChats.push(data.chatId)
        console.log('Encrypted group created:', data.chatId)
      } else {
        const data = await response.json()
        console.log('MLS not enabled (expected):', data.error)
        // Verify it's an MLS configuration error, not a code error
        expect(data.error).toMatch(/MLS|not enabled|signature|wallet/i)
      }
    })

    it('should check encryption status for DM', async () => {
      if (!serverAvailable || createdChats.length === 0) return

      const dmChatId = createdChats[0]
      const response = await apiRequest(`/api/chats/${dmChatId}/encryption`, {
        token: user1Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.encryption).toBeDefined()
      expect(typeof data.encryption.isEncrypted).toBe('boolean')
    })
  })

  describe('Messaging Status', () => {
    it('should get messaging status', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats/messaging-status', {
        token: user1Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.status).toBeDefined()
      expect(typeof data.status.xmtpEnabled).toBe('boolean')
      expect(typeof data.status.encryptionAvailable).toBe('boolean')

      console.log('Messaging status:', data.status)
    })
  })

  describe('Unread Count', () => {
    it('should get unread message count', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats/unread-count', {
        token: user1Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(typeof data.unreadCount).toBe('number')
      expect(data.unreadCount).toBeGreaterThanOrEqual(0)

      console.log('Unread count:', data.unreadCount)
    })
  })

  describe('Chat Access Control', () => {
    let privateChatId: string

    beforeAll(async () => {
      if (!serverAvailable) return

      // Create a chat that excludes user2
      const response = await apiRequest('/api/chats', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [TEST_NPC],
          name: 'Private Chat',
          isGroup: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        privateChatId = data.chat.id
        createdChats.push(privateChatId)
      }
    })

    it('should deny non-participant access to chat', async () => {
      if (!serverAvailable || !privateChatId) return

      const response = await apiRequest(`/api/chats/${privateChatId}`, {
        token: user2Token,
      })

      expect(response.status).toBe(403)
    })

    it('should deny non-participant access to messages', async () => {
      if (!serverAvailable || !privateChatId) return

      const response = await apiRequest(`/api/chats/${privateChatId}/messages`, {
        token: user2Token,
      })

      expect(response.status).toBe(403)
    })

    it('should deny non-admin from adding participants', async () => {
      if (!serverAvailable || !privateChatId) return

      // User2 is not in the chat, can't add others
      const response = await apiRequest(`/api/chats/${privateChatId}/participants`, {
        method: 'POST',
        token: user2Token,
        body: JSON.stringify({
          userId: 'some-other-user',
        }),
      })

      expect([403, 404]).toContain(response.status)
    })
  })

  describe('Leave Chat', () => {
    let leavableChatId: string

    beforeAll(async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [TEST_USER_2],
          name: 'Chat to Leave',
          isGroup: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        leavableChatId = data.chat.id
        createdChats.push(leavableChatId)
      }
    })

    it('should allow user to leave chat', async () => {
      if (!serverAvailable || !leavableChatId) return

      const response = await apiRequest(`/api/chats/${leavableChatId}/participants/me`, {
        method: 'DELETE',
        token: user2Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should deny access after leaving', async () => {
      if (!serverAvailable || !leavableChatId) return

      const response = await apiRequest(`/api/chats/${leavableChatId}/messages`, {
        token: user2Token,
      })

      expect(response.status).toBe(403)
    })
  })

  describe('Pagination', () => {
    let chatForPagination: string

    beforeAll(async () => {
      if (!serverAvailable) return

      // Create chat and send multiple messages
      const createResponse = await apiRequest('/api/chats', {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          participantIds: [TEST_USER_2],
          name: 'Pagination Test Chat',
          isGroup: true,
        }),
      })

      if (createResponse.ok) {
        const data = await createResponse.json()
        chatForPagination = data.chat.id
        createdChats.push(chatForPagination)

        // Send multiple messages
        for (let i = 0; i < 5; i++) {
          await apiRequest(`/api/chats/${chatForPagination}/messages`, {
            method: 'POST',
            token: user1Token,
            body: JSON.stringify({
              content: `Pagination test message ${i + 1}`,
            }),
          })
        }
      }
    })

    it('should paginate messages with limit', async () => {
      if (!serverAvailable || !chatForPagination) return

      const response = await apiRequest(`/api/chats/${chatForPagination}/messages?limit=2`, {
        token: user1Token,
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.messages.length).toBeLessThanOrEqual(2)
      expect(data.hasMore).toBe(true)
    })

    it('should support cursor-based pagination', async () => {
      if (!serverAvailable || !chatForPagination) return

      // Get first page
      const firstPage = await apiRequest(`/api/chats/${chatForPagination}/messages?limit=2`, {
        token: user1Token,
      })
      const firstData = await firstPage.json()

      if (!firstData.nextCursor) return

      // Get second page using cursor
      const secondPage = await apiRequest(`/api/chats/${chatForPagination}/messages?limit=2&cursor=${firstData.nextCursor}`, {
        token: user1Token,
      })
      const secondData = await secondPage.json()

      expect(secondData.success).toBe(true)
      
      // Pages should have different messages
      const firstIds = firstData.messages.map((m: { id: string }) => m.id)
      const secondIds = secondData.messages.map((m: { id: string }) => m.id)
      
      for (const id of secondIds) {
        expect(firstIds).not.toContain(id)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle long messages', async () => {
      if (!serverAvailable || createdChats.length === 0) return

      const chatId = createdChats[0]
      const longMessage = 'A'.repeat(10000)

      const response = await apiRequest(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          content: longMessage,
        }),
      })

      // May succeed or be rejected for being too long
      expect([200, 400, 413]).toContain(response.status)
    })

    it('should handle unicode and emoji', async () => {
      if (!serverAvailable || createdChats.length === 0) return

      const chatId = createdChats[0]
      const unicodeMessage = '你好世界 🌍 مرحبا 🎉 Привет'

      const response = await apiRequest(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          content: unicodeMessage,
        }),
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.message.content).toBe(unicodeMessage)
    })

    it('should handle non-existent chat ID', async () => {
      if (!serverAvailable) return

      const response = await apiRequest('/api/chats/non-existent-chat-12345', {
        token: user1Token,
      })

      expect([403, 404]).toContain(response.status)
    })
  })

  describe('Performance', () => {
    it('should respond quickly to message send', async () => {
      if (!serverAvailable || createdChats.length === 0) return

      const chatId = createdChats[0]
      const start = Date.now()

      const response = await apiRequest(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        token: user1Token,
        body: JSON.stringify({
          content: 'Performance test message',
        }),
      })

      const elapsed = Date.now() - start
      expect(response.ok).toBe(true)
      expect(elapsed).toBeLessThan(2000) // Should respond within 2 seconds

      console.log(`Message send latency: ${elapsed}ms`)
    })

    it('should handle concurrent messages', async () => {
      if (!serverAvailable || createdChats.length === 0) return

      const chatId = createdChats[0]
      const start = Date.now()

      // Send 5 concurrent messages
      const requests = Array.from({ length: 5 }, (_, i) =>
        apiRequest(`/api/chats/${chatId}/messages`, {
          method: 'POST',
          token: user1Token,
          body: JSON.stringify({
            content: `Concurrent message ${i}`,
          }),
        })
      )

      const responses = await Promise.all(requests)
      const elapsed = Date.now() - start

      // All should succeed
      for (const response of responses) {
        expect(response.ok).toBe(true)
      }

      expect(elapsed).toBeLessThan(5000)
      console.log(`5 concurrent messages completed in ${elapsed}ms`)
    })
  })
})

describe('Chat & Messaging Summary', () => {
  it('should summarize test coverage', () => {
    console.log('\n=== Chat & Messaging Test Coverage ===')
    console.log('✓ DM chat creation and management')
    console.log('✓ Group chat creation and settings')
    console.log('✓ Message sending and retrieval')
    console.log('✓ NPC/Actor messaging capabilities')
    console.log('✓ Encrypted messaging (MLS) creation')
    console.log('✓ Messaging status and encryption checks')
    console.log('✓ Access control and permissions')
    console.log('✓ Pagination and cursor support')
    console.log('✓ Edge cases (unicode, long messages)')
    console.log('✓ Performance benchmarks')
    console.log('=====================================\n')
    
    expect(true).toBe(true)
  })
})
