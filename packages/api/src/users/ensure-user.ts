/**
 * User Management Utilities
 *
 * @description Utilities for ensuring users exist in the database and managing
 * canonical user IDs. Handles user creation and updates based on authentication
 * information.
 */

import {
  insertUserReturningCanonical,
  type NewUser,
  selectEnsureUserCanonicalByPrivyId,
  type User,
  updateUserReturningCanonical,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import type { AuthenticatedUser } from '../auth-middleware';
import { cachedDb } from '../cache/cached-database-service';

/**
 * Options for ensuring user exists
 */
export interface EnsureUserOptions {
  displayName?: string;
  username?: string | null;
  isActor?: boolean;
}

export type CanonicalUser = Pick<
  User,
  | 'id'
  | 'privyId'
  | 'username'
  | 'displayName'
  | 'walletAddress'
  | 'isActor'
  | 'profileImageUrl'
>;

/**
 * Ensure user exists in database for authenticated user
 */
export async function ensureUserForAuth(
  user: AuthenticatedUser,
  options: EnsureUserOptions = {}
): Promise<{ user: CanonicalUser }> {
  const privyId = user.privyId ?? user.userId;

  const existingUser = await asSystem(
    async (c) => selectEnsureUserCanonicalByPrivyId(c, privyId),
    'ensure-user-select-by-privy'
  );

  if (existingUser) {
    const updateData: Partial<NewUser> = {};

    if (
      user.walletAddress &&
      user.walletAddress !== existingUser.walletAddress
    ) {
      updateData.walletAddress = user.walletAddress;
    }
    if (
      options.username !== undefined &&
      options.username !== existingUser.username
    ) {
      updateData.username = options.username;
    }
    if (
      options.isActor !== undefined &&
      options.isActor !== existingUser.isActor
    ) {
      updateData.isActor = options.isActor;
    }
    if (options.displayName !== undefined && !existingUser.displayName) {
      updateData.displayName = options.displayName;
    }

    if (Object.keys(updateData).length > 0) {
      const oldUsername = existingUser.username;
      const oldPrivyId = existingUser.privyId;

      const updatedUser = await asSystem(
        async (c) =>
          updateUserReturningCanonical(c, existingUser.id, updateData),
        'ensure-user-update'
      );

      if (!updatedUser) {
        throw new Error('ensureUserForAuth: update returned no row');
      }

      user.dbUserId = updatedUser.id;

      const usernameChanged =
        options.username !== undefined && oldUsername !== updatedUser.username;
      const privyIdChanged = oldPrivyId !== updatedUser.privyId;

      await cachedDb.invalidateUserIdentifierCaches(
        {
          id: updatedUser.id,
          privyId: updatedUser.privyId,
          username: updatedUser.username,
        },
        {
          username: usernameChanged ? oldUsername : undefined,
          privyId: privyIdChanged ? oldPrivyId : undefined,
        }
      );

      return { user: updatedUser as CanonicalUser };
    }

    user.dbUserId = existingUser.id;
    return { user: existingUser as CanonicalUser };
  }

  const createData: NewUser = {
    id: user.dbUserId ?? user.userId,
    privyId,
    isActor: options.isActor ?? false,
    totalPoints: '2000',
    totalPointsDirtyAt: new Date(),
    updatedAt: new Date(),
  };

  if (user.walletAddress) {
    createData.walletAddress = user.walletAddress;
  }
  if (options.username !== undefined) {
    createData.username = options.username ?? null;
  }
  if (options.displayName !== undefined) {
    createData.displayName = options.displayName;
  }

  const createdUser = await asSystem(
    async (c) => insertUserReturningCanonical(c, createData),
    'ensure-user-insert'
  );

  if (!createdUser) {
    throw new Error('ensureUserForAuth: insert returned no row');
  }

  user.dbUserId = createdUser.id;

  await cachedDb.invalidateUserIdentifierCaches({
    id: createdUser.id,
    privyId: createdUser.privyId,
    username: createdUser.username,
  });

  return { user: createdUser as CanonicalUser };
}

/**
 * Get canonical user ID
 */
export function getCanonicalUserId(
  user: Pick<AuthenticatedUser, 'userId' | 'dbUserId'>
): string {
  return user.dbUserId ?? user.userId;
}
