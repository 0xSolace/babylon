/**
 * Points Distribution Service
 *
 * @description Distributes forfeited account points to successful reporters when
 * content violations (CSAM/scammer) are confirmed. Handles point allocation based
 * on report evaluation outcomes and ensures fair distribution among valid reporters.
 */

import {
  insertPointsForfeitTransaction,
  loadPointsDistributionContext,
  selectUserForPointsForfeit,
  selectUserForShouldDistributePoints,
  updateUserAfterPointsForfeit,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { generateSnowflakeId, logger } from '@babylon/shared';

/**
 * PointsService interface for dependency injection
 *
 * @description Service interface injected from the web application layer
 * to avoid circular dependencies between packages.
 */
type PointsService = {
  awardPoints: (
    userId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, unknown>
  ) => Promise<{
    success: boolean;
    pointsAwarded: number;
    newTotal: number;
  }>;
};

// Service instance injected from the web application layer
let pointsServiceInstance: PointsService | null = null;

export function setPointsService(service: PointsService): void {
  pointsServiceInstance = service;
}

function getPointsService(): PointsService {
  if (!pointsServiceInstance) {
    throw new Error(
      'PointsService not initialized. Call setPointsService() first.'
    );
  }
  return pointsServiceInstance;
}

/**
 * Distribute forfeited points to successful reporters
 *
 * When a user is confirmed as CSAM/scammer, distribute their points
 * proportionally to all users who successfully reported them.
 */
export async function distributePointsToReporters(
  reportedUserId: string,
  reason: 'scammer' | 'csam'
): Promise<void> {
  logger.info(
    'Distributing points to successful reporters',
    {
      reportedUserId,
      reason,
    },
    'PointsDistribution'
  );

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const reportCategory = reason === 'scammer' ? 'spam' : 'inappropriate';

  const load = await asSystem(
    (c) =>
      loadPointsDistributionContext(c, {
        reportedUserId,
        ninetyDaysAgo,
        reportCategory,
      }),
    'points-distribution-load'
  );

  if (load.kind === 'missing_user') {
    logger.warn(
      'Reported user not found',
      { reportedUserId },
      'PointsDistribution'
    );
    return;
  }

  if (load.kind === 'no_forfeit') {
    logger.info(
      'No points to distribute',
      { reportedUserId, forfeitedPoints: load.forfeitedPoints },
      'PointsDistribution'
    );
    return;
  }

  const { forfeitedPoints, successfulReports } = load;

  if (successfulReports.length === 0) {
    logger.info(
      'No successful reports found',
      { reportedUserId },
      'PointsDistribution'
    );
    // Still forfeit the points (remove them from the user)
    await forfeitUserPoints(reportedUserId, forfeitedPoints);
    return;
  }

  // Distribute points proportionally
  // Each reporter gets an equal share
  const pointsPerReporter = Math.floor(
    forfeitedPoints / successfulReports.length
  );
  const remainder = forfeitedPoints % successfulReports.length;

  logger.info(
    'Distributing points',
    {
      reportedUserId,
      forfeitedPoints,
      successfulReportsCount: successfulReports.length,
      pointsPerReporter,
      remainder,
    },
    'PointsDistribution'
  );

  const pointsService = getPointsService();

  // Distribute points to each reporter
  const distributionResults = await Promise.allSettled(
    successfulReports.map(async (report, index) => {
      // First reporter gets the remainder if any
      const pointsToAward = pointsPerReporter + (index === 0 ? remainder : 0);

      if (pointsToAward <= 0) {
        return;
      }

      await pointsService.awardPoints(
        report.reporterId,
        pointsToAward,
        'report_reward',
        {
          reportedUserId,
          reportId: report.id,
          reason,
          forfeitedPoints: pointsToAward,
        }
      );

      logger.info(
        'Awarded points to reporter',
        {
          reporterId: report.reporterId,
          points: pointsToAward,
          reportId: report.id,
        },
        'PointsDistribution'
      );
    })
  );

  // Log any failures
  const failures = distributionResults.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    logger.error(
      'Failed to distribute points to some reporters',
      {
        reportedUserId,
        failures: failures.length,
        total: distributionResults.length,
      },
      'PointsDistribution'
    );
  }

  // Forfeit the points from the reported user
  await forfeitUserPoints(reportedUserId, forfeitedPoints);

  logger.info(
    '✅ Points distribution complete',
    {
      reportedUserId,
      forfeitedPoints,
      reportersRewarded: successfulReports.length,
      totalDistributed: forfeitedPoints,
    },
    'PointsDistribution'
  );
}

/**
 * Forfeit points from a user (remove bonus/invite points)
 */
async function forfeitUserPoints(
  userId: string,
  amount: number
): Promise<void> {
  await asSystem(async (c) => {
    const user = await selectUserForPointsForfeit(c, userId);

    if (!user) {
      return;
    }

    const totalForfeitable = user.invitePoints + user.bonusPoints;
    if (totalForfeitable === 0) {
      return;
    }

    const inviteRatio =
      totalForfeitable > 0 ? user.invitePoints / totalForfeitable : 0;
    const bonusRatio =
      totalForfeitable > 0 ? user.bonusPoints / totalForfeitable : 0;

    const inviteToRemove = Math.floor(amount * inviteRatio);
    const bonusToRemove = Math.floor(amount * bonusRatio);

    await updateUserAfterPointsForfeit(c, userId, {
      invitePoints: Math.max(0, user.invitePoints - inviteToRemove),
      bonusPoints: Math.max(0, user.bonusPoints - bonusToRemove),
      reputationPoints: Math.max(0, user.reputationPoints - amount),
    });

    await insertPointsForfeitTransaction(c, {
      id: await generateSnowflakeId(),
      userId,
      amount: -amount,
      pointsBefore: user.reputationPoints,
      pointsAfter: user.reputationPoints - amount,
      metadataJson: JSON.stringify({
        reason: 'csam_or_scammer_confirmed',
        forfeitedAmount: amount,
      }),
    });

    logger.info(
      'Forfeited points from user',
      {
        userId,
        amount,
        inviteRemoved: inviteToRemove,
        bonusRemoved: bonusToRemove,
      },
      'PointsDistribution'
    );
  }, 'points-distribution-forfeit');
}

/**
 * Check if a user should have points distributed (CSAM/scammer confirmed)
 */
export async function shouldDistributePoints(userId: string): Promise<boolean> {
  const user = await asSystem(
    (c) => selectUserForShouldDistributePoints(c, userId),
    'points-distribution-should'
  );

  if (!user) {
    return false;
  }

  // Only distribute if user is banned AND marked as scammer or CSAM
  return user.isBanned && (user.isScammer || user.isCSAM);
}
