/**
 * SQL for `POST /api/users/[userId]/link-social` (RLS `db`).
 */

import { and, eq, ne } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type LinkSocialDb = DrizzleClient | Transaction;

export type UserLinkSocialStateRow = {
  hasFarcaster: boolean;
  hasTwitter: boolean;
  walletAddress: string | null;
  farcasterFid: string | null;
  twitterId: string | null;
};

export async function selectUserLinkSocialStateById(
  db: LinkSocialDb,
  userId: string
): Promise<UserLinkSocialStateRow | undefined> {
  const [row] = await db
    .select({
      hasFarcaster: users.hasFarcaster,
      hasTwitter: users.hasTwitter,
      walletAddress: users.walletAddress,
      farcasterFid: users.farcasterFid,
      twitterId: users.twitterId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUserIdByFarcasterUsernameExcludingUserId(
  db: LinkSocialDb,
  farcasterUsername: string,
  excludeUserId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.farcasterUsername, farcasterUsername),
        ne(users.id, excludeUserId)
      )
    )
    .limit(1);
  return row;
}

export async function selectUserIdByTwitterUsernameExcludingUserId(
  db: LinkSocialDb,
  twitterUsername: string,
  excludeUserId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.twitterUsername, twitterUsername),
        ne(users.id, excludeUserId)
      )
    )
    .limit(1);
  return row;
}

export async function selectUserIdByWalletAddress(
  db: LinkSocialDb,
  walletAddressLower: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.walletAddress, walletAddressLower))
    .limit(1);
  return row;
}

export async function updateUserLinkSocialPatchById(
  db: LinkSocialDb,
  userId: string,
  patch: Partial<typeof users.$inferInsert>
): Promise<void> {
  await db.update(users).set(patch).where(eq(users.id, userId));
}
