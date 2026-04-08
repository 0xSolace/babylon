/**
 * Drizzle for `@babylon/api` `ensure-user` onboarding upsert.
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { NewUser } from './model-types';
import { users } from './tables/user';

type EnsureDb = DrizzleClient | Transaction;

const canonicalReturning = {
  id: users.id,
  privyId: users.privyId,
  username: users.username,
  displayName: users.displayName,
  walletAddress: users.walletAddress,
  isActor: users.isActor,
  profileImageUrl: users.profileImageUrl,
} as const;

export type EnsureUserCanonicalRow = {
  id: string;
  privyId: string | null;
  username: string | null;
  displayName: string | null;
  walletAddress: string | null;
  isActor: boolean;
  profileImageUrl: string | null;
};

export async function selectEnsureUserCanonicalByPrivyId(
  client: EnsureDb,
  privyId: string
): Promise<EnsureUserCanonicalRow | undefined> {
  const [row] = await client
    .select(canonicalReturning)
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1);
  return row;
}

export async function updateUserReturningCanonical(
  client: EnsureDb,
  userId: string,
  patch: Partial<NewUser>
): Promise<EnsureUserCanonicalRow | undefined> {
  const [row] = await client
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning(canonicalReturning);
  return row;
}

export async function insertUserReturningCanonical(
  client: EnsureDb,
  row: NewUser
): Promise<EnsureUserCanonicalRow | undefined> {
  const [created] = await client
    .insert(users)
    .values(row)
    .returning(canonicalReturning);
  return created;
}
