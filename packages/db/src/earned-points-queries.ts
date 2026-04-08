/**
 * Earned points / reputation updates for `EarnedPointsService`.
 *
 * **Why here:** Keeps `users` + `pointsTransactions` SQL under `asSystem` or
 * accepts a transaction client for call-site composition.
 */

import { generateSnowflakeId, logger } from '@babylon/shared';
import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { asSystem, type Transaction } from './db';
import { pointsTransactions } from './tables/points-transactions';
import { users } from './tables/user';

type DbLike = DrizzleClient | Transaction;

export type EarnedPointsUserAwardRow = {
  earnedPoints: number;
  invitePoints: number;
  bonusPoints: number;
  reputationPoints: number;
  lifetimePnL: unknown;
};

export type EarnedPointsUserBonusRow = {
  earnedPoints: number;
  invitePoints: number;
  bonusPoints: number;
  reputationPoints: number;
};

export async function syncEarnedPointsFromPnl(
  userId: string,
  deps: {
    pnlToPoints: (pnl: number) => number;
    calculateReputationPoints: (
      invitePoints: number,
      earnedPoints: number,
      bonusPoints: number
    ) => number;
  }
): Promise<void> {
  await asSystem(async (c) => {
    const result = await c
      .select({
        lifetimePnL: users.lifetimePnL,
        earnedPoints: users.earnedPoints,
        invitePoints: users.invitePoints,
        bonusPoints: users.bonusPoints,
        reputationPoints: users.reputationPoints,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = result[0];

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const lifetimePnL = Number(user.lifetimePnL);
    const newEarnedPoints = deps.pnlToPoints(lifetimePnL);

    if (newEarnedPoints === user.earnedPoints) {
      return;
    }

    const newReputationPoints = deps.calculateReputationPoints(
      user.invitePoints,
      newEarnedPoints,
      user.bonusPoints
    );

    await c
      .update(users)
      .set({
        earnedPoints: newEarnedPoints,
        reputationPoints: newReputationPoints,
      })
      .where(eq(users.id, userId));

    logger.info(
      'Updated earned points from P&L',
      {
        userId,
        lifetimePnL,
        earnedPoints: newEarnedPoints,
        totalPoints: newReputationPoints,
      },
      'EarnedPointsService'
    );
  }, 'earned-points-sync-from-pnl');
}

export async function listNonActorUserIds(): Promise<{ id: string }[]> {
  return asSystem(
    async (c) =>
      c.select({ id: users.id }).from(users).where(eq(users.isActor, false)),
    'earned-points-bulk-list-users'
  );
}

export async function awardEarnedPointsForPnLWithClient(
  database: DbLike,
  userId: string,
  newLifetimePnL: number,
  tradeType: string,
  relatedId: string | undefined,
  deps: {
    pnlToPoints: (pnl: number) => number;
    calculateReputationPoints: (
      invitePoints: number,
      earnedPoints: number,
      bonusPoints: number
    ) => number;
  }
): Promise<number> {
  const computedEarnedPoints = deps.pnlToPoints(newLifetimePnL);

  const result = await database
    .select({
      earnedPoints: users.earnedPoints,
      invitePoints: users.invitePoints,
      bonusPoints: users.bonusPoints,
      reputationPoints: users.reputationPoints,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = result[0];

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const currentEarnedPoints = user.earnedPoints;
  const storedLifetimePnL = Number(user.lifetimePnL);

  const earnedPointsDelta = computedEarnedPoints - currentEarnedPoints;

  const expectedPointsFromPreviousPnL = deps.pnlToPoints(
    storedLifetimePnL - (newLifetimePnL - storedLifetimePnL)
  );
  if (
    expectedPointsFromPreviousPnL !== currentEarnedPoints &&
    storedLifetimePnL !== newLifetimePnL
  ) {
    logger.warn(
      'Earned points may have been out of sync (auto-correcting)',
      {
        userId,
        storedLifetimePnL,
        newLifetimePnL,
        currentEarnedPoints,
        computedNewPoints: computedEarnedPoints,
      },
      'EarnedPointsService'
    );
  }

  if (earnedPointsDelta === 0) {
    return 0;
  }

  const newEarnedPoints = computedEarnedPoints;
  const newReputationPoints = deps.calculateReputationPoints(
    user.invitePoints,
    newEarnedPoints,
    user.bonusPoints
  );

  await database
    .update(users)
    .set({
      earnedPoints: newEarnedPoints,
      reputationPoints: newReputationPoints,
    })
    .where(eq(users.id, userId));

  await database.insert(pointsTransactions).values({
    id: await generateSnowflakeId(),
    userId,
    amount: earnedPointsDelta,
    pointsBefore: user.reputationPoints,
    pointsAfter: newReputationPoints,
    reason: 'trading_pnl',
    metadata: JSON.stringify({
      tradeType,
      relatedId,
      storedLifetimePnL,
      newLifetimePnL,
      previousEarnedPoints: currentEarnedPoints,
      newEarnedPoints,
      earnedPointsDelta,
    }),
  });

  logger.info(
    'Awarded earned points for P&L',
    {
      userId,
      storedLifetimePnL,
      newLifetimePnL,
      earnedPointsDelta,
      totalEarnedPoints: newEarnedPoints,
      totalReputationPoints: newReputationPoints,
    },
    'EarnedPointsService'
  );

  return earnedPointsDelta;
}

export async function awardBonusPointsWithClient(
  client: DbLike,
  userId: string,
  points: number,
  reason: string,
  deps: {
    calculateReputationPoints: (
      invitePoints: number,
      earnedPoints: number,
      bonusPoints: number
    ) => number;
  }
): Promise<number> {
  const result = await client
    .select({
      earnedPoints: users.earnedPoints,
      invitePoints: users.invitePoints,
      bonusPoints: users.bonusPoints,
      reputationPoints: users.reputationPoints,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = result[0];

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const newBonusPoints = user.bonusPoints + points;

  const newReputationPoints = deps.calculateReputationPoints(
    user.invitePoints,
    user.earnedPoints,
    newBonusPoints
  );

  await client
    .update(users)
    .set({
      bonusPoints: newBonusPoints,
      reputationPoints: newReputationPoints,
    })
    .where(eq(users.id, userId));

  await client.insert(pointsTransactions).values({
    id: await generateSnowflakeId(),
    userId,
    amount: points,
    pointsBefore: user.reputationPoints,
    pointsAfter: newReputationPoints,
    reason,
    metadata: JSON.stringify({
      pointsAwarded: points,
      previousBonusPoints: user.bonusPoints,
      newBonusPoints,
    }),
  });

  logger.info(
    'Awarded bonus points',
    {
      userId,
      points,
      reason,
      totalBonusPoints: newBonusPoints,
      totalReputationPoints: newReputationPoints,
    },
    'EarnedPointsService'
  );

  return newBonusPoints;
}

/** Runs {@link awardEarnedPointsForPnLWithClient} under `asSystem` (no outer transaction). */
export async function awardEarnedPointsForPnLAsSystem(
  userId: string,
  newLifetimePnL: number,
  tradeType: string,
  relatedId: string | undefined,
  deps: {
    pnlToPoints: (pnl: number) => number;
    calculateReputationPoints: (
      invitePoints: number,
      earnedPoints: number,
      bonusPoints: number
    ) => number;
  }
): Promise<number> {
  return asSystem(
    (c) =>
      awardEarnedPointsForPnLWithClient(
        c,
        userId,
        newLifetimePnL,
        tradeType,
        relatedId,
        deps
      ),
    'earned-points-award-pnl'
  );
}

/** Runs {@link awardBonusPointsWithClient} under `asSystem` (no outer transaction). */
export async function awardBonusPointsAsSystem(
  userId: string,
  points: number,
  reason: string,
  deps: {
    calculateReputationPoints: (
      invitePoints: number,
      earnedPoints: number,
      bonusPoints: number
    ) => number;
  }
): Promise<number> {
  return asSystem(
    (c) => awardBonusPointsWithClient(c, userId, points, reason, deps),
    'earned-points-bonus'
  );
}
