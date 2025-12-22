export const dynamic = 'force-dynamic';

/**
 * Perpetual Futures Open Position API
 *
 * @route POST /api/markets/perps/open
 * @access Authenticated
 *
 * Opens a new perpetual futures position with specified ticker, side (long/short),
 * size, and leverage. Calculates margin requirements, fees, and entry price.
 */

import {
  authenticate,
  BusinessLogicError,
  EngagementService,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { PerpDbAdapter, PerpMarketService } from '@babylon/core/markets/perps';
import { FEE_CONFIG, FeeService, WalletService } from '@babylon/engine';
import { PerpOpenPositionSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/markets/perps/open
 * Thin handler: validate → PerpMarketService.openPosition → response
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  const body = await request.json();
  const { ticker, side, size, leverage } = PerpOpenPositionSchema.parse(body);

  const normalizedSide = side.toLowerCase() as 'long' | 'short';
  const numericSize = typeof size === 'string' ? Number(size) : size;

  const service = new PerpMarketService({
    db: new PerpDbAdapter(),
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
      getBalance: (userId: string) => WalletService.getBalance(userId),
    },
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

  const result = await service.openPosition({
    userId: user.userId,
    ticker,
    side: normalizedSide,
    size: numericSize,
    leverage,
  });

  // Validate required field exists after open operation
  if (result.marginPaid === undefined) {
    throw new BusinessLogicError(
      'Open operation failed: margin not calculated',
      'OPEN_CALCULATION_ERROR',
      { ticker, size: numericSize }
    );
  }

  const { marginPaid } = result;

  void trackServerEvent(user.userId, 'trade_opened', {
    type: 'perp',
    ticker,
    side: normalizedSide,
    size: numericSize,
    leverage,
    entryPrice: result.entryPrice,
    marginPaid,
    feeCharged: result.feePaid,
    positionId: result.positionId,
  }).catch((error) => {
    console.warn('Failed to track trade_opened event', { error });
  });

  // Record engagement for airdrop qualification
  void EngagementService.recordTrade(user.userId, result.positionId, 'perp');

  return successResponse(
    {
      position: result,
      marginPaid,
      fee: {
        amount: result.feePaid,
        referrerPaid: 0,
      },
      newBalance: result.balance,
    },
    201
  );
});
