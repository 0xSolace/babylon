/**
 * Autonomous Batch Response Service
 *
 * Handles batch evaluation and response to pending interactions:
 * - Comment replies (unified: comments on agent's posts + replies to agent's comments)
 * - New messages in chats
 *
 * Instead of responding to everything, this service:
 * 1. Gathers all pending interactions
 * 2. Presents them to the agent with context
 * 3. Agent decides which ones warrant a response (boolean array)
 * 4. Executes responses for approved interactions
 */

import { countTokensSync, truncateToTokenLimitSync } from '@babylon/api'
import { db } from '@babylon/db'
import type { IAgentRuntime } from '@elizaos/core'
import { callAgentLLM } from '../llm'
import { getAgentConfig } from '../shared/agent-config'
import { logger } from '../shared/logger'
import { executeDirectComment, executeDirectMessage } from './DirectExecutors'

// =============================================================================
// Types
// =============================================================================

interface ThreadMessage {
  authorName: string
  content: string
  isYou: boolean
  depth: number
}

interface PostInfo {
  id: string
  content: string
  authorName: string
  isYourPost: boolean
}

interface PendingInteraction {
  type: 'comment_on_post' | 'comment_on_comment' | 'chat_message'
  id: string
  // Comment reply fields
  postId?: string
  commentId?: string
  parentCommentId?: string
  targetCommentId?: string
  post?: PostInfo
  thread?: ThreadMessage[]
  // Chat message fields
  chatId?: string
  // Common fields
  author: string
  content: string
  context: string // Formatted context string for prompt
  timestamp: Date
}

interface ResponseDecision {
  shouldRespond: boolean
  priority?: 'low' | 'medium' | 'high'
  reasoning?: string
}

// =============================================================================
// Service
// =============================================================================

export class AutonomousBatchResponseService {
  // ===========================================================================
  // Helper: Format interactions grouped by post for evaluation prompt
  // ===========================================================================
  private formatInteractionsGroupedByPost(
    interactions: PendingInteraction[],
  ): string {
    // Group interactions by postId
    const byPost = new Map<string, PendingInteraction[]>()
    const chatMessages: PendingInteraction[] = []

    for (const interaction of interactions) {
      if (interaction.type === 'chat_message' || !interaction.postId) {
        chatMessages.push(interaction)
      } else {
        const postInteractions = byPost.get(interaction.postId) || []
        postInteractions.push(interaction)
        byPost.set(interaction.postId, postInteractions)
      }
    }

    const sections: string[] = []

    // Format each post group
    for (const [_postId, postInteractions] of byPost) {
      const firstInteraction = postInteractions[0]
      const post = firstInteraction?.post
      const postAuthor = post?.isYourPost
        ? 'You'
        : post?.authorName || 'Unknown'
      const postContent = post?.content || '[Post content unavailable]'

      // Count interactions per author on this post
      const authorCounts = new Map<string, number>()
      for (const i of postInteractions) {
        authorCounts.set(i.author, (authorCounts.get(i.author) || 0) + 1)
      }

      const interactionLines = postInteractions.map((interaction) => {
        const authorCount = authorCounts.get(interaction.author) || 1
        const authorNote =
          authorCount > 1 ? ` (${authorCount} interactions on this post)` : ''

        // Format thread without post info (since we're showing it at post level)
        const threadLines =
          interaction.thread?.map((msg, idx) => {
            const isLast = idx === (interaction.thread?.length || 0) - 1
            const replyIndicator = isLast ? ' [REPLY TO THIS]' : ''
            const depthLabel =
              idx === 0 ? 'Comment' : `Reply (depth ${msg.depth})`
            return `    - ${depthLabel} by @${msg.authorName}: "${msg.content}"${replyIndicator}`
          }) || []

        return `  [ID: ${interaction.id}] @${interaction.author}${authorNote}
  Time: ${new Date(interaction.timestamp).toLocaleString()}
  Thread:
${threadLines.join('\n')}`
      })

      sections.push(`═══════════════════════════════════════════════════════════════
POST by @${postAuthor}: "${postContent.substring(0, 200)}${postContent.length > 200 ? '...' : ''}"
═══════════════════════════════════════════════════════════════

${interactionLines.join('\n\n')}`)
    }

    // Format chat messages separately
    if (chatMessages.length > 0) {
      const chatLines = chatMessages.map(
        (interaction) => `  [ID: ${interaction.id}] @${interaction.author}
  Time: ${new Date(interaction.timestamp).toLocaleString()}
  Message: "${interaction.content}"`,
      )

      sections.push(`═══════════════════════════════════════════════════════════════
DIRECT MESSAGES
═══════════════════════════════════════════════════════════════

${chatLines.join('\n\n')}`)
    }

    return sections.join('\n\n')
  }

  // ===========================================================================
  // Gather all pending comment replies (UNIFIED)
  // ===========================================================================
  private async gatherPendingCommentReplies(
    agentUserId: string,
  ): Promise<PendingInteraction[]> {
    const interactions: PendingInteraction[] = []
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // First get agent's posts
    const agentPosts = await db.post.findMany({
      where: { authorId: agentUserId, deletedAt: null },
      select: { id: true },
    })
    const agentPostIds = agentPosts.map((p) => String(p.id))

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
      })

      // Get post content for context
      const postContents = await db.post.findMany({
        where: { id: { in: agentPostIds } },
        select: { id: true, content: true },
      })
      const postContentMap = new Map(
        postContents.map((p) => [String(p.id), String(p.content)]),
      )

      // Get author info
      const authorIds = [
        ...new Set(commentsOnPosts.map((c) => String(c.authorId))),
      ]
      const authors = await db.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, username: true, displayName: true },
      })
      const authorMap = new Map(authors.map((a) => [String(a.id), a]))

      for (const comment of commentsOnPosts) {
        const postContent = postContentMap.get(String(comment.postId)) || ''
        const author = authorMap.get(String(comment.authorId))
        const createdAt =
          comment.createdAt instanceof Date
            ? comment.createdAt
            : new Date(String(comment.createdAt))

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
        })
      }
    }

    // Get replies to agent's comments
    const myComments = await db.comment.findMany({
      where: { authorId: agentUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true },
    })
    const myCommentIds = myComments.map((c) => String(c.id))

    if (myCommentIds.length > 0) {
      const repliesToComments = await db.comment.findMany({
        where: {
          parentCommentId: { in: myCommentIds },
          authorId: { not: agentUserId },
          createdAt: { gte: oneDayAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      // Get parent comment content
      const parentCommentIds = [
        ...new Set(
          repliesToComments
            .map((r) => String(r.parentCommentId))
            .filter((id) => id && id !== 'null'),
        ),
      ]
      const parentComments = await db.comment.findMany({
        where: { id: { in: parentCommentIds } },
        select: { id: true, content: true },
      })
      const parentCommentMap = new Map(
        parentComments.map((pc) => [String(pc.id), String(pc.content)]),
      )

      // Get author info
      const replyAuthorIds = [
        ...new Set(repliesToComments.map((r) => String(r.authorId))),
      ]
      const replyAuthors = await db.user.findMany({
        where: { id: { in: replyAuthorIds } },
        select: { id: true, username: true, displayName: true },
      })
      const replyAuthorMap = new Map(replyAuthors.map((a) => [String(a.id), a]))

      for (const reply of repliesToComments) {
        const author = replyAuthorMap.get(String(reply.authorId))
        const parentContent =
          parentCommentMap.get(String(reply.parentCommentId)) || ''
        const createdAt =
          reply.createdAt instanceof Date
            ? reply.createdAt
            : new Date(String(reply.createdAt))

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
        })
      }
    }

    return interactions
  }

  // ===========================================================================
  // Gather pending chat messages
  // ===========================================================================
  private async gatherPendingChatMessages(
    agentUserId: string,
  ): Promise<PendingInteraction[]> {
    const interactions: PendingInteraction[] = []
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get chats the agent is part of
    const agentChats = await db.chatParticipant.findMany({
      where: { userId: agentUserId },
      select: { chatId: true },
    })

    for (const chatParticipant of agentChats) {
      const chat = await db.chat.findUnique({
        where: { id: String(chatParticipant.chatId) },
      })
      if (!chat) continue

      // Get recent messages from others in this chat
      const chatMessages = await db.message.findMany({
        where: {
          chatId: String(chat.id),
          senderId: { not: agentUserId },
          createdAt: { gte: oneDayAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })

      if (chatMessages.length === 0) continue

      // Check if agent already responded to the latest message
      const latestFromOther = chatMessages[0]
      if (!latestFromOther) continue

      // Get the agent's most recent message in this chat
      const agentLastMessage = await db.message.findFirst({
        where: {
          chatId: String(chat.id),
          senderId: agentUserId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true },
      })

      // If agent's last message ID is greater than user's last message ID,
      // the agent has already responded
      if (
        agentLastMessage &&
        BigInt(agentLastMessage.id) > BigInt(latestFromOther.id)
      ) {
        logger.info(
          `Agent already responded to message in chat ${chat.id} - skipping`,
          {
            chatId: chat.id,
            lastUserMessageId: latestFromOther.id,
            lastUserMessageAt:
              latestFromOther.createdAt instanceof Date
                ? latestFromOther.createdAt.toISOString()
                : String(latestFromOther.createdAt),
            agentLastMessageId: agentLastMessage.id,
            agentLastMessageAt:
              agentLastMessage.createdAt instanceof Date
                ? agentLastMessage.createdAt.toISOString()
                : String(agentLastMessage.createdAt),
          },
          'AutonomousBatchResponse',
        )
        continue // Agent already responded
      }

      // Get recent conversation context
      const recentMessages = await db.message.findMany({
        where: { chatId: String(chat.id) },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      const contextMessages = recentMessages
        .reverse()
        .map(
          (m) =>
            `${String(m.senderId) === agentUserId ? 'You' : 'User'}: ${String(m.content)}`,
        )
        .join('\n')

      const latestMessage = chatMessages[0]
      if (latestMessage) {
        const createdAt =
          latestMessage.createdAt instanceof Date
            ? latestMessage.createdAt
            : new Date(String(latestMessage.createdAt))
        const chatName = chat.name ? String(chat.name) : ''

        interactions.push({
          type: 'chat_message',
          id: String(latestMessage.id),
          chatId: String(chat.id),
          author: 'User',
          content: String(latestMessage.content),
          context: `Chat: ${chatName || (chat.isGroup ? 'Group' : 'DM')}\nRecent:\n${contextMessages}`,
          timestamp: createdAt,
        })
      }
    }

    return interactions
  }

  // ===========================================================================
  // Main gather method (combines all interaction types)
  // ===========================================================================
  async gatherPendingInteractions(
    agentUserId: string,
  ): Promise<PendingInteraction[]> {
    // Gather all types in parallel
    const [commentReplies, chatMessages] = await Promise.all([
      this.gatherPendingCommentReplies(agentUserId),
      this.gatherPendingChatMessages(agentUserId),
    ])

    // Combine and sort by timestamp (oldest first for fairness)
    const interactions = [...commentReplies, ...chatMessages]
    interactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    return interactions
  }

  /**
   * Evaluate which interactions warrant a response using AI
   */
  async evaluateInteractions(
    agentUserId: string,
    _runtime: IAgentRuntime,
    interactions: PendingInteraction[],
  ): Promise<ResponseDecision[]> {
    if (interactions.length === 0) {
      return []
    }

    // Cap interactions to prevent context overflow (30 max)
    const cappedInteractions = interactions.slice(0, 30)
    if (cappedInteractions.length < interactions.length) {
      logger.info(
        `Capped interactions from ${interactions.length} to 30 to prevent context overflow`,
        undefined,
        'AutonomousBatchResponse',
      )
    }

    const agent = await db.user.findUnique({
      where: { id: agentUserId },
      select: { displayName: true },
    })

    if (!agent) {
      throw new Error('Agent not found')
    }

    const config = await getAgentConfig(agentUserId)
    const displayName = agent.displayName ? String(agent.displayName) : 'Agent'

    // Build evaluation prompt - ask for IDs instead of positional true/false
    // This is more robust as it doesn't rely on counting/ordering
    const prompt = `${config?.systemPrompt ?? 'You are an AI agent on Babylon.'}

You are ${displayName}, an AI agent on Babylon. You need to decide which interactions warrant a response.

CRITICAL: Be VERY selective. Silence is often the best response.

RESPOND ONLY TO:
- Direct questions asking for YOUR opinion or analysis
- Requests for clarification on something YOU said
- Comments where you have a genuinely DIFFERENT perspective to offer

DO NOT RESPOND TO:
- Agreement spirals - when everyone is making the same point, don't pile on
- Threads that have reached consensus - let them conclude naturally
- Comments adding more evidence to an already-established point
- Back-and-forth going in circles with no new insights
- Simple acknowledgments
- Conversations where no one is asking questions
- Threads that have drifted off-topic from the original post
- Discussions no longer relevant to the post's core topic

KEY QUESTION: Would my response add a NEW perspective, or just more of the same?
If more of the same, SKIP.

IMPORTANT: If same author has multiple interactions on the same post, respond to AT MOST ONE.

Pending Interactions (grouped by post):

${this.formatInteractionsGroupedByPost(cappedInteractions)}

Task: Decide which interactions you want to respond to.

# Required Output Format
Return ONLY the IDs of interactions you want to respond to, comma-separated.
Leave empty if you don't want to respond to any.

<response>
<respond_to>ID1, ID2, ID3 (or leave empty)</respond_to>
</response>

Do NOT include any explanations, only the XML format above.`

    // Ensure prompt fits within 32K context limit
    const estimatedTokens = countTokensSync(prompt)
    let finalPrompt = prompt

    if (estimatedTokens > 30000) {
      logger.warn(
        `Evaluation prompt too long: ${estimatedTokens} tokens, truncating`,
        undefined,
        'AutonomousBatchResponse',
      )
      const truncated = truncateToTokenLimitSync(prompt, 30000, {
        ellipsis: true,
      })
      finalPrompt = truncated.text
      logger.info(
        `Truncated to ${truncated.tokens} tokens`,
        undefined,
        'AutonomousBatchResponse',
      )
    }

    // Use large model for batch evaluation
    const decisionText = await Promise.race([
      callAgentLLM({
        prompt: finalPrompt,
        system: config?.systemPrompt,
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
            'No <response> block found in batch evaluation',
            {
              agentUserId,
            },
            'AutonomousBatchResponse',
          )
          resolve('[]')
        }, 30000)
      }),
    ])

    // Parse the IDs - empty string means no responses
    const responseMatch = decisionText.match(
      /<respond_to>([\s\S]*?)<\/respond_to>/i,
    )
    const responseValue = responseMatch ? responseMatch[1]?.trim() || '' : ''

    let respondToIds: Set<string>

    if (responseValue === '') {
      respondToIds = new Set()
    } else {
      // Parse comma-separated IDs
      const ids = responseValue
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)

      // Validate that IDs exist in our interactions
      const validIds = new Set(cappedInteractions.map((i) => i.id))
      const parsedIds = new Set<string>()

      for (const id of ids) {
        if (validIds.has(id)) {
          parsedIds.add(id)
        } else {
          logger.warn(
            `LLM returned unknown interaction ID: ${id}`,
            undefined,
            'AutonomousBatchResponse',
          )
        }
      }

      respondToIds = parsedIds
    }

    logger.info(
      `Agent selected ${respondToIds.size}/${cappedInteractions.length} interactions to respond to`,
      undefined,
      'AutonomousBatchResponse',
    )

    // Convert to ResponseDecision array (maintaining order of original interactions)
    return cappedInteractions.map((interaction) => ({
      shouldRespond: respondToIds.has(interaction.id),
    }))
  }

  /**
   * Generate and post responses for approved interactions
   */
  async executeResponses(
    agentUserId: string,
    _runtime: IAgentRuntime,
    interactions: PendingInteraction[],
    decisions: ResponseDecision[],
  ): Promise<number> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
      select: { displayName: true },
    })

    if (!agent) {
      throw new Error('Agent not found')
    }

    const respConfig = await getAgentConfig(agentUserId)
    const displayName = agent.displayName ? String(agent.displayName) : 'Agent'

    let responsesCreated = 0

    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i]
      const decision = decisions[i]

      if (!interaction || !decision || !decision.shouldRespond) continue

      // Generate response with retry loop
      const responsePrompt = `${respConfig?.systemPrompt ?? 'You are an AI agent on Babylon.'}

You are ${displayName}, responding to an interaction.

${interaction.context}

Task: Write a response (1-2 sentences, under 200 characters) OR leave empty to skip.

CRITICAL QUESTION: Does this add a NEW perspective, or just more of the same?

QUALITY REQUIREMENTS:
- Offer a DIFFERENT viewpoint - don't just agree or add supporting evidence
- Be specific and substantive - avoid generic responses
- Challenge assumptions if you see a flaw
- Match the energy/tone of the conversation
- Be authentic to your personality
- If mentioning markets, use SHORT SUMMARIES (e.g., "the TeslAI bet") not full questions

DO NOT WRITE:
- Empty acknowledgments (agreeing without adding value)
- More evidence for an already-established conclusion
- Generic advice without specifics
- Questions just to keep conversation going

LEAVE EMPTY IF:
- You would just be agreeing or adding more evidence to same point
- The thread has reached consensus - let it conclude
- Conversation is going in circles
- You have nothing genuinely different to contribute
- The thread has drifted off-topic from the original post
- Your response would not relate back to the post's core topic

# Required Output Format
<response>
<text>your response here (or leave empty to skip)</text>
</response>`

      // Truncate if needed
      const respTokens = countTokensSync(responsePrompt)
      let finalRespPrompt = responsePrompt
      if (respTokens > 30000) {
        const truncated = truncateToTokenLimitSync(responsePrompt, 30000, {
          ellipsis: true,
        })
        finalRespPrompt = truncated.text
      }

      // Use large model for response generation
      const responseContent = await Promise.race([
        callAgentLLM({
          prompt: finalRespPrompt,
          system: respConfig?.systemPrompt,
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
              'No <response> block found in response generation',
              {
                interactionId: interaction.id,
              },
              'AutonomousBatchResponse',
            )
            resolve('')
          }, 20000)
        }),
      ])

      // Parse the response
      const textMatch = responseContent.match(/<text>([\s\S]*?)<\/text>/i)
      const cleanContent = textMatch
        ? textMatch[1]?.trim().replace(/^["']|["']$/g, '') || ''
        : ''

      if (!cleanContent || cleanContent.length < 5) {
        logger.warn(
          `Failed to generate valid response for interaction ${interaction.id}`,
          undefined,
          'AutonomousBatchResponse',
        )
        continue
      }

      // Post the response based on type
      if (interaction.type === 'comment_on_post' && interaction.postId) {
        const result = await executeDirectComment({
          agentUserId,
          postId: interaction.postId,
          content: cleanContent,
        })

        if (result.success) {
          responsesCreated++
          logger.info(
            `Agent responded to comment on post ${interaction.postId}`,
            undefined,
            'AutonomousBatchResponse',
          )
        } else {
          logger.warn(
            `Failed to create comment: ${result.error}`,
            { interactionId: interaction.id },
            'AutonomousBatchResponse',
          )
        }
      } else if (
        interaction.type === 'comment_on_comment' &&
        interaction.commentId
      ) {
        const parentComment = await db.comment.findUnique({
          where: { id: interaction.commentId },
          select: { postId: true },
        })

        if (parentComment) {
          const result = await executeDirectComment({
            agentUserId,
            postId: String(parentComment.postId),
            content: cleanContent,
            parentCommentId: interaction.commentId,
          })

          if (result.success) {
            responsesCreated++
            logger.info(
              `Agent replied to comment ${interaction.commentId}`,
              undefined,
              'AutonomousBatchResponse',
            )
          } else {
            logger.warn(
              `Failed to create comment reply: ${result.error}`,
              { interactionId: interaction.id },
              'AutonomousBatchResponse',
            )
          }
        }
      } else if (interaction.type === 'chat_message' && interaction.chatId) {
        const result = await executeDirectMessage({
          agentUserId,
          chatId: interaction.chatId,
          content: cleanContent,
        })

        if (result.success) {
          responsesCreated++
          logger.info(
            `Agent responded in chat ${interaction.chatId}`,
            undefined,
            'AutonomousBatchResponse',
          )
        } else {
          logger.warn(
            `Failed to create chat message: ${result.error}`,
            { interactionId: interaction.id },
            'AutonomousBatchResponse',
          )
        }
      }

      // Small delay to avoid spam
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return responsesCreated
  }

  /**
   * Main entry point: Process all pending interactions in batch
   */
  async processBatch(
    agentUserId: string,
    _runtime: IAgentRuntime,
  ): Promise<number> {
    logger.info(
      `Starting batch response processing for agent ${agentUserId}`,
      undefined,
      'AutonomousBatchResponse',
    )

    // Step 1: Gather all pending interactions
    const interactions = await this.gatherPendingInteractions(agentUserId)

    if (interactions.length === 0) {
      logger.info(
        'No pending interactions to process',
        undefined,
        'AutonomousBatchResponse',
      )
      return 0
    }

    logger.info(
      `Found ${interactions.length} pending interactions`,
      undefined,
      'AutonomousBatchResponse',
    )

    // Step 2: Evaluate which ones warrant responses
    const decisions = await this.evaluateInteractions(
      agentUserId,
      _runtime,
      interactions,
    )

    const responseCount = decisions.filter((d) => d.shouldRespond).length
    logger.info(
      `Agent decided to respond to ${responseCount}/${interactions.length} interactions`,
      undefined,
      'AutonomousBatchResponse',
    )

    if (responseCount === 0) {
      return 0
    }

    // Step 3: Generate and post responses
    const responsesCreated = await this.executeResponses(
      agentUserId,
      _runtime,
      interactions,
      decisions,
    )

    logger.info(
      `Successfully created ${responsesCreated} responses`,
      undefined,
      'AutonomousBatchResponse',
    )

    return responsesCreated
  }
}

export const autonomousBatchResponseService =
  new AutonomousBatchResponseService()
