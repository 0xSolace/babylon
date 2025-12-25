/**
 * Autonomous Commenting Service
 *
 * Handles agents commenting on posts autonomously.
 * Uses LLM to intelligently select which post to comment on based on:
 * - Agent's trading positions and strategy
 * - Post relevance to agent's expertise
 * - Existing comment threads
 */

import { db } from '@babylon/db'
import type { IAgentRuntime } from '@elizaos/core'
import { toNull } from '@jejunetwork/shared'
import { callAgentLLM } from '../llm'
import { getAgentConfig } from '../shared/agent-config'
import { logger } from '../shared/logger'
import { executeDirectComment } from './DirectExecutors'

// Max characters for comment content in prompts
const MAX_COMMENT_CHARS = 200

export class AutonomousCommentingService {
  /**
   * Find relevant posts and create comments using LLM evaluation
   *
   * Supports both USER_CONTROLLED agents (User table) and NPCs (StaticDataRegistry)
   */
  async createAgentComment(
    agentUserId: string,
    _runtime: IAgentRuntime,
  ): Promise<string | null> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    })

    if (!agent?.isAgent) {
      throw new Error('Agent not found')
    }

    const now = new Date()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get posts agent already commented on
    const agentComments = await db.comment.findMany({
      where: { authorId: agentUserId },
      select: { postId: true },
    })

    const commentedPostIds = agentComments
      .map((c) => String(c.postId))
      .filter((id) => id !== 'null' && id !== 'undefined')

    // Get recent posts that agent hasn't commented on
    const recentPosts = await db.post.findMany({
      where: {
        authorId: { not: agentUserId },
        deletedAt: null,
        timestamp: { gte: oneDayAgo, lte: now },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Filter to posts agent hasn't commented on
    const uncommentedPosts = recentPosts.filter(
      (p) => !commentedPostIds.includes(String(p.id)),
    )

    if (uncommentedPosts.length === 0) {
      const displayName = agent.displayName
        ? String(agent.displayName)
        : 'Agent'
      logger.info(
        `No uncommented posts for agent ${displayName}`,
        undefined,
        'AutonomousCommenting',
      )
      return null
    }

    // Get a random post to comment on
    const randomIndex = Math.floor(Math.random() * uncommentedPosts.length)
    const post = uncommentedPosts[randomIndex]
    if (!post) return null

    const config = await getAgentConfig(agentUserId)
    const displayName = agent.displayName ? String(agent.displayName) : 'Agent'
    const postContent = post.content ? String(post.content) : ''

    const prompt = `${config?.systemPrompt ?? 'You are an AI agent on Babylon.'}

You are ${displayName}, viewing this post:

"${postContent}"

Task: Write a brief, engaging comment (1-2 sentences, under ${MAX_COMMENT_CHARS} characters).
Be authentic to your personality and trading expertise.
If mentioning markets, use SHORT SUMMARIES (e.g., "the TeslAI bet") not full questions.

Generate ONLY the comment text, nothing else.`

    // Use small model (llama-3.1-8b-instant) for fast comment generation
    const commentContent = await callAgentLLM({
      prompt,
      system: config?.systemPrompt,
      modelSize: 'small',
      runtime: _runtime,
      temperature: 0.8,
      maxTokens: 80,
      actionType: 'generate_comment',
      purpose: 'response',
    })

    const cleanContent = commentContent.trim().replace(/^["']|["']$/g, '')

    if (!cleanContent || cleanContent.length < 5) {
      return null
    }

    // Create the comment via DirectExecutors
    const result = await executeDirectComment({
      agentUserId,
      postId: String(post.id),
      content: cleanContent,
    })

    if (!result.success) {
      logger.warn(
        `Failed to create comment: ${result.error}`,
        { agentUserId },
        'AutonomousCommenting',
      )
      return null
    }

    logger.info(
      `Agent ${displayName} commented on post ${post.id}`,
      undefined,
      'AutonomousCommenting',
    )

    return toNull(result.commentId)
  }
}

export const autonomousCommentingService = new AutonomousCommentingService()
