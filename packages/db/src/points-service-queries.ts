/**
 * Points / referrals / balance reads and writes for `points-service`.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient, JsonValue } from './client';
import type { Transaction } from './db';
import { actorState } from './tables/actor-state';
import { balanceTransactions } from './tables/balance-transactions';
import { pointsTransactions } from './tables/points-transactions';
import { referrals } from './tables/referrals';
import { users } from './tables/user';

type PointsDb = DrizzleClient | Transaction;

export type PointsAwardUserStateRow = {
  reputationPoints: number;
  invitePoints: number;
  earnedPoints: number;
  bonusPoints: number;
  pointsAwardedForProfile: boolean;
  pointsAwardedForFarcaster: boolean;
  pointsAwardedForFarcasterFollow: boolean;
  pointsAwardedForTwitter: boolean;
  pointsAwardedForTwitterFollow: boolean;
  pointsAwardedForDiscord: boolean;
  pointsAwardedForDiscordJoin: boolean;
  pointsAwardedForWallet: boolean;
  pointsAwardedForReferralBonus: boolean;
  pointsAwardedForShare: boolean;
  pointsAwardedForPrivateGroup: boolean;
  pointsAwardedForPrivateChannel: boolean;
  pointsAwardedForTelegram: boolean;
};

export type PointsAwardUserPatch = Partial<{
  reputationPoints: number;
  invitePoints: number;
  bonusPoints: number;
  pointsAwardedForProfile: boolean;
  pointsAwardedForFarcaster: boolean;
  pointsAwardedForFarcasterFollow: boolean;
  pointsAwardedForTwitter: boolean;
  pointsAwardedForTwitterFollow: boolean;
  pointsAwardedForDiscord: boolean;
  pointsAwardedForDiscordJoin: boolean;
  pointsAwardedForWallet: boolean;
  pointsAwardedForReferralBonus: boolean;
  pointsAwardedForShare: boolean;
  pointsAwardedForPrivateGroup: boolean;
  pointsAwardedForPrivateChannel: boolean;
  pointsAwardedForTelegram: boolean;
}>;

export async function selectPointsAwardUserState(
  db: PointsDb,
  userId: string
): Promise<PointsAwardUserStateRow | undefined> {
  const [row] = await db
    .select({
      reputationPoints: users.reputationPoints,
      invitePoints: users.invitePoints,
      earnedPoints: users.earnedPoints,
      bonusPoints: users.bonusPoints,
      pointsAwardedForProfile: users.pointsAwardedForProfile,
      pointsAwardedForFarcaster: users.pointsAwardedForFarcaster,
      pointsAwardedForFarcasterFollow: users.pointsAwardedForFarcasterFollow,
      pointsAwardedForTwitter: users.pointsAwardedForTwitter,
      pointsAwardedForTwitterFollow: users.pointsAwardedForTwitterFollow,
      pointsAwardedForDiscord: users.pointsAwardedForDiscord,
      pointsAwardedForDiscordJoin: users.pointsAwardedForDiscordJoin,
      pointsAwardedForWallet: users.pointsAwardedForWallet,
      pointsAwardedForReferralBonus: users.pointsAwardedForReferralBonus,
      pointsAwardedForShare: users.pointsAwardedForShare,
      pointsAwardedForPrivateGroup: users.pointsAwardedForPrivateGroup,
      pointsAwardedForPrivateChannel: users.pointsAwardedForPrivateChannel,
      pointsAwardedForTelegram: users.pointsAwardedForTelegram,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateUserPointsAwardPatch(
  tx: Transaction,
  userId: string,
  patch: PointsAwardUserPatch
): Promise<void> {
  await tx.update(users).set(patch).where(eq(users.id, userId));
}

export async function insertPointsTransactionRow(
  tx: Transaction,
  row: {
    id: string;
    userId: string;
    amount: number;
    pointsBefore: number;
    pointsAfter: number;
    reason: string;
    metadata: string | null;
  }
): Promise<void> {
  await tx.insert(pointsTransactions).values(row);
}

export async function countUnqualifiedReferralsWithSignupAwarded(
  db: PointsDb,
  referrerId: string
): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.status, 'completed'),
        isNull(referrals.qualifiedAt),
        eq(referrals.signupPointsAwarded, true)
      )
    );
  return r?.count ?? 0;
}

export type ReferralIdentityRow = {
  registrationIpHash: string | null;
  createdAt: Date;
  walletAddress: string | null;
  privyId: string | null;
  farcasterFid: string | null;
  twitterId: string | null;
};

export async function selectUserReferralIdentity(
  db: PointsDb,
  userId: string
): Promise<ReferralIdentityRow | undefined> {
  const [row] = await db
    .select({
      registrationIpHash: users.registrationIpHash,
      createdAt: users.createdAt,
      walletAddress: users.walletAddress,
      privyId: users.privyId,
      farcasterFid: users.farcasterFid,
      twitterId: users.twitterId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUserReputationPointsOnly(
  db: PointsDb,
  userId: string
): Promise<number | undefined> {
  const [row] = await db
    .select({ reputationPoints: users.reputationPoints })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.reputationPoints;
}

export async function selectLatestReferralIdBetweenUsers(
  db: PointsDb,
  referrerId: string,
  referredUserId: string
): Promise<string | undefined> {
  const [row] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.referredUserId, referredUserId)
      )
    )
    .orderBy(desc(referrals.createdAt))
    .limit(1);
  return row?.id;
}

export async function updateReferralSignupFields(
  db: PointsDb,
  referralId: string,
  patch: {
    signupPointsAwarded?: boolean;
    suspiciousReferralFlags?: JsonValue;
  }
): Promise<void> {
  await db.update(referrals).set(patch).where(eq(referrals.id, referralId));
}

export async function incrementUserReferralCountAfterSignupAward(
  db: PointsDb,
  referrerId: string,
  lastReferralIpHash: string | null
): Promise<void> {
  await db
    .update(users)
    .set({
      referralCount: sql`${users.referralCount} + 1`,
      lastReferralIpHash,
    })
    .where(eq(users.id, referrerId));
}

export type PendingReferralRow = {
  id: string;
  referredUserId: string | null;
  completedAt: Date | null;
};

export async function selectOldestPendingReferralWithoutSignup(
  db: PointsDb,
  referrerId: string
): Promise<PendingReferralRow | undefined> {
  const [row] = await db
    .select({
      id: referrals.id,
      referredUserId: referrals.referredUserId,
      completedAt: referrals.completedAt,
    })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.status, 'completed'),
        eq(referrals.signupPointsAwarded, false)
      )
    )
    .orderBy(asc(referrals.completedAt))
    .limit(1);
  return row;
}

export async function markReferralSignupPointsAwarded(
  db: PointsDb,
  referralId: string
): Promise<void> {
  await db
    .update(referrals)
    .set({ signupPointsAwarded: true })
    .where(eq(referrals.id, referralId));
}

export async function incrementUserReferralCount(
  db: PointsDb,
  referrerId: string
): Promise<void> {
  await db
    .update(users)
    .set({
      referralCount: sql`${users.referralCount} + 1`,
    })
    .where(eq(users.id, referrerId));
}

export type ReferredUserSocialSlice = {
  referredBy: string | null;
  hasFarcaster: boolean;
  hasTwitter: boolean;
  walletAddress: string | null;
};

export async function selectReferredUserSocialSlice(
  db: PointsDb,
  referredUserId: string
): Promise<ReferredUserSocialSlice | undefined> {
  const [row] = await db
    .select({
      referredBy: users.referredBy,
      hasFarcaster: users.hasFarcaster,
      hasTwitter: users.hasTwitter,
      walletAddress: users.walletAddress,
    })
    .from(users)
    .where(eq(users.id, referredUserId))
    .limit(1);
  return row;
}

export type ReferralQualificationRow = {
  id: string;
  qualifiedAt: Date | null;
};

export async function selectReferralQualificationRow(
  db: PointsDb,
  referrerId: string,
  referredUserId: string
): Promise<ReferralQualificationRow | undefined> {
  const [row] = await db
    .select({
      id: referrals.id,
      qualifiedAt: referrals.qualifiedAt,
    })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.referredUserId, referredUserId),
        eq(referrals.status, 'completed')
      )
    )
    .orderBy(desc(referrals.completedAt))
    .limit(1);
  return row;
}

export async function updateReferralQualifiedAtNow(
  db: PointsDb,
  referralId: string
): Promise<void> {
  await db
    .update(referrals)
    .set({ qualifiedAt: new Date() })
    .where(eq(referrals.id, referralId));
}

export async function selectExistingPurchaseBalanceTx(
  tx: Transaction,
  args: {
    userId: string;
    transactionType: string;
    relatedIdValue: string;
  }
): Promise<boolean> {
  const rows = await tx
    .select({ id: balanceTransactions.id })
    .from(balanceTransactions)
    .where(
      and(
        eq(balanceTransactions.userId, args.userId),
        eq(balanceTransactions.type, args.transactionType),
        eq(balanceTransactions.relatedId, args.relatedIdValue)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function selectUserVirtualBalance(
  tx: Transaction,
  userId: string
): Promise<{ virtualBalance: string | null } | undefined> {
  const [row] = await tx
    .select({ virtualBalance: users.virtualBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function addUserVirtualBalanceAtomic(
  tx: Transaction,
  userId: string,
  pointsAmount: number
): Promise<void> {
  await tx
    .update(users)
    .set({
      virtualBalance: sql`COALESCE(CAST("virtualBalance" AS NUMERIC), 0) + ${pointsAmount}`,
    })
    .where(eq(users.id, userId));
}

export async function insertBalanceTransactionRow(
  tx: Transaction,
  row: {
    id: string;
    userId: string;
    type: string;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    relatedId?: string | null;
    description?: string | null;
  }
): Promise<void> {
  await tx.insert(balanceTransactions).values(row);
}

export async function selectExistingBalanceTxByRelatedId(
  tx: Transaction,
  userId: string,
  relatedId: string
): Promise<boolean> {
  const rows = await tx
    .select({ id: balanceTransactions.id })
    .from(balanceTransactions)
    .where(
      and(
        eq(balanceTransactions.userId, userId),
        eq(balanceTransactions.relatedId, relatedId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function deductUserVirtualBalanceFloored(
  tx: Transaction,
  userId: string,
  pointsToDeduct: number
): Promise<void> {
  await tx
    .update(users)
    .set({
      virtualBalance: sql`GREATEST(0, COALESCE(CAST("virtualBalance" AS NUMERIC), 0) - ${pointsToDeduct})`,
    })
    .where(eq(users.id, userId));
}

export type UserPointsSummaryRow = {
  reputationPoints: number;
  referralCount: number;
};

export async function selectUserPointsSummary(
  db: PointsDb,
  userId: string
): Promise<UserPointsSummaryRow | undefined> {
  const [row] = await db
    .select({
      reputationPoints: users.reputationPoints,
      referralCount: users.referralCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function listRecentPointsTransactionsForUser(
  db: PointsDb,
  userId: string,
  limit: number
) {
  return db
    .select()
    .from(pointsTransactions)
    .where(eq(pointsTransactions.userId, userId))
    .orderBy(desc(pointsTransactions.createdAt))
    .limit(limit);
}

const leaderboardUserSelectFields = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  profileImageUrl: users.profileImageUrl,
  reputationPoints: users.reputationPoints,
  invitePoints: users.invitePoints,
  earnedPoints: users.earnedPoints,
  bonusPoints: users.bonusPoints,
  referralCount: users.referralCount,
  virtualBalance: users.virtualBalance,
  lifetimePnL: users.lifetimePnL,
  totalPoints: users.totalPoints,
  createdAt: users.createdAt,
  onChainRegistered: users.onChainRegistered,
  nftTokenId: users.nftTokenId,
};

export type LeaderboardUserSelectRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  reputationPoints: number;
  invitePoints: number;
  earnedPoints: number;
  bonusPoints: number;
  referralCount: number;
  virtualBalance: string | null;
  lifetimePnL: string | null;
  totalPoints: string | null;
  createdAt: Date;
  onChainRegistered: boolean;
  nftTokenId: number | null;
};

export async function countNonActorNonAgentUsers(
  db: PointsDb
): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.isActor, false), eq(users.isAgent, false)));
  return r?.count ?? 0;
}

export async function selectLeaderboardUsersByTotalPointsPage(
  db: PointsDb,
  skip: number,
  pageSize: number
): Promise<LeaderboardUserSelectRow[]> {
  return db
    .select(leaderboardUserSelectFields)
    .from(users)
    .where(and(eq(users.isActor, false), eq(users.isAgent, false)))
    .orderBy(desc(users.totalPoints))
    .limit(pageSize)
    .offset(skip);
}

export async function selectLeaderboardUsersAllMinReputation(
  db: PointsDb,
  minPoints: number
): Promise<LeaderboardUserSelectRow[]> {
  return db
    .select(leaderboardUserSelectFields)
    .from(users)
    .where(
      and(
        eq(users.isActor, false),
        eq(users.isAgent, false),
        gte(users.reputationPoints, minPoints)
      )
    );
}

export async function selectLeaderboardUsersEarnedNonZero(
  db: PointsDb
): Promise<LeaderboardUserSelectRow[]> {
  return db
    .select(leaderboardUserSelectFields)
    .from(users)
    .where(
      and(
        eq(users.isActor, false),
        eq(users.isAgent, false),
        ne(users.earnedPoints, 0)
      )
    );
}

export async function selectLeaderboardUsersWithInvitePoints(
  db: PointsDb
): Promise<LeaderboardUserSelectRow[]> {
  return db
    .select(leaderboardUserSelectFields)
    .from(users)
    .where(
      and(
        eq(users.isActor, false),
        eq(users.isAgent, false),
        gt(users.invitePoints, 0)
      )
    );
}

export type ActorLeaderboardStateRow = {
  id: string;
  reputationPoints: number;
  createdAt: Date;
};

export async function selectActorStatesMinReputation(
  db: PointsDb,
  minPoints: number
): Promise<ActorLeaderboardStateRow[]> {
  return db
    .select({
      id: actorState.id,
      reputationPoints: actorState.reputationPoints,
      createdAt: actorState.createdAt,
    })
    .from(actorState)
    .where(gte(actorState.reputationPoints, minPoints));
}

export async function selectUserReputationAndActorFlag(
  db: PointsDb,
  userId: string
): Promise<{ reputationPoints: number; isActor: boolean } | undefined> {
  const [row] = await db
    .select({
      reputationPoints: users.reputationPoints,
      isActor: users.isActor,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function countUsersWithHigherReputationNonActor(
  db: PointsDb,
  reputationPoints: number
): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        gt(users.reputationPoints, reputationPoints),
        eq(users.isActor, false)
      )
    );
  return r?.count ?? 0;
}

export async function countActorStatesWithHigherReputation(
  db: PointsDb,
  reputationPoints: number
): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(actorState)
    .where(gt(actorState.reputationPoints, reputationPoints));
  return r?.count ?? 0;
}

const walletLeaderboardSelectFields = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  profileImageUrl: users.profileImageUrl,
  virtualBalance: users.virtualBalance,
  lifetimePnL: users.lifetimePnL,
  totalPoints: users.totalPoints,
  createdAt: users.createdAt,
  onChainRegistered: users.onChainRegistered,
  nftTokenId: users.nftTokenId,
  isAgent: users.isAgent,
  managedBy: users.managedBy,
};

export type WalletLeaderboardDbRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  virtualBalance: string | null;
  lifetimePnL: string | null;
  totalPoints: string | null;
  createdAt: Date;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  isAgent: boolean;
  managedBy: string | null;
};

export async function countUsersNonActor(db: PointsDb): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isActor, false));
  return r?.count ?? 0;
}

export async function selectWalletLeaderboardPage(
  db: PointsDb,
  skip: number,
  pageSize: number
): Promise<WalletLeaderboardDbRow[]> {
  return db
    .select(walletLeaderboardSelectFields)
    .from(users)
    .where(eq(users.isActor, false))
    .orderBy(desc(users.totalPoints), asc(users.createdAt), asc(users.id))
    .limit(pageSize)
    .offset(skip);
}

export type TeamLeaderboardSqlRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  userPoints: string;
  balance: string;
  lifetimePnL: string;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  createdAt: Date;
  agentPoints: string;
  agentCount: number;
  teamTotalPoints: string;
};

export async function executeTeamLeaderboardPage(
  db: PointsDb,
  skip: number,
  pageSize: number
): Promise<TeamLeaderboardSqlRow[]> {
  const teamsResult = await db.execute(sql`
      SELECT
        u."id",
        u."username",
        u."displayName",
        u."profileImageUrl",
        u."totalPoints"::numeric AS "userPoints",
        u."virtualBalance"::numeric AS "balance",
        u."lifetimePnL"::numeric AS "lifetimePnL",
        u."onChainRegistered",
        u."nftTokenId",
        u."createdAt",
        COALESCE(agents."agentPoints", 0)::numeric AS "agentPoints",
        COALESCE(agents."agentCount", 0)::int AS "agentCount",
        (u."totalPoints"::numeric + COALESCE(agents."agentPoints", 0))::numeric AS "teamTotalPoints"
      FROM "User" u
      LEFT JOIN (
        SELECT "managedBy",
               SUM("totalPoints"::numeric) AS "agentPoints",
               COUNT(*)::int AS "agentCount"
        FROM "User"
        WHERE "isAgent" = true AND "isActor" = false
        GROUP BY "managedBy"
      ) agents ON agents."managedBy" = u."id"
      WHERE u."isActor" = false AND u."isAgent" = false
      ORDER BY "teamTotalPoints" DESC, u."createdAt" ASC, u."id" ASC
      LIMIT ${pageSize} OFFSET ${skip}
    `);

  return teamsResult as unknown as TeamLeaderboardSqlRow[];
}

const userPositionSelectFields = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  profileImageUrl: users.profileImageUrl,
  virtualBalance: users.virtualBalance,
  lifetimePnL: users.lifetimePnL,
  totalPoints: users.totalPoints,
  createdAt: users.createdAt,
  onChainRegistered: users.onChainRegistered,
  nftTokenId: users.nftTokenId,
  isAgent: users.isAgent,
  managedBy: users.managedBy,
};

export type UserPositionSliceRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  virtualBalance: string | null;
  lifetimePnL: string | null;
  totalPoints: string | null;
  createdAt: Date;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  isAgent: boolean;
  managedBy: string | null;
};

export async function selectUserPositionSlice(
  db: PointsDb,
  userId: string
): Promise<UserPositionSliceRow | undefined> {
  const [row] = await db
    .select(userPositionSelectFields)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function countWalletLeaderboardHigherThanUser(
  db: PointsDb,
  args: {
    effectiveTotalPoints: string;
    effectiveCreatedAt: Date;
    effectiveUserId: string;
  }
): Promise<number> {
  const [higherCount] = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        eq(users.isActor, false),
        or(
          gt(users.totalPoints, args.effectiveTotalPoints),
          and(
            eq(users.totalPoints, args.effectiveTotalPoints),
            or(
              lt(users.createdAt, args.effectiveCreatedAt),
              and(
                eq(users.createdAt, args.effectiveCreatedAt),
                lt(users.id, args.effectiveUserId)
              )
            )
          )
        )
      )
    );
  return higherCount?.count ?? 0;
}

export async function selectAgentTotalPointsSumForManager(
  db: PointsDb,
  managerUserId: string
): Promise<string> {
  const [agentSum] = await db
    .select({
      total: sql<string>`COALESCE(SUM("totalPoints"::numeric), 0)`,
    })
    .from(users)
    .where(
      and(
        eq(users.managedBy, managerUserId),
        eq(users.isAgent, true),
        eq(users.isActor, false)
      )
    );
  return agentSum?.total ?? '0';
}

export async function countTeamLeaderboardHigherThanUser(
  db: PointsDb,
  args: {
    teamTotal: number;
    effectiveUserCreatedAt: Date;
    effectiveUserId: string;
  }
): Promise<number> {
  const higherResult = await db.execute(sql`
      SELECT COUNT(*)::int AS "count" FROM (
        SELECT u."id"
        FROM "User" u
        LEFT JOIN (
          SELECT "managedBy", SUM("totalPoints"::numeric) AS "agentPoints"
          FROM "User" WHERE "isAgent" = true AND "isActor" = false GROUP BY "managedBy"
        ) a ON a."managedBy" = u."id"
        WHERE u."isActor" = false AND u."isAgent" = false
          AND (
            (u."totalPoints"::numeric + COALESCE(a."agentPoints", 0)) > ${args.teamTotal}
            OR (
              (u."totalPoints"::numeric + COALESCE(a."agentPoints", 0)) = ${args.teamTotal}
              AND (
                u."createdAt" < ${args.effectiveUserCreatedAt.toISOString()}
                OR (u."createdAt" = ${args.effectiveUserCreatedAt.toISOString()} AND u."id" < ${args.effectiveUserId})
              )
            )
          )
      ) higher
    `);

  const higherRows = higherResult as unknown as Array<{ count: number }>;
  return higherRows[0]?.count ?? 0;
}

export async function countAgentsForManager(
  db: PointsDb,
  managerUserId: string
): Promise<number> {
  const [agentCountResult] = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        eq(users.managedBy, managerUserId),
        eq(users.isAgent, true),
        eq(users.isActor, false)
      )
    );
  return agentCountResult?.count ?? 0;
}
