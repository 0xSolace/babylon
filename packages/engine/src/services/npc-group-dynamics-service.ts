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

import {
  actorRelationships,
  and,
  chatParticipants,
  chats,
  count,
  db,
  desc,
  eq,
  follows,
  groupChatMemberships,
  gte,
  inArray,
  lt,
  messages,
  or,
  poolPositions,
  posts,
  reactions,
  shares,
  userInteractions,
  users,
} from '@babylon/db'
import { generateSnowflakeId, logger, unwrapLLMResponse } from '@babylon/shared'
import { NPCGroupDynamicsConfig } from '../config/group-chat-config'
import { BabylonLLMClient } from '../llm/openai-client'
import { generateWorldContext, validateNoRealNames } from '../prompts'
import { GroupInviteOrchestrator } from './group-invite-orchestrator'
import { MarketContextService } from './market-context-service'
import { NPCGroupDynamicsCalculations } from './npc-group-dynamics-calculations'
import { StaticDataRegistry } from './static-data-registry'

// Singleton for NPC context
const marketContextService = new MarketContextService()

export interface GroupDynamicsResult {
  groupsCreated: number
  membersAdded: number
  membersRemoved: number
  usersInvited: number
  usersKicked: number
  messagesPosted: number
}

// biome-ignore lint/complexity/noStaticOnlyClass: Service pattern uses static methods for stateless operations
export class NPCGroupDynamicsService {
  /**
   * Process all NPC group dynamics for one tick
   */
  static async processTickDynamics(): Promise<GroupDynamicsResult> {
    const startTime = Date.now()
    const result: GroupDynamicsResult = {
      groupsCreated: 0,
      membersAdded: 0,
      membersRemoved: 0,
      usersInvited: 0,
      usersKicked: 0,
      messagesPosted: 0,
    }

    logger.info(
      'Processing NPC group dynamics',
      undefined,
      'NPCGroupDynamicsService',
    )

    // Initialize LLM client for message generation
    // Priority: Groq > Claude > OpenAI
    const llm = BabylonLLMClient.forGameTick()

    // 1. Form new groups
    const newGroups = await NPCGroupDynamicsService.formNewGroups()
    result.groupsCreated = newGroups

    // 2. NPCs join existing groups
    const joins = await NPCGroupDynamicsService.processGroupJoins()
    result.membersAdded = joins

    // 3. NPCs leave groups
    const leaves = await NPCGroupDynamicsService.processGroupLeaves()
    result.membersRemoved = leaves

    // 4. NPCs post messages to groups
    if (llm) {
      const messages = await NPCGroupDynamicsService.postGroupMessages(llm)
      result.messagesPosted = messages
    }

    // 5. Invite users to groups (via group invite orchestrator)
    const inviteResult = await GroupInviteOrchestrator.processQueuedInvites()
    result.usersInvited = inviteResult.invitesSent

    // 6. Kick users based on weighted participation metrics
    const kicks = await NPCGroupDynamicsService.kickUsersWithWeightedLogic()
    result.usersKicked = kicks

    const duration = Date.now() - startTime
    logger.info(
      'NPC group dynamics complete',
      { ...result, duration },
      'NPCGroupDynamicsService',
    )

    return result
  }

  /**
   * Form new NPC groups based on relationships
   */
  private static async formNewGroups(): Promise<number> {
    let groupsCreated = 0

    // Get NPCs from static registry
    const npcs = StaticDataRegistry.getAllActors().map((a) => ({
      id: a.id,
      name: a.name,
    }))

    for (const npc of npcs) {
      // Random chance to form a group
      if (Math.random() > NPCGroupDynamicsConfig.formNewGroupChance) {
        continue
      }

      // Check if NPC already has a group they admin by querying groups with their name
      const [hasGroup] = await db
        .select({ id: chats.id, name: chats.name })
        .from(chats)
        .where(eq(chats.isGroup, true))
        .limit(1000)

      const alreadyHasGroup = hasGroup
        ? (
            await db
              .select({ id: chats.id, name: chats.name })
              .from(chats)
              .where(eq(chats.isGroup, true))
          ).some((g) => {
            const groupName = String(g.name ?? '')
            const npcName = String(npc.name)
            return groupName.includes(npcName)
          })
        : false

      if (alreadyHasGroup) {
        continue // Already has a group
      }

      // Get NPC's positive relationships
      const relationships = await db
        .select()
        .from(actorRelationships)
        .where(
          and(
            or(
              eq(actorRelationships.actor1Id, npc.id),
              eq(actorRelationships.actor2Id, npc.id),
            ),
            gte(actorRelationships.sentiment, 0.5),
          ),
        )
        .limit(NPCGroupDynamicsConfig.idealGroupSize - 1)

      const memberIds = new Set<string>([npc.id])

      // Add related actors as members
      for (const rel of relationships) {
        const relActor1Id = String(rel.actor1Id)
        const relActor2Id = String(rel.actor2Id)
        const memberId = relActor1Id === npc.id ? relActor2Id : relActor1Id
        memberIds.add(memberId)
      }

      if (memberIds.size < NPCGroupDynamicsConfig.minGroupSize) {
        continue // Not enough members
      }

      // Create the group chat
      const chatId = await generateSnowflakeId()
      const chatName = `${npc.name}'s Circle`

      await db.insert(chats).values({
        id: chatId,
        name: chatName,
        isGroup: true,
        updatedAt: new Date(),
      })

      // Create participants
      const participantValues = await Promise.all(
        Array.from(memberIds).map(async (memberId) => ({
          id: await generateSnowflakeId(),
          chatId,
          userId: memberId,
        })),
      )
      await db.insert(chatParticipants).values(participantValues)

      groupsCreated++
      logger.info(
        'NPC formed new group',
        {
          npcId: npc.id,
          npcName: npc.name,
          chatName,
          memberCount: memberIds.size,
        },
        'NPCGroupDynamicsService',
      )
    }

    return groupsCreated
  }

  /**
   * Process NPCs joining existing groups
   */
  private static async processGroupJoins(): Promise<number> {
    let joinsProcessed = 0

    // Get all NPC group chats
    const groupList = await db
      .select()
      .from(chats)
      .where(eq(chats.isGroup, true))

    for (const group of groupList) {
      const joinGroupId = String(group.id)

      // Get participants for this group
      const participants = await db
        .select({ userId: chatParticipants.userId })
        .from(chatParticipants)
        .where(eq(chatParticipants.chatId, joinGroupId))

      // Don't add to full groups
      if (participants.length >= NPCGroupDynamicsConfig.maxGroupSize) {
        continue
      }

      const currentMemberIds = new Set(
        participants.map((p) => String(p.userId)),
      )
      const memberIdsArray = Array.from(currentMemberIds)

      // Get NPCs who could join from static registry
      const allActors = StaticDataRegistry.getAllActors()
      const memberIdsSet = new Set(memberIdsArray.map(String))
      const potentialMembers =
        memberIdsArray.length > 0
          ? allActors.filter((a) => !memberIdsSet.has(a.id)).slice(0, 5)
          : allActors.slice(0, 5)

      for (const candidate of potentialMembers) {
        // Random chance to join
        if (Math.random() > NPCGroupDynamicsConfig.joinGroupChance) {
          continue
        }

        // Check if candidate has positive relationships with current members
        const relationships =
          memberIdsArray.length > 0
            ? await db
                .select()
                .from(actorRelationships)
                .where(
                  and(
                    or(
                      and(
                        eq(actorRelationships.actor1Id, candidate.id),
                        inArray(actorRelationships.actor2Id, memberIdsArray),
                      ),
                      and(
                        eq(actorRelationships.actor2Id, candidate.id),
                        inArray(actorRelationships.actor1Id, memberIdsArray),
                      ),
                    ),
                    gte(actorRelationships.sentiment, 0.3),
                  ),
                )
            : []

        // Must have at least 2 friends in the group
        if (relationships.length >= 2) {
          // Add to group
          await db.insert(chatParticipants).values({
            id: await generateSnowflakeId(),
            chatId: joinGroupId,
            userId: candidate.id,
          })

          joinsProcessed++
          logger.info(
            'NPC joined group',
            {
              npcId: candidate.id,
              npcName: candidate.name,
              chatName: group.name ? String(group.name) : '',
              friendsInGroup: relationships.length,
            },
            'NPCGroupDynamicsService',
          )

          break // Only one join per group per tick
        }
      }
    }

    return joinsProcessed
  }

  /**
   * Process NPCs leaving groups
   */
  private static async processGroupLeaves(): Promise<number> {
    let leavesProcessed = 0

    // Get all group chats
    const groupChats = await db
      .select()
      .from(chats)
      .where(eq(chats.isGroup, true))

    for (const chat of groupChats) {
      const leaveChatId = String(chat.id)

      // Get all participants for this chat
      const participantList = await db
        .select()
        .from(chatParticipants)
        .where(eq(chatParticipants.chatId, leaveChatId))

      // Don't process if group would become too small
      if (participantList.length <= NPCGroupDynamicsConfig.minGroupSize) {
        continue
      }

      for (const membership of participantList) {
        // Random chance to leave
        if (Math.random() > NPCGroupDynamicsConfig.leaveGroupChance) {
          continue
        }

        const membershipUserId = String(membership.userId)
        const membershipId = String(membership.id)
        const chatName = chat.name ? String(chat.name) : ''

        // Check if NPC is the group creator (don't leave own group)
        if (chatName.includes(membershipUserId)) {
          continue
        }

        // Check if NPC has negative relationships with members
        const memberIds = participantList
          .map((p) => String(p.userId))
          .filter((id) => id !== membershipUserId)

        if (memberIds.length === 0) continue

        const negativeRelationships = await db
          .select()
          .from(actorRelationships)
          .where(
            and(
              or(
                and(
                  eq(actorRelationships.actor1Id, membershipUserId),
                  inArray(actorRelationships.actor2Id, memberIds),
                ),
                and(
                  eq(actorRelationships.actor2Id, membershipUserId),
                  inArray(actorRelationships.actor1Id, memberIds),
                ),
              ),
              lt(actorRelationships.sentiment, -0.3),
            ),
          )

        // Leave if too many enemies in group
        if (negativeRelationships.length >= 2) {
          await db
            .delete(chatParticipants)
            .where(eq(chatParticipants.id, membershipId))

          leavesProcessed++
          logger.info(
            'NPC left group',
            {
              npcId: membershipUserId,
              chatName,
              reason: `${negativeRelationships.length} negative relationships`,
            },
            'NPCGroupDynamicsService',
          )
        }
      }
    }

    return leavesProcessed
  }

  /**
   * Post messages to groups from NPCs
   *
   * IMPORTANT: Group chats are the core ASYMMETRIC INFORMATION mechanic.
   * NPCs share insider info here that they would NEVER post publicly:
   * - Real positions and upcoming trades
   * - Insider knowledge about questions/markets
   * - Contradictions to their public statements
   * - Strategic coordination with allies
   */
  private static async postGroupMessages(
    llm: BabylonLLMClient,
  ): Promise<number> {
    let messagesPosted = 0

    // Get active group chats
    const groupList = await db
      .select()
      .from(chats)
      .where(eq(chats.isGroup, true))
      .limit(20)

    for (const group of groupList) {
      // Random chance to post
      if (Math.random() > NPCGroupDynamicsConfig.postMessageChance) {
        continue
      }

      const groupId = String(group.id)
      const groupName = group.name ? String(group.name) : ''

      // Get participants
      const participantList = await db
        .select()
        .from(chatParticipants)
        .where(eq(chatParticipants.chatId, groupId))

      // Get recent messages
      const recentMsgs = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, groupId))
        .orderBy(desc(messages.createdAt))
        .limit(10)

      // Get user details for participants
      const participantUserIds = participantList.map((p) => String(p.userId))
      const participantUsers =
        participantUserIds.length > 0
          ? await db
              .select({
                id: users.id,
                displayName: users.displayName,
                isActor: users.isActor,
              })
              .from(users)
              .where(inArray(users.id, participantUserIds))
          : []

      // Get NPCs in this group
      const npcUsers = participantUsers.filter((u) => u.isActor)

      if (npcUsers.length === 0) {
        continue // No NPCs in this group
      }

      // Pick a random NPC to post
      const randomNpc = npcUsers[Math.floor(Math.random() * npcUsers.length)]
      if (!randomNpc) continue

      const randomNpcId = String(randomNpc.id)
      const randomNpcDisplayName = randomNpc.displayName
        ? String(randomNpc.displayName)
        : 'Unknown'

      // Get full NPC actor data from static registry
      const npcActor = StaticDataRegistry.getActor(randomNpcId)

      // Get NPC's current positions for insider trading context
      const npcPositions = await db
        .select()
        .from(poolPositions)
        .where(eq(poolPositions.poolId, randomNpcId))
        .limit(5)

      // Get NPC-specific events (things that happened to THIS NPC)
      const npcName = npcActor?.name || randomNpcDisplayName
      const npcEvents = await marketContextService.getEventsForNPC(
        randomNpcId,
        npcName,
      )

      // Build personal events context
      const personalEventsContext =
        npcEvents.length > 0
          ? `RECENT EVENTS INVOLVING YOU (use as insider knowledge):\n${npcEvents
              .slice(0, 5)
              .map((e) => `- [${e.type}] ${e.description}`)
              .join('\n')}`
          : ''

      // Get sender details for recent messages
      const messageSenderIds = recentMsgs
        .slice(0, 5)
        .map((m) => String(m.senderId))
      const senders =
        messageSenderIds.length > 0
          ? await db
              .select({
                id: users.id,
                displayName: users.displayName,
              })
              .from(users)
              .where(inArray(users.id, messageSenderIds))
          : []
      const senderMap = new Map(
        senders.map((s) => [
          String(s.id),
          s.displayName ? String(s.displayName) : 'Someone',
        ]),
      )

      // Build conversation context from recent messages
      const recentMessages = recentMsgs
        .slice(0, 5)
        .reverse()
        .map(
          (m) =>
            `${senderMap.get(String(m.senderId)) || 'Someone'}: ${String(m.content ?? '')}`,
        )
        .join('\n')

      const conversationContext = recentMessages
        ? `Recent conversation:\n${recentMessages}`
        : ''

      // Build position context for insider trading info
      const positionContext =
        npcPositions.length > 0
          ? `YOUR CURRENT POSITIONS (share strategically):\n${npcPositions
              .map((p) => {
                const pMarketType = String(p.marketType)
                const pTicker = p.ticker ? String(p.ticker) : ''
                const pMarketId = p.marketId ? String(p.marketId) : ''
                const pSide = String(p.side)
                const pUnrealizedPnL = Number(p.unrealizedPnL ?? 0)
                return `- ${pMarketType === 'perp' ? pTicker : `Question #${pMarketId}`}: ${pSide} position, ${pUnrealizedPnL > 0 ? 'up' : 'down'} $${Math.abs(pUnrealizedPnL).toFixed(0)}`
              })
              .join('\n')}`
          : ''

      // Build affiliation context
      const affiliationContext =
        npcActor?.affiliations && npcActor.affiliations.length > 0
          ? `Your affiliations: ${npcActor.affiliations.join(', ')}`
          : ''

      // Get world context for consistent parody names and market awareness
      const worldContext = await generateWorldContext({ maxActors: 20 })

      // Generate INSIDER message - this is the key asymmetric information mechanic!
      // Each NPC generates their message INDEPENDENTLY with their own personal context
      const prompt = `You are ${randomNpc.displayName} in a PRIVATE group chat with trusted insiders.
${affiliationContext}

${personalEventsContext}

${conversationContext}

${positionContext}

${worldContext.worldActors}
${worldContext.currentMarkets}

This is PRIVATE - share STRATEGIC insider information that you would NEVER post publicly:

WHAT TO SHARE (pick one that's relevant):
- React to events that happened to YOU (see above) with insider perspective
- "Just loaded up on [ticker] before the announcement drops"
- "Between us, [company] numbers look terrible this quarter"
- "I'm hearing [rival] is in serious trouble"
- "Get out of [ticker] now - trust me on this"
- "Real talk: market is wrong about [question]"
- Your actual position and why (contradict public statements if needed)
- Insider knowledge about your affiliated organizations
- Strategic advice for friends in this group

PRIVATE vs PUBLIC:
- PUBLIC feed: What you want the market to think
- PRIVATE chat: What you actually know/believe/plan
- Help friends make money, hurt enemies

Write a private message (max 200 chars) with ACTIONABLE insider info.
Be SPECIFIC with tickers, positions, or predictions. Reference your recent events if relevant.
NO hashtags. Emojis OK (🤫 👀 🔥).
Use parody names from World Actors (AIlon Musk, not Elon Musk).

Return your response as XML:
<response>
  <message>your insider message here</message>
</response>`

      const rawResponse = await llm.generateJSON<
        { message: string } | { response: { message: string } }
      >(
        prompt,
        {
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
        {
          temperature: 0.9,
          maxTokens: 100,
          promptType: 'npc_group_dynamic_message',
        },
      )

      // Handle XML structure - unwrap nested response
      const response = unwrapLLMResponse<{ message: string }>(rawResponse)
      if (!response?.message || response.message.length === 0) {
        continue
      }

      // Process message: strip hashtags (never allowed) but keep emojis (allowed in private chats)
      const rawContent = response.message.trim()
      // Strip hashtags (defense-in-depth since prompt forbids them)
      const messageContent = rawContent
        .replace(/#\w+/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Validate message follows rules
      // Note: Emojis are ALLOWED in private group chats (unlike public feed posts)
      // This is intentional - group chats are more casual/private
      const realNameViolations = validateNoRealNames(messageContent)

      if (realNameViolations.length > 0) {
        logger.warn(
          'NPC group message validation failed, skipping',
          {
            npcId: randomNpc.id,
            violations: realNameViolations,
            message: messageContent,
          },
          'NPCGroupDynamicsService',
        )
        continue
      }

      // Create the message
      await db.insert(messages).values({
        id: await generateSnowflakeId(),
        content: messageContent,
        chatId: groupId,
        senderId: randomNpcId,
        createdAt: new Date(),
      })

      // Update chat updated timestamp
      await db
        .update(chats)
        .set({ updatedAt: new Date() })
        .where(eq(chats.id, groupId))

      messagesPosted++
      logger.debug(
        'NPC posted to group',
        {
          npcId: randomNpcId,
          npcName: randomNpcDisplayName,
          chatId: groupId,
          chatName: groupName,
        },
        'NPCGroupDynamicsService',
      )
    }

    return messagesPosted
  }

  /**
   * Calculate "reply guy" score for a user based on their interactions with NPCs
   *
   * Rewards quality engagement, penalizes spam behavior
   *
   * Scoring:
   * - Follow: +5 points
   * - Comment: +3 points (ideal: 1-3 per week)
   * - Like: +1 point (ideal: 3-10 per week)
   * - Repost: +4 points (ideal: 1-2 per week)
   *
   * Penalties for excessive engagement (spam behavior):
   * - Too many comments (>10/week): -2 per excess comment
   * - Too many likes (>30/week): -0.5 per excess like
   * - Too many reposts (>5/week): -3 per excess repost
   */
  /**
   * Calculate engagement score for potential group invites (exposed for testing)
   */
  public static async calculateReplyGuyScore(
    userId: string,
    npcIds: string[],
  ): Promise<{
    score: number
    breakdown: {
      follows: number
      comments: number
      likes: number
      reposts: number
      penalties: number
      relationshipModifier: number
      friendBoosts: number
      enemyPenalties: number
    }
  }> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    let score = 0
    const breakdown = {
      follows: 0,
      comments: 0,
      likes: 0,
      reposts: 0,
      penalties: 0,
      relationshipModifier: 1.0,
      friendBoosts: 0,
      enemyPenalties: 0,
    }

    // 1. Check follows (all-time)
    const followResultArr =
      npcIds.length > 0
        ? await db
            .select({ count: count() })
            .from(follows)
            .where(
              and(
                eq(follows.followerId, userId),
                inArray(follows.followingId, npcIds),
              ),
            )
        : [{ count: 0 }]
    const followResult = followResultArr[0]
    const followCount =
      followResult && 'count' in followResult ? Number(followResult.count) : 0
    breakdown.follows = followCount * 5
    score += breakdown.follows

    // 2. Count comments on NPC posts (last 7 days)
    // This requires a subquery to find posts by NPCs that user commented on
    const npcPosts =
      npcIds.length > 0
        ? await db
            .select({ id: posts.id })
            .from(posts)
            .where(inArray(posts.authorId, npcIds))
        : []
    const npcPostIds = npcPosts.map((p) => String(p.id))

    const commentResultArr =
      npcPostIds.length > 0
        ? await db
            .select({ count: count() })
            .from(posts)
            .where(
              and(
                eq(posts.authorId, userId),
                inArray(posts.commentOnPostId, npcPostIds),
                gte(posts.createdAt, oneWeekAgo),
              ),
            )
        : [{ count: 0 }]
    const commentResult = commentResultArr[0]
    const commentCount =
      commentResult && 'count' in commentResult
        ? Number(commentResult.count)
        : 0

    // Ideal: 1-3 comments per week
    if (commentCount >= 1 && commentCount <= 3) {
      breakdown.comments = commentCount * 3
      score += breakdown.comments
    } else if (commentCount > 3 && commentCount <= 10) {
      // Still okay, but diminishing returns
      breakdown.comments = commentCount * 2
      score += breakdown.comments
    } else if (commentCount > 10) {
      // Spam behavior - penalty
      const goodComments = 10 * 2 // First 10 get points
      const excessComments = commentCount - 10
      const penalty = excessComments * -2
      breakdown.comments = goodComments
      breakdown.penalties += penalty
      score += goodComments + penalty
    }

    // 3. Count likes on NPC posts (last 7 days)
    const likeResultArr =
      npcPostIds.length > 0
        ? await db
            .select({ count: count() })
            .from(reactions)
            .where(
              and(
                eq(reactions.userId, userId),
                eq(reactions.type, 'like'),
                inArray(reactions.postId, npcPostIds),
                gte(reactions.createdAt, oneWeekAgo),
              ),
            )
        : [{ count: 0 }]
    const likeResult = likeResultArr[0]
    const likeCount =
      likeResult && 'count' in likeResult ? Number(likeResult.count) : 0

    // Ideal: 3-10 likes per week
    if (likeCount >= 3 && likeCount <= 10) {
      breakdown.likes = likeCount * 1
      score += breakdown.likes
    } else if (likeCount > 10 && likeCount <= 30) {
      // Moderate engagement
      breakdown.likes = likeCount * 0.5
      score += breakdown.likes
    } else if (likeCount > 30) {
      // Excessive liking - penalty
      const goodLikes = 30 * 0.5
      const excessLikes = likeCount - 30
      const penalty = excessLikes * -0.5
      breakdown.likes = goodLikes
      breakdown.penalties += penalty
      score += goodLikes + penalty
    } else if (likeCount > 0 && likeCount < 3) {
      // Some engagement is better than none
      breakdown.likes = likeCount * 0.5
      score += breakdown.likes
    }

    // 4. Count reposts/shares of NPC posts (last 7 days)
    const repostResultArr =
      npcPostIds.length > 0
        ? await db
            .select({ count: count() })
            .from(shares)
            .where(
              and(
                eq(shares.userId, userId),
                inArray(shares.postId, npcPostIds),
                gte(shares.createdAt, oneWeekAgo),
              ),
            )
        : [{ count: 0 }]
    const repostResult = repostResultArr[0]
    const repostCount =
      repostResult && 'count' in repostResult ? Number(repostResult.count) : 0

    // Ideal: 1-2 reposts per week
    if (repostCount >= 1 && repostCount <= 2) {
      breakdown.reposts = repostCount * 4
      score += breakdown.reposts
    } else if (repostCount > 2 && repostCount <= 5) {
      // Moderate reposting
      breakdown.reposts = repostCount * 2
      score += breakdown.reposts
    } else if (repostCount > 5) {
      // Excessive reposting - penalty
      const goodReposts = 5 * 2
      const excessReposts = repostCount - 5
      const penalty = excessReposts * -3
      breakdown.reposts = goodReposts
      breakdown.penalties += penalty
      score += goodReposts + penalty
    }

    // 5. Apply relationship modifier
    const relationshipModifier =
      await NPCGroupDynamicsService.calculateRelationshipModifier(
        userId,
        npcIds,
      )
    breakdown.relationshipModifier = relationshipModifier.modifier
    breakdown.friendBoosts = relationshipModifier.friendBoosts
    breakdown.enemyPenalties = relationshipModifier.enemyPenalties

    // Apply the modifier to the final score
    score = score * relationshipModifier.modifier

    return { score, breakdown }
  }

  /**
   * Calculate relationship-based modifier for invite probability
   *
   * If user engages with friends of the candidate NPC, boost invite chance slightly
   * If user engages with enemies of the candidate NPC, reduce invite chance
   *
   * @param userId - The user being evaluated
   * @param targetNpcIds - The NPCs in the group (candidates for inviting)
   * @returns Modifier between 0.2x and 2.0x
   */
  private static async calculateRelationshipModifier(
    userId: string,
    targetNpcIds: string[],
  ): Promise<{
    modifier: number
    friendBoosts: number
    enemyPenalties: number
  }> {
    let modifier = 1.0
    let friendBoosts = 0
    let enemyPenalties = 0

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Get all NPCs the user has engaged with (via UserInteraction table)
    const userInteractionList = await db
      .select({ npcId: userInteractions.npcId })
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.userId, userId),
          gte(userInteractions.timestamp, thirtyDaysAgo),
        ),
      )

    // Get unique NPC IDs - cast to string[] since npcId is string
    const userEngagedNpcIds: string[] = [
      ...new Set(userInteractionList.map((i) => String(i.npcId))),
    ]

    if (userEngagedNpcIds.length === 0) {
      return { modifier: 1.0, friendBoosts: 0, enemyPenalties: 0 }
    }

    // For each target NPC (in the group), check relationships with NPCs user engages with
    for (const targetNpcId of targetNpcIds) {
      const relationships = await db
        .select()
        .from(actorRelationships)
        .where(
          or(
            and(
              eq(actorRelationships.actor1Id, targetNpcId),
              inArray(actorRelationships.actor2Id, userEngagedNpcIds),
            ),
            and(
              eq(actorRelationships.actor2Id, targetNpcId),
              inArray(actorRelationships.actor1Id, userEngagedNpcIds),
            ),
          ),
        )

      for (const rel of relationships) {
        const relSentiment = Number(rel.sentiment ?? 0)
        const relActor1Id = String(rel.actor1Id)
        const relActor2Id = String(rel.actor2Id)

        // Enemy relationship: reduce invite chance
        if (relSentiment < -0.3) {
          modifier *= 0.8 // 20% reduction per enemy
          enemyPenalties++
          logger.debug(
            'User engages with enemy NPC, reducing invite chance',
            {
              userId,
              targetNpcId,
              enemyNpcId:
                relActor1Id === targetNpcId ? relActor2Id : relActor1Id,
              sentiment: relSentiment,
              newModifier: modifier,
            },
            'NPCGroupDynamicsService',
          )
        }
        // Friend relationship: boost invite chance slightly
        else if (relSentiment > 0.5) {
          modifier *= 1.1 // 10% boost per friend
          friendBoosts++
          logger.debug(
            'User engages with friend NPC, boosting invite chance',
            {
              userId,
              targetNpcId,
              friendNpcId:
                relActor1Id === targetNpcId ? relActor2Id : relActor1Id,
              sentiment: relSentiment,
              newModifier: modifier,
            },
            'NPCGroupDynamicsService',
          )
        }
      }
    }

    // Cap the modifier between 0.2x (80% penalty max) and 2.0x (100% boost max)
    modifier = Math.max(0.2, Math.min(2.0, modifier))

    return { modifier, friendBoosts, enemyPenalties }
  }

  /**
   * @deprecated Use GroupInviteOrchestrator.processQueuedInvites() instead.
   * This method is now a no-op - invites are processed by the orchestrator.
   *
   * The new event-driven system works as follows:
   * 1. When users do positive actions (reply, follow, share), they're queued
   *    as invite candidates via GroupInviteOrchestrator.queueInviteCandidate()
   * 2. On each tick, processQueuedInvites() processes the queue with probability
   * 3. NPC tier affects selectivity (legendary NPCs are more selective)
   */
  // Removed: inviteUsersToGroups - now delegated to GroupInviteOrchestrator.processQueuedInvites()

  /**
   * Calculate kick probability with exponential scaling for over-posting
   *
   * Delegates to the pure calculation module for testability.
   *
   * @returns { probability: number, reason: string, category: 'inactive' | 'low' | 'over' | 'spam' | 'safe' }
   */
  static calculateKickProbability(
    userMessageCount: number,
    totalMessages: number,
    participantCount: number,
    windowDays = 7,
  ): {
    probability: number
    reason: string
    category: 'inactive' | 'low' | 'over' | 'spam' | 'safe'
  } {
    return NPCGroupDynamicsCalculations.calculateKickProbability(
      userMessageCount,
      totalMessages,
      participantCount,
      windowDays,
    )
  }

  /**
   * Kick users with weighted randomness based on dynamic participation metrics
   *
   * Uses dynamic thresholds based on group activity level:
   * - Never posted: 90% kick probability
   * - Low participation: 20-50% based on how far below ideal minimum
   * - Over-posting: Exponential increase from 10% to 90% as messages approach spam threshold
   * - Spam (3x fair share or 20+/day): 95%+ kick probability
   *
   * All probabilities are then multiplied by a per-tick factor (5%) to make
   * kicks gradual rather than immediate.
   */
  private static async kickUsersWithWeightedLogic(): Promise<number> {
    let usersKicked = 0

    // Only check for kicks some of the time
    if (Math.random() > NPCGroupDynamicsConfig.kickCheckChance) {
      return 0
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get all group chats
    const groupList = await db
      .select()
      .from(chats)
      .where(eq(chats.isGroup, true))

    for (const group of groupList) {
      const kickGroupId = String(group.id)

      // Get participants for this group
      const participantList = await db
        .select()
        .from(chatParticipants)
        .where(eq(chatParticipants.chatId, kickGroupId))

      // Get recent messages
      const recentMsgs = await db
        .select({ senderId: messages.senderId })
        .from(messages)
        .where(
          and(
            eq(messages.chatId, kickGroupId),
            gte(messages.createdAt, sevenDaysAgo),
          ),
        )

      // Get user details for participants (both users and agents, excluding NPCs)
      const participantUserIds = participantList.map((p) => String(p.userId))
      const participantUsers =
        participantUserIds.length > 0
          ? await db
              .select({
                id: users.id,
                displayName: users.displayName,
                isActor: users.isActor,
                isAgent: users.isAgent,
              })
              .from(users)
              .where(
                and(
                  inArray(users.id, participantUserIds),
                  eq(users.isActor, false),
                ),
              )
          : []

      if (participantUsers.length === 0) continue

      // Calculate message counts for all users in the group
      const totalMessages = recentMsgs.length
      const messageCounts = new Map<string, number>()

      for (const msg of recentMsgs) {
        const msgSenderId = String(msg.senderId)
        messageCounts.set(
          msgSenderId,
          (messageCounts.get(msgSenderId) || 0) + 1,
        )
      }

      // Total active participants includes NPCs for fair share calculation
      const totalParticipants = participantList.length

      // Calculate kick probabilities for each non-NPC participant
      for (const participant of participantUsers) {
        const participantUserId = String(participant.id)
        const userMessageCount = messageCounts.get(participantUserId) || 0

        const {
          probability: kickProbability,
          reason,
          category,
        } = NPCGroupDynamicsService.calculateKickProbability(
          userMessageCount,
          totalMessages,
          totalParticipants,
          7, // 7-day window
        )

        // Skip safe users
        if (category === 'safe' || kickProbability === 0) {
          continue
        }

        // Apply the probability with per-tick multiplier
        // 5% base multiplier, but spam gets 20% (faster kick for egregious behavior)
        const tickMultiplier = category === 'spam' ? 0.2 : 0.05

        if (Math.random() < kickProbability * tickMultiplier) {
          // Remove from chat participants
          await db
            .delete(chatParticipants)
            .where(
              and(
                eq(chatParticipants.chatId, kickGroupId),
                eq(chatParticipants.userId, participantUserId),
              ),
            )

          // If GroupChatMembership exists, mark as removed
          await db
            .update(groupChatMemberships)
            .set({
              isActive: false,
              removedAt: new Date(),
              sweepReason: reason,
            })
            .where(
              and(
                eq(groupChatMemberships.chatId, kickGroupId),
                eq(groupChatMemberships.userId, participantUserId),
              ),
            )

          usersKicked++
          logger.info(
            'User kicked from group with weighted logic',
            {
              userId: participantUserId,
              userName: participant.displayName
                ? String(participant.displayName)
                : 'Unknown',
              isAgent: participant.isAgent,
              chatId: kickGroupId,
              chatName: group.name ? String(group.name) : '',
              reason,
              category,
              kickProbability: kickProbability.toFixed(2),
              effectiveProbability: (kickProbability * tickMultiplier).toFixed(
                4,
              ),
              messageCount: userMessageCount,
              totalMessages,
              totalParticipants,
            },
            'NPCGroupDynamicsService',
          )
        }
      }
    }

    return usersKicked
  }

  /**
   * Get group dynamics statistics
   */
  static async getGroupStats(): Promise<{
    totalGroups: number
    activeGroups: number
    totalMembers: number
    avgGroupSize: number
  }> {
    // Get total group count
    const countResultArr = await db
      .select({ count: count() })
      .from(chats)
      .where(eq(chats.isGroup, true))
    const countResult = countResultArr[0]
    const totalGroups =
      countResult && 'count' in countResult ? Number(countResult.count) : 0

    // Get all groups
    const groupList = await db
      .select()
      .from(chats)
      .where(eq(chats.isGroup, true))

    // Get participant counts for each group
    let activeGroups = 0
    let totalMembers = 0

    for (const group of groupList) {
      const statsGroupId = String(group.id)
      const partCountResultArr = await db
        .select({ count: count() })
        .from(chatParticipants)
        .where(eq(chatParticipants.chatId, statsGroupId))
      const partCountResult = partCountResultArr[0]
      const participantCount =
        partCountResult && 'count' in partCountResult
          ? Number(partCountResult.count)
          : 0

      if (participantCount >= NPCGroupDynamicsConfig.minGroupSize) {
        activeGroups++
      }
      totalMembers += participantCount
    }

    const avgGroupSize =
      groupList.length > 0 ? totalMembers / groupList.length : 0

    return {
      totalGroups,
      activeGroups,
      totalMembers,
      avgGroupSize,
    }
  }
}
