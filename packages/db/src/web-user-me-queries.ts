/**
 * SQL for GET /api/users/me (profile slice, Privy link, referrer, wallet backfill).
 */

import { and, eq, ne, or, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { type NewUser, users } from './tables/user';

type MeRouteDb = DrizzleClient | Transaction;

/** Column map shared by select/returning on this route. */
export const userMeProfileColumns = {
  id: users.id,
  privyId: users.privyId,
  privyWalletId: users.privyWalletId,
  offlineWalletReady: users.offlineWalletReady,
  offlineWalletReadyAt: users.offlineWalletReadyAt,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  profileImageUrl: users.profileImageUrl,
  coverImageUrl: users.coverImageUrl,
  walletAddress: users.walletAddress,
  email: users.email,
  emailVerified: users.emailVerified,
  emailNotificationsEnabled: users.emailNotificationsEnabled,
  emailNotificationsRealtime: users.emailNotificationsRealtime,
  emailNotificationsDailySummary: users.emailNotificationsDailySummary,
  emailNotificationsWeeklySummary: users.emailNotificationsWeeklySummary,
  emailNotificationsMonthlySummary: users.emailNotificationsMonthlySummary,
  profileComplete: users.profileComplete,
  hasUsername: users.hasUsername,
  hasBio: users.hasBio,
  hasProfileImage: users.hasProfileImage,
  onChainRegistered: users.onChainRegistered,
  nftTokenId: users.nftTokenId,
  agent0TokenId: users.agent0TokenId,
  referralCode: users.referralCode,
  referredBy: users.referredBy,
  reputationPoints: users.reputationPoints,
  virtualBalance: users.virtualBalance,
  pointsAwardedForProfile: users.pointsAwardedForProfile,
  pointsAwardedForFarcasterFollow: users.pointsAwardedForFarcasterFollow,
  pointsAwardedForTwitterFollow: users.pointsAwardedForTwitterFollow,
  pointsAwardedForDiscordJoin: users.pointsAwardedForDiscordJoin,
  pointsAwardedForEmail: users.pointsAwardedForEmail,
  hasFarcaster: users.hasFarcaster,
  hasTwitter: users.hasTwitter,
  hasDiscord: users.hasDiscord,
  farcasterUsername: users.farcasterUsername,
  farcasterFid: users.farcasterFid,
  twitterUsername: users.twitterUsername,
  twitterId: users.twitterId,
  discordUsername: users.discordUsername,
  hasTelegram: users.hasTelegram,
  telegramId: users.telegramId,
  telegramUsername: users.telegramUsername,
  showTwitterPublic: users.showTwitterPublic,
  showFarcasterPublic: users.showFarcasterPublic,
  showWalletPublic: users.showWalletPublic,
  isAdmin: users.isAdmin,
  isActor: users.isActor,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  gameGuideCompletedAt: users.gameGuideCompletedAt,
} as const;

export type UserMeProfileRow = {
  id: string;
  privyId: string | null;
  privyWalletId: string | null;
  offlineWalletReady: boolean;
  offlineWalletReadyAt: Date | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  walletAddress: string | null;
  email: string | null;
  emailVerified: boolean;
  emailNotificationsEnabled: boolean;
  emailNotificationsRealtime: boolean;
  emailNotificationsDailySummary: boolean;
  emailNotificationsWeeklySummary: boolean;
  emailNotificationsMonthlySummary: boolean;
  profileComplete: boolean;
  hasUsername: boolean;
  hasBio: boolean;
  hasProfileImage: boolean;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  agent0TokenId: number | null;
  referralCode: string | null;
  referredBy: string | null;
  reputationPoints: number;
  virtualBalance: string;
  pointsAwardedForProfile: boolean;
  pointsAwardedForFarcasterFollow: boolean;
  pointsAwardedForTwitterFollow: boolean;
  pointsAwardedForDiscordJoin: boolean;
  pointsAwardedForEmail: boolean;
  hasFarcaster: boolean;
  hasTwitter: boolean;
  hasDiscord: boolean;
  hasTelegram: boolean;
  telegramId: string | null;
  telegramUsername: string | null;
  farcasterUsername: string | null;
  farcasterFid: string | null;
  twitterUsername: string | null;
  twitterId: string | null;
  discordUsername: string | null;
  showTwitterPublic: boolean;
  showFarcasterPublic: boolean;
  showWalletPublic: boolean;
  isAdmin: boolean;
  isActor: boolean;
  createdAt: Date;
  updatedAt: Date;
  gameGuideCompletedAt: Date | null;
};

export async function selectUserMeProfileByPrivyId(
  db: MeRouteDb,
  privyId: string
): Promise<UserMeProfileRow | undefined> {
  const [row] = await db
    .select(userMeProfileColumns)
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1);
  return row;
}

export async function selectUserMeProfilesByFarcasterOrTwitter(
  db: MeRouteDb,
  farcasterFid: string | null,
  twitterId: string | null
): Promise<UserMeProfileRow[]> {
  const conditions = [];
  if (farcasterFid) {
    conditions.push(eq(users.farcasterFid, farcasterFid));
  }
  if (twitterId) {
    conditions.push(eq(users.twitterId, twitterId));
  }
  if (conditions.length === 0) {
    return [];
  }
  const whereClause =
    conditions.length === 1 ? conditions[0]! : or(...conditions);
  return db
    .select(userMeProfileColumns)
    .from(users)
    .where(whereClause)
    .limit(2);
}

export async function selectUserIdByPrivyId(
  db: MeRouteDb,
  privyId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1);
  return row;
}

export async function updateUserPrivySessionByIdReturningMeProfile(
  db: MeRouteDb,
  userId: string,
  newPrivyId: string,
  now: Date
): Promise<UserMeProfileRow | undefined> {
  const [row] = await db
    .update(users)
    .set({ privyId: newPrivyId, updatedAt: now })
    .where(eq(users.id, userId))
    .returning(userMeProfileColumns);
  return row;
}

export type MeRouteReferrerSlice = { id: string; username: string | null };

export async function selectMeRouteReferrerByUsernameCaseInsensitive(
  db: MeRouteDb,
  normalizedCode: string
): Promise<MeRouteReferrerSlice | undefined> {
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${normalizedCode})`)
    .limit(1);
  return row;
}

export async function selectMeRouteReferrerByReferralCode(
  db: MeRouteDb,
  referralCode: string
): Promise<MeRouteReferrerSlice | undefined> {
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);
  return row;
}

export async function insertMinimalUserMeReturning(
  db: MeRouteDb,
  values: NewUser
): Promise<UserMeProfileRow | undefined> {
  const [row] = await db
    .insert(users)
    .values(values)
    .returning(userMeProfileColumns);
  return row;
}

export async function updateUserMeWalletBackfillReturning(
  db: MeRouteDb,
  userId: string,
  params: {
    privyWalletId: string;
    walletAddress: string;
    offlineWalletReady: boolean;
    offlineWalletReadyAt: Date;
    updatedAt: Date;
  }
): Promise<UserMeProfileRow | undefined> {
  const [row] = await db
    .update(users)
    .set({
      privyWalletId: params.privyWalletId,
      walletAddress: params.walletAddress,
      offlineWalletReady: params.offlineWalletReady,
      offlineWalletReadyAt: params.offlineWalletReadyAt,
      updatedAt: params.updatedAt,
    })
    .where(eq(users.id, userId))
    .returning(userMeProfileColumns);
  return row;
}

export async function updateUserMeAdminPromoteReturning(
  db: MeRouteDb,
  userId: string,
  now: Date
): Promise<UserMeProfileRow | undefined> {
  const [row] = await db
    .update(users)
    .set({ isAdmin: true, updatedAt: now })
    .where(eq(users.id, userId))
    .returning(userMeProfileColumns);
  return row;
}

export async function updateUserReferredByReturningMeProfile(
  db: MeRouteDb,
  userId: string,
  referredBy: string
): Promise<UserMeProfileRow | undefined> {
  const [row] = await db
    .update(users)
    .set({ referredBy })
    .where(eq(users.id, userId))
    .returning(userMeProfileColumns);
  return row;
}

export async function selectUserIdByFarcasterFidExcludingUserId(
  db: MeRouteDb,
  farcasterFid: string,
  excludeUserId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.farcasterFid, farcasterFid), ne(users.id, excludeUserId))
    )
    .limit(1);
  return row;
}

export async function selectUserIdByTwitterIdExcludingUserId(
  db: MeRouteDb,
  twitterId: string,
  excludeUserId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.twitterId, twitterId), ne(users.id, excludeUserId)))
    .limit(1);
  return row;
}

export async function selectUserIdByTelegramIdExcludingUserId(
  db: MeRouteDb,
  telegramId: string,
  excludeUserId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.telegramId, telegramId), ne(users.id, excludeUserId)))
    .limit(1);
  return row;
}

export async function updateUserByIdReturningMeProfile(
  db: MeRouteDb,
  userId: string,
  patch: Partial<NewUser>
): Promise<UserMeProfileRow | undefined> {
  const [row] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning(userMeProfileColumns);
  return row;
}
