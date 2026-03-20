import {
  and,
  asc,
  db,
  eq,
  gte,
  inArray,
  isNull,
  markets,
  perpPositions,
  positions,
  userPnLSnapshots,
  users,
} from '@babylon/db';
import { FEE_CONFIG } from '@babylon/engine/config/fees';
import { toNumber } from '@babylon/engine/portfolio-valuation';
import { sql } from 'drizzle-orm';
import { calculatePredictionPositionSnapshot } from './predictionPositionSnapshot';

export type PnlHistoryRange = '1H' | '4H' | '1D' | '1W' | 'ALL';
export type PnlHistoryScope = 'team' | 'owner' | 'agent';

export interface PnlHistoryPoint {
  time: number;
  value: number;
}

export interface UserPnlMetrics {
  userId: string;
  lifetimePnL: number;
  unrealizedPnL: number;
  currentPnL: number;
}

interface SnapshotMetricRow {
  currentPnL: number;
  snapshotAt: Date;
  userId: string;
}

const TIMEFRAME_DURATIONS: Record<Exclude<PnlHistoryRange, 'ALL'>, number> = {
  '1H': 60 * 60 * 1000,
  '4H': 4 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
};

export function getPnlHistoryCutoff(
  range: PnlHistoryRange,
  now = new Date()
): Date | undefined {
  const durationMs =
    TIMEFRAME_DURATIONS[range as Exclude<PnlHistoryRange, 'ALL'>];
  return durationMs ? new Date(now.getTime() - durationMs) : undefined;
}

export function getHourBoundary(date = new Date()): Date {
  const boundary = new Date(date);
  boundary.setUTCMinutes(0, 0, 0);
  return boundary;
}

export function buildScopedPnlHistoryPoints(params: {
  liveMetricsByUserId?: ReadonlyMap<string, UserPnlMetrics>;
  maxPoints?: number;
  now?: Date;
  scopeUserIds: string[];
  snapshots: SnapshotMetricRow[];
}): PnlHistoryPoint[] {
  const {
    liveMetricsByUserId,
    maxPoints = 100,
    now = new Date(),
    scopeUserIds,
    snapshots,
  } = params;

  if (scopeUserIds.length === 0) {
    return [];
  }

  const scopeIdSet = new Set(scopeUserIds);
  const byTimestamp = new Map<number, number>();

  for (const snapshot of snapshots) {
    if (!scopeIdSet.has(snapshot.userId)) continue;

    const time = snapshot.snapshotAt.getTime();
    byTimestamp.set(time, (byTimestamp.get(time) ?? 0) + snapshot.currentPnL);
  }

  const points = Array.from(byTimestamp.entries())
    .sort(([left], [right]) => left - right)
    .map(([time, value]) => ({ time, value }));

  if (liveMetricsByUserId && liveMetricsByUserId.size > 0) {
    const liveValue = scopeUserIds.reduce((sum, userId) => {
      return sum + (liveMetricsByUserId.get(userId)?.currentPnL ?? 0);
    }, 0);

    const liveTime = now.getTime();
    const lastPoint = points.at(-1);

    if (!lastPoint || lastPoint.time < liveTime) {
      points.push({ time: liveTime, value: liveValue });
    }
  }

  if (points.length <= maxPoints) {
    return points;
  }

  const step = points.length / maxPoints;
  const downsampled: PnlHistoryPoint[] = [];

  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.floor(i * step), points.length - 1);
    const point = points[idx];
    if (!point) continue;
    downsampled.push(point);
  }

  const lastPoint = points[points.length - 1];
  const lastDownsampled = downsampled[downsampled.length - 1];

  if (lastPoint && lastDownsampled?.time !== lastPoint.time) {
    downsampled.push(lastPoint);
  }

  return downsampled;
}

export async function loadCurrentUserPnlMetrics(
  targetUserIds?: string[]
): Promise<Map<string, UserPnlMetrics>> {
  const userFilter =
    targetUserIds && targetUserIds.length > 0
      ? inArray(users.id, targetUserIds)
      : eq(users.isActor, false);

  const userRows = await db
    .select({
      id: users.id,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(userFilter);

  if (userRows.length === 0) {
    return new Map();
  }

  const userIds = userRows.map((row) => row.id);
  const metricsByUserId = new Map<string, UserPnlMetrics>();

  for (const row of userRows) {
    const lifetimePnL = toNumber(row.lifetimePnL);
    metricsByUserId.set(row.id, {
      userId: row.id,
      lifetimePnL,
      unrealizedPnL: 0,
      currentPnL: lifetimePnL,
    });
  }

  const perpUnrealizedRows = await db
    .select({
      userId: perpPositions.userId,
      unrealizedPnL: sql<number>`COALESCE(SUM(${perpPositions.unrealizedPnL}), 0)`,
    })
    .from(perpPositions)
    .where(
      and(
        inArray(perpPositions.userId, userIds),
        isNull(perpPositions.closedAt)
      )
    )
    .groupBy(perpPositions.userId);

  for (const row of perpUnrealizedRows) {
    const metrics = metricsByUserId.get(row.userId);
    if (!metrics) continue;

    const unrealizedPnL = toNumber(row.unrealizedPnL);
    metrics.unrealizedPnL += unrealizedPnL;
    metrics.currentPnL = metrics.lifetimePnL + metrics.unrealizedPnL;
  }

  const predictionRows = await db
    .select({
      userId: positions.userId,
      shares: positions.shares,
      avgPrice: positions.avgPrice,
      side: positions.side,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
    })
    .from(positions)
    .innerJoin(markets, eq(positions.marketId, markets.id))
    .where(
      and(
        inArray(positions.userId, userIds),
        eq(positions.status, 'active'),
        eq(markets.resolved, false)
      )
    );

  for (const row of predictionRows) {
    const metrics = metricsByUserId.get(row.userId);
    if (!metrics) continue;

    const snapshot = calculatePredictionPositionSnapshot({
      shares: toNumber(row.shares),
      avgPrice: toNumber(row.avgPrice),
      sideKey: row.side ? 'yes' : 'no',
      yesShares: toNumber(row.yesShares),
      noShares: toNumber(row.noShares),
      feeRate: FEE_CONFIG.TRADING_FEE_RATE,
      logContext: 'wallet/pnlHistory',
    });

    metrics.unrealizedPnL += snapshot.unrealizedPnL;
    metrics.currentPnL = metrics.lifetimePnL + metrics.unrealizedPnL;
  }

  return metricsByUserId;
}

export async function loadScopedPnlHistoryPoints(params: {
  cutoff?: Date;
  now?: Date;
  scopeUserIds: string[];
}): Promise<PnlHistoryPoint[]> {
  const { cutoff, now = new Date(), scopeUserIds } = params;

  if (scopeUserIds.length === 0) {
    return [];
  }

  const snapshotRows = await db
    .select({
      userId: userPnLSnapshots.userId,
      snapshotAt: userPnLSnapshots.snapshotAt,
      currentPnL: userPnLSnapshots.currentPnL,
    })
    .from(userPnLSnapshots)
    .where(
      cutoff
        ? and(
            inArray(userPnLSnapshots.userId, scopeUserIds),
            gte(userPnLSnapshots.snapshotAt, cutoff)
          )
        : inArray(userPnLSnapshots.userId, scopeUserIds)
    )
    .orderBy(asc(userPnLSnapshots.snapshotAt));

  const liveMetricsByUserId = await loadCurrentUserPnlMetrics(scopeUserIds);

  return buildScopedPnlHistoryPoints({
    liveMetricsByUserId,
    now,
    scopeUserIds,
    snapshots: snapshotRows,
  });
}

export async function snapshotAllUserPnlMetrics(
  snapshotAt: Date
): Promise<number> {
  const normalizedSnapshotAt = getHourBoundary(snapshotAt);
  const metricsByUserId = await loadCurrentUserPnlMetrics();
  const snapshotRows = Array.from(metricsByUserId.values()).map((metrics) => ({
    id: `${metrics.userId}:${normalizedSnapshotAt.toISOString()}:pnl`,
    userId: metrics.userId,
    snapshotAt: normalizedSnapshotAt,
    lifetimePnL: metrics.lifetimePnL,
    unrealizedPnL: metrics.unrealizedPnL,
    currentPnL: metrics.currentPnL,
  }));

  if (snapshotRows.length === 0) {
    return 0;
  }

  const inserted = await db
    .insert(userPnLSnapshots)
    .values(snapshotRows)
    .onConflictDoNothing({
      target: [userPnLSnapshots.userId, userPnLSnapshots.snapshotAt],
    })
    .returning({ id: userPnLSnapshots.id });

  return inserted.length;
}
