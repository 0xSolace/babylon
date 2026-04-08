/**
 * SQL for `TotalPointsService` (recompute, dirty flags, snapshots, bulk backfill).
 *
 * **Why here:** Keeps multi-table reads/updates under `asSystem`. Perp/prediction
 * valuation and fee math stay in `packages/engine`.
 */

import {
  generateSnowflakeId,
  resolveUserIdentifierKind,
} from '@babylon/shared';
import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm';
import { asSystem } from './db';
import { markets } from './tables/markets';
import { perpPositions } from './tables/perp-positions';
import { positions } from './tables/positions';
import { users } from './tables/user';
import { userPointsSnapshots } from './tables/user-points-snapshots';
import { whitelist } from './tables/whitelist-entries';

export type TotalPointsRecomputeUserRow = {
  id: string;
  privyId: string | null;
  virtualBalance: unknown;
  reputationPoints: number;
};

export type TotalPointsPerpRow = {
  size: number;
  leverage: number;
  unrealizedPnL: number;
};

export type TotalPointsPredictionRow = {
  shares: unknown;
  avgPrice: unknown;
  side: boolean | null;
  marketYesShares: unknown;
  marketNoShares: unknown;
};

/**
 * Single transaction: load user + open positions, compute total via `compute`,
 * persist `totalPoints`. Preserves read-your-writes atomicity vs split round-trips.
 */
export type TotalPointsRecomputeResult =
  | { userFound: false; totalPoints: 0 }
  | { userFound: true; totalPoints: number };

export async function runTotalPointsRecomputeTransaction(
  normalizedUserId: string,
  compute: (ctx: {
    user: TotalPointsRecomputeUserRow;
    perpRows: TotalPointsPerpRow[];
    predictionRows: TotalPointsPredictionRow[];
  }) => number
): Promise<TotalPointsRecomputeResult> {
  const kind = resolveUserIdentifierKind(normalizedUserId);

  const whereClause =
    kind === 'id'
      ? eq(users.id, normalizedUserId)
      : kind === 'privyId'
        ? eq(users.privyId, normalizedUserId)
        : sql`lower(${users.username}) = lower(${normalizedUserId})`;

  return asSystem(async (c) => {
    const userResult = await c
      .select({
        id: users.id,
        privyId: users.privyId,
        virtualBalance: users.virtualBalance,
        reputationPoints: users.reputationPoints,
      })
      .from(users)
      .where(whereClause)
      .limit(1);

    const userRow = userResult[0];
    if (!userRow) {
      return { userFound: false, totalPoints: 0 };
    }

    const user = userRow as TotalPointsRecomputeUserRow;
    const canonicalUserId = user.id;
    const positionUserIds = Array.from(
      new Set([canonicalUserId, user.privyId].filter(Boolean))
    ) as string[];

    const [perpRows, predictionRows] = await Promise.all([
      c
        .select({
          size: perpPositions.size,
          leverage: perpPositions.leverage,
          unrealizedPnL: perpPositions.unrealizedPnL,
        })
        .from(perpPositions)
        .where(
          and(
            inArray(perpPositions.userId, positionUserIds),
            isNull(perpPositions.closedAt)
          )
        ),
      c
        .select({
          shares: positions.shares,
          avgPrice: positions.avgPrice,
          side: positions.side,
          marketYesShares: markets.yesShares,
          marketNoShares: markets.noShares,
        })
        .from(positions)
        .innerJoin(markets, eq(positions.marketId, markets.id))
        .where(
          and(
            inArray(positions.userId, positionUserIds),
            eq(markets.resolved, false),
            gt(positions.shares, '0')
          )
        ),
    ]);

    const totalPoints = compute({ user, perpRows, predictionRows });

    await c
      .update(users)
      .set({ totalPoints: totalPoints.toFixed(2) })
      .where(eq(users.id, canonicalUserId));

    return { userFound: true, totalPoints };
  }, 'total-points-recompute');
}

export async function markUserTotalPointsDirty(
  normalizedUserId: string
): Promise<void> {
  const kind = resolveUserIdentifierKind(normalizedUserId);

  const whereClause =
    kind === 'id'
      ? eq(users.id, normalizedUserId)
      : kind === 'privyId'
        ? eq(users.privyId, normalizedUserId)
        : sql`lower(${users.username}) = lower(${normalizedUserId})`;

  await asSystem(
    async (c) =>
      c
        .update(users)
        .set({ totalPointsDirtyAt: new Date() })
        .where(whereClause),
    'total-points-mark-dirty'
  );
}

export async function markZeroTotalPointsDirtyBatch(params: {
  batchSize: number;
  whitelistOnly: boolean;
}): Promise<number> {
  const { batchSize, whitelistOnly } = params;
  const baseWhere = and(
    eq(users.isActor, false),
    eq(users.totalPoints, '0'),
    isNull(users.totalPointsDirtyAt)
  );

  return asSystem(async (c) => {
    let candidates: { id: string }[];
    if (whitelistOnly) {
      candidates = await c
        .select({ id: users.id })
        .from(users)
        .innerJoin(
          whitelist,
          and(eq(whitelist.userId, users.id), isNull(whitelist.revokedAt))
        )
        .where(baseWhere)
        .orderBy(users.id)
        .limit(batchSize);
    } else {
      candidates = await c
        .select({ id: users.id })
        .from(users)
        .where(baseWhere)
        .orderBy(users.id)
        .limit(batchSize);
    }

    if (candidates.length === 0) return 0;

    const ids = candidates.map((row) => row.id);
    await c
      .update(users)
      .set({ totalPointsDirtyAt: new Date() })
      .where(inArray(users.id, ids));

    return candidates.length;
  }, 'total-points-mark-zero-dirty');
}

export async function snapshotTotalPointsUserBatch(params: {
  whitelistOnly: boolean;
  lastId: string | null;
  batchSize: number;
  snapshotDate: Date;
}): Promise<{ count: number; lastUserId: string | null }> {
  const { whitelistOnly, lastId, batchSize, snapshotDate } = params;

  return asSystem(async (c) => {
    const actorAndCursor = lastId
      ? and(eq(users.isActor, false), gt(users.id, lastId))
      : eq(users.isActor, false);

    let b: { id: string; totalPoints: string | null }[];
    if (whitelistOnly) {
      b = await c
        .select({ id: users.id, totalPoints: users.totalPoints })
        .from(users)
        .innerJoin(
          whitelist,
          and(eq(whitelist.userId, users.id), isNull(whitelist.revokedAt))
        )
        .where(actorAndCursor)
        .orderBy(users.id)
        .limit(batchSize);
    } else {
      b = await c
        .select({ id: users.id, totalPoints: users.totalPoints })
        .from(users)
        .where(actorAndCursor)
        .orderBy(users.id)
        .limit(batchSize);
    }

    if (b.length === 0) {
      return { count: 0, lastUserId: null };
    }

    const rows = await Promise.all(
      b.map(async (user) => ({
        id: await generateSnowflakeId(),
        userId: user.id,
        totalPoints: user.totalPoints ?? '0',
        snapshotDate,
        period: 'daily' as const,
      }))
    );
    await c.insert(userPointsSnapshots).values(rows);

    const lastUser = b[b.length - 1];
    return { count: b.length, lastUserId: lastUser?.id ?? null };
  }, 'total-points-snapshot-batch');
}

export async function listDirtyTotalPointsUserIdsBatch(params: {
  lastId: string | null;
  batchSize: number;
}): Promise<{ id: string }[]> {
  const { lastId, batchSize } = params;

  const whereClause = (
    lastId
      ? and(isNotNull(users.totalPointsDirtyAt), gt(users.id, lastId))
      : isNotNull(users.totalPointsDirtyAt)
  ) as SQL<unknown>;

  return asSystem(
    async (c) =>
      c
        .select({ id: users.id })
        .from(users)
        .where(whereClause)
        .orderBy(users.id)
        .limit(batchSize),
    'total-points-dirty-batch'
  );
}

export async function clearUserTotalPointsDirtyIfBefore(params: {
  userId: string;
  cutoff: Date;
}): Promise<void> {
  const { userId, cutoff } = params;
  await asSystem(
    async (c) =>
      c
        .update(users)
        .set({ totalPointsDirtyAt: null })
        .where(
          and(eq(users.id, userId), lte(users.totalPointsDirtyAt, cutoff))
        ),
    'total-points-clear-dirty'
  );
}

export async function bulkBackfillTotalPointsFromBalance(params: {
  whitelistOnly: boolean;
}): Promise<number> {
  const { whitelistOnly } = params;

  const result = await asSystem(
    async (c) =>
      whitelistOnly
        ? c.execute(sql`
            UPDATE "User" u
            SET
              "totalPoints" = COALESCE(CAST(u."virtualBalance" AS DECIMAL(18,2)), 0) + u."reputationPoints",
              "totalPointsDirtyAt" = NOW()
            FROM "Whitelist" w
            WHERE w."userId" = u."id"
              AND w."revokedAt" IS NULL
              AND u."totalPoints" = '0'
              AND u."isActor" = false
          `)
        : c.execute(sql`
            UPDATE "User"
            SET
              "totalPoints" = COALESCE(CAST("virtualBalance" AS DECIMAL(18,2)), 0) + "reputationPoints",
              "totalPointsDirtyAt" = NOW()
            WHERE "totalPoints" = '0'
              AND "isActor" = false
          `),
    'total-points-bulk-backfill'
  );

  return Number(
    (result as unknown as { count?: number }).count ?? result?.length ?? 0
  );
}
