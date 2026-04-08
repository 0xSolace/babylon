/**
 * New Markets Feed API
 *
 * @route GET /api/feed/new-markets — recently opened prediction market questions
 *
 * Returns questions opened in the last 24 h with status = 'active'.
 * Joins the markets table to include the market UUID (for deep-linking to
 * /markets/predictions/[id]) and live yes/no shares (for real probability bars).
 */
import {
  getCacheOrFetch,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { selectNewMarketsFeedRows } from '@babylon/db';
import type { ArcStateType } from '@babylon/shared';
import { toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

export interface NewMarketEntry {
  questionNumber: number;
  text: string;
  resolutionDate: string;
  createdAt: string;
  arcState: ArcStateType | null;
  /** Market UUID for deep-linking to /markets/predictions/[marketId] */
  marketId: string | null;
  /** Live YES share count — new markets always open at 0 (displayed as 50%) */
  yesShares: number;
  /** Live NO share count — new markets always open at 0 (displayed as 50%) */
  noShares: number;
}

export interface NewMarketsResponse {
  success: true;
  markets: NewMarketEntry[];
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { error: rateLimitErr, rateLimitInfo } = await publicRateLimit(
    request,
    'read'
  );
  if (rateLimitErr) return rateLimitErr;

  const cacheKey = 'feed:new-markets:v2';

  const result = await getCacheOrFetch<NewMarketEntry[]>(
    cacheKey,
    async () =>
      runWithOptionalUserRls(null, async (db) => {
        const rows = await selectNewMarketsFeedRows(db);
        return rows.map((r) => ({
          questionNumber: r.questionNumber,
          text: r.text,
          resolutionDate: toISO(r.resolutionDate),
          createdAt: toISO(r.createdAt),
          arcState: (r.arcState as ArcStateType | null) ?? null,
          marketId: r.marketId ?? null,
          yesShares: Number(r.yesShares ?? 0),
          noShares: Number(r.noShares ?? 0),
        }));
      }),
    { namespace: 'feed', ttl: 60 } // shorter TTL since odds can change
  );

  const response = successResponse({
    success: true,
    markets: result,
  } satisfies NewMarketsResponse);

  if (rateLimitInfo) {
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60'
    );
  }
  return response;
});
