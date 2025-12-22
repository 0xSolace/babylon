export const dynamic = 'force-dynamic';

import { successResponse, withErrorHandling } from '@babylon/api';
import { db, desc, eq, predictionPriceHistories } from '@babylon/db';
import { HistoryQuerySchema, PredictionMarketIdSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id: marketId } = PredictionMarketIdSchema.parse(
      await context.params
    );
    const { searchParams } = new URL(request.url);
    const { limit } = HistoryQuerySchema.parse({
      limit: searchParams.get('limit'),
    });

    const history = await db
      .select()
      .from(predictionPriceHistories)
      .where(eq(predictionPriceHistories.marketId, marketId))
      .orderBy(desc(predictionPriceHistories.createdAt))
      .limit(limit);

    return successResponse({
      marketId,
      history: history.reverse().map((point) => ({
        id: point.id,
        yesPrice: Number(point.yesPrice),
        noPrice: Number(point.noPrice),
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
