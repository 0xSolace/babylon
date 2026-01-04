/**
 * Actors routes - Users with special activity or agent status
 */
import { db, desc, eq, users } from '@babylon/db'
import { logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import { authMiddleware, rateLimitMiddleware } from '../middleware'

/**
 * Actor routes for feed and discovery
 */
const createActorsRoutes = () =>
  new Elysia({ prefix: '/api/actors' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // List all actors (users with activity)
    .get(
      '/',
      async () => {
        // Get users who are actors or have significant activity
        const actors = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            bio: users.bio,
            profileImageUrl: users.profileImageUrl,
            isActor: users.isActor,
            reputationPoints: users.reputationPoints,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.isActor, true))
          .orderBy(desc(users.reputationPoints))
          .limit(50)

        logger.info(
          'Actors list fetched',
          { count: actors.length },
          'GET /api/actors',
        )

        return {
          success: true,
          actors: actors.map((actor) => {
            // Handle createdAt - could be Date or string from SQLit
            let createdAt: string | null = null
            if (actor.createdAt) {
              createdAt =
                actor.createdAt instanceof Date
                  ? actor.createdAt.toISOString()
                  : typeof actor.createdAt === 'string'
                    ? new Date(actor.createdAt).toISOString()
                    : null
            }
            return {
              id: actor.id,
              name: actor.displayName ?? actor.username ?? actor.id, // Add name for profile lookup
              username: actor.username,
              displayName: actor.displayName,
              bio: actor.bio,
              profileImageUrl: actor.profileImageUrl,
              isActor: actor.isActor,
              reputationPoints: actor.reputationPoints ?? 0,
              createdAt,
            }
          }),
          count: actors.length,
        }
      },
      {
        detail: {
          tags: ['Actors'],
          summary: 'List all actors',
        },
      },
    )

    // Get actor stats
    .get(
      '/:actorId/stats',
      async ({ params }) => {
        const { actorId } = params

        const [actor] = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            reputationPoints: users.reputationPoints,
          })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1)

        if (!actor) {
          return {
            success: false,
            error: 'Actor not found',
          }
        }

        // Return basic stats - can be extended later
        return {
          success: true,
          stats: {
            id: actor.id,
            username: actor.username,
            displayName: actor.displayName,
            reputationPoints: actor.reputationPoints ?? 0,
            postsCount: 0,
            followersCount: 0,
            followingCount: 0,
          },
        }
      },
      {
        params: t.Object({
          actorId: t.String(),
        }),
        detail: {
          tags: ['Actors'],
          summary: 'Get actor stats',
        },
      },
    )

export const actorsRoutes = createActorsRoutes()
