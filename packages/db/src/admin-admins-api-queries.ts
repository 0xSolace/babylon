/**
 * Admin API reads for `/api/admin/admins` (human admins only, no actors).
 */

import { and, asc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { users } from './tables/user';

export async function selectAdminHumanUsersForAdminList(db: DrizzleClient) {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      walletAddress: users.walletAddress,
      profileImageUrl: users.profileImageUrl,
      isActor: users.isActor,
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
      onChainRegistered: users.onChainRegistered,
      hasFarcaster: users.hasFarcaster,
      hasTwitter: users.hasTwitter,
      farcasterUsername: users.farcasterUsername,
      twitterUsername: users.twitterUsername,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(eq(users.isAdmin, true), eq(users.isActor, false)))
    .orderBy(asc(users.createdAt));
}
