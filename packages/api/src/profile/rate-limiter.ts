/**
 * Rate Limiter for Backend-Signed Profile Updates
 *
 * Prevents abuse of the backend signing feature by limiting
 * how often users can update their profiles.
 */

import {
  countProfileUpdatesForUserSince,
  countProfileUsernameChangesForUserSince,
  insertProfileUpdateLogRow,
  selectOldestProfileUpdateForUserSince,
  selectProfileUpdateHistoryForUser,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
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
 * Check if user is allowed to update their profile
 */
export async function checkProfileUpdateRateLimit(
  userId: string,
  isUsernameChange: boolean
): Promise<RateLimitResult> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return asSystem(async (c) => {
    const [recentUpdates24h, recentUpdates1h] = await Promise.all([
      countProfileUpdatesForUserSince(c, userId, oneDayAgo),
      countProfileUpdatesForUserSince(c, userId, oneHourAgo),
    ]);

    let recentUsernameChanges = 0;
    if (isUsernameChange) {
      recentUsernameChanges = await countProfileUsernameChangesForUserSince(
        c,
        userId,
        oneDayAgo
      );
    }

    if (recentUpdates1h >= DEFAULT_CONFIG.maxUpdatesPerHour) {
      const oldestRecentUpdate = await selectOldestProfileUpdateForUserSince(
        c,
        userId,
        oneHourAgo
      );

      const retryAfter = oldestRecentUpdate
        ? Math.ceil(
            (oldestRecentUpdate.createdAt.getTime() +
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
  }, 'profile-rate-limit-check');
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
  await asSystem(
    async (c) =>
      insertProfileUpdateLogRow(c, {
        id: await generateSnowflakeId(),
        userId,
        changedFields,
        backendSigned,
        txHash: txHash || null,
        createdAt: new Date(),
      }),
    'profile-update-log-insert'
  );
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
  return asSystem(
    async (c) => selectProfileUpdateHistoryForUser(c, userId, limit),
    'profile-update-history'
  );
}
