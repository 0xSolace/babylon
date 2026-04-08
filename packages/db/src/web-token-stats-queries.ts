/**
 * SQL for `apps/web` GET /api/stats/tokens (historical tick rows).
 */

import { and, desc, gte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type TickTokenStatsRow,
  tickTokenStats,
} from './tables/tick-token-stats';

type TokenStatsDb = DrizzleClient | Transaction;

export async function selectTickTokenStatsSinceOrderStartedDescLimit(
  db: TokenStatsDb,
  params: { periodStart: Date; limit: number }
): Promise<TickTokenStatsRow[]> {
  return db
    .select()
    .from(tickTokenStats)
    .where(and(gte(tickTokenStats.tickStartedAt, params.periodStart)))
    .orderBy(desc(tickTokenStats.tickStartedAt))
    .limit(params.limit);
}
