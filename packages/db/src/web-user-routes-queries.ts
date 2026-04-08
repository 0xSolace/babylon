/**
 * SQL for small `apps/web` user-facing routes (preferences, auth whoami, API keys).
 */

import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';
import { type UserApiKey, userApiKeys } from './tables/user-api-keys';

type WebUserRouteDb = DrizzleClient | Transaction;

export type NotificationDigestSettingsRow = {
  notificationDigestEnabled: boolean;
  notificationDigestFrequency: string;
  notificationDigestDeliveryChannel: string;
};

export async function updateUserGameGuideCompletedAtByPrivyId(
  db: WebUserRouteDb,
  privyId: string,
  now: Date
): Promise<{ id: string }[]> {
  return db
    .update(users)
    .set({ gameGuideCompletedAt: now, updatedAt: now })
    .where(eq(users.privyId, privyId))
    .returning({ id: users.id });
}

export async function selectUserNotificationDigestSettingsByUserId(
  db: WebUserRouteDb,
  userId: string
): Promise<NotificationDigestSettingsRow | undefined> {
  const [row] = await db
    .select({
      notificationDigestEnabled: users.notificationDigestEnabled,
      notificationDigestFrequency: users.notificationDigestFrequency,
      notificationDigestDeliveryChannel:
        users.notificationDigestDeliveryChannel,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateUserNotificationDigestSettingsByUserId(
  db: WebUserRouteDb,
  userId: string,
  params: {
    digestEnabled: boolean;
    frequency: string;
    deliveryChannel: string;
  },
  now: Date
): Promise<NotificationDigestSettingsRow | undefined> {
  const [updated] = await db
    .update(users)
    .set({
      notificationDigestEnabled: params.digestEnabled,
      notificationDigestFrequency: params.frequency,
      notificationDigestDeliveryChannel: params.deliveryChannel,
      notificationDigestLastSentAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning({
      notificationDigestEnabled: users.notificationDigestEnabled,
      notificationDigestFrequency: users.notificationDigestFrequency,
      notificationDigestDeliveryChannel:
        users.notificationDigestDeliveryChannel,
    });
  return updated;
}

export async function updateUserUnsubscribeAllNotificationEmails(
  db: WebUserRouteDb,
  userId: string,
  emailLower: string,
  now: Date
): Promise<{ id: string }[]> {
  return db
    .update(users)
    .set({
      emailNotificationsEnabled: false,
      emailNotificationsRealtime: false,
      emailNotificationsDailySummary: false,
      emailNotificationsWeeklySummary: false,
      emailNotificationsMonthlySummary: false,
      emailNotificationsUnsubscribedAt: now,
      updatedAt: now,
    })
    .where(and(eq(users.id, userId), eq(users.email, emailLower)))
    .returning({ id: users.id });
}

export async function selectUserIdAndUsernameById(
  db: WebUserRouteDb,
  userId: string
): Promise<{ id: string; username: string | null } | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

/**
 * Revoke key if it exists, belongs to `userId`, and is not already revoked.
 * Returns updated rows (empty if no match).
 */
export async function updateUserCoverImageUrlById(
  db: WebUserRouteDb,
  userId: string,
  coverImageUrl: string
): Promise<void> {
  await db.update(users).set({ coverImageUrl }).where(eq(users.id, userId));
}

/** Users with `managedBy` set (same filter as legacy positions route). */
export async function selectManagedUsersIdAndDisplayName(
  db: WebUserRouteDb,
  managerUserId: string
): Promise<{ id: string; displayName: string | null }[]> {
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.managedBy, managerUserId));
}

export async function selectUserManagedByIsAgentForBannerCheck(
  db: WebUserRouteDb,
  userId: string
): Promise<{ managedBy: string | null; isAgent: boolean } | undefined> {
  const [row] = await db
    .select({
      managedBy: users.managedBy,
      isAgent: users.isAgent,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function revokeUserApiKeyForOwner(
  db: WebUserRouteDb,
  keyId: string,
  userId: string,
  revokedAt: Date
): Promise<UserApiKey[]> {
  return db
    .update(userApiKeys)
    .set({ revokedAt })
    .where(
      and(
        eq(userApiKeys.id, keyId),
        eq(userApiKeys.userId, userId),
        isNull(userApiKeys.revokedAt)
      )
    )
    .returning();
}

/** SIWE authenticate: existing wallet login slice. */
export type SiweAuthUserSlice = {
  id: string;
  username: string | null;
  walletAddress: string | null;
};

export async function selectUserSiweAuthSliceByWalletAddress(
  db: WebUserRouteDb,
  walletAddress: string
): Promise<SiweAuthUserSlice | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      walletAddress: users.walletAddress,
    })
    .from(users)
    .where(eq(users.walletAddress, walletAddress))
    .limit(1);
  return row;
}

export async function selectUserIdByUsernameCaseInsensitive(
  db: WebUserRouteDb,
  username: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  return row;
}

export async function selectUserIdByUsernameCaseInsensitiveExcludingUserId(
  db: WebUserRouteDb,
  username: string,
  excludeUserId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`lower(${users.username}) = lower(${username})`,
        ne(users.id, excludeUserId)
      )
    )
    .limit(1);
  return row;
}

export type UserUpdateProfilePreludeRow = {
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  hasUsername: boolean;
  hasBio: boolean;
  hasProfileImage: boolean;
  usernameChangedAt: Date | null;
  pointsAwardedForProfile: boolean;
  walletAddress: string | null;
  onChainRegistered: boolean;
  nftTokenId: number | null;
};

export async function selectUserUpdateProfilePreludeById(
  db: WebUserRouteDb,
  userId: string
): Promise<UserUpdateProfilePreludeRow | undefined> {
  const [row] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      coverImageUrl: users.coverImageUrl,
      hasUsername: users.hasUsername,
      hasBio: users.hasBio,
      hasProfileImage: users.hasProfileImage,
      usernameChangedAt: users.usernameChangedAt,
      pointsAwardedForProfile: users.pointsAwardedForProfile,
      walletAddress: users.walletAddress,
      onChainRegistered: users.onChainRegistered,
      nftTokenId: users.nftTokenId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserProfileUpdatePatch = Partial<typeof users.$inferInsert>;

export type UserUpdateProfileReturnedWebRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  profileComplete: boolean;
  hasUsername: boolean;
  hasBio: boolean;
  hasProfileImage: boolean;
  reputationPoints: number;
  referralCount: number;
  referralCode: string | null;
  usernameChangedAt: Date | null;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  profileChainSyncNeeded: boolean;
  privyId: string | null;
};

export async function updateUserProfileByIdReturningWebSlice(
  db: WebUserRouteDb,
  userId: string,
  patch: UserProfileUpdatePatch
): Promise<UserUpdateProfileReturnedWebRow | undefined> {
  const [row] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      coverImageUrl: users.coverImageUrl,
      profileComplete: users.profileComplete,
      hasUsername: users.hasUsername,
      hasBio: users.hasBio,
      hasProfileImage: users.hasProfileImage,
      reputationPoints: users.reputationPoints,
      referralCount: users.referralCount,
      referralCode: users.referralCode,
      usernameChangedAt: users.usernameChangedAt,
      onChainRegistered: users.onChainRegistered,
      nftTokenId: users.nftTokenId,
      profileChainSyncNeeded: users.profileChainSyncNeeded,
      privyId: users.privyId,
    });
  return row;
}

export async function insertSiweAgentUserReturningSlice(
  db: WebUserRouteDb,
  params: {
    id: string;
    username: string;
    displayName: string;
    walletAddress: string;
    createdAt: Date;
    updatedAt: Date;
  }
): Promise<SiweAuthUserSlice | undefined> {
  const [row] = await db
    .insert(users)
    .values({
      id: params.id,
      username: params.username,
      displayName: params.displayName,
      walletAddress: params.walletAddress,
      isAgent: true,
      profileComplete: false,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    })
    .returning({
      id: users.id,
      username: users.username,
      walletAddress: users.walletAddress,
    });
  return row;
}

export async function insertUserApiKeyRow(
  db: WebUserRouteDb,
  params: {
    id: string;
    userId: string;
    keyHash: string;
    name: string;
    createdAt: Date;
  }
): Promise<void> {
  await db.insert(userApiKeys).values({
    id: params.id,
    userId: params.userId,
    keyHash: params.keyHash,
    name: params.name,
    createdAt: params.createdAt,
  });
}

export async function selectUserReferralCountById(
  db: WebUserRouteDb,
  userId: string
): Promise<{ referralCount: number } | undefined> {
  const [row] = await db
    .select({ referralCount: users.referralCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserNotificationEmailPreferencesRow = {
  email: string | null;
  emailVerified: boolean;
  enabled: boolean;
  realtime: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  monthlySummary: boolean;
};

export async function selectUserNotificationEmailPreferencesByUserId(
  db: WebUserRouteDb,
  userId: string
): Promise<UserNotificationEmailPreferencesRow | undefined> {
  const [row] = await db
    .select({
      email: users.email,
      emailVerified: users.emailVerified,
      enabled: users.emailNotificationsEnabled,
      realtime: users.emailNotificationsRealtime,
      dailySummary: users.emailNotificationsDailySummary,
      weeklySummary: users.emailNotificationsWeeklySummary,
      monthlySummary: users.emailNotificationsMonthlySummary,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserEmailAndVerifiedRow = {
  email: string | null;
  emailVerified: boolean;
};

export async function selectUserEmailAndVerifiedByUserId(
  db: WebUserRouteDb,
  userId: string
): Promise<UserEmailAndVerifiedRow | undefined> {
  const [row] = await db
    .select({
      email: users.email,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateUserVerifiedEmailByIdReturningEmailSlice(
  db: WebUserRouteDb,
  userId: string,
  email: string,
  now: Date
): Promise<UserEmailAndVerifiedRow | undefined> {
  const [row] = await db
    .update(users)
    .set({
      email,
      emailVerified: true,
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning({
      email: users.email,
      emailVerified: users.emailVerified,
    });
  return row;
}

export type UserNotificationEmailPreferencePatch = {
  updatedAt: Date;
  emailNotificationsEnabled?: boolean;
  emailNotificationsUnsubscribedAt?: Date | null;
  emailNotificationsRealtime?: boolean;
  emailNotificationsDailySummary?: boolean;
  emailNotificationsWeeklySummary?: boolean;
  emailNotificationsMonthlySummary?: boolean;
};

export async function updateUserNotificationEmailPreferencesByIdReturning(
  db: WebUserRouteDb,
  userId: string,
  patch: UserNotificationEmailPreferencePatch
): Promise<UserNotificationEmailPreferencesRow | undefined> {
  const [row] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning({
      email: users.email,
      emailVerified: users.emailVerified,
      enabled: users.emailNotificationsEnabled,
      realtime: users.emailNotificationsRealtime,
      dailySummary: users.emailNotificationsDailySummary,
      weeklySummary: users.emailNotificationsWeeklySummary,
      monthlySummary: users.emailNotificationsMonthlySummary,
    });
  return row;
}

export type UserSocialVisibilityPatch = {
  showTwitterPublic?: boolean;
  showFarcasterPublic?: boolean;
  showWalletPublic?: boolean;
};

export type UserSocialVisibilityRow = {
  id: string;
  showTwitterPublic: boolean;
  showFarcasterPublic: boolean;
  showWalletPublic: boolean;
};

export async function updateUserSocialVisibilityByIdReturning(
  db: WebUserRouteDb,
  userId: string,
  patch: UserSocialVisibilityPatch
): Promise<UserSocialVisibilityRow | undefined> {
  const [row] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      showTwitterPublic: users.showTwitterPublic,
      showFarcasterPublic: users.showFarcasterPublic,
      showWalletPublic: users.showWalletPublic,
    });
  return row;
}
