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
import { ClosePerpPositionSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { trackServerEvent } from '@/lib/posthog/server';
import { createWalletAdapter, perpFeeConfig } from '../../../_adapters';

const IdParamSchema = z.object({
  id: z.string(),
});

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

    const text = await request.text();
    const parsed =
      text.length > 0
        ? ClosePerpPositionSchema.parse(JSON.parse(text))
        : { percentage: undefined, slippage: undefined };

    const service = new PerpMarketService({
      db: new PerpDbAdapter(),
      wallet: createWalletAdapter(),
      fees: perpFeeConfig,
    });

    const result = await service.closePosition({
      userId: user.userId,
      positionId,
      percentage: parsed.percentage,
      maxSlippage: parsed.slippage,
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
      remainingSize: result.remainingSize,
      fullyClosed: result.fullyClosed,
    });
  }
);
