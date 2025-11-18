/**
 * NPC Group Dynamics Service
 *
 * Manages continuous NPC group chat dynamics:
 * - Form new groups based on relationships
 * - NPCs join existing groups
 * - NPCs leave groups
 * - NPCs kick members from their groups
 * - NPCs invite users to their groups
 * - NPCs post messages to groups
 *
 * Runs on game ticks to keep groups active and dynamic.
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { BabylonLLMClient } from '@/generator/llm/openai-client';

export type GroupDynamicsResult = {
  groupsCreated: number;
  membersAdded: number;
  membersRemoved: number;
  usersInvited: number;
  usersKicked: number;
  messagesPosted: number;
};

export class NPCGroupDynamicsService {
  /**
   * Process all NPC group dynamics for one tick
   */
  static async processTickDynamics(): Promise<GroupDynamicsResult> {
    const startTime = Date.now();
    const result: GroupDynamicsResult = {
      groupsCreated: 0,
      membersAdded: 0,
      membersRemoved: 0,
      usersInvited: 0,
      usersKicked: 0,
      messagesPosted: 0,
    };

    logger.info('Processing NPC group dynamics', undefined, 'NPCGroupDynamicsService');

    // Initialize LLM client for message generation
    let llm: BabylonLLMClient | null = null;
    try {
      llm = new BabylonLLMClient();
    } catch (error) {
      logger.warn(
        'Failed to initialize LLM for group dynamics',
        { error },
        'NPCGroupDynamicsService'
      );
    }

    // 1. Form new groups
    const newGroups = await NPCGroupDynamicsService.formNewGroups();
    result.groupsCreated = newGroups;

    // 2. NPCs join existing groups
    const joins = await NPCGroupDynamicsService.processGroupJoins();
    result.membersAdded = joins;

    // 3. NPCs leave groups
    const leaves = await NPCGroupDynamicsService.processGroupLeaves();
    result.membersRemoved = leaves;

    // 4. NPCs post messages to groups
    if (llm) {
      const messages = await NPCGroupDynamicsService.postGroupMessages(llm);
      result.messagesPosted = messages;
    }

    // 5. Invite users to groups
    const invites = await NPCGroupDynamicsService.inviteUsersToGroups();
    result.usersInvited = invites;

    // 6. Kick users based on weighted participation metrics
    const kicks = await NPCGroupDynamicsService.kickUsersWithWeightedLogic();
    result.usersKicked = kicks;

    const duration = Date.now() - startTime;
    logger.info('NPC group dynamics complete', { ...result, duration }, 'NPCGroupDynamicsService');

    return result;
  }

  /**
   * Get group dynamics statistics
   */
  static async getGroupStats(): Promise<{
    totalGroups: number;
    activeGroups: number;
    totalMembers: number;
    avgGroupSize: number;
  }> {
    const [totalGroups, groups] = await Promise.all([
      prisma.chat.count({
        where: { isGroup: true },
      }),
      prisma.chat.findMany({
        where: { isGroup: true },
        include: {
          ChatParticipant: true,
        },
      }),
    ]);

    const activeGroups = groups.filter(
      (g) => g.ChatParticipant.length >= NPCGroupDynamicsService.MIN_GROUP_SIZE
    ).length;
    const totalMembers = groups.reduce((sum, g) => sum + g.ChatParticipant.length, 0);
    const avgGroupSize = groups.length > 0 ? totalMembers / groups.length : 0;

    return {
      totalGroups,
      activeGroups,
      totalMembers,
      avgGroupSize,
    };
  }
}
