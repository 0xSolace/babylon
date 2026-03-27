/**
 * User row reads by classified identifier (single-column index paths only).
 */

import type { InferSelectModel } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { users } from './tables/user';

export type UserIdentifierLookupRow = InferSelectModel<typeof users>;

/**
 * For `privyId` lookups that miss, falls back to a PK lookup because some
 * users have their `did:privy:…` value stored as `users.id` rather than
 * `users.privyId`. Both queries use single-column indexes (no OR).
 */
export async function fetchUserRowByClassifiedIdentifier(
  identifier: string,
  kind: 'id' | 'privyId' | 'username'
): Promise<UserIdentifierLookupRow | null> {
  const condition =
    kind === 'id'
      ? eq(users.id, identifier)
      : kind === 'privyId'
        ? eq(users.privyId, identifier)
        : sql`lower(${users.username}) = lower(${identifier})`;

  const [user] = await db.select().from(users).where(condition).limit(1);
  if (user) return user;

  if (kind === 'privyId') {
    const [byId] = await db
      .select()
      .from(users)
      .where(eq(users.id, identifier))
      .limit(1);
    return byId ?? null;
  }

  return null;
}
