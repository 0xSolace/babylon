/**
 * User utility functions for blocking, muting, etc.
 */

import { db } from './eqlite-client'

/**
 * Check if a user has blocked another user
 * @param blockerId - The user who may have blocked
 * @param blockedId - The user who may be blocked
 * @returns true if blockerId has blocked blockedId
 */
export async function hasBlocked(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const result = await db.userBlock.findFirst({
    where: { blockerId, blockedId },
  })
  return result !== null
}

/**
 * Get IDs of all users that a user has blocked
 * @param userId - The user who may have blocked others
 * @returns Array of blocked user IDs
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const results = await db.userBlock.findMany({
    where: { blockerId: userId },
  })
  return results.map((r: { blockedId: string }) => r.blockedId)
}

/**
 * Get IDs of all users that have blocked a user
 * @param userId - The user who may be blocked by others
 * @returns Array of user IDs who have blocked this user
 */
export async function getBlockedByUserIds(userId: string): Promise<string[]> {
  const results = await db.userBlock.findMany({
    where: { blockedId: userId },
  })
  return results.map((r: { blockerId: string }) => r.blockerId)
}

/**
 * Get IDs of all users that a user has muted
 * @param userId - The user who may have muted others
 * @returns Array of muted user IDs
 */
export async function getMutedUserIds(userId: string): Promise<string[]> {
  const results = await db.userMute.findMany({
    where: { muterId: userId },
  })
  return results.map((r: { mutedId: string }) => r.mutedId)
}

/**
 * Check if a user has muted another user
 * @param muterId - The user who may have muted
 * @param mutedId - The user who may be muted
 * @returns true if muterId has muted mutedId
 */
export async function hasMuted(
  muterId: string,
  mutedId: string,
): Promise<boolean> {
  const result = await db.userMute.findFirst({
    where: { muterId, mutedId },
  })
  return result !== null
}
