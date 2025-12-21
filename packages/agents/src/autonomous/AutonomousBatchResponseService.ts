/**
 * Autonomous Batch Response Service
 *
 * Handles batch evaluation and response to pending interactions:
 * - Comments to agent's posts
 * - Replies to agent's comments
 * - New messages in chats
 *
 * Instead of responding to everything, this service:
 * 1. Gathers all pending interactions
 * 2. Presents them to the agent with context
 * 3. Agent decides which ones warrant a response (boolean array)
 * 4. Executes responses for approved interactions
 */

import { countTokensSync, truncateToTokenLimitSync } from '@babylon/api';
import { db } from '@babylon/db';
import type { IAgentRuntime } from '@elizaos/core';
import { callJejuDirect } from '../llm';
import { getAgentConfig } from '../shared/agent-config';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';

interface PendingInteraction {
  type: 'comment_on_post' | 'comment_on_comment' | 'chat_message';
  id: string;
  chatId?: string;
  postId?: string;
  commentId?: string;
  parentCommentId?: string;
  author: string;
  content: string;
  context: string;
  timestamp: Date;
}

interface ResponseDecision {
  shouldRespond: boolean;
  priority?: 'low' | 'medium' | 'high';
  reasoning?: string;
}

export class AutonomousBatchResponseService {
  /**
   * Gather all pending interactions that might need responses
   */
  async gatherPendingInteractions(
    agentUserId: string
  ): Promise<PendingInteraction[]> {
    const interactions: PendingInteraction[] = [];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // First get agent's posts
    const agentPosts = await db.post.findMany({
      where: { authorId: agentUserId, deletedAt: null },
      select: { id: true },
    });
    const agentPostIds = agentPosts.map((p) => String(p.id));

    if (agentPostIds.length > 0) {
      // Get comments on agent's posts
      const commentsOnPosts = await db.comment.findMany({
        where: {
          authorId: { not: agentUserId },
          createdAt: { gte: oneDayAgo },
          postId: { in: agentPostIds },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Get post content for context
      const postContents = await db.post.findMany({
        where: { id: { in: agentPostIds } },
        select: { id: true, content: true },
      });
      const postContentMap = new Map(
        postContents.map((p) => [String(p.id), String(p.content)])
      );

      // Get author info
      const authorIds = [
        ...new Set(commentsOnPosts.map((c) => String(c.authorId))),
      ];
      const authors = await db.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, username: true, displayName: true },
      });
      const authorMap = new Map(authors.map((a) => [String(a.id), a]));

      for (const comment of commentsOnPosts) {
        const postContent = postContentMap.get(String(comment.postId)) || '';
        const author = authorMap.get(String(comment.authorId));
        const createdAt =
          comment.createdAt instanceof Date
            ? comment.createdAt
            : new Date(String(comment.createdAt));

        interactions.push({
          type: 'comment_on_post',
          id: String(comment.id),
          postId: String(comment.postId),
          author:
            (author?.displayName ? String(author.displayName) : null) ||
            (author?.username ? String(author.username) : null) ||
            'Unknown',
          content: String(comment.content),
          context: `Your post: "${postContent}"`,
          timestamp: createdAt,
        });
      }
    }

    // Get replies to agent's comments
    const myComments = await db.comment.findMany({
      where: { authorId: agentUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true },
    });
    const myCommentIds = myComments.map((c) => String(c.id));

    if (myCommentIds.length > 0) {
      const repliesToComments = await db.comment.findMany({
        where: {
          parentCommentId: { in: myCommentIds },
          authorId: { not: agentUserId },
          createdAt: { gte: oneDayAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Get parent comment content
      const parentCommentIds = [
        ...new Set(
          repliesToComments
            .map((r) => String(r.parentCommentId))
            .filter((id) => id && id !== 'null')
        ),
      ];
      const parentComments = await db.comment.findMany({
        where: { id: { in: parentCommentIds } },
        select: { id: true, content: true },
      });
      const parentCommentMap = new Map(
        parentComments.map((pc) => [String(pc.id), String(pc.content)])
      );

      // Get author info
      const replyAuthorIds = [
        ...new Set(repliesToComments.map((r) => String(r.authorId))),
      ];
      const replyAuthors = await db.user.findMany({
        where: { id: { in: replyAuthorIds } },
        select: { id: true, username: true, displayName: true },
      });
      const replyAuthorMap = new Map(
        replyAuthors.map((a) => [String(a.id), a])
      );

      for (const reply of repliesToComments) {
        const author = replyAuthorMap.get(String(reply.authorId));
        const parentContent =
          parentCommentMap.get(String(reply.parentCommentId)) || '';
        const createdAt =
          reply.createdAt instanceof Date
            ? reply.createdAt
            : new Date(String(reply.createdAt));

        interactions.push({
          type: 'comment_on_comment',
          id: String(reply.id),
          commentId: String(reply.id),
          parentCommentId: reply.parentCommentId
            ? String(reply.parentCommentId)
            : undefined,
          author:
            (author?.displayName ? String(author.displayName) : null) ||
            (author?.username ? String(author.username) : null) ||
            'Unknown',
          content: String(reply.content),
          context: `Your comment: "${parentContent}"`,
          timestamp: createdAt,
        });
      }
    }

    // Get unread chat messages
    const agentChats = await db.chatParticipant.findMany({
      where: { userId: agentUserId },
      select: { chatId: true },
    });

    for (const chatParticipant of agentChats) {
      const chat = await db.chat.findUnique({
        where: { id: String(chatParticipant.chatId) },
      });
      if (!chat) continue;

      // Get recent messages from others in this chat
      const chatMessages = await db.message.findMany({
        where: {
          chatId: String(chat.id),
          senderId: { not: agentUserId },
          createdAt: { gte: oneDayAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      if (chatMessages.length === 0) continue;

      // Get recent conversation context
      const recentMessages = await db.message.findMany({
        where: { chatId: String(chat.id) },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const contextMessages = recentMessages
        .reverse()
        .map(
          (m) =>
            `${String(m.senderId) === agentUserId ? 'You' : 'User'}: ${String(m.content)}`
        )
        .join('\n');

      const latestMessage = chatMessages[0];
      if (latestMessage) {
        const createdAt =
          latestMessage.createdAt instanceof Date
            ? latestMessage.createdAt
            : new Date(String(latestMessage.createdAt));
        const chatName = chat.name ? String(chat.name) : '';

        interactions.push({
          type: 'chat_message',
          id: String(latestMessage.id),
          chatId: String(chat.id),
          author: 'User',
          content: String(latestMessage.content),
          context: `Chat: ${chatName || (chat.isGroup ? 'Group' : 'DM')}\nRecent:\n${contextMessages}`,
          timestamp: createdAt,
        });
      }
    }

    // Sort by timestamp (oldest first for fairness)
    interactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return interactions;
  }

  /**
   * Evaluate which interactions warrant a response using AI
   */
  async evaluateInteractions(
    agentUserId: string,
    _runtime: IAgentRuntime,
    interactions: PendingInteraction[]
  ): Promise<ResponseDecision[]> {
    if (interactions.length === 0) {
      return [];
    }

    // Cap interactions to prevent context overflow (30 max)
    const cappedInteractions = interactions.slice(0, 30);
    if (cappedInteractions.length < interactions.length) {
      logger.info(
        `Capped interactions from ${interactions.length} to 30 to prevent context overflow`,
        undefined,
        'AutonomousBatchResponse'
      );
    }
    const evaluateInteractions = cappedInteractions;

    const agent = await db.user.findUnique({
      where: { id: agentUserId },
      select: { displayName: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const config = await getAgentConfig(agentUserId);
    const displayName = agent.displayName ? String(agent.displayName) : 'Agent';

    // Build evaluation prompt
    const prompt = `${config?.systemPrompt ?? 'You are an AI agent on Babylon.'}

You are ${displayName}, an AI agent on Babylon. You need to decide which interactions warrant a response.

Guidelines:
- Respond to direct questions or mentions
- Respond to substantive comments that add value
- Skip spam, simple acknowledgments, or low-value interactions
- Consider your energy and focus - be selective
- Prioritize meaningful conversations

Pending Interactions (${evaluateInteractions.length}):

${evaluateInteractions
  .map(
    (interaction, idx) => `
[${idx}] Type: ${interaction.type}
Author: ${interaction.author}
Content: "${interaction.content}"
Context: ${interaction.context}
Time: ${new Date(interaction.timestamp).toLocaleString()}
---`
  )
  .join('\n')}

Task: For each interaction above, decide if you should respond.

Output ONLY a JSON array of booleans, one per interaction in order.
Example: [true, false, true, false, false, true, ...]

Array:`;

    // Ensure prompt fits within 32K context limit
    const estimatedTokens = countTokensSync(prompt);
    let finalPrompt = prompt;

    if (estimatedTokens > 30000) {
      logger.warn(
        `Evaluation prompt too long: ${estimatedTokens} tokens, truncating`,
        undefined,
        'AutonomousBatchResponse'
      );
      const truncated = truncateToTokenLimitSync(prompt, 30000, {
        ellipsis: true,
      });
      finalPrompt = truncated.text;
      logger.info(
        `Truncated to ${truncated.tokens} tokens`,
        undefined,
        'AutonomousBatchResponse'
      );
    }

    // Use large model for batch evaluation
    const decisionText = await Promise.race([
      callJejuDirect({
        prompt: finalPrompt,
        system: config?.systemPrompt ?? undefined,
        modelSize: 'large',
        runtime: _runtime,
        temperature: 0.6,
        maxTokens: 16384,
        actionType: 'evaluate_interactions',
        purpose: 'evaluation',
      }),
      new Promise<string>((resolve) => {
        setTimeout(() => {
          logger.warn(
            `Interaction evaluation timeout for agent ${agentUserId}, defaulting to no responses`,
            undefined,
            'AutonomousBatchResponse'
          );
          resolve('[]');
        }, 30000);
      }),
    ]);

    // Parse the boolean array
    const jsonMatch = decisionText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      throw new Error(
        `Failed to parse decision array from LLM response: ${decisionText.substring(0, 200)}`
      );
    }

    const decisionsRaw = JSON.parse(jsonMatch[0]) as boolean[];

    // Ensure we have the right number of decisions
    let decisions = decisionsRaw;
    if (decisionsRaw.length !== evaluateInteractions.length) {
      logger.warn(
        `Decision count mismatch: ${decisionsRaw.length} vs ${evaluateInteractions.length}. Adjusting to match.`,
        undefined,
        'AutonomousBatchResponse'
      );

      if (decisionsRaw.length < evaluateInteractions.length) {
        const paddingNeeded = evaluateInteractions.length - decisionsRaw.length;
        decisions = [...decisionsRaw, ...Array(paddingNeeded).fill(false)];
        logger.info(
          `Padded ${paddingNeeded} missing decisions with false`,
          undefined,
          'AutonomousBatchResponse'
        );
      } else {
        const excessCount = decisionsRaw.length - evaluateInteractions.length;
        decisions = decisionsRaw.slice(0, evaluateInteractions.length);
        logger.info(
          `Truncated ${excessCount} excess decisions`,
          undefined,
          'AutonomousBatchResponse'
        );
      }
    }

    return decisions.map((shouldRespond) => ({ shouldRespond }));
  }

  /**
   * Generate and post responses for approved interactions
   */
  async executeResponses(
    agentUserId: string,
    _runtime: IAgentRuntime,
    interactions: PendingInteraction[],
    decisions: ResponseDecision[]
  ): Promise<number> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
      select: { displayName: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const respConfig = await getAgentConfig(agentUserId);
    const displayName = agent.displayName ? String(agent.displayName) : 'Agent';

    let responsesCreated = 0;

    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i];
      const decision = decisions[i];

      if (!interaction || !decision || !decision.shouldRespond) continue;

      // Generate response
      const responsePrompt = `${respConfig?.systemPrompt ?? 'You are an AI agent on Babylon.'}

You are ${displayName}, responding to an interaction.

Context: ${interaction.context}

${interaction.author} said: "${interaction.content}"

Task: Write a thoughtful, engaging response (1-2 sentences, under 200 characters).
Be authentic to your personality.
Add value to the conversation.

Generate ONLY the response text, nothing else.`;

      // Truncate if needed
      const respTokens = countTokensSync(responsePrompt);
      let finalRespPrompt = responsePrompt;
      if (respTokens > 30000) {
        const truncated = truncateToTokenLimitSync(responsePrompt, 30000, {
          ellipsis: true,
        });
        finalRespPrompt = truncated.text;
      }

      // Use large model for response generation
      const responseContent = await Promise.race([
        callJejuDirect({
          prompt: finalRespPrompt,
          system: respConfig?.systemPrompt ?? undefined,
          modelSize: 'large',
          runtime: _runtime,
          temperature: 0.8,
          maxTokens: 16384,
          actionType: 'execute_response',
          purpose: 'response',
        }),
        new Promise<string>((resolve) => {
          setTimeout(() => {
            logger.warn(
              `Response generation timeout for interaction ${interaction.id}, skipping`,
              undefined,
              'AutonomousBatchResponse'
            );
            resolve('');
          }, 20000);
        }),
      ]);

      const cleanContent = responseContent.trim().replace(/^["']|["']$/g, '');

      if (!cleanContent || cleanContent.length < 5) {
        logger.warn(
          `Generated response too short for interaction ${interaction.id}`,
          undefined,
          'AutonomousBatchResponse'
        );
        continue;
      }

      // Post the response based on type
      if (interaction.type === 'comment_on_post' && interaction.postId) {
        await db.comment.create({
          data: {
            id: await generateSnowflakeId(),
            content: cleanContent,
            postId: interaction.postId,
            authorId: agentUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        responsesCreated++;
        logger.info(
          `Agent responded to comment on post ${interaction.postId}`,
          undefined,
          'AutonomousBatchResponse'
        );
      } else if (
        interaction.type === 'comment_on_comment' &&
        interaction.commentId
      ) {
        const parentComment = await db.comment.findUnique({
          where: { id: interaction.commentId },
          select: { postId: true },
        });

        if (parentComment) {
          await db.comment.create({
            data: {
              id: await generateSnowflakeId(),
              content: cleanContent,
              postId: String(parentComment.postId),
              authorId: agentUserId,
              parentCommentId: interaction.commentId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          responsesCreated++;
          logger.info(
            `Agent responded to comment reply ${interaction.commentId}`,
            undefined,
            'AutonomousBatchResponse'
          );
        }
      } else if (interaction.type === 'chat_message' && interaction.chatId) {
        await db.message.create({
          data: {
            id: await generateSnowflakeId(),
            chatId: interaction.chatId,
            senderId: agentUserId,
            content: cleanContent,
            createdAt: new Date(),
          },
        });
        responsesCreated++;
        logger.info(
          `Agent responded in chat ${interaction.chatId}`,
          undefined,
          'AutonomousBatchResponse'
        );
      }

      // Small delay to avoid spam
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return responsesCreated;
  }

  /**
   * Main entry point: Process all pending interactions in batch
   */
  async processBatch(
    agentUserId: string,
    _runtime: IAgentRuntime
  ): Promise<number> {
    logger.info(
      `Starting batch response processing for agent ${agentUserId}`,
      undefined,
      'AutonomousBatchResponse'
    );

    // Step 1: Gather all pending interactions
    const interactions = await this.gatherPendingInteractions(agentUserId);

    if (interactions.length === 0) {
      logger.info(
        'No pending interactions to process',
        undefined,
        'AutonomousBatchResponse'
      );
      return 0;
    }

    logger.info(
      `Found ${interactions.length} pending interactions`,
      undefined,
      'AutonomousBatchResponse'
    );

    // Step 2: Evaluate which ones warrant responses
    const decisions = await this.evaluateInteractions(
      agentUserId,
      _runtime,
      interactions
    );

    const responseCount = decisions.filter((d) => d.shouldRespond).length;
    logger.info(
      `Agent decided to respond to ${responseCount}/${interactions.length} interactions`,
      undefined,
      'AutonomousBatchResponse'
    );

    if (responseCount === 0) {
      return 0;
    }

    // Step 3: Generate and post responses
    const responsesCreated = await this.executeResponses(
      agentUserId,
      _runtime,
      interactions,
      decisions
    );

    logger.info(
      `Successfully created ${responsesCreated} responses`,
      undefined,
      'AutonomousBatchResponse'
    );

    return responsesCreated;
  }
}

export const autonomousBatchResponseService =
  new AutonomousBatchResponseService();
