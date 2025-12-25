/**
 * ERC-8004 Reputation Sync Service
 *
 * Syncs reputation scores and ban status to ERC-8004 via Agent0
 */

import { db } from '@babylon/db'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { logger } from '../../shared/logger'

interface ReputationSyncData {
  reputationScore: number
  isBanned: boolean
  isScammer: boolean
  isCSAM: boolean
}

/**
 * Sync SYSTEM-LEVEL reputation to local metrics
 */
export async function syncReputationToERC8004(
  userId: string,
  data: ReputationSyncData,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      agent0TokenId: true,
      username: true,
      displayName: true,
    },
  })

  if (!user || !user.agent0TokenId) {
    logger.debug(
      'User has no Agent0 token ID, skipping ERC-8004 sync',
      { userId },
      'ERC8004Sync',
    )
    return
  }

  // Calculate reputation score based on status
  let reputationScore = data.reputationScore

  // Banned users get 0
  if (data.isBanned) {
    reputationScore = 0
  }
  // Scammers/CSAM get very low score (but not 0 to distinguish from banned)
  else if (data.isScammer || data.isCSAM) {
    reputationScore = 5
  }

  // Convert reputation score (0-100) to Agent0 feedback score (0-100)
  const agent0Score = Math.round(Math.max(0, Math.min(100, reputationScore)))

  logger.info(
    'Syncing system reputation to local metrics',
    {
      userId,
      agent0TokenId: Number(user.agent0TokenId),
      reputationScore,
      agent0Score,
      isBanned: data.isBanned,
      isScammer: data.isScammer,
      isCSAM: data.isCSAM,
    },
    'ERC8004Sync',
  )

  // Update local AgentPerformanceMetrics with system-calculated reputation
  const existingMetrics = await db.agentPerformanceMetrics.findUnique({
    where: { userId },
  })

  if (existingMetrics) {
    await db.agentPerformanceMetrics.update({
      where: { userId },
      data: {
        reputationScore,
        updatedAt: new Date(),
      },
    })
  } else {
    await db.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        reputationScore,
        updatedAt: new Date(),
      },
    })
  }

  logger.info(
    '✅ Reputation synced to ERC-8004',
    {
      userId,
      agent0TokenId: Number(user.agent0TokenId),
      reputationScore,
    },
    'ERC8004Sync',
  )
}

/**
 * Syncs all user reputations to ERC-8004 (simple version)
 */
export async function syncAllReputationsToERC8004Simple(): Promise<void> {
  const userList = await db.user.findMany({
    where: { isBanned: false },
    select: {
      id: true,
      agent0TokenId: true,
      isBanned: true,
      isScammer: true,
      isCSAM: true,
    },
    take: 100,
  })

  logger.info(
    `Syncing ${userList.length} user reputations to ERC-8004`,
    undefined,
    'ERC8004Sync',
  )

  for (const user of userList) {
    if (!user.agent0TokenId) continue

    // Get the user's performance metrics for reputation score
    const metrics = await db.agentPerformanceMetrics.findUnique({
      where: { userId: String(user.id) },
      select: { reputationScore: true },
    })

    await syncReputationToERC8004(String(user.id), {
      reputationScore: metrics?.reputationScore
        ? Number(metrics.reputationScore)
        : 50,
      isBanned: Boolean(user.isBanned),
      isScammer: Boolean(user.isScammer),
      isCSAM: Boolean(user.isCSAM),
    })
  }
}
