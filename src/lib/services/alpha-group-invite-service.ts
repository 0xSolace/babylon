/**
 * Alpha Group Invite Service
 *
 * Invites users to NPC group chats based on positive interactions.
 * Runs on game ticks with small random chance for eligible users.
 *
 * Criteria:
 * - User has positive interactions with NPC (replies, likes, shares)
 * - Not too many interactions (avoid spam)
 * - Not already in a group with this NPC
 * - Small random chance each tick (0.5% for highly engaged users)
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export type AlphaInviteResult = {
  npcId: string;
  npcName: string;
  userId: string;
  invitedToChat: string;
  engagementScore: number;
  probability: number;
};

export class AlphaGroupInviteService {
  /**
   * Process alpha group invites for one tick
   * Checks all NPCs and their top engaged users
   */
  static async processTickInvites(): Promise<AlphaInviteResult[]> {
    const startTime = Date.now();
    const invites: AlphaInviteResult[] = [];

    // Get all NPCs (actors)
    const npcs = await prisma.actor.findMany({
      where: {
        hasPool: true, // Only NPCs with active pools
      },
      select: {
        id: true,
        name: true,
      },
    });

    logger.info(
      `Processing alpha invites for ${npcs.length} NPCs`,
      undefined,
      'AlphaGroupInviteService'
    );

    // Process each NPC
    for (const npc of npcs) {
      if (invites.length >= AlphaGroupInviteService.MAX_INVITES_PER_TICK) {
        logger.info(
          'Reached max invites per tick',
          { count: invites.length },
          'AlphaGroupInviteService'
        );
        break;
      }

      const npcInvites = await AlphaGroupInviteService.processNPCInvites(npc.id, npc.name);
      invites.push(...npcInvites);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Alpha invite tick complete: ${invites.length} invites sent`,
      { duration, invites: invites.length },
      'AlphaGroupInviteService'
    );

    return invites;
  }

  /**
   * Get invite statistics for debugging
   */
  static async getInviteStats(): Promise<{
    totalInvites: number;
    activeGroups: number;
    invitesLast24h: number;
  }> {
    const [totalInvites, activeGroups, recentInvites] = await Promise.all([
      prisma.groupChatMembership.count(),
      prisma.groupChatMembership.count({
        where: { isActive: true },
      }),
      prisma.groupChatMembership.count({
        where: {
          joinedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalInvites,
      activeGroups,
      invitesLast24h: recentInvites,
    };
  }
}
