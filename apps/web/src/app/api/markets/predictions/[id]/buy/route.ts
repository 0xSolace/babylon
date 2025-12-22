export const dynamic = 'force-dynamic';

import {
  authenticate,
  BusinessLogicError,
  BuybackService,
  EngagementService,
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
import type { NextRequest } from 'next/server';
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
      emit: async () => {
        // Broadcast handled separately
      },
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

// POST /api/markets/predictions/[id]/buy - thin handler
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const user = await authenticate(request);
    const { id: marketId } = PredictionMarketIdSchema.parse(
      await context.params
    );
    const body = await request.json();
    const { side, amount } = PredictionMarketTradeSchema.parse(body);

    logger.info(
      'Buy request params',
      {
        marketId,
        side,
        amount,
        userId: user.userId,
      },
      'POST /api/markets/predictions/[id]/buy'
    );

    // Check balance first (before service call)
    const hasFunds = await WalletService.hasSufficientBalance(
      user.userId,
      amount
    );
    if (!hasFunds) {
      const balance = await WalletService.getBalance(user.userId);
      throw new BusinessLogicError(
        `Insufficient funds. Required: ${amount}, Available: ${Number(balance.balance)}`,
        'INSUFFICIENT_FUNDS',
        {
          required: amount,
          available: Number(balance.balance),
          currency: 'USD',
        }
      );
    }

    const service = buildService(marketId);
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

    // Record fee contribution for buyback (platform share goes to buyback)
    if (result.feePaid > 0) {
      void BuybackService.recordFeeContribution(
        result.positionId,
        user.userId,
        BigInt(Math.floor(result.feePaid * 0.5 * 1e18)), // 50% platform share
        'pred_buy',
        marketId
      ).then(({ thresholdMet }) => {
        if (thresholdMet) {
          void BuybackService.triggerBuyback();
        }
      });
    }

    // Record engagement for airdrop qualification
    await EngagementService.recordTrade(
      user.userId,
      result.positionId,
      'prediction'
    ).catch((error) => {
      logger.warn('Failed to record trade engagement', { error });
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
