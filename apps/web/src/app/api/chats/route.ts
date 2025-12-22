export const dynamic = 'force-dynamic';

/**
 * Chat Management API
 *
 * @route GET /api/chats - List user's chats
 * @route POST /api/chats - Create new chat
 * @access Authenticated
 *
 * @description
 * Manages both group chats and direct messages (DMs). Provides chat listings
 * with participant information, message counts, and last message previews.
 * Supports both user-specific chats and all game chats retrieval.
 *
 * @openapi
 * /api/chats:
 *   get:
 *     tags:
 *       - Chats
 *     summary: List user chats
 *     description: Returns all chats (group and DMs) the authenticated user participates in. Use ?all=true for public game chats.
 *     security:
 *       - OAuth3Auth: []
 *     parameters:
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Get all game chats (public, no auth)
 *       - in: query
 *         name: debug
 *         schema:
 *           type: boolean
 *         description: Enable debug logging
 *     responses:
 *       200:
 *         description: Chat listings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groupChats:
 *                   type: array
 *                   items:
 *                     type: object
 *                 directChats:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags:
 *       - Chats
 *     summary: Create new chat
 *     description: Creates a new chat (group or DM) and adds participants.
 *     security:
 *       - OAuth3Auth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Chat name (optional for DMs)
 *               isGroup:
 *                 type: boolean
 *                 default: false
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to add
 *     responses:
 *       201:
 *         description: Chat created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chat:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *
 * **GET - List User's Chats**
 *
 * Returns all chats the authenticated user participates in, separated into:
 * - **Group Chats:** Multi-participant group conversations
 * - **Direct Messages:** One-on-one chats with other real users
 *
 * **Features:**
 * - Quality scoring for group chats
 * - Last message preview
 * - Message count tracking
 * - Participant metadata
 * - DM participant profile details
 * - Filters out NPC/actor DMs (only real user DMs shown)
 *
 * @query {boolean} all - Get all game chats (public, no auth required)
 * @query {boolean} debug - Enable debug logging
 *
 * **All Game Chats Mode (all=true):**
 * Returns all group chats for the game without authentication.
 * Used for public game chat discovery.
 *
 * @returns {object} Chat listings
 * @property {array} groupChats - User's group chat memberships
 * @property {array} directChats - User's direct message chats
 * @property {number} total - Total chat count
 *
 * **POST - Create New Chat**
 *
 * Creates a new chat (group or DM) and adds participants.
 * Creator is automatically added as the first participant.
 *
 * @param {string} name - Chat name (optional for DMs)
 * @param {boolean} isGroup - Whether chat is a group chat (default: false)
 * @param {array} participantIds - Array of user IDs to add (optional)
 *
 * @returns {object} Created chat
 * @property {object} chat - Created chat object
 *
 * @throws {400} Invalid input parameters
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 *
 * @example
 * ```typescript
 * // Get user's chats
 * const chats = await fetch('/api/chats', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { groupChats, directChats } = await chats.json();
 *
 * // Get all game chats (public)
 * const gameChats = await fetch('/api/chats?all=true');
 * const { chats } = await gameChats.json();
 *
 * // Create group chat
 * const newGroup = await fetch('/api/chats', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     name: 'Strategy Discussion',
 *     isGroup: true,
 *     participantIds: ['user1', 'user2', 'user3']
 *   })
 * });
 *
 * // Create DM
 * const newDM = await fetch('/api/chats', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     isGroup: false,
 *     participantIds: ['otherUserId']
 *   })
 * });
 * ```
 *
 * @see {@link /lib/db/context} Database context with RLS
 * @see {@link /lib/validation/schemas} Request validation schemas
 * @see {@link /src/app/chats/page.tsx} Chat list UI
 */

import {
  authenticate,
  PointsService,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { asSystem, asUser, type DbClient } from '@babylon/db';
import {
  ChatCreateSchema,
  ChatQuerySchema,
  generateSnowflakeId,
  logger,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';

// Types for raw query results
interface MessageCountRow {
  chatId: string;
  count: number | string;
}

/**
 * GET /api/chats
 * Get all chats for the authenticated user
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  console.log('[API /api/chats] GET request received');
  logger.info('GET /api/chats - Request received', undefined, 'GET /api/chats');

  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const query: Record<string, string> = {};

  const all = searchParams.get('all');
  const debug = searchParams.get('debug');

  if (all) query.all = all;
  if (debug) query.debug = debug;

  const validatedQuery =
    Object.keys(query).length > 0
      ? ChatQuerySchema.parse(query)
      : { all: undefined, debug: undefined };

  const getAllChats = validatedQuery.all === 'true';

  if (getAllChats) {
    // Return all game chats (no auth required for read-only game data)
    const gameChats = await asSystem(async (dbClient: DbClient) => {
      // Get chats using repository pattern
      const chatList = await dbClient.chat.findMany({
        where: { isGroup: true, gameId: 'continuous' },
        orderBy: { createdAt: 'asc' },
      });

      const chatIds = chatList.map((c) => c.id);
      if (chatIds.length === 0) return [];

      // Get message counts using raw SQL with GROUP BY
      const placeholders = chatIds.map((_, i) => `$${i + 1}`).join(', ');
      const messageCountResults = await dbClient.query<MessageCountRow>(
        `SELECT "chatId", COUNT("id") as count FROM "Message" WHERE "chatId" IN (${placeholders}) GROUP BY "chatId"`,
        chatIds
      );

      const countMap = new Map(
        messageCountResults.map((mc) => [mc.chatId, Number(mc.count)])
      );

      // Get latest messages for each chat
      const latestMessages = await Promise.all(
        chatIds.map(async (chatId) => {
          const msg = await dbClient.message.findFirst({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
          });
          return { chatId, message: msg };
        })
      );

      const messagesMap = new Map(
        latestMessages.map(({ chatId, message }) => [chatId, message])
      );

      return chatList.map((chat) => ({
        ...chat,
        _messageCount: countMap.get(chat.id) ?? 0,
        _latestMessage: messagesMap.get(chat.id) || null,
      }));
    });

    logger.info(
      'All game chats fetched',
      { count: gameChats.length },
      'GET /api/chats'
    );

    return successResponse({
      chats: gameChats.map((chat) => {
        return {
          id: chat.id,
          name: chat.name,
          isGroup: chat.isGroup,
          messageCount: chat._messageCount,
          lastMessage: chat._latestMessage || null,
        };
      }),
    });
  }

  const user = await authenticate(request);

  logger.info(
    'Fetching chats for user',
    {
      userId: user.userId,
      oauth3Id: user.oauth3Id,
      dbUserId: user.dbUserId,
      fullUser: user,
    },
    'GET /api/chats'
  );

  // Get user's chats with proper RLS context
  const { groupChats, directChats } = await asUser(
    user,
    async (dbClient: DbClient) => {
      // Get user's group chat memberships
      const memberships = await dbClient.groupChatMembership.findMany({
        where: { userId: user.userId, isActive: true },
        orderBy: { lastMessageAt: 'desc' },
      });

      // Get chat details for group chats
      const groupChatIds = memberships.map((m) => m.chatId);
      const groupChatDetails =
        groupChatIds.length > 0
          ? await dbClient.chat.findMany({
              where: { id: { in: groupChatIds } },
            })
          : [];

      // Get last messages for group chats
      const groupChatMessages = await Promise.all(
        groupChatIds.map(async (chatId) => {
          const msg = await dbClient.message.findFirst({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
          });
          return { chatId, message: msg };
        })
      );
      const groupMessagesMap = new Map(
        groupChatMessages.map(({ chatId, message }) => [chatId, message])
      );

      const chatDetailsMap = new Map(groupChatDetails.map((c) => [c.id, c]));

      // Get DM chats the user participates in
      const dmParticipantsList = await dbClient.chatParticipant.findMany({
        where: { userId: user.userId },
      });

      logger.info(
        'Found DM participants',
        {
          userId: user.userId,
          count: dmParticipantsList.length,
        },
        'GET /api/chats'
      );

      const dmChatIds = dmParticipantsList.map((p) => p.chatId);

      // Get DM chat details (non-group chats)
      const dmChatsDetails =
        dmChatIds.length > 0
          ? await dbClient.chat.findMany({
              where: { id: { in: dmChatIds }, isGroup: false },
            })
          : [];

      const dmChatIdsFiltered = dmChatsDetails.map((c) => c.id);

      // Get all participants for DM chats
      const allParticipants =
        dmChatIdsFiltered.length > 0
          ? await dbClient.chatParticipant.findMany({
              where: { chatId: { in: dmChatIdsFiltered } },
            })
          : [];

      // Get messages for DM chats
      const allMessages = await Promise.all(
        dmChatIdsFiltered.map(async (chatId) => {
          const msg = await dbClient.message.findFirst({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
          });
          return { chatId, message: msg };
        })
      );

      const participantsByChatId = new Map<string, typeof allParticipants>();
      allParticipants.forEach((p) => {
        if (!participantsByChatId.has(p.chatId)) {
          participantsByChatId.set(p.chatId, []);
        }
        participantsByChatId.get(p.chatId)!.push(p);
      });

      const messagesByChatId = new Map<
        string,
        (typeof allMessages)[number]['message']
      >();
      allMessages.forEach(({ chatId, message }) => {
        messagesByChatId.set(chatId, message);
      });

      // Format group chats
      const groupChatsList = memberships
        .map((membership) => {
          const chat = chatDetailsMap.get(membership.chatId);
          if (!chat) return null;
          const lastMessage = groupMessagesMap.get(membership.chatId) || null;
          return {
            id: membership.chatId,
            name: chat.name || 'Unnamed Group',
            isGroup: true,
            lastMessage,
            messageCount: membership.messageCount,
            qualityScore: membership.qualityScore,
            lastMessageAt: membership.lastMessageAt,
            updatedAt: chat.updatedAt,
          };
        })
        .filter((c) => c !== null);

      // Format DM chats - get the other participant's name and details
      const directChatsList = await Promise.all(
        dmChatsDetails.map(async (chat) => {
          const chatParticipantsList = participantsByChatId.get(chat.id) || [];
          // Find the other participant (not the current user)
          const otherParticipant = chatParticipantsList.find(
            (p) => p.userId !== user.userId
          );
          let chatName = chat.name || 'Direct Message';
          let otherUserDetails = null;

          if (otherParticipant) {
            // Try to get user details (real users only, not actors)
            const otherUser = await dbClient.user.findUnique({
              where: { id: otherParticipant.userId },
            });

            if (otherUser && !otherUser.isActor) {
              chatName =
                otherUser.displayName || otherUser.username || 'Unknown';
              otherUserDetails = {
                id: otherUser.id,
                displayName: otherUser.displayName,
                username: otherUser.username,
                profileImageUrl: otherUser.profileImageUrl,
              };
            }
          }

          // Only return DMs with real users (not NPCs)
          if (!otherUserDetails) {
            return null;
          }

          // Get last message for this chat
          const lastMessage = messagesByChatId.get(chat.id) || null;

          return {
            id: chat.id,
            name: chatName,
            isGroup: false,
            lastMessage: lastMessage,
            participants: chatParticipantsList.length,
            updatedAt: chat.updatedAt,
            otherUser: otherUserDetails,
          };
        })
      ).then((chatsList) => chatsList.filter((c) => c !== null));

      return { groupChats: groupChatsList, directChats: directChatsList };
    }
  );

  logger.info(
    'User chats fetched successfully',
    {
      userId: user.userId,
      groupChats: groupChats.length,
      directChats: directChats.length,
    },
    'GET /api/chats'
  );

  return successResponse({
    groupChats,
    directChats,
    total: groupChats.length + directChats.length,
  });
});

/**
 * POST /api/chats
 * Create a new chat
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  // Validate request body
  const body = await request.json();
  const { name, isGroup, participantIds } = ChatCreateSchema.parse(body);

  // Create the chat with RLS
  const chat = await asUser(user, async (dbClient: DbClient) => {
    // Create the chat using repository
    const now = new Date();
    const newChat = await dbClient.chat.create({
      data: {
        id: await generateSnowflakeId(),
        name: name || null,
        isGroup: isGroup || false,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Add creator as participant
    await dbClient.chatParticipant.create({
      data: {
        id: await generateSnowflakeId(),
        chatId: newChat.id,
        userId: user.userId,
      },
    });

    // Add other participants if provided
    if (participantIds && Array.isArray(participantIds)) {
      for (const participantId of participantIds) {
        await dbClient.chatParticipant.create({
          data: {
            id: await generateSnowflakeId(),
            chatId: newChat.id,
            userId: participantId,
          },
        });
      }
    }

    return newChat;
  });

  // Award points for creating a private channel (group chat created directly, not through UserGroup)
  if (isGroup && !chat.groupId) {
    await PointsService.awardPrivateChannelCreate(user.userId, chat.id).catch(
      (error: Error) => {
        // Log error but don't fail chat creation if points award fails
        logger.error(
          'Failed to award points for private channel creation',
          { error: error.message, userId: user.userId, chatId: chat.id },
          'POST /api/chats'
        );
      }
    );
  }

  logger.info(
    'Chat created successfully',
    {
      chatId: chat.id,
      userId: user.userId,
      isGroup,
      participantCount: (participantIds?.length || 0) + 1,
    },
    'POST /api/chats'
  );

  return successResponse({ chat }, 201);
});
