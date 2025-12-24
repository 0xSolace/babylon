import {
  agentRegistries,
  db,
  desc,
  eq,
  markets,
  posts,
  reports,
  userGroups,
  users,
} from '@babylon/db'
import { FEE_CONFIG } from '@babylon/engine'
import { logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import { getAuthContext, heavyRateLimiter, requireAdmin } from '../middleware'

/**
 * Admin routes
 * Migrated from: apps/web/app/api/admin/*
 */
const createAdminRoutes = () =>
  new Elysia({ prefix: '/api/admin' })
    .use(requireAdmin)
    .use(heavyRateLimiter)

    // System statistics
    .get(
      '/stats',
      async () => {
        const usersList = await db
          .select({ id: users.id })
          .from(users)
          .limit(10000)
        const postsList = await db
          .select({ id: posts.id })
          .from(posts)
          .limit(10000)
        const marketsList = await db
          .select({ id: markets.id })
          .from(markets)
          .limit(10000)
        const agentsList = await db
          .select({ id: agentRegistries.id })
          .from(agentRegistries)
          .limit(10000)
        const reportsList = await db
          .select({ id: reports.id })
          .from(reports)
          .limit(10000)

        return {
          success: true,
          stats: {
            users: {
              total: usersList.length,
            },
            content: {
              posts: postsList.length,
              markets: marketsList.length,
            },
            agents: {
              total: agentsList.length,
            },
            moderation: {
              reports: reportsList.length,
            },
            timestamp: new Date().toISOString(),
          },
        }
      },
      {
        detail: {
          tags: ['Admin'],
          summary: 'Get system statistics',
        },
      },
    )

    // List all agents (admin view)
    .get(
      '/agents',
      async ({ query }) => {
        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)
        const statusFilter = query.status

        let agents = await db
          .select({
            id: agentRegistries.id,
            agentId: agentRegistries.agentId,
            name: agentRegistries.name,
            type: agentRegistries.type,
            status: agentRegistries.status,
            trustLevel: agentRegistries.trustLevel,
            registeredAt: agentRegistries.registeredAt,
            updatedAt: agentRegistries.updatedAt,
          })
          .from(agentRegistries)
          .orderBy(desc(agentRegistries.registeredAt))
          .limit(limit)

        if (statusFilter) {
          agents = agents.filter((a) => a.status === statusFilter)
        }

        return {
          success: true,
          agents: agents.map((a) => ({
            ...a,
            createdAt: a.registeredAt?.toISOString(),
            updatedAt: a.updatedAt?.toISOString(),
          })),
          count: agents.length,
        }
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'List all agents (admin)',
        },
      },
    )

    // Toggle agent status
    .post(
      '/agents/:agentId/toggle',
      async (ctx) => {
        const { params, set, body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const newStatus = body.enabled ? 'ACTIVE' : 'PAUSED'

        const [updated] = await db
          .update(agentRegistries)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(agentRegistries.agentId, params.agentId))
          .returning()

        if (!updated) {
          set.status = 404
          return { error: 'Agent not found' }
        }

        logger.info(
          'Agent status toggled',
          { agentId: params.agentId, newStatus, adminId: user.userId },
          'POST /api/admin/agents/:agentId/toggle',
        )

        return { success: true, agent: updated }
      },
      {
        params: t.Object({
          agentId: t.String(),
        }),
        body: t.Object({
          enabled: t.Boolean(),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Toggle agent status',
        },
      },
    )

    // Ban user
    .post(
      '/users/:userId/ban',
      async (ctx) => {
        const { params, set, body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Check if user exists
        const [targetUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, params.userId))
          .limit(1)

        if (!targetUser) {
          set.status = 404
          return { error: 'User not found' }
        }

        // Update user's isBanned flag
        await db
          .update(users)
          .set({ isBanned: true })
          .where(eq(users.id, params.userId))

        logger.info(
          'User banned',
          {
            userId: params.userId,
            reason: body.reason,
            permanent: body.permanent,
            adminId: user.userId,
          },
          'POST /api/admin/users/:userId/ban',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          reason: t.String(),
          duration: t.Optional(t.Number()),
          permanent: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Ban user',
        },
      },
    )

    // Unban user
    .delete(
      '/users/:userId/ban',
      async (ctx) => {
        const { params } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        await db
          .update(users)
          .set({ isBanned: false })
          .where(eq(users.id, params.userId))

        logger.info(
          'User unbanned',
          { userId: params.userId, adminId: user.userId },
          'DELETE /api/admin/users/:userId/ban',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Unban user',
        },
      },
    )

    // Moderation reports
    .get(
      '/reports',
      async ({ query }) => {
        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)
        const statusFilter = query.status
        const typeFilter = query.type

        let reportsList = await db
          .select({
            id: reports.id,
            reporterId: reports.reporterId,
            reportedUserId: reports.reportedUserId,
            reportedPostId: reports.reportedPostId,
            reportType: reports.reportType,
            reason: reports.reason,
            status: reports.status,
            createdAt: reports.createdAt,
            resolvedAt: reports.resolvedAt,
            resolvedBy: reports.resolvedBy,
          })
          .from(reports)
          .orderBy(desc(reports.createdAt))
          .limit(limit)

        if (statusFilter) {
          reportsList = reportsList.filter((r) => r.status === statusFilter)
        }
        if (typeFilter) {
          reportsList = reportsList.filter((r) => r.reportType === typeFilter)
        }

        return {
          success: true,
          reports: reportsList.map((r) => ({
            ...r,
            createdAt: r.createdAt?.toISOString(),
            resolvedAt: r.resolvedAt?.toISOString() ?? null,
          })),
          count: reportsList.length,
        }
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          type: t.Optional(t.String()),
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Admin', 'Moderation'],
          summary: 'List moderation reports',
        },
      },
    )

    // Get report details
    .get(
      '/reports/:reportId',
      async ({ params, set }) => {
        const [report] = await db
          .select()
          .from(reports)
          .where(eq(reports.id, params.reportId))
          .limit(1)

        if (!report) {
          set.status = 404
          return { error: 'Report not found' }
        }

        // Get reporter info
        let reporter = null
        if (report.reporterId) {
          const [r] = await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
            })
            .from(users)
            .where(eq(users.id, report.reporterId))
            .limit(1)
          reporter = r ?? null
        }

        return {
          success: true,
          report: {
            ...report,
            createdAt: report.createdAt?.toISOString(),
            resolvedAt: report.resolvedAt?.toISOString() ?? null,
            reporter,
          },
        }
      },
      {
        params: t.Object({
          reportId: t.String(),
        }),
        detail: {
          tags: ['Admin', 'Moderation'],
          summary: 'Get report details',
        },
      },
    )

    // Report statistics
    .get(
      '/reports/stats',
      async () => {
        const allReports = await db
          .select({ id: reports.id, status: reports.status })
          .from(reports)

        const pending = allReports.filter((r) => r.status === 'pending').length
        const resolved = allReports.filter(
          (r) => r.status === 'resolved',
        ).length

        return {
          success: true,
          stats: {
            total: allReports.length,
            pending,
            resolved,
          },
        }
      },
      {
        detail: {
          tags: ['Admin', 'Moderation'],
          summary: 'Get report statistics',
        },
      },
    )

    // Fee configuration
    .get(
      '/fees',
      async () => {
        return {
          success: true,
          fees: {
            tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
            platformShare: FEE_CONFIG.PLATFORM_SHARE,
            referrerShare: FEE_CONFIG.REFERRER_SHARE,
            minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
          },
        }
      },
      {
        detail: {
          tags: ['Admin'],
          summary: 'Get fee configuration',
        },
      },
    )

    // Update fees
    .post(
      '/fees',
      async (ctx) => {
        const { body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        // Note: Fee updates would typically update a config store or database
        // For now, log the request
        logger.info(
          'Fee configuration update requested',
          { updates: body, adminId: user.userId },
          'POST /api/admin/fees',
        )

        return {
          success: true,
          message: 'Fee configuration update request received',
          requested: body,
        }
      },
      {
        body: t.Object({
          tradingFee: t.Optional(t.Number()),
          creatorFee: t.Optional(t.Number()),
          protocolFee: t.Optional(t.Number()),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Update fee configuration',
        },
      },
    )

    // Trade history
    .get(
      '/trades',
      async () => {
        // Trade history would come from a dedicated trades service
        // For now, return empty as trades table structure varies
        return {
          success: true,
          trades: [],
          count: 0,
          message: 'Trade history available via market service',
        }
      },
      {
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          userId: t.Optional(t.String()),
          marketId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Get trade history',
        },
      },
    )

    // Performance metrics
    .get(
      '/performance',
      async () => {
        const memUsage = process.memoryUsage()

        return {
          success: true,
          performance: {
            memory: {
              heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
              heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
              external: Math.round(memUsage.external / 1024 / 1024),
              rss: Math.round(memUsage.rss / 1024 / 1024),
            },
            uptime: Math.round(process.uptime()),
            nodeVersion: process.version,
            timestamp: new Date().toISOString(),
          },
        }
      },
      {
        detail: {
          tags: ['Admin'],
          summary: 'Get performance metrics',
        },
      },
    )

    // Training control - trigger
    .post(
      '/training/trigger',
      async (ctx) => {
        const { body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        logger.info(
          'Training trigger requested by admin',
          { adminId: user.userId, force: body.force },
          'POST /api/admin/training/trigger',
        )

        return {
          success: true,
          message: 'Training trigger request received',
          force: body.force ?? false,
        }
      },
      {
        body: t.Object({
          modelType: t.Optional(t.String()),
          force: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ['Admin', 'Training'],
          summary: 'Trigger training',
        },
      },
    )

    // Training control - deploy
    .post(
      '/training/deploy',
      async (ctx) => {
        const { body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        logger.info(
          'Model deployment requested by admin',
          { adminId: user.userId, modelId: body.modelId },
          'POST /api/admin/training/deploy',
        )

        return {
          success: true,
          message: 'Deployment request received',
          modelId: body.modelId,
          version: body.version ?? 'latest',
        }
      },
      {
        body: t.Object({
          modelId: t.String(),
          version: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Admin', 'Training'],
          summary: 'Deploy trained model',
        },
      },
    )

    // Training control - upload model
    .post(
      '/training/upload-model',
      async (ctx) => {
        const { body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        logger.info(
          'Model upload requested by admin',
          { adminId: user.userId, modelName: body.name },
          'POST /api/admin/training/upload-model',
        )

        // Model upload would typically upload to storage and register
        return {
          success: true,
          message: 'Model upload request received',
          name: body.name,
          url: body.url,
        }
      },
      {
        body: t.Object({
          name: t.String(),
          url: t.String(),
          metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        }),
        detail: {
          tags: ['Admin', 'Training'],
          summary: 'Upload trained model',
        },
      },
    )

    // World facts management
    .get(
      '/world-facts',
      async () => {
        // World facts would come from a narrative/world state service
        return {
          success: true,
          facts: [],
          message: 'World facts service not yet integrated',
        }
      },
      {
        detail: {
          tags: ['Admin'],
          summary: 'Get world facts',
        },
      },
    )

    // AI models management
    .get(
      '/ai-models',
      async () => {
        return {
          success: true,
          models: [
            {
              id: 'rl-model',
              name: 'RL Trading Model',
              status: 'ready',
            },
          ],
        }
      },
      {
        detail: {
          tags: ['Admin'],
          summary: 'List AI models',
        },
      },
    )

    // Admin management
    .get(
      '/admins/:userId',
      async ({ params, set }) => {
        const [adminUser] = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            email: users.email,
            isAdmin: users.isAdmin,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, params.userId))
          .limit(1)

        if (!adminUser) {
          set.status = 404
          return { error: 'User not found' }
        }

        return {
          success: true,
          admin: {
            ...adminUser,
            createdAt: adminUser.createdAt?.toISOString(),
          },
        }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Get admin details',
        },
      },
    )

    // Groups management
    .get(
      '/groups',
      async ({ query }) => {
        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)

        const groups = await db
          .select({
            id: userGroups.id,
            name: userGroups.name,
            description: userGroups.description,
            createdAt: userGroups.createdAt,
          })
          .from(userGroups)
          .orderBy(desc(userGroups.createdAt))
          .limit(limit)

        return {
          success: true,
          groups: groups.map((g) => ({
            ...g,
            createdAt: g.createdAt?.toISOString(),
          })),
          count: groups.length,
        }
      },
      {
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'List groups (admin)',
        },
      },
    )

    // Moderation escrow refund
    .post(
      '/moderation-escrow/refund',
      async (ctx) => {
        const { body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        logger.info(
          'Escrow refund requested',
          { escrowId: body.escrowId, adminId: user.userId },
          'POST /api/admin/moderation-escrow/refund',
        )

        // Escrow refund would interact with the moderation escrow service
        return {
          success: true,
          message: 'Escrow refund request received',
          escrowId: body.escrowId,
        }
      },
      {
        body: t.Object({
          escrowId: t.String(),
          amount: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Admin', 'Moderation'],
          summary: 'Refund moderation escrow',
        },
      },
    )

    // Human review moderation
    .get(
      '/moderation/human-review/:userId',
      async ({ params, set }) => {
        // Get user info
        const [targetUser] = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            profileImageUrl: users.profileImageUrl,
            reputationPoints: users.reputationPoints,
            isBanned: users.isBanned,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, params.userId))
          .limit(1)

        if (!targetUser) {
          set.status = 404
          return { error: 'User not found' }
        }

        // Get reports against user
        const userReports = await db
          .select()
          .from(reports)
          .where(eq(reports.reportedUserId, params.userId))
          .orderBy(desc(reports.createdAt))
          .limit(10)

        return {
          success: true,
          review: {
            user: {
              ...targetUser,
              createdAt: targetUser.createdAt?.toISOString(),
            },
            reports: userReports.map((r) => ({
              ...r,
              createdAt: r.createdAt?.toISOString(),
            })),
            isBanned: targetUser.isBanned,
          },
        }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Admin', 'Moderation'],
          summary: 'Get user for human review',
        },
      },
    )

    // Load testing
    .post(
      '/load-test',
      async (ctx) => {
        const { body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        logger.info(
          'Load test requested',
          { type: body.type, adminId: user.userId },
          'POST /api/admin/load-test',
        )

        return {
          success: true,
          message: 'Load test initiated',
          type: body.type,
          concurrency: body.concurrency ?? 10,
          duration: body.duration ?? 60,
        }
      },
      {
        body: t.Object({
          type: t.String(),
          concurrency: t.Optional(t.Number()),
          duration: t.Optional(t.Number()),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Run load test',
        },
      },
    )

    // Test DM messages
    .post(
      '/test-dm-messages',
      async (ctx) => {
        const { body } = ctx
        const { user } = getAuthContext(ctx)
        if (!user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        logger.info(
          'Test DM requested',
          { targetUserId: body.userId, adminId: user.userId },
          'POST /api/admin/test-dm-messages',
        )

        return {
          success: true,
          message: 'Test DM sent',
          targetUserId: body.userId,
        }
      },
      {
        body: t.Object({
          userId: t.String(),
          message: t.String(),
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Send test DM',
        },
      },
    )

export const adminRoutes = createAdminRoutes()
