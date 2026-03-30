import {
  addPublicReadHeaders,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  PredictionDbAdapter,
  PredictionMarketService,
  PredictionPricing,
} from '@babylon/core/markets/prediction';
import { db } from '@babylon/db';
import { FEE_CONFIG, WalletService } from '@babylon/engine';
import { logger, MarketQuerySchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPredictionOnchainOverlay } from './_onchain';

type UserPositionSnapshot = {
  id: string;
  marketId: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentProbability: number;
  currentValue: number;
  costBasis: number;
  unrealizedPnL: number;
  maxPayout: number;
  resolved: boolean;
  resolution: boolean | null;
};

// GET /api/markets/predictions – list markets (optionally with user positions)
export const GET = withErrorHandling(async (request: NextRequest) => {
  const {
    error,
    user: authUser,
    rateLimitInfo,
  } = await publicRateLimit(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const queryParse = MarketQuerySchema.merge(
    z.object({ userId: z.string().optional() })
  )
    .partial()
    .safeParse(Object.fromEntries(searchParams));

  if (!queryParse.success) {
    return successResponse(
      {
        error: 'Invalid query parameters',
        details: queryParse.error.flatten(),
      },
      400
    );
  }

  const { userId } = queryParse.data;

  const dbAdapter = new PredictionDbAdapter();
  const service = new PredictionMarketService({
    db: dbAdapter,
    wallet: {
      debit: ({ userId, amount, reason, description, relatedId }) =>
        WalletService.debit(
          userId,
          amount,
          reason,
          description ?? '',
          relatedId
        ),
      credit: ({ userId, amount, reason, description, relatedId }) =>
        WalletService.credit(
          userId,
          amount,
          reason,
          description ?? '',
          relatedId
        ),
      recordPnL: async ({ userId, pnl, reason, relatedId }) => {
        await WalletService.recordPnL(userId, pnl, reason, relatedId);
      },
      getBalance: (uid: string) => WalletService.getBalance(uid),
    },
    fees: {
      tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
      platformShare: FEE_CONFIG.PLATFORM_SHARE,
      referrerShare: FEE_CONFIG.REFERRER_SHARE,
      minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
    },
  });

  // Markets snapshot
  const markets = await service.listMarkets();
  const marketMap = new Map(markets.map((m) => [m.id, m]));
  const userWalletAddress =
    userId && authUser?.userId === userId
      ? ((
          await db.user.findUnique({
            where: { id: userId },
            select: { walletAddress: true },
          })
        )?.walletAddress ?? null)
      : null;
  const onChainMarkets = markets.filter((market) => market.onChainMarketId);
  const onChainOverlayEntries = await Promise.all(
    onChainMarkets.map(async (market) => {
      const overlay = await getPredictionOnchainOverlay(
        market.onChainMarketId!,
        userWalletAddress ?? undefined
      );
      return overlay ? ([market.id, overlay] as const) : null;
    })
  );
  const onChainOverlays = new Map(
    onChainOverlayEntries.filter(
      (
        entry
      ): entry is [
        string,
        NonNullable<Awaited<ReturnType<typeof getPredictionOnchainOverlay>>>,
      ] => entry !== null
    )
  );

  // User positions if requested
  const userPositionsMap = new Map<string, UserPositionSnapshot[]>();
  if (userId && authUser?.userId === userId) {
    try {
      const positions = await service.listUserPositions(userId);
      for (const p of positions) {
        // Skip positions with no/negligible shares (already closed or too small to sell)
        // Match the Zod minimum of 0.01 shares for selling
        if (p.shares < 0.01) continue;
        const market = marketMap.get(p.marketId);
        if (!market) continue; // Skip positions for non-existent markets

        const yesShares = market.yesShares;
        const noShares = market.noShares;
        const shares = p.shares;
        const sideKey = p.side;

        // Calculate current value with error handling for edge cases
        let currentValue: number;
        let currentProbability: number;
        try {
          const pricePreview = PredictionPricing.calculateSellWithFees(
            yesShares,
            noShares,
            sideKey,
            shares,
            FEE_CONFIG.TRADING_FEE_RATE
          );
          currentValue = pricePreview.netProceeds ?? pricePreview.totalCost;
          currentProbability = PredictionPricing.getCurrentPrice(
            yesShares,
            noShares,
            sideKey
          );
        } catch {
          // If sell calculation fails (e.g., insufficient liquidity), use probability-based estimate
          currentProbability = PredictionPricing.getCurrentPrice(
            yesShares,
            noShares,
            sideKey
          );
          // Approximate net proceeds using the spot probability and fee rate.
          currentValue =
            shares * currentProbability * (1 - FEE_CONFIG.TRADING_FEE_RATE);
        }

        // avgPrice is based on net buy amount (after fees), so gross-up cost basis.
        const costBasisNet = shares * p.avgPrice;
        const costBasis =
          FEE_CONFIG.TRADING_FEE_RATE > 0 && FEE_CONFIG.TRADING_FEE_RATE < 1
            ? costBasisNet / (1 - FEE_CONFIG.TRADING_FEE_RATE)
            : costBasisNet;
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
        };
        const existing = userPositionsMap.get(p.marketId) ?? [];
        userPositionsMap.set(p.marketId, [...existing, positionSnapshot]);
      }
    } catch (error) {
      logger.error(
        'Failed to fetch prediction market positions; returning public markets without positions',
        {
          requestedUserId: userId,
          authenticatedUserId: authUser.userId,
          dbUserId: authUser.dbUserId ?? null,
          privyId: authUser.privyId ?? null,
          url: request.url,
          error: error instanceof Error ? error.message : String(error),
        },
        'GET /api/markets/predictions'
      );
    }
  }

  const questionsData = markets.map((m) => {
    const onChain = onChainOverlays.get(m.id);
    const yesShares = onChain?.yesShares ?? m.yesShares;
    const noShares = onChain?.noShares ?? m.noShares;
    // Probability should reflect the CPMM price, not the raw share ratio.
    const yesProb =
      onChain?.yesProbability ??
      PredictionPricing.getCurrentPrice(yesShares, noShares, 'yes');
    const noProb =
      onChain?.noProbability ??
      PredictionPricing.getCurrentPrice(yesShares, noShares, 'no');
    const dbUserPositions = userPositionsMap.get(m.id) ?? [];
    const userPositions = onChain
      ? [
          ...(onChain.userYesShares && onChain.userYesShares >= 0.01
            ? [
                {
                  id:
                    dbUserPositions.find((p) => p.side === 'YES')?.id ??
                    `onchain-${m.id}-yes`,
                  marketId: m.id,
                  side: 'YES' as const,
                  shares: onChain.userYesShares,
                  avgPrice:
                    dbUserPositions.find((p) => p.side === 'YES')?.avgPrice ??
                    yesProb,
                  currentPrice: yesProb,
                  currentProbability: yesProb,
                  currentValue: onChain.userYesShares * yesProb,
                  costBasis:
                    onChain.userYesShares *
                    (dbUserPositions.find((p) => p.side === 'YES')?.avgPrice ??
                      yesProb),
                  unrealizedPnL:
                    onChain.userYesShares * yesProb -
                    onChain.userYesShares *
                      (dbUserPositions.find((p) => p.side === 'YES')
                        ?.avgPrice ?? yesProb),
                  maxPayout: onChain.userYesShares,
                  resolved: m.resolved,
                  resolution: m.resolution ?? null,
                },
              ]
            : []),
          ...(onChain.userNoShares && onChain.userNoShares >= 0.01
            ? [
                {
                  id:
                    dbUserPositions.find((p) => p.side === 'NO')?.id ??
                    `onchain-${m.id}-no`,
                  marketId: m.id,
                  side: 'NO' as const,
                  shares: onChain.userNoShares,
                  avgPrice:
                    dbUserPositions.find((p) => p.side === 'NO')?.avgPrice ??
                    noProb,
                  currentPrice: noProb,
                  currentProbability: noProb,
                  currentValue: onChain.userNoShares * noProb,
                  costBasis:
                    onChain.userNoShares *
                    (dbUserPositions.find((p) => p.side === 'NO')?.avgPrice ??
                      noProb),
                  unrealizedPnL:
                    onChain.userNoShares * noProb -
                    onChain.userNoShares *
                      (dbUserPositions.find((p) => p.side === 'NO')?.avgPrice ??
                        noProb),
                  maxPayout: onChain.userNoShares,
                  resolved: m.resolved,
                  resolution: m.resolution ?? null,
                },
              ]
            : []),
        ]
      : dbUserPositions;
    const primaryPosition = userPositions[0] ?? null;

    return {
      id: m.id,
      // Frontend expects 'text' field for the question text
      text: m.question,
      question: m.question, // Also include as 'question' for backward compatibility
      status: m.status ?? (m.resolved ? 'resolved' : 'active'),
      resolution: m.resolution,
      resolved: m.resolved,
      // Frontend expects 'resolutionDate' for the end date
      resolutionDate: m.endDate?.toISOString() ?? null,
      endDate: m.endDate?.toISOString() ?? null, // Also include as 'endDate'
      createdDate: m.createdAt?.toISOString() ?? null,
      yesShares,
      noShares,
      yesProbability: yesProb,
      noProbability: noProb,
      liquidity: onChain?.liquidity ?? m.liquidity,
      userPosition: primaryPosition,
      userPositions,
      oracleCommitTxHash: m.oracleCommitTxHash ?? null,
      oracleRevealTxHash: m.oracleRevealTxHash ?? null,
      resolutionProofUrl: m.resolutionProofUrl ?? null,
      resolutionDescription: m.resolutionDescription ?? null,
      onChainMarketId: m.onChainMarketId ?? null,
      onChainMarketAddress: onChain?.onChainMarketAddress ?? null,
      onChainState: onChain?.onChainState ?? null,
      onChainOutcome: onChain?.onChainOutcome ?? null,
    };
  });

  logger.info(
    'Prediction markets fetched via core service',
    { count: questionsData.length, hasUserId: !!userId },
    'GET /api/markets/predictions'
  );

  const res = successResponse({
    success: true,
    questions: questionsData,
    count: questionsData.length,
  });
  if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
  return res;
});
