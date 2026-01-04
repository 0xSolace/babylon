import {
  and,
  type Chat,
  chatAdmins,
  chatParticipants,
  chats,
  db,
  desc,
  eq,
  gt,
  lt,
  type Message,
  messages,
} from '@babylon/db'

// Local type for chatAdmins select result
interface ChatAdmin {
  id: string
  chatId: string
  userId: string
  createdAt: Date | null
}

import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'
import {
  createMLSGroup,
  getGroupEncryptionStatus,
  sendMLSMessage,
} from '../services/mls-groups'
import {
  getMessagingStatus,
  isXMTPEnabled,
  sendEncryptedDM,
} from '../services/xmtp-messaging'

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
          .select({
            id: chats.id,
            name: chats.name,
            type: chats.type,
            createdAt: chats.createdAt,
            updatedAt: chats.updatedAt,
          })
          .from(chats)
          .where(eq(chats.id, chats.id)) // Will filter below

        type ChatRow = (typeof userChats)[number]
        const chatMap = new Map<string, ChatRow>(
          userChats.filter((c) => chatIds.includes(c.id)).map((c) => [c.id, c]),
        )

        // Get last message for each chat
        const lastMessages = await Promise.all(
          chatIds.map(async (chatId) => {
            const msgResult = (await db
              .select()
              .from(messages)
              .where(eq(messages.chatId, chatId))
              .orderBy(desc(messages.createdAt))
              .limit(1)) as unknown as Message[]
            return { chatId, lastMessage: msgResult[0] ?? null }
          }),
        )

        const lastMessageMap = new Map<string, Message | null>(
          lastMessages.map((lm) => [lm.chatId, lm.lastMessage]),
        )

        const chatsWithMeta = chatIds
          .map((chatId) => {
            const chat = chatMap.get(chatId)
            if (!chat) return null
            const lastMessage = lastMessageMap.get(chatId) ?? null
            const lastMessageAt = lastMessage?.createdAt
              ? lastMessage.createdAt
              : chat.updatedAt
            return {
              ...chat,
              lastMessage,
              lastMessageAt,
            }
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .sort((a, b) => {
            const timeA =
              a.lastMessageAt instanceof Date ? a.lastMessageAt.getTime() : 0
            const timeB =
              b.lastMessageAt instanceof Date ? b.lastMessageAt.getTime() : 0
            return timeB - timeA
          })

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

    // Create new chat (DM or group)
    .post(
      '/',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Type assertion for body (Elysia type inference limitation)
        const body = ctx.body as {
          participantIds: string[]
          name?: string
          isGroup?: boolean
        }
        const { participantIds, name, isGroup } = body

        // Validate participants
        if (!participantIds || participantIds.length === 0) {
          set.status = 400
          return { error: 'At least one participant is required' }
        }

        // For DMs, check if a DM already exists between these users
        if (!isGroup && participantIds.length === 1) {
          const otherUserId = participantIds[0]
          const dmId = `dm-${[user.userId, otherUserId].sort().join('-')}`

          const [existingChat] = await db
            .select()
            .from(chats)
            .where(eq(chats.id, dmId))
            .limit(1)

          if (existingChat) {
            return {
              success: true,
              chat: existingChat,
              isExisting: true,
            }
          }
        }

        // Create chat
        const chatId = isGroup
          ? await generateSnowflakeId()
          : `dm-${[user.userId, ...participantIds].sort().join('-')}`

        await db.insert(chats).values({
          id: chatId,
          name: isGroup ? (name ?? 'New Group') : null,
          type: isGroup ? 'group' : 'dm',
          isGroup: isGroup ?? false,
          createdBy: user.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Add creator as participant
        const creatorParticipantId = await generateSnowflakeId()
        await db.insert(chatParticipants).values({
          id: creatorParticipantId,
          chatId,
          userId: user.userId,
          isActive: true,
          joinedAt: new Date(),
        })

        // Add other participants
        for (const participantId of participantIds) {
          const pId = await generateSnowflakeId()
          await db.insert(chatParticipants).values({
            id: pId,
            chatId,
            userId: participantId,
            isActive: true,
            joinedAt: new Date(),
          })
        }

        // Add creator as admin for group chats
        if (isGroup) {
          const adminId = await generateSnowflakeId()
          await db.insert(chatAdmins).values({
            id: adminId,
            chatId,
            userId: user.userId,
          })
        }

        logger.info(
          'Chat created',
          { chatId, type: isGroup ? 'group' : 'dm', creatorId: user.userId },
          'POST /api/chats',
        )

        return {
          success: true,
          chat: {
            id: chatId,
            name: isGroup ? (name ?? 'New Group') : null,
            type: isGroup ? 'group' : 'dm',
            isGroup: isGroup ?? false,
          },
          isExisting: false,
        }
      },
      {
        body: t.Object({
          participantIds: t.Array(t.String()),
          name: t.Optional(t.String()),
          isGroup: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ['Chats'],
          summary: 'Create new chat',
          description:
            'Creates a new DM or group chat with specified participants',
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

        const chatQueryResult = (await db
          .select()
          .from(chats)
          .where(eq(chats.id, params.id))
          .limit(1)) as unknown as Chat[]
        const chat = chatQueryResult[0]

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
          .select({
            id: messages.id,
            chatId: messages.chatId,
            senderId: messages.senderId,
            content: messages.content,
            createdAt: messages.createdAt,
          })
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
            ? resultMessages[
                resultMessages.length - 1
              ]?.createdAt?.toISOString()
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
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Type assertion for body (Elysia type inference limitation)
        const body = ctx.body as {
          content: string
          replyTo?: string
          attachments?: Array<{ type: string; url: string }>
        }
        const { content } = body

        if (!content || content.trim().length === 0) {
          set.status = 400
          return { error: 'Message content is required' }
        }

        // Check if user is participant
        const [participation] = await db
          .select({
            id: chatParticipants.id,
            chatId: chatParticipants.chatId,
            userId: chatParticipants.userId,
            messageCount: chatParticipants.messageCount,
            isActive: chatParticipants.isActive,
          })
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

        // Get chat info to determine if DM or group
        const [chatInfo] = await db
          .select({ isGroup: chats.isGroup, metadata: chats.metadata })
          .from(chats)
          .where(eq(chats.id, params.id))
          .limit(1)

        // Check if this is an MLS encrypted group
        const chatMeta = chatInfo?.metadata as {
          encryptionType?: string
        } | null
        const isMLS = chatMeta?.encryptionType === 'mls'

        // For MLS groups, send via MLS service
        if (chatInfo?.isGroup && isMLS) {
          try {
            const mlsResult = await sendMLSMessage(
              user.userId,
              params.id,
              content.trim(),
            )

            logger.info(
              'Message sent via MLS',
              {
                messageId: mlsResult.messageId,
                chatId: params.id,
                userId: user.userId,
              },
              'POST /api/chats/:id/messages',
            )

            // Get the stored message
            const [storedMessage] = await db
              .select()
              .from(messages)
              .where(eq(messages.id, mlsResult.messageId))
              .limit(1)

            return {
              success: true,
              message: storedMessage,
              encrypted: true,
              encryptionType: 'mls',
            }
          } catch (mlsError) {
            // MLS is required for MLS groups - don't fallback to unencrypted
            set.status = 500
            return {
              error: `MLS encryption failed: ${mlsError instanceof Error ? mlsError.message : 'Unknown error'}`,
            }
          }
        }

        const messageId = await generateSnowflakeId()
        const now = new Date()

        // For DM chats, use XMTP encryption service if enabled
        if (chatInfo && !chatInfo.isGroup && isXMTPEnabled()) {
          // This is a DM - get the other participant
          const otherParticipants = await db
            .select({ userId: chatParticipants.userId })
            .from(chatParticipants)
            .where(
              and(
                eq(chatParticipants.chatId, params.id),
                eq(chatParticipants.isActive, true),
              ),
            )

          const otherUserId = otherParticipants.find(
            (p) => p.userId !== user.userId,
          )?.userId

          if (otherUserId) {
            try {
              // Send encrypted DM via XMTP service
              const encryptionResult = await sendEncryptedDM(
                user.userId,
                otherUserId,
                content.trim(),
              )

              // Message stored by XMTP service
              logger.info(
                'DM sent via XMTP',
                {
                  messageId: encryptionResult.messageId,
                  chatId: params.id,
                  userId: user.userId,
                  encrypted: true,
                },
                'POST /api/chats/:id/messages',
              )

              // Get the stored message
              const [storedMessage] = await db
                .select()
                .from(messages)
                .where(eq(messages.id, encryptionResult.messageId))
                .limit(1)

              // Update participant's last message timestamp
              const currentMessageCount = participation.messageCount ?? 0
              await db
                .update(chatParticipants)
                .set({
                  lastMessageAt: now,
                  messageCount: currentMessageCount + 1,
                })
                .where(
                  and(
                    eq(chatParticipants.chatId, params.id),
                    eq(chatParticipants.userId, user.userId),
                  ),
                )

              return {
                success: true,
                message: storedMessage,
                encrypted: true,
                encryptionType: 'xmtp',
              }
            } catch (xmtpError) {
              // Log but continue to unencrypted fallback for DMs (optional encryption)
              logger.warn(
                'XMTP encryption failed, storing unencrypted',
                {
                  chatId: params.id,
                  error:
                    xmtpError instanceof Error ? xmtpError.message : 'Unknown',
                },
                'POST /api/chats/:id/messages',
              )
            }
          }
        }

        // Fallback: store message locally without encryption
        const [newMessage] = await db
          .insert(messages)
          .values({
            id: messageId,
            chatId: params.id,
            senderId: user.userId,
            content: content.trim(),
            createdAt: now,
            metadata: {
              isEncrypted: false,
              encryptionType: 'none',
            },
          })
          .returning()

        // Update chat's updatedAt
        await db
          .update(chats)
          .set({ updatedAt: now })
          .where(eq(chats.id, params.id))

        // Update participant's last message timestamp
        const currentMessageCount = participation.messageCount ?? 0
        await db
          .update(chatParticipants)
          .set({
            lastMessageAt: now,
            messageCount: currentMessageCount + 1,
          })
          .where(
            and(
              eq(chatParticipants.chatId, params.id),
              eq(chatParticipants.userId, user.userId),
            ),
          )

        logger.info(
          'Message sent (unencrypted)',
          {
            messageId,
            chatId: params.id,
            userId: user.userId,
          },
          'POST /api/chats/:id/messages',
        )

        return {
          success: true,
          message: newMessage,
          encrypted: false,
          encryptionType: 'none',
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
          description:
            'Send a message in a chat. For DMs, uses XMTP for end-to-end encryption. For MLS groups, uses MLS protocol.',
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
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Type assertion for body (Elysia type inference limitation)
        const body = ctx.body as { userId: string }
        const newUserId = body.userId

        // Check if requesting user is admin of chat
        const [adminStatus] = await db
          .select({ id: chatAdmins.id })
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
          .select({
            id: chats.id,
            createdBy: chats.createdBy,
          })
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
          .select({
            id: chatParticipants.id,
            isActive: chatParticipants.isActive,
          })
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

        const groupChatQueryResult = (await db
          .select()
          .from(chats)
          .where(and(eq(chats.id, params.id), eq(chats.isGroup, true)))
          .limit(1)) as unknown as Chat[]
        const chat = groupChatQueryResult[0]

        if (!chat) {
          set.status = 404
          return { error: 'Group chat not found' }
        }

        // Get admins
        const admins = (await db
          .select()
          .from(chatAdmins)
          .where(eq(chatAdmins.chatId, params.id))) as unknown as ChatAdmin[]

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
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Type assertion for body (Elysia type inference limitation)
        const body = ctx.body as {
          name?: string
          description?: string
          imageUrl?: string
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

        const chatQueryResult = (await db
          .select()
          .from(chats)
          .where(eq(chats.id, params.id))
          .limit(1)) as unknown as Chat[]
        const chat = chatQueryResult[0]

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

    // Create encrypted MLS group chat
    .post(
      '/encrypted',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Type assertion for body (Elysia type inference limitation)
        const body = ctx.body as {
          participantIds: string[]
          name?: string
        }
        const { participantIds, name } = body

        if (!participantIds || participantIds.length === 0) {
          set.status = 400
          return { error: 'At least one participant is required' }
        }

        try {
          // Create MLS encrypted group
          const result = await createMLSGroup(
            user.userId,
            name ?? 'Encrypted Group',
            participantIds,
          )

          logger.info(
            'Encrypted MLS group created',
            { groupId: result.groupId, creatorId: user.userId },
            'POST /api/chats/encrypted',
          )

          return {
            success: true,
            chatId: result.groupId,
            encrypted: true,
            encryptionType: 'mls',
          }
        } catch (error) {
          set.status = 500
          return {
            error: `Failed to create encrypted group: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }
        }
      },
      {
        body: t.Object({
          participantIds: t.Array(t.String()),
          name: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Chats', 'Encryption'],
          summary: 'Create encrypted group chat',
          description:
            'Creates a new group chat with MLS end-to-end encryption. All messages in this group will be encrypted.',
        },
      },
    )

    // Get chat encryption status
    .get(
      '/:id/encryption',
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

        // Get chat type
        const [chat] = await db
          .select({ isGroup: chats.isGroup })
          .from(chats)
          .where(eq(chats.id, params.id))
          .limit(1)

        if (!chat) {
          set.status = 404
          return { error: 'Chat not found' }
        }

        if (chat.isGroup) {
          // Get MLS group encryption status (throws if chat not found)
          const status = await getGroupEncryptionStatus(params.id)
          return {
            success: true,
            encryption: {
              isEncrypted: status.isEncrypted,
              type: status.encryptionType ?? 'none',
              protocol: status.encryptionType === 'mls' ? 'MLS' : null,
              features:
                status.encryptionType === 'mls'
                  ? ['forward-secrecy', 'post-compromise-security']
                  : [],
            },
          }
        }
        // DM - check XMTP status
        return {
          success: true,
          encryption: {
            isEncrypted: isXMTPEnabled(),
            type: isXMTPEnabled() ? 'xmtp' : 'none',
            protocol: isXMTPEnabled() ? 'XMTP' : null,
            features: isXMTPEnabled()
              ? ['end-to-end-encryption', 'decentralized']
              : [],
          },
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Chats', 'Encryption'],
          summary: 'Get chat encryption status',
          description:
            'Returns the encryption status and type for a chat (XMTP for DMs, MLS for groups).',
        },
      },
    )

    // Get messaging status for current user
    .get(
      '/messaging-status',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const status = await getMessagingStatus(user.userId)

        return {
          success: true,
          status: {
            xmtpEnabled: status.xmtpEnabled,
            xmtpClientInitialized: status.hasClient,
            hasPublicKey: status.hasPublicKey,
            walletConnected: !!status.walletAddress,
            encryptionAvailable:
              status.xmtpEnabled && status.hasClient && !!status.walletAddress,
          },
        }
      },
      {
        detail: {
          tags: ['Chats', 'Encryption'],
          summary: 'Get messaging status',
          description:
            'Returns the current user messaging status including XMTP availability.',
        },
      },
    )

export const chatsRoutes = createChatsRoutes()
