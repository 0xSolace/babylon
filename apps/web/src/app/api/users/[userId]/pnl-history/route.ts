import {
  checkRateLimitAsync,
  getClientIp,
  RATE_LIMIT_CONFIGS,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { and, balanceTransactions, db, eq, gte } from '@babylon/db';
import { logger, UserIdParamSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const TIMEFRAME_DURATIONS: Record<string, number> = {
  '1H': 60 * 60 * 1000,
  '4H': 4 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
};

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    const clientIp = getClientIp(request.headers);
    const rateLimitConfig = clientIp
      ? RATE_LIMIT_CONFIGS.PUBLIC_BALANCE_FETCH
      : RATE_LIMIT_CONFIGS.PUBLIC_BALANCE_FETCH_ANONYMOUS;

    const rateLimitKey = clientIp ? `ip:${clientIp}` : 'ip:anonymous';
    const rateLimit = await checkRateLimitAsync(rateLimitKey, rateLimitConfig);

    if (!rateLimit.allowed) {
      const retryAfterSeconds = rateLimit.retryAfter || 60;
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const { userId } = UserIdParamSchema.parse(await context.params);
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('range') ?? '1D';

    const durationMs = TIMEFRAME_DURATIONS[timeframe];
    const cutoff = durationMs ? new Date(Date.now() - durationMs) : undefined;

    // Query balance transactions ordered by time
    const whereConditions = cutoff
      ? and(
          eq(balanceTransactions.userId, userId),
          gte(balanceTransactions.createdAt, cutoff)
        )
      : eq(balanceTransactions.userId, userId);

    const transactions = await db
      .select({
        balanceAfter: balanceTransactions.balanceAfter,
        createdAt: balanceTransactions.createdAt,
        type: balanceTransactions.type,
      })
      .from(balanceTransactions)
      .where(whereConditions)
      .orderBy(balanceTransactions.createdAt)
      .limit(500);

    // Early return for empty transactions to avoid edge cases in downsampling
    if (transactions.length === 0) {
      logger.debug(
        'No transactions found for P&L history',
        { userId, timeframe, cutoff: cutoff?.toISOString() },
        'GET /api/users/[userId]/pnl-history'
      );
      return successResponse({ points: [] });
    }

    // Downsample to reasonable number of chart points
    const maxPoints = 100;
    const points: Array<{ time: number; value: number }> = [];

    if (transactions.length <= maxPoints) {
      for (const tx of transactions) {
        points.push({
          time: tx.createdAt.getTime(),
          value: Number(tx.balanceAfter),
        });
      }
    } else {
      const step = transactions.length / maxPoints;
      for (let i = 0; i < maxPoints; i++) {
        const idx = Math.min(Math.floor(i * step), transactions.length - 1);
        const tx = transactions[idx];
        if (!tx) continue;
        points.push({
          time: tx.createdAt.getTime(),
          value: Number(tx.balanceAfter),
        });
      }
      // Always include last point
      const last = transactions[transactions.length - 1];
      const lastPoint = points[points.length - 1];
      if (last && lastPoint && lastPoint.time !== last.createdAt.getTime()) {
        points.push({
          time: last.createdAt.getTime(),
          value: Number(last.balanceAfter),
        });
      }
    }

    logger.info(
      'P&L history fetched',
      { userId, timeframe, pointCount: points.length },
      'GET /api/users/[userId]/pnl-history'
    );

    return successResponse({ points });
  }
);
