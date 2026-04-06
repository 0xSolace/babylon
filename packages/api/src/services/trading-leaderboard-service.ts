import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  gt,
  lt,
  or,
  sql,
  users,
} from '@babylon/db';
import type {
  LeaderboardPosition,
  LeaderboardResult,
  LeaderboardScope,
} from './leaderboard-types';

const leaderboardSelectFields = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  profileImageUrl: users.profileImageUrl,
  reputationPoints: users.reputationPoints,
  virtualBalance: users.virtualBalance,
  lifetimePnL: users.lifetimePnL,
  createdAt: users.createdAt,
  onChainRegistered: users.onChainRegistered,
  nftTokenId: users.nftTokenId,
  isAgent: users.isAgent,
  managedBy: users.managedBy,
};

export class TradingLeaderboardService {
  static async getWalletLeaderboard(
    page = 1,
    pageSize = 100
  ): Promise<LeaderboardResult> {
    const skip = (page - 1) * pageSize;

    const [countResult] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.isActor, false));

    const usersResult = await db
      .select(leaderboardSelectFields)
      .from(users)
      .where(eq(users.isActor, false))
      .orderBy(desc(users.lifetimePnL), asc(users.createdAt), asc(users.id))
      .limit(pageSize)
      .offset(skip);

    const usersWithRank = usersResult.map((user, index) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl,
      reputationPoints: user.reputationPoints ?? 0,
      balance: Number(user.virtualBalance ?? 0),
      lifetimePnL: Number(user.lifetimePnL ?? 0),
      createdAt: user.createdAt,
      isAgent: user.isAgent,
      managedBy: user.managedBy,
      onChainRegistered: user.onChainRegistered,
      nftTokenId: user.nftTokenId,
      rank: skip + index + 1,
    }));

    const totalCount = countResult?.count ?? 0;
    return {
      users: usersWithRank,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      leaderboardType: 'wallet',
      leaderboardMetric: 'trading',
    };
  }

  static async getTeamLeaderboard(
    page = 1,
    pageSize = 100
  ): Promise<LeaderboardResult> {
    const skip = (page - 1) * pageSize;

    const [countResult] = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.isActor, false), eq(users.isAgent, false)));

    const teamsResult = await db.execute(sql`
      SELECT
        u."id",
        u."username",
        u."displayName",
        u."profileImageUrl",
        u."reputationPoints"::numeric AS "reputationPoints",
        u."virtualBalance"::numeric AS "balance",
        u."lifetimePnL"::numeric AS "userLifetimePnL",
        u."onChainRegistered",
        u."nftTokenId",
        u."createdAt",
        COALESCE(agents."agentLifetimePnL", 0)::numeric AS "agentLifetimePnL",
        COALESCE(agents."agentCount", 0)::int AS "agentCount",
        (u."lifetimePnL"::numeric + COALESCE(agents."agentLifetimePnL", 0))::numeric AS "teamLifetimePnL"
      FROM "User" u
      LEFT JOIN (
        SELECT
          "managedBy",
          SUM("lifetimePnL"::numeric) AS "agentLifetimePnL",
          COUNT(*)::int AS "agentCount"
        FROM "User"
        WHERE "isAgent" = true AND "isActor" = false
        GROUP BY "managedBy"
      ) agents ON agents."managedBy" = u."id"
      WHERE u."isActor" = false AND u."isAgent" = false
      ORDER BY "teamLifetimePnL" DESC, u."createdAt" ASC, u."id" ASC
      LIMIT ${pageSize} OFFSET ${skip}
    `);

    const rows = teamsResult as unknown as Array<{
      id: string;
      username: string | null;
      displayName: string | null;
      profileImageUrl: string | null;
      reputationPoints: string;
      balance: string;
      userLifetimePnL: string;
      onChainRegistered: boolean;
      nftTokenId: number | null;
      createdAt: Date;
      agentLifetimePnL: string;
      agentCount: number;
      teamLifetimePnL: string;
    }>;

    const usersWithRank = rows.map((team, index) => ({
      id: team.id,
      username: team.username,
      displayName: team.displayName,
      profileImageUrl: team.profileImageUrl,
      reputationPoints: Number(team.reputationPoints ?? 0),
      balance: Number(team.balance ?? 0),
      lifetimePnL: Number(team.userLifetimePnL ?? 0),
      userLifetimePnL: Number(team.userLifetimePnL ?? 0),
      agentLifetimePnL: Number(team.agentLifetimePnL ?? 0),
      teamLifetimePnL: Number(team.teamLifetimePnL ?? 0),
      createdAt: team.createdAt,
      isAgent: false,
      onChainRegistered: team.onChainRegistered,
      nftTokenId: team.nftTokenId,
      agentCount: team.agentCount ?? 0,
      rank: skip + index + 1,
    }));

    const totalCount = countResult?.count ?? 0;
    return {
      users: usersWithRank,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      leaderboardType: 'team',
      leaderboardMetric: 'trading',
    };
  }

  static async getUserPosition(
    userId: string,
    leaderboardType: LeaderboardScope,
    pageSize = 100
  ): Promise<LeaderboardPosition | null> {
    const userResult = await db
      .select(leaderboardSelectFields)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResult[0]) return null;
    const user = userResult[0];

    const effectiveUserId =
      leaderboardType === 'team' && user.isAgent && user.managedBy
        ? user.managedBy
        : user.id;

    let effectiveUser = user;
    if (effectiveUserId !== user.id) {
      const managerResult = await db
        .select(leaderboardSelectFields)
        .from(users)
        .where(eq(users.id, effectiveUserId))
        .limit(1);
      if (!managerResult[0]) return null;
      effectiveUser = managerResult[0];
    }

    if (leaderboardType === 'wallet') {
      const effectiveLifetimePnL = effectiveUser.lifetimePnL ?? '0';
      const [higherCount] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.isActor, false),
            or(
              gt(users.lifetimePnL, effectiveLifetimePnL),
              and(
                eq(users.lifetimePnL, effectiveLifetimePnL),
                or(
                  lt(users.createdAt, effectiveUser.createdAt),
                  and(
                    eq(users.createdAt, effectiveUser.createdAt),
                    lt(users.id, effectiveUser.id)
                  )
                )
              )
            )
          )
        );

      const rank = (higherCount?.count ?? 0) + 1;
      return {
        rank,
        page: Math.ceil(rank / pageSize),
        entry: {
          id: effectiveUser.id,
          username: effectiveUser.username,
          displayName: effectiveUser.displayName,
          profileImageUrl: effectiveUser.profileImageUrl,
          reputationPoints: effectiveUser.reputationPoints ?? 0,
          balance: Number(effectiveUser.virtualBalance ?? 0),
          lifetimePnL: Number(effectiveUser.lifetimePnL ?? 0),
          createdAt: effectiveUser.createdAt,
          isAgent: effectiveUser.isAgent,
          managedBy: effectiveUser.managedBy,
          onChainRegistered: effectiveUser.onChainRegistered,
          nftTokenId: effectiveUser.nftTokenId,
          rank,
        },
      };
    }

    const [agentLifetimePnL] = await db
      .select({
        lifetimePnLTotal: sql<string>`COALESCE(SUM("lifetimePnL"::numeric), 0)`,
      })
      .from(users)
      .where(
        and(
          eq(users.managedBy, effectiveUserId),
          eq(users.isAgent, true),
          eq(users.isActor, false)
        )
      );

    const teamLifetimePnL =
      Number(effectiveUser.lifetimePnL ?? 0) +
      Number(agentLifetimePnL?.lifetimePnLTotal ?? 0);

    const higherResult = await db.execute(sql`
      SELECT COUNT(*)::int AS "count" FROM (
        SELECT u."id"
        FROM "User" u
        LEFT JOIN (
          SELECT
            "managedBy",
            SUM("lifetimePnL"::numeric) AS "agentLifetimePnL"
          FROM "User"
          WHERE "isAgent" = true AND "isActor" = false
          GROUP BY "managedBy"
        ) a ON a."managedBy" = u."id"
        WHERE u."isActor" = false AND u."isAgent" = false
          AND (
            (u."lifetimePnL"::numeric + COALESCE(a."agentLifetimePnL", 0)) > ${teamLifetimePnL}
            OR (
              (u."lifetimePnL"::numeric + COALESCE(a."agentLifetimePnL", 0)) = ${teamLifetimePnL}
              AND (
                u."createdAt" < ${effectiveUser.createdAt.toISOString()}
                OR (u."createdAt" = ${effectiveUser.createdAt.toISOString()} AND u."id" < ${effectiveUserId})
              )
            )
          )
      ) higher
    `);

    const higherRows = higherResult as unknown as Array<{ count: number }>;
    const rank = (higherRows[0]?.count ?? 0) + 1;

    const [agentCountResult] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.managedBy, effectiveUserId),
          eq(users.isAgent, true),
          eq(users.isActor, false)
        )
      );

    return {
      rank,
      page: Math.ceil(rank / pageSize),
      entry: {
        id: effectiveUser.id,
        username: effectiveUser.username,
        displayName: effectiveUser.displayName,
        profileImageUrl: effectiveUser.profileImageUrl,
        reputationPoints: Number(effectiveUser.reputationPoints ?? 0),
        balance: Number(effectiveUser.virtualBalance ?? 0),
        lifetimePnL: Number(effectiveUser.lifetimePnL ?? 0),
        userLifetimePnL: Number(effectiveUser.lifetimePnL ?? 0),
        agentLifetimePnL: Number(agentLifetimePnL?.lifetimePnLTotal ?? 0),
        teamLifetimePnL,
        createdAt: effectiveUser.createdAt,
        isAgent: false,
        onChainRegistered: effectiveUser.onChainRegistered,
        nftTokenId: effectiveUser.nftTokenId,
        agentCount: agentCountResult?.count ?? 0,
        rank,
      },
    };
  }
}
