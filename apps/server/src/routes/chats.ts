import {
  and,
  chatAdmins,
  chatParticipants,
  chats,
  db,
  desc,
  eq,
  gt,
  lt,
  messages,
} from '@babylon/db'
import { generateSnowflakeId, logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

/**
 * Chat routes
 * Migrated from: apps/web/app/api/chats/*
 */
const createChatsRoutes = () =>
  new Elysia({ prefix: '/api/chats' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // List user chats
    // Migrated from: apps/web/app/api/chats/route.ts
    .get(
      '/',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { query, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const limit = Math.min(Number.parseInt(query.limit || '20', 10), 100)

        // Get all chats user is a participant in
        const userParticipations = await db
          .select({
            chatId: chatParticipants.chatId,
            joinedAt: chatParticipants.joinedAt,
          })
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.userId, user.userId),
              eq(chatParticipants.isActive, true),
            ),
          )
          .orderBy(desc(chatParticipants.joinedAt))
          .limit(limit)

        const chatIds = userParticipations.map((p) => p.chatId)
        if (chatIds.length === 0) {
          return { success: true, chats: [], count: 0 }
        }

        // Get chat details
        const userChats = await db
          .select()
          .from(chats)
          .where(eq(chats.id, chats.id)) // Will filter below

        const chatMap = new Map(
          userChats.filter((c) => chatIds.includes(c.id)).map((c) => [c.id, c]),
        )

        // Get last message for each chat
        const lastMessages = await Promise.all(
          chatIds.map(async (chatId) => {
            const [lastMsg] = await db
              .select()
              .from(messages)
              .where(eq(messages.chatId, chatId))
              .orderBy(desc(messages.createdAt))
              .limit(1)
            return { chatId, lastMessage: lastMsg ?? null }
          }),
        )

        const lastMessageMap = new Map(
          lastMessages.map((lm) => [lm.chatId, lm.lastMessage]),
        )

        const chatsWithMeta = chatIds
          .map((chatId) => {
            const chat = chatMap.get(chatId)
            if (!chat) return null
            const lastMessage = lastMessageMap.get(chatId)
            return {
              ...chat,
              lastMessage,
              lastMessageAt: lastMessage?.createdAt ?? chat.updatedAt,
            }
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .sort(
            (a, b) =>
              (b.lastMessageAt?.getTime() ?? 0) -
              (a.lastMessageAt?.getTime() ?? 0),
          )

        logger.info(
          'User chats fetched',
          { userId: user.userId, chatCount: chatsWithMeta.length },
          'GET /api/chats',
        )

        return {
          success: true,
          chats: chatsWithMeta,
          count: chatsWithMeta.length,
        }
      },
      {
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'List user chats',
        },
      },
    )

    // Get chat by ID
    // Migrated from: apps/web/app/api/chats/[id]/route.ts
    .get(
      '/:id',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Check if user is participant
        const [participation] = await db
          .select()
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, user.userId),
              eq(chatParticipants.isActive, true),
            ),
          )
          .limit(1)

        if (!participation) {
          set.status = 403
          return { error: 'Not a participant in this chat' }
        }

        const [chat] = await db
          .select()
          .from(chats)
          .where(eq(chats.id, params.id))
          .limit(1)

        if (!chat) {
          set.status = 404
          return { error: 'Chat not found' }
        }

        // Get participants
        const participants = await db
          .select({
            userId: chatParticipants.userId,
            joinedAt: chatParticipants.joinedAt,
          })
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.isActive, true),
            ),
          )

        return {
          success: true,
          chat: {
            ...chat,
            participants,
          },
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Get chat by ID',
        },
      },
    )

    // Get chat messages
    // Migrated from: apps/web/app/api/chats/[id]/messages/route.ts
    .get(
      '/:id/messages',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, query, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Check if user is participant
        const [participation] = await db
          .select()
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, user.userId),
              eq(chatParticipants.isActive, true),
            ),
          )
          .limit(1)

        if (!participation) {
          set.status = 403
          return { error: 'Not a participant in this chat' }
        }

        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)
        const cursor = query.cursor || query.before

        const conditions = [eq(messages.chatId, params.id)]
        if (cursor) {
          conditions.push(lt(messages.createdAt, new Date(cursor)))
        }

        const chatMessages = await db
          .select()
          .from(messages)
          .where(and(...conditions))
          .orderBy(desc(messages.createdAt))
          .limit(limit + 1)

        const hasMore = chatMessages.length > limit
        const resultMessages = hasMore
          ? chatMessages.slice(0, -1)
          : chatMessages
        const nextCursor =
          hasMore && resultMessages.length > 0
            ? resultMessages[resultMessages.length - 1]?.createdAt.toISOString()
            : null

        logger.info(
          'Chat messages fetched',
          {
            chatId: params.id,
            userId: user.userId,
            messageCount: resultMessages.length,
          },
          'GET /api/chats/:id/messages',
        )

        return {
          success: true,
          messages: resultMessages.reverse(), // Return in chronological order
          nextCursor,
          hasMore,
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          before: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Get chat messages',
        },
      },
    )

    // Send chat message
    // Migrated from: apps/web/app/api/chats/[id]/messages/route.ts
    .post(
      '/:id/messages',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { content } = body

        if (!content || content.trim().length === 0) {
          set.status = 400
          return { error: 'Message content is required' }
        }

        // Check if user is participant
        const [participation] = await db
          .select()
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, user.userId),
              eq(chatParticipants.isActive, true),
            ),
          )
          .limit(1)

        if (!participation) {
          set.status = 403
          return { error: 'Not a participant in this chat' }
        }

        const messageId = await generateSnowflakeId()
        const now = new Date()

        const [newMessage] = await db
          .insert(messages)
          .values({
            id: messageId,
            chatId: params.id,
            senderId: user.userId,
            content: content.trim(),
            createdAt: now,
          })
          .returning()

        // Update chat's updatedAt
        await db
          .update(chats)
          .set({ updatedAt: now })
          .where(eq(chats.id, params.id))

        // Update participant's last message timestamp
        await db
          .update(chatParticipants)
          .set({
            lastMessageAt: now,
            messageCount: participation.messageCount + 1,
          })
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, user.userId),
            ),
          )

        logger.info(
          'Message sent',
          { messageId, chatId: params.id, userId: user.userId },
          'POST /api/chats/:id/messages',
        )

        return {
          success: true,
          message: newMessage,
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          content: t.String(),
          replyTo: t.Optional(t.String()),
          attachments: t.Optional(
            t.Array(
              t.Object({
                type: t.String(),
                url: t.String(),
              }),
            ),
          ),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Send chat message',
        },
      },
    )

    // Get chat participants
    // Migrated from: apps/web/app/api/chats/[id]/participants/route.ts
    .get(
      '/:id/participants',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Check if user is participant
        const [participation] = await db
          .select()
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, user.userId),
              eq(chatParticipants.isActive, true),
            ),
          )
          .limit(1)

        if (!participation) {
          set.status = 403
          return { error: 'Not a participant in this chat' }
        }

        const participants = await db
          .select()
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.isActive, true),
            ),
          )

        return {
          success: true,
          participants,
          count: participants.length,
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Get chat participants',
        },
      },
    )

    // Add participant to chat
    // Migrated from: apps/web/app/api/chats/[id]/participants/route.ts
    .post(
      '/:id/participants',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { userId: newUserId } = body

        // Check if requesting user is admin of chat
        const [adminStatus] = await db
          .select()
          .from(chatAdmins)
          .where(
            and(
              eq(chatAdmins.chatId, params.id),
              eq(chatAdmins.userId, user.userId),
            ),
          )
          .limit(1)

        // Also check if user is creator of the chat
        const [chat] = await db
          .select()
          .from(chats)
          .where(eq(chats.id, params.id))
          .limit(1)

        if (!chat) {
          set.status = 404
          return { error: 'Chat not found' }
        }

        if (!adminStatus && chat.createdBy !== user.userId) {
          set.status = 403
          return { error: 'Only admins can add participants' }
        }

        // Check if user already in chat
        const [existingParticipant] = await db
          .select()
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, newUserId),
            ),
          )
          .limit(1)

        if (existingParticipant) {
          if (existingParticipant.isActive) {
            return { success: true, message: 'User is already a participant' }
          }
          // Reactivate participant
          await db
            .update(chatParticipants)
            .set({ isActive: true, joinedAt: new Date() })
            .where(eq(chatParticipants.id, existingParticipant.id))

          return { success: true }
        }

        const participantId = await generateSnowflakeId()
        await db.insert(chatParticipants).values({
          id: participantId,
          chatId: params.id,
          userId: newUserId,
          joinedAt: new Date(),
          addedBy: user.userId,
        })

        logger.info(
          'Participant added to chat',
          { chatId: params.id, newUserId, addedBy: user.userId },
          'POST /api/chats/:id/participants',
        )

        return { success: true }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Add participant to chat',
        },
      },
    )

    // Leave chat
    // Migrated from: apps/web/app/api/chats/[id]/participants/me/route.ts
    .delete(
      '/:id/participants/me',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        await db
          .update(chatParticipants)
          .set({ isActive: false, kickedAt: new Date(), kickReason: 'left' })
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, user.userId),
            ),
          )

        logger.info(
          'User left chat',
          { chatId: params.id, userId: user.userId },
          'DELETE /api/chats/:id/participants/me',
        )

        return { success: true }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Leave chat',
        },
      },
    )

    // Get group chat info
    // Migrated from: apps/web/app/api/chats/[id]/group/route.ts
    .get(
      '/:id/group',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Check if user is participant
        const [participation] = await db
          .select()
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, user.userId),
              eq(chatParticipants.isActive, true),
            ),
          )
          .limit(1)

        if (!participation) {
          set.status = 403
          return { error: 'Not a participant in this chat' }
        }

        const [chat] = await db
          .select()
          .from(chats)
          .where(and(eq(chats.id, params.id), eq(chats.isGroup, true)))
          .limit(1)

        if (!chat) {
          set.status = 404
          return { error: 'Group chat not found' }
        }

        // Get admins
        const admins = await db
          .select()
          .from(chatAdmins)
          .where(eq(chatAdmins.chatId, params.id))

        // Get member count
        const members = await db
          .select({ id: chatParticipants.id })
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.isActive, true),
            ),
          )
        const memberCount = members.length

        return {
          success: true,
          group: {
            ...chat,
            admins: admins.map((a) => a.userId),
            memberCount,
          },
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Get group chat info',
        },
      },
    )

    // Update group chat
    // Migrated from: apps/web/app/api/chats/[id]/group/route.ts
    .patch(
      '/:id/group',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Check if user is admin
        const [adminStatus] = await db
          .select()
          .from(chatAdmins)
          .where(
            and(
              eq(chatAdmins.chatId, params.id),
              eq(chatAdmins.userId, user.userId),
            ),
          )
          .limit(1)

        const [chat] = await db
          .select()
          .from(chats)
          .where(eq(chats.id, params.id))
          .limit(1)

        if (!chat) {
          set.status = 404
          return { error: 'Chat not found' }
        }

        if (!adminStatus && chat.createdBy !== user.userId) {
          set.status = 403
          return { error: 'Only admins can update group settings' }
        }

        const updates: {
          updatedAt: Date
          name?: string | null
          description?: string | null
        } = { updatedAt: new Date() }
        if (body.name !== undefined) updates.name = body.name
        if (body.description !== undefined)
          updates.description = body.description

        await db.update(chats).set(updates).where(eq(chats.id, params.id))

        logger.info(
          'Group chat updated',
          { chatId: params.id, userId: user.userId },
          'PATCH /api/chats/:id/group',
        )

        return { success: true }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          imageUrl: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Update group chat',
        },
      },
    )

    // Get unread message count
    // Migrated from: apps/web/app/api/chats/unread-count/route.ts
    .get(
      '/unread-count',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Get all active chat participations
        const participations = await db
          .select({
            chatId: chatParticipants.chatId,
            lastMessageAt: chatParticipants.lastMessageAt,
          })
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.userId, user.userId),
              eq(chatParticipants.isActive, true),
            ),
          )

        // For each chat, count messages after user's last message
        let totalUnread = 0
        for (const p of participations) {
          if (!p.lastMessageAt) {
            // User hasn't sent any message, count all messages
            const chatMessages = await db
              .select({ id: messages.id })
              .from(messages)
              .where(eq(messages.chatId, p.chatId))
            totalUnread += chatMessages.length
          } else {
            // Count messages after user's last message
            const newMessages = await db
              .select({ id: messages.id })
              .from(messages)
              .where(
                and(
                  eq(messages.chatId, p.chatId),
                  gt(messages.createdAt, p.lastMessageAt),
                ),
              )
            totalUnread += newMessages.length
          }
        }

        return {
          success: true,
          unreadCount: totalUnread,
        }
      },
      {
        detail: {
          tags: ['Chats'],
          summary: 'Get unread message count',
        },
      },
    )

export const chatsRoutes = createChatsRoutes()
