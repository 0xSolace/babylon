/**
 * SQL for `GET /api/users/by-username/[username]` (optional-user RLS `db` context).
 */

import { count, eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { follows } from './tables/follows';
import { positions } from './tables/positions';
import { reactions } from './tables/reactions';
import { users } from './tables/user';

type WebUserByUsernameDb = DrizzleClient | Transaction;

/** Profile slice returned for public username lookup. */
export type UserPublicProfileByUsernameRow = {
  id: string;
  walletAddress: string | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  isActor: boolean;
  isAgent: boolean;
  managedBy: string | null;
  profileComplete: boolean;
  hasUsername: boolean;
  hasBio: boolean;
  hasProfileImage: boolean;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  virtualBalance: string | null;
  lifetimePnL: string | null;
  reputationPoints: number;
  referralCount: number;
  referralCode: string | null;
  hasFarcaster: boolean;
  hasTwitter: boolean;
  farcasterUsername: string | null;
  twitterUsername: string | null;
  usernameChangedAt: Date | null;
  createdAt: Date;
};

export async function selectUserPublicProfileByUsernameCaseInsensitive(
  db: WebUserByUsernameDb,
  username: string
): Promise<UserPublicProfileByUsernameRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      coverImageUrl: users.coverImageUrl,
      isActor: users.isActor,
      isAgent: users.isAgent,
      managedBy: users.managedBy,
      profileComplete: users.profileComplete,
      hasUsername: users.hasUsername,
      hasBio: users.hasBio,
      hasProfileImage: users.hasProfileImage,
      onChainRegistered: users.onChainRegistered,
      nftTokenId: users.nftTokenId,
      virtualBalance: users.virtualBalance,
      lifetimePnL: users.lifetimePnL,
      reputationPoints: users.reputationPoints,
      referralCount: users.referralCount,
      referralCode: users.referralCode,
      hasFarcaster: users.hasFarcaster,
      hasTwitter: users.hasTwitter,
      farcasterUsername: users.farcasterUsername,
      twitterUsername: users.twitterUsername,
      usernameChangedAt: users.usernameChangedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  return row;
}

export type UserSocialActivityCounts = {
  positions: number;
  comments: number;
  reactions: number;
  followers: number;
  following: number;
};

export async function selectUserSocialActivityCountsByUserId(
  db: WebUserByUsernameDb,
  userId: string
): Promise<UserSocialActivityCounts> {
  const [
    [positionAgg],
    [commentAgg],
    [reactionAgg],
    [followerAgg],
    [followingAgg],
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(positions)
      .where(eq(positions.userId, userId)),
    db
      .select({ count: count() })
      .from(comments)
      .where(eq(comments.authorId, userId)),
    db
      .select({ count: count() })
      .from(reactions)
      .where(eq(reactions.userId, userId)),
    db
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followingId, userId)),
    db
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followerId, userId)),
  ]);

  return {
    positions: Number(positionAgg?.count ?? 0),
    comments: Number(commentAgg?.count ?? 0),
    reactions: Number(reactionAgg?.count ?? 0),
    followers: Number(followerAgg?.count ?? 0),
    following: Number(followingAgg?.count ?? 0),
  };
}
