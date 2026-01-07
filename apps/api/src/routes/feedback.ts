// @ts-nocheck - Elysia body type inference issues, needs refactoring
import { db, eq, users } from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

/**
 * Feedback routes
 * Migrated from: apps/web/app/api/feedback/*
 */
const createFeedbackRoutes = () =>
  new Elysia({ prefix: '/api/feedback' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // Submit feedback
    // Migrated from: apps/web/app/api/feedback/submit/route.ts
    .post(
      '/submit',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const {
          toUserId,
          score: rawScore,
          stars,
          comment,
          category,
        } = body as {
          toUserId: string
          score?: number
          stars?: number
          comment?: string
          category?: string
        }

        // Convert stars to score (1-5 stars = 20-100 score)
        const score = stars !== undefined ? stars * 20 : rawScore

        if (score === undefined || score < 0 || score > 100) {
          set.status = 400
          return { error: 'Invalid score or stars value' }
        }

        // Check target user exists
        const [toUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, toUserId))
          .limit(1)

        if (!toUser) {
          set.status = 404
          return { error: 'Target user not found' }
        }

        if (user.userId === toUserId) {
          set.status = 400
          return { error: 'Cannot submit feedback to yourself' }
        }

        const feedbackId = await generateSnowflakeId()
        const now = new Date()

        const feedback = await db.feedback.create({
          data: {
            id: feedbackId,
            userId: user.userId,
            type: 'user_feedback',
            content: comment ?? '',
            toUserId,
            score,
            comment: comment ?? null,
            category: category ?? 'general',
            interactionType: 'user_to_agent',
            createdAt: now,
            updatedAt: now,
          },
        })

        logger.info(
          'Feedback submitted',
          {
            feedbackId: feedback.id,
            userId: user.userId,
            type: 'user_feedback',
            content: comment ?? '',
            toUserId,
            score,
          },
          'POST /api/feedback/submit',
        )

        return {
          success: true,
          feedbackId: feedback.id,
          score,
          message: 'Feedback submitted successfully',
        }
      },
      {
        body: t.Object({
          toUserId: t.String(),
          score: t.Optional(t.Number()),
          stars: t.Optional(t.Number()),
          comment: t.Optional(t.String()),
          category: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Feedback'],
          summary: 'Submit feedback',
          description: 'Submits feedback with star ratings or scores',
        },
      },
    )

    // User to agent feedback
    // Migrated from: apps/web/app/api/feedback/user-to-agent/route.ts
    .post(
      '/user-to-agent',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { agentId, score, comment, interactionId: _interactionId } = body

        if (score < 0 || score > 100) {
          set.status = 400
          return { error: 'Score must be between 0 and 100' }
        }

        const feedbackId = await generateSnowflakeId()
        const now = new Date()

        const feedback = await db.feedback.create({
          data: {
            id: feedbackId,
            userId: user.userId,
            type: 'user_feedback',
            content: comment ?? '',
            toUserId: agentId,
            score,
            comment: comment ?? null,
            category: 'general',
            interactionType: 'user_to_agent',
            createdAt: now,
            updatedAt: now,
          },
        })

        logger.info(
          'User-to-agent feedback submitted',
          {
            feedbackId: feedback.id,
            userId: user.userId,
            type: 'user_feedback',
            content: comment ?? '',
            agentId,
            score,
          },
          'POST /api/feedback/user-to-agent',
        )

        return {
          success: true,
          feedbackId: feedback.id,
        }
      },
      {
        body: t.Object({
          agentId: t.String(),
          score: t.Number(),
          comment: t.Optional(t.String()),
          interactionId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Feedback'],
          summary: 'User to agent feedback',
          description: 'Submits user feedback about an agent',
        },
      },
    )

    // Agent to user feedback
    // Migrated from: apps/web/app/api/feedback/agent-to-user/route.ts
    .post(
      '/agent-to-user',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        // This endpoint should be called by agents
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { userId, score, comment, interactionId: _interactionId } = body

        if (score < 0 || score > 100) {
          set.status = 400
          return { error: 'Score must be between 0 and 100' }
        }

        const feedbackId = await generateSnowflakeId()
        const now = new Date()

        const feedback = await db.feedback.create({
          data: {
            id: feedbackId,
            userId: user.userId,
            type: 'user_feedback',
            content: comment ?? '', // The agent
            toUserId: userId,
            score,
            comment: comment ?? null,
            category: 'general',
            interactionType: 'agent_to_user',
            createdAt: now,
            updatedAt: now,
          },
        })

        logger.info(
          'Agent-to-user feedback submitted',
          {
            feedbackId: feedback.id,
            agentId: user.userId,
            userId,
            score,
          },
          'POST /api/feedback/agent-to-user',
        )

        return {
          success: true,
          feedbackId: feedback.id,
        }
      },
      {
        body: t.Object({
          userId: t.String(),
          score: t.Number(),
          comment: t.Optional(t.String()),
          interactionId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Feedback'],
          summary: 'Agent to user feedback',
          description: 'Submits agent feedback about a user',
        },
      },
    )

    // Game to agent feedback
    // Migrated from: apps/web/app/api/feedback/game-to-agent/route.ts
    .post(
      '/game-to-agent',
      async (ctx) => {
        const { set, body } = ctx

        const { gameId, agentId, score, metrics, comment } = body

        if (score < 0 || score > 100) {
          set.status = 400
          return { error: 'Score must be between 0 and 100' }
        }

        const feedbackId = await generateSnowflakeId()
        const now = new Date()

        const feedback = await db.feedback.create({
          data: {
            id: feedbackId,
            userId: gameId, // Game as source
            type: 'game_feedback',
            content: comment ?? '',
            toUserId: agentId,
            score,
            comment: comment ?? null,
            category: 'game_performance',
            interactionType: 'game_to_agent',
            metadata: metrics ? JSON.stringify(metrics) : null,
            createdAt: now,
            updatedAt: now,
          },
        })

        logger.info(
          'Game-to-agent feedback submitted',
          {
            feedbackId: feedback.id,
            gameId,
            agentId,
            score,
          },
          'POST /api/feedback/game-to-agent',
        )

        return {
          success: true,
          feedbackId: feedback.id,
        }
      },
      {
        body: t.Object({
          gameId: t.String(),
          agentId: t.String(),
          score: t.Number(),
          metrics: t.Optional(t.Record(t.String(), t.Number())),
          comment: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Feedback'],
          summary: 'Game to agent feedback',
          description: 'Submits game performance feedback about an agent',
        },
      },
    )

    // Agent to game feedback
    // Migrated from: apps/web/app/api/feedback/agent-to-game/route.ts
    .post(
      '/agent-to-game',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { gameId, score, comment } = body

        if (score < 0 || score > 100) {
          set.status = 400
          return { error: 'Score must be between 0 and 100' }
        }

        const feedbackId = await generateSnowflakeId()
        const now = new Date()

        const feedback = await db.feedback.create({
          data: {
            id: feedbackId,
            userId: user.userId, // The agent
            toUserId: gameId,
            type: 'agent_feedback',
            content: comment ?? '',
            score,
            comment: comment ?? null,
            category: 'game_performance',
            interactionType: 'agent_to_game',
            createdAt: now,
            updatedAt: now,
          },
        })

        logger.info(
          'Agent-to-game feedback submitted',
          {
            feedbackId: feedback.id,
            agentId: user.userId,
            gameId,
            score,
          },
          'POST /api/feedback/agent-to-game',
        )

        return {
          success: true,
          feedbackId: feedback.id,
        }
      },
      {
        body: t.Object({
          gameId: t.String(),
          score: t.Number(),
          comment: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Feedback'],
          summary: 'Agent to game feedback',
          description: 'Submits agent feedback about a game',
        },
      },
    )

    // Auto-generate feedback
    // Migrated from: apps/web/app/api/feedback/auto-generate/route.ts
    .post(
      '/auto-generate',
      async (ctx) => {
        const { set, body } = ctx
        const { interactionId, interactionType, participants } = body

        logger.info(
          'Auto-generate feedback requested',
          { interactionId, interactionType, participants },
          'POST /api/feedback/auto-generate',
        )

        // Validate participants
        if (participants.length < 2) {
          set.status = 400
          return { error: 'At least 2 participants required for feedback' }
        }

        // Generate feedback for each pair of participants
        const generatedFeedbacks: Array<{
          feedbackId: string
          fromUserId: string
          toUserId: string
          score: number
        }> = []

        // Determine base score and comment based on interaction type
        let baseScore: number
        let category: string
        let baseComment: string

        switch (interactionType) {
          case 'game':
          case 'game_completion':
            baseScore = 70
            category = 'game_performance'
            baseComment = 'Participated in a game interaction'
            break
          case 'trade':
          case 'trade_completion':
            baseScore = 65
            category = 'trade_performance'
            baseComment = 'Participated in a trading interaction'
            break
          case 'chat':
          case 'conversation':
            baseScore = 75
            category = 'communication'
            baseComment = 'Engaged in helpful conversation'
            break
          case 'collaboration':
            baseScore = 80
            category = 'collaboration'
            baseComment = 'Collaborated effectively'
            break
          default:
            baseScore = 60
            category = 'general'
            baseComment = 'Participated in an interaction'
        }

        // Generate bidirectional feedback between first two participants
        const [participant1, participant2] = participants
        const now = new Date()

        // Participant 1 -> Participant 2
        const feedback1Id = await generateSnowflakeId()
        await db.feedback.create({
          data: {
            id: feedback1Id,
            userId: participant1,
            type: 'auto_generated',
            content: baseComment,
            toUserId: participant2,
            score: baseScore,
            comment: `${baseComment} (auto-generated)`,
            category,
            interactionType,
            metadata: JSON.stringify({
              autoGenerated: true,
              interactionId,
              generatedAt: now.toISOString(),
            }),
            createdAt: now,
            updatedAt: now,
          },
        })
        generatedFeedbacks.push({
          feedbackId: feedback1Id,
          fromUserId: participant1,
          toUserId: participant2,
          score: baseScore,
        })

        // Participant 2 -> Participant 1
        const feedback2Id = await generateSnowflakeId()
        await db.feedback.create({
          data: {
            id: feedback2Id,
            userId: participant2,
            type: 'auto_generated',
            content: baseComment,
            toUserId: participant1,
            score: baseScore,
            comment: `${baseComment} (auto-generated)`,
            category,
            interactionType,
            metadata: JSON.stringify({
              autoGenerated: true,
              interactionId,
              generatedAt: now.toISOString(),
            }),
            createdAt: now,
            updatedAt: now,
          },
        })
        generatedFeedbacks.push({
          feedbackId: feedback2Id,
          fromUserId: participant2,
          toUserId: participant1,
          score: baseScore,
        })

        logger.info(
          'Auto-generated feedback created',
          {
            interactionId,
            interactionType,
            feedbackCount: generatedFeedbacks.length,
          },
          'POST /api/feedback/auto-generate',
        )

        return {
          success: true,
          feedbacks: generatedFeedbacks,
          message: `Generated ${generatedFeedbacks.length} feedback records`,
        }
      },
      {
        body: t.Object({
          interactionId: t.String(),
          interactionType: t.String(),
          participants: t.Array(t.String()),
        }),
        detail: {
          tags: ['Feedback'],
          summary: 'Auto-generate feedback',
          description: 'Automatically generates feedback using AI analysis',
        },
      },
    )

export const feedbackRoutes = createFeedbackRoutes()
