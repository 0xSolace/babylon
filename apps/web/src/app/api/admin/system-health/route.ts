/**
 * Admin System Health API
 *
 * @route GET /api/admin/system-health - Get system health metrics
 * @access Admin
 *
 * @description
 * Returns system health metrics including game engine status,
 * database connectivity, and error rates.
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api'
import { count, db, desc, games, gte, posts, users } from '@babylon/db'
import { logger } from '@babylon/shared'

export const GET = withErrorHandling(async (request: Request) => {
  await requireAdmin(request)

  logger.info(
    'System health check requested',
    {},
    'GET /api/admin/system-health',
  )

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Get game state
  const [currentGame] = await db
    .select()
    .from(games)
    .orderBy(desc(games.updatedAt))
    .limit(1)

  // Calculate time since last tick
  const lastTickAt = currentGame?.lastTickAt as Date | null | undefined
  const timeSinceLastTick = lastTickAt
    ? now.getTime() - new Date(lastTickAt).getTime()
    : null

  // Get user activity stats as proxy for API health
  interface CountResult {
    newUsers?: number
    newPosts?: number
  }
  const userStatsHourResult = (await db
    .select({
      newUsers: count(),
    })
    .from(users)
    .where(gte(users.createdAt, oneHourAgo))) as unknown as CountResult[]
  const userStatsHour = userStatsHourResult[0]

  const userStatsDayResult = (await db
    .select({
      newUsers: count(),
    })
    .from(users)
    .where(gte(users.createdAt, oneDayAgo))) as unknown as CountResult[]
  const userStatsDay = userStatsDayResult[0]

  // Get post activity stats
  const postStatsHourResult = (await db
    .select({
      newPosts: count(),
    })
    .from(posts)
    .where(gte(posts.createdAt, oneHourAgo))) as unknown as CountResult[]
  const postStatsHour = postStatsHourResult[0]

  const postStatsDayResult = (await db
    .select({
      newPosts: count(),
    })
    .from(posts)
    .where(gte(posts.createdAt, oneDayAgo))) as unknown as CountResult[]
  const postStatsDay = postStatsDayResult[0]

  // Determine overall health status
  let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'
  const issues: string[] = []

  // Check game tick freshness
  if (currentGame?.isRunning) {
    if (timeSinceLastTick && timeSinceLastTick > 10 * 60 * 1000) {
      healthStatus = 'critical'
      issues.push('Game tick stale (>10 minutes)')
    } else if (timeSinceLastTick && timeSinceLastTick > 5 * 60 * 1000) {
      healthStatus = healthStatus === 'healthy' ? 'degraded' : healthStatus
      issues.push('Game tick delayed (>5 minutes)')
    }
  }

  // Check for activity
  if (postStatsDay?.newPosts === 0 && userStatsDay?.newUsers === 0) {
    healthStatus = healthStatus === 'healthy' ? 'degraded' : healthStatus
    issues.push('No activity in last 24 hours')
  }

  return successResponse({
    status: healthStatus,
    issues,
    timestamp: now.toISOString(),
    gameEngine: {
      isRunning: currentGame?.isRunning ?? false,
      currentDay: currentGame?.currentDay ?? 0,
      lastTickAt: lastTickAt ? new Date(lastTickAt).toISOString() : null,
      timeSinceLastTickMs: timeSinceLastTick,
      tickIntervalMs: currentGame?.speed ?? 60000,
      uptimeMs: currentGame?.startedAt
        ? now.getTime() - new Date(currentGame.startedAt as Date).getTime()
        : 0,
    },
    // NOTE: LLM metrics not currently tracked - would require adding
    // instrumentation to LLM client. Omitted to avoid displaying
    // misleading zeros in the UI.
    activityMetrics: {
      lastHour: {
        newUsers: userStatsHour?.newUsers ?? 0,
        newPosts: postStatsHour?.newPosts ?? 0,
      },
      last24Hours: {
        newUsers: userStatsDay?.newUsers ?? 0,
        newPosts: postStatsDay?.newPosts ?? 0,
      },
    },
    recentErrors: [],
  })
})
