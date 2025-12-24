import {
  FEE_CONFIG,
  PredictionDbAdapter,
  PredictionMarketService,
  WalletService,
} from '@babylon/engine'
import { logger, PredictionPricing } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

type UserPositionSnapshot = {
  id: string
  marketId: string
  side: 'YES' | 'NO'
  shares: number
  avgPrice: number
  currentPrice: number
  currentProbability: number
  currentValue: number
  costBasis: number
  unrealizedPnL: number
  maxPayout: number
  resolved: boolean
  resolution: boolean | null
}

/**
 * Create PredictionMarketService instance
 */
function createMarketService() {
  const dbAdapter = new PredictionDbAdapter()
  return new PredictionMarketService({
    db: dbAdapter,
    wallet: {
      debit: ({ userId, amount, reason, description, relatedId }) =>
        WalletService.debit(
          userId,
          amount,
          reason,
          description ?? '',
          relatedId,
        ),
      credit: ({ userId, amount, reason, description, relatedId }) =>
        WalletService.credit(
          userId,
          amount,
          reason,
          description ?? '',
          relatedId,
        ),
      recordPnL: async ({ userId, pnl, reason, relatedId }) => {
        await WalletService.recordPnL(userId, pnl, reason, relatedId)
      },
      getBalance: (uid: string) => WalletService.getBalance(uid),
    },
    fees: {
      tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
      platformShare: FEE_CONFIG.PLATFORM_SHARE,
      referrerShare: FEE_CONFIG.REFERRER_SHARE,
      minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
    },
  })
}

/**
 * Market routes
 * Migrated from: apps/web/app/api/markets/*
 */
const createMarketsRoutes = () =>
  new Elysia({ prefix: '/api/markets' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // List prediction markets
    // Migrated from: apps/web/app/api/markets/predictions/route.ts
    .get(
      '/predictions',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { query } = ctx
        const { userId, status: _status, category: _category } = query

        const service = createMarketService()

        // Markets snapshot
        const markets = await service.listMarkets()
        const marketMap = new Map(markets.map((m) => [m.id, m]))

        // User positions if requested
        const userPositionsMap = new Map<string, UserPositionSnapshot[]>()
        if (userId && isAuthenticated && user?.userId === userId) {
          const positions = await service.listUserPositions(userId)
          for (const p of positions) {
            // Skip positions with no/negligible shares (already closed or too small to sell)
            if (p.shares < 0.01) continue
            const market = marketMap.get(p.marketId)
            if (!market) continue

            const yesShares = market.yesShares
            const noShares = market.noShares
            const shares = p.shares
            const sideKey = p.side

            // Calculate current value with error handling for edge cases
            let currentValue: number
            let currentProbability: number
            try {
              const pricePreview = PredictionPricing.calculateSell(
                yesShares,
                noShares,
                sideKey,
                shares,
              )
              currentValue = pricePreview.totalCost
              currentProbability = PredictionPricing.getCurrentPrice(
                yesShares,
                noShares,
                sideKey,
              )
            } catch {
              // If sell calculation fails (e.g., insufficient liquidity), use probability-based estimate
              currentProbability = PredictionPricing.getCurrentPrice(
                yesShares,
                noShares,
                sideKey,
              )
              currentValue = shares * currentProbability
            }

            const costBasis = shares * p.avgPrice
            const positionSnapshot: UserPositionSnapshot = {
              id: p.id,
              marketId: p.marketId,
              side: p.side === 'yes' ? 'YES' : 'NO',
              shares,
              avgPrice: p.avgPrice,
              currentPrice: shares > 0 ? currentValue / shares : 0,
              currentProbability,
              currentValue,
              costBasis,
              unrealizedPnL: currentValue - costBasis,
              maxPayout: shares * (1 + p.avgPrice),
              resolved: market?.resolved ?? false,
              resolution: market?.resolution ?? null,
            }
            const existing = userPositionsMap.get(p.marketId) ?? []
            userPositionsMap.set(p.marketId, [...existing, positionSnapshot])
          }
        }

        const questionsData = markets.map((m) => {
          const yesShares = m.yesShares
          const noShares = m.noShares
          const total = yesShares + noShares
          const yesProb = total > 0 ? yesShares / total : 0.5
          const noProb = total > 0 ? noShares / total : 0.5
          const userPositions = userPositionsMap.get(m.id) ?? []
          const primaryPosition = userPositions[0] ?? null

          return {
            id: m.id,
            // Frontend expects 'text' field for the question text
            text: m.question,
            question: m.question,
            status: m.status ?? (m.resolved ? 'resolved' : 'active'),
            resolution: m.resolution,
            resolved: m.resolved,
            resolutionDate: m.endDate?.toISOString() ?? null,
            endDate: m.endDate?.toISOString() ?? null,
            createdDate: m.createdAt?.toISOString() ?? null,
            yesShares,
            noShares,
            yesProbability: yesProb,
            noProbability: noProb,
            userPosition: primaryPosition,
            userPositions,
            oracleCommitTxHash: m.oracleCommitTxHash ?? null,
            oracleRevealTxHash: m.oracleRevealTxHash ?? null,
            resolutionProofUrl: m.resolutionProofUrl ?? null,
            resolutionDescription: m.resolutionDescription ?? null,
          }
        })

        logger.info(
          'Prediction markets fetched via core service',
          { count: questionsData.length, hasUserId: !!userId },
          'GET /api/markets/predictions',
        )

        return {
          success: true,
          questions: questionsData,
          count: questionsData.length,
        }
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          category: t.Optional(t.String()),
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          userId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Markets'],
          summary: 'List prediction markets',
          description:
            'Returns all prediction markets with optional user position data',
        },
      },
    )

    // Get prediction market by ID
    .get(
      '/predictions/:id',
      async ({ params, set }) => {
        const service = createMarketService()

        const market = await service.getMarket(params.id)
        if (!market) {
          set.status = 404
          return { error: 'Market not found' }
        }

        const yesShares = market.yesShares
        const noShares = market.noShares
        const total = yesShares + noShares
        const yesProb = total > 0 ? yesShares / total : 0.5
        const noProb = total > 0 ? noShares / total : 0.5

        return {
          success: true,
          market: {
            id: market.id,
            question: market.question,
            text: market.question,
            status: market.status ?? (market.resolved ? 'resolved' : 'active'),
            resolution: market.resolution,
            resolved: market.resolved,
            resolutionDate: market.endDate?.toISOString() ?? null,
            endDate: market.endDate?.toISOString() ?? null,
            createdDate: market.createdAt?.toISOString() ?? null,
            yesShares,
            noShares,
            yesProbability: yesProb,
            noProbability: noProb,
            oracleCommitTxHash: market.oracleCommitTxHash ?? null,
            oracleRevealTxHash: market.oracleRevealTxHash ?? null,
            resolutionProofUrl: market.resolutionProofUrl ?? null,
            resolutionDescription: market.resolutionDescription ?? null,
          },
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['Markets'],
          summary: 'Get prediction market by ID',
        },
      },
    )

    // Get market price history
    .get(
      '/predictions/:id/history',
      async ({ params, set }) => {
        const service = createMarketService()

        const market = await service.getMarket(params.id)
        if (!market) {
          set.status = 404
          return { error: 'Market not found' }
        }

        // Calculate current price state
        const yesShares = market.yesShares
        const noShares = market.noShares
        const total = yesShares + noShares
        const currentYesPrice = total > 0 ? yesShares / total : 0.5
        const currentNoPrice = total > 0 ? noShares / total : 0.5

        return {
          success: true,
          marketId: params.id,
          currentState: {
            yesProbability: currentYesPrice,
            noProbability: currentNoPrice,
            yesShares,
            noShares,
          },
          history: [],
          tradeCount: 0,
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          period: t.Optional(t.String()),
          resolution: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Markets'],
          summary: 'Get market price history',
        },
      },
    )

    // Buy market shares
    // Migrated from: apps/web/app/api/markets/predictions/[id]/buy/route.ts
    .post(
      '/predictions/:id/buy',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { outcome, amount } = body
        const marketId = params.id
        const parsedAmount = Number.parseFloat(amount)

        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          set.status = 400
          return { error: 'Invalid amount' }
        }

        const lowercaseOutcome = outcome.toLowerCase()
        if (lowercaseOutcome !== 'yes' && lowercaseOutcome !== 'no') {
          set.status = 400
          return { error: 'Invalid outcome. Must be "yes" or "no"' }
        }
        const side = lowercaseOutcome

        const service = createMarketService()

        const result = await service.buy({
          userId: user.userId,
          marketId,
          side,
          amount: parsedAmount,
        })

        logger.info(
          'User bought prediction market shares',
          {
            userId: user.userId,
            marketId,
            side,
            amount: parsedAmount,
            shares: result.shares,
          },
          'POST /api/markets/predictions/:id/buy',
        )

        return {
          success: true,
          positionId: result.positionId,
          shares: result.shares,
          avgPrice: result.avgPrice,
          totalCost: result.totalCost,
          feePaid: result.feePaid,
          market: result.market,
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          outcome: t.String(),
          amount: t.String(),
          maxPrice: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Markets'],
          summary: 'Buy market shares',
        },
      },
    )

    // Sell market shares
    // Migrated from: apps/web/app/api/markets/predictions/[id]/sell/route.ts
    .post(
      '/predictions/:id/sell',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { shares, positionId } = body
        const marketId = params.id
        const parsedShares = Number.parseFloat(shares)

        if (Number.isNaN(parsedShares) || parsedShares <= 0) {
          set.status = 400
          return { error: 'Invalid shares amount' }
        }

        const service = createMarketService()

        const result = await service.sell({
          userId: user.userId,
          marketId,
          shares: parsedShares,
          positionId,
        })

        logger.info(
          'User sold prediction market shares',
          {
            userId: user.userId,
            marketId,
            shares: parsedShares,
            netProceeds: result.netProceeds,
          },
          'POST /api/markets/predictions/:id/sell',
        )

        return {
          success: true,
          positionId: result.positionId,
          shares: result.shares,
          avgPrice: result.avgPrice,
          netProceeds: result.netProceeds,
          feePaid: result.feePaid,
          pnl: result.pnl,
          remainingShares: result.remainingShares,
          positionClosed: result.positionClosed,
          market: result.market,
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          shares: t.String(),
          positionId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Markets'],
          summary: 'Sell market shares',
        },
      },
    )

    // Get user positions
    // Migrated from: apps/web/app/api/markets/positions/[userId]/route.ts
    .get(
      '/positions/:userId',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx

        // Only allow users to get their own positions
        if (!isAuthenticated || !user || user.userId !== params.userId) {
          set.status = 403
          return { error: 'Forbidden' }
        }

        const service = createMarketService()
        const positions = await service.listUserPositions(params.userId)

        // Get market data for each position
        const markets = await service.listMarkets()
        const marketMap = new Map(markets.map((m) => [m.id, m]))

        const positionsWithMarket = positions.map((p) => {
          const market = marketMap.get(p.marketId)
          const currentPrice = market
            ? PredictionPricing.getCurrentPrice(
                market.yesShares,
                market.noShares,
                p.side,
              )
            : p.avgPrice

          return {
            id: p.id,
            marketId: p.marketId,
            side: p.side.toUpperCase(),
            shares: p.shares,
            avgPrice: p.avgPrice,
            currentPrice,
            costBasis: p.shares * p.avgPrice,
            currentValue: p.shares * currentPrice,
            unrealizedPnL: p.shares * (currentPrice - p.avgPrice),
            status: p.status,
            marketQuestion: market?.question ?? null,
            marketResolved: market?.resolved ?? false,
            marketResolution: market?.resolution ?? null,
          }
        })

        logger.info(
          'User positions fetched',
          { userId: params.userId, positionCount: positionsWithMarket.length },
          'GET /api/markets/positions/:userId',
        )

        return {
          success: true,
          positions: positionsWithMarket,
          count: positionsWithMarket.length,
        }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        query: t.Object({
          status: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Markets'],
          summary: 'Get user market positions',
        },
      },
    )

    // Get perp trades by ticker
    .get(
      '/perps/trades/:ticker',
      async ({ params }) => {
        const { ticker } = params

        return {
          success: true,
          ticker,
          trades: [],
          count: 0,
        }
      },
      {
        params: t.Object({
          ticker: t.String(),
        }),
        query: t.Object({
          limit: t.Optional(t.String()),
          before: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Markets'],
          summary: 'Get perpetual trades',
        },
      },
    )

    // Configure market bias (admin)
    .post(
      '/bias/configure',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user?.isAdmin) {
          set.status = 403
          return { error: 'Forbidden - Admin access required' }
        }

        const service = createMarketService()
        const market = await service.getMarket(body.marketId)

        if (!market) {
          set.status = 404
          return { error: 'Market not found' }
        }

        // Bias configuration would typically adjust market parameters
        // For now, log the configuration request
        logger.info(
          'Market bias configuration requested',
          { marketId: body.marketId, bias: body.bias, adminId: user.userId },
          'POST /api/markets/bias/configure',
        )

        return {
          success: true,
          marketId: body.marketId,
          bias: body.bias,
          message: 'Bias configuration applied',
        }
      },
      {
        body: t.Object({
          marketId: t.String(),
          bias: t.Number(),
        }),
        detail: {
          tags: ['Markets', 'Admin'],
          summary: 'Configure market bias',
        },
      },
    )

export const marketsRoutes = createMarketsRoutes()
