/**
 * User Lookup Utilities
 *
 * @description Utilities for finding users by various identifiers (ID, oauth3Id, username).
 */

import { db, type User } from '@babylon/db'
import { NotFoundError } from '@jejunetwork/shared'

/**
 * Find user by identifier (ID, oauth3Id, or username)
 *
 * @description Searches for a user by their ID, oauth3Id, or username.
 * Returns null if no user is found.
 *
 * @param {string} identifier - The user ID, oauth3Id, or username
 * @param {Record<string, boolean>} [_select] - Optional select fields (for compatibility, currently ignored)
 * @returns {Promise<User | null>} User object or null if not found
 *
 * @example
 * ```typescript
 * const user = await findUserByIdentifier('alice');
 * if (user) {
 *   console.log(user.displayName);
 * }
 * ```
 */
export async function findUserByIdentifier(
  identifier: string,
  _select?: Record<string, boolean>,
): Promise<User | null> {
  // `_select` kept for backward compatibility. EQLite repositories currently
  // return full rows.
  void _select
  return (await db.user.findFirst({
    where: {
      OR: [
        { id: identifier },
        { oauth3Id: identifier },
        { username: identifier },
      ],
    },
  })) as User | null
}

/**
 * Find user by identifier with custom select fields
 *
 * @description Searches for a user with a custom selection of fields.
 *
 * @param {string} identifier - The user ID, oauth3Id, or username
 * @param {T} select - Fields to select
 * @returns {Promise<T | null>} Selected fields or null if not found
 *
 * @example
 * ```typescript
 * const user = await findUserByIdentifierWithSelect('alice', {
 *   id: users.id,
 *   username: users.username,
 * });
 * ```
 */
export async function findUserByIdentifierWithSelect(
  identifier: string,
  _select: Record<string, boolean>,
): Promise<User | null> {
  void _select
  return findUserByIdentifier(identifier)
}

/**
 * Require user by identifier (throws if not found)
 *
 * @description Searches for a user and throws NotFoundError if not found.
 *
 * @param {string} identifier - The user ID, oauth3Id, or username
 * @param {Record<string, boolean>} [_select] - Optional select fields (for compatibility)
 * @returns {Promise<User>} User object
 * @throws {NotFoundError} If user is not found
 *
 * @example
 * ```typescript
 * try {
 *   const user = await requireUserByIdentifier('alice');
 *   console.log(user.displayName);
 * } catch (e) {
 *   // Handle not found
 * }
 * ```
 */
export async function requireUserByIdentifier(
  identifier: string,
  _select?: Record<string, boolean>,
): Promise<User> {
  const user = await findUserByIdentifier(identifier)
  if (!user) {
    throw new NotFoundError('User', identifier)
  }
  return user
}
