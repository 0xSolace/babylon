/**
 * Username availability reads for onboarding (`/api/onboarding/check-username`).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type OnboardingUsernameDb = DrizzleClient | Transaction;

/** Exact match on `User.username` (caller supplies sanitized lowercase username). */
export async function selectUserIdByExactUsername(
  db: OnboardingUsernameDb,
  username: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row;
}
