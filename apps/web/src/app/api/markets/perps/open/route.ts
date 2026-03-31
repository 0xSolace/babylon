import {
  authenticate,
  checkProgress,
  checkRateLimitAsync,
  invalidateMarketsApiPerpsSnapshot,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { handlePlayerTrade } from '@babylon/engine';
import {
  fireAndForgetWithRetry,
  logger,
  PerpOpenPositionSchema,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { trackServerEvent } from '@/lib/posthog/server';
import { createPerpMarketService } from '../_adapters';
import {
  authenticateOnchainPerpUser,
  getOnchainPerpService,
  isOnchainPerpModeEnabled,
  logOnchainPerpRoute,
  resolvePerpUserWallet,
  submitPerpTransactionCalls,
} from '../_onchain';

/**
 * POST /api/markets/perps/open
 * Open a new perpetual futures position.
 *
 * Uses PerpMarketService with SSE broadcast and price impact protection.
 * Price impact adjustment (BF-75) is handled inside the service via PriceImpactPort,
 * ensuring ALL position creation paths (open, add, flip) are protected.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const onchainMode = isOnchainPerpModeEnabled();
  const user = onchainMode
    ? await authenticateOnchainPerpUser(request)
    : await authenticate(request);

  // Rate limit: 10 positions per minute per user
  const rateLimitResult = await checkRateLimitAsync(
    user.userId,
    RATE_LIMIT_CONFIGS.OPEN_POSITION
  );
  if (!rateLimitResult.allowed)
    return rateLimitError(rateLimitResult.retryAfter);

  const body = await request.json();
  const { ticker, side, size, leverage, maxSlippage, orderType, limitPrice } =
    PerpOpenPositionSchema.parse(body);

  const normalizedSide = side.toLowerCase() as 'long' | 'short';
  const numericSize = typeof size === 'string' ? Number(size) : size;

  if (onchainMode) {
    logOnchainPerpRoute('PerpOpen');

    const wallet = await resolvePerpUserWallet(
      user.dbUserId ?? user.userId,
      user.walletAddress
    );
    const service = getOnchainPerpService();
    const prepared = await service.prepareOpenOrder({
      account: wallet.walletAddress,
      ticker,
      side: normalizedSide,
      sizeUsd: numericSize,
      leverage,
      maxSlippage,
      orderType,
      limitPrice,
    });
    const txHashes = await submitPerpTransactionCalls({
      wallet,
      calls: prepared.calls,
      context: 'perp-open',
    });

    trackServerEvent(user.userId, 'trade_opened', {
      type: 'perp',
      settlementMode: 'onchain',
      ticker,
      side: normalizedSide,
      size: prepared.sizeUsd,
      leverage,
      orderType,
      limitPrice: limitPrice ?? null,
      entryPrice: prepared.estimatedExecutionPrice.toString(),
      marginPaid: prepared.collateralRequired.toString(),
      feeCharged: prepared.estimatedFee.toString(),
      orderId: prepared.orderId,
      txHashes,
    }).catch((error) => {
      logger.warn(
        'Failed to track on-chain trade_opened event',
        { error: error instanceof Error ? error.message : String(error) },
        'PerpOpen'
      );
    });

    fireAndForgetWithRetry(
      () =>
        handlePlayerTrade(
          user.userId,
          ticker,
          normalizedSide,
          prepared.sizeUsd
        ),
      {
        logContext: 'PerpOpen',
        metadata: {
          userId: user.userId,
          ticker,
          side: normalizedSide,
          size: prepared.sizeUsd,
          settlementMode: 'onchain',
        },
      }
    );

    void checkProgress(user.userId, { type: 'perp_trade', ticker });

    return successResponse(
      {
        settlementMode: 'onchain',
        position: {
          id: prepared.positionId,
          ticker,
          side: normalizedSide,
          entryPrice:
            Number(prepared.estimatedExecutionPrice / 10n ** 6n) / 100,
          currentPrice: Number(prepared.indexPrice / 10n ** 6n) / 100,
          size: prepared.sizeUsd,
          leverage,
          fundingPaid: 0,
          openedAt: new Date().toISOString(),
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
        marginPaid: Number(prepared.collateralRequired / 10n ** 16n) / 100,
        fee: {
          amount: Number(prepared.estimatedFee / 10n ** 16n) / 100,
          referrerPaid: 0,
        },
        newBalance: null,
      },
      201
    );
  }

  // Create service with fee processor, broadcast, and price impact protection
  const service = createPerpMarketService({
    withFeeProcessor: true,
    withBroadcast: true,
    withPriceImpact: true,
  });

  const result = await service.openPosition({
    userId: user.userId,
    ticker,
    side: normalizedSide,
    size: numericSize,
    leverage,
  });

  // Track analytics event (fire and forget)
  trackServerEvent(user.userId, 'trade_opened', {
    type: 'perp',
    ticker,
    side: normalizedSide,
    size: numericSize,
    leverage,
    entryPrice: result.entryPrice ?? 0,
    marginPaid: result.marginPaid ?? 0,
    feeCharged: result.feePaid,
    positionId: result.positionId,
  }).catch((error) => {
    logger.warn(
      'Failed to track trade_opened event',
      { error: error instanceof Error ? error.message : String(error) },
      'PerpOpen'
    );
  });

  // Handle player influence - significant trades affect NPC memory
  // This adds the trade to NPC memories of affiliated actors
  fireAndForgetWithRetry(
    () => handlePlayerTrade(user.userId, ticker, normalizedSide, numericSize),
    {
      logContext: 'PerpOpen',
      metadata: {
        userId: user.userId,
        ticker,
        side: normalizedSide,
        size: numericSize,
      },
    }
  );

  void checkProgress(user.userId, { type: 'perp_trade', ticker });
  void invalidateMarketsApiPerpsSnapshot();

  return successResponse(
    {
      position: result,
      marginPaid: result.marginPaid,
      fee: {
        amount: result.feePaid,
        referrerPaid: 0,
      },
      newBalance: result.balance,
    },
    201
  );
});
