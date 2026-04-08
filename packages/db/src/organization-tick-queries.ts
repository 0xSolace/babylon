/**
 * SQL for POST /api/cron/organization-tick (recent post cooldown + org post insert).
 */

import { desc, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { posts } from './tables/posts';

export type OrgRecentPostRow = {
  authorId: string;
  latestPost: Date | null;
};

/** Latest posts for org author ids (ordered by timestamp desc) for cooldown logic. */
export async function selectRecentOrgAuthorPostsForCooldown(
  orgIds: string[],
  limit: number
): Promise<OrgRecentPostRow[]> {
  if (orgIds.length === 0) {
    return [];
  }
  return asSystem(
    (tx) =>
      tx
        .select({
          authorId: posts.authorId,
          latestPost: posts.timestamp,
        })
        .from(posts)
        .where(inArray(posts.authorId, orgIds))
        .orderBy(desc(posts.timestamp))
        .limit(limit),
    'organization-tick-recent-org-posts'
  );
}

export type OrganizationTickPostInsert = {
  id: string;
  content: string;
  authorId: string;
  gameId: string;
  dayNumber: number;
  timestamp: Date;
  createdAt: Date;
  type: 'post';
};

export async function insertOrganizationTickPost(
  row: OrganizationTickPostInsert
): Promise<void> {
  await asSystem(
    (tx) => tx.insert(posts).values(row),
    'organization-tick-insert-post'
  );
}
