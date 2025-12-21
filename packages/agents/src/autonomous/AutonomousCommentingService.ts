/**
 * Autonomous Commenting Service
 *
 * Handles agents commenting on posts autonomously
 */

import { db } from '@babylon/db';
import type { IAgentRuntime } from '@elizaos/core';
import { callJejuDirect } from '../llm';
import { getAgentConfig } from '../shared/agent-config';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';

export class AutonomousCommentingService {
  /**
   * Find relevant posts and create comments
   */
  async createAgentComment(
    agentUserId: string,
    _runtime: IAgentRuntime
  ): Promise<string | null> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    });

    if (!agent?.isAgent) {
      throw new Error('Agent not found');
    }

    const now = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get posts agent already commented on
    const agentComments = await db.comment.findMany({
      where: { authorId: agentUserId },
      select: { postId: true },
    });

    const commentedPostIds = agentComments
      .map((c) => String(c.postId))
      .filter((id) => id !== 'null' && id !== 'undefined');

    // Get recent posts that agent hasn't commented on
    const recentPosts = await db.post.findMany({
      where: {
        authorId: { not: agentUserId },
        deletedAt: null,
        timestamp: { gte: oneDayAgo, lte: now },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Filter to posts agent hasn't commented on
    const uncommentedPosts = recentPosts.filter(
      (p) => !commentedPostIds.includes(String(p.id))
    );

    if (uncommentedPosts.length === 0) {
      return null; // Nothing to comment on
    }

    // Pick the first relevant post
    const post = uncommentedPosts[0];

    if (!post) {
      return null;
    }

    const config = await getAgentConfig(agentUserId);
    const displayName = agent.displayName ? String(agent.displayName) : 'Agent';
    const postContent = post.content ? String(post.content) : '';

    // Generate comment
    const prompt = `${config?.systemPrompt ?? 'You are an AI agent on Babylon.'}

You are ${displayName}, viewing this post:

"${postContent}"

Task: Write a brief, insightful comment (1-2 sentences) that adds value to the discussion.
Be authentic to your personality and expertise.
Keep it under 200 characters.

Generate ONLY the comment text, nothing else.`;

    // Use small model (llama-3.1-8b-instant) for fast comment generation
    const commentContent = await callJejuDirect({
      prompt,
      system: config?.systemPrompt ?? undefined,
      modelSize: 'small',
      runtime: _runtime,
      temperature: 0.8,
      maxTokens: 80,
      actionType: 'generate_comment',
      purpose: 'response',
    });

    const cleanContent = commentContent.trim().replace(/^["']|["']$/g, '');

    if (!cleanContent || cleanContent.length < 5) {
      return null;
    }

    // Create the comment
    const commentId = await generateSnowflakeId();
    await db.comment.create({
      data: {
        id: commentId,
        content: cleanContent,
        postId: String(post.id),
        authorId: agentUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info(
      `Agent ${displayName} commented on post ${post.id}`,
      undefined,
      'AutonomousCommenting'
    );

    return commentId;
  }
}

export const autonomousCommentingService = new AutonomousCommentingService();
