/**
 * User Elysia Type Schemas
 *
 * Schemas for user-related API endpoints
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId, URLString, WalletAddress } from './common';

/**
 * User profile stats
 */
export const UserStatsSchema = t.Object({
  postCount: t.Number(),
  followerCount: t.Number(),
  followingCount: t.Number(),
  likeCount: t.Optional(t.Number()),
  commentCount: t.Optional(t.Number()),
});

/**
 * Basic user profile
 */
export const UserProfileSchema = t.Object({
  id: SnowflakeId,
  privyId: t.Optional(t.String()),
  username: t.Nullable(t.String()),
  displayName: t.Nullable(t.String()),
  bio: t.Nullable(t.String()),
  profileImageUrl: t.Nullable(URLString),
  coverImageUrl: t.Nullable(URLString),
  walletAddress: t.Nullable(WalletAddress),
  profileComplete: t.Boolean(),
  hasUsername: t.Boolean(),
  hasBio: t.Boolean(),
  hasProfileImage: t.Boolean(),
  onChainRegistered: t.Boolean(),
  nftTokenId: t.Nullable(t.String()),
  referralCode: t.Nullable(t.String()),
  referredBy: t.Nullable(t.String()),
  reputationPoints: t.Number(),
  hasFarcaster: t.Boolean(),
  hasTwitter: t.Boolean(),
  hasDiscord: t.Boolean(),
  farcasterUsername: t.Nullable(t.String()),
  twitterUsername: t.Nullable(t.String()),
  discordUsername: t.Nullable(t.String()),
  showTwitterPublic: t.Boolean(),
  showFarcasterPublic: t.Boolean(),
  showWalletPublic: t.Boolean(),
  isAdmin: t.Boolean(),
  isActor: t.Boolean(),
  createdAt: ISODateString,
  updatedAt: ISODateString,
  stats: t.Optional(UserStatsSchema),
});

/**
 * Current user (me) response
 */
export const MeResponseSchema = t.Object({
  authenticated: t.Boolean(),
  needsOnboarding: t.Boolean(),
  needsOnchain: t.Boolean(),
  user: UserProfileSchema,
});

/**
 * User profile update request
 */
export const UpdateUserRequestSchema = t.Object({
  username: t.Optional(t.String({ minLength: 3, maxLength: 30 })),
  displayName: t.Optional(t.String({ maxLength: 100 })),
  bio: t.Optional(t.String({ maxLength: 500 })),
  profileImageUrl: t.Optional(URLString),
  coverImageUrl: t.Optional(URLString),
  showTwitterPublic: t.Optional(t.Boolean()),
  showFarcasterPublic: t.Optional(t.Boolean()),
  showWalletPublic: t.Optional(t.Boolean()),
});

/**
 * Follow status response
 */
export const FollowStatusSchema = t.Object({
  isFollowing: t.Boolean(),
});

/**
 * User balance response
 */
export const UserBalanceSchema = t.Object({
  balance: t.Number(),
  totalDeposited: t.Number(),
  totalWithdrawn: t.Number(),
  lifetimePnL: t.Number(),
});

/**
 * User followers/following query
 */
export const FollowersQuerySchema = t.Object({
  limit: t.Optional(t.Number({ default: 50, maximum: 100 })),
  offset: t.Optional(t.Number({ default: 0 })),
  includeMutual: t.Optional(t.Boolean({ default: false })),
});

