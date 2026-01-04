/**
 * Database Service
 *
 * @description Wrapper for all database operations. Provides a clean interface
 * for interacting with the database, handling posts, questions, organizations,
 * stock prices, events, and actors. Includes game state management.
 *
 * @usage
 * ```typescript
 * import { getDbInstance } from '@babylon/db'
 * await getDbInstance().createPost({...})
 * const posts = await getDbInstance().getRecentPosts(100)
 * ```
 */

import { generateSnowflakeId, toNull } from '@jejunetwork/shared'
import type {
  ActorStateRow,
  JsonValue,
  OrganizationStateRow,
  Question,
} from './sqlit-schema-types'
import { db } from './index'
import { logger } from './logger'

/** Remove undefined values from object for JSON storage */
function toJsonValue(obj: Record<string, unknown>): JsonValue | null {
  const filtered = Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined),
  )
  return Object.keys(filtered).length > 0 ? (filtered as JsonValue) : null
}

/**
 * FeedPost type representing a post in the feed.
 */
export interface FeedPost {
  id: string
  content: string
  author: string
  timestamp: string
  type?: string
}

/**
 * Database Service Class
 *
 * @description Main service class for database operations. Provides methods
 * for game state, posts, questions, organizations, stock prices, events, and actors.
 * Singleton pattern ensures single instance across the application.
 */
class DatabaseService {
  /**
   * Direct access to the database client for custom queries.
   */
  get db() {
    return db
  }

  /**
   * Initialize game state in the database.
   * Creates a new continuous game if one doesn't exist.
   *
   * @returns The game instance (existing or newly created)
   */
  async initializeGame() {
    const existing = await db.game.findFirst({
      where: { isContinuous: true },
    })

    if (existing) {
      logger.info(`Game already initialized (${existing.id})`)
      return existing
    }

    const gameId = await generateSnowflakeId()
    const game = await db.game.create({
      data: {
        id: gameId,
        name: 'Continuous Game',
        type: 'continuous',
        status: 'active',
        isContinuous: true,
        isRunning: true,
        currentDay: 1,
        dayNumber: 1,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    logger.info(`Game initialized (${game.id})`)
    return game
  }

  /**
   * Get the current continuous game state.
   *
   * @returns The current game state or null if no game exists
   */
  async getGameState() {
    return db.game.findFirst({ where: { isContinuous: true } })
  }

  /**
   * Update game state with new values.
   *
   * @param data - Partial game state data to update
   * @returns The updated game state
   * @throws Error if game is not initialized
   */
  async updateGameState(data: {
    currentDay?: number | null
    dayNumber?: number | null
    isRunning?: boolean
    status?: string
  }) {
    const game = await this.getGameState()
    if (!game) throw new Error('Game not initialized')

    return db.game.update({
      where: { id: game.id },
      data: { ...data, updatedAt: new Date() },
    })
  }

  // ========== POSTS ==========

  /**
   * Create a new post in the database.
   *
   * @param post - Post data including id, content, author, timestamp, and optional game fields
   * @returns The created post record
   */
  async createPost(post: FeedPost & { gameId?: string; dayNumber?: number }) {
    return db.post.create({
      data: {
        id: post.id,
        content: post.content,
        authorId: post.author,
        timestamp: new Date(post.timestamp),
        metadata: toJsonValue({
          gameId: post.gameId,
          dayNumber: post.dayNumber,
        }),
      },
    })
  }

  /**
   * Create a post with all fields including article-specific fields.
   *
   * @param data - Complete post data including article fields
   * @returns The created post record
   */
  async createPostWithAllFields(data: {
    id: string
    type?: string
    content: string
    fullContent?: string
    articleTitle?: string
    byline?: string
    biasScore?: number
    sentiment?: string
    slant?: string
    category?: string
    imageUrl?: string
    authorId: string
    gameId?: string
    dayNumber?: number
    timestamp: Date
    commentOnPostId?: string
    parentCommentId?: string
    originalPostId?: string
  }) {
    const safeDayNumber =
      typeof data.dayNumber === 'number' &&
      Number.isFinite(data.dayNumber) &&
      data.dayNumber >= 0 &&
      data.dayNumber <= 2147483647
        ? data.dayNumber
        : undefined

    if (data.dayNumber !== undefined && safeDayNumber === undefined) {
      logger.warn('[Post] Invalid dayNumber value', {
        dayNumber: data.dayNumber,
        postId: data.id,
      })
    }

    return db.post.create({
      data: {
        id: data.id,
        content: data.content,
        authorId: data.authorId,
        timestamp: data.timestamp,
        parentPostId: toNull(data.commentOnPostId ?? data.parentCommentId),
        isReply: !!(data.commentOnPostId || data.parentCommentId),
        metadata: toJsonValue({
          type: data.type || 'post',
          fullContent: data.fullContent,
          articleTitle: data.articleTitle,
          byline: data.byline,
          biasScore: data.biasScore,
          sentiment: data.sentiment,
          slant: data.slant,
          category: data.category,
          imageUrl: data.imageUrl,
          gameId: data.gameId,
          dayNumber: safeDayNumber,
          originalPostId: data.originalPostId,
        }),
      },
    })
  }

  /**
   * Create multiple posts in a single batch operation.
   *
   * @param postsData - Array of post data objects
   * @returns Object with count of created posts
   */
  async createManyPosts(
    postsData: Array<FeedPost & { gameId?: string; dayNumber?: number }>,
  ) {
    if (postsData.length === 0) return { count: 0 }

    const values = postsData.map((post) => {
      const safeDayNumber =
        typeof post.dayNumber === 'number' &&
        Number.isFinite(post.dayNumber) &&
        post.dayNumber >= 0 &&
        post.dayNumber <= 2147483647
          ? post.dayNumber
          : undefined

      if (post.dayNumber !== undefined && safeDayNumber === undefined) {
        logger.warn('[Post] Invalid dayNumber value', {
          dayNumber: post.dayNumber,
          postId: post.id,
        })
      }

      return {
        id: post.id,
        content: post.content,
        authorId: post.author,
        gameId: post.gameId,
        dayNumber: safeDayNumber,
        timestamp: new Date(post.timestamp),
      }
    })

    await db.post.createMany({ data: values, skipDuplicates: true })

    return { count: postsData.length }
  }

  /**
   * Get recent posts with cursor-based or offset-based pagination.
   * Automatically filters out posts from test users.
   *
   * @param limit - Maximum number of posts to return (default: 100)
   * @param cursorOrOffset - Cursor string for cursor-based pagination or number for offset-based
   * @returns Array of recent posts
   */
  async getRecentPosts(limit = 100, cursorOrOffset?: string | number) {
    const isCursor = typeof cursorOrOffset === 'string'
    const cursor = isCursor ? cursorOrOffset : undefined
    const offset =
      !isCursor && typeof cursorOrOffset === 'number' ? cursorOrOffset : 0

    logger.debug('DatabaseService.getRecentPosts called', {
      limit,
      cursor,
      offset,
    })

    const now = new Date()

    const cursorDate = cursor ? new Date(cursor) : null
    const allPosts = await db.post.findMany({
      where: {
        deletedAt: null,
        timestamp: cursorDate ? { lt: cursorDate, lte: now } : { lte: now },
      },
      take: limit * 2,
      skip: cursor ? 0 : offset,
      orderBy: { timestamp: 'desc' },
    })

    const authorIds = [...new Set(allPosts.map((p) => p.authorId))]

    // Check users table for isTest flag
    const testUsers = await db.user.findMany({
      where: {
        id: { in: authorIds },
        isTest: true,
      },
    })

    // For actors, use ID pattern: test actors have IDs starting with 'test-'
    const testActorIds = authorIds.filter((id) => id.startsWith('test-'))

    const testAuthorIds = new Set([
      ...testUsers.map((u) => u.id),
      ...testActorIds,
    ])

    const filteredPosts = allPosts
      .filter((post) => !testAuthorIds.has(post.authorId))
      .slice(0, limit)

    logger.info('DatabaseService.getRecentPosts completed', {
      limit,
      cursor,
      offset,
      postCount: filteredPosts.length,
      filteredTestPosts: allPosts.length - filteredPosts.length,
      firstPostId: filteredPosts[0]?.id,
      lastPostId: filteredPosts[filteredPosts.length - 1]?.id,
    })

    return filteredPosts
  }

  /**
   * Get posts by a specific actor with cursor-based or offset-based pagination.
   * Returns empty array if the actor is a test user.
   *
   * @param authorId - ID of the actor/user whose posts to retrieve
   * @param limit - Maximum number of posts to return (default: 100)
   * @param cursorOrOffset - Cursor string or offset number for pagination
   * @returns Array of posts by the actor
   */
  async getPostsByActor(
    authorId: string,
    limit = 100,
    cursorOrOffset?: string | number,
  ) {
    const isCursor = typeof cursorOrOffset === 'string'
    const cursor = isCursor ? cursorOrOffset : undefined
    const offset =
      !isCursor && typeof cursorOrOffset === 'number' ? cursorOrOffset : 0

    logger.debug('DatabaseService.getPostsByActor called', {
      authorId,
      limit,
      cursor,
      offset,
    })

    // Check if it's a test user from users table or test actor by ID pattern
    const user = await db.user.findUnique({ where: { id: authorId } })

    // Test actors have IDs starting with 'test-'
    const isTestUser = Boolean(user?.isTest) || authorId.startsWith('test-')

    if (isTestUser) {
      logger.info('DatabaseService.getPostsByActor - test user filtered', {
        authorId,
        isTestUser: true,
      })
      return []
    }

    const now = new Date()

    const cursorDate = cursor ? new Date(cursor) : null
    const result = await db.post.findMany({
      where: {
        authorId,
        deletedAt: null,
        timestamp: cursorDate ? { lt: cursorDate, lte: now } : { lte: now },
      },
      take: limit,
      skip: cursor ? 0 : offset,
      orderBy: { timestamp: 'desc' },
    })

    logger.info('DatabaseService.getPostsByActor completed', {
      authorId,
      limit,
      cursor,
      offset,
      postCount: result.length,
    })

    return result
  }

  /**
   * Get the total count of all posts in the database.
   *
   * @returns Total number of posts
   */
  async getTotalPosts() {
    return db.post.count()
  }

  // ========== QUESTIONS ==========

  /**
   * Create a new question in the database.
   *
   * @param question - Question data including text, resolution date, and optional fields
   * @returns The created question record
   */
  async createQuestion(question: {
    text: string
    scenario?: number
    outcome?: boolean
    rank?: number
    createdDate?: string | Date
    resolutionDate: string | Date
    status?: string
    resolvedOutcome?: boolean
    questionNumber: number
    marketId?: string
  }) {
    return db.question.create({
      data: {
        id: await generateSnowflakeId(),
        marketId: question.marketId ?? '',
        question: question.text,
        text: question.text,
        type: 'binary',
        questionNumber: question.questionNumber,
        scenarioId: toNull(question.scenario?.toString()),
        createdDate: new Date(question.createdDate || new Date()),
        resolutionDate: new Date(question.resolutionDate),
        status: question.status || 'active',
        resolvedOutcome: toNull(question.resolvedOutcome?.toString()),
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Adapt database question to include computed fields like timeframe.
   */
  private adaptQuestion(dbQuestion: Question): Question & {
    scenario: number
    timeframe: string
  } {
    return {
      ...dbQuestion,
      scenario: dbQuestion.scenarioId ? parseInt(dbQuestion.scenarioId, 10) : 0,
      timeframe: dbQuestion.resolutionDate
        ? this.calculateTimeframe(dbQuestion.resolutionDate)
        : '30d+',
    }
  }

  /**
   * Calculate timeframe category (24h, 7d, 30d, 30d+) from resolution date.
   */
  private calculateTimeframe(resolutionDate: Date): string {
    const now = new Date()
    const msUntilResolution = resolutionDate.getTime() - now.getTime()
    const daysUntilResolution = Math.ceil(
      msUntilResolution / (1000 * 60 * 60 * 24),
    )

    if (daysUntilResolution <= 1) return '24h'
    if (daysUntilResolution <= 7) return '7d'
    if (daysUntilResolution <= 30) return '30d'
    return '30d+'
  }

  /**
   * Get active questions, optionally filtered by timeframe.
   *
   * @param timeframe - Optional timeframe filter: '24h', '7d', '30d', or '30d+'
   * @returns Array of active questions with computed fields
   */
  async getActiveQuestions(timeframe?: string) {
    const now = new Date()
    if (!timeframe) {
      const result = await db.question.findMany({
        where: { status: 'active' },
        orderBy: { createdDate: 'desc' },
      })
      return result.map((q) => this.adaptQuestion(q))
    }

    if (timeframe === '30d+') {
      const startDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const result = await db.question.findMany({
        where: { status: 'active', resolutionDate: { gte: startDate } },
        orderBy: { createdDate: 'desc' },
      })
      return result.map((q) => this.adaptQuestion(q))
    }

    const deltaMs =
      timeframe === '24h'
        ? 24 * 60 * 60 * 1000
        : timeframe === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : timeframe === '30d'
            ? 30 * 24 * 60 * 60 * 1000
            : null

    if (deltaMs === null) {
      const result = await db.question.findMany({
        where: { status: 'active' },
        orderBy: { createdDate: 'desc' },
      })
      return result.map((q) => this.adaptQuestion(q))
    }

    const endDate = new Date(now.getTime() + deltaMs)
    const result = await db.question.findMany({
      where: { status: 'active', resolutionDate: { gte: now, lte: endDate } },
      orderBy: { createdDate: 'desc' },
    })

    return result.map((q) => this.adaptQuestion(q))
  }

  /**
   * Get active questions that are ready to be resolved (resolutionDate <= now).
   *
   * @returns Array of questions ready for resolution
   */
  async getQuestionsToResolve() {
    const result = await db.question.findMany({
      where: {
        status: 'active',
        resolutionDate: { lte: new Date() },
      },
    })

    return result.map((q) => this.adaptQuestion(q))
  }

  /**
   * Get all questions including both active and resolved.
   *
   * @returns Array of all questions
   */
  async getAllQuestions() {
    const result = await db.question.findMany({
      orderBy: { createdDate: 'desc' },
    })

    return result.map((q) => this.adaptQuestion(q))
  }

  /**
   * Resolve a question with the specified outcome.
   *
   * @param id - Question ID to resolve
   * @param resolvedOutcome - The outcome (true/false) for the question
   * @returns The updated question record
   */
  async resolveQuestion(id: string, resolvedOutcome: boolean) {
    return db.question.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedOutcome: resolvedOutcome.toString(),
        updatedAt: new Date(),
      },
    })
  }

  // ========== ORGANIZATION STATE ==========

  /**
   * Upsert organization state (dynamic data only).
   * For static organization data (name, description, type, etc.),
   * use StaticDataRegistry from @babylon/engine.
   *
   * @param id - Organization ID
   * @param currentPrice - Current price value
   * @returns The created or updated organization state record
   */
  async upsertOrganizationState(
    id: string,
    currentPrice: number | null,
  ): Promise<OrganizationStateRow> {
    const now = new Date()
    const priceStr = currentPrice !== null ? currentPrice.toString() : null
    return db.organizationState.upsert({
      where: { id },
      create: {
        id,
        organizationId: id,
        currentPrice: priceStr,
        updatedAt: now,
      },
      update: {
        currentPrice: priceStr,
        updatedAt: now,
      },
    })
  }

  /**
   * Update an organization's current price.
   *
   * @param id - Organization ID
   * @param price - New price value
   * @returns The updated organization state record
   */
  async updateOrganizationPrice(
    id: string,
    price: number,
  ): Promise<OrganizationStateRow> {
    return this.upsertOrganizationState(id, price)
  }

  /**
   * Get organization state by ID.
   *
   * @param id - Organization ID
   * @returns The organization state or null if not found
   */
  async getOrganizationState(id: string): Promise<OrganizationStateRow | null> {
    return db.organizationState.findUnique({ where: { id } })
  }

  /**
   * Get all organization states.
   *
   * @returns Array of all organization state records
   */
  async getAllOrganizationStates(): Promise<OrganizationStateRow[]> {
    return db.organizationState.findMany()
  }

  /**
   * Get all organization states with current prices ordered by price.
   * This replaces the old getCompanies() method.
   *
   * @returns Array of organization states ordered by price descending
   */
  async getOrganizationsByPrice(): Promise<OrganizationStateRow[]> {
    return db.organizationState.findMany({
      orderBy: { currentPrice: 'desc' },
    })
  }

  // ========== STOCK PRICES ==========

  /**
   * Record a stock price update for an organization.
   *
   * @param organizationId - Organization ID
   * @param price - Current price
   * @param change - Price change amount
   * @param changePercent - Price change percentage
   * @returns The created price record
   */
  async recordPriceUpdate(
    organizationId: string,
    price: number,
    _change: number,
    _changePercent: number,
  ) {
    return db.stockPrice.create({
      data: {
        id: await generateSnowflakeId(),
        organizationId,
        price: price.toString(),
        timestamp: new Date(),
        isSnapshot: false,
      },
    })
  }

  /**
   * Record a daily end-of-day (EOD) price snapshot with OHLCV data.
   *
   * @param organizationId - Organization ID
   * @param data - OHLCV data (open, high, low, close, volume)
   * @returns The created snapshot record
   */
  async recordDailySnapshot(
    organizationId: string,
    data: {
      openPrice: number
      highPrice: number
      lowPrice: number
      closePrice: number
      volume: number
    },
  ) {
    return db.stockPrice.create({
      data: {
        id: await generateSnowflakeId(),
        organizationId,
        price: data.closePrice.toString(),
        timestamp: new Date(),
        isSnapshot: true,
        volume: data.volume.toString(),
      },
    })
  }

  /**
   * Get price history for an organization.
   *
   * @param organizationId - Organization ID
   * @param limit - Maximum number of records to return (default: 1440)
   * @returns Array of price records ordered by timestamp (newest first)
   */
  async getPriceHistory(organizationId: string, limit = 1440) {
    return db.stockPrice.findMany({
      where: { organizationId },
      take: limit,
      orderBy: { timestamp: 'desc' },
    })
  }

  /**
   * Get daily end-of-day price snapshots for an organization.
   *
   * @param organizationId - Organization ID
   * @param days - Number of days of snapshots to retrieve (default: 30)
   * @returns Array of daily snapshot records
   */
  async getDailySnapshots(organizationId: string, days = 30) {
    return db.stockPrice.findMany({
      where: { organizationId, isSnapshot: true },
      take: days,
      orderBy: { timestamp: 'desc' },
    })
  }

  // ========== EVENTS ==========

  /**
   * Create a world event in the database.
   *
   * @param event - Event data including type, description, actors, and visibility
   * @returns The created event record
   */
  async createEvent(event: {
    id: string
    eventType: string
    description:
      | string
      | { title?: string; text?: string; timestamp?: string; source?: string }
    actors: string[]
    relatedQuestion?: number
    pointsToward?: string
    visibility: string
    gameId?: string
    dayNumber?: number
  }) {
    let descriptionString: string
    if (typeof event.description === 'string') {
      descriptionString = event.description
    } else if (event.description && typeof event.description === 'object') {
      descriptionString =
        event.description.text ||
        event.description.title ||
        JSON.stringify(event.description)
    } else {
      descriptionString = String(event.description || '')
    }

    const safeRelatedQuestion =
      typeof event.relatedQuestion === 'number' &&
      Number.isFinite(event.relatedQuestion) &&
      event.relatedQuestion >= 0 &&
      event.relatedQuestion <= 2147483647
        ? event.relatedQuestion
        : undefined

    const safeDayNumber =
      typeof event.dayNumber === 'number' &&
      Number.isFinite(event.dayNumber) &&
      event.dayNumber >= 0 &&
      event.dayNumber <= 2147483647
        ? event.dayNumber
        : undefined

    if (
      event.relatedQuestion !== undefined &&
      safeRelatedQuestion === undefined
    ) {
      logger.warn('[WorldEvent] Invalid relatedQuestion value', {
        relatedQuestion: event.relatedQuestion,
        eventId: event.id,
      })
    }

    if (event.dayNumber !== undefined && safeDayNumber === undefined) {
      logger.warn('[WorldEvent] Invalid dayNumber value', {
        dayNumber: event.dayNumber,
        eventId: event.id,
      })
    }

    return db.worldEvent.create({
      data: {
        id: event.id,
        type: event.visibility || 'public',
        eventType: event.eventType,
        title:
          typeof event.description === 'object' && event.description?.title
            ? event.description.title
            : '',
        description: descriptionString,
        actors: event.actors,
        relatedQuestion: toNull(safeRelatedQuestion?.toString()),
        metadata: toJsonValue({
          pointsToward: event.pointsToward,
          visibility: event.visibility,
          gameId: event.gameId,
          dayNumber: safeDayNumber,
        }),
      },
    })
  }

  /**
   * Get recent world events ordered by timestamp.
   *
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of recent events
   */
  async getRecentEvents(limit = 100) {
    return db.worldEvent.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    })
  }

  // ========== ACTOR STATE ==========
  // For static actor data (name, description, tier, etc.), use StaticDataRegistry
  // from @babylon/engine. This table only stores dynamic runtime state.

  /**
   * Upsert actor state: create if it doesn't exist, update if it does.
   * For static actor data (name, tier, etc.), use StaticDataRegistry.getActor(id)
   *
   * @param state - Actor state with required id and optional dynamic fields
   * @returns The created or updated actor state record
   */
  async upsertActorState(state: {
    id: string
    tradingBalance?: number | string
    reputationPoints?: number
    hasPool?: boolean
  }): Promise<ActorStateRow> {
    const now = new Date()
    const update: Partial<ActorStateRow> = { updatedAt: now }

    if (state.tradingBalance !== undefined) {
      update.tradingBalance = String(state.tradingBalance)
    }
    if (state.reputationPoints !== undefined) {
      update.reputationPoints = state.reputationPoints
    }
    if (state.hasPool !== undefined) {
      update.hasPool = state.hasPool
    }

    return db.actorState.upsert({
      where: { id: state.id },
      create: {
        id: state.id,
        actorId: state.id,
        tradingBalance: String(state.tradingBalance ?? 10000),
        reputationPoints: state.reputationPoints ?? 10000,
        hasPool: state.hasPool ?? false,
        version: 1,
        updatedAt: now,
      },
      update,
    })
  }

  /**
   * Get all actor states.
   * For static actor data, use StaticDataRegistry.getAllActors()
   *
   * @returns Array of all actor state records
   */
  async getAllActorStates(): Promise<ActorStateRow[]> {
    return await db.actorState.findMany({})
  }

  /**
   * Get actor state by ID.
   * For static actor data, use StaticDataRegistry.getActor(id)
   *
   * @param id - Actor ID
   * @returns The actor state record or null if not found
   */
  async getActorState(id: string): Promise<ActorStateRow | null> {
    return await db.actorState.findUnique({ where: { id } })
  }

  // ========== UTILITY ==========

  /**
   * Get database statistics including counts and game state.
   *
   * @returns Object containing various database statistics
   */
  async getStats() {
    const [
      totalPosts,
      totalQuestions,
      activeQuestions,
      totalOrganizations,
      totalActors,
      gameState,
    ] = await Promise.all([
      db.post.count({}),
      db.question.count({}),
      db.question.count({ where: { status: 'active' } }),
      db.organizationState.count({}),
      db.actorState.count({}),
      this.getGameState(),
    ])

    return {
      totalPosts,
      totalQuestions,
      activeQuestions,
      totalOrganizations,
      totalActors,
      currentDay: gameState?.currentDay || 0,
      isRunning: gameState?.isRunning || false,
    }
  }

  /**
   * Get all games ordered by creation date (newest first).
   *
   * @returns Array of all game records
   */
  async getAllGames() {
    return await db.game.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }
}

// Singleton instance - ensure it's always available
let dbInstance: DatabaseService | null = null

export function getDbInstance(): DatabaseService {
  if (!dbInstance) {
    dbInstance = new DatabaseService()
  }
  return dbInstance
}

export { DatabaseService }
export default getDbInstance
