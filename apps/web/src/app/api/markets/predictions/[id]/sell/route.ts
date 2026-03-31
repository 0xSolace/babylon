import type { JsonValue } from '@babylon/api';
import {
  authenticate,
  BusinessLogicError,
  broadcastToChannel,
  checkProgress,
  invalidateMarketsApiPredictionsAfterUserTrade,
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
  PredictionMarketSellSchema,
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

// POST /api/markets/predictions/[id]/sell - unified handler (simulation + onchain)
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
      const { POST: onchainHandler } = await import('../sell-onchain/route');
      const clonedRequest = new NextRequestClass(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(body),
      });
      return onchainHandler(clonedRequest, context);
    }

    // Simulation path: standard sell with {shares, positionId}
    const user = await authenticate(request);
    const { shares, positionId } = PredictionMarketSellSchema.parse(body);

    const service = buildService(marketId);
    const market = await service.getMarket(marketId);
    if (market?.onChainMarketId) {
      throw new BusinessLogicError(
        'This market settles on-chain. Include txHash in the request body for on-chain verification.',
        'PREDICTION_ONCHAIN_ONLY'
      );
    }
    const result = await service.sell({
      userId: user.userId,
      marketId,
      shares,
      positionId,
    });

    const balance = await WalletService.getBalance(user.userId);

    trackServerEvent(user.userId, 'prediction_sold', {
      marketId,
      sharesSold: shares,
      grossProceeds: result.totalProceeds ?? result.netProceeds ?? 0,
      netProceeds: result.netProceeds ?? 0,
      pnl: result.pnl ?? 0,
      priceImpact: result.market.priceImpact,
      feeCharged: result.feePaid,
      positionId: result.positionId,
    } as Record<string, JsonValue>).catch((error) => {
      logger.warn('Failed to track prediction_sold event', { error });
    });

    void checkProgress(user.userId, { type: 'prediction_trade', marketId });
    void invalidateMarketsApiPredictionsAfterUserTrade(user.userId);

    return successResponse({
      sharesSold: shares,
      grossProceeds: result.totalProceeds ?? result.netProceeds,
      netProceeds: result.netProceeds,
      pnl: result.pnl,
      market: result.market,
      fee: {
        amount: result.feePaid,
        referrerPaid: 0,
      },
      remainingShares: result.remainingShares,
      positionClosed: result.positionClosed ?? false,
      newBalance: balance.balance,
      positionId: result.positionId,
    });
  }
);
