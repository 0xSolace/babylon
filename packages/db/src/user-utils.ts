/**
 * User utility functions for blocking, muting, etc.
 */

import { and, eq } from 'drizzle-orm';
import { db } from './cql-client';
import { userBlocks, userMutes } from './schema';

/**
 * Check if a user has blocked another user
 * @param blockerId - The user who may have blocked
 * @param blockedId - The user who may be blocked
 * @returns true if blockerId has blocked blockedId
 */
export async function hasBlocked(
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  const [result] = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      )
    )
    .limit(1);
  return result !== undefined;
}

/**
 * Get IDs of all users that a user has blocked
 * @param userId - The user who may have blocked others
 * @returns Array of blocked user IDs
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const results = await db
    .select({ blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, userId));
  return results.map((r) => r.blockedId);
}

/**
 * Get IDs of all users that have blocked a user
 * @param userId - The user who may be blocked by others
 * @returns Array of user IDs who have blocked this user
 */
export async function getBlockedByUserIds(userId: string): Promise<string[]> {
  const results = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(eq(userBlocks.blockedId, userId));
  return results.map((r) => r.blockerId);
}

/**
 * Get IDs of all users that a user has muted
 * @param userId - The user who may have muted others
 * @returns Array of muted user IDs
 */
export async function getMutedUserIds(userId: string): Promise<string[]> {
  const results = await db
    .select({ mutedId: userMutes.mutedId })
    .from(userMutes)
    .where(eq(userMutes.muterId, userId));
  return results.map((r) => r.mutedId);
}
