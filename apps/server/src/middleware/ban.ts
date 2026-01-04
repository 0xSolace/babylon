import { db, eq, users } from '@babylon/db'
import { logger } from '@babylon/shared'
import { Elysia } from 'elysia'
import { authMiddleware, getAuthContext } from './auth'

/**
 * Ban check middleware - prevents banned users from accessing the API
 * Checks user ban status and returns 403 with ban reason and expiry for banned users.
 */
const createBanCheckMiddleware = () =>
  new Elysia({ name: 'ban-check' })
    .use(authMiddleware)
    .onBeforeHandle(async (ctx) => {
      const { user } = getAuthContext(ctx)
      if (!user) return // Skip for unauthenticated requests

      // Fetch user ban status from database
      const [dbUser] = await db
        .select({
          id: users.id,
          isBanned: users.isBanned,
          bannedAt: users.bannedAt,
          bannedReason: users.bannedReason,
          appealStatus: users.appealStatus,
        })
        .from(users)
        .where(eq(users.id, user.userId))
        .limit(1)

      if (!dbUser) return // User not found in DB, let other middleware handle

      if (dbUser.isBanned) {
        logger.warn(
          'Banned user attempted API access',
          {
            userId: user.userId,
            bannedAt: dbUser.bannedAt?.toISOString(),
            reason: dbUser.bannedReason,
          },
          'BanCheckMiddleware',
        )

        ctx.set.status = 403
        return {
          error: 'Access denied',
          code: 'USER_BANNED',
          message: dbUser.bannedReason || 'Your account has been banned.',
          bannedAt: dbUser.bannedAt?.toISOString() ?? null,
          appealStatus: dbUser.appealStatus ?? 'none',
          canAppeal: dbUser.appealStatus !== 'rejected',
        }
      }
    })

export const banCheckMiddleware = createBanCheckMiddleware()
