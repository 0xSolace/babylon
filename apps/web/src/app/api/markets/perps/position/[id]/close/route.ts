export const dynamic = 'force-dynamic';

/**
 * Perpetual Futures Close Position API
 *
 * @route POST /api/markets/perps/position/[id]/close
 * @access Authenticated
 *
 * Closes an existing perpetual futures position. Calculates final P&L, fees,
 * and updates user balance. Tracks trade events.
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
import { ClosePerpPositionSchema, IdParamSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/markets/perps/position/[id]/close
 * Close an existing perpetual futures position
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const user = await authenticate(request);
    const { id: positionId } = IdParamSchema.parse(await context.params);

    // Parse and validate request body (optional for partial close)
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional for this endpoint
    }
    if (Object.keys(body).length > 0) {
      ClosePerpPositionSchema.parse(body);
    }

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

    const result = await service.closePosition({
      userId: user.userId,
      positionId,
    });

    // Validate required fields exist after close operation
    if (result.exitPrice === undefined) {
      throw new BusinessLogicError(
        'Close operation failed: exit price not calculated',
        'CLOSE_CALCULATION_ERROR',
        { positionId }
      );
    }
    if (result.realizedPnL === undefined) {
      throw new BusinessLogicError(
        'Close operation failed: PnL not calculated',
        'CLOSE_CALCULATION_ERROR',
        { positionId }
      );
    }
    if (result.marginPaid === undefined) {
      throw new BusinessLogicError(
        'Close operation failed: margin not found',
        'CLOSE_CALCULATION_ERROR',
        { positionId }
      );
    }

    const { exitPrice, realizedPnL, marginPaid } = result;

    void trackServerEvent(user.userId, 'trade_closed', {
      type: 'perp',
      ticker: result.ticker,
      side: result.side,
      size: result.size,
      leverage: result.leverage,
      entryPrice: result.entryPrice,
      exitPrice,
      realizedPnL,
      pnlPercent: marginPaid > 0 ? (realizedPnL / marginPaid) * 100 : 0,
      feeCharged: result.feePaid,
      wasLiquidated: false,
      positionId,
    }).catch((error) => {
      console.warn('Failed to track trade_closed event', { error });
    });

    // Record engagement for airdrop qualification
    void EngagementService.recordTrade(user.userId, positionId, 'perp');

    return successResponse({
      position: result,
      grossSettlement: marginPaid + realizedPnL,
      netSettlement: Math.max(0, marginPaid + realizedPnL - result.feePaid),
      marginReturned: marginPaid,
      pnl: realizedPnL,
      fee: {
        amount: result.feePaid,
        referrerPaid: 0,
      },
      wasLiquidated: false,
      newBalance: result.balance,
    });
  }
);
