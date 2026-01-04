/**
 * Rate Limiter for Backend-Signed Profile Updates
 *
 * Prevents abuse of the backend signing feature by limiting
 * how often users can update their profiles.
 */

import { and, asc, db, eq, gte, profileUpdateLogs } from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'

interface RateLimitConfig {
  maxUpdatesPerDay: number
  maxUpdatesPerHour: number
  maxUsernameChangesPerDay: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxUpdatesPerDay: 50, // 50 profile updates per day
  maxUpdatesPerHour: 10, // 10 per hour
  maxUsernameChangesPerDay: 2, // Only 2 username changes per day
}

interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfter?: number // Seconds until retry allowed
}

/**
 * Check if user is allowed to update their profile
 */
export async function checkProfileUpdateRateLimit(
  userId: string,
  isUsernameChange: boolean,
): Promise<RateLimitResult> {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  // Count recent updates using repository count method
  const [recentUpdates24h, recentUpdates1h] = await Promise.all([
    // Updates in last 24 hours
    db.profileUpdateLog.count({
      where: {
        AND: [{ userId }, { createdAt: { gte: oneDayAgo } }],
      },
    }),
    // Updates in last hour
    db.profileUpdateLog.count({
      where: {
        AND: [{ userId }, { createdAt: { gte: oneHourAgo } }],
      },
    }),
  ])

  // Username changes in last 24 hours
  let recentUsernameChanges = 0
  if (isUsernameChange) {
    // Query all username updates in last 24h and filter in JS since SQLit doesn't support array contains
    const allRecentUpdates = await db
      .select({
        changedFields: profileUpdateLogs.changedFields,
      })
      .from(profileUpdateLogs)
      .where(
        and(
          eq(profileUpdateLogs.userId, userId),
          gte(profileUpdateLogs.createdAt, oneDayAgo),
        ),
      )
    // Filter for username changes
    // changedFields is stored as JsonValue (array) in database
    recentUsernameChanges = allRecentUpdates.filter((update) => {
      const fields = Array.isArray(update.changedFields)
        ? (update.changedFields as string[])
        : null
      return fields?.includes('username')
    }).length
  }

  // Check hourly limit
  if (recentUpdates1h >= DEFAULT_CONFIG.maxUpdatesPerHour) {
    const oldestRecentUpdateResult = await db
      .select({
        createdAt: profileUpdateLogs.createdAt,
      })
      .from(profileUpdateLogs)
      .where(
        and(
          eq(profileUpdateLogs.userId, userId),
          gte(profileUpdateLogs.createdAt, oneHourAgo),
        ),
      )
      .orderBy(asc(profileUpdateLogs.createdAt))
      .limit(1)

    const oldestRecentUpdate = oldestRecentUpdateResult[0] as
      | { createdAt: Date }
      | undefined

    const retryAfter = oldestRecentUpdate
      ? Math.ceil(
          (oldestRecentUpdate.createdAt.getTime() +
            60 * 60 * 1000 -
            now.getTime()) /
            1000,
        )
      : 3600

    logger.warn(
      'Profile update rate limit exceeded (hourly)',
      { userId, recentUpdates1h },
      'RateLimiter',
    )

    return {
      allowed: false,
      reason: `Too many profile updates. Please wait ${Math.ceil(retryAfter / 60)} minutes.`,
      retryAfter,
    }
  }

  // Check daily limit
  if (recentUpdates24h >= DEFAULT_CONFIG.maxUpdatesPerDay) {
    logger.warn(
      'Profile update rate limit exceeded (daily)',
      { userId, recentUpdates24h },
      'RateLimiter',
    )

    return {
      allowed: false,
      reason: 'Daily profile update limit reached. Try again tomorrow.',
      retryAfter: 86400,
    }
  }

  // Check username change limit
  if (
    isUsernameChange &&
    recentUsernameChanges >= DEFAULT_CONFIG.maxUsernameChangesPerDay
  ) {
    logger.warn(
      'Username change rate limit exceeded',
      { userId, recentUsernameChanges },
      'RateLimiter',
    )

    return {
      allowed: false,
      reason: 'You can only change your username twice per day.',
      retryAfter: 86400,
    }
  }

  return { allowed: true }
}

/**
 * Log a profile update for rate limiting and auditing
 */
export async function logProfileUpdate(
  userId: string,
  changedFields: string[],
  backendSigned: boolean,
  txHash?: string,
): Promise<void> {
  await db.insert(profileUpdateLogs).values({
    id: await generateSnowflakeId(),
    userId,
    changedFields,
    backendSigned,
    txHash: txHash || null,
    createdAt: new Date(),
  })
}

/**
 * Get recent profile update history for a user (for audit/debugging)
 */
export async function getProfileUpdateHistory(
  userId: string,
  limit = 20,
): Promise<
  Array<{
    changedFields: string[]
    backendSigned: boolean
    txHash: string | null
    createdAt: Date
  }>
> {
  return db.profileUpdateLog.findMany({
    where: { userId },
    select: {
      changedFields: true,
      backendSigned: true,
      txHash: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
