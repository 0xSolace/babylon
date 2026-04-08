/**
 * SQL for user block / mute `apps/web` routes (RLS `db`).
 */

import { and, eq, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { follows } from './tables/follows';
import { users } from './tables/user';
import { userBlocks } from './tables/user-blocks';
import { userMutes } from './tables/user-mutes';

type WebUserSocialDb = DrizzleClient | Transaction;

export type TargetUserModerationSlice = {
  id: string;
  username: string | null;
  displayName: string | null;
  isActor: boolean;
};

export async function selectUserModerationTargetSliceById(
  db: WebUserSocialDb,
  userId: string
): Promise<TargetUserModerationSlice | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      isActor: users.isActor,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUserBlockIdByBlockerAndBlocked(
  db: WebUserSocialDb,
  blockerId: string,
  blockedId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      )
    )
    .limit(1);
  return row;
}

export async function insertUserBlockReturning(
  db: WebUserSocialDb,
  row: typeof userBlocks.$inferInsert
): Promise<typeof userBlocks.$inferSelect | undefined> {
  const [created] = await db.insert(userBlocks).values(row).returning();
  return created;
}

export async function deleteFollowsBetweenUsers(
  db: WebUserSocialDb,
  userIdA: string,
  userIdB: string
): Promise<void> {
  await db
    .delete(follows)
    .where(
      or(
        and(eq(follows.followerId, userIdA), eq(follows.followingId, userIdB)),
        and(eq(follows.followerId, userIdB), eq(follows.followingId, userIdA))
      )
    );
}

export async function deleteUserBlockByBlockerAndBlockedReturning(
  db: WebUserSocialDb,
  blockerId: string,
  blockedId: string
): Promise<(typeof userBlocks.$inferSelect)[]> {
  return db
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      )
    )
    .returning();
}

export type UserBlockStatusSlice = {
  id: string;
  createdAt: Date;
  reason: string | null;
};

export async function selectUserBlockStatusSliceByBlockerAndBlocked(
  db: WebUserSocialDb,
  blockerId: string,
  blockedId: string
): Promise<UserBlockStatusSlice | undefined> {
  const [row] = await db
    .select({
      id: userBlocks.id,
      createdAt: userBlocks.createdAt,
      reason: userBlocks.reason,
    })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      )
    )
    .limit(1);
  return row;
}

export async function selectUserMuteIdByMuterAndMuted(
  db: WebUserSocialDb,
  muterId: string,
  mutedId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: userMutes.id })
    .from(userMutes)
    .where(and(eq(userMutes.muterId, muterId), eq(userMutes.mutedId, mutedId)))
    .limit(1);
  return row;
}

export async function insertUserMuteReturning(
  db: WebUserSocialDb,
  row: typeof userMutes.$inferInsert
): Promise<typeof userMutes.$inferSelect | undefined> {
  const [created] = await db.insert(userMutes).values(row).returning();
  return created;
}

export async function deleteUserMuteByMuterAndMutedReturningIds(
  db: WebUserSocialDb,
  muterId: string,
  mutedId: string
): Promise<{ id: string }[]> {
  return db
    .delete(userMutes)
    .where(and(eq(userMutes.muterId, muterId), eq(userMutes.mutedId, mutedId)))
    .returning({ id: userMutes.id });
}

export type UserMuteStatusSlice = {
  id: string;
  createdAt: Date;
  reason: string | null;
};

export async function selectUserMuteStatusSliceByMuterAndMuted(
  db: WebUserSocialDb,
  muterId: string,
  mutedId: string
): Promise<UserMuteStatusSlice | undefined> {
  const [row] = await db
    .select({
      id: userMutes.id,
      createdAt: userMutes.createdAt,
      reason: userMutes.reason,
    })
    .from(userMutes)
    .where(and(eq(userMutes.muterId, muterId), eq(userMutes.mutedId, mutedId)))
    .limit(1);
  return row;
}
