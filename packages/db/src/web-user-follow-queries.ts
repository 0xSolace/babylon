/**
 * SQL for `apps/web` user follow / unfollow routes (RLS `db`).
 */

import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { follows } from './tables/follows';
import { users } from './tables/user';
import { userActorFollows } from './tables/user-actor-follows';

type WebUserFollowDb = DrizzleClient | Transaction;

export async function selectFollowIdForUpdateByFollowerAndFollowing(
  db: WebUserFollowDb,
  followerId: string,
  followingId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    )
    .limit(1)
    .for('update');
  return row;
}

export async function insertUserFollowReturning(
  db: WebUserFollowDb,
  row: typeof follows.$inferInsert
): Promise<typeof follows.$inferSelect | undefined> {
  const [created] = await db.insert(follows).values(row).returning();
  return created;
}

export type UserFollowTargetDisplaySlice = {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  bio: string | null;
};

export async function selectUserFollowTargetDisplaySliceById(
  db: WebUserFollowDb,
  userId: string
): Promise<UserFollowTargetDisplaySlice | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUserActorFollowIdByUserAndActor(
  db: WebUserFollowDb,
  userId: string,
  actorId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: userActorFollows.id })
    .from(userActorFollows)
    .where(
      and(
        eq(userActorFollows.userId, userId),
        eq(userActorFollows.actorId, actorId)
      )
    )
    .limit(1);
  return row;
}

export async function insertUserActorFollowReturning(
  db: WebUserFollowDb,
  row: typeof userActorFollows.$inferInsert
): Promise<typeof userActorFollows.$inferSelect | undefined> {
  const [created] = await db.insert(userActorFollows).values(row).returning();
  return created;
}

export async function selectFollowIdByFollowerAndFollowing(
  db: WebUserFollowDb,
  followerId: string,
  followingId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    )
    .limit(1);
  return row;
}

export async function deleteFollowById(
  db: WebUserFollowDb,
  followId: string
): Promise<void> {
  await db.delete(follows).where(eq(follows.id, followId));
}

export async function deleteUserActorFollowById(
  db: WebUserFollowDb,
  id: string
): Promise<void> {
  await db.delete(userActorFollows).where(eq(userActorFollows.id, id));
}
