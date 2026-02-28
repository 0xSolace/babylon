import {
  recordCronExecution,
  requireCronAuth,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { PerpDbAdapter, PerpMarketService } from '@babylon/core/markets/perps';
import { FEE_CONFIG, WalletService } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const maxDuration = 300;

export const POST = withErrorHandling(async (request: NextRequest) => {
  const startTime = new Date();

  // Use centralized cron auth (fail-closed in production)
  requireCronAuth(request, { jobName: 'PerpFunding' });

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
  });

  await service.processFundingAndLiquidations();

  logger.info(
    'Perp funding step executed via cron',
    undefined,
    'Cron:perp-funding'
  );

  // Record metrics
  recordCronExecution('perp-funding', startTime, { success: true });

  return successResponse({ success: true });
});
