import { successResponse, withErrorHandling } from '@babylon/api';
import {
  PredictionDbAdapter,
  PredictionMarketService,
} from '@babylon/core/markets/prediction';
import { PredictionMarketIdSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  limit: z
    .preprocess(
      (value) => (value === null ? undefined : value),
      z.coerce.number().min(1).max(1000)
    )
    .optional()
    .default(200),
});

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id: marketId } = PredictionMarketIdSchema.parse(
      await context.params
    );
    const { searchParams } = new URL(request.url);
    const { limit } = QuerySchema.parse({ limit: searchParams.get('limit') });

    const service = new PredictionMarketService({
      db: new PredictionDbAdapter(),
      // Lecture uniquement: wallet/fees neutres
      wallet: {
        debit: async () => {},
        credit: async () => {},
        recordPnL: async () => {},
        getBalance: async () => ({ balance: 0 }),
      },
      fees: {
        tradingFeeRate: 0,
        platformShare: 0,
        referrerShare: 0,
        minFeeAmount: 0,
      },
    });

    const history = await service.getPriceHistory(marketId, limit);

    return successResponse({
      marketId,
      history: history.reverse().map((point) => ({
        id: point.id,
        yesPrice: point.yesPrice,
        noPrice: point.noPrice,
        yesShares: Number(point.yesShares),
        noShares: Number(point.noShares),
        liquidity: Number(point.liquidity),
        eventType: point.eventType,
        source: point.source,
        timestamp: point.createdAt.toISOString(),
      })),
    });
  }
);
