/**
 * Drizzle for `@babylon/api` profile update rate limiting.
 */

import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { profileUpdateLogs } from './tables/profile-update-logs';

type ProfileRateDb = DrizzleClient | Transaction;

export async function countProfileUpdatesForUserSince(
  client: ProfileRateDb,
  userId: string,
  since: Date
): Promise<number> {
  const [r] = await client
    .select({ count: count() })
    .from(profileUpdateLogs)
    .where(
      and(
        eq(profileUpdateLogs.userId, userId),
        gte(profileUpdateLogs.createdAt, since)
      )
    );
  return Number(r?.count ?? 0);
}

export async function countProfileUsernameChangesForUserSince(
  client: ProfileRateDb,
  userId: string,
  since: Date
): Promise<number> {
  const [r] = await client
    .select({ count: count() })
    .from(profileUpdateLogs)
    .where(
      and(
        eq(profileUpdateLogs.userId, userId),
        gte(profileUpdateLogs.createdAt, since),
        sql`'username' = ANY(${profileUpdateLogs.changedFields})`
      )
    );
  return Number(r?.count ?? 0);
}

export async function selectOldestProfileUpdateForUserSince(
  client: ProfileRateDb,
  userId: string,
  since: Date
): Promise<{ createdAt: Date } | undefined> {
  const [row] = await client
    .select({ createdAt: profileUpdateLogs.createdAt })
    .from(profileUpdateLogs)
    .where(
      and(
        eq(profileUpdateLogs.userId, userId),
        gte(profileUpdateLogs.createdAt, since)
      )
    )
    .orderBy(asc(profileUpdateLogs.createdAt))
    .limit(1);
  return row;
}

export async function insertProfileUpdateLogRow(
  client: ProfileRateDb,
  row: typeof profileUpdateLogs.$inferInsert
): Promise<void> {
  await client.insert(profileUpdateLogs).values(row);
}

export type ProfileUpdateHistorySelectRow = {
  changedFields: string[];
  backendSigned: boolean;
  txHash: string | null;
  createdAt: Date;
};

export async function selectProfileUpdateHistoryForUser(
  client: ProfileRateDb,
  userId: string,
  limit: number
): Promise<ProfileUpdateHistorySelectRow[]> {
  return client
    .select({
      changedFields: profileUpdateLogs.changedFields,
      backendSigned: profileUpdateLogs.backendSigned,
      txHash: profileUpdateLogs.txHash,
      createdAt: profileUpdateLogs.createdAt,
    })
    .from(profileUpdateLogs)
    .where(eq(profileUpdateLogs.userId, userId))
    .orderBy(desc(profileUpdateLogs.createdAt))
    .limit(limit);
}
