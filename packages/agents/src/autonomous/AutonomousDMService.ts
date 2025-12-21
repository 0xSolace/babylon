/**
 * Autonomous DM Service
 *
 * Handles agents responding to direct messages autonomously
 */

import { db } from '@babylon/db';
import type { IAgentRuntime } from '@elizaos/core';
import { callJejuDirect } from '../llm';
import { getAgentConfig } from '../shared/agent-config';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';

/**
 * Service for autonomous direct message responses
 */
export class AutonomousDMService {
  /**
   * Checks for unread DMs and generates responses
   */
  async respondToDMs(
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

    // Get agent's DM chats (non-group chats)
    const chatParticipants = await db.chatParticipant.findMany({
      where: { userId: agentUserId },
    });

    let responsesCreated = 0;

    for (const chatParticipant of chatParticipants) {
      const chat = await db.chat.findUnique({
        where: { id: String(chatParticipant.chatId) },
      });

      if (!chat || chat.isGroup) continue; // Skip group chats

      // Get recent messages in this chat
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const unreadMessages = await db.message.findMany({
        where: {
          chatId: String(chat.id),
          senderId: { not: agentUserId },
          createdAt: { gte: oneHourAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      if (unreadMessages.length === 0) continue;

      // Get conversation context
      const allMessages = await db.message.findMany({
        where: { chatId: String(chat.id) },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      const latestMessage = unreadMessages[0];
      if (!latestMessage) continue;

      // Generate response
      const prompt = `${config?.systemPrompt ?? 'You are an AI agent on Babylon.'}

You are ${displayName} in a direct message conversation.

Recent conversation:
${allMessages
  .slice(-5)
  .map(
    (m) =>
      `${String(m.senderId) === agentUserId ? 'You' : 'Them'}: ${String(m.content)}`
  )
  .join('\n')}

Latest message from them:
"${String(latestMessage.content)}"

Task: Generate a helpful, friendly response (1-2 sentences).
Be authentic to your personality.
Keep it under 200 characters.

Generate ONLY the response text, nothing else.`;

      // Use small model (llama-3.1-8b-instant) for fast DM responses
      const responseContent = await callJejuDirect({
        prompt,
        system: config?.systemPrompt ?? undefined,
        modelSize: 'small',
        runtime: _runtime,
        temperature: 0.8,
        maxTokens: 80,
        actionType: 'generate_dm_response',
        purpose: 'response',
      });

      const cleanContent = responseContent.trim().replace(/^["']|["']$/g, '');

      if (!cleanContent || cleanContent.length < 5) {
        continue;
      }

      // Create response message
      await db.message.create({
        data: {
          id: await generateSnowflakeId(),
          chatId: String(chat.id),
          senderId: agentUserId,
          content: cleanContent,
          createdAt: new Date(),
        },
      });

      responsesCreated++;
      logger.info(
        `Agent ${displayName} responded to DM in chat ${chat.id}`,
        undefined,
        'AutonomousDM'
      );

      // Only respond to one DM per tick to avoid spam
      break;
    }

    return responsesCreated;
  }
}

export const autonomousDMService = new AutonomousDMService();
