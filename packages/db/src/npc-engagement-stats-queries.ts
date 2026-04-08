/**
 * Aggregate engagement counts for NPC social dashboards (system scope).
 */

import { and, count, gte, isNull } from 'drizzle-orm';
import { asSystem } from './db';
import { comments } from './tables/comments';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';

export type NpcEngagementStatsRow = {
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  last24hLikes: number;
  last24hShares: number;
  last24hComments: number;
};

export async function fetchNpcEngagementStats(
  since24h: Date
): Promise<NpcEngagementStatsRow> {
  return asSystem(async (c) => {
    const [[tr], [ts], [tc], [lr], [ls], [lc]] = await Promise.all([
      c.select({ n: count() }).from(reactions),
      c.select({ n: count() }).from(shares),
      c.select({ n: count() }).from(comments).where(isNull(comments.deletedAt)),
      c
        .select({ n: count() })
        .from(reactions)
        .where(gte(reactions.createdAt, since24h)),
      c
        .select({ n: count() })
        .from(shares)
        .where(gte(shares.createdAt, since24h)),
      c
        .select({ n: count() })
        .from(comments)
        .where(
          and(isNull(comments.deletedAt), gte(comments.createdAt, since24h))
        ),
    ]);

    return {
      totalLikes: Number(tr?.n ?? 0),
      totalShares: Number(ts?.n ?? 0),
      totalComments: Number(tc?.n ?? 0),
      last24hLikes: Number(lr?.n ?? 0),
      last24hShares: Number(ls?.n ?? 0),
      last24hComments: Number(lc?.n ?? 0),
    };
  }, 'npc-engagement-stats');
}
