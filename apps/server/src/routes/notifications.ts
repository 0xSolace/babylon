import {
  and,
  count,
  db,
  desc,
  eq,
  getBlockedByUserIds,
  getBlockedUserIds,
  getMutedUserIds,
  inArray,
  notifications,
  users,
} from '@babylon/db'
import { logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

/**
 * Notification routes
 * Migrated from: apps/web/app/api/notifications/*
 */
const createNotificationsRoutes = () =>
  new Elysia({ prefix: '/api/notifications' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // Get user notifications
    // Migrated from: apps/web/app/api/notifications/route.ts
    .get(
      '/',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { query, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)
        const unreadOnly = query.unreadOnly === 'true'
        const type = query.type

        // Build where conditions
        const conditions = [eq(notifications.userId, user.userId)]
        if (unreadOnly) {
          conditions.push(eq(notifications.read, false))
        }
        if (type) {
          conditions.push(eq(notifications.type, type))
        }

        // Get blocked/muted user IDs to filter notifications
        const [blockedIds, mutedIds, blockedByIds] = await Promise.all([
          getBlockedUserIds(user.userId),
          getMutedUserIds(user.userId),
          getBlockedByUserIds(user.userId),
        ])

        const excludedUserIds = new Set([
          ...blockedIds,
          ...mutedIds,
          ...blockedByIds,
        ])

        // Fetch notifications
        type NotificationRow = {
          id: string
          userId: string
          type: string
          actorId: string | null
          postId: string | null
          commentId: string | null
          chatId: string | null
          groupId: string | null
          inviteId: string | null
          message: string
          read: boolean
          createdAt: Date
        }
        const allNotifications = await db
          .select<NotificationRow>()
          .from(notifications)
          .where(and(...conditions))
          .orderBy(desc(notifications.createdAt))
          .limit(limit * 2) // Fetch more to account for filtering

        // Get actor IDs to fetch user info
        const actorIds = [
          ...new Set(
            allNotifications
              .map((n) => n.actorId)
              .filter((id): id is string => id !== null),
          ),
        ]

        // Fetch actor info
        const actorsResult =
          actorIds.length > 0
            ? await db
                .select({
                  id: users.id,
                  displayName: users.displayName,
                  username: users.username,
                  profileImageUrl: users.profileImageUrl,
                })
                .from(users)
                .where(inArray(users.id, actorIds))
            : []

        const actorMap = new Map(actorsResult.map((a) => [a.id, a]))

        // Filter out notifications from blocked/muted users and add actor info
        const notificationsList = allNotifications
          .filter((n) => !n.actorId || !excludedUserIds.has(n.actorId))
          .slice(0, limit)
          .map((n) => ({
            id: n.id,
            type: n.type,
            actorId: n.actorId,
            actor: n.actorId ? actorMap.get(n.actorId) || null : null,
            postId: n.postId,
            commentId: n.commentId,
            chatId: n.chatId,
            groupId: n.groupId,
            inviteId: n.inviteId,
            message: n.message,
            read: n.read,
            createdAt: n.createdAt.toISOString(),
          }))

        // Get unread count
        type CountResult = { count: number }
        const unreadCountResults = await db
          .select<CountResult>({ count: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.userId),
              eq(notifications.read, false),
            ),
          )

        const unreadCountResult = unreadCountResults[0]
        const unreadCount = unreadCountResult
          ? Number(unreadCountResult.count)
          : 0

        logger.info(
          'Notifications fetched',
          { userId: user.userId, count: notificationsList.length, unreadCount },
          'GET /api/notifications',
        )

        return {
          success: true,
          notifications: notificationsList,
          unreadCount,
        }
      },
      {
        query: t.Object({
          limit: t.Optional(t.String()),
          unreadOnly: t.Optional(t.String()),
          type: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Notifications'],
          summary: 'Get user notifications',
          description: 'Returns paginated notifications with filtering support',
        },
      },
    )

    // Mark notifications as read
    // Migrated from: apps/web/app/api/notifications/route.ts (PATCH)
    .patch(
      '/',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { notificationIds, markAllAsRead } = body

        if (markAllAsRead) {
          // Mark all notifications as read
          await db
            .update(notifications)
            .set({ read: true })
            .where(
              and(
                eq(notifications.userId, user.userId),
                eq(notifications.read, false),
              ),
            )

          logger.info(
            'All notifications marked as read',
            { userId: user.userId },
            'PATCH /api/notifications',
          )

          return {
            success: true,
            message: 'All notifications marked as read',
          }
        }

        if (notificationIds && notificationIds.length > 0) {
          // Mark specific notifications as read
          await db
            .update(notifications)
            .set({ read: true })
            .where(
              and(
                inArray(notifications.id, notificationIds),
                eq(notifications.userId, user.userId),
              ),
            )

          logger.info(
            'Notifications marked as read',
            { userId: user.userId, count: notificationIds.length },
            'PATCH /api/notifications',
          )

          return {
            success: true,
            message: 'Notifications marked as read',
          }
        }

        set.status = 400
        return {
          error:
            'Invalid request: provide notificationIds array or markAllAsRead=true',
        }
      },
      {
        body: t.Object({
          notificationIds: t.Optional(t.Array(t.String())),
          markAllAsRead: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ['Notifications'],
          summary: 'Mark notifications as read',
          description:
            'Marks specific notifications or all notifications as read',
        },
      },
    )

    // Mark all notifications as read
    // Migrated from: apps/web/app/api/notifications/mark-read/route.ts
    .post(
      '/mark-read',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        await db
          .update(notifications)
          .set({ read: true })
          .where(
            and(
              eq(notifications.userId, user.userId),
              eq(notifications.read, false),
            ),
          )

        logger.info(
          'All notifications marked as read via mark-read endpoint',
          { userId: user.userId },
          'POST /api/notifications/mark-read',
        )

        return {
          success: true,
          message: 'All notifications marked as read',
        }
      },
      {
        detail: {
          tags: ['Notifications'],
          summary: 'Mark all notifications as read',
        },
      },
    )

/** Notification routes for use with Elysia.use() */
export const notificationsRoutes = createNotificationsRoutes()
