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
import {
  and,
  balanceTransactions,
  count,
  db,
  eq,
  inArray,
  npcTrades,
} from '@babylon/db';
import { FEE_CONFIG, WalletService } from '@babylon/engine';
import {
  logger,
  MarketQuerySchema,
  PredictionMarketIdSchema,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPredictionOnchainOverlay } from '../_onchain';
import { getPublicResolutionAudit } from '../_resolution-audit';

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

/**
 * GET /api/markets/predictions/[id]
 * Returns a single market (optionally with authenticated user's positions)
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const {
      error,
      user: authUser,
      rateLimitInfo,
    } = await publicRateLimit(request);
    if (error) return error;

    const { id: marketId } = PredictionMarketIdSchema.parse(
      await context.params
    );
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

    const service = new PredictionMarketService({
      db: new PredictionDbAdapter(),
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

    const market =
      (await service.getMarket(marketId)) ??
      (await service.ensureMarketExists({ marketId }).catch(() => null));

    if (!market) {
      return successResponse({ error: 'Market not found' }, 404);
    }

    const userWalletAddress =
      userId && authUser?.userId === userId
        ? ((
            await db.user.findUnique({
              where: { id: userId },
              select: { walletAddress: true },
            })
          )?.walletAddress ?? null)
        : null;
    const onChain = market.onChainMarketId
      ? await getPredictionOnchainOverlay(
          market.onChainMarketId,
          userWalletAddress ?? undefined
        )
      : null;
    const yesShares = onChain?.yesShares ?? market.yesShares;
    const noShares = onChain?.noShares ?? market.noShares;
    // Probability should reflect the CPMM price, not the raw share ratio.
    const yesProb =
      onChain?.yesProbability ??
      PredictionPricing.getCurrentPrice(yesShares, noShares, 'yes');
    const noProb =
      onChain?.noProbability ??
      PredictionPricing.getCurrentPrice(yesShares, noShares, 'no');

    let userPositions: UserPositionSnapshot[] = [];
    let primaryPosition: UserPositionSnapshot | null = null;

    if (userId && authUser?.userId === userId) {
      const positions = await service.listUserPositions(userId);
      const dbPositions: UserPositionSnapshot[] = positions
        .filter((p) => p.marketId === marketId && p.shares >= 0.01)
        .map((p): UserPositionSnapshot => {
          let currentValue = 0;
          let currentProbability = 0.5;
          try {
            const preview = PredictionPricing.calculateSellWithFees(
              yesShares,
              noShares,
              p.side,
              p.shares,
              FEE_CONFIG.TRADING_FEE_RATE
            );
            currentValue = preview.netProceeds ?? preview.totalCost;
            currentProbability = PredictionPricing.getCurrentPrice(
              yesShares,
              noShares,
              p.side
            );
          } catch {
            currentProbability = PredictionPricing.getCurrentPrice(
              yesShares,
              noShares,
              p.side
            );
            currentValue =
              p.shares * currentProbability * (1 - FEE_CONFIG.TRADING_FEE_RATE);
          }

          const costBasisNet = p.shares * p.avgPrice;
          const costBasis =
            FEE_CONFIG.TRADING_FEE_RATE > 0 && FEE_CONFIG.TRADING_FEE_RATE < 1
              ? costBasisNet / (1 - FEE_CONFIG.TRADING_FEE_RATE)
              : costBasisNet;
          return {
            id: p.id,
            marketId: p.marketId,
            side: p.side === 'yes' ? 'YES' : 'NO',
            shares: p.shares,
            avgPrice: p.avgPrice,
            currentPrice: p.shares > 0 ? currentValue / p.shares : 0,
            currentProbability,
            currentValue,
            costBasis,
            unrealizedPnL: currentValue - costBasis,
            maxPayout: p.shares * (1 + p.avgPrice),
            resolved: market.resolved,
            resolution: market.resolution ?? null,
          };
        });
      userPositions = onChain
        ? [
            ...(onChain.userYesShares && onChain.userYesShares >= 0.01
              ? [
                  {
                    id:
                      dbPositions.find((p) => p.side === 'YES')?.id ??
                      `onchain-${marketId}-yes`,
                    marketId,
                    side: 'YES' as const,
                    shares: onChain.userYesShares,
                    avgPrice:
                      dbPositions.find((p) => p.side === 'YES')?.avgPrice ??
                      yesProb,
                    currentPrice: yesProb,
                    currentProbability: yesProb,
                    currentValue: onChain.userYesShares * yesProb,
                    costBasis:
                      onChain.userYesShares *
                      (dbPositions.find((p) => p.side === 'YES')?.avgPrice ??
                        yesProb),
                    unrealizedPnL:
                      onChain.userYesShares * yesProb -
                      onChain.userYesShares *
                        (dbPositions.find((p) => p.side === 'YES')?.avgPrice ??
                          yesProb),
                    maxPayout: onChain.userYesShares,
                    resolved: market.resolved,
                    resolution: market.resolution ?? null,
                  },
                ]
              : []),
            ...(onChain.userNoShares && onChain.userNoShares >= 0.01
              ? [
                  {
                    id:
                      dbPositions.find((p) => p.side === 'NO')?.id ??
                      `onchain-${marketId}-no`,
                    marketId,
                    side: 'NO' as const,
                    shares: onChain.userNoShares,
                    avgPrice:
                      dbPositions.find((p) => p.side === 'NO')?.avgPrice ??
                      noProb,
                    currentPrice: noProb,
                    currentProbability: noProb,
                    currentValue: onChain.userNoShares * noProb,
                    costBasis:
                      onChain.userNoShares *
                      (dbPositions.find((p) => p.side === 'NO')?.avgPrice ??
                        noProb),
                    unrealizedPnL:
                      onChain.userNoShares * noProb -
                      onChain.userNoShares *
                        (dbPositions.find((p) => p.side === 'NO')?.avgPrice ??
                          noProb),
                    maxPayout: onChain.userNoShares,
                    resolved: market.resolved,
                    resolution: market.resolution ?? null,
                  },
                ]
              : []),
          ]
        : dbPositions;
      primaryPosition = userPositions[0] ?? null;
    }

    const [balanceTradeCountRows, npcTradeCountRows] = await Promise.all([
      db
        .select({ count: count() })
        .from(balanceTransactions)
        .where(
          and(
            eq(balanceTransactions.relatedId, marketId),
            inArray(balanceTransactions.type, ['pred_buy', 'pred_sell'])
          )
        ),
      db
        .select({ count: count() })
        .from(npcTrades)
        .where(
          and(
            eq(npcTrades.marketType, 'prediction'),
            eq(npcTrades.marketId, marketId)
          )
        ),
    ]);

    const tradeCount =
      Number(balanceTradeCountRows[0]?.count ?? 0) +
      Number(npcTradeCountRows[0]?.count ?? 0);

    const resolutionAudit = await getPublicResolutionAudit(marketId);

    const payload = {
      id: market.id,
      text: market.question,
      question: market.question,
      status: market.resolved ? 'resolved' : 'active',
      resolution: market.resolution ?? null,
      resolved: market.resolved,
      resolutionDate: market.endDate?.toISOString() ?? null,
      endDate: market.endDate?.toISOString() ?? null,
      createdDate: market.createdAt?.toISOString() ?? null,
      yesShares,
      noShares,
      liquidity: onChain?.liquidity ?? market.liquidity,
      tradeCount,
      yesProbability: yesProb,
      noProbability: noProb,
      userPosition: primaryPosition,
      userPositions,
      oracleCommitTxHash: market.oracleCommitTxHash ?? null,
      oracleRevealTxHash: market.oracleRevealTxHash ?? null,
      resolutionProofUrl: market.resolutionProofUrl ?? null,
      resolutionDescription: market.resolutionDescription ?? null,
      onChainMarketId: market.onChainMarketId ?? null,
      onChainMarketAddress: onChain?.onChainMarketAddress ?? null,
      onChainState: onChain?.onChainState ?? null,
      onChainOutcome: onChain?.onChainOutcome ?? null,
      resolutionAudit,
    };

    logger.info(
      'Prediction market fetched via core service',
      { marketId, hasUserId: !!userId },
      'GET /api/markets/predictions/[id]'
    );

    const res = successResponse({ success: true, market: payload });
    if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
    return res;
  }
);
