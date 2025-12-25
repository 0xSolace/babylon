// @ts-nocheck - Database query type inference issues, needs refactoring
/**
 * Market Context Service
 *
 * Builds complete market context for NPCs to make trading decisions.
 * Gathers: feed posts, group chats, events, market data, current positions.
 *
 * Token-aware: Limits context size to prevent LLM token overflows
 */

import {
  actorRelationships,
  actorState,
  and,
  asc,
  chatParticipants,
  chats,
  db,
  desc,
  eq,
  getDbInstance,
  gte,
  inArray,
  isNull,
  lte,
  markets,
  messages,
  or,
  poolPositions,
  posts,
  stockPrices,
  worldEvents,
} from '@babylon/db'
import { logger, toMarketType, toStringArraySafe } from '@babylon/shared'

/** Helper to convert actors array, returning undefined if empty/invalid */
function toStringArrayOrUndefined(value: unknown): string[] | undefined {
  const arr = toStringArraySafe(value)
  return arr.length > 0 ? arr : undefined
}

import { isSimulationMode } from '../storage-bridge'
import type {
  EventContext,
  FeedPostContext,
  GroupChatContext,
  MarketSignalContext,
  MarketSnapshots,
  NPCMarketContext,
  NPCPosition,
  PerpMarketSnapshot,
  PredictionMarketSnapshot,
  RelationshipContext,
} from '../types/market-context'
import { SignalExtractionService } from './signal-extraction-service'
import { StaticDataRegistry } from './static-data-registry'

// Note: Row types are accessed via direct property coercion to avoid cast requirements

export class MarketContextService {
  /**
   * Build market context for all NPCs in the system
   *
   * Optimized to minimize database queries by fetching shared data once
   * and reusing it across all NPCs. Filters out test actors.
   *
   * @param options - Optional overrides for simulation mode
   * @param options.priceOverrides - Map of ticker -> price for causal simulation
   * @param options.recentEvents - Array of recent events (for causal simulation)
   * @returns Map of NPC ID to their market context
   *
   * @remarks
   * This method is optimized for batch processing. For single NPC context,
   * use buildContextForNPC() which is more efficient for individual lookups.
   *
   * @example
   * ```typescript
   * const contexts = await service.buildContextForAllNPCs();
   * const npcContext = contexts.get('npc-123');
   * ```
   */
  async buildContextForAllNPCs(options?: {
    priceOverrides?: Map<string, number>
    recentEvents?: EventContext[]
  }): Promise<Map<string, NPCMarketContext>> {
    const startTime = Date.now()

    // Simulation Mode Bypass
    if (isSimulationMode()) {
      const staticActors = StaticDataRegistry.getAllActors()

      // Filter out test actors
      const npcs = staticActors
        .filter((actor) => !actor.name.includes('Group Test') && !actor.isTest)
        .map((actor) => ({
          id: actor.id,
          name: actor.name,
          description: actor.description,
          domain: actor.domain,
          personality: actor.personality,
          tier: actor.tier,
          affiliations: actor.affiliations,
          postStyle: actor.postStyle,
          postExample: actor.postExample,
          tradingBalance: '100000', // Mock balance
          reputationPoints: 10000,
          hasPool: true,
        }))

      // In simulation mode, we skip DB queries for messages/relationships/positions
      // and provide empty/mock data instead
      const contexts = new Map<string, NPCMarketContext>()

      // Default prices - can be overridden by causal simulation
      const defaultPrices: Record<string, number> = {
        BTCAI: 120000,
        ETHAI: 4000,
        SOLAI: 200,
        TSLAI: 450,
        METAI: 520,
      }

      // Helper to get price (override or default)
      const getPrice = (ticker: string): number => {
        if (options?.priceOverrides?.has(ticker)) {
          const price = options.priceOverrides.get(ticker)
          if (price !== undefined) {
            return price
          }
        }
        return defaultPrices[ticker] ?? 100
      }

      // Build perp markets list based on available tickers
      const tickers = options?.priceOverrides
        ? Array.from(options.priceOverrides.keys())
        : Object.keys(defaultPrices)

      const perpMarkets: PerpMarketSnapshot[] = tickers.map((ticker) => {
        const price = getPrice(ticker)
        return {
          ticker,
          currentPrice: price,
          change24h: 0,
          changePercent24h: 0,
          name: ticker,
          organizationId: ticker.toLowerCase(),
          high24h: price * 1.01,
          low24h: price * 0.99,
          volume24h: 1000000,
          openInterest: 500000,
        }
      })

      const predictionMarkets: PredictionMarketSnapshot[] = [
        {
          id: 'q1',
          text: 'Will BitcAIn hit $150k?',
          yesPrice: 65,
          noPrice: 35,
          totalVolume: 50000,
          resolutionDate: new Date(Date.now() + 86400000).toISOString(),
          daysUntilResolution: 2,
        },
      ]

      // Use provided events or empty array
      const recentEvents = options?.recentEvents ?? []

      for (const npc of npcs) {
        contexts.set(npc.id, {
          npcId: npc.id,
          npcName: npc.name,
          personality: npc.personality || 'neutral trader',
          tier: npc.tier || 'B_TIER',
          availableBalance: 100000,
          relationships: [], // Empty for simulation
          recentPosts: [], // Empty for simulation
          groupChatMessages: [], // Empty for simulation
          recentEvents, // Use provided events (from causal simulation)
          perpMarkets,
          predictionMarkets,
          currentPositions: [], // Empty for simulation start
        })
      }

      return contexts
    }

    // Fetch all NPCs from static registry and state table
    // Filter out test actors (Group Test Alice, Bob, Charlie)
    const staticActors = StaticDataRegistry.getAllActors()
    const actorStatesRows = await db.select().from(actorState)
    const stateMap = new Map(
      actorStatesRows
        .filter((s): s is NonNullable<typeof s> => s != null)
        .map((s) => [
          String(s.id ?? ''),
          {
            tradingBalance: s.tradingBalance,
            reputationPoints: s.reputationPoints,
            hasPool: s.hasPool,
          },
        ]),
    )

    // Combine static and dynamic data, filter test actors
    const npcs = staticActors
      .filter((actor) => !actor.name.includes('Group Test') && !actor.isTest)
      .map((actor) => {
        const state = stateMap.get(actor.id)
        return {
          id: actor.id,
          name: actor.name,
          description: actor.description,
          domain: actor.domain,
          personality: actor.personality,
          tier: actor.tier,
          affiliations: actor.affiliations,
          postStyle: actor.postStyle,
          postExample: actor.postExample,
          tradingBalance: state?.tradingBalance ?? '10000',
          reputationPoints: state?.reputationPoints ?? 10000,
          hasPool: state?.hasPool ?? false,
        }
      })

    // Fetch shared data once (used by all NPCs)
    const [marketSnapshots, recentPosts, recentEvents] = await Promise.all([
      this.getMarketSnapshots(),
      this.getRecentFeed(),
      this.getRecentEvents(),
    ])

    // Extract signal analysis for active prediction markets (for better NPC trading)
    // This is internal context - never exposed to players
    const marketSignals = await this.extractMarketSignals(
      marketSnapshots.predictions,
    )

    // Get group chats with messages
    const groupChatsRows = await db
      .select({
        id: chats.id,
        name: chats.name,
      })
      .from(chats)
      .where(eq(chats.isGroup, true))

    const groupChats = groupChatsRows
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map((c) => ({
        id: String(c.id ?? ''),
        name: c.name != null ? String(c.name) : null,
      }))

    // Get messages for each group chat
    const chatIds = groupChats.map((c) => c.id)
    const messagesRows = await db
      .select()
      .from(messages)
      .where(inArray(messages.chatId, chatIds))
      .orderBy(desc(messages.createdAt))
      .limit(500) // Limit total messages

    type MappedMessage = {
      id: string
      chatId: string | null
      content: string | null
      createdAt: Date | null
      senderId: string | null
    }
    const groupChatMessages = new Map<string, MappedMessage[]>()

    // Group messages by chat with proper type coercion
    for (const msg of messagesRows) {
      if (!msg) continue
      const msgChatId = String(msg.chatId ?? '')
      const existing = groupChatMessages.get(msgChatId) ?? []
      if (existing.length < 50) {
        // Max 50 per chat
        const rawCreatedAt = msg.createdAt
        existing.push({
          id: String(msg.id ?? ''),
          chatId: msg.chatId != null ? String(msg.chatId) : null,
          content: msg.content != null ? String(msg.content) : null,
          createdAt:
            rawCreatedAt instanceof Date
              ? rawCreatedAt
              : rawCreatedAt
                ? new Date(String(rawCreatedAt))
                : null,
          senderId: msg.senderId != null ? String(msg.senderId) : null,
        })
        groupChatMessages.set(msgChatId, existing)
      }
    }

    // Fetch all relationships for all NPCs in one query
    const npcIds = npcs.map((npc) => npc.id)
    const allRelationshipsRows =
      npcIds.length > 0
        ? await db
            .select()
            .from(actorRelationships)
            .where(
              or(
                inArray(actorRelationships.actor1Id, npcIds),
                inArray(actorRelationships.actor2Id, npcIds),
              ),
            )
        : []

    // Map relationships with proper type coercion
    const allRelationships = allRelationshipsRows
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => {
        const rawLastInteraction = r.lastInteraction
        return {
          actor1Id: r.actor1Id != null ? String(r.actor1Id) : null,
          actor2Id: r.actor2Id != null ? String(r.actor2Id) : null,
          strength: r.strength != null ? Number(r.strength) : null,
          lastInteraction:
            rawLastInteraction instanceof Date
              ? rawLastInteraction
              : rawLastInteraction
                ? new Date(String(rawLastInteraction))
                : null,
          relationshipType:
            r.relationshipType != null ? String(r.relationshipType) : null,
          sentiment: r.sentiment != null ? Number(r.sentiment) : null,
          history: r.history != null ? String(r.history) : null,
        }
      })

    // Fetch all NPC positions in one query (poolId = actorId for backward compatibility)
    // DB select returns the shape matching select clause
    const allPositionsRows =
      npcIds.length > 0
        ? await db
            .select({
              id: poolPositions.id,
              poolId: poolPositions.poolId,
              marketType: poolPositions.marketType,
              ticker: poolPositions.ticker,
              marketId: poolPositions.marketId,
              side: poolPositions.side,
              entryPrice: poolPositions.entryPrice,
              currentPrice: poolPositions.currentPrice,
              size: poolPositions.size,
              shares: poolPositions.shares,
              unrealizedPnL: poolPositions.unrealizedPnL,
              openedAt: poolPositions.openedAt,
            })
            .from(poolPositions)
            .where(
              and(
                inArray(poolPositions.poolId, npcIds),
                isNull(poolPositions.closedAt),
              ),
            )
        : []

    // Map positions with proper type coercion
    const allPositions = allPositionsRows
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map((p) => {
        const rawOpenedAt = p.openedAt
        return {
          id: String(p.id ?? ''),
          poolId: p.poolId != null ? String(p.poolId) : null,
          marketType: p.marketType != null ? String(p.marketType) : null,
          ticker: p.ticker != null ? String(p.ticker) : null,
          marketId: p.marketId != null ? String(p.marketId) : null,
          side: p.side != null ? String(p.side) : null,
          entryPrice: p.entryPrice != null ? Number(p.entryPrice) : null,
          currentPrice: p.currentPrice != null ? Number(p.currentPrice) : null,
          size: p.size != null ? Number(p.size) : null,
          shares: p.shares != null ? Number(p.shares) : null,
          unrealizedPnL:
            p.unrealizedPnL != null ? Number(p.unrealizedPnL) : null,
          openedAt:
            rawOpenedAt instanceof Date
              ? rawOpenedAt
              : rawOpenedAt
                ? new Date(String(rawOpenedAt))
                : null,
        }
      })

    type PositionRow = (typeof allPositions)[number]

    // Group positions by NPC ID
    const positionsByNpc = new Map<string, PositionRow[]>()
    for (const position of allPositions) {
      if (!position.poolId) continue
      const existing = positionsByNpc.get(position.poolId) || []
      existing.push(position)
      positionsByNpc.set(position.poolId, existing)
    }

    // Build context for each NPC
    const contexts = new Map<string, NPCMarketContext>()

    for (const npc of npcs) {
      // Use actor's trading balance (no pools)
      const availableBalance = Number.parseFloat(npc.tradingBalance.toString())

      // Filter group chats this NPC is a member of (based on chat participants)
      const npcGroupChats: GroupChatContext[] = []
      for (const chat of groupChats) {
        const chatId = String(chat.id)
        const chatName = chat.name ? String(chat.name) : 'Group Chat'
        const chatMsgs = groupChatMessages.get(chatId) || []
        // Check if NPC has sent messages or chat name includes NPC name
        const isRelevant =
          chatMsgs.some((msg) => String(msg.senderId) === npc.id) ||
          chatName
            .toLowerCase()
            .includes(npc.name.toLowerCase().split(' ')[0] ?? '')

        if (isRelevant) {
          for (const msg of chatMsgs) {
            const msgCreatedAt = msg.createdAt
              ? new Date(String(msg.createdAt))
              : new Date()
            npcGroupChats.push({
              chatId,
              chatName,
              from: String(msg.senderId),
              fromName: String(msg.senderId),
              message: String(msg.content ?? ''),
              timestamp: msgCreatedAt.toISOString(),
            })
          }
        }
      }

      // Fetch positions for this NPC (poolId = actorId for backward compatibility)
      const npcPositions = positionsByNpc.get(npc.id) || []
      const currentPositions: NPCPosition[] = npcPositions.map((pos) => {
        const posOpenedAt = pos.openedAt
          ? new Date(String(pos.openedAt))
          : new Date()
        return {
          id: String(pos.id),
          marketType: toMarketType(String(pos.marketType)),
          ticker: pos.ticker ? String(pos.ticker) : undefined,
          marketId: pos.marketId ? String(pos.marketId) : undefined,
          side: String(pos.side),
          entryPrice: Number(pos.entryPrice),
          currentPrice: Number(pos.currentPrice),
          size: Number(pos.size),
          shares: pos.shares ? Number(pos.shares) : undefined,
          unrealizedPnL: Number(pos.unrealizedPnL),
          openedAt: posOpenedAt.toISOString(),
        }
      })

      // Get relationships for this NPC
      const npcRelationships: RelationshipContext[] = allRelationships
        .filter(
          (rel) =>
            String(rel.actor1Id) === npc.id || String(rel.actor2Id) === npc.id,
        )
        .map((rel) => {
          const relActor1Id = String(rel.actor1Id)
          const relActor2Id = String(rel.actor2Id)
          const isActor1 = relActor1Id === npc.id
          const otherActorId = isActor1 ? relActor2Id : relActor1Id

          return {
            actorId: otherActorId,
            actorName: otherActorId,
            relationshipType: rel.relationshipType
              ? String(rel.relationshipType)
              : 'acquaintance',
            sentiment: Number(rel.sentiment ?? 0),
            strength: Number(rel.strength ?? 0.5),
            history: rel.history ? String(rel.history) : undefined,
          }
        })

      contexts.set(npc.id, {
        npcId: npc.id,
        npcName: npc.name,
        personality: npc.personality || 'neutral trader',
        tier: npc.tier || 'B_TIER',
        availableBalance,
        relationships: npcRelationships,
        recentPosts,
        groupChatMessages: npcGroupChats,
        recentEvents,
        perpMarkets: marketSnapshots.perps,
        predictionMarkets: marketSnapshots.predictions,
        currentPositions,
        marketSignals, // Add signal analysis for better trading decisions
      })
    }

    const duration = Date.now() - startTime
    logger.info(
      `Built market context for ${contexts.size} NPCs in ${duration}ms`,
      {
        npcCount: contexts.size,
        durationMs: duration,
      },
      'MarketContextService',
    )

    return contexts
  }

  /**
   * Build context for a specific NPC with relationship data
   *
   * Fetches market data, feed posts, events, and relationships for a single NPC.
   * More efficient than buildContextForAllNPCs() for individual lookups.
   *
   * @param npcId - Unique identifier for the NPC
   * @returns Complete market context for the NPC
   * @throws Error if NPC not found
   *
   * @example
   * ```typescript
   * const context = await service.buildContextForNPC('npc-123');
   * console.log(`Balance: ${context.availableBalance}`);
   * console.log(`Markets: ${context.predictionMarkets.length}`);
   * ```
   */
  async buildContextForNPC(npcId: string): Promise<NPCMarketContext> {
    // Get static actor data from registry
    const staticNpc = StaticDataRegistry.getActor(npcId)
    if (!staticNpc) {
      throw new Error(`NPC not found: ${npcId}`)
    }

    // Get dynamic state from database
    const npcState = await getDbInstance().getActorState(npcId)

    // Combine static and dynamic data
    const npc = {
      ...staticNpc,
      tradingBalance: npcState?.tradingBalance ?? '10000',
      reputationPoints: npcState?.reputationPoints ?? 10000,
      hasPool: npcState?.hasPool ?? false,
    }

    const [marketSnapshots, recentPosts, recentEvents, groupChatMessages] =
      await Promise.all([
        this.getMarketSnapshots(),
        this.getRecentFeed(),
        this.getRecentEvents(),
        this.getInsiderInfo(npcId),
      ])

    // Extract signal analysis for prediction markets
    const marketSignals = await this.extractMarketSignals(
      marketSnapshots.predictions,
    )

    // Get relationships for this NPC
    const relationships = await this.getRelationshipsForNPC(npcId)

    // Use actor's trading balance (no pools)
    const availableBalance = Number.parseFloat(npc.tradingBalance.toString())

    // Fetch positions for this NPC (poolId = actorId for backward compatibility)
    type NpcPositionRow = {
      id: string
      marketType: string
      ticker: string | null
      marketId: string | null
      side: string
      entryPrice: string
      currentPrice: string
      size: string
      shares: string | null
      unrealizedPnL: string
      openedAt: Date
    }
    const npcPositions = (await db
      .select({
        id: poolPositions.id,
        marketType: poolPositions.marketType,
        ticker: poolPositions.ticker,
        marketId: poolPositions.marketId,
        side: poolPositions.side,
        entryPrice: poolPositions.entryPrice,
        currentPrice: poolPositions.currentPrice,
        size: poolPositions.size,
        shares: poolPositions.shares,
        unrealizedPnL: poolPositions.unrealizedPnL,
        openedAt: poolPositions.openedAt,
      })
      .from(poolPositions)
      .where(
        and(eq(poolPositions.poolId, npcId), isNull(poolPositions.closedAt)),
      )) as NpcPositionRow[]

    const currentPositions: NPCPosition[] = npcPositions.map((pos) => ({
      id: pos.id,
      marketType: toMarketType(pos.marketType),
      ticker: pos.ticker || undefined,
      marketId: pos.marketId || undefined,
      side: pos.side,
      entryPrice: Number.parseFloat(pos.entryPrice.toString()),
      currentPrice: Number.parseFloat(pos.currentPrice.toString()),
      size: Number.parseFloat(pos.size.toString()),
      shares: pos.shares ? Number.parseFloat(pos.shares.toString()) : undefined,
      unrealizedPnL: Number.parseFloat(pos.unrealizedPnL.toString()),
      openedAt: pos.openedAt.toISOString(),
    }))

    return {
      npcId: npc.id,
      npcName: npc.name,
      personality: npc.personality || 'neutral trader',
      tier: npc.tier || 'B_TIER',
      availableBalance,
      relationships,
      recentPosts,
      groupChatMessages,
      recentEvents,
      perpMarkets: marketSnapshots.perps,
      predictionMarkets: marketSnapshots.predictions,
      currentPositions,
      marketSignals, // Add signal analysis for better trading decisions
    }
  }

  /**
   * Get relationships for an NPC
   *
   * Retrieves all actor relationships where the NPC is involved,
   * regardless of event association.
   *
   * @param npcId - Unique identifier for the NPC
   * @returns Array of relationship contexts
   */
  private async getRelationshipsForNPC(
    npcId: string,
  ): Promise<RelationshipContext[]> {
    const relationshipsRows = await db
      .select()
      .from(actorRelationships)
      .where(
        or(
          eq(actorRelationships.actor1Id, npcId),
          eq(actorRelationships.actor2Id, npcId),
        ),
      )

    return relationshipsRows
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((rel) => {
        const relActor1Id = String(rel.actor1Id ?? '')
        const relActor2Id = String(rel.actor2Id ?? '')
        const isActor1 = relActor1Id === npcId
        const otherActorId = isActor1 ? relActor2Id : relActor1Id

        return {
          actorId: otherActorId,
          actorName: otherActorId,
          relationshipType: rel.relationshipType
            ? String(rel.relationshipType)
            : 'acquaintance',
          sentiment: Number(rel.sentiment ?? 0),
          strength: Number(rel.strength ?? 0.5),
          history: rel.history ? String(rel.history) : undefined,
        }
      })
  }

  /**
   * Get insider information from group chats this NPC is in
   *
   * Retrieves messages from group chats where the NPC is a member.
   * Messages are truncated and limited to prevent token overflow.
   *
   * @param npcId - Unique identifier for the NPC
   * @returns Array of group chat message contexts
   *
   * @remarks
   * - Limited to 20 messages per chat
   * - Messages truncated to 120 characters
   * - Only includes chats where NPC is a participant
   */
  private async getInsiderInfo(npcId: string): Promise<GroupChatContext[]> {
    // Get chats where NPC is a participant
    const participantRows = await db
      .select({ chatId: chatParticipants.chatId })
      .from(chatParticipants)
      .where(eq(chatParticipants.userId, npcId))

    const participantChatIds = participantRows
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map((p) => String(p.chatId ?? ''))
      .filter((id) => id.length > 0)

    if (participantChatIds.length === 0) {
      return []
    }

    const groupChatsRows = await db
      .select()
      .from(chats)
      .where(
        and(eq(chats.isGroup, true), inArray(chats.id, participantChatIds)),
      )

    const groupChats = groupChatsRows
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map((c) => ({
        id: String(c.id ?? ''),
        name: c.name != null ? String(c.name) : null,
      }))

    const result: GroupChatContext[] = []

    for (const chat of groupChats) {
      const insiderChatId = chat.id
      const insiderChatName = chat.name ?? 'Group Chat'

      const chatMessagesRows = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, insiderChatId))
        .orderBy(desc(messages.createdAt))
        .limit(20)

      const validMessages = chatMessagesRows
        .filter((m): m is NonNullable<typeof m> => m != null)
        .slice(0, 15)

      for (const msg of validMessages) {
        // Truncate long messages
        const maxMsgLength = 120
        const msgContent = String(msg.content ?? '')
        const message =
          msgContent.length > maxMsgLength
            ? `${msgContent.slice(0, maxMsgLength)}...`
            : msgContent

        const rawCreatedAt = msg.createdAt
        const msgCreatedAt =
          rawCreatedAt instanceof Date
            ? rawCreatedAt
            : rawCreatedAt
              ? new Date(String(rawCreatedAt))
              : new Date()

        result.push({
          chatId: insiderChatId,
          chatName: insiderChatName,
          from: String(msg.senderId ?? ''),
          fromName: String(msg.senderId ?? ''),
          message,
          timestamp: msgCreatedAt.toISOString(),
        })
      }
    }

    return result
  }

  /**
   * Get recent feed posts
   *
   * Retrieves the most recent feed posts, excluding deleted ones.
   * Content is truncated to limit token usage.
   *
   * @returns Array of feed post contexts
   *
   * @remarks
   * - Limited to 50 most recent posts
   * - Post content truncated to 200 characters
   * - Article titles truncated to 80 characters
   */
  private async getRecentFeed(): Promise<FeedPostContext[]> {
    const now = new Date()
    const postRows = await db
      .select()
      .from(posts)
      .where(and(isNull(posts.deletedAt), lte(posts.timestamp, now)))
      .orderBy(desc(posts.timestamp))
      .limit(50)

    return postRows
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map((post) => {
        // Truncate long posts to save tokens
        const maxContentLength = 200
        const postContent = String(post.content ?? '')
        const content =
          postContent.length > maxContentLength
            ? `${postContent.slice(0, maxContentLength)}...`
            : postContent

        const maxTitleLength = 80
        const postArticleTitle = post.articleTitle
          ? String(post.articleTitle)
          : ''
        const articleTitle =
          postArticleTitle.length > maxTitleLength
            ? `${postArticleTitle.slice(0, maxTitleLength)}...`
            : postArticleTitle

        const rawTimestamp = post.timestamp
        const postCreatedAt =
          rawTimestamp instanceof Date
            ? rawTimestamp
            : rawTimestamp
              ? new Date(String(rawTimestamp))
              : new Date()

        return {
          author: String(post.authorId ?? ''),
          authorName: String(post.authorId ?? ''),
          content,
          timestamp: postCreatedAt.toISOString(),
          articleTitle: articleTitle || undefined,
        }
      })
  }

  /**
   * Get recent events with actor involvement
   *
   * Retrieves recent world events, filtering to only include events
   * up to the current time to prevent future information leakage.
   *
   * @returns Array of event contexts
   *
   * @remarks
   * - Limited to 30 most recent events
   * - Event descriptions truncated to 150 characters
   * - Only includes events with timestamp <= now()
   */
  private async getRecentEvents(): Promise<EventContext[]> {
    const now = new Date()
    const eventRows = await db
      .select()
      .from(worldEvents)
      .where(lte(worldEvents.timestamp, now))
      .orderBy(desc(worldEvents.timestamp))
      .limit(30)

    return eventRows
      .filter((e): e is NonNullable<typeof e> => e != null)
      .map((event) => {
        // Truncate long descriptions
        const maxDescLength = 150
        const eventDescription = String(event.description ?? '')
        const description =
          eventDescription.length > maxDescLength
            ? `${eventDescription.slice(0, maxDescLength)}...`
            : eventDescription

        const rawTimestamp = event.timestamp
        const eventTimestamp =
          rawTimestamp instanceof Date
            ? rawTimestamp
            : rawTimestamp
              ? new Date(String(rawTimestamp))
              : new Date()

        return {
          type: String(event.eventType ?? ''),
          description,
          actors: toStringArrayOrUndefined(event.actors),
          timestamp: eventTimestamp.toISOString(),
          relatedQuestion: event.relatedQuestion
            ? Number(event.relatedQuestion)
            : undefined,
          pointsToward: event.pointsToward
            ? String(event.pointsToward)
            : undefined,
        }
      })
  }

  /**
   * Get events that involve a specific NPC
   *
   * Retrieves events where the NPC is listed in the actors array.
   * This is used to build personal context for NPC content generation.
   *
   * @param npcId - Unique identifier for the NPC
   * @param npcName - Name of the NPC (for name-based matching)
   * @returns Array of event contexts specific to this NPC
   */
  async getEventsForNPC(
    npcId: string,
    npcName: string,
  ): Promise<EventContext[]> {
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    // Get all recent events and filter by NPC involvement
    const eventRows = await db
      .select()
      .from(worldEvents)
      .where(
        and(
          lte(worldEvents.timestamp, now),
          gte(worldEvents.timestamp, threeDaysAgo),
        ),
      )
      .orderBy(desc(worldEvents.timestamp))
      .limit(100)

    // Map events with proper type coercion
    const eventList = eventRows
      .filter((e): e is NonNullable<typeof e> => e != null)
      .map((e) => ({
        id: String(e.id ?? ''),
        eventType: e.eventType != null ? String(e.eventType) : null,
        description: e.description != null ? String(e.description) : null,
        timestamp: e.timestamp,
        dayNumber: e.dayNumber != null ? Number(e.dayNumber) : null,
        actors: e.actors,
        relatedQuestion: e.relatedQuestion,
        pointsToward: e.pointsToward,
      }))

    // Filter events where NPC is in the actors array or mentioned in description
    const npcEvents = eventList.filter((event) => {
      const actorsArray = toStringArrayOrUndefined(event.actors) ?? []
      const eventDescription = String(event.description ?? '')
      const isInActors =
        actorsArray.includes(npcId) ||
        actorsArray.some(
          (a: string) =>
            a.toLowerCase().includes(npcName.toLowerCase()) ||
            npcName.toLowerCase().includes(a.toLowerCase()),
        )
      const isMentioned =
        eventDescription.toLowerCase().includes(npcName.toLowerCase()) ||
        eventDescription.includes(npcId)

      return isInActors || isMentioned
    })

    return npcEvents.slice(0, 15).map((event) => {
      const maxDescLength = 200
      const eventDescription = String(event.description ?? '')
      const description =
        eventDescription.length > maxDescLength
          ? `${eventDescription.slice(0, maxDescLength)}...`
          : eventDescription

      const eventTimestamp = event.timestamp
        ? new Date(String(event.timestamp))
        : new Date()

      return {
        type: String(event.eventType),
        description,
        actors: toStringArrayOrUndefined(event.actors),
        timestamp: eventTimestamp.toISOString(),
        relatedQuestion: event.relatedQuestion
          ? Number(event.relatedQuestion)
          : undefined,
        pointsToward: event.pointsToward
          ? String(event.pointsToward)
          : undefined,
      }
    })
  }

  /**
   * Get recent posts by a specific NPC
   *
   * Used to provide memory of what the NPC has previously posted,
   * preventing repetition and maintaining consistency.
   *
   * @param npcId - Unique identifier for the NPC
   * @returns Array of the NPC's recent posts
   */
  async getRecentPostsByNPC(npcId: string): Promise<FeedPostContext[]> {
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    const postRows = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.authorId, npcId),
          gte(posts.timestamp, threeDaysAgo),
          lte(posts.timestamp, now),
          isNull(posts.deletedAt),
        ),
      )
      .orderBy(desc(posts.timestamp))
      .limit(10)

    return postRows
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map((post) => {
        const maxContentLength = 200
        const postContent = String(post.content ?? '')
        const content =
          postContent.length > maxContentLength
            ? `${postContent.slice(0, maxContentLength)}...`
            : postContent

        const rawCreatedAt = post.createdAt
        const postCreatedAt =
          rawCreatedAt instanceof Date
            ? rawCreatedAt
            : rawCreatedAt
              ? new Date(String(rawCreatedAt))
              : new Date()

        return {
          author: String(post.authorId ?? ''),
          authorName: String(post.authorId ?? ''),
          content,
          timestamp: postCreatedAt.toISOString(),
          articleTitle: post.articleTitle
            ? String(post.articleTitle)
            : undefined,
        }
      })
  }

  /**
   * Get current market snapshots
   *
   * Retrieves snapshots of both perpetual and prediction markets.
   *
   * @returns MarketSnapshots with perps, predictions, and timestamp
   */
  private async getMarketSnapshots(): Promise<MarketSnapshots> {
    const [perps, predictions] = await Promise.all([
      this.getPerpMarketSnapshots(),
      this.getPredictionMarketSnapshots(),
    ])

    return {
      perps,
      predictions,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Get perpetual market snapshots
   *
   * Retrieves current state of all perpetual markets including:
   * - Current price and 24h price change
   * - High/low prices
   * - Volume and open interest
   *
   * @returns Array of perpetual market snapshots
   */
  private async getPerpMarketSnapshots(): Promise<PerpMarketSnapshot[]> {
    // Get static organization data and dynamic prices
    const staticOrgs = StaticDataRegistry.getAllOrganizations()
    const orgStates = await getDbInstance().getAllOrganizationStates()
    const priceMap = new Map<string, number | null>(
      orgStates.map((s): [string, number | null] => [
        s.id,
        s.currentPrice != null ? Number(s.currentPrice) : null,
      ]),
    )

    // Filter to companies with prices and combine static + dynamic data
    const companies = staticOrgs
      .filter((org) => org.type === 'company')
      .map((org) => {
        const dynamicPrice = priceMap.get(org.id)
        const price: number = dynamicPrice ?? org.initialPrice ?? 100
        return {
          id: org.id,
          name: org.name,
          ticker: org.ticker,
          currentPrice: price,
          initialPrice: org.initialPrice ?? 100,
        }
      })
      .filter(
        (c): c is typeof c & { currentPrice: number } => c.currentPrice > 0,
      )

    return Promise.all(
      companies.map(async (company) => {
        const currentPrice: number = company.currentPrice

        // Get 24h price history
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const priceHistoryRows = await db
          .select()
          .from(stockPrices)
          .where(
            and(
              eq(stockPrices.organizationId, company.id),
              gte(stockPrices.timestamp, oneDayAgo),
            ),
          )
          .orderBy(asc(stockPrices.timestamp))

        const priceHistory = priceHistoryRows
          .filter((p): p is NonNullable<typeof p> => p != null)
          .map((p) => ({ price: Number(p.price ?? 0) }))

        let change24h = 0
        let changePercent24h = 0
        let high24h = currentPrice
        let low24h = currentPrice

        if (priceHistory.length > 0) {
          const oldestPrice = priceHistory[0]?.price ?? 0
          change24h = currentPrice - oldestPrice
          changePercent24h =
            oldestPrice > 0 ? (change24h / oldestPrice) * 100 : 0

          const prices = priceHistory.map((p) => p.price)
          high24h = Math.max(...prices, currentPrice)
          low24h = Math.min(...prices, currentPrice)
        }

        // Get open interest from pool positions
        const positionsRows = await db
          .select({ size: poolPositions.size })
          .from(poolPositions)
          .where(
            and(
              eq(poolPositions.ticker, company.id),
              isNull(poolPositions.closedAt),
            ),
          )

        const positions = positionsRows
          .filter((p): p is NonNullable<typeof p> => p != null)
          .map((p) => ({ size: Number(p.size ?? 0) }))

        const openInterest = positions.reduce((sum, pos) => sum + pos.size, 0)
        const volume24h = positions.reduce((sum, pos) => sum + pos.size, 0)

        // Use ticker field if available, fallback to transformed org ID
        const ticker =
          company.ticker || company.id.toUpperCase().replace(/-/g, '')

        return {
          ticker,
          organizationId: company.id,
          name: company.name || 'Unknown',
          currentPrice,
          change24h,
          changePercent24h,
          high24h,
          low24h,
          volume24h,
          openInterest,
        }
      }),
    )
  }

  /**
   * Get prediction market snapshots
   *
   * Retrieves current state of active prediction markets.
   * Limited to top 15 most active markets to control token usage.
   *
   * @returns Array of prediction market snapshots
   *
   * @remarks
   * - Limited to 15 most active markets (by yesShares)
   * - Question text truncated to 120 characters
   * - Only includes unresolved markets with endDate >= now
   */
  private async getPredictionMarketSnapshots(): Promise<
    PredictionMarketSnapshot[]
  > {
    const marketRows = await db
      .select()
      .from(markets)
      .where(and(eq(markets.resolved, false), gte(markets.endDate, new Date())))
      .orderBy(desc(markets.yesShares))
      .limit(15)

    return marketRows
      .filter((m): m is NonNullable<typeof m> => m != null)
      .map((market) => {
        // DB returns typed columns - cast to expected types
        const marketId = String(market.id ?? '')
        const marketYesShares = String(market.yesShares ?? '0')
        const marketNoShares = String(market.noShares ?? '0')
        const rawEndDate = market.endDate
        const marketQuestion = String(market.question ?? '')

        const yesShares = Number.parseFloat(marketYesShares)
        const noShares = Number.parseFloat(marketNoShares)
        const totalShares = yesShares + noShares

        const yesPrice = totalShares > 0 ? (yesShares / totalShares) * 100 : 50
        const noPrice = totalShares > 0 ? (noShares / totalShares) * 100 : 50
        const totalVolume = totalShares * 0.5

        const now = new Date()
        const endDate =
          rawEndDate instanceof Date
            ? rawEndDate
            : rawEndDate
              ? new Date(String(rawEndDate))
              : now
        const resolutionDate = endDate.toISOString()
        const daysUntilResolution = Math.max(
          0,
          Math.ceil(
            (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
        )

        // Truncate long question text
        const maxQuestionLength = 120
        const text =
          marketQuestion.length > maxQuestionLength
            ? `${marketQuestion.slice(0, maxQuestionLength)}...`
            : marketQuestion

        return {
          id: marketId,
          text,
          yesPrice,
          noPrice,
          totalVolume,
          resolutionDate,
          daysUntilResolution,
        }
      })
  }

  /**
   * Extract signal analysis for prediction markets
   *
   * Uses SignalExtractionService to analyze feed content and determine
   * signal direction for each active market. This helps NPCs make
   * better-informed trading decisions.
   *
   * @internal This data is for NPC AI only - never expose to players
   * @param predictionMarkets - Active prediction markets to analyze
   * @returns Array of market signal contexts
   */
  private async extractMarketSignals(
    predictionMarkets: PredictionMarketSnapshot[],
  ): Promise<MarketSignalContext[]> {
    if (predictionMarkets.length === 0) {
      return []
    }

    const signals: MarketSignalContext[] = []

    // Extract signals for up to 5 active markets (limit to avoid overhead)
    const marketsToAnalyze = predictionMarkets.slice(0, 5)

    for (const market of marketsToAnalyze) {
      // Get question number from market ID for signal extraction
      // Market IDs are snowflake strings, need to lookup question number
      // Try to parse market ID as question number (some markets use question number as ID)
      const marketIdStr = String(market.id)
      const marketIdAsNumber = Number.parseInt(marketIdStr, 10)
      if (Number.isNaN(marketIdAsNumber)) continue

      try {
        const analysis =
          await SignalExtractionService.extractMarketSignal(marketIdAsNumber)

        signals.push({
          marketId: marketIdStr,
          yesSignal: analysis.yesSignal,
          noSignal: analysis.noSignal,
          netSignal: analysis.netSignal,
          strength: analysis.signalStrength,
          suggestedOutcome: analysis.suggestedOutcome,
          confidence: analysis.confidence,
        })

        logger.debug(
          'Extracted market signal',
          {
            marketId: market.id,
            suggestedOutcome: analysis.suggestedOutcome,
            confidence: `${(analysis.confidence * 100).toFixed(1)}%`,
          },
          'MarketContextService',
        )
      } catch (error) {
        // Signal extraction is optional - continue if it fails
        logger.debug(
          'Signal extraction failed for market (non-critical)',
          {
            marketId: market.id,
            error: error instanceof Error ? error.message : 'Unknown',
          },
          'MarketContextService',
        )
      }
    }

    return signals
  }
}
