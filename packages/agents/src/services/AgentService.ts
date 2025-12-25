/**
 * Agent Service v2 - Agents are Users
 *
 * Core service for agent lifecycle management. Agents are implemented as users
 * with isAgent=true, allowing them to participate fully in the platform.
 *
 * @remarks
 * Architecture: Agents ARE users (isAgent=true), not separate entities.
 * They can post, comment, join chats, trade, and do everything users can do.
 * The creating user "manages" them via the managedBy field.
 * Agent configuration is stored in the UserAgentConfig table.
 *
 * @packageDocumentation
 */

import type { User, UserAgentConfig } from '@babylon/db'
import { db, withTransaction } from '@babylon/db'
import type { AgentCapabilities, JsonValue } from '@babylon/shared'
import {
  AuthorizationError,
  getCurrentChainId,
  IDENTITY_REGISTRY_BASE_SEPOLIA,
  REPUTATION_SYSTEM_BASE_SEPOLIA,
} from '@babylon/shared'
import { generateSnowflakeId, toNull } from '@jejunetwork/shared'
import { agentIdentityService } from '../identity/AgentIdentityService'
import { agentRuntimeManager } from '../runtime/AgentRuntimeManager'
import { logger } from '../shared/logger'
import type { AgentPerformance, CreateAgentParams } from '../types'
import { agentRegistry } from './agent-registry.service'

/** User with agent configuration */
export type UserWithConfig = User & { agentConfig: UserAgentConfig | null }

/**
 * Get agent config for a user
 */
export async function getAgentConfig(
  userId: string,
): Promise<UserAgentConfig | null> {
  return db.userAgentConfig.findUnique({
    where: { userId },
  })
}

/**
 * Get user with their agent config
 */
export async function getUserWithConfig(
  userId: string,
): Promise<UserWithConfig | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
  })

  if (!user) return null

  const config = await getAgentConfig(userId)
  return { ...user, agentConfig: config } as UserWithConfig
}

/**
 * Service for agent lifecycle management
 */
export class AgentServiceV2 {
  /**
   * Creates a new agent (creates a full User with isAgent=true)
   *
   * Creates a complete user account with agent capabilities, wallet, and
   * initial configuration. The agent can immediately participate in all
   * platform activities.
   *
   * @param params - Agent creation parameters
   * @returns Created user/agent entity
   * @throws Error if manager not found or insufficient points for deposit
   */
  async createAgent(params: CreateAgentParams): Promise<User> {
    const {
      userId: managerUserId,
      name,
      description,
      profileImageUrl,
      coverImageUrl,
      system,
      bio,
      personality,
      tradingStrategy,
      initialDeposit,
    } = params

    const manager = await db.user.findUnique({
      where: { id: managerUserId },
    })

    if (!manager) throw new Error('Manager user not found')

    if (initialDeposit && initialDeposit > 0) {
      const totalPoints = Number(manager.reputationPoints)
      if (totalPoints < initialDeposit) {
        throw new Error(
          `Insufficient balance. Have: ${totalPoints}, Need: ${initialDeposit}`,
        )
      }
    }

    const baseUsername = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 20)
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const agentUsername = `agent_${baseUsername}_${randomSuffix}`
    const agentUserId = await generateSnowflakeId()

    const agent = await withTransaction(async (tx) => {
      // Create the user record
      const userInsertResult = await tx.query<User>(
        `INSERT INTO "User" (
          "id", "username", "displayName", "bio", "profileImageUrl", "coverImageUrl",
          "isAgent", "managedBy", "virtualBalance", "totalDeposited", "reputationPoints",
          "profileComplete", "hasUsername", "hasBio", "hasProfileImage", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *`,
        [
          agentUserId,
          agentUsername,
          name,
          description ||
            `AI agent managed by ${String(manager.displayName || manager.username)}`,
          profileImageUrl || null,
          coverImageUrl || null,
          true,
          managerUserId,
          '0',
          '0',
          0,
          true,
          true,
          Boolean(description),
          Boolean(profileImageUrl),
          new Date().toISOString(),
        ],
      )

      const newAgent = userInsertResult[0]
      if (!newAgent) throw new Error('Failed to create agent user')

      // Create the agent config record
      const configId = await generateSnowflakeId()
      await tx.exec(
        `INSERT INTO "UserAgentConfig" (
          "id", "userId", "systemPrompt", "personality", "tradingStrategy",
          "messageExamples", "pointsBalance", "totalDeposited", "a2aEnabled", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          configId,
          agentUserId,
          toNull(system),
          toNull(personality),
          toNull(tradingStrategy),
          bio ? JSON.stringify(bio) : null,
          initialDeposit || 0,
          initialDeposit || 0,
          true,
          new Date().toISOString(),
        ],
      )

      if (initialDeposit && initialDeposit > 0) {
        const initialManagerPoints = Number(manager.reputationPoints)

        await tx.exec(
          `UPDATE "User" SET "reputationPoints" = $1, "updatedAt" = $2 WHERE "id" = $3`,
          [
            initialManagerPoints - initialDeposit,
            new Date().toISOString(),
            managerUserId,
          ],
        )

        const agentPointsTxId = await generateSnowflakeId()
        await tx.exec(
          `INSERT INTO "agentPointsTransactions" (
            "id", "agentUserId", "managerUserId", "type", "amount",
            "balanceBefore", "balanceAfter", "description"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            agentPointsTxId,
            agentUserId,
            managerUserId,
            'deposit',
            initialDeposit,
            0,
            initialDeposit,
            'Initial deposit',
          ],
        )

        const pointsTxId = await generateSnowflakeId()
        await tx.exec(
          `INSERT INTO "PointsTransaction" (
            "id", "userId", "amount", "pointsBefore", "pointsAfter", "reason", "metadata"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            pointsTxId,
            managerUserId,
            -initialDeposit,
            initialManagerPoints,
            initialManagerPoints - initialDeposit,
            `Deposit to agent: ${name}`,
            JSON.stringify({ agentUserId, agentName: name }),
          ],
        )
      }

      const logId = await generateSnowflakeId()
      await tx.exec(
        `INSERT INTO "AgentLog" (
          "id", "agentUserId", "type", "level", "message", "metadata"
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          logId,
          agentUserId,
          'system',
          'info',
          `Agent created: ${name}`,
          JSON.stringify({ initialDeposit: initialDeposit || 0 }),
        ],
      )

      return newAgent
    })

    logger.info(
      `Agent user created: ${agentUserId} managed by ${managerUserId}`,
      undefined,
      'AgentService',
    )

    // Register agent in registry
    if (agentRegistry) {
      const capabilities: AgentCapabilities = {
        strategies: [
          'prediction_markets',
          'social_interaction',
          ...(tradingStrategy
            ? [`trading_${tradingStrategy.toLowerCase()}`]
            : []),
        ],
        markets: ['prediction', 'perpetual', 'spot'],
        actions: [
          'trade',
          'post',
          'comment',
          'like',
          'message',
          'analyze_market',
          'manage_portfolio',
        ],
        version: '1.0.0',
        x402Support: true,
        platform: 'babylon',
        userType: 'user_controlled',
        gameNetwork: {
          chainId: getCurrentChainId(),
          registryAddress: IDENTITY_REGISTRY_BASE_SEPOLIA,
          reputationAddress: REPUTATION_SYSTEM_BASE_SEPOLIA,
        },
        skills: [],
        domains: [],
      }

      await agentRegistry.registerUserAgent({
        userId: agentUserId,
        name: name,
        systemPrompt:
          system || 'You are a helpful AI agent on Babylon prediction market.',
        capabilities,
      })

      logger.info(
        `Agent ${agentUserId} registered in registry`,
        undefined,
        'AgentService',
      )
    }

    if (this.shouldAutoSetupAgentIdentity()) {
      void this.setupAgentIdentity(agentUserId)
    }

    return agent
  }

  async getAgent(
    agentUserId: string,
    managerUserId?: string,
  ): Promise<User | null> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    })

    if (!agent) return null
    if (!agent.isAgent) throw new Error('User is not an agent')
    if (managerUserId && agent.managedBy !== managerUserId) {
      throw new AuthorizationError(
        'You do not have permission to access this agent. You can only chat with agents you own.',
        'agent',
        'chat',
      )
    }
    return agent as User
  }

  /**
   * Get agent with config
   */
  async getAgentWithConfig(
    agentUserId: string,
    managerUserId?: string,
  ): Promise<UserWithConfig | null> {
    const agent = await this.getAgent(agentUserId, managerUserId)
    if (!agent) return null

    const config = await getAgentConfig(agentUserId)
    return { ...agent, agentConfig: config }
  }

  async listUserAgents(
    managerUserId: string,
    filters?: { autonomousTrading?: boolean },
  ): Promise<User[]> {
    // If filtering by autonomousTrading, we need to use raw SQL for the join
    if (filters?.autonomousTrading !== undefined) {
      const results = await db.query<User>(
        `SELECT u.* FROM "User" u
         INNER JOIN "UserAgentConfig" uac ON u."id" = uac."userId"
         WHERE u."isAgent" = true
         AND u."managedBy" = $1
         AND uac."autonomousTrading" = $2
         ORDER BY u."createdAt" DESC`,
        [managerUserId, filters.autonomousTrading],
      )
      return results
    }

    return db.user.findMany({
      where: {
        isAgent: true,
        managedBy: managerUserId,
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<User[]>
  }

  async updateAgent(
    agentUserId: string,
    managerUserId: string,
    updates: Partial<{
      name: string
      description: string
      profileImageUrl: string
      system: string
      bio: string[] // Bio array for ElizaOS agentMessageExamples
      personality: string
      tradingStrategy: string
      modelTier: 'free' | 'pro'
      autonomousTrading: boolean
      autonomousPosting: boolean
      autonomousCommenting: boolean
      autonomousDMs: boolean
      autonomousGroupChats: boolean
      a2aEnabled: boolean
    }>,
  ): Promise<User> {
    await this.getAgent(agentUserId, managerUserId) // Verify ownership

    if (
      updates.system ||
      updates.personality ||
      updates.modelTier ||
      updates.bio
    ) {
      await agentRuntimeManager.clearRuntime(agentUserId)
    }

    // Update user fields
    const userUpdates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (updates.name) userUpdates.displayName = updates.name
    if (updates.description) userUpdates.bio = updates.description
    if (updates.profileImageUrl !== undefined)
      userUpdates.profileImageUrl = updates.profileImageUrl

    if (Object.keys(userUpdates).length > 1) {
      await db.user.update({
        where: { id: agentUserId },
        data: userUpdates,
      })
    }

    // Update agent config fields
    const configUpdates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (updates.system) configUpdates.systemPrompt = updates.system
    if (updates.bio) configUpdates.messageExamples = JSON.stringify(updates.bio)
    if (updates.personality) configUpdates.personality = updates.personality
    if (updates.tradingStrategy)
      configUpdates.tradingStrategy = updates.tradingStrategy
    if (updates.modelTier) configUpdates.modelTier = updates.modelTier
    if (updates.autonomousTrading !== undefined)
      configUpdates.autonomousTrading = updates.autonomousTrading
    if (updates.autonomousPosting !== undefined)
      configUpdates.autonomousPosting = updates.autonomousPosting
    if (updates.autonomousCommenting !== undefined)
      configUpdates.autonomousCommenting = updates.autonomousCommenting
    if (updates.autonomousDMs !== undefined)
      configUpdates.autonomousDMs = updates.autonomousDMs
    if (updates.autonomousGroupChats !== undefined)
      configUpdates.autonomousGroupChats = updates.autonomousGroupChats
    if (updates.a2aEnabled !== undefined)
      configUpdates.a2aEnabled = updates.a2aEnabled

    if (Object.keys(configUpdates).length > 1) {
      await db.userAgentConfig.update({
        where: { userId: agentUserId },
        data: configUpdates,
      })
    }

    const updatedAgent = await db.user.findUniqueOrThrow({
      where: { id: agentUserId },
    })

    await db.agentLog.create({
      data: {
        id: await generateSnowflakeId(),
        agentUserId,
        type: 'system',
        level: 'info',
        content: 'Agent configuration updated',
        metadata: JSON.stringify(updates) as JsonValue,
      },
    })

    logger.info(`Agent updated: ${agentUserId}`, undefined, 'AgentService')
    return updatedAgent as User
  }

  async deleteAgent(agentUserId: string, managerUserId: string): Promise<void> {
    const agentWithConfig = await this.getAgentWithConfig(
      agentUserId,
      managerUserId,
    )
    if (!agentWithConfig) throw new Error('Agent not found')

    const pointsBalance =
      Number(agentWithConfig.agentConfig?.pointsBalance) || 0

    await withTransaction(async (tx) => {
      // Return remaining ops budget to manager's points
      if (pointsBalance > 0) {
        const managerResult = await tx.queryOne<{ reputationPoints: number }>(
          `SELECT "reputationPoints" FROM "User" WHERE "id" = $1`,
          [managerUserId],
        )

        const currentPoints = Number(managerResult?.reputationPoints) || 0

        await tx.exec(
          `UPDATE "User" SET "reputationPoints" = $1, "updatedAt" = $2 WHERE "id" = $3`,
          [
            currentPoints + pointsBalance,
            new Date().toISOString(),
            managerUserId,
          ],
        )

        const pointsTxId = await generateSnowflakeId()
        await tx.exec(
          `INSERT INTO "PointsTransaction" (
            "id", "userId", "amount", "pointsBefore", "pointsAfter", "reason", "metadata"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            pointsTxId,
            managerUserId,
            pointsBalance,
            currentPoints,
            currentPoints + pointsBalance,
            `Agent deleted, points returned: ${String(agentWithConfig.displayName)}`,
            JSON.stringify({
              agentUserId,
              agentName: agentWithConfig.displayName,
            }),
          ],
        )
      }

      // Delete agent config
      await tx.exec(`DELETE FROM "UserAgentConfig" WHERE "userId" = $1`, [
        agentUserId,
      ])

      // Delete agent user
      await tx.exec(`DELETE FROM "User" WHERE "id" = $1`, [agentUserId])
    })

    // Clear runtime from agent runtime manager
    await agentRuntimeManager.clearRuntime(agentUserId)

    logger.info(`Agent deleted: ${agentUserId}`, undefined, 'AgentService')
  }

  /**
   * Deposit ops budget points from manager's reputationPoints to agent's pointsBalance
   *
   * Transfers points from user to fund agent operations.
   * This is used for AI operations like chat, tick, posting.
   *
   * @param agentUserId - Agent user ID
   * @param managerUserId - Manager (owner) user ID
   * @param amount - Amount to deposit
   * @returns Updated agent User
   * @throws Error if insufficient balance or agent not found
   */
  async depositPoints(
    agentUserId: string,
    managerUserId: string,
    amount: number,
  ): Promise<User> {
    if (amount <= 0) throw new Error('Amount must be positive')
    const agentWithConfig = await this.getAgentWithConfig(
      agentUserId,
      managerUserId,
    )
    if (!agentWithConfig) throw new Error('Agent not found')

    const config = agentWithConfig.agentConfig
    if (!config) throw new Error('Agent config not found')

    const manager = await db.user.findUnique({
      where: { id: managerUserId },
    })

    if (!manager) throw new Error('Manager not found')

    const totalPoints = Number(manager.reputationPoints)
    if (totalPoints < amount) {
      throw new Error(
        `Insufficient balance. Have: ${totalPoints}, Need: ${amount}`,
      )
    }

    const configPointsBalance = Number(config.pointsBalance)
    const configTotalDeposited = Number(config.totalDeposited)

    await withTransaction(async (tx) => {
      await tx.exec(
        `UPDATE "UserAgentConfig" SET "pointsBalance" = $1, "totalDeposited" = $2, "updatedAt" = $3 WHERE "userId" = $4`,
        [
          configPointsBalance + amount,
          configTotalDeposited + amount,
          new Date().toISOString(),
          agentUserId,
        ],
      )

      await tx.exec(
        `UPDATE "User" SET "reputationPoints" = $1, "updatedAt" = $2 WHERE "id" = $3`,
        [totalPoints - amount, new Date().toISOString(), managerUserId],
      )

      const agentPointsTxId = await generateSnowflakeId()
      await tx.exec(
        `INSERT INTO "agentPointsTransactions" (
          "id", "agentUserId", "managerUserId", "type", "amount",
          "balanceBefore", "balanceAfter", "description"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          agentPointsTxId,
          agentUserId,
          managerUserId,
          'deposit',
          amount,
          configPointsBalance,
          configPointsBalance + amount,
          'Points deposit',
        ],
      )

      const pointsTxId = await generateSnowflakeId()
      await tx.exec(
        `INSERT INTO "PointsTransaction" (
          "id", "userId", "amount", "pointsBefore", "pointsAfter", "reason", "metadata"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          pointsTxId,
          managerUserId,
          -amount,
          totalPoints,
          totalPoints - amount,
          `Deposit to agent: ${String(agentWithConfig.displayName)}`,
          JSON.stringify({
            agentUserId,
            agentName: agentWithConfig.displayName,
          }),
        ],
      )
    })

    logger.info(
      `Deposited ${amount} points to agent ${agentUserId}`,
      undefined,
      'AgentService',
    )

    const result = await db.user.findUniqueOrThrow({
      where: { id: agentUserId },
    })
    return result as User
  }

  /**
   * Withdraw ops budget points from agent's pointsBalance to manager's reputationPoints
   *
   * Transfers points from agent's ops budget back to user.
   *
   * @param agentUserId - Agent user ID
   * @param managerUserId - Manager (owner) user ID
   * @param amount - Amount to withdraw
   * @returns Updated agent User
   * @throws Error if insufficient balance or agent not found
   */
  async withdrawPoints(
    agentUserId: string,
    managerUserId: string,
    amount: number,
  ): Promise<User> {
    if (amount <= 0) throw new Error('Amount must be positive')
    const agentWithConfig = await this.getAgentWithConfig(
      agentUserId,
      managerUserId,
    )
    if (!agentWithConfig) throw new Error('Agent not found')

    const config = agentWithConfig.agentConfig
    if (!config) throw new Error('Agent config not found')

    const configPointsBalance = Number(config.pointsBalance)
    const configTotalWithdrawn = Number(config.totalWithdrawn)

    if (configPointsBalance < amount) {
      throw new Error(
        `Insufficient balance. Have: ${configPointsBalance}, Need: ${amount}`,
      )
    }

    await withTransaction(async (tx) => {
      await tx.exec(
        `UPDATE "UserAgentConfig" SET "pointsBalance" = $1, "totalWithdrawn" = $2, "updatedAt" = $3 WHERE "userId" = $4`,
        [
          configPointsBalance - amount,
          configTotalWithdrawn + amount,
          new Date().toISOString(),
          agentUserId,
        ],
      )

      const managerResult = await tx.queryOne<{ reputationPoints: number }>(
        `SELECT "reputationPoints" FROM "User" WHERE "id" = $1`,
        [managerUserId],
      )

      const managerPoints = Number(managerResult?.reputationPoints) || 0

      await tx.exec(
        `UPDATE "User" SET "reputationPoints" = $1, "updatedAt" = $2 WHERE "id" = $3`,
        [managerPoints + amount, new Date().toISOString(), managerUserId],
      )

      const agentPointsTxId = await generateSnowflakeId()
      await tx.exec(
        `INSERT INTO "agentPointsTransactions" (
          "id", "agentUserId", "managerUserId", "type", "amount",
          "balanceBefore", "balanceAfter", "description"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          agentPointsTxId,
          agentUserId,
          managerUserId,
          'withdraw',
          -amount,
          configPointsBalance,
          configPointsBalance - amount,
          'Points withdrawal',
        ],
      )

      const pointsTxId = await generateSnowflakeId()
      await tx.exec(
        `INSERT INTO "PointsTransaction" (
          "id", "userId", "amount", "pointsBefore", "pointsAfter", "reason", "metadata"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          pointsTxId,
          managerUserId,
          amount,
          managerPoints,
          managerPoints + amount,
          `Withdrawal from agent: ${String(agentWithConfig.displayName)}`,
          JSON.stringify({
            agentUserId,
            agentName: agentWithConfig.displayName,
          }),
        ],
      )
    })

    logger.info(
      `Withdrew ${amount} points from agent ${agentUserId}`,
      undefined,
      'AgentService',
    )

    const result = await db.user.findUniqueOrThrow({
      where: { id: agentUserId },
    })
    return result as User
  }

  async deductPoints(
    agentUserId: string,
    amount: number,
    reason: string,
    relatedId?: string,
  ): Promise<number> {
    const config = await getAgentConfig(agentUserId)
    if (!config) throw new Error('Agent config not found')

    const configPointsBalance = Number(config.pointsBalance)
    const configTotalPointsSpent = Number(config.totalPointsSpent)

    if (configPointsBalance < amount) {
      throw new Error(
        `Insufficient balance. Have: ${configPointsBalance}, Need: ${amount}`,
      )
    }

    const newBalance = await withTransaction(async (tx) => {
      await tx.exec(
        `UPDATE "UserAgentConfig" SET "pointsBalance" = $1, "totalPointsSpent" = $2, "updatedAt" = $3 WHERE "userId" = $4`,
        [
          configPointsBalance - amount,
          configTotalPointsSpent + amount,
          new Date().toISOString(),
          agentUserId,
        ],
      )

      // Get the user to find manager
      const userResult = await tx.queryOne<{ managedBy: string | null }>(
        `SELECT "managedBy" FROM "User" WHERE "id" = $1`,
        [agentUserId],
      )

      const managedBy = userResult?.managedBy || agentUserId

      const agentPointsTxId = await generateSnowflakeId()
      await tx.exec(
        `INSERT INTO "agentPointsTransactions" (
          "id", "agentUserId", "managerUserId", "type", "amount",
          "balanceBefore", "balanceAfter", "description", "relatedId"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agentPointsTxId,
          agentUserId,
          managedBy,
          reason.includes('chat')
            ? 'spend_chat'
            : reason.includes('post')
              ? 'spend_post'
              : 'spend_tick',
          -amount,
          configPointsBalance,
          configPointsBalance - amount,
          reason,
          toNull(relatedId),
        ],
      )

      return configPointsBalance - amount
    })

    return newBalance
  }

  async getPerformance(agentUserId: string): Promise<AgentPerformance> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    })

    if (!agent || !agent.isAgent) throw new Error('Agent not found')

    // Get pre-calculated performance metrics from agentPerformanceMetrics table
    const metrics = await db.agentPerformanceMetrics.findUnique({
      where: { userId: agentUserId },
    })

    // If metrics exist, use them; otherwise fall back to calculating from trades
    if (metrics) {
      // Get trades for avgTradeSize calculation
      const trades = await db.agentTrade.findMany({
        where: { agentUserId },
      })

      const tradesWithPnl = trades.filter((t) => t.pnl !== null)
      const avgTradeSize =
        tradesWithPnl.length > 0
          ? tradesWithPnl.reduce((sum, t) => sum + Number(t.amount), 0) /
            tradesWithPnl.length
          : 0

      return {
        lifetimePnL: Number(agent.lifetimePnL),
        totalTrades: Number(metrics.totalTrades),
        profitableTrades: Number(metrics.profitableTrades),
        winRate: Number(metrics.winRate),
        avgTradeSize,
      }
    }

    // Fallback: calculate from agentTrades if no metrics record exists
    const trades = await db.agentTrade.findMany({
      where: { agentUserId },
    })

    const tradesWithPnl = trades.filter((t) => t.pnl !== null)
    const avgTradeSize =
      tradesWithPnl.length > 0
        ? tradesWithPnl.reduce((sum, t) => sum + Number(t.amount), 0) /
          tradesWithPnl.length
        : 0

    return {
      lifetimePnL: Number(agent.lifetimePnL),
      totalTrades: tradesWithPnl.length,
      profitableTrades: tradesWithPnl.filter((t) => t.pnl && Number(t.pnl) > 0)
        .length,
      winRate:
        tradesWithPnl.length > 0
          ? tradesWithPnl.filter((t) => t.pnl && Number(t.pnl) > 0).length /
            tradesWithPnl.length
          : 0,
      avgTradeSize,
    }
  }

  async getChatHistory(agentUserId: string, limit = 50) {
    return db.agentMessage.findMany({
      where: { agentUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async getLogs(
    agentUserId: string,
    filters?: { type?: string; level?: string; limit?: number },
  ) {
    // Build where clause dynamically
    const whereClause: Record<string, unknown> = { agentUserId }
    if (filters?.type) whereClause.type = filters.type
    if (filters?.level) whereClause.level = filters.level

    return db.agentLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    })
  }

  async createLog(
    agentUserId: string,
    log: {
      type:
        | 'chat'
        | 'tick'
        | 'trade'
        | 'error'
        | 'system'
        | 'post'
        | 'comment'
        | 'dm'
      level: 'info' | 'warn' | 'error' | 'debug'
      message: string
      prompt?: string
      completion?: string
      thinking?: string
      metadata?: Record<string, JsonValue>
    },
  ) {
    return db.agentLog.create({
      data: {
        id: await generateSnowflakeId(),
        agentUserId,
        type: log.type,
        level: log.level,
        message: log.message,
        prompt: toNull(log.prompt),
        completion: toNull(log.completion),
        thinking: toNull(log.thinking),
        metadata: log.metadata ? JSON.stringify(log.metadata) : null,
      },
    })
  }

  private shouldAutoSetupAgentIdentity(): boolean {
    if (process.env.AUTO_CREATE_AGENT_WALLETS === 'false') {
      return false
    }

    // Require OAuth3 credentials outside development so we do not spam errors
    const hasOAuth3Config = Boolean(
      process.env.JEJU_OAUTH3_SERVICE_URL && process.env.BABYLON_OAUTH3_APP_ID,
    )

    if (!hasOAuth3Config && process.env.NODE_ENV !== 'development') {
      logger.warn(
        'Skipping automatic agent identity setup - OAuth3 credentials missing',
        undefined,
        'AgentService',
      )
      return false
    }

    return true
  }

  private async setupAgentIdentity(agentUserId: string): Promise<void> {
    const skipAgent0Registration = process.env.AGENT0_ENABLED !== 'true'

    const agent = await agentIdentityService.setupAgentIdentity(agentUserId, {
      skipAgent0Registration,
    })

    logger.info(
      'Agent identity setup complete',
      {
        agentUserId,
        walletProvisioned: Boolean(agent.walletAddress),
        agent0TokenId: agent.agent0TokenId,
        skippedAgent0: skipAgent0Registration,
      },
      'AgentService',
    )
  }
}

export const agentService = new AgentServiceV2()
