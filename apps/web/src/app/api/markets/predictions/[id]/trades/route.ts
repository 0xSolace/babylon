// GET /api/markets/predictions/[id]/trades – paginated trades for a market
import type { JsonValue } from '@babylon/api';
import {
  addPublicReadHeaders,
  getCache,
  publicRateLimit,
  setCache,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  executePredictionMarketTradesUnionPage,
  selectPredictionMarketIdQuestionById,
  selectPredictionTradeUserDisplaySlicesByIds,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { error, rateLimitInfo, user } = await publicRateLimit(request);
    if (error) return error;

    const { id: marketId } = await context.params;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = QuerySchema.parse({
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
    });

    logger.info(
      'Prediction market trades requested',
      { marketId, queryParams },
      'GET /api/markets/predictions/[id]/trades'
    );

    // Check Redis cache first
    const cacheKey = `prediction-trades:v2:${marketId}:${queryParams.limit}:${queryParams.offset}`;
    const cached = await getCache<Record<string, JsonValue>>(cacheKey);

    if (cached) {
      return successResponse(cached);
    }

    return runWithOptionalUserRls(user, async (db) => {
      const market = await selectPredictionMarketIdQuestionById(db, marketId);

      if (!market) {
        return successResponse({ error: 'Market not found' }, 404);
      }

      const limitPlusOne = queryParams.limit + 1;

      const tradeRows = await executePredictionMarketTradesUnionPage(db, {
        marketId,
        limit: limitPlusOne,
        offset: queryParams.offset,
      });

      const hasMore = tradeRows.length > queryParams.limit;
      const pageRows = hasMore
        ? tradeRows.slice(0, queryParams.limit)
        : tradeRows;

      const userIds = [
        ...new Set(pageRows.map((row) => row.userId).filter(Boolean)),
      ] as string[];
      const userRows = await selectPredictionTradeUserDisplaySlicesByIds(
        db,
        userIds
      );
      const userMap = new Map(userRows.map((u) => [u.id, u]));

      const trades = pageRows.map((row) => {
        const timestamp = new Date(Number(row.timestampMs)).toISOString();
        if (row.type === 'balance') {
          return {
            id: row.id,
            type: 'balance' as const,
            user: userMap.get(row.userId) ?? null,
            transactionType: row.transactionType,
            amount: Number(row.amount),
            timestamp,
            marketId,
          };
        }

        return {
          id: row.id,
          type: 'npc' as const,
          user: userMap.get(row.userId) ?? null,
          marketType: row.marketType ?? 'prediction',
          ticker: row.ticker ?? '',
          action: row.action ?? 'unknown',
          side: row.side ?? null,
          amount: Number(row.amount),
          price: Number(row.price ?? 0),
          sentiment: row.sentiment != null ? Number(row.sentiment) : null,
          reason: row.reason ?? null,
          timestamp,
        };
      });

      const result = {
        trades,
        total: queryParams.offset + trades.length + (hasMore ? 1 : 0),
        hasMore,
        marketId: market.id,
        question: market.question,
      };

      // Cache briefly; feed is also updated via SSE.
      await setCache(cacheKey, result, { ttl: 10, namespace: 'market-trades' });

      const res = successResponse(result);
      if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
      return res;
    });
  }
);
