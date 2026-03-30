import {
  authenticate,
  checkRateLimitAsync,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { handlePlayerTrade, parseOnchainPerpPositionId } from '@babylon/engine';
import {
  ClosePerpPositionSchema,
  fireAndForgetWithRetry,
  logger,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { trackServerEvent } from '@/lib/posthog/server';
import { createPerpMarketService } from '../../../_adapters';
import {
  authenticateOnchainPerpUser,
  getOnchainPerpService,
  isOnchainPerpModeEnabled,
  logOnchainPerpRoute,
  resolvePerpUserWallet,
  submitPerpTransactionCalls,
} from '../../../_onchain';

const IdParamSchema = z.object({
  id: z.string(),
});

/**
 * POST /api/markets/perps/position/[id]/close
 * Close an existing perpetual futures position (full or partial).
 *
 * Supports partial close via `percentage` body param (0-1, e.g., 0.5 = 50%).
 * Uses PerpMarketService with SSE broadcast enabled for real-time UI updates.
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const onchainMode = isOnchainPerpModeEnabled();
    const user = onchainMode
      ? await authenticateOnchainPerpUser(request)
      : await authenticate(request);

    // Rate limit: 10 closes per minute per user
    const rateLimitResult = await checkRateLimitAsync(
      user.userId,
      RATE_LIMIT_CONFIGS.CLOSE_POSITION
    );
    if (!rateLimitResult.allowed)
      return rateLimitError(rateLimitResult.retryAfter);

    const { id: positionId } = IdParamSchema.parse(await context.params);

    // Parse and validate request body (optional for partial close)
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional for this endpoint
    }
    const parsed =
      Object.keys(body).length > 0
        ? ClosePerpPositionSchema.parse(body)
        : {
            percentage: undefined as number | undefined,
            slippage: undefined as number | undefined,
            orderType: 'market' as const,
            limitPrice: undefined as number | undefined,
          };

    if (onchainMode) {
      logOnchainPerpRoute('PerpClose');

      const marketId = parseOnchainPerpPositionId(positionId);
      if (!marketId) {
        throw new Error(
          'On-chain perp close requests require an on-chain position id'
        );
      }

      const wallet = await resolvePerpUserWallet(
        user.dbUserId ?? user.userId,
        user.walletAddress
      );
      const service = getOnchainPerpService();
      const prepared = await service.prepareCloseOrder({
        account: wallet.walletAddress,
        marketId,
        percentage: parsed.percentage,
        maxSlippage: parsed.slippage,
        orderType: parsed.orderType,
        limitPrice: parsed.limitPrice,
      });
      const txHashes = await submitPerpTransactionCalls({
        wallet,
        calls: prepared.calls,
        context: 'perp-close',
      });

      trackServerEvent(user.userId, 'trade_closed', {
        type: 'perp',
        settlementMode: 'onchain',
        ticker: prepared.symbol,
        side: prepared.side,
        size: prepared.sizeUsd,
        orderType: prepared.orderType,
        limitPrice: parsed.limitPrice ?? null,
        exitPrice: prepared.estimatedExecutionPrice.toString(),
        realizedPnL: prepared.estimatedPnl.toString(),
        feeCharged: prepared.estimatedFee.toString(),
        positionId,
        orderId: prepared.orderId,
        txHashes,
      }).catch((error) => {
        logger.warn(
          'Failed to track on-chain trade_closed event',
          { error: error instanceof Error ? error.message : String(error) },
          'PerpClose'
        );
      });

      const closingSide = prepared.side === 'long' ? 'short' : 'long';
      fireAndForgetWithRetry(
        () =>
          handlePlayerTrade(
            user.userId,
            prepared.symbol,
            closingSide,
            prepared.sizeUsd
          ),
        {
          logContext: 'PerpClose',
          metadata: {
            userId: user.userId,
            ticker: prepared.symbol,
            side: closingSide,
            size: prepared.sizeUsd,
            settlementMode: 'onchain',
          },
        }
      );

      return successResponse({
        settlementMode: 'onchain',
        position: {
          id: prepared.positionId,
          ticker: prepared.symbol,
          side: prepared.side,
          entryPrice: 0,
          currentPrice: Number(prepared.indexPrice / 10n ** 6n) / 100,
          size: prepared.sizeUsd,
          leverage: 0,
          fundingPaid: 0,
          exitPrice: Number(prepared.estimatedExecutionPrice / 10n ** 6n) / 100,
          realizedPnL: Number(prepared.estimatedPnl / 10n ** 16n) / 100,
        },
        order: {
          id: prepared.orderId,
          marketId: prepared.marketId,
          status: 'queued',
          orderType: prepared.orderType,
          acceptablePrice: prepared.acceptablePrice.toString(),
          triggerPrice:
            prepared.triggerPrice > 0n
              ? prepared.triggerPrice.toString()
              : null,
          estimatedExecutionPrice: prepared.estimatedExecutionPrice.toString(),
          expiry: prepared.expiry,
          txHashes,
        },
        grossSettlement:
          Number(prepared.estimatedSettlement / 10n ** 16n) / 100,
        netSettlement: Number(prepared.estimatedSettlement / 10n ** 16n) / 100,
        marginReturned:
          Number(prepared.estimatedMarginReturned / 10n ** 16n) / 100,
        pnl: Number(prepared.estimatedPnl / 10n ** 16n) / 100,
        fee: {
          amount: Number(prepared.estimatedFee / 10n ** 16n) / 100,
          referrerPaid: 0,
        },
        wasLiquidated: false,
        newBalance: null,
      });
    }

    // Create service with fee processor, broadcast, and price impact protection
    // Price impact adjustment (BF-75) is handled inside the service via PriceImpactPort,
    // using average fill pricing for fair close execution.
    const service = createPerpMarketService({
      withFeeProcessor: true,
      withBroadcast: true,
      withPriceImpact: true,
    });

    const result = await service.closePosition({
      userId: user.userId,
      positionId,
      percentage: parsed.percentage,
      maxSlippage: parsed.slippage,
    });

    // Track analytics event (fire and forget)
    trackServerEvent(user.userId, 'trade_closed', {
      type: 'perp',
      ticker: result.ticker,
      side: result.side,
      size: result.size,
      leverage: result.leverage,
      entryPrice: result.entryPrice ?? 0,
      exitPrice: result.exitPrice ?? 0,
      realizedPnL: result.realizedPnL ?? 0,
      pnlPercent:
        result.marginPaid && result.marginPaid > 0
          ? ((result.realizedPnL ?? 0) / result.marginPaid) * 100
          : 0,
      feeCharged: result.feePaid,
      wasLiquidated: false,
      positionId,
    }).catch((error) => {
      logger.warn(
        'Failed to track trade_closed event',
        { error: error instanceof Error ? error.message : String(error) },
        'PerpClose'
      );
    });

    // Handle player influence - closing positions also affects NPC memory
    // The opposite side represents the closing action
    const closingSide = result.side === 'long' ? 'short' : 'long';
    fireAndForgetWithRetry(
      () =>
        handlePlayerTrade(user.userId, result.ticker, closingSide, result.size),
      {
        logContext: 'PerpClose',
        metadata: {
          userId: user.userId,
          ticker: result.ticker,
          side: closingSide,
          size: result.size,
        },
      }
    );

    return successResponse({
      position: result,
      grossSettlement:
        result.realizedPnL !== undefined && result.marginPaid !== undefined
          ? result.marginPaid + result.realizedPnL
          : undefined,
      netSettlement:
        result.realizedPnL !== undefined && result.marginPaid !== undefined
          ? Math.max(0, result.marginPaid + result.realizedPnL - result.feePaid)
          : undefined,
      marginReturned: result.marginPaid,
      pnl: result.realizedPnL,
      fee: {
        amount: result.feePaid,
        referrerPaid: 0,
      },
      wasLiquidated: false,
      newBalance: result.balance,
    });
  }
);
