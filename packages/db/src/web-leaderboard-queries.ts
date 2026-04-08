/**
 * SQL for `apps/web` GET /api/leaderboard (following flags on page users).
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { follows } from './tables/follows';

type LeaderboardDb = DrizzleClient | Transaction;

export async function selectFollowingIdsForFollowerInCandidateList(
  db: LeaderboardDb,
  params: { followerId: string; candidateFollowingIds: string[] }
): Promise<string[]> {
  if (params.candidateFollowingIds.length === 0) return [];
  const rows = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, params.followerId),
        inArray(follows.followingId, params.candidateFollowingIds)
      )
    );
  return rows.map((r) => r.followingId);
}
