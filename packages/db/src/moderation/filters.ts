/**
 * Moderation Filters
 *
 * Helper functions for filtering content based on user blocks and mutes.
 * Uses CQL (CovenantSQL) for all database operations.
 */

import { getCQLClient } from '../cql-client';

/**
 * Get list of user IDs that the current user has blocked.
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const db = getCQLClient();
  const blocks = await db.userBlock.findMany({
    where: { blockerId: userId },
  });
  return blocks.map((b) => b.blockedId as string);
}

/**
 * Get list of user IDs that have blocked the current user.
 */
export async function getBlockedByUserIds(userId: string): Promise<string[]> {
  const db = getCQLClient();
  const blocks = await db.userBlock.findMany({
    where: { blockedId: userId },
  });
  return blocks.map((b) => b.blockerId as string);
}

/**
 * Get list of user IDs that the current user has muted.
 */
export async function getMutedUserIds(userId: string): Promise<string[]> {
  const db = getCQLClient();
  const mutes = await db.userMute.findMany({
    where: { muterId: userId },
  });
  return mutes.map((m) => m.mutedId as string);
}

/**
 * Get all user IDs that should be filtered from the current user's feed.
 * Includes users blocked by the current user and users who have blocked the current user.
 */
export async function getFilteredUserIds(userId: string): Promise<string[]> {
  const [blockedByMe, blockedMe] = await Promise.all([
    getBlockedUserIds(userId),
    getBlockedByUserIds(userId),
  ]);

  return [...new Set([...blockedByMe, ...blockedMe])];
}

/**
 * Check if one user has blocked another user.
 */
export async function hasBlocked(
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  const db = getCQLClient();
  const block = await db.userBlock.findFirst({
    where: { blockerId, blockedId },
  });
  return block !== null;
}

/**
 * Check if one user has muted another user.
 */
export async function hasMuted(
  muterId: string,
  mutedId: string
): Promise<boolean> {
  const db = getCQLClient();
  const mute = await db.userMute.findFirst({
    where: { muterId, mutedId },
  });
  return mute !== null;
}

/**
 * Filter an array of posts to exclude those from blocked or muted users.
 */
export function filterPostsByModeration<T extends { authorId?: string }>(
  posts: T[],
  blockedUserIds: string[],
  mutedUserIds: string[] = []
): T[] {
  const excludedIds = new Set([...blockedUserIds, ...mutedUserIds]);

  return posts.filter((post) => {
    if (!post.authorId) return true;
    return !excludedIds.has(post.authorId);
  });
}

/**
 * Build a where clause object to exclude blocked users from queries.
 */
export function buildBlockedUsersWhereClause(blockedUserIds: string[]) {
  if (blockedUserIds.length === 0) {
    return {};
  }

  return {
    authorId: {
      notIn: blockedUserIds,
    },
  };
}
