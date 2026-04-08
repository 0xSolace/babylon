/**
 * DB reads/writes for user reward verification routes (share, social follows, Discord).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { type ShareAction, shareActions } from './tables/share-actions';
import { users } from './tables/user';

type VerifyRouteDb = DrizzleClient | Transaction;

export async function selectShareActionById(
  db: VerifyRouteDb,
  id: string
): Promise<ShareAction | undefined> {
  const [row] = await db
    .select()
    .from(shareActions)
    .where(eq(shareActions.id, id))
    .limit(1);
  return row;
}

export type ShareActionVerificationPatch = {
  verified: boolean;
  verifiedAt: Date | null;
  verificationDetails: string | null;
  pointsAwarded: boolean;
};

export async function updateShareActionVerificationByIdReturning(
  db: VerifyRouteDb,
  shareId: string,
  patch: ShareActionVerificationPatch
): Promise<ShareAction[]> {
  return db
    .update(shareActions)
    .set(patch)
    .where(eq(shareActions.id, shareId))
    .returning();
}

export type UserTwitterShareVerificationSlice = {
  twitterAccessToken: string | null;
  twitterTokenExpiresAt: Date | null;
  twitterId: string | null;
  twitterUsername: string | null;
};

export async function selectUserTwitterShareVerificationSliceById(
  db: VerifyRouteDb,
  userId: string
): Promise<UserTwitterShareVerificationSlice | undefined> {
  const [row] = await db
    .select({
      twitterAccessToken: users.twitterAccessToken,
      twitterTokenExpiresAt: users.twitterTokenExpiresAt,
      twitterId: users.twitterId,
      twitterUsername: users.twitterUsername,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserFarcasterShareVerificationSlice = {
  farcasterUsername: string | null;
  farcasterFid: string | null;
};

export async function selectUserFarcasterShareVerificationSliceById(
  db: VerifyRouteDb,
  userId: string
): Promise<UserFarcasterShareVerificationSlice | undefined> {
  const [row] = await db
    .select({
      farcasterUsername: users.farcasterUsername,
      farcasterFid: users.farcasterFid,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserTwitterFollowRewardSlice = {
  twitterUsername: string | null;
  twitterId: string | null;
  pointsAwardedForTwitterFollow: boolean;
};

export async function selectUserTwitterFollowRewardSliceById(
  db: VerifyRouteDb,
  userId: string
): Promise<UserTwitterFollowRewardSlice | undefined> {
  const [row] = await db
    .select({
      twitterUsername: users.twitterUsername,
      twitterId: users.twitterId,
      pointsAwardedForTwitterFollow: users.pointsAwardedForTwitterFollow,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserFarcasterFollowRewardSlice = {
  farcasterUsername: string | null;
  farcasterFid: string | null;
  pointsAwardedForFarcasterFollow: boolean;
};

export async function selectUserFarcasterFollowRewardSliceById(
  db: VerifyRouteDb,
  userId: string
): Promise<UserFarcasterFollowRewardSlice | undefined> {
  const [row] = await db
    .select({
      farcasterUsername: users.farcasterUsername,
      farcasterFid: users.farcasterFid,
      pointsAwardedForFarcasterFollow: users.pointsAwardedForFarcasterFollow,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserDiscordJoinVerificationSlice = {
  discordUsername: string | null;
  discordId: string | null;
  discordAccessToken: string | null;
  pointsAwardedForDiscordJoin: boolean;
};

export async function selectUserDiscordJoinVerificationSliceById(
  db: VerifyRouteDb,
  userId: string
): Promise<UserDiscordJoinVerificationSlice | undefined> {
  const [row] = await db
    .select({
      discordUsername: users.discordUsername,
      discordId: users.discordId,
      discordAccessToken: users.discordAccessToken,
      pointsAwardedForDiscordJoin: users.pointsAwardedForDiscordJoin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}
