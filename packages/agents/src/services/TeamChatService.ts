/**
 * Team Chat Service - Agents
 *
 * Manages the unified "Agents" group chat for each user's agents.
 * Each user has exactly ONE team chat containing ALL their agents.
 *
 * Lifecycle:
 * - First agent created → Team chat auto-created
 * - Additional agents → Auto-added to team chat
 * - Agent deleted → Auto-removed from team chat
 * - All agents deleted → Team chat persists (for history)
 *
 * @packageDocumentation
 */

import {
  batchUpsertChatParticipantsActive,
  batchUpsertGroupMembersAsTeamAgents,
  type Chat,
  countUserMessagesInChat,
  deactivateChatParticipantInChat,
  deactivateGroupMemberInTeam,
  deleteChatById,
  deleteChatParticipantsByChatId,
  deleteMessagesByChatId,
  type Group,
  generateSnowflakeId,
  insertChatParticipantRow,
  insertChatParticipantsOnConflictDoNothing,
  insertChatReturningRow,
  insertTeamChatBootstrapBundle,
  insertTeamChatSystemMessage,
  selectActiveChatParticipantId,
  selectActiveGroupMemberId,
  selectActiveGroupMemberUserIds,
  selectAgentUserIdsManagedBy,
  selectChatGroupIdByChatId,
  selectChatNameByIdAndGroupId,
  selectChatRowByIdAndGroupId,
  selectChatsForGroupOrderByUpdatedDesc,
  selectNewestChatIdInGroupExcluding,
  selectTeamChatAgentUsersForOwner,
  selectTeamGroupRowByOwnerId,
  selectUserRowById,
  type User,
  updateChatNameById,
  updateChatNameIfNullForGroupReturningIds,
  updateGroupActiveChatId,
  updateGroupUpdatedAt,
  upsertChatParticipantActive,
  upsertGroupMemberAsTeamAgent,
  upsertTeamGroupOwnerMember,
  withTransaction,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { logger } from '../shared/logger';

/** Constants for Agents */
const TEAM_CHAT_NAME = 'Agents';
const TEAM_CHAT_DESCRIPTION = 'Coordinate all your agents in one place';

/**
 * Format a date for display in chat names.
 * Used for UI fallback when chat.name is null.
 * Format: "Jan 24, 10:30 AM"
 */
export function formatChatDate(date: Date): string {
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Get display name for a chat.
 * Returns the actual name if set, or a fallback using createdAt.
 */
export function getChatDisplayName(chat: {
  name: string | null;
  createdAt: Date | string;
}): string {
  if (chat.name) return chat.name;
  const date =
    chat.createdAt instanceof Date ? chat.createdAt : new Date(chat.createdAt);
  return `New Chat - ${formatChatDate(date)}`;
}

/**
 * Team chat information returned by service methods.
 * Now maps directly from Group table (type='team').
 */
export interface TeamChatInfo {
  id: string; // Group ID (same as groupId for backwards compat)
  groupId: string; // Group ID
  chatId: string; // Currently active Chat ID (from Group.activeChatId)
  ownerId: string; // User who owns this team chat
  createdAt: Date;
  updatedAt: Date;
}

/** Team chat with members */
export interface TeamChatWithMembers extends TeamChatInfo {
  agents: User[];
}

/**
 * Service for managing user agent team chats (Agents)
 */
export class TeamChatService {
  /**
   * Ensure a team chat exists for the user.
   * Creates one if it doesn't exist, returns existing if it does.
   *
   * Now uses Group table directly with type='team'.
   * Group.activeChatId tracks the current conversation.
   *
   * @param userId - The human user ID (not agent ID)
   * @returns Team chat info with groupId and chatId
   */
  async ensureTeamChat(userId: string): Promise<TeamChatInfo> {
    // Check if team chat already exists
    const existing = await this.getTeamChat(userId);
    if (existing) {
      // Ensure user is a participant (repair if missing)
      await this.ensureUserIsParticipant(userId, existing);
      return existing;
    }

    // Create new team chat in a transaction with conflict handling
    // Database has a partial unique index (ownerId WHERE type='team') to prevent duplicates
    let result: TeamChatInfo | null = null;

    try {
      result = await withTransaction(async (tx) => {
        const existingInTx = await selectTeamGroupRowByOwnerId(tx, userId);

        if (existingInTx) {
          return null;
        }

        const now = new Date();
        const [groupId, chatId, memberId, participantId] = await Promise.all([
          generateSnowflakeId(),
          generateSnowflakeId(),
          generateSnowflakeId(),
          generateSnowflakeId(),
        ]);

        return await insertTeamChatBootstrapBundle(tx, {
          groupId,
          chatId,
          memberId,
          participantId,
          userId,
          now,
          groupName: TEAM_CHAT_NAME,
          groupDescription: TEAM_CHAT_DESCRIPTION,
        });
      });
    } catch (error) {
      // Handle unique constraint violation (race condition - another transaction won)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('unique') ||
        errorMessage.includes('duplicate') ||
        errorMessage.includes('Group_team_ownerId_unique')
      ) {
        logger.info(
          `Team chat creation race condition detected for user ${userId}, fetching existing`,
          undefined,
          'TeamChatService'
        );
        const existingAfterRace = await this.getTeamChat(userId);
        if (existingAfterRace) {
          return existingAfterRace;
        }
      }
      // Re-throw other errors
      throw error;
    }

    // Handle race condition: if result is null, another transaction won - fetch existing
    if (result === null) {
      const existingAfterRace = await this.getTeamChat(userId);
      if (existingAfterRace) {
        logger.info(
          `Team chat already created by concurrent request for user ${userId}`,
          {
            groupId: existingAfterRace.groupId,
            chatId: existingAfterRace.chatId,
          },
          'TeamChatService'
        );
        return existingAfterRace;
      }
      // This should not happen, but fail fast if it does
      throw new Error(
        'Failed to create team chat: race condition with no winner'
      );
    }

    logger.info(
      `Team chat created for user ${userId}`,
      { groupId: result.groupId, chatId: result.chatId },
      'TeamChatService'
    );

    return result;
  }

  /**
   * Ensure the user is a participant in their team chat.
   * Repairs missing chatParticipants and groupMembers records.
   *
   * This handles cases where:
   * - Partial creation failure left user without participant record
   * - Database corruption/migration removed the record
   * - Any other scenario where the team chat exists but user can't access it
   *
   * @param userId - The human user ID
   * @param teamChat - The team chat info
   */
  private async ensureUserIsParticipant(
    userId: string,
    teamChat: TeamChatInfo
  ): Promise<void> {
    // Check if user is already a participant AND group member
    const [existingParticipant, existingGroupMember] = await Promise.all([
      selectActiveChatParticipantId(db, teamChat.chatId, userId),
      selectActiveGroupMemberId(db, teamChat.groupId, userId),
    ]);

    if (existingParticipant && existingGroupMember) {
      // User has both records, nothing to do
      return;
    }

    // User is missing chatParticipants and/or groupMembers - repair it
    logger.warn(
      `Repairing missing records for user ${userId} in team chat`,
      {
        userId,
        chatId: teamChat.chatId,
        groupId: teamChat.groupId,
        missingParticipant: !existingParticipant,
        missingGroupMember: !existingGroupMember,
      },
      'TeamChatService'
    );

    await withTransaction(async (tx) => {
      const now = new Date();
      const [participantId, memberId] = await Promise.all([
        generateSnowflakeId(),
        generateSnowflakeId(),
      ]);

      await upsertChatParticipantActive(tx, {
        id: participantId,
        chatId: teamChat.chatId,
        userId,
        joinedAt: now,
      });

      await upsertTeamGroupOwnerMember(tx, {
        id: memberId,
        groupId: teamChat.groupId,
        userId,
        joinedAt: now,
        addedBy: userId,
      });
    });

    logger.info(
      `Repaired chatParticipant record for user ${userId} in team chat ${teamChat.chatId}`,
      { userId, chatId: teamChat.chatId },
      'TeamChatService'
    );
  }

  /**
   * Get the team chat for a user (if it exists)
   * Now queries Group table directly with type='team'.
   *
   * @param userId - The human user ID
   * @returns Team chat info or null if not found
   */
  async getTeamChat(userId: string): Promise<TeamChatInfo | null> {
    const group = await selectTeamGroupRowByOwnerId(db, userId);

    if (!group || !group.activeChatId) {
      return null;
    }

    return this.groupToTeamChatInfo(group);
  }

  /**
   * Convert a Group record to TeamChatInfo
   */
  private groupToTeamChatInfo(group: Group): TeamChatInfo {
    return {
      id: group.id,
      groupId: group.id,
      chatId: group.activeChatId!, // activeChatId should be set for team groups
      ownerId: group.ownerId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  /**
   * Validate that a chat ID belongs to a user's team chat.
   * This is a security check to prevent users from writing to other users' team chats.
   *
   * Since we support multiple conversations (Chats) per team chat,
   * we validate by checking if the Chat's groupId matches the team's groupId.
   *
   * @param userId - The human user ID to validate against
   * @param chatId - The chat ID to validate
   * @returns True if the chat belongs to the user's team, false otherwise
   */
  async validateTeamChatOwnership(
    userId: string,
    chatId: string
  ): Promise<boolean> {
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      return false;
    }

    const groupId = await selectChatGroupIdByChatId(db, chatId);

    return groupId === teamChat.groupId;
  }

  /**
   * Get the team chat with all member agents
   *
   * @param userId - The human user ID
   * @returns Team chat with agents or null if not found
   */
  async getTeamChatWithMembers(
    userId: string
  ): Promise<TeamChatWithMembers | null> {
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      return null;
    }

    const agents = await this.getTeamChatAgents(userId, teamChat.groupId);

    return { ...teamChat, agents };
  }

  /**
   * Get all agents in the user's team chat
   *
   * @param userId - The human user ID
   * @param groupId - Optional group ID if already known (avoids extra query)
   * @returns Array of agent User objects
   */
  async getTeamChatAgents(userId: string, groupId?: string): Promise<User[]> {
    const gid = groupId ?? (await this.getTeamChat(userId))?.groupId;
    if (!gid) {
      return [];
    }

    return selectTeamChatAgentUsersForOwner(db, gid, userId);
  }

  /**
   * Add an agent to the user's team chat
   *
   * @param userId - The human user ID (owner)
   * @param agentUserId - The agent user ID to add
   */
  async addAgentToTeamChat(userId: string, agentUserId: string): Promise<void> {
    // Ensure team chat exists
    const teamChat = await this.ensureTeamChat(userId);

    const agent = await selectUserRowById(db, agentUserId);

    if (!agent) {
      throw new Error(`Agent not found: ${agentUserId}`);
    }

    if (!agent.isAgent) {
      throw new Error(`User ${agentUserId} is not an agent`);
    }

    if (agent.managedBy !== userId) {
      throw new Error(`Agent ${agentUserId} is not managed by user ${userId}`);
    }

    await withTransaction(async (tx) => {
      const now = new Date();
      const [memberId, participantId] = await Promise.all([
        generateSnowflakeId(),
        generateSnowflakeId(),
      ]);

      await upsertGroupMemberAsTeamAgent(tx, {
        id: memberId,
        groupId: teamChat.groupId,
        agentUserId,
        ownerUserId: userId,
        joinedAt: now,
      });

      await upsertChatParticipantActive(tx, {
        id: participantId,
        chatId: teamChat.chatId,
        userId: agentUserId,
        joinedAt: now,
      });

      await updateGroupUpdatedAt(tx, teamChat.groupId, now);
    });

    logger.info(
      `Agent ${agentUserId} added to team chat`,
      { userId, chatId: teamChat.chatId },
      'TeamChatService'
    );
  }

  /**
   * Remove an agent from the user's team chat
   *
   * @param userId - The human user ID (owner)
   * @param agentUserId - The agent user ID to remove
   */
  async removeAgentFromTeamChat(
    userId: string,
    agentUserId: string
  ): Promise<void> {
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      // No team chat exists, nothing to remove from
      return;
    }

    const agent = await selectUserRowById(db, agentUserId);

    // Ownership validation (defense in depth - caller should validate too)
    if (agent && agent.isAgent && agent.managedBy !== userId) {
      logger.warn(
        `Attempted to remove agent not owned by user`,
        { userId, agentUserId, actualOwner: agent.managedBy },
        'TeamChatService'
      );
      return;
    }

    const agentName = agent?.displayName || agent?.username || 'Agent';

    await withTransaction(async (tx) => {
      const now = new Date();
      const messageId = await generateSnowflakeId();

      await deactivateGroupMemberInTeam(tx, {
        groupId: teamChat.groupId,
        userId: agentUserId,
        kickedAt: now,
        kickReason: 'Agent deleted',
      });

      await deactivateChatParticipantInChat(tx, teamChat.chatId, agentUserId);

      await insertTeamChatSystemMessage(tx, {
        id: messageId,
        chatId: teamChat.chatId,
        content: `🤖 ${agentName} left the team`,
        createdAt: now,
      });

      await updateGroupUpdatedAt(tx, teamChat.groupId, now);
    });

    logger.info(
      `Agent ${agentUserId} removed from team chat`,
      { userId, chatId: teamChat.chatId },
      'TeamChatService'
    );
  }

  /**
   * Sync all existing agents to the team chat.
   *
   * This is useful for adding agents that were created before the team chat
   * feature was implemented, or if agents somehow got out of sync.
   *
   * @param userId - The human user ID
   * @returns Number of agents that were added
   */
  async syncExistingAgents(userId: string): Promise<number> {
    // Ensure team chat exists
    const teamChat = await this.ensureTeamChat(userId);

    const allUserAgents = await selectAgentUserIdsManagedBy(db, userId);

    if (allUserAgents.length === 0) {
      return 0;
    }

    const existingMembers = await selectActiveGroupMemberUserIds(
      db,
      teamChat.groupId
    );

    const existingMemberIds = new Set(existingMembers.map((m) => m.userId));

    // Find agents that need to be added
    const agentsToAdd = allUserAgents.filter(
      (agent) => !existingMemberIds.has(agent.id)
    );

    if (agentsToAdd.length === 0) {
      return 0;
    }

    // Batch add missing agents (silently, without system messages to avoid spam)
    await this.batchAddAgentsToTeamChatSilent(
      userId,
      agentsToAdd.map((a) => a.id),
      teamChat
    );

    logger.info(
      `Synced ${agentsToAdd.length} existing agent(s) to team chat`,
      { userId, agentIds: agentsToAdd.map((a) => a.id) },
      'TeamChatService'
    );

    return agentsToAdd.length;
  }

  /**
   * Batch add agents to team chat without system messages (for sync operations).
   * More efficient than calling addAgentToTeamChatSilent in a loop.
   * Wrapped in transaction to ensure atomicity.
   */
  private async batchAddAgentsToTeamChatSilent(
    userId: string,
    agentUserIds: string[],
    teamChat: TeamChatInfo
  ): Promise<void> {
    if (agentUserIds.length === 0) return;

    await withTransaction(async (tx) => {
      const now = new Date();

      const memberIds = await Promise.all(
        agentUserIds.map(() => generateSnowflakeId())
      );
      const participantIds = await Promise.all(
        agentUserIds.map(() => generateSnowflakeId())
      );

      await batchUpsertGroupMembersAsTeamAgents(tx, {
        ownerUserId: userId,
        joinedAt: now,
        rows: agentUserIds.map((agentUserId, i) => ({
          id: memberIds[i] as string,
          groupId: teamChat.groupId,
          userId: agentUserId,
        })),
      });

      await batchUpsertChatParticipantsActive(tx, {
        joinedAt: now,
        rows: agentUserIds.map((agentUserId, i) => ({
          id: participantIds[i] as string,
          chatId: teamChat.chatId,
          userId: agentUserId,
        })),
      });
    });
  }

  // ===========================================================================
  // CONVERSATION MANAGEMENT (Fresh Chat Feature)
  // ===========================================================================

  /**
   * List all conversations (Chats) for a user's team chat.
   * Returns chats ordered by most recently updated first.
   *
   * @param userId - The human user ID
   * @returns Array of Chat records for this team
   */
  async listConversations(userId: string): Promise<Chat[]> {
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      return [];
    }

    return selectChatsForGroupOrderByUpdatedDesc(db, teamChat.groupId);
  }

  /**
   * Create a new conversation (Chat) within the user's team chat.
   * This is the "New Chat" feature - starts fresh context for agents.
   *
   * @param userId - The human user ID
   * @param title - Optional title for the conversation
   * @returns The newly created Chat and updated TeamChatInfo
   */
  async createConversation(
    userId: string,
    title?: string
  ): Promise<{ chat: Chat; teamChat: TeamChatInfo }> {
    const teamChat = await this.ensureTeamChat(userId);

    const result = await withTransaction(async (tx) => {
      const now = new Date();
      const [chatId, participantId] = await Promise.all([
        generateSnowflakeId(),
        generateSnowflakeId(),
      ]);

      const chatTitle = title || null;

      const newChat = await insertChatReturningRow(tx, {
        id: chatId,
        name: chatTitle,
        description: null,
        isGroup: true,
        groupId: teamChat.groupId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });

      await insertChatParticipantRow(tx, {
        id: participantId,
        chatId,
        userId,
        joinedAt: now,
        isActive: true,
      });

      const agents = await selectTeamChatAgentUsersForOwner(
        tx,
        teamChat.groupId,
        userId
      );
      if (agents.length > 0) {
        const agentParticipantIds = await Promise.all(
          agents.map(() => generateSnowflakeId())
        );
        const agentParticipantValues = agents.map((agent, i) => ({
          id: agentParticipantIds[i] as string,
          chatId,
          userId: agent.id,
          joinedAt: now,
          isActive: true,
        }));
        await insertChatParticipantsOnConflictDoNothing(
          tx,
          agentParticipantValues
        );
      }

      await updateGroupActiveChatId(tx, teamChat.groupId, chatId, now);

      return newChat;
    });

    if (!result) {
      throw new Error('Failed to create conversation');
    }

    logger.info(
      `New conversation created for user ${userId}`,
      { chatId: result.id, title: result.name },
      'TeamChatService'
    );

    // Return updated team chat info
    const updatedTeamChat = await this.getTeamChat(userId);
    return { chat: result, teamChat: updatedTeamChat! };
  }

  /**
   * Switch to a different conversation within the user's team chat.
   *
   * @param userId - The human user ID
   * @param chatId - The chat ID to switch to
   * @returns Updated TeamChatInfo
   */
  async switchConversation(
    userId: string,
    chatId: string
  ): Promise<TeamChatInfo> {
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      throw new Error('Team chat not found');
    }

    const chat = await selectChatRowByIdAndGroupId(
      db,
      chatId,
      teamChat.groupId
    );

    if (!chat) {
      throw new Error('Conversation not found or does not belong to this team');
    }

    const now = new Date();
    await updateGroupActiveChatId(db, teamChat.groupId, chatId, now);

    logger.info(
      `Switched conversation for user ${userId}`,
      { chatId, previousChatId: teamChat.chatId },
      'TeamChatService'
    );

    return { ...teamChat, chatId, updatedAt: now };
  }

  /**
   * Rename a conversation.
   *
   * @param userId - The human user ID
   * @param chatId - The chat ID to rename
   * @param newTitle - The new title
   */
  async renameConversation(
    userId: string,
    chatId: string,
    newTitle: string
  ): Promise<void> {
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      throw new Error('Team chat not found');
    }

    const chat = await selectChatRowByIdAndGroupId(
      db,
      chatId,
      teamChat.groupId
    );

    if (!chat) {
      throw new Error('Conversation not found or does not belong to this team');
    }

    await updateChatNameById(db, chatId, newTitle, new Date());

    logger.info(
      `Renamed conversation ${chatId}`,
      { newTitle },
      'TeamChatService'
    );
  }

  /**
   * Check if a chat needs a title to be generated.
   * Returns true if name is null (indicating auto-generation needed).
   * Validates ownership before returning the result.
   *
   * @param chatId - The chat ID to check
   * @param userId - The user ID to validate ownership
   * @returns Whether the chat needs a title, or false if user doesn't own the chat
   */
  async chatNeedsTitle(chatId: string, userId: string): Promise<boolean> {
    // Validate ownership first
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      logger.warn(
        `chatNeedsTitle: User does not have a team chat`,
        { chatId, userId },
        'TeamChatService'
      );
      return false;
    }

    const chat = await selectChatNameByIdAndGroupId(
      db,
      chatId,
      teamChat.groupId
    );

    if (!chat) {
      logger.warn(
        `chatNeedsTitle: Chat not found or not owned by user`,
        { chatId, userId },
        'TeamChatService'
      );
      return false;
    }

    return chat.name === null;
  }

  /**
   * Update a chat's title (used for LLM-generated titles).
   * Validates ownership before updating.
   *
   * @param chatId - The chat ID to update
   * @param title - The new title
   * @param userId - The user ID to validate ownership
   */
  async updateChatTitle(
    chatId: string,
    title: string,
    userId: string
  ): Promise<void> {
    // Validate ownership using team chat
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      throw new Error('Team chat not found for user');
    }

    const chat = await selectChatRowByIdAndGroupId(
      db,
      chatId,
      teamChat.groupId
    );

    if (!chat) {
      throw new Error('Chat not found or does not belong to this team');
    }

    await updateChatNameById(db, chatId, title, new Date());

    logger.info(
      `Updated chat title via LLM generation`,
      { chatId, title, userId },
      'TeamChatService'
    );
  }

  /**
   * Atomically update a chat's title only if it's currently null.
   * This prevents race conditions where multiple first messages try to set the title.
   * Validates ownership before updating.
   *
   * @param chatId - The chat ID to update
   * @param title - The new title
   * @param userId - The user ID to validate ownership
   * @returns true if title was updated, false if it was already set or unauthorized
   */
  async updateChatTitleIfNull(
    chatId: string,
    title: string,
    userId: string
  ): Promise<boolean> {
    // Validate ownership using team chat
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      logger.warn(
        `Cannot update chat title: team chat not found for user`,
        { chatId, userId },
        'TeamChatService'
      );
      return false;
    }

    const updatedAt = new Date();
    const result = await updateChatNameIfNullForGroupReturningIds(db, {
      chatId,
      groupId: teamChat.groupId,
      name: title,
      updatedAt,
    });

    const updated = result.length > 0;

    if (updated) {
      logger.info(
        `Atomically set chat title via LLM generation`,
        { chatId, title, userId },
        'TeamChatService'
      );
    }

    return updated;
  }

  /**
   * Get the count of user messages in a chat.
   * Used to determine if this is the first message (for title generation).
   * Validates chat ownership before returning the count.
   *
   * @param chatId - The chat ID
   * @param userId - The user ID to validate ownership (optional for backwards compat, will be required)
   * @returns Number of user messages
   * @throws Error if userId is provided and doesn't own the chat
   */
  async getUserMessageCount(chatId: string, userId?: string): Promise<number> {
    // If userId is provided, validate ownership
    if (userId) {
      const isOwner = await this.validateTeamChatOwnership(userId, chatId);
      if (!isOwner) {
        throw new Error('Unauthorized: User does not own this chat');
      }
    }

    return countUserMessagesInChat(db, chatId);
  }

  /**
   * Delete a conversation (and all its messages).
   * Cannot delete if it's the only conversation.
   *
   * @param userId - The human user ID
   * @param chatId - The chat ID to delete
   * @returns The new active chatId if the deleted was active, null otherwise
   */
  async deleteConversation(
    userId: string,
    chatId: string
  ): Promise<string | null> {
    const teamChat = await this.getTeamChat(userId);
    if (!teamChat) {
      throw new Error('Team chat not found');
    }

    // Verify the chat belongs to this team's group
    const conversations = await this.listConversations(userId);
    const chatToDelete = conversations.find((c) => c.id === chatId);

    if (!chatToDelete) {
      throw new Error('Conversation not found or does not belong to this team');
    }

    // Cannot delete if it's the only conversation
    if (conversations.length <= 1) {
      throw new Error('Cannot delete the only conversation');
    }

    const wasActive = teamChat.chatId === chatId;
    let newActiveChatId: string | null = null;

    await withTransaction(async (tx) => {
      await deleteMessagesByChatId(tx, chatId);

      await deleteChatParticipantsByChatId(tx, chatId);

      await deleteChatById(tx, chatId);

      if (wasActive) {
        const fallbackId = await selectNewestChatIdInGroupExcluding(
          tx,
          teamChat.groupId,
          chatId
        );

        if (fallbackId) {
          newActiveChatId = fallbackId;
          await updateGroupActiveChatId(
            tx,
            teamChat.groupId,
            fallbackId,
            new Date()
          );
        }
      }
    });

    logger.info(
      `Deleted conversation ${chatId}`,
      { wasActive, newActiveChatId },
      'TeamChatService'
    );

    return wasActive ? newActiveChatId : null;
  }
}

/** Singleton instance */
export const teamChatService = new TeamChatService();
