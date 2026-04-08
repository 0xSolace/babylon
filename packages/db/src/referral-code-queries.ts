/**
 * Drizzle for `@babylon/api` referral code helpers.
 */

import { and, eq, ne } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type RefDb = DrizzleClient | Transaction;

export async function existsOtherUserWithReferralCode(
  client: RefDb,
  referralCode: string,
  excludeUserId: string
): Promise<boolean> {
  const rows = await client
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.referralCode, referralCode), ne(users.id, excludeUserId))
    )
    .limit(1);
  return rows.length > 0;
}

export type ReferralUserCodeRow = {
  id: string;
  username: string | null;
  referralCode: string | null;
};

export async function selectReferralUserCodeRow(
  client: RefDb,
  userId: string
): Promise<ReferralUserCodeRow | undefined> {
  const [row] = await client
    .select({
      id: users.id,
      username: users.username,
      referralCode: users.referralCode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateUserReferralCode(
  client: RefDb,
  userId: string,
  referralCode: string
): Promise<void> {
  await client.update(users).set({ referralCode }).where(eq(users.id, userId));
}
