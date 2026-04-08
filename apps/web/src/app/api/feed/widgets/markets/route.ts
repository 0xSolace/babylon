/**
 * Markets Widget API
 *
 * @route GET /api/feed/widgets/markets - Get trending markets
 * @access Public (optional authentication for RLS)
 *
 * @description
 * Returns trending prediction markets for sidebar widget. Includes caching
 * for performance. Optional authentication applies RLS for personalized results.
 *
 * @openapi
 * /api/feed/widgets/markets:
 *   get:
 *     tags:
 *       - Feed
 *     summary: Get trending markets
 *     description: Returns trending prediction markets for widget (optional auth for RLS)
 *     security:
 *       - PrivyAuth: []
 *     responses:
 *       200:
 *         description: Markets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 markets:
 *                   type: array
 *       401:
 *         description: Unauthorized
 *
 * @example
 * ```typescript
 * const { markets } = await fetch('/api/feed/widgets/markets')
 *   .then(r => r.json());
 * ```
 */

import {
  type AuthenticatedUser,
  CACHE_KEYS,
  DEFAULT_TTLS,
  getCacheOrFetch,
  optionalAuth,
  withErrorHandling,
} from '@babylon/api';
import type { DrizzleClient } from '@babylon/db';
import { getActiveQuestionsWithTimeframe } from '@babylon/db/engine-storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';
import {
  formatMarketsWidgetRows,
  MARKETS_WIDGET_RECENT_POSITIONS_MS,
} from '@/lib/feed/markets-widget-format';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

async function loadMarketsWidgetData(
  run: <T>(fn: (database: DrizzleClient) => Promise<T>) => Promise<T>
) {
  const questions = await run(async (database) =>
    getActiveQuestionsWithTimeframe(database)
  );
  if (questions.length === 0) {
    return [];
  }

  const marketIds = questions.map((q) => String(q.id));
  const twentyFourHoursAgo = new Date(
    Date.now() - MARKETS_WIDGET_RECENT_POSITIONS_MS
  );

  const markets = await run(async (database) => {
    return await database.market.findMany({
      where: { id: { in: marketIds } },
      orderBy: { createdAt: 'desc' },
    });
  });

  const recentPositions = await run(async (database) => {
    return await database.position.findMany({
      where: {
        marketId: { in: marketIds },
        createdAt: { gte: twentyFourHoursAgo },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  return formatMarketsWidgetRows(questions, markets, recentPositions);
}

export const GET = withErrorHandling(async function GET(request: NextRequest) {
  const authUser: AuthenticatedUser | null = await optionalAuth(request).catch(
    () => null
  );

  if (!authUser || !authUser.userId) {
    const formattedMarkets = await getCacheOrFetch(
      'markets-widget-v2',
      () => loadMarketsWidgetData((fn) => runWithOptionalUserRls(null, fn)),
      {
        namespace: CACHE_KEYS.WIDGET,
        ttl: DEFAULT_TTLS.WIDGET,
      }
    );

    return NextResponse.json({
      success: true,
      markets: formattedMarkets,
    });
  }

  const formattedMarkets = await loadMarketsWidgetData((fn) =>
    runWithOptionalUserRls(authUser, fn)
  );

  return NextResponse.json({
    success: true,
    markets: formattedMarkets,
  });
});
