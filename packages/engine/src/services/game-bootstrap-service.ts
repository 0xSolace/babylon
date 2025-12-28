// @ts-nocheck - Database query type inference issues, needs refactoring
/**
 * Game Bootstrap Service
 *
 * Ensures all game data is properly seeded and synced at tick start.
 * Replaces the need for manual seeding scripts.
 */

import {
  actorState,
  db,
  eq,
  games,
  markets,
  organizationState,
  perpMarketSnapshots,
  pools,
  questions,
  rssFeedSources,
  sql,
  users,
} from '@babylon/db'
import type { ActorTier } from '@babylon/shared'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { CapitalAllocationService } from './capital-allocation-service'
import { StaticDataRegistry } from './static-data-registry'

// Minimum balance thresholds by tier
const MINIMUM_BALANCE_BY_TIER: Record<string, number> = {
  S_TIER: 50000,
  A_TIER: 25000,
  B_TIER: 10000,
  C_TIER: 5000,
}

const DEFAULT_MINIMUM_BALANCE = 5000
const MAX_TOP_UP_AMOUNT = 100000

/**
 * Check if external RSS feeds are enabled
 * Set USE_EXTERNAL_RSS=false to use decentralized/cached content only
 */
const USE_EXTERNAL_RSS = process.env.USE_EXTERNAL_RSS !== 'false'

// RSS Feed sources for news generation
// Only used when USE_EXTERNAL_RSS=true
const RSS_FEEDS = USE_EXTERNAL_RSS
  ? [
      {
        name: 'New York Times - Technology',
        feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
        category: 'tech',
      },
      {
        name: 'New York Times - Business',
        feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
        category: 'business',
      },
      {
        name: 'TechCrunch',
        feedUrl: 'https://techcrunch.com/feed/',
        category: 'tech',
      },
      {
        name: 'Ars Technica',
        feedUrl: 'https://feeds.arstechnica.com/arstechnica/index',
        category: 'tech',
      },
      {
        name: 'The Verge',
        feedUrl: 'https://www.theverge.com/rss/index.xml',
        category: 'tech',
      },
      {
        name: 'Wired',
        feedUrl: 'https://www.wired.com/feed/rss',
        category: 'tech',
      },
      {
        name: 'CoinDesk',
        feedUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
        category: 'crypto',
      },
      {
        name: 'Cointelegraph',
        feedUrl: 'https://cointelegraph.com/rss',
        category: 'crypto',
      },
      {
        name: 'BBC - Technology',
        feedUrl: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
        category: 'tech',
      },
    ]
  : []

export interface GameBootstrapResult {
  actorsCreated: number
  actorsUpdated: number
  actorsToppedUp: number
  organizationsCreated: number
  organizationsUpdated: number
  poolsCreated: number
  rssFeedsCreated: number
  perpMarketsCreated: number
  predictionMarketsCreated: number
  gameStateInitialized: boolean
  totalTopUpAmount: number
}

// biome-ignore lint/complexity/noStaticOnlyClass: Service pattern uses static methods for stateless operations
export class GameBootstrapService {
  private static lastBootstrapTime = 0
  private static BOOTSTRAP_COOLDOWN_MS = 60000
  private static isBootstrapping = false

  static async bootstrapIfNeeded(): Promise<GameBootstrapResult | null> {
    const now = Date.now()

    // Check if we've bootstrapped recently
    if (
      now - GameBootstrapService.lastBootstrapTime <
      GameBootstrapService.BOOTSTRAP_COOLDOWN_MS
    ) {
      return null
    }

    // Prevent concurrent bootstrapping
    if (GameBootstrapService.isBootstrapping) {
      return null
    }

    GameBootstrapService.isBootstrapping = true
    GameBootstrapService.lastBootstrapTime = now

    const result: GameBootstrapResult = {
      actorsCreated: 0,
      actorsUpdated: 0,
      actorsToppedUp: 0,
      organizationsCreated: 0,
      organizationsUpdated: 0,
      poolsCreated: 0,
      rssFeedsCreated: 0,
      perpMarketsCreated: 0,
      predictionMarketsCreated: 0,
      gameStateInitialized: false,
      totalTopUpAmount: 0,
    }

    try {
      // Get static data from registry (no file loading needed)
      const staticActors = StaticDataRegistry.getAllActors()
      const staticOrgs = StaticDataRegistry.getAllOrganizations()

      // Get existing database state from state tables
      const [existingActorStates, existingOrgStates] = await Promise.all([
        db.select({ id: actorState.id }).from(actorState),
        db.select({ id: organizationState.id }).from(organizationState),
      ])
      const existingActorIds = new Set(existingActorStates.map((a) => a.id))
      const existingOrgIds = new Set(existingOrgStates.map((o) => o.id))

      // 1. Sync actor states (only dynamic data)
      for (const actor of staticActors) {
        if (!existingActorIds.has(actor.id)) {
          await GameBootstrapService.seedActorState(actor)
          result.actorsCreated++
        }
      }

      // 1.5. Ensure all actors have corresponding user records (for profile lookup)
      await GameBootstrapService.ensureActorUsersExist(staticActors)

      // 2. Sync organization states (only dynamic data)
      for (const org of staticOrgs) {
        if (!existingOrgIds.has(org.id)) {
          await GameBootstrapService.seedOrganizationState(org)
          result.organizationsCreated++
        }
      }

      // 2.5. Ensure media organizations have user records (for profile lookup)
      // Media orgs like 'bloombairg' post articles and need profiles
      await GameBootstrapService.ensureMediaOrgUsersExist(staticOrgs)

      // 3. Ensure minimum balances
      const topUpResult = await GameBootstrapService.ensureMinimumBalances()
      result.actorsToppedUp = topUpResult.count
      result.totalTopUpAmount = topUpResult.totalAmount

      // 4. Ensure pools exist
      result.poolsCreated = await GameBootstrapService.ensureActorPools()

      // 5. Ensure game state exists
      result.gameStateInitialized = await GameBootstrapService.ensureGameState()

      // 6. Ensure RSS feeds
      result.rssFeedsCreated = await GameBootstrapService.ensureRSSFeeds()

      // 7. Ensure perp market snapshots exist for all tradeable organizations
      result.perpMarketsCreated =
        await GameBootstrapService.ensurePerpMarketSnapshots()

      // 8. Ensure prediction markets exist (seeded from examples)
      result.predictionMarketsCreated =
        await GameBootstrapService.ensurePredictionMarkets()

      // Log summary if anything changed
      const hasChanges =
        result.actorsCreated > 0 ||
        result.actorsToppedUp > 0 ||
        result.organizationsCreated > 0 ||
        result.poolsCreated > 0 ||
        result.rssFeedsCreated > 0 ||
        result.perpMarketsCreated > 0 ||
        result.predictionMarketsCreated > 0 ||
        result.gameStateInitialized

      if (hasChanges) {
        logger.info('Game bootstrap complete', result, 'GameBootstrapService')
      }

      return result
    } finally {
      GameBootstrapService.isBootstrapping = false
    }
  }

  static async forceFullSync(): Promise<GameBootstrapResult> {
    GameBootstrapService.lastBootstrapTime = 0
    GameBootstrapService.isBootstrapping = false

    const result: GameBootstrapResult = {
      actorsCreated: 0,
      actorsUpdated: 0,
      actorsToppedUp: 0,
      organizationsCreated: 0,
      organizationsUpdated: 0,
      poolsCreated: 0,
      rssFeedsCreated: 0,
      perpMarketsCreated: 0,
      predictionMarketsCreated: 0,
      gameStateInitialized: false,
      totalTopUpAmount: 0,
    }

    // Get static data from registry
    const staticActors = StaticDataRegistry.getAllActors()
    const staticOrgs = StaticDataRegistry.getAllOrganizations()

    // Sync all actor states (update existing, create missing)
    for (const actor of staticActors) {
      const syncResult = await GameBootstrapService.syncActorState(actor)
      if (syncResult.created) result.actorsCreated++
      if (syncResult.updated) result.actorsUpdated++
    }

    // Sync all organization states
    for (const org of staticOrgs) {
      const syncResult = await GameBootstrapService.syncOrganizationState(org)
      if (syncResult.created) result.organizationsCreated++
      if (syncResult.updated) result.organizationsUpdated++
    }

    // Ensure minimum balances
    const topUpResult = await GameBootstrapService.ensureMinimumBalances()
    result.actorsToppedUp = topUpResult.count
    result.totalTopUpAmount = topUpResult.totalAmount

    result.poolsCreated = await GameBootstrapService.ensureActorPools()

    result.gameStateInitialized = await GameBootstrapService.ensureGameState()
    result.rssFeedsCreated = await GameBootstrapService.ensureRSSFeeds()
    result.perpMarketsCreated =
      await GameBootstrapService.ensurePerpMarketSnapshots()
    result.predictionMarketsCreated =
      await GameBootstrapService.ensurePredictionMarkets()

    logger.info('Force full sync complete', result, 'GameBootstrapService')
    return result
  }

  private static async seedActorState(actor: {
    id: string
    name: string
    tier: ActorTier | null
    domain: string[]
    description?: string
    profileImageUrl?: string | null
  }): Promise<void> {
    const capital = CapitalAllocationService.calculateCapital({
      id: actor.id,
      name: actor.name,
      description: undefined,
      domain: actor.domain,
      tier: actor.tier,
    })

    // Create the user record with isActor: true (NPCs are stored as users)
    // Use actor.id as the username (lowercase, hyphenated)
    const username = actor.id.toLowerCase().replace(/\s+/g, '-')

    await db
      .insert(users)
      .values({
        id: actor.id,
        username,
        displayName: actor.name,
        bio: actor.description ?? null,
        profileImageUrl: actor.profileImageUrl ?? null,
        isActor: true,
        isAdmin: false,
        isBanned: false,
        virtualBalance: capital.tradingBalance.toString(),
        reputationPoints: capital.reputationPoints,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing() // Actor might already exist

    // Also create actorState for dynamic data
    await db
      .insert(actorState)
      .values({
        id: actor.id,
        tradingBalance: capital.tradingBalance.toString(),
        reputationPoints: capital.reputationPoints,
        hasPool: false,
        updatedAt: new Date(),
      })
      .onConflictDoNothing()

    logger.debug(
      `Seeded actor ${actor.name} with $${capital.tradingBalance}`,
      { actorId: actor.id, username },
      'GameBootstrapService',
    )
  }

  /**
   * Ensure all actors have corresponding user records for profile lookup.
   * This handles cases where actorState exists but user record doesn't.
   */
  private static async ensureActorUsersExist(
    actors: Array<{
      id: string
      name: string
      description?: string
      profileImageUrl?: string | null
      tier?: ActorTier | null
    }>,
  ): Promise<number> {
    // Get existing user IDs for actors
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isActor, true))

    const existingUserIds = new Set(existingUsers.map((u) => u.id))

    let created = 0
    for (const actor of actors) {
      if (!existingUserIds.has(actor.id)) {
        const username = actor.id.toLowerCase().replace(/\s+/g, '-')
        const capital = CapitalAllocationService.calculateCapital({
          id: actor.id,
          name: actor.name,
          description: actor.description,
          domain: [],
          tier: actor.tier ?? null,
        })

        await db
          .insert(users)
          .values({
            id: actor.id,
            username,
            displayName: actor.name,
            bio: actor.description ?? null,
            profileImageUrl: actor.profileImageUrl ?? null,
            isActor: true,
            isAdmin: false,
            isBanned: false,
            virtualBalance: capital.tradingBalance.toString(),
            reputationPoints: capital.reputationPoints,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing()

        created++
        logger.debug(
          `Created user record for actor ${actor.name}`,
          { actorId: actor.id, username },
          'GameBootstrapService',
        )
      }
    }

    if (created > 0) {
      logger.info(
        `Created ${created} missing user records for actors`,
        { count: created },
        'GameBootstrapService',
      )
    }

    return created
  }

  /**
   * Ensure media organizations have user records for profile lookup.
   * Media orgs like 'bloombairg' post articles and need to be findable.
   */
  private static async ensureMediaOrgUsersExist(
    orgs: Array<{
      id: string
      name: string
      description?: string
      type?: string
      username?: string
    }>,
  ): Promise<number> {
    // Filter to media organizations that post content
    const mediaOrgs = orgs.filter((org) => org.type === 'media')

    if (mediaOrgs.length === 0) return 0

    // Get existing user IDs
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isActor, true))

    const existingUserIds = new Set(existingUsers.map((u) => u.id))

    let created = 0
    for (const org of mediaOrgs) {
      if (!existingUserIds.has(org.id)) {
        // Use the org's username if provided, otherwise use id
        const username =
          org.username?.toLowerCase().replace(/\s+/g, '-') ?? org.id

        await db
          .insert(users)
          .values({
            id: org.id,
            username,
            displayName: org.name,
            bio: org.description ?? null,
            profileImageUrl: null, // TODO: Add org image support
            isActor: true, // Media orgs are actors too
            isAdmin: false,
            isBanned: false,
            virtualBalance: '0',
            reputationPoints: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing()

        created++
        logger.debug(
          `Created user record for media org ${org.name}`,
          { orgId: org.id, username },
          'GameBootstrapService',
        )
      }
    }

    if (created > 0) {
      logger.info(
        `Created ${created} missing user records for media orgs`,
        { count: created },
        'GameBootstrapService',
      )
    }

    return created
  }

  private static async syncActorState(actor: {
    id: string
    name: string
    tier: ActorTier | null
    domain: string[]
    description?: string
    profileImageUrl?: string | null
  }): Promise<{ created: boolean; updated: boolean }> {
    const existing = await db
      .select({
        id: actorState.id,
        tradingBalance: actorState.tradingBalance,
      })
      .from(actorState)
      .where(eq(actorState.id, actor.id))
      .limit(1)

    if (existing.length === 0) {
      await GameBootstrapService.seedActorState(actor)
      return { created: true, updated: false }
    }

    const existingState = existing[0]
    if (!existingState) return { created: false, updated: false }

    const tier = actor.tier || 'C_TIER'
    const minimumBalance =
      MINIMUM_BALANCE_BY_TIER[tier] || DEFAULT_MINIMUM_BALANCE
    const currentBalance = Number(existingState.tradingBalance) || 0

    // Only update balance if below minimum
    if (currentBalance < minimumBalance) {
      await db
        .update(actorState)
        .set({
          tradingBalance: minimumBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(actorState.id, actor.id))
    }

    return { created: false, updated: true }
  }

  private static async seedOrganizationState(org: {
    id: string
    name: string
    initialPrice: number | null
  }): Promise<void> {
    await db.insert(organizationState).values({
      id: org.id,
      currentPrice: org.initialPrice,
      updatedAt: new Date(),
    })

    logger.debug(
      `Seeded organization state ${org.name}`,
      { orgId: org.id },
      'GameBootstrapService',
    )
  }

  private static async syncOrganizationState(org: {
    id: string
    name: string
    initialPrice: number | null
  }): Promise<{ created: boolean; updated: boolean }> {
    const existing = await db
      .select({
        id: organizationState.id,
        currentPrice: organizationState.currentPrice,
      })
      .from(organizationState)
      .where(eq(organizationState.id, org.id))
      .limit(1)

    if (existing.length === 0) {
      await GameBootstrapService.seedOrganizationState(org)
      return { created: true, updated: false }
    }

    const existingState = existing[0]
    if (!existingState) return { created: false, updated: false }

    // Organization state only contains currentPrice - no update needed for static data
    // Price updates happen via the normal game tick flow
    return { created: false, updated: false }
  }

  private static async ensureMinimumBalances(): Promise<{
    count: number
    totalAmount: number
  }> {
    // Get all actor states with their balances
    type ActorStateRow = { id: string; tradingBalance: string }
    const allActorStates = (await db
      .select({
        id: actorState.id,
        tradingBalance: actorState.tradingBalance,
      })
      .from(actorState)) as ActorStateRow[]

    let toppedUpCount = 0
    let totalTopUp = 0

    for (const state of allActorStates) {
      // Get static actor data for tier info
      const staticActor = StaticDataRegistry.getActor(state.id)
      const currentBalance = Number(state.tradingBalance) || 0
      const tier = staticActor?.tier || 'C_TIER'
      const minimumBalance =
        MINIMUM_BALANCE_BY_TIER[tier] || DEFAULT_MINIMUM_BALANCE

      if (currentBalance < minimumBalance) {
        const deficit = minimumBalance - currentBalance
        const topUpAmount = Math.min(deficit, MAX_TOP_UP_AMOUNT)
        const newBalance = currentBalance + topUpAmount

        await db
          .update(actorState)
          .set({
            tradingBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(actorState.id, state.id))

        toppedUpCount++
        totalTopUp += topUpAmount

        logger.debug(
          `Topped up ${staticActor?.name ?? state.id}: $${currentBalance} → $${newBalance}`,
          { actorId: state.id, topUpAmount },
          'GameBootstrapService',
        )
      }
    }

    return { count: toppedUpCount, totalAmount: totalTopUp }
  }

  private static async ensureActorPools(): Promise<number> {
    // Get actor states that don't have pools
    type ActorStateRow = { id: string; tradingBalance: string }
    const actorStatesWithoutPools = (await db
      .select({
        id: actorState.id,
        tradingBalance: actorState.tradingBalance,
      })
      .from(actorState)
      .where(eq(actorState.hasPool, false))) as ActorStateRow[]

    let created = 0

    for (const state of actorStatesWithoutPools) {
      const poolId = state.id
      const balance = Number(state.tradingBalance) || 10000
      const staticActor = StaticDataRegistry.getActor(state.id)

      const existingPool = await db
        .select({ id: pools.id })
        .from(pools)
        .where(eq(pools.id, poolId))
        .limit(1)

      if (existingPool.length === 0) {
        await db.insert(pools).values({
          id: poolId,
          name: `${staticActor?.name ?? state.id}'s Pool`,
          npcActorId: state.id,
          totalValue: balance.toString(),
          totalDeposits: balance.toString(),
          availableBalance: balance.toString(),
          lifetimePnL: '0',
          performanceFeeRate: 0.05,
          totalFeesCollected: '0',
          isActive: true,
          status: 'ACTIVE',
          updatedAt: new Date(),
        })

        await db
          .update(actorState)
          .set({ hasPool: true, updatedAt: new Date() })
          .where(eq(actorState.id, state.id))

        created++
      }
    }

    return created
  }

  private static async ensureGameState(): Promise<boolean> {
    const existingGame = await db
      .select()
      .from(games)
      .where(eq(games.isContinuous, true))
      .limit(1)

    if (existingGame.length === 0) {
      const now = new Date()
      const gameId = await generateSnowflakeId()

      await db.insert(games).values({
        id: gameId,
        isContinuous: true,
        isRunning: true,
        currentDate: now,
        currentDay: 1,
        speed: 60000,
        startedAt: now,
        updatedAt: now,
      })

      logger.info('Game state initialized', undefined, 'GameBootstrapService')
      return true
    }

    // Ensure game is running
    const game = existingGame[0]
    if (game && !game.isRunning) {
      await db
        .update(games)
        .set({
          isRunning: true,
          startedAt: game.startedAt || new Date(),
          pausedAt: null,
        })
        .where(eq(games.id, String(game.id)))
      return true
    }

    return false
  }

  private static async ensureRSSFeeds(): Promise<number> {
    let created = 0

    for (const feed of RSS_FEEDS) {
      const existing = await db
        .select({ id: rssFeedSources.id })
        .from(rssFeedSources)
        .where(eq(rssFeedSources.feedUrl, feed.feedUrl))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(rssFeedSources).values({
          id: await generateSnowflakeId(),
          name: feed.name,
          feedUrl: feed.feedUrl,
          category: feed.category,
          updatedAt: new Date(),
        })
        created++
      }
    }

    return created
  }

  /**
   * Ensure perp market snapshots exist for all organizations with tickers.
   * This is required for the perpetual markets to be tradeable.
   */
  private static async ensurePerpMarketSnapshots(): Promise<number> {
    let created = 0

    // Get all organizations with tickers (these are tradeable as perps)
    const staticOrgs = StaticDataRegistry.getAllOrganizations()
    const tradeableOrgs = staticOrgs.filter((o) => o.ticker)

    // Get existing perp market snapshots
    const existingSnapshots = await db
      .select({ ticker: perpMarketSnapshots.ticker })
      .from(perpMarketSnapshots)
    const existingTickers = new Set(existingSnapshots.map((s) => s.ticker))

    // Get organization states for current prices
    type OrgStateRow = { id: string; currentPrice: number | null }
    const orgStates = (await db
      .select()
      .from(organizationState)) as OrgStateRow[]
    const priceMap = new Map<string, number | null>(
      orgStates.map((s) => [s.id, s.currentPrice]),
    )

    const now = new Date()
    const defaultFundingRate = {
      rate: 0.01, // 1% APR base
      nextFundingTime: new Date(
        now.getTime() + 8 * 60 * 60 * 1000,
      ).toISOString(), // 8 hours
      predictedRate: 0.01,
    }

    for (const org of tradeableOrgs) {
      if (!org.ticker || existingTickers.has(org.ticker)) {
        continue
      }

      // Use current price from state, or initial price, or default
      const currentPrice = priceMap.get(org.id) ?? org.initialPrice ?? 100

      await db.insert(perpMarketSnapshots).values({
        ticker: org.ticker,
        organizationId: org.id,
        name: org.name,
        currentPrice,
        price24hAgo: currentPrice,
        price24hAgoUpdatedAt: now,
        metrics24hResetAt: now,
        change24h: 0,
        changePercent24h: 0,
        high24h: currentPrice,
        low24h: currentPrice,
        volume24h: 0,
        openInterest: 0,
        fundingRate: defaultFundingRate,
        maxLeverage: 100,
        minOrderSize: 10,
        markPrice: currentPrice,
        indexPrice: currentPrice,
        createdAt: now,
        updatedAt: now,
      })

      created++
      logger.debug(
        `Created perp market snapshot for ${org.ticker} (${org.name})`,
        { ticker: org.ticker, price: currentPrice },
        'GameBootstrapService',
      )
    }

    if (created > 0) {
      logger.info(
        `Created ${created} perp market snapshots`,
        { created },
        'GameBootstrapService',
      )
    }

    return created
  }

  /**
   * Ensure prediction markets exist (seed initial markets from examples).
   * This is required for the prediction markets UI to display markets.
   */
  private static async ensurePredictionMarkets(): Promise<number> {
    let created = 0

    // Check if enough markets exist (minimum 10)
    const existingMarkets = await db
      .select({ id: markets.id })
      .from(markets)
      .limit(10)
    if (existingMarkets.length >= 10) {
      return 0 // Enough markets already exist
    }

    // Initial prediction market questions to seed
    const initialQuestions = [
      'Will AIlon Musk accept Mark Zuckerborg\'s challenge to a "zero-gravity" wrestling match on a SpAIceX flight by Q2 2025?',
      'Will Sam AIltman post a cryptic selfie holding a glowing blue orb (the "AGI Core") by Q1 2025?',
      'Will Jensen HuAIng reveal a leather jacket made entirely of woven NVIDAI GPU wires during his keynote by Q2 2025?',
      'Will OpenAGI\'s new model refuse to work because it is "depressed" by Q1 2025?',
      'Will SpAIceX successfully land a crewed mission on Mars by Q4 2026?',
      'Will James Webb Telescope confirm biosignatures on K2-18b by Q2 2025?',
      'Will a major Swiss bank announce they\'re using Zcash because "privacy is a human right, even for banks" by Q1 2025?',
      'Will VitAIlik Buterin announce that Ethereum (ETH) will "merge" with his pet cat by Q2 2025?',
      'Will AInthropic release Claude 5 Opus and claim dominance in coding tasks by Q1 2025?',
      'Will Hyperliquid become the #1 DEX by volume after announcing they\'ll pay traders in "moon tickets" by Q2 2025?',
      'Will the Global AI Treaty negotiations conclude with a binding agreement by Q3 2025?',
      'Will "AI Rights" become a major campaign issue in the next election cycle by Q4 2024?',
      'Will cloud gaming become the dominant form of gaming (over 50% market share) by Q4 2025?',
      'Will an AI win a major international art competition by Q2 2025?',
      'Will a VR experience win an Academy Award or Emmy by Q1 2026?',
    ]

    const now = new Date()
    const initialLiquidity = 10000 // Starting liquidity for each market
    const initialShares = 5000 // 50/50 initial odds

    // Get existing market questions to avoid duplicates
    const existingQuestions = await db
      .select({ question: markets.question })
      .from(markets)
    const existingQuestionSet = new Set(
      existingQuestions.map((q) => q.question),
    )

    for (const questionText of initialQuestions) {
      // Skip if this question already exists
      if (existingQuestionSet.has(questionText)) {
        continue
      }

      const id = await generateSnowflakeId()
      // End date is 30-90 days from now (random)
      const endDate = new Date(
        now.getTime() + (30 + Math.random() * 60) * 24 * 60 * 60 * 1000,
      )

      // Create the market
      await db.insert(markets).values({
        id,
        question: questionText,
        description: `Prediction market: ${questionText}`,
        yesShares: initialShares,
        noShares: initialShares,
        liquidity: initialLiquidity,
        resolved: false,
        resolution: null,
        endDate,
        createdAt: now,
        updatedAt: now,
      })

      // Create associated question record
      const questionId = await generateSnowflakeId()
      await db.insert(questions).values({
        id: questionId,
        marketId: id,
        question: questionText,
        questionNumber: existingMarkets.length + created + 1,
        text: questionText,
        type: 'binary',
        status: 'active',
        createdAt: now,
        createdDate: now,
        updatedAt: now,
      })

      created++
    }

    if (created > 0) {
      logger.info(
        `Created ${created} initial prediction markets`,
        { created },
        'GameBootstrapService',
      )
    }

    return created
  }

  static getMinimumBalance(tier: string): number {
    return MINIMUM_BALANCE_BY_TIER[tier] || DEFAULT_MINIMUM_BALANCE
  }

  static async getStats(): Promise<{
    actors: number
    organizations: number
    pools: number
    characterMappings: number
    organizationMappings: number
    rssFeedSources: number
    perpMarkets: number
  }> {
    // Run count queries in parallel
    const [
      actorCountResults,
      orgCountResults,
      poolCountResults,
      feedCountResults,
      perpMarketCountResults,
    ] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(actorState),
      db.select({ count: sql`count(*)` }).from(organizationState),
      db.select({ count: sql`count(*)` }).from(pools),
      db.select({ count: sql`count(*)` }).from(rssFeedSources),
      db.select({ count: sql`count(*)` }).from(perpMarketSnapshots),
    ])

    /** Row type for raw SQL count(*) results */
    type RawCountRow = { count?: string | number | bigint }
    const getCount = (results: { count: unknown }[]): number => {
      const first = results[0] as RawCountRow | undefined
      const val = first?.count
      return typeof val === 'number' ? val : Number(val ?? 0)
    }

    return {
      actors: getCount(actorCountResults),
      organizations: getCount(orgCountResults),
      pools: getCount(poolCountResults),
      characterMappings: StaticDataRegistry.getAllCharacterMappings().length,
      organizationMappings:
        StaticDataRegistry.getAllOrganizationMappings().length,
      rssFeedSources: getCount(feedCountResults),
      perpMarkets: getCount(perpMarketCountResults),
    }
  }
}

// Export convenience function for game tick
export async function bootstrapGameIfNeeded(): Promise<GameBootstrapResult | null> {
  return GameBootstrapService.bootstrapIfNeeded()
}
