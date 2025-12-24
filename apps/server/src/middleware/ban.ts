import { Elysia } from 'elysia'
import { authMiddleware, getAuthContext } from './auth'

/**
 * Ban check middleware - prevents banned users from accessing the API
 *
 * TODO: Migrate ban checking logic from apps/web/app/api
 * - Check user ban status via @babylon/api BanManager
 * - Support temporary and permanent bans
 * - Return appropriate error messages with ban reason and expiry
 */
const createBanCheckMiddleware = () =>
  new Elysia({ name: 'ban-check' })
    .use(authMiddleware)
    .onBeforeHandle(async (ctx) => {
      const { user } = getAuthContext(ctx)
      if (!user) return // Skip for unauthenticated requests

      // TODO: Implement ban check using set.status = 403 when ready
      // const banManager = getBanManager();
      // const banStatus = await banManager.checkBan(user.userId);
      // if (banStatus.isBanned) { ... }
    })

export const banCheckMiddleware = createBanCheckMiddleware()
