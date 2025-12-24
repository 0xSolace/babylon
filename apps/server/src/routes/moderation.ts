import {
  and,
  db,
  desc,
  eq,
  reports,
  userBlocks,
  userMutes,
  users,
} from '@babylon/db'
import { generateSnowflakeId, logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

/**
 * Moderation routes
 * Migrated from: apps/web/app/api/moderation/*
 */
const createModerationRoutes = () =>
  new Elysia({ prefix: '/api/moderation' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // Get user's submitted reports
    // Migrated from: apps/web/app/api/moderation/reports/route.ts (GET)
    .get(
      '/reports',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { query, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)
        const offset = Number.parseInt(query.offset || '0', 10)
        const status = query.status
        const category = query.category

        // Build where clause
        const conditions = [eq(reports.reporterId, user.userId)]
        if (status) conditions.push(eq(reports.status, status))
        if (category) conditions.push(eq(reports.category, category))

        const userReports = await db
          .select()
          .from(reports)
          .where(and(...conditions))
          .orderBy(desc(reports.createdAt))
          .limit(limit)
          .offset(offset)

        // Get total count for pagination
        const allUserReports = await db
          .select({ id: reports.id })
          .from(reports)
          .where(eq(reports.reporterId, user.userId))

        logger.info(
          'User reports fetched',
          { userId: user.userId, count: userReports.length },
          'GET /api/moderation/reports',
        )

        return {
          success: true,
          reports: userReports,
          pagination: {
            limit,
            offset,
            total: allUserReports.length,
          },
        }
      },
      {
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
          status: t.Optional(t.String()),
          category: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Moderation'],
          summary: 'Get user reports',
          description: 'Returns reports created by the current user',
        },
      },
    )

    // Create report
    // Migrated from: apps/web/app/api/moderation/reports/route.ts (POST)
    .post(
      '/reports',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const {
          reportType,
          reportedUserId,
          reportedPostId,
          category,
          reason,
          evidence,
        } = body

        // Validate can't report self
        if (reportedUserId && reportedUserId === user.userId) {
          set.status = 400
          return { error: 'Cannot report yourself' }
        }

        // Check if reported user exists
        if (reportedUserId) {
          const [reportedUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, reportedUserId))
            .limit(1)

          if (!reportedUser) {
            set.status = 404
            return { error: 'Reported user not found' }
          }

          // Check for duplicate report within 24 hours
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const existingReports = await db
            .select({ id: reports.id })
            .from(reports)
            .where(
              and(
                eq(reports.reporterId, user.userId),
                eq(reports.reportedUserId, reportedUserId),
                eq(reports.category, category),
              ),
            )

          const recentReport = existingReports.find(
            (r) => new Date(r.id) > oneDayAgo,
          )
          if (recentReport) {
            set.status = 400
            return {
              error:
                'You have already reported this user for this reason recently',
            }
          }
        }

        // Determine priority based on category
        let priority = 'normal'
        if (['hate_speech', 'violence', 'self_harm'].includes(category)) {
          priority = 'high'
        } else if (category === 'spam') {
          priority = 'low'
        }

        const reportId = await generateSnowflakeId()
        const [report] = await db
          .insert(reports)
          .values({
            id: reportId,
            reporterId: user.userId,
            reportedUserId: reportedUserId ?? null,
            reportedPostId: reportedPostId ?? null,
            reportType,
            category,
            reason: reason ?? 'No reason provided',
            evidence: evidence ?? null,
            priority,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()

        logger.info(
          'Report created',
          {
            reportId: report?.id,
            reporterId: user.userId,
            reportType,
            category,
            priority,
          },
          'POST /api/moderation/reports',
        )

        return {
          success: true,
          message: 'Report submitted successfully',
          report,
        }
      },
      {
        body: t.Object({
          reportType: t.String(),
          reportedUserId: t.Optional(t.String()),
          reportedPostId: t.Optional(t.String()),
          category: t.String(),
          reason: t.Optional(t.String()),
          evidence: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Moderation'],
          summary: 'Create report',
          description: 'Creates a new moderation report',
        },
      },
    )

    // Get blocked users
    // Migrated from: apps/web/app/api/moderation/blocks/route.ts (GET)
    .get(
      '/blocks',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const blocksResult = await db
          .select({
            id: userBlocks.id,
            blockedId: userBlocks.blockedId,
            createdAt: userBlocks.createdAt,
          })
          .from(userBlocks)
          .where(eq(userBlocks.blockerId, user.userId))
          .orderBy(desc(userBlocks.createdAt))

        return {
          success: true,
          blocks: blocksResult,
          count: blocksResult.length,
        }
      },
      {
        detail: {
          tags: ['Moderation'],
          summary: 'Get blocked users',
          description: 'Returns list of users blocked by current user',
        },
      },
    )

    // Block user
    // Migrated from: apps/web/app/api/moderation/blocks/route.ts (POST)
    .post(
      '/blocks',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { userId: targetUserId } = body

        if (targetUserId === user.userId) {
          set.status = 400
          return { error: 'Cannot block yourself' }
        }

        // Check if user exists
        const [targetUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, targetUserId))
          .limit(1)

        if (!targetUser) {
          set.status = 404
          return { error: 'User not found' }
        }

        // Check if already blocked
        const [existingBlock] = await db
          .select()
          .from(userBlocks)
          .where(
            and(
              eq(userBlocks.blockerId, user.userId),
              eq(userBlocks.blockedId, targetUserId),
            ),
          )
          .limit(1)

        if (existingBlock) {
          return { success: true, message: 'User is already blocked' }
        }

        const blockId = await generateSnowflakeId()
        await db.insert(userBlocks).values({
          id: blockId,
          blockerId: user.userId,
          blockedId: targetUserId,
          createdAt: new Date(),
        })

        logger.info(
          'User blocked',
          { blockerId: user.userId, blockedId: targetUserId },
          'POST /api/moderation/blocks',
        )

        return { success: true }
      },
      {
        body: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Moderation'],
          summary: 'Block user',
          description: 'Blocks a user',
        },
      },
    )

    // Unblock user
    // Migrated from: apps/web/app/api/moderation/blocks/route.ts (DELETE)
    .delete(
      '/blocks/:userId',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        await db
          .delete(userBlocks)
          .where(
            and(
              eq(userBlocks.blockerId, user.userId),
              eq(userBlocks.blockedId, params.userId),
            ),
          )

        logger.info(
          'User unblocked',
          { blockerId: user.userId, unblockedUserId: params.userId },
          'DELETE /api/moderation/blocks/:userId',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Moderation'],
          summary: 'Unblock user',
          description: 'Unblocks a user',
        },
      },
    )

    // Get muted users
    // Migrated from: apps/web/app/api/moderation/mutes/route.ts (GET)
    .get(
      '/mutes',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const mutesResult = await db
          .select({
            id: userMutes.id,
            mutedId: userMutes.mutedId,
            reason: userMutes.reason,
            createdAt: userMutes.createdAt,
          })
          .from(userMutes)
          .where(eq(userMutes.muterId, user.userId))
          .orderBy(desc(userMutes.createdAt))

        return {
          success: true,
          mutes: mutesResult,
          count: mutesResult.length,
        }
      },
      {
        detail: {
          tags: ['Moderation'],
          summary: 'Get muted users',
          description: 'Returns list of users muted by current user',
        },
      },
    )

    // Mute user
    // Migrated from: apps/web/app/api/moderation/mutes/route.ts (POST)
    .post(
      '/mutes',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { userId: targetUserId, duration } = body

        if (targetUserId === user.userId) {
          set.status = 400
          return { error: 'Cannot mute yourself' }
        }

        // Check if user exists
        const [targetUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, targetUserId))
          .limit(1)

        if (!targetUser) {
          set.status = 404
          return { error: 'User not found' }
        }

        // Check if already muted
        const [existingMute] = await db
          .select()
          .from(userMutes)
          .where(
            and(
              eq(userMutes.muterId, user.userId),
              eq(userMutes.mutedId, targetUserId),
            ),
          )
          .limit(1)

        if (existingMute) {
          return { success: true, message: 'User is already muted' }
        }

        const muteId = await generateSnowflakeId()

        await db.insert(userMutes).values({
          id: muteId,
          muterId: user.userId,
          mutedId: targetUserId,
          reason: duration ? `Muted for ${duration} seconds` : null,
          createdAt: new Date(),
        })

        logger.info(
          'User muted',
          { muterId: user.userId, mutedId: targetUserId, duration },
          'POST /api/moderation/mutes',
        )

        return { success: true }
      },
      {
        body: t.Object({
          userId: t.String(),
          duration: t.Optional(t.Number()),
        }),
        detail: {
          tags: ['Moderation'],
          summary: 'Mute user',
          description: 'Mutes a user, optionally for a specified duration',
        },
      },
    )

    // Unmute user
    // Migrated from: apps/web/app/api/moderation/mutes/route.ts (DELETE)
    .delete(
      '/mutes/:userId',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        await db
          .delete(userMutes)
          .where(
            and(
              eq(userMutes.muterId, user.userId),
              eq(userMutes.mutedId, params.userId),
            ),
          )

        logger.info(
          'User unmuted',
          { muterId: user.userId, unmutedUserId: params.userId },
          'DELETE /api/moderation/mutes/:userId',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Moderation'],
          summary: 'Unmute user',
          description: 'Unmutes a user',
        },
      },
    )

    // Submit appeal
    // Migrated from: apps/web/app/api/moderation/appeal/route.ts
    .post(
      '/appeal',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // TODO: Implement appeal logic with staking requirement
        logger.info(
          'Appeal submitted',
          { userId: user.userId },
          'POST /api/moderation/appeal',
        )

        return {
          success: true,
          message: 'Appeal submitted for review',
        }
      },
      {
        body: t.Object({
          reason: t.String(),
          evidence: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Moderation'],
          summary: 'Submit appeal',
          description: 'Submits an appeal for a moderation action',
        },
      },
    )

export const moderationRoutes = createModerationRoutes()
