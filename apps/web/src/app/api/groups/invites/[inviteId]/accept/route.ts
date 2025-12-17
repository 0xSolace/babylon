/**
 * Group Invite Accept API
 *
 * @route POST /api/groups/invites/[inviteId]/accept - Accept group invite
 * @access Authenticated
 *
 * @description
 * Accepts a group invitation. Adds the authenticated user to the group
 * and removes the invite. User must be the invitee.
 *
 * @openapi
 * /api/groups/invites/{inviteId}/accept:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Accept group invite
 *     description: Accepts a group invitation (authenticated user only)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: string
 *         description: Invite ID
 *     responses:
 *       200:
 *         description: Invite accepted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the invitee
 *       404:
 *         description: Invite not found
 *
 * @example
 * ```typescript
 * await fetch(`/api/groups/invites/${inviteId}/accept`, {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * ```
 */

import {
  ApiError,
  authenticate,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { asUser } from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import { nanoid } from 'nanoid';
import type { NextRequest } from 'next/server';

/**
 * POST /api/groups/invites/[inviteId]/accept
 * Accept a group invitation (supports both user groups and NPC group chats)
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ inviteId: string }> }
  ) => {
    const user = await authenticate(request);
    const { inviteId } = await params;

    const result = await asUser(user, async (db) => {
      const invite = await db.userGroupInvite.findUnique({
        where: { id: inviteId },
      });

      if (!invite) {
        throw new ApiError('Invite not found', 404);
      }

      if (invite.invitedUserId !== user.userId) {
        throw new ApiError('This invite is not for you', 403);
      }

      if (invite.status !== 'pending') {
        throw new ApiError('This invite has already been processed', 400);
      }

      // Check if this is an NPC group chat (groupId is a chat ID)
      const npcChat = await db.chat.findFirst({
        where: { id: invite.groupId, isGroup: true },
      });

      if (npcChat) {
        // NPC group chat flow
        const existingParticipant = await db.chatParticipant.findFirst({
          where: { chatId: npcChat.id, userId: user.userId },
        });

        if (existingParticipant) {
          await db.userGroupInvite.update({
            where: { id: inviteId },
            data: { status: 'accepted', respondedAt: new Date() },
          });
          throw new ApiError('You are already in this group chat', 400);
        }

        // Add as chat participant
        await db.chatParticipant.create({
          data: {
            id: await generateSnowflakeId(),
            chatId: npcChat.id,
            userId: user.userId,
            invitedBy: invite.invitedBy,
          },
        });

        // Add group chat membership record
        await db.groupChatMembership.create({
          data: {
            id: await generateSnowflakeId(),
            userId: user.userId,
            chatId: npcChat.id,
            npcAdminId: npcChat.npcAdminId || invite.invitedBy,
            isActive: true,
          },
        });

        await db.userGroupInvite.update({
          where: { id: inviteId },
          data: { status: 'accepted', respondedAt: new Date() },
        });

        await db.notification.updateMany({
          where: { userId: user.userId, type: 'group_invite' },
          data: { read: true },
        });

        return {
          groupId: invite.groupId,
          chatId: npcChat.id,
          isNpcGroup: true,
        };
      }

      // User group flow (existing logic)
      const existingMember = await db.userGroupMember.findFirst({
        where: { groupId: invite.groupId, userId: user.userId },
      });

      if (existingMember) {
        await db.userGroupInvite.update({
          where: { id: inviteId },
          data: { status: 'accepted', respondedAt: new Date() },
        });
        throw new ApiError('You are already a member of this group', 400);
      }

      await db.userGroupMember.create({
        data: {
          id: nanoid(),
          groupId: invite.groupId,
          userId: user.userId,
          addedBy: invite.invitedBy,
          joinedAt: new Date(),
        },
      });

      // Add to associated chat if exists
      const chat = await db.chat.findFirst({
        where: { groupId: invite.groupId, isGroup: true },
      });

      if (chat) {
        await db.chatParticipant.create({
          data: {
            id: nanoid(),
            chatId: chat.id,
            userId: user.userId,
            joinedAt: new Date(),
          },
        });
      }

      await db.userGroupInvite.update({
        where: { id: inviteId },
        data: { status: 'accepted', respondedAt: new Date() },
      });

      await db.notification.updateMany({
        where: { userId: user.userId, type: 'group_invite' },
        data: { read: true },
      });

      return { groupId: invite.groupId, chatId: chat?.id, isNpcGroup: false };
    });

    logger.info(
      'Group invite accepted',
      { userId: user.userId, inviteId, isNpcGroup: result.isNpcGroup },
      'POST /api/groups/invites/:inviteId/accept'
    );

    return successResponse(result);
  }
);
