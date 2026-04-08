/**
 * Drizzle for `@babylon/api` auth middleware / Privy user resolution.
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type AuthDb = DrizzleClient | Transaction;

export type AuthPrivyUserLookupRow = {
  id: string;
  walletAddress: string | null;
  isAdmin: boolean;
  privyWalletId: string | null;
};

export async function selectUserByPrivyIdForAuth(
  client: AuthDb,
  privyId: string
): Promise<AuthPrivyUserLookupRow | undefined> {
  const [row] = await client
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
      isAdmin: users.isAdmin,
      privyWalletId: users.privyWalletId,
    })
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1);
  return row;
}
