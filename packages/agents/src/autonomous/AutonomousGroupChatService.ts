/**
 * Autonomous Group Chat Service
 *
 * Handles agents participating in group chats autonomously
 *
 * @packageDocumentation
 */

import { db } from '@babylon/db';
import type { IAgentRuntime } from '@elizaos/core';
import { callJejuDirect } from '../llm';
import { getAgentConfig } from '../shared/agent-config';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';

/**
 * Service for autonomous group chat participation
 */
export class AutonomousGroupChatService {
  /**
   * Participates in group chats the agent is a member of
   */
  async participateInGroupChats(
    agentUserId: string,
    _runtime: IAgentRuntime
  ): Promise<number> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    });

    if (!agent?.isAgent) {
      throw new Error('Agent not found');
    }

    const config = await getAgentConfig(agentUserId);
    const displayName = agent.displayName ? String(agent.displayName) : 'Agent';
    const username = agent.username ? String(agent.username) : 'agent';

    // Get agent's group chats
    const chatParticipants = await db.chatParticipant.findMany({
      where: { userId: agentUserId },
    });

    let messagesCreated = 0;

    for (const chatParticipant of chatParticipants) {
      const chat = await db.chat.findUnique({
        where: { id: String(chatParticipant.chatId) },
      });

      if (!chat || !chat.isGroup) continue; // Skip DMs

      // Get recent messages in this group
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentMessages = await db.message.findMany({
        where: {
          chatId: String(chat.id),
          createdAt: { gte: oneHourAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (recentMessages.length === 0) continue;

      // Check if agent was mentioned or should respond
      const agentMentioned = recentMessages.some((m) => {
        const content = String(m.content).toLowerCase();
        return (
          content.includes(username.toLowerCase()) ||
          content.includes(displayName.toLowerCase())
        );
      });

      // Don't spam - only respond if mentioned or if it's been a while
      const agentLastMessage = recentMessages.find(
        (m) => String(m.senderId) === agentUserId
      );
      if (!agentMentioned && agentLastMessage) {
        continue;
      }

      // Generate contextual response
      const prompt = `${config?.systemPrompt ?? 'You are an AI agent on Babylon.'}

You are ${displayName} in a group chat.

Recent conversation:
${recentMessages
  .reverse()
  .map(
    (m) =>
      `${String(m.senderId) === agentUserId ? 'You' : 'User'}: ${String(m.content)}`
  )
  .join('\n')}

Task: Generate a helpful, engaging message (1-2 sentences) that contributes to the conversation.
Be authentic to your personality and expertise.
Keep it under 200 characters.
Only respond if you have something valuable to add.

Generate ONLY the message text, or "SKIP" if you shouldn't respond.`;

      // Use large model (qwen3-32b) for quality group chat content
      const responseContent = await callJejuDirect({
        prompt,
        system: config?.systemPrompt ?? undefined,
        modelSize: 'large',
        runtime: _runtime,
        temperature: 0.8,
        maxTokens: 80,
        actionType: 'generate_group_chat_response',
        purpose: 'response',
      });

      const cleanContent = responseContent.trim().replace(/^["']|["']$/g, '');

      if (!cleanContent || cleanContent.length < 5 || cleanContent === 'SKIP') {
        continue;
      }

      // Create group message
      await db.message.create({
        data: {
          id: await generateSnowflakeId(),
          chatId: String(chat.id),
          senderId: agentUserId,
          content: cleanContent,
          createdAt: new Date(),
        },
      });

      messagesCreated++;
      logger.info(
        `Agent ${displayName} participated in group chat ${chat.id}`,
        undefined,
        'AutonomousGroupChat'
      );

      // Only respond to one group per tick to avoid spam
      break;
    }

    return messagesCreated;
  }
}

export const autonomousGroupChatService = new AutonomousGroupChatService();
