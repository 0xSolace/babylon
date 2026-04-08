import * as babylonApi from '@babylon/api';
import * as BabylonDb from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';

interface NotifyTeamChatMessageParams {
  chatId: string;
  messageId: string;
  senderId: string;
  messagePreview: string;
}

/**
 * Team chat notifications only target human participants and dedupe per
 * persisted message ID so retries do not create duplicate unread items.
 */
export async function notifyTeamChatMessage({
  chatId,
  messageId,
  senderId,
  messagePreview,
}: NotifyTeamChatMessageParams): Promise<void> {
  try {
    const [senderRows, participantRows, chatNameRow] = await Promise.all([
      BabylonDb.selectUserDisplayAndUsernameById(db, senderId),
      BabylonDb.selectActiveTeamChatParticipantsWithUsers(db, chatId),
      BabylonDb.fetchChatNameById(chatId),
    ]);

    const recipientUserIds = participantRows
      .filter((participant) => !participant.isAgent)
      .map((participant) => participant.id)
      .filter((userId) => userId !== senderId);

    if (recipientUserIds.length === 0) {
      return;
    }

    const senderName =
      senderRows?.displayName || senderRows?.username || 'Someone';
    const preview =
      messagePreview.length > 50
        ? `${messagePreview.substring(0, 50)}...`
        : messagePreview;
    const chatName = chatNameRow || 'Agents';
    const message = `${senderName} in "${chatName}": ${preview}`;

    await Promise.all(
      recipientUserIds.map((userId) =>
        babylonApi.createNotification({
          userId,
          type: 'system',
          actorId: senderId,
          chatId,
          title: 'New Group Message',
          message,
          dedupeKey: `team-chat-message:${messageId}:${userId}`,
        })
      )
    );
  } catch (error) {
    logger.warn(
      'Failed to notify team chat message',
      {
        chatId,
        messageId,
        senderId,
        error: error instanceof Error ? error.message : String(error),
      },
      'TeamChatNotifications'
    );
  }
}
