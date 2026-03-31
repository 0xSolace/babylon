import {
  addPublicReadHeaders,
  authenticate,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { PerpDbAdapter } from '@babylon/core/markets/perps';
import { PerpOpenPositionSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { createPerpMarketService } from '../_adapters';
import {
  authenticateOnchainPerpUser,
  getOnchainPerpService,
  isOnchainPerpModeEnabled,
  resolvePerpUserWallet,
} from '../_onchain';

function fromPriceUnits(value: bigint): number {
  return Number(value / 10n ** 6n) / 100;
}

function fromCollateralUnits(value: bigint): number {
  return Number(value / 10n ** 16n) / 100;
}

/**
 * POST /api/markets/perps/preview
 * Returns the canonical open-order execution preview for a perp order.
 *
 * This route intentionally reuses the same execution engine as the actual
 * order placement flow for supported cases. If the market changes before submit,
 * the preview can become stale even though the pricing logic remains identical.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { error, rateLimitInfo } = await publicRateLimit(request);
  if (error) return error;

  const body = await request.json();
  const { ticker, side, size, leverage, maxSlippage, orderType, limitPrice } =
    PerpOpenPositionSchema.parse(body);
  const normalizedSide = side.toLowerCase() as 'long' | 'short';
  const numericSize = typeof size === 'string' ? Number(size) : size;
  const onchainMode = isOnchainPerpModeEnabled();

  let preview:
    | Awaited<
        ReturnType<
          ReturnType<typeof createPerpMarketService>['previewOpenPosition']
        >
      >
    | Record<string, unknown>;

  if (onchainMode) {
    const user = await authenticateOnchainPerpUser(request);
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
    const currentPrice = fromPriceUnits(prepared.indexPrice);
    const executionPrice = fromPriceUnits(prepared.estimatedExecutionPrice);
    const quoteImpactPrice = Math.max(
      0,
      Math.abs(executionPrice - currentPrice)
    );
    const totalSlippageBps =
      (quoteImpactPrice / Math.max(currentPrice, 1)) * 10_000;
    const estimatedFee = fromCollateralUnits(prepared.estimatedFee);
    const totalRequired = fromCollateralUnits(prepared.collateralRequired);

    preview = {
      settlementMode: 'onchain',
      ticker: ticker.toUpperCase(),
      side: normalizedSide,
      size: prepared.sizeUsd,
      leverage,
      currentPrice,
      markPrice: currentPrice,
      indexPrice: currentPrice,
      quotedPrice: currentPrice,
      executionPrice,
      quoteImpactPrice,
      quoteImpactBps: totalSlippageBps,
      totalSlippageBps,
      marginRequired: Math.max(0, totalRequired - estimatedFee),
      estimatedFee,
      totalRequired,
    };
  } else {
    let authenticatedUser: Awaited<ReturnType<typeof authenticate>> | null =
      null;
    if (request.headers.get('authorization')) {
      authenticatedUser = await authenticate(request);
    }

    if (authenticatedUser) {
      const existingPosition =
        await new PerpDbAdapter().getOpenPositionByUserAndTicker(
          authenticatedUser.userId,
          ticker.toUpperCase()
        );

      if (existingPosition) {
        const res = successResponse(
          {
            error:
              'Canonical preview is unavailable for rebalance orders on this endpoint.',
            code: 'PERP_PREVIEW_REBALANCE_UNSUPPORTED',
          },
          409
        );
        if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
        return res;
      }
    }

    const service = createPerpMarketService();
    preview = {
      settlementMode: 'offchain',
      ...(await service.previewOpenPosition({
        ticker,
        side: normalizedSide,
        size: numericSize,
        leverage,
      })),
    };
  }

  const res = successResponse({ preview });
  if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
  return res;
});
