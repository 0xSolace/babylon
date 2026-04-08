/**
 * Queries for moderation `points-distribution` (forfeiture + reporter rewards).
 */

import { and, asc, eq, gte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { pointsTransactions } from './tables/points-transactions';
import { reports } from './tables/reports';
import { users } from './tables/user';

type PdDb = DrizzleClient | Transaction;

export type PointsDistributionSuccessfulReportRow = {
  id: string;
  reporterId: string;
  createdAt: Date;
};

export type PointsDistributionLoad =
  | { kind: 'missing_user' }
  | { kind: 'no_forfeit'; forfeitedPoints: number }
  | {
      kind: 'ready';
      forfeitedPoints: number;
      successfulReports: PointsDistributionSuccessfulReportRow[];
    };

export async function loadPointsDistributionContext(
  c: PdDb,
  params: {
    reportedUserId: string;
    ninetyDaysAgo: Date;
    reportCategory: 'spam' | 'inappropriate';
  }
): Promise<PointsDistributionLoad> {
  const [reportedUser] = await c
    .select({
      id: users.id,
      invitePoints: users.invitePoints,
      bonusPoints: users.bonusPoints,
    })
    .from(users)
    .where(eq(users.id, params.reportedUserId))
    .limit(1);

  if (!reportedUser) {
    return { kind: 'missing_user' };
  }

  const forfeitedPoints = reportedUser.invitePoints + reportedUser.bonusPoints;

  if (forfeitedPoints <= 0) {
    return {
      kind: 'no_forfeit',
      forfeitedPoints,
    };
  }

  const successfulReports = await c
    .select({
      id: reports.id,
      reporterId: reports.reporterId,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(
      and(
        eq(reports.reportedUserId, params.reportedUserId),
        eq(reports.status, 'resolved'),
        eq(reports.category, params.reportCategory),
        gte(reports.createdAt, params.ninetyDaysAgo)
      )
    )
    .orderBy(asc(reports.createdAt));

  return {
    kind: 'ready',
    forfeitedPoints,
    successfulReports,
  };
}

export type PointsForfeitUserSlice = {
  reputationPoints: number;
  invitePoints: number;
  bonusPoints: number;
};

export async function selectUserForPointsForfeit(
  c: PdDb,
  userId: string
): Promise<PointsForfeitUserSlice | undefined> {
  const [user] = await c
    .select({
      reputationPoints: users.reputationPoints,
      invitePoints: users.invitePoints,
      bonusPoints: users.bonusPoints,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user;
}

export async function updateUserAfterPointsForfeit(
  c: PdDb,
  userId: string,
  patch: {
    invitePoints: number;
    bonusPoints: number;
    reputationPoints: number;
  }
): Promise<void> {
  await c
    .update(users)
    .set({
      invitePoints: patch.invitePoints,
      bonusPoints: patch.bonusPoints,
      reputationPoints: patch.reputationPoints,
    })
    .where(eq(users.id, userId));
}

export async function insertPointsForfeitTransaction(
  c: PdDb,
  row: {
    id: string;
    userId: string;
    amount: number;
    pointsBefore: number;
    pointsAfter: number;
    metadataJson: string;
  }
): Promise<void> {
  await c.insert(pointsTransactions).values({
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    pointsBefore: row.pointsBefore,
    pointsAfter: row.pointsAfter,
    reason: 'forfeited',
    metadata: row.metadataJson,
  });
}

export type ShouldDistributePointsUserRow = {
  isBanned: boolean;
  isScammer: boolean;
  isCSAM: boolean;
  invitePoints: number;
  bonusPoints: number;
};

export async function selectUserForShouldDistributePoints(
  c: PdDb,
  userId: string
): Promise<ShouldDistributePointsUserRow | undefined> {
  const [user] = await c
    .select({
      isBanned: users.isBanned,
      isScammer: users.isScammer,
      isCSAM: users.isCSAM,
      invitePoints: users.invitePoints,
      bonusPoints: users.bonusPoints,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user;
}
