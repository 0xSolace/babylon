// GET /api/markets/predictions/[id]/trades – paginated trades for a market
import type { JsonValue } from '@babylon/api';
import {
  cacheGet,
  cacheSet,
  optionalAuth,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { db } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

interface BalanceTransactionRow {
  id: string;
  type: string;
  amount: string | number;
  userId: string;
  createdAt: Date;
}

interface UserRow {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  isActor: boolean;
}

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    // Optional auth - trades are public
    await optionalAuth(request).catch(() => null);

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
    const cacheKey = `prediction-trades:${marketId}:${queryParams.limit}:${queryParams.offset}`;
    const cached = await cacheGet<Record<string, JsonValue>>(cacheKey);

    if (cached) {
      return successResponse(cached);
    }

    // Verify market exists using repository
    const market = await db.market.findFirst({
      where: { id: { equals: marketId } },
    });

    if (!market) {
      return successResponse({ error: 'Market not found' }, 404);
    }

    // Prediction trades are recorded as balance transactions with relatedId = marketId.
    // Use raw SQL for complex IN clause with multiple conditions
    const txRows = await db.query<BalanceTransactionRow>(
      `SELECT "id", "type", "amount", "userId", "createdAt"
       FROM "BalanceTransaction"
       WHERE "relatedId" = $1
         AND "type" IN ('pred_buy', 'pred_sell')
       ORDER BY "createdAt" DESC
       LIMIT $2
       OFFSET $3`,
      [marketId, queryParams.limit + 1, queryParams.offset]
    );

    const hasMore = txRows.length > queryParams.limit;
    const pageRows = hasMore ? txRows.slice(0, queryParams.limit) : txRows;

    const userIds = [...new Set(pageRows.map((row) => row.userId))];
    const userRows: UserRow[] =
      userIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
              isActor: true,
            },
          })
        : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    const trades = pageRows.map((tx) => ({
      id: tx.id,
      type: 'balance' as const,
      user: userMap.get(tx.userId) ?? null,
      transactionType: tx.type,
      amount: Number(tx.amount),
      timestamp:
        tx.createdAt instanceof Date
          ? tx.createdAt.toISOString()
          : tx.createdAt,
      marketId,
    }));

    const result = {
      trades,
      total: queryParams.offset + trades.length + (hasMore ? 1 : 0),
      hasMore,
      marketId: market.id,
      question: market.question,
    };

    // Cache for 30 seconds
    await cacheSet(cacheKey, result, 30);

    logger.info(
      `Returned ${trades.length} trades for prediction market ${marketId}`,
      { total: result.total, hasMore },
      'PredictionTrades'
    );

    return successResponse(result);
  }
);
