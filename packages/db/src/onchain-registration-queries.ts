/**
 * DB reads/writes for `onchain-service` registration flow (Agent0 / ERC-8004).
 */

import { and, eq, ne, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { follows } from './tables/follows';
import { referrals } from './tables/referrals';
import { users } from './tables/user';

type OcDb = DrizzleClient | Transaction;

export const onchainRegistrationUserSelect = {
  id: users.id,
  username: users.username,
  privyWalletId: users.privyWalletId,
  walletAddress: users.walletAddress,
  onChainRegistered: users.onChainRegistered,
  nftTokenId: users.nftTokenId,
  agent0TokenId: users.agent0TokenId,
  referredBy: users.referredBy,
} as const;

export type OnchainRegistrationUserRow = {
  id: string;
  username: string | null;
  privyWalletId: string | null;
  walletAddress: string | null;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  agent0TokenId: number | null;
  referredBy: string | null;
};

export async function resolveOnchainReferrerFromCode(
  c: OcDb,
  referralCode: string,
  currentUserId: string
): Promise<{ referrerId: string | null; selfReferral: boolean }> {
  const [referrer] = await c
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${referralCode})`)
    .limit(1);

  if (referrer && referrer.id !== currentUserId) {
    return { referrerId: referrer.id, selfReferral: false as const };
  }

  const [referralOwner] = await c
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);

  if (referralOwner && referralOwner.id !== currentUserId) {
    return { referrerId: referralOwner.id, selfReferral: false as const };
  }

  const selfReferral =
    referrer?.id === currentUserId || referralOwner?.id === currentUserId;
  return { referrerId: null as string | null, selfReferral };
}

export async function selectOnchainRegistrationUserById(
  c: OcDb,
  id: string
): Promise<OnchainRegistrationUserRow | undefined> {
  const [row] = await c
    .select(onchainRegistrationUserSelect)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row;
}

export async function selectOnchainRegistrationUserByUsernameCaseInsensitive(
  c: OcDb,
  username: string
): Promise<OnchainRegistrationUserRow | undefined> {
  const [row] = await c
    .select(onchainRegistrationUserSelect)
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  return row;
}

export async function insertOnchainAgentUser(
  c: OcDb,
  row: {
    id: string;
    privyId: string;
    username: string;
    displayName: string;
    bio: string;
    profileImageUrl: string | null;
    coverImageUrl: string | null;
  }
): Promise<OnchainRegistrationUserRow | undefined> {
  const [created] = await c
    .insert(users)
    .values({
      id: row.id,
      privyId: row.privyId,
      username: row.username,
      displayName: row.displayName,
      bio: row.bio,
      profileImageUrl: row.profileImageUrl,
      coverImageUrl: row.coverImageUrl,
      isActor: false,
      virtualBalance: '10000',
      totalDeposited: '10000',
      updatedAt: new Date(),
    })
    .returning(onchainRegistrationUserSelect);
  return created;
}

export async function insertOnchainHumanUser(
  c: OcDb,
  row: {
    id: string;
    privyId: string;
    walletAddress: string | null;
    username: string;
    displayName: string;
    bio: string;
    profileImageUrl: string | null;
    coverImageUrl: string | null;
    referredBy: string | null;
  }
): Promise<OnchainRegistrationUserRow | undefined> {
  const [created] = await c
    .insert(users)
    .values({
      id: row.id,
      privyId: row.privyId,
      walletAddress: row.walletAddress,
      username: row.username,
      displayName: row.displayName,
      bio: row.bio,
      profileImageUrl: row.profileImageUrl,
      coverImageUrl: row.coverImageUrl,
      isActor: false,
      virtualBalance: '0',
      totalDeposited: '0',
      referredBy: row.referredBy,
      updatedAt: new Date(),
    })
    .returning(onchainRegistrationUserSelect);
  return created;
}

export async function updateHumanUserProfileForOnchainRegistration(
  c: OcDb,
  profileSubject: OnchainRegistrationUserRow,
  args: {
    walletAddress: string | null | undefined;
    finalUsername: string;
    displayName?: string | null;
    bio?: string | null;
    profileImageUrl?: string | null;
    coverImageUrl?: string | null;
    referrerId: string | null;
  }
): Promise<OnchainRegistrationUserRow | undefined> {
  const [full] = await c
    .select()
    .from(users)
    .where(eq(users.id, profileSubject.id))
    .limit(1);

  const [updated] = await c
    .update(users)
    .set({
      walletAddress:
        args.walletAddress?.toLowerCase() ?? profileSubject.walletAddress,
      username: args.finalUsername || profileSubject.username,
      displayName: args.displayName || args.finalUsername || full?.displayName,
      bio: args.bio || full?.bio,
      profileImageUrl: args.profileImageUrl ?? full?.profileImageUrl,
      coverImageUrl: args.coverImageUrl ?? full?.coverImageUrl,
      referredBy: args.referrerId ?? profileSubject.referredBy ?? undefined,
    })
    .where(eq(users.id, profileSubject.id))
    .returning(onchainRegistrationUserSelect);

  return updated;
}

export async function clearStaleOnchainRegistrationFlags(
  c: OcDb,
  userId: string
): Promise<void> {
  await c
    .update(users)
    .set({
      onChainRegistered: false,
      nftTokenId: null,
      agent0TokenId: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function findConflictingUserByAgent0TokenId(
  c: OcDb,
  agent0TokenId: number,
  excludeUserId: string
): Promise<{ id: string } | undefined> {
  const [row] = await c
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.agent0TokenId, agent0TokenId), ne(users.id, excludeUserId))
    )
    .limit(1);
  return row;
}

export async function clearUserAgent0RegistrationState(
  c: OcDb,
  userId: string
): Promise<void> {
  await c
    .update(users)
    .set({
      agent0TokenId: null,
      onChainRegistered: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function persistAgent0RegistrationToUser(
  c: OcDb,
  userId: string,
  args: {
    agent0TokenId: number;
    agent0MetadataCID: string | null;
    registrationTxHash: string | null;
  }
): Promise<void> {
  await c
    .update(users)
    .set({
      onChainRegistered: true,
      agent0TokenId: args.agent0TokenId,
      agent0MetadataCID: args.agent0MetadataCID,
      agent0RegisteredAt: new Date(),
      registrationTxHash: args.registrationTxHash ?? null,
      registrationTimestamp: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function upsertCompletedReferralAfterOnchain(
  c: OcDb,
  args: {
    referralCode: string;
    referredUserId: string;
    referrerId: string;
    newReferralId: string;
    completedAt: Date;
    createdAt: Date;
  }
): Promise<void> {
  const [existing] = await c
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.referralCode, args.referralCode),
        eq(referrals.referredUserId, args.referredUserId)
      )
    )
    .limit(1);

  if (existing) {
    await c
      .update(referrals)
      .set({ status: 'completed', completedAt: args.completedAt })
      .where(eq(referrals.id, existing.id));
  } else {
    await c.insert(referrals).values({
      id: args.newReferralId,
      referrerId: args.referrerId,
      referralCode: args.referralCode,
      referredUserId: args.referredUserId,
      status: 'completed',
      completedAt: args.completedAt,
      createdAt: args.createdAt,
    });
  }
}

export async function upsertRejectedReferralAfterOnchain(
  c: OcDb,
  args: {
    referralCode: string;
    referredUserId: string;
    referrerId: string;
    newReferralId: string;
    createdAt: Date;
  }
): Promise<void> {
  const [existing] = await c
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.referralCode, args.referralCode),
        eq(referrals.referredUserId, args.referredUserId)
      )
    )
    .limit(1);

  if (existing) {
    await c
      .update(referrals)
      .set({ status: 'rejected' })
      .where(eq(referrals.id, existing.id));
  } else {
    await c.insert(referrals).values({
      id: args.newReferralId,
      referrerId: args.referrerId,
      referralCode: args.referralCode,
      referredUserId: args.referredUserId,
      status: 'rejected',
      createdAt: args.createdAt,
    });
  }
}

export async function ensureFollowFromReferral(
  c: OcDb,
  args: {
    followId: string;
    followerId: string;
    followingId: string;
    createdAt: Date;
  }
): Promise<void> {
  const [existingFollow] = await c
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, args.followerId),
        eq(follows.followingId, args.followingId)
      )
    )
    .limit(1);

  if (!existingFollow) {
    await c.insert(follows).values({
      id: args.followId,
      followerId: args.followerId,
      followingId: args.followingId,
      createdAt: args.createdAt,
    });
  }
}
