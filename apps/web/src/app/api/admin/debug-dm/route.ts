export const dynamic = 'force-dynamic';

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
 *       - OAuth3Auth: []
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
import { db } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

interface ChatRow {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ParticipantRow {
  id: string;
  chatId: string;
  userId: string;
}

interface MessageRow {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

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

  // Get user info (try by ID, username, oauth3Id, or privyId)
  // @deprecated privyId - kept for migration compatibility, remove after migration complete
  const userSelect = {
    id: true,
    oauth3Id: true,
    privyId: true, // @deprecated - remove after Privy→OAuth3 migration complete
    username: true,
    displayName: true,
  } as const;

  let user = await db.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    // Try by username
    user = await db.user.findUnique({
      where: { username: userId },
      select: userSelect,
    });
  }

  if (!user) {
    // Try by oauth3Id (primary auth identifier)
    user = await db.user.findUnique({
      where: { oauth3Id: userId },
      select: userSelect,
    });
  }

  if (!user) {
    // @deprecated - Try by privyId for users who haven't migrated to OAuth3 yet
    user = await db.user.findUnique({
      where: { privyId: userId },
      select: userSelect,
    });
  }

  // Use the resolved user ID - fail fast if user not found
  if (!user) {
    return successResponse({
      error: `User not found: ${userId}`,
      user: null,
      participantRecords: [],
      chats: [],
    });
  }
  // @deprecated privyId fallback - remove after Privy→OAuth3 migration complete
  const resolvedUserId = user.id || user.oauth3Id || user.privyId || userId;

  // Get all ChatParticipant records for this user
  const participants = await db.chatParticipant.findMany({
    where: {
      userId: resolvedUserId,
    },
  });

  // Get details for each chat
  const chatIds = participants.map((p) => p.chatId);

  // Fetch chats, participants, messages using repository methods
  const chatsList: ChatRow[] =
    chatIds.length > 0
      ? await db.chat.findMany({
          where: { id: { in: chatIds } },
        })
      : [];

  // Get all participants for these chats
  const allParticipants: ParticipantRow[] =
    chatIds.length > 0
      ? await db.chatParticipant.findMany({
          where: { chatId: { in: chatIds } },
        })
      : [];

  // Get recent messages for each chat (ordered by most recent)
  const allMessages: MessageRow[] =
    chatIds.length > 0
      ? await db.message.findMany({
          where: { chatId: { in: chatIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];

  // Get message counts for each chat
  const messageCounts = await Promise.all(
    chatIds.map((chatId) =>
      db.message.count({
        where: { chatId: { equals: chatId } },
      })
    )
  );

  // Get all user IDs from participants
  const participantUserIds = [...new Set(allParticipants.map((p) => p.userId))];
  const participantUsers =
    participantUserIds.length > 0
      ? await db.user.findMany({
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

  const usersMap = new Map(participantUsers.map((u) => [u.id, u]));

  // Group participants and messages by chat
  const participantsByChat = new Map<string, ParticipantRow[]>();
  allParticipants.forEach((p) => {
    const list = participantsByChat.get(p.chatId) || [];
    list.push(p);
    participantsByChat.set(p.chatId, list);
  });

  const messagesByChat = new Map<string, MessageRow[]>();
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
    // @deprecated privyId field - remove after Privy→OAuth3 migration complete
    note: user
      ? `User database ID: ${user.id}, OAuth3 ID: ${user.oauth3Id || 'none'}, Privy ID [deprecated]: ${user.privyId || 'none'}`
      : 'User not found',
    participantRecords: participants,
    chats: chatsList.map((chat, index) => ({
      id: chat.id,
      name: chat.name,
      isGroup: chat.isGroup,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      participants: (participantsByChat.get(chat.id) || []).map((p) => {
        const participantUser = usersMap.get(p.userId);
        return {
          id: p.id,
          userId: p.userId,
          username: participantUser?.username || null,
          displayName: participantUser?.displayName || null,
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
