/**
 * Rate Limiter for Backend-Signed Profile Updates
 *
 * Prevents abuse of the backend signing feature by limiting
 * how often users can update their profiles.
 */

import { db } from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';

interface RateLimitConfig {
  maxUpdatesPerDay: number;
  maxUpdatesPerHour: number;
  maxUsernameChangesPerDay: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxUpdatesPerDay: 50, // 50 profile updates per day
  maxUpdatesPerHour: 10, // 10 per hour
  maxUsernameChangesPerDay: 2, // Only 2 username changes per day
};

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // Seconds until retry allowed
}

/**
 * Helper to convert a potentially string date to Date and get timestamp
 */
function getTimestamp(date: Date | string): number {
  return date instanceof Date
    ? date.getTime()
    : new Date(String(date)).getTime();
}

/**
 * Check if user is allowed to update their profile
 */
export async function checkProfileUpdateRateLimit(
  userId: string,
  isUsernameChange: boolean
): Promise<RateLimitResult> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Count recent updates using CQL repository methods
  const [recentUpdates24h, recentUpdates1h] = await Promise.all([
    // Updates in last 24 hours
    db.profileUpdateLog.count({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
      },
    }),
    // Updates in last hour
    db.profileUpdateLog.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
      },
    }),
  ]);

  // Username changes in last 24 hours - need to check array field
  let recentUsernameChanges = 0;
  if (isUsernameChange) {
    // Get all recent updates and filter for username changes
    const recentLogs = await db.profileUpdateLog.findMany({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
      },
    });
    recentUsernameChanges = recentLogs.filter((log) => {
      const fields = log.changedFields;
      return Array.isArray(fields) && fields.includes('username');
    }).length;
  }

  // Check hourly limit
  if (recentUpdates1h >= DEFAULT_CONFIG.maxUpdatesPerHour) {
    const oldestRecentUpdate = await db.profileUpdateLog.findFirst({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: 'asc' },
    });

    const retryAfter = oldestRecentUpdate
      ? Math.ceil(
          (getTimestamp(oldestRecentUpdate.createdAt) +
            60 * 60 * 1000 -
            now.getTime()) /
            1000
        )
      : 3600;

    logger.warn(
      'Profile update rate limit exceeded (hourly)',
      { userId, recentUpdates1h },
      'RateLimiter'
    );

    return {
      allowed: false,
      reason: `Too many profile updates. Please wait ${Math.ceil(retryAfter / 60)} minutes.`,
      retryAfter,
    };
  }

  // Check daily limit
  if (recentUpdates24h >= DEFAULT_CONFIG.maxUpdatesPerDay) {
    logger.warn(
      'Profile update rate limit exceeded (daily)',
      { userId, recentUpdates24h },
      'RateLimiter'
    );

    return {
      allowed: false,
      reason: 'Daily profile update limit reached. Try again tomorrow.',
      retryAfter: 86400,
    };
  }

  // Check username change limit
  if (
    isUsernameChange &&
    recentUsernameChanges >= DEFAULT_CONFIG.maxUsernameChangesPerDay
  ) {
    logger.warn(
      'Username change rate limit exceeded',
      { userId, recentUsernameChanges },
      'RateLimiter'
    );

    return {
      allowed: false,
      reason: 'You can only change your username twice per day.',
      retryAfter: 86400,
    };
  }

  return { allowed: true };
}

/**
 * Log a profile update for rate limiting and auditing
 */
export async function logProfileUpdate(
  userId: string,
  changedFields: string[],
  backendSigned: boolean,
  txHash?: string
): Promise<void> {
  await db.profileUpdateLog.create({
    data: {
      id: await generateSnowflakeId(),
      userId,
      changedFields,
      backendSigned,
      txHash: txHash ?? null,
      createdAt: new Date(),
    },
  });
}

/**
 * Get recent profile update history for a user (for audit/debugging)
 */
export async function getProfileUpdateHistory(
  userId: string,
  limit = 20
): Promise<
  Array<{
    changedFields: string[];
    backendSigned: boolean;
    txHash: string | null;
    createdAt: Date;
  }>
> {
  const results = await db.profileUpdateLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return results.map((r) => ({
    changedFields: r.changedFields,
    backendSigned: r.backendSigned,
    txHash: r.txHash,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt)),
  }));
}
