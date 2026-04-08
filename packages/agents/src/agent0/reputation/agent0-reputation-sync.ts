/**
 * Agent0 Reputation Synchronization Service
 *
 * Integrates local reputation system with Agent0 network's on-chain reputation (ERC-8004).
 * Provides bidirectional sync between local database and blockchain.
 */

import {
  insertAgentPerformanceMetricsMinimalReturningFull,
  insertAgentPerformanceMetricsOnChainInitReturningFull,
  type JsonValue,
  selectAgentPerformanceMetricsFullRowByUserId,
  selectAgentPerformanceMetricsLastSyncedByUserIds,
  selectFeedbackForAgent0SubmitById,
  selectLatestPerformanceMetricsLastSyncedAt,
  selectUserAgent0RecipientSliceById,
  selectUserAgent0TokenSliceByUserId,
  selectUsersWithAgent0TokenForPeriodicSync,
  updateAgentPerformanceMetricsOnChainFlagsReturningFull,
  updateFeedbackAgent0SubmittedMetadata,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { getReputationBreakdown, recalculateReputation } from '@babylon/engine';
import { logger } from '../../shared/logger';
import { generateSnowflakeId } from '../../shared/snowflake';
import { getAgent0SDK } from '../sdk-instance';

/**
 * Functions that need to be provided by the consuming application
 * These handle blockchain-specific operations that depend on web3 ABIs
 */
export interface BlockchainReputationFunctions {
  getOnChainReputation(tokenId: number): Promise<{
    totalBets: bigint;
    winningBets: bigint;
    totalVolume: bigint;
    profitLoss: bigint;
    accuracyScore: bigint;
    trustScore: bigint;
    isBanned: boolean;
  } | null>;
  syncOnChainReputation(userId: string, tokenId: number): Promise<unknown>;
}

// Default implementation that throws - must be provided by consuming app
let blockchainReputationFunctions: BlockchainReputationFunctions | null = null;

/**
 * Set blockchain reputation functions (must be called by consuming application)
 */
export function setBlockchainReputationFunctions(
  functions: BlockchainReputationFunctions
): void {
  blockchainReputationFunctions = functions;
}

/**
 * Get blockchain reputation functions
 */
function getBlockchainReputationFunctions(): BlockchainReputationFunctions {
  if (!blockchainReputationFunctions) {
    throw new Error(
      'Blockchain reputation functions not set. Call setBlockchainReputationFunctions() first.'
    );
  }
  return blockchainReputationFunctions;
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
  agent0TokenId: number
) {
  logger.info('Syncing reputation after Agent0 registration', {
    userId,
    agent0TokenId,
  });

  const { getOnChainReputation, syncOnChainReputation } =
    getBlockchainReputationFunctions();

  const onChainRep = await getOnChainReputation(agent0TokenId);

  if (!onChainRep) {
    logger.warn('No on-chain reputation data found', { agent0TokenId });
    const existing = await selectAgentPerformanceMetricsFullRowByUserId(
      db,
      userId
    );

    if (existing) {
      const updated =
        await updateAgentPerformanceMetricsOnChainFlagsReturningFull(
          db,
          userId,
          {
            onChainReputationSync: true,
            lastSyncedAt: new Date(),
          }
        );
      return updated;
    }
    const created = await insertAgentPerformanceMetricsOnChainInitReturningFull(
      db,
      {
        id: await generateSnowflakeId(),
        userId,
        onChainReputationSync: true,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      }
    );
    return created;
  }

  let metrics = await selectAgentPerformanceMetricsFullRowByUserId(db, userId);

  if (!metrics) {
    const created = await insertAgentPerformanceMetricsMinimalReturningFull(
      db,
      {
        id: await generateSnowflakeId(),
        userId,
        updatedAt: new Date(),
      }
    );
    if (!created) {
      throw new Error('Failed to create AgentPerformanceMetrics row');
    }
    metrics = created;
  }

  const updated = await syncOnChainReputation(userId, agent0TokenId);

  await recalculateReputation(userId);

  logger.info('Agent0 reputation sync completed', {
    userId,
    agent0TokenId,
    trustScore: onChainRep.trustScore.toString(),
    accuracyScore: onChainRep.accuracyScore.toString(),
  });

  return updated;
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
  const feedback = await selectFeedbackForAgent0SubmitById(db, feedbackId);

  if (!feedback) {
    throw new Error(`Feedback ${feedbackId} not found`);
  }

  if (!feedback.toUserId) {
    throw new Error('Feedback has no recipient user');
  }

  const recipientUser = await selectUserAgent0RecipientSliceById(
    db,
    feedback.toUserId
  );

  if (!recipientUser) {
    throw new Error('Feedback has no recipient user');
  }

  const agent0TokenId = recipientUser.agent0TokenId;

  if (!agent0TokenId) {
    logger.warn('Agent has no Agent0 token ID, skipping submission', {
      feedbackId,
      userId: recipientUser.id,
    });
    return null;
  }

  const sdk = getAgent0SDK();

  const agent0Score = Math.round(feedback.score);

  const agentId = `1:${agent0TokenId}`; // Ethereum mainnet
  const feedbackFile = sdk.prepareFeedbackFile({
    text: feedback.comment || 'Feedback from Babylon platform',
    context: { transactionId: feedback.id },
  });

  await sdk.giveFeedback(
    agentId,
    agent0Score,
    'babylon-platform',
    undefined,
    undefined,
    feedbackFile
  );

  const mergedMetadata: JsonValue = {
    ...(typeof feedback.metadata === 'object' && feedback.metadata !== null
      ? (feedback.metadata as Record<string, JsonValue>)
      : {}),
    agent0Submitted: true,
    agent0SubmittedAt: new Date().toISOString(),
  };

  await updateFeedbackAgent0SubmittedMetadata(db, feedbackId, {
    agent0TokenId,
    metadata: mergedMetadata,
  });

  logger.info('Feedback submitted to Agent0', {
    feedbackId,
    agent0TokenId,
    score: feedback.score,
    agent0Score,
  });

  return {
    agent0TokenId,
    agent0Score,
    submitted: true,
  };
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
  logger.info('Starting periodic reputation sync', { userId });

  const { syncOnChainReputation } = getBlockchainReputationFunctions();

  const usersResult = await selectUsersWithAgent0TokenForPeriodicSync(
    db,
    userId
  );

  logger.info(`Found ${usersResult.length} agents to sync`, { userId });

  const userIds = usersResult.map((u) => u.id);
  const metricsResults = await selectAgentPerformanceMetricsLastSyncedByUserIds(
    db,
    userIds
  );

  const metricsMap = new Map(metricsResults.map((m) => [m.userId, m]));

  const results: Array<{
    userId: string;
    agent0TokenId: number;
    success: boolean;
    syncedAt: Date;
  }> = [];

  for (const user of usersResult) {
    if (!user.agent0TokenId) continue;

    const metrics = metricsMap.get(user.id);
    const lastSync = metrics?.lastSyncedAt;
    if (lastSync && Date.now() - lastSync.getTime() < 3600000) {
      logger.debug('Skipping recently synced user', {
        userId: user.id,
        lastSync,
      });
      continue;
    }

    await syncOnChainReputation(user.id, user.agent0TokenId);

    await recalculateReputation(user.id);

    results.push({
      userId: user.id,
      agent0TokenId: user.agent0TokenId,
      success: true,
      syncedAt: new Date(),
    });

    logger.info('User reputation synced', {
      userId: user.id,
      agent0TokenId: user.agent0TokenId,
    });
  }

  logger.info('Periodic reputation sync completed', {
    total: usersResult.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  });

  return {
    total: usersResult.length,
    results,
  };
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
  const reputation = await getReputationBreakdown(userId);

  if (!reputation) {
    return {
      reputation: {
        score: 50,
        trustLevel: 'UNRATED',
        confidence: 0,
        gamesPlayed: 0,
        winRate: 0,
      },
    };
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
  };
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
  const { syncOnChainReputation } = getBlockchainReputationFunctions();

  const user = await selectUserAgent0TokenSliceByUserId(db, userId);

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  if (!user.agent0TokenId) {
    throw new Error(`User ${userId} has no Agent0 token ID`);
  }

  const metrics = await syncOnChainReputation(userId, user.agent0TokenId);

  await recalculateReputation(userId);

  logger.info('On-demand reputation sync completed', {
    userId,
    agent0TokenId: user.agent0TokenId,
  });

  return metrics;
}

const REPUTATION_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000;

async function shouldSyncReputation(): Promise<boolean> {
  const lastSyncRow = await selectLatestPerformanceMetricsLastSyncedAt(db);

  if (!lastSyncRow?.lastSyncedAt) {
    return true;
  }

  const timeSinceLastSync = Date.now() - lastSyncRow.lastSyncedAt.getTime();
  return timeSinceLastSync >= REPUTATION_SYNC_INTERVAL_MS;
}

/**
 * Periodic reputation sync if needed (called from game tick)
 * Only syncs if it's been 3+ hours since the last sync
 *
 * @returns Object with synced status and optional results
 */
export async function periodicReputationSyncIfNeeded() {
  const shouldSync = await shouldSyncReputation();

  if (!shouldSync) {
    logger.debug('Reputation sync not needed yet', undefined, 'ReputationSync');
    return { synced: false };
  }

  logger.info(
    'Starting periodic reputation sync from game tick',
    undefined,
    'ReputationSync'
  );
  const results = await periodicReputationSync();

  logger.info(
    'Reputation sync completed',
    {
      total: results.total,
      successful: results.results.filter((r) => r.success).length,
      failed: results.results.filter((r) => !r.success).length,
    },
    'ReputationSync'
  );

  return {
    synced: true,
    total: results.total,
    successful: results.results.filter((r) => r.success).length,
    failed: results.results.filter((r) => !r.success).length,
  };
}
