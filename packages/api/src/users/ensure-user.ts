/**
 * User Management Utilities
 *
 * @description Utilities for ensuring users exist in the database and managing
 * canonical user IDs. Handles user creation and updates based on authentication
 * information.
 */

import { db, type User } from '@babylon/db'
import type { AuthenticatedUser } from '@babylon/shared'
import { toNull } from '@jejunetwork/shared'

/**
 * Options for ensuring user exists
 *
 * @description Configuration options for user creation/update.
 */
export interface EnsureUserOptions {
  displayName?: string
  username?: string | null
  isActor?: boolean
}

export type CanonicalUser = Pick<
  User,
  | 'id'
  | 'oauth3Id'
  | 'username'
  | 'displayName'
  | 'walletAddress'
  | 'isActor'
  | 'profileImageUrl'
>

/**
 * Ensure user exists in database for authenticated user
 *
 * @description Creates or updates a user record based on authenticated user
 * information. Uses upsert to handle both new and existing users. Updates
 * dbUserId on the authenticated user object.
 *
 * @param {AuthenticatedUser} user - Authenticated user information
 * @param {EnsureUserOptions} [options={}] - Options for user creation/update
 * @returns {Promise<{user: CanonicalUser}>} Canonical user object
 *
 * @example
 * ```typescript
 * const { user } = await ensureUserForAuth(authUser, {
 *   username: 'alice',
 *   displayName: 'Alice'
 * });
 * ```
 */
export async function ensureUserForAuth(
  user: AuthenticatedUser,
  options: EnsureUserOptions = {},
): Promise<{ user: CanonicalUser }> {
  const oauth3Id = user.oauth3Id ?? user.userId

  const toCanonicalUser = (u: User): CanonicalUser => ({
    id: u.id,
    oauth3Id: u.oauth3Id,
    username: u.username,
    displayName: u.displayName,
    walletAddress: u.walletAddress,
    isActor: u.isActor,
    profileImageUrl: u.profileImageUrl,
  })

  const existingUser = await db.user.findFirst({ where: { oauth3Id } })

  if (existingUser) {
    const now = new Date()
    const updateData: {
      walletAddress?: string | null
      username?: string | null
      isActor?: boolean
      displayName?: string | null
      updatedAt?: Date
    } = {}

    if (
      user.walletAddress !== undefined &&
      user.walletAddress !== existingUser.walletAddress
    ) {
      updateData.walletAddress = toNull(user.walletAddress)
    }

    if (
      options.username !== undefined &&
      options.username !== existingUser.username
    ) {
      updateData.username = options.username
    }

    if (
      options.isActor !== undefined &&
      options.isActor !== existingUser.isActor
    ) {
      updateData.isActor = options.isActor
    }

    if (
      options.displayName !== undefined &&
      existingUser.displayName === null
    ) {
      updateData.displayName = options.displayName
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = now
      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: updateData,
      })
      user.dbUserId = updatedUser.id
      return { user: toCanonicalUser(updatedUser) }
    }

    user.dbUserId = existingUser.id
    return { user: toCanonicalUser(existingUser) }
  }

  const createdUser = await db.user.create({
    data: {
      id: user.dbUserId ?? user.userId,
      oauth3Id,
      isActor: options.isActor ?? false,
      walletAddress: toNull(user.walletAddress),
      username: toNull(options.username),
      displayName: toNull(options.displayName),
      updatedAt: new Date(),
    },
  })

  user.dbUserId = createdUser.id
  return { user: toCanonicalUser(createdUser) }
}

/**
 * Get canonical user ID
 *
 * @description Returns the database user ID if available, otherwise falls
 * back to the authentication user ID. Ensures a consistent user ID format.
 *
 * @param {Pick<AuthenticatedUser, 'userId' | 'dbUserId'>} user - User object with IDs
 * @returns {string} Canonical user ID
 *
 * @example
 * ```typescript
 * const userId = getCanonicalUserId(authUser);
 * // Returns dbUserId if set, otherwise userId
 * ```
 */
export function getCanonicalUserId(
  user: Pick<AuthenticatedUser, 'userId' | 'dbUserId'>,
): string {
  return user.dbUserId ?? user.userId
}
