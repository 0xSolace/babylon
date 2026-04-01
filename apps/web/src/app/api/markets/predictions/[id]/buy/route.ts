import type { JsonValue } from '@babylon/api';
import {
  authenticate,
  BusinessLogicError,
  broadcastToChannel,
  checkProgress,
  invalidateCache,
  invalidateMarketsApiPredictionsAfterUserTrade,
  narrativeEnrichmentKey,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  PredictionDbAdapter,
  PredictionMarketService,
} from '@babylon/core/markets/prediction';
import {
  FEE_CONFIG,
  FeeService,
  invalidateAfterPredictionTrade,
  WalletService,
} from '@babylon/engine';
import {
  logger,
  PredictionMarketIdSchema,
  PredictionMarketTradeSchema,
} from '@babylon/shared';
import { type NextRequest, NextRequest as NextRequestClass } from 'next/server';
import { trackServerEvent } from '@/lib/posthog/server';

const buildService = (marketId: string) =>
  new PredictionMarketService({
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
      recordPnL: ({ userId, pnl, reason, relatedId }) =>
        WalletService.recordPnL(userId, pnl, reason, relatedId).then(
          () => undefined
        ),
      getBalance: (userId: string) => WalletService.getBalance(userId),
    },
    broadcast: {
      emit: (channel, payload) =>
        broadcastToChannel(channel, payload as Record<string, JsonValue>),
    },
    cache: { invalidate: () => invalidateAfterPredictionTrade(marketId) },
    clock: { now: () => new Date() },
    fees: {
      tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
      platformShare: FEE_CONFIG.PLATFORM_SHARE,
      referrerShare: FEE_CONFIG.REFERRER_SHARE,
      minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
    },
    feeProcessor: {
      processTradingFee: ({ userId, amount, type, relatedId, positionId }) =>
        FeeService.processTradingFee(
          userId,
          type as (typeof FEE_CONFIG.FEE_TYPES)[keyof typeof FEE_CONFIG.FEE_TYPES],
          amount,
          positionId,
          relatedId
        ),
    },
  });

// POST /api/markets/predictions/[id]/buy - unified handler (simulation + onchain)
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id: marketId } = PredictionMarketIdSchema.parse(
      await context.params
    );
    const body = await request.json();

    // Onchain path: if body contains txHash, delegate to onchain verification handler
    if (
      typeof body === 'object' &&
      body !== null &&
      'txHash' in body &&
      typeof (body as Record<string, unknown>).txHash === 'string'
    ) {
      const { POST: onchainHandler } = await import('../buy-onchain/route');
      // Rebuild request with the same body since we already consumed it
      const clonedRequest = new NextRequestClass(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(body),
      });
      return onchainHandler(clonedRequest, context);
    }

    // Simulation path: standard buy with {side, amount}
    const user = await authenticate(request);
    const { side, amount } = PredictionMarketTradeSchema.parse(body);

    const service = buildService(marketId);
    const market = await service.getMarket(marketId);
    if (market?.onChainMarketId) {
      throw new BusinessLogicError(
        'This market settles on-chain. Include txHash in the request body for on-chain verification.',
        'PREDICTION_ONCHAIN_ONLY'
      );
    }
    const result = await service.buy({
      userId: user.userId,
      marketId,
      side,
      amount,
    });

    const balance = await WalletService.getBalance(user.userId);

    trackServerEvent(user.userId, 'prediction_bought', {
      marketId,
      side,
      amount,
      sharesBought: result.shares,
      avgPrice: result.avgPrice,
      priceImpact: result.market.priceImpact,
      feeCharged: result.feePaid,
      newYesPrice: result.market.yesPrice,
      newNoPrice: result.market.noPrice,
    }).catch((error) => {
      logger.warn('Failed to track prediction_bought event', { error });
    });

    void checkProgress(user.userId, { type: 'prediction_trade', marketId });
    void invalidateMarketsApiPredictionsAfterUserTrade(user.userId);
    invalidateCache(narrativeEnrichmentKey(user.userId), {
      namespace: 'feed',
    }).catch((err) => {
      logger.warn(
        'Failed to invalidate narrative enrichment cache after prediction buy',
        { error: err, userId: user.userId },
        'POST /api/markets/predictions/[id]/buy'
      );
    });

    return successResponse(
      {
        position: {
          id: result.positionId,
          marketId,
          side,
          shares: result.shares,
          avgPrice: result.avgPrice,
          totalCost: result.totalCost,
        },
        market: result.market,
        fee: {
          amount: result.feePaid,
          referrerPaid: 0,
        },
        newBalance: balance.balance,
      },
      201
    );
  }
);
