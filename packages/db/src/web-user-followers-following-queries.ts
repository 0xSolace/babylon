/**
 * SQL for `GET .../followers` and `GET .../following` (optional-user RLS `db`).
 */

import { and, desc, eq, inArray, not } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { actorFollows } from './tables/actor-follows';
import { followStatuses } from './tables/follow-statuses';
import { follows } from './tables/follows';
import { users } from './tables/user';
import { userActorFollows } from './tables/user-actor-follows';

type FollowListDb = DrizzleClient | Transaction;

export async function selectActorFollowRelationsByFollowingIdOrderCreatedDesc(
  db: FollowListDb,
  followingId: string
): Promise<{ id: string; followerId: string; createdAt: Date }[]> {
  return db
    .select({
      id: actorFollows.id,
      followerId: actorFollows.followerId,
      createdAt: actorFollows.createdAt,
    })
    .from(actorFollows)
    .where(eq(actorFollows.followingId, followingId))
    .orderBy(desc(actorFollows.createdAt));
}

export type UserActorFollowerJoinedRow = {
  id: string;
  userId: string;
  createdAt: Date;
  userDisplayName: string | null;
  userUsername: string | null;
  userProfileImageUrl: string | null;
  userBio: string | null;
};

export async function selectUserActorFollowersJoinedUsersByActorIdOrderCreatedDescLimit(
  db: FollowListDb,
  actorId: string,
  limit: number
): Promise<UserActorFollowerJoinedRow[]> {
  return db
    .select({
      id: userActorFollows.id,
      userId: userActorFollows.userId,
      createdAt: userActorFollows.createdAt,
      userDisplayName: users.displayName,
      userUsername: users.username,
      userProfileImageUrl: users.profileImageUrl,
      userBio: users.bio,
    })
    .from(userActorFollows)
    .innerJoin(users, eq(userActorFollows.userId, users.id))
    .where(eq(userActorFollows.actorId, actorId))
    .orderBy(desc(userActorFollows.createdAt))
    .limit(limit);
}

export type UserFollowerJoinedRow = {
  id: string;
  followerId: string;
  createdAt: Date;
  followerDisplayName: string | null;
  followerUsername: string | null;
  followerProfileImageUrl: string | null;
  followerBio: string | null;
};

export async function selectUserFollowersJoinedUsersByFollowingIdOrderCreatedDesc(
  db: FollowListDb,
  followingId: string
): Promise<UserFollowerJoinedRow[]> {
  return db
    .select({
      id: follows.id,
      followerId: follows.followerId,
      createdAt: follows.createdAt,
      followerDisplayName: users.displayName,
      followerUsername: users.username,
      followerProfileImageUrl: users.profileImageUrl,
      followerBio: users.bio,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(eq(follows.followingId, followingId))
    .orderBy(desc(follows.createdAt));
}

export async function selectActiveNpcFollowStatusesForUserExcludingUserFollowed(
  db: FollowListDb,
  userId: string
): Promise<(typeof followStatuses.$inferSelect)[]> {
  return db
    .select()
    .from(followStatuses)
    .where(
      and(
        eq(followStatuses.userId, userId),
        eq(followStatuses.isActive, true),
        not(eq(followStatuses.followReason, 'user_followed'))
      )
    )
    .orderBy(desc(followStatuses.followedAt));
}

export async function selectFollowingIdsByFollowerAndFollowingIn(
  db: FollowListDb,
  followerId: string,
  followingIds: string[]
): Promise<{ followingId: string }[]> {
  if (followingIds.length === 0) return [];
  return db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        inArray(follows.followingId, followingIds)
      )
    );
}

export async function selectActorIdsFollowedByUserAndActorIn(
  db: FollowListDb,
  userId: string,
  actorIds: string[]
): Promise<{ actorId: string }[]> {
  if (actorIds.length === 0) return [];
  return db
    .select({ actorId: userActorFollows.actorId })
    .from(userActorFollows)
    .where(
      and(
        eq(userActorFollows.userId, userId),
        inArray(userActorFollows.actorId, actorIds)
      )
    );
}

export async function selectActorFollowRelationsByFollowerIdOrderCreatedDesc(
  db: FollowListDb,
  followerId: string
): Promise<{ id: string; followingId: string; createdAt: Date }[]> {
  return db
    .select({
      id: actorFollows.id,
      followingId: actorFollows.followingId,
      createdAt: actorFollows.createdAt,
    })
    .from(actorFollows)
    .where(eq(actorFollows.followerId, followerId))
    .orderBy(desc(actorFollows.createdAt));
}

export type UserFollowingJoinedRow = {
  id: string;
  followingId: string;
  createdAt: Date;
  followingDisplayName: string | null;
  followingUsername: string | null;
  followingProfileImageUrl: string | null;
  followingBio: string | null;
  followingIsActor: boolean;
};

export async function selectUserFollowingJoinedUsersByFollowerIdOrderCreatedDesc(
  db: FollowListDb,
  followerId: string
): Promise<UserFollowingJoinedRow[]> {
  return db
    .select({
      id: follows.id,
      followingId: follows.followingId,
      createdAt: follows.createdAt,
      followingDisplayName: users.displayName,
      followingUsername: users.username,
      followingProfileImageUrl: users.profileImageUrl,
      followingBio: users.bio,
      followingIsActor: users.isActor,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(eq(follows.followerId, followerId))
    .orderBy(desc(follows.createdAt));
}

export async function selectUserActorFollowsByUserIdOrderCreatedDesc(
  db: FollowListDb,
  userId: string
): Promise<{ id: string; actorId: string; createdAt: Date }[]> {
  return db
    .select({
      id: userActorFollows.id,
      actorId: userActorFollows.actorId,
      createdAt: userActorFollows.createdAt,
    })
    .from(userActorFollows)
    .where(eq(userActorFollows.userId, userId))
    .orderBy(desc(userActorFollows.createdAt));
}
