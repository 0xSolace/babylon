/**
 * Agent0 Reputation Synchronization Service
 *
 * Integrates local reputation system with Agent0 network's on-chain reputation (ERC-8004).
 * Provides bidirectional sync between local database and blockchain.
 */

import { db } from '@babylon/db'
import { getReputationBreakdown, recalculateReputation } from '@babylon/engine'
import { generateSnowflakeId } from '@babylon/shared'
import { logger } from '../../shared/logger'
import { getAgent0Client } from '../Agent0Client'

/**
 * Functions that need to be provided by the consuming application
 * These handle blockchain-specific operations that depend on web3 ABIs
 */
export interface BlockchainReputationFunctions {
  getOnChainReputation(tokenId: number): Promise<{
    totalBets: bigint
    winningBets: bigint
    totalVolume: bigint
    profitLoss: bigint
    accuracyScore: bigint
    trustScore: bigint
    isBanned: boolean
  } | null>
  syncOnChainReputation(userId: string, tokenId: number): Promise<unknown>
}

// Default implementation that throws - must be provided by consuming app
let blockchainReputationFunctions: BlockchainReputationFunctions | null = null

/**
 * Set blockchain reputation functions (must be called by consuming application)
 */
export function setBlockchainReputationFunctions(
  functions: BlockchainReputationFunctions,
): void {
  blockchainReputationFunctions = functions
}

/**
 * Get blockchain reputation functions
 */
function getBlockchainReputationFunctions(): BlockchainReputationFunctions {
  if (!blockchainReputationFunctions) {
    throw new Error(
      'Blockchain reputation functions not set. Call setBlockchainReputationFunctions() first.',
    )
  }
  return blockchainReputationFunctions
}

/**
 * Sync Agent0 on-chain reputation to local database after registration
 *
 * Called automatically after successful Agent0 registration to initialize
 * local reputation metrics with on-chain data.
 *
 * @param userId - User ID
 * @param agent0TokenId - Agent0 network token ID
 * @returns Updated performance metrics
 */
export async function syncAfterAgent0Registration(
  userId: string,
  agent0TokenId: number,
) {
  logger.info('Syncing reputation after Agent0 registration', {
    userId,
    agent0TokenId,
  })

  const { getOnChainReputation, syncOnChainReputation } =
    getBlockchainReputationFunctions()

  // Get on-chain reputation data
  const onChainRep = await getOnChainReputation(agent0TokenId)

  if (!onChainRep) {
    logger.warn('No on-chain reputation data found', { agent0TokenId })
    // Initialize with default metrics using upsert pattern
    const existing = await db.agentPerformanceMetrics.findUnique({
      where: { userId },
    })

    if (existing) {
      return await db.agentPerformanceMetrics.update({
        where: { userId },
        data: {
          onChainReputationSync: true,
          lastSyncedAt: new Date(),
        },
      })
    }
    return await db.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        onChainReputationSync: true,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  // Get or create performance metrics
  let metrics = await db.agentPerformanceMetrics.findUnique({
    where: { userId },
  })

  if (!metrics) {
    metrics = await db.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        updatedAt: new Date(),
      },
    })
  }

  // Sync on-chain data to local database
  const updated = await syncOnChainReputation(userId, agent0TokenId)

  // Recalculate local reputation with synced data
  await recalculateReputation(userId)

  logger.info('Agent0 reputation sync completed', {
    userId,
    agent0TokenId,
    trustScore: onChainRep.trustScore.toString(),
    accuracyScore: onChainRep.accuracyScore.toString(),
  })

  return updated
}

/**
 * Submit local feedback to Agent0 network
 *
 * When users rate agents locally, optionally propagate feedback to Agent0's
 * on-chain reputation system for network-wide visibility.
 *
 * @param feedbackId - Local feedback record ID
 * @returns Agent0 submission result
 */
export async function submitFeedbackToAgent0(feedbackId: string) {
  // Get feedback record with agent info
  const feedback = await db.feedback.findUnique({
    where: { id: feedbackId },
    select: {
      id: true,
      score: true,
      comment: true,
      metadata: true,
      toUserId: true,
    },
  })

  if (!feedback) {
    throw new Error(`Feedback ${feedbackId} not found`)
  }

  if (!feedback.toUserId) {
    throw new Error('Feedback has no recipient user')
  }

  // Get recipient user info
  const recipientUser = await db.user.findUnique({
    where: { id: String(feedback.toUserId) },
    select: {
      id: true,
      agent0TokenId: true,
      nftTokenId: true,
    },
  })

  if (!recipientUser) {
    throw new Error('Feedback has no recipient user')
  }

  const agent0TokenId = recipientUser.agent0TokenId
    ? Number(recipientUser.agent0TokenId)
    : null

  if (!agent0TokenId) {
    logger.warn('Agent has no Agent0 token ID, skipping submission', {
      feedbackId,
      userId: recipientUser.id,
    })
    return null
  }

  // Get Agent0 client
  const agent0Client = getAgent0Client()

  // Convert 0-100 score to -5 to +5 scale for Agent0
  // 0-100 → -5 to +5 (0 = -5, 50 = 0, 100 = +5)
  const feedbackScore = Number(feedback.score)
  const agent0Rating = Math.round((feedbackScore / 100) * 10 - 5)

  // Submit to Agent0 network
  await agent0Client.submitFeedback({
    targetAgentId: agent0TokenId,
    rating: agent0Rating,
    comment: feedback.comment
      ? String(feedback.comment)
      : 'Feedback from Babylon platform',
    transactionId: String(feedback.id),
  })

  // Update feedback record to mark as submitted to Agent0
  const existingMetadata =
    typeof feedback.metadata === 'object' && feedback.metadata !== null
      ? (feedback.metadata as Record<string, unknown>)
      : {}

  await db.feedback.update({
    where: { id: feedbackId },
    data: {
      agent0TokenId: String(agent0TokenId),
      metadata: {
        ...existingMetadata,
        agent0Submitted: true,
        agent0SubmittedAt: new Date().toISOString(),
      },
    },
  })

  logger.info('Feedback submitted to Agent0', {
    feedbackId,
    agent0TokenId,
    score: feedbackScore,
    agent0Rating,
  })

  return {
    agent0TokenId,
    agent0Rating,
    submitted: true,
  }
}

/**
 * Periodic sync of on-chain reputation to local database
 *
 * Should be called periodically (e.g., daily cron job) to keep local
 * reputation metrics in sync with blockchain state.
 *
 * @param userId - Optional user ID to sync (if not provided, syncs all agents)
 * @returns Sync results
 */
export async function periodicReputationSync(userId?: string) {
  logger.info('Starting periodic reputation sync', { userId })

  const { syncOnChainReputation } = getBlockchainReputationFunctions()

  // Get users with Agent0 registration
  const usersResult = userId
    ? await db.user.findMany({
        where: { id: userId, agent0TokenId: { not: null } },
        select: { id: true, agent0TokenId: true, nftTokenId: true },
      })
    : await db.user.findMany({
        where: { agent0TokenId: { not: null } },
        select: { id: true, agent0TokenId: true, nftTokenId: true },
      })

  logger.info(`Found ${usersResult.length} agents to sync`, { userId })

  // Get performance metrics for these users
  const userIds = usersResult.map((u) => String(u.id))
  const metricsResults =
    userIds.length > 0 ? await db.agentPerformanceMetrics.findMany({}) : []

  const metricsMap = new Map(
    metricsResults.map((m) => [
      String(m.userId),
      { lastSyncedAt: m.lastSyncedAt },
    ]),
  )

  const results: Array<{
    userId: string
    agent0TokenId: number
    success: boolean
    syncedAt: Date
  }> = []

  for (const user of usersResult) {
    if (!user.agent0TokenId) continue

    const userIdStr = String(user.id)
    const agent0TokenIdNum = Number(user.agent0TokenId)

    // Skip if synced recently (within last hour)
    const metrics = metricsMap.get(userIdStr)
    const lastSync = metrics?.lastSyncedAt
    const lastSyncDate = lastSync
      ? lastSync instanceof Date
        ? lastSync
        : new Date(String(lastSync))
      : null
    if (lastSyncDate && Date.now() - lastSyncDate.getTime() < 3600000) {
      logger.debug('Skipping recently synced user', {
        userId: userIdStr,
        lastSync: lastSyncDate,
      })
      continue
    }

    // Sync on-chain reputation
    await syncOnChainReputation(userIdStr, agent0TokenIdNum)

    // Recalculate local reputation
    await recalculateReputation(userIdStr)

    results.push({
      userId: userIdStr,
      agent0TokenId: agent0TokenIdNum,
      success: true,
      syncedAt: new Date(),
    })

    logger.info('User reputation synced', {
      userId: userIdStr,
      agent0TokenId: agent0TokenIdNum,
    })
  }

  logger.info('Periodic reputation sync completed', {
    total: usersResult.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  })

  return {
    total: usersResult.length,
    results,
  }
}

/**
 * Enhance Agent0 registration metadata with reputation data
 *
 * Includes current reputation score and trust level in Agent0 metadata
 * when registering or updating agent profile.
 *
 * @param userId - User ID
 * @returns Enhanced metadata object
 */
export async function getReputationForAgent0Metadata(userId: string) {
  // Get reputation breakdown
  const reputation = await getReputationBreakdown(userId)

  if (!reputation) {
    return {
      reputation: {
        score: 50,
        trustLevel: 'UNRATED',
        confidence: 0,
        gamesPlayed: 0,
        winRate: 0,
      },
    }
  }

  return {
    reputation: {
      score: Math.round(reputation.reputationScore),
      trustLevel: reputation.trustLevel,
      confidence: Math.round(reputation.confidenceScore * 100) / 100,
      gamesPlayed: reputation.metrics.gamesPlayed,
      winRate: Math.round(reputation.metrics.winRate * 100) / 100,
      normalizedPnL: Math.round(reputation.metrics.normalizedPnL * 100) / 100,
      averageFeedbackScore: Math.round(reputation.metrics.averageFeedbackScore),
      totalFeedback: reputation.metrics.totalFeedbackCount,
    },
  }
}

/**
 * Sync specific user's reputation on demand
 *
 * Useful for immediate sync after important events (e.g., game completion, large trade).
 *
 * @param userId - User ID
 * @returns Updated metrics
 */
export async function syncUserReputationNow(userId: string) {
  const { syncOnChainReputation } = getBlockchainReputationFunctions()

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { agent0TokenId: true, nftTokenId: true },
  })

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  if (!user.agent0TokenId) {
    throw new Error(`User ${userId} has no Agent0 token ID`)
  }

  const agent0TokenIdNum = Number(user.agent0TokenId)

  // Sync on-chain reputation
  const metrics = await syncOnChainReputation(userId, agent0TokenIdNum)

  // Recalculate local reputation
  await recalculateReputation(userId)

  logger.info('On-demand reputation sync completed', {
    userId,
    agent0TokenId: agent0TokenIdNum,
  })

  return metrics
}

// Reputation sync interval (3 hours in milliseconds)
const REPUTATION_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000

/**
 * Check if we should run periodic reputation sync
 * Uses the most recent lastSyncedAt timestamp from any user's performance metrics
 */
async function shouldSyncReputation(): Promise<boolean> {
  const lastSyncResult = await db.agentPerformanceMetrics.findMany({
    where: { lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: 'desc' },
    take: 1,
    select: { lastSyncedAt: true },
  })

  const lastSync = lastSyncResult[0]

  if (!lastSync || !lastSync.lastSyncedAt) {
    return true // Never synced before
  }

  const lastSyncDate =
    lastSync.lastSyncedAt instanceof Date
      ? lastSync.lastSyncedAt
      : new Date(String(lastSync.lastSyncedAt))

  const timeSinceLastSync = Date.now() - lastSyncDate.getTime()
  return timeSinceLastSync >= REPUTATION_SYNC_INTERVAL_MS
}

/**
 * Periodic reputation sync if needed (called from game tick)
 * Only syncs if it's been 3+ hours since the last sync
 *
 * @returns Object with synced status and optional results
 */
export async function periodicReputationSyncIfNeeded() {
  const shouldSync = await shouldSyncReputation()

  if (!shouldSync) {
    logger.debug('Reputation sync not needed yet', undefined, 'ReputationSync')
    return { synced: false }
  }

  logger.info(
    'Starting periodic reputation sync from game tick',
    undefined,
    'ReputationSync',
  )
  const results = await periodicReputationSync()

  logger.info(
    'Reputation sync completed',
    {
      total: results.total,
      successful: results.results.filter((r) => r.success).length,
      failed: results.results.filter((r) => !r.success).length,
    },
    'ReputationSync',
  )

  return {
    synced: true,
    total: results.total,
    successful: results.results.filter((r) => r.success).length,
    failed: results.results.filter((r) => !r.success).length,
  }
}
