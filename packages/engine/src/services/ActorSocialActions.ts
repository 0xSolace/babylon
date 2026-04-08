/**
 * Actor Social Actions Service
 *
 * Handles actors randomly inviting users to group chats or sending DMs
 * based on interaction history and social relationships.
 */

import {
  fetchActorSocialSampleContinuousGroupChat,
  fetchUserActiveGroupMembershipForOwner,
  listActorSocialNonGroupChatParticipants,
  listActorSocialRecentInteractionPairs,
  runActorSocialCreateDmWithMessage,
} from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import { NPC_SOCIAL_ACTIONS_CONFIG } from '../config/npc-activity';
import { clamp01 } from '../utils/math-utils';
import { GroupChatService } from './group-chat-service';
import { StaticDataRegistry } from './static-data-registry';

export interface SocialAction {
  type: 'group_chat_invite' | 'dm';
  userId: string;
  actorId: string;
  chatId?: string;
  chatName?: string;
  dmContent?: string;
}

export class ActorSocialActions {
  /**
   * Process random social actions for actors
   * Called periodically to randomly invite users or send DMs
   */
  static async processRandomSocialActions(): Promise<SocialAction[]> {
    const actions: SocialAction[] = [];

    const actorList = StaticDataRegistry.getAllActors().slice(0, 50);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const usersWithInteractions = await listActorSocialRecentInteractionPairs({
      since: sevenDaysAgo,
    });

    const interactionMap = new Map<
      string,
      Array<{ userId: string; qualityScore: number }>
    >();

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

    for (const actor of actorList) {
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
        if (
          !userId ||
          interactions.length <
            NPC_SOCIAL_ACTIONS_CONFIG.minInteractionsForAction
        ) {
          continue;
        }

        const avgQuality =
          interactions.reduce((sum, i) => sum + i.qualityScore, 0) /
          interactions.length;
        if (avgQuality < NPC_SOCIAL_ACTIONS_CONFIG.minInteractionQuality) {
          continue;
        }

        const existingMembership = await fetchUserActiveGroupMembershipForOwner(
          {
            userId,
            ownerId: actor.id,
          }
        );

        let hasExistingDM = false;
        if (userId && actor.id) {
          const dmChats = await listActorSocialNonGroupChatParticipants();

          const chatParticipantMap = new Map<string, string[]>();
          for (const row of dmChats) {
            if (!chatParticipantMap.has(row.chatId)) {
              chatParticipantMap.set(row.chatId, []);
            }
            if (row.participants) {
              chatParticipantMap.get(row.chatId)!.push(row.participants);
            }
          }

          for (const [, participants] of chatParticipantMap) {
            if (
              participants.length === 2 &&
              participants.includes(userId) &&
              participants.includes(actor.id)
            ) {
              hasExistingDM = true;
              break;
            }
          }
        }

        const qualityDenominator =
          NPC_SOCIAL_ACTIONS_CONFIG.minInteractionQuality || 1;
        const countDenominator =
          NPC_SOCIAL_ACTIONS_CONFIG.minInteractionsForAction || 1;
        const qualityFactor = Math.min(avgQuality / qualityDenominator, 1.5);
        const countFactor = Math.min(
          interactions.length / countDenominator,
          2.0
        );

        const inviteProbability = clamp01(
          NPC_SOCIAL_ACTIONS_CONFIG.baseInviteProbability *
            qualityFactor *
            countFactor
        );
        const dmProbability = clamp01(
          NPC_SOCIAL_ACTIONS_CONFIG.baseDmProbability *
            qualityFactor *
            countFactor
        );

        if (!userId) throw new Error('User ID is required');
        if (!actor.id) throw new Error('Actor ID is required');
        if (!existingMembership && Math.random() < inviteProbability) {
          let chatId = `${actor.id}-owned-chat`;
          let chatName = `${actor.name}'s Inner Circle`;

          const existingChat =
            await fetchActorSocialSampleContinuousGroupChat();

          if (existingChat) {
            chatId = existingChat.id;
            chatName = existingChat.name || chatName;
          }
          await GroupChatService.recordInvite(
            userId,
            actor.id,
            chatId,
            chatName
          );
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

        if (!hasExistingDM && Math.random() < dmProbability) {
          const dmChat = await ActorSocialActions.createDMWithMessage(
            actor.id,
            userId
          );
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

  /**
   * Create a DM chat between an actor and a user with an initial message
   */
  private static async createDMWithMessage(
    actorId: string,
    userId: string
  ): Promise<{ id: string; messageContent: string }> {
    const messagesList: string[] = [
      "Hey! I've been noticing your posts. Want to chat?",
      'Thought you might find this interesting...',
      'Quick question for you!',
      'Loved your take on that last post. Mind if I DM you?',
      "Got something I think you'd want to hear.",
    ];
    const randomIndex = Math.floor(Math.random() * messagesList.length);
    const messageContent: string =
      messagesList[randomIndex] ?? messagesList[0] ?? '';

    const newChatSnowflakeId = await generateSnowflakeId();

    if (!messageContent) throw new Error('Message content is required');

    return runActorSocialCreateDmWithMessage({
      actorId,
      userId,
      messageContent,
      newChatSnowflakeId,
    });
  }
}
