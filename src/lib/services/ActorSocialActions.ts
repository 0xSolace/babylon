/**
 * Actor Social Actions Service
 *
 * Handles actors randomly inviting users to group chats or sending DMs
 * based on interaction history and social relationships.
 */

import db from '@/lib/database-service';
import { logger } from '@/lib/logger';
import { GroupChatInvite } from './group-chat-invite';

export type SocialAction = {
  type: 'group_chat_invite' | 'dm';
  userId: string;
  actorId: string;
  chatId?: string;
  chatName?: string;
  dmContent?: string;
};

export class ActorSocialActions {
  /**
   * Process random social actions for actors
   * Called periodically to randomly invite users or send DMs
   */
  static async processRandomSocialActions(): Promise<SocialAction[]> {
    const actions: SocialAction[] = [];

    // Get all actors
    const actors = await db().prisma.actor.findMany({
      take: 50, // Limit to prevent overload
    });

    // Get all active users with interactions
    const usersWithInteractions = await db().prisma.userInteraction.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        userId: true,
        npcId: true,
        qualityScore: true,
      },
      distinct: ['userId', 'npcId'],
    });

    // Group interactions by actor-user pairs
    const interactionMap = new Map<string, Array<{ userId: string; qualityScore: number }>>();

    for (const interaction of usersWithInteractions) {
      const key = `${interaction.npcId}-${interaction.userId}`;
      if (!interactionMap.has(key)) {
        interactionMap.set(key, []);
      }
      const interactions = interactionMap.get(key);
      if (interactions) {
        interactions.push({
          userId: interaction.userId,
          qualityScore: interaction.qualityScore,
        });
      }
    }

    // Process each actor-user pair
    for (const actor of actors) {
      const actorInteractions = Array.from(interactionMap.entries())
        .filter(([key]) => key.startsWith(`${actor.id}-`))
        .map(([key, interactions]) => {
          const parts = key.split('-');
          return {
            userId: parts.length > 1 ? parts[1] : '',
            interactions,
          };
        });

      for (const { userId, interactions } of actorInteractions) {
        if (!userId || interactions.length < ActorSocialActions.MIN_INTERACTIONS_FOR_ACTION) {
          continue;
        }

        const avgQuality =
          interactions.reduce((sum, i) => sum + i.qualityScore, 0) / interactions.length;
        if (avgQuality < ActorSocialActions.MIN_INTERACTION_QUALITY) {
          continue;
        }

        // Check if user is already in a chat with this actor
        const existingMembership = await db().prisma.groupChatMembership.findFirst({
          where: {
            userId,
            npcAdminId: actor.id,
            isActive: true,
          },
        });

        // Check if there's already a DM chat between this actor and user
        const existingDMChat =
          userId && actor.id
            ? await db().prisma.chat.findFirst({
                where: {
                  isGroup: false,
                  ChatParticipant: {
                    every: {
                      userId: {
                        in: [userId, actor.id],
                      },
                    },
                  },
                },
                include: {
                  ChatParticipant: true,
                },
              })
            : null;

        // Verify it's actually a DM between these two (2 participants total)
        const hasExistingDM =
          existingDMChat &&
          existingDMChat.ChatParticipant.length === 2 &&
          existingDMChat.ChatParticipant.some(
            (p: { userId: string | null }) => p.userId === userId
          ) &&
          existingDMChat.ChatParticipant.some(
            (p: { userId: string | null }) => p.userId === actor.id
          );

        // Calculate probabilities based on interaction quality and count
        const qualityFactor = Math.min(
          avgQuality / ActorSocialActions.MIN_INTERACTION_QUALITY,
          1.5
        );
        const countFactor = Math.min(
          interactions.length / ActorSocialActions.MIN_INTERACTIONS_FOR_ACTION,
          2.0
        );

        const inviteProbability =
          ActorSocialActions.BASE_INVITE_PROBABILITY * qualityFactor * countFactor;
        const dmProbability = ActorSocialActions.BASE_DM_PROBABILITY * qualityFactor * countFactor;

        if (!userId) throw new Error('User ID is required');
        if (!actor.id) throw new Error('Actor ID is required');
        // Randomly decide to invite to group chat
        if (!existingMembership && Math.random() < inviteProbability) {
          // Try to find an existing game chat owned by this actor
          let chatId = `${actor.id}-owned-chat`;
          let chatName = `${actor.name}'s Inner Circle`;

          // Look for existing game chats where this actor might be admin
          // Group chats are stored with kebab-case names, so we search by name pattern
          const existingChat = await db().prisma.chat.findFirst({
            where: {
              isGroup: true,
              gameId: 'continuous',
              name: {
                contains: actor.name.split(' ')[0] ?? '', // Try to match actor's first name
              },
            },
          });

          if (existingChat) {
            chatId = existingChat.id;
            chatName = existingChat.name || chatName;
          }
          await GroupChatInvite.recordInvite(userId, actor.id, chatId, chatName);
          actions.push({
            type: 'group_chat_invite',
            userId,
            actorId: actor.id,
            chatId,
            chatName,
          });
          logger.info(
            `Actor ${actor.name} invited user ${userId} to group chat`,
            {
              actorId: actor.id,
              userId,
              chatId,
              chatName,
            },
            'ActorSocialActions'
          );
        }

        // Randomly decide to send DM
        if (!hasExistingDM && Math.random() < dmProbability) {
          const dmChat = await ActorSocialActions.createDMWithMessage(actor.id, userId);
          actions.push({
            type: 'dm',
            userId,
            actorId: actor.id,
            chatId: dmChat.id,
            dmContent: dmChat.messageContent,
          });
          logger.info(
            `Actor ${actor.name} sent DM to user ${userId}`,
            {
              actorId: actor.id,
              userId,
              chatId: dmChat.id,
            },
            'ActorSocialActions'
          );
        }
      }
    }

    logger.info(
      `Processed ${actions.length} social actions`,
      {
        count: actions.length,
        invites: actions.filter((a) => a.type === 'group_chat_invite').length,
        dms: actions.filter((a) => a.type === 'dm').length,
      },
      'ActorSocialActions'
    );

    return actions;
  }
}
