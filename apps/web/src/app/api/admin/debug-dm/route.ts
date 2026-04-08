/**
 * Admin Debug DM API
 *
 * @route GET /api/admin/debug-dm - Debug user DM chats
 * @access Admin
 *
 * @description
 * Debug endpoint to check what DM chats exist for a user. Bypasses RLS for
 * admin debugging purposes. Returns all chats and messages for the user.
 *
 * @openapi
 * /api/admin/debug-dm:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Debug user DM chats
 *     description: Returns all DM chats for a user (admin only, bypasses RLS)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to debug
 *     responses:
 *       200:
 *         description: Debug info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 chats:
 *                   type: array
 *       400:
 *         description: userId parameter required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * @example
 * ```typescript
 * const debug = await fetch('/api/admin/debug-dm?userId=user-id', {
 *   headers: { 'Authorization': `Bearer ${adminToken}` }
 * }).then(r => r.json());
 * ```
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api';
import {
  selectChatParticipantsByChatIdsForAdminDebug,
  selectChatsByIdsForAdminDebug,
  selectMessagesByChatIdsForAdminDebug,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return successResponse({
      error: 'userId parameter required',
    });
  }

  logger.info('Debug DM lookup', { userId }, 'GET /api/admin/debug-dm');

  const {
    user,
    participants,
    chatsList,
    allParticipants,
    allMessages,
    messageCounts,
    participantUsers,
  } = await asSystem(async (database) => {
    let u = await database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        privyId: true,
        username: true,
        displayName: true,
      },
    });

    if (!u) {
      u = await database.user.findUnique({
        where: { username: userId },
        select: {
          id: true,
          privyId: true,
          username: true,
          displayName: true,
        },
      });
    }

    if (!u) {
      u = await database.user.findUnique({
        where: { privyId: userId },
        select: {
          id: true,
          privyId: true,
          username: true,
          displayName: true,
        },
      });
    }

    const resolvedUserId = u?.id || u?.privyId || userId;

    const participantRecords = await database.chatParticipant.findMany({
      where: {
        userId: resolvedUserId,
      },
    });

    const chatIds = participantRecords.map((p) => p.chatId);

    const chatsListInner = await selectChatsByIdsForAdminDebug(
      database,
      chatIds
    );

    const allParticipantsInner =
      await selectChatParticipantsByChatIdsForAdminDebug(database, chatIds);

    const allMessagesInner = await selectMessagesByChatIdsForAdminDebug(
      database,
      chatIds
    );

    const messageCountsInner = await Promise.all(
      chatIds.map((chatId) =>
        database.message.count({
          where: { chatId: { equals: chatId } },
        })
      )
    );

    const participantUserIds = [
      ...new Set(allParticipantsInner.map((p) => p.userId)),
    ];
    const participantUsersInner =
      participantUserIds.length > 0
        ? await database.user.findMany({
            where: {
              id: { in: participantUserIds },
            },
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          })
        : [];

    return {
      user: u,
      participants: participantRecords,
      chatsList: chatsListInner,
      allParticipants: allParticipantsInner,
      allMessages: allMessagesInner,
      messageCounts: messageCountsInner,
      participantUsers: participantUsersInner,
    };
  }, 'admin-debug-dm');

  const usersMap = new Map(participantUsers.map((u) => [u.id, u]));

  // Group participants and messages by chat
  const participantsByChat = new Map<string, typeof allParticipants>();
  allParticipants.forEach((p) => {
    const list = participantsByChat.get(p.chatId) || [];
    list.push(p);
    participantsByChat.set(p.chatId, list);
  });

  const messagesByChat = new Map<string, typeof allMessages>();
  allMessages.forEach((m) => {
    const list = messagesByChat.get(m.chatId) || [];
    if (list.length < 5) {
      list.push(m);
    }
    messagesByChat.set(m.chatId, list);
  });

  logger.info(
    'Debug DM results',
    {
      userId,
      participantsCount: participants.length,
      chatsCount: chatsList.length,
    },
    'GET /api/admin/debug-dm'
  );

  return successResponse({
    user,
    note: user
      ? `User database ID: ${user.id}, Privy ID: ${user.privyId}`
      : 'User not found',
    participantRecords: participants,
    chats: chatsList.map((chat, index) => ({
      id: chat.id,
      name: chat.name,
      isGroup: chat.isGroup,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      participants: (participantsByChat.get(chat.id) || []).map((p) => {
        const user = usersMap.get(p.userId);
        return {
          id: p.id,
          userId: p.userId,
          username: user?.username || null,
          displayName: user?.displayName || null,
        };
      }),
      totalMessageCount: messageCounts[index] || 0,
      loadedMessageCount: (messagesByChat.get(chat.id) || []).length,
      recentMessages: (messagesByChat.get(chat.id) || [])
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          content: m.content.substring(0, 50),
          senderId: m.senderId,
          createdAt: m.createdAt,
        })),
    })),
  });
});
