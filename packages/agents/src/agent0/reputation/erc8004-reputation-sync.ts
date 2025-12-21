/**
 * ERC-8004 Reputation Sync Service
 *
 * Continuously syncs reputation scores to ERC-8004 via Agent0 SDK.
 */

import { db } from '@babylon/db';
import { recalculateReputation } from '@babylon/engine';
import { logger } from '@babylon/shared';
import { generateSnowflakeId } from '../../shared/snowflake';
import { getAgent0Client } from '../Agent0Client';
import { getCachedAgent0ReputationScore } from './agent0-reputation-cache';

interface ReputationSyncResult {
  userId: string;
  agent0TokenId: number | null;
  reputationScore: number;
  synced: boolean;
  error?: string;
  onChainSubmitted?: boolean;
  onChainError?: string;
}

interface BatchSyncResult {
  total: number;
  synced: number;
  failed: number;
  skipped: number;
  results: ReputationSyncResult[];
}

interface UserWithMetrics {
  id: string;
  agent0TokenId: number | null;
  username: string | null;
  displayName: string | null;
  isBanned: boolean;
  isScammer: boolean;
  isCSAM: boolean;
  createdAt: Date;
  AgentPerformanceMetrics: {
    updatedAt: Date;
    lastActivityAt: Date | null;
    reputationScore: number;
  } | null;
}

/**
 * Sync a single user's reputation to ERC-8004
 */
export async function syncUserReputationToERC8004(
  userId: string,
  forceRecalculate = false
): Promise<ReputationSyncResult> {
  // Get user data
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      agent0TokenId: true,
      username: true,
      displayName: true,
      isBanned: true,
      isScammer: true,
      isCSAM: true,
      createdAt: true,
      walletAddress: true,
    },
  });

  if (!user) {
    return {
      userId,
      agent0TokenId: null,
      reputationScore: 0,
      synced: false,
      error: 'User not found',
    };
  }

  const agent0TokenId = user.agent0TokenId ? Number(user.agent0TokenId) : null;

  if (!agent0TokenId) {
    return {
      userId,
      agent0TokenId: null,
      reputationScore: 0,
      synced: false,
      error: 'No Agent0 token ID',
    };
  }

  // Get performance metrics separately
  const metrics = await db.agentPerformanceMetrics.findUnique({
    where: { userId },
    select: {
      reputationScore: true,
      updatedAt: true,
      lastActivityAt: true,
    },
  });

  const userWithMetrics: UserWithMetrics = {
    id: String(user.id),
    agent0TokenId,
    username: user.username ? String(user.username) : null,
    displayName: user.displayName ? String(user.displayName) : null,
    isBanned: Boolean(user.isBanned),
    isScammer: Boolean(user.isScammer),
    isCSAM: Boolean(user.isCSAM),
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt
        : new Date(String(user.createdAt)),
    AgentPerformanceMetrics: metrics
      ? {
          reputationScore: Number(metrics.reputationScore),
          updatedAt:
            metrics.updatedAt instanceof Date
              ? metrics.updatedAt
              : new Date(String(metrics.updatedAt)),
          lastActivityAt: metrics.lastActivityAt
            ? metrics.lastActivityAt instanceof Date
              ? metrics.lastActivityAt
              : new Date(String(metrics.lastActivityAt))
            : null,
        }
      : null,
  };

  // Recalculate reputation if forced or if metrics are stale
  let reputationScore: number;
  if (forceRecalculate) {
    const recalcMetrics = await recalculateReputation(userId);
    reputationScore = recalcMetrics?.reputationScore
      ? Number(recalcMetrics.reputationScore)
      : 50;
  } else {
    reputationScore = await getCachedAgent0ReputationScore(userId);
  }

  // Convert to ERC-8004 feedback score (0-100)
  const feedbackScore = Math.round(Math.max(0, Math.min(100, reputationScore)));

  // Determine tags based on user status
  const tags: string[] = [];
  if (userWithMetrics.isBanned) {
    tags.push('banned');
  }
  if (userWithMetrics.isScammer) {
    tags.push('scammer');
  }
  if (userWithMetrics.isCSAM) {
    tags.push('csam');
  }
  if (
    !userWithMetrics.isBanned &&
    !userWithMetrics.isScammer &&
    !userWithMetrics.isCSAM
  ) {
    tags.push('active');
  }

  // Check if we should sync (avoid spamming on-chain)
  const lastSync = await getLastReputationSync(userId);
  const shouldSync = shouldSyncReputation(
    userWithMetrics,
    lastSync,
    forceRecalculate
  );

  if (!shouldSync) {
    return {
      userId,
      agent0TokenId: userWithMetrics.agent0TokenId,
      reputationScore,
      synced: false,
      error: 'Sync not needed (too recent)',
    };
  }

  logger.info(
    'Syncing reputation to ERC-8004',
    {
      userId,
      agent0TokenId: userWithMetrics.agent0TokenId,
      reputationScore,
      feedbackScore,
      tags,
    },
    'ERC8004ReputationSync'
  );

  // Update local metrics with latest reputation (upsert pattern)
  const existingMetrics = await db.agentPerformanceMetrics.findUnique({
    where: { userId },
  });

  if (existingMetrics) {
    await db.agentPerformanceMetrics.update({
      where: { userId },
      data: {
        reputationScore,
        updatedAt: new Date(),
      },
    });
  } else {
    await db.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        reputationScore,
        updatedAt: new Date(),
      },
    });
  }

  // Record sync timestamp
  await recordReputationSync(userId, feedbackScore, tags);

  // Attempt to submit feedback to ERC-8004 via Agent0 SDK
  let onChainSubmitted = false;
  let onChainError: string | undefined;

  // Check if Agent0 SDK is configured for feedback submission
  const feedbackPrivateKey =
    process.env.AGENT0_FEEDBACK_PRIVATE_KEY ||
    process.env.BABYLON_AGENT0_PRIVATE_KEY ||
    (process.env.AGENT0_NETWORK === 'localnet'
      ? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
      : undefined);

  if (!feedbackPrivateKey) {
    logger.debug(
      'Agent0 feedback private key not configured, skipping on-chain submission',
      {
        userId,
        agent0TokenId,
      },
      'ERC8004ReputationSync'
    );
    onChainError = 'Feedback private key not configured';
  } else {
    const walletAddress = user.walletAddress
      ? String(user.walletAddress)
      : null;

    if (!walletAddress) {
      logger.debug(
        'Agent has no wallet address, skipping on-chain submission',
        {
          userId,
          agent0TokenId,
        },
        'ERC8004ReputationSync'
      );
      onChainError = 'Agent has no wallet address';
    } else {
      const agent0Client = getAgent0Client();

      // Verify client is available and not in read-only mode
      const isAvailable = await agent0Client.ensureAvailable();
      if (!isAvailable) {
        onChainError = 'Agent0Client not available or in read-only mode';
        logger.debug(
          'Agent0Client not available for feedback submission',
          {
            userId,
            agent0TokenId,
          },
          'ERC8004ReputationSync'
        );
      } else {
        // Submit feedback via Agent0 SDK
        const rating = Math.round((feedbackScore / 100) * 10 - 5);

        await agent0Client.submitFeedback({
          targetAgentId: agent0TokenId,
          rating,
          comment: `System reputation update: ${feedbackScore}/100. Tags: ${tags.join(', ')}`,
          transactionId: `reputation-sync-${userId}-${Date.now()}`,
        });

        onChainSubmitted = true;
        logger.info(
          'Reputation synced to ERC-8004 on-chain',
          {
            userId,
            agent0TokenId: userWithMetrics.agent0TokenId,
            feedbackScore,
            rating,
            tags,
          },
          'ERC8004ReputationSync'
        );
      }
    }
  }

  return {
    userId,
    agent0TokenId: userWithMetrics.agent0TokenId,
    reputationScore,
    synced: true,
    onChainSubmitted,
    onChainError,
  };
}

/**
 * Batch sync reputation for multiple users
 */
export async function batchSyncReputationsToERC8004(
  options: {
    limit?: number;
    offset?: number;
    forceRecalculate?: boolean;
    prioritizeNew?: boolean;
  } = {}
): Promise<BatchSyncResult> {
  const {
    limit = 100,
    offset = 0,
    forceRecalculate = false,
    prioritizeNew = true,
  } = options;

  // Query users with Agent0 token IDs
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const whereCondition = prioritizeNew
    ? { agent0TokenId: { not: null }, createdAt: { gte: sevenDaysAgo } }
    : { agent0TokenId: { not: null } };

  const usersResult = await db.user.findMany({
    where: whereCondition,
    select: {
      id: true,
      agent0TokenId: true,
      createdAt: true,
    },
    orderBy: prioritizeNew ? { createdAt: 'desc' } : { createdAt: 'asc' },
    take: limit,
    skip: offset,
  });

  logger.info(
    `Batch syncing ${usersResult.length} user reputations`,
    {
      limit,
      offset,
      prioritizeNew,
    },
    'ERC8004ReputationSync'
  );

  const results: ReputationSyncResult[] = [];
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const u of usersResult) {
    const result = await syncUserReputationToERC8004(
      String(u.id),
      forceRecalculate
    );
    results.push(result);

    if (result.synced) {
      synced++;
    } else if (result.error?.includes('not needed')) {
      skipped++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    total: usersResult.length,
    synced,
    failed,
    skipped,
    results,
  };
}

/**
 * Determine if reputation should be synced based on last sync time
 */
function shouldSyncReputation(
  user: UserWithMetrics,
  lastSync: Date | null,
  forceRecalculate: boolean
): boolean {
  if (forceRecalculate) {
    return true;
  }

  if (!lastSync) {
    return true; // Never synced
  }

  const now = Date.now();
  const lastSyncTime = lastSync.getTime();
  const accountAge = now - user.createdAt.getTime();
  const daysSinceSync = (now - lastSyncTime) / (24 * 60 * 60 * 1000);

  // New accounts (< 7 days): Sync daily
  if (accountAge < 7 * 24 * 60 * 60 * 1000) {
    return daysSinceSync >= 1;
  }

  // Active accounts: Sync weekly
  const lastActivity = user.AgentPerformanceMetrics?.lastActivityAt;
  if (lastActivity) {
    const daysSinceActivity =
      (now - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceActivity < 7) {
      return daysSinceSync >= 7; // Weekly for active users
    }
  }

  // Inactive accounts: Sync monthly
  return daysSinceSync >= 30;
}

/**
 * Get last reputation sync timestamp for a user
 */
async function getLastReputationSync(userId: string): Promise<Date | null> {
  const syncResult = await db.gameConfig.findMany({
    where: { key: `reputation_sync_${userId}` },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { createdAt: true },
  });

  if (!syncResult[0]?.createdAt) {
    return null;
  }

  const createdAt = syncResult[0].createdAt;
  return createdAt instanceof Date ? createdAt : new Date(String(createdAt));
}

/**
 * Record reputation sync timestamp
 */
async function recordReputationSync(
  userId: string,
  score: number,
  tags: string[]
): Promise<void> {
  const key = `reputation_sync_${userId}`;
  const value = {
    score,
    tags,
    syncedAt: new Date().toISOString(),
  };

  const existing = await db.gameConfig.findUnique({
    where: { key },
  });

  if (existing) {
    await db.gameConfig.update({
      where: { key },
      data: {
        value,
        updatedAt: new Date(),
      },
    });
  } else {
    await db.gameConfig.create({
      data: {
        id: await generateSnowflakeId(),
        key,
        value,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

/**
 * Sync all active user reputations
 */
export async function syncAllReputationsToERC8004(): Promise<BatchSyncResult> {
  logger.info(
    'Starting full reputation sync to ERC-8004',
    undefined,
    'ERC8004ReputationSync'
  );

  const batchSize = 50;
  let offset = 0;
  let totalSynced = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const allResults: ReputationSyncResult[] = [];

  while (true) {
    const batch = await batchSyncReputationsToERC8004({
      limit: batchSize,
      offset,
      prioritizeNew: offset === 0,
    });

    totalSynced += batch.synced;
    totalFailed += batch.failed;
    totalSkipped += batch.skipped;
    allResults.push(...batch.results);

    if (batch.total < batchSize) {
      break; // Last batch
    }

    offset += batchSize;
  }

  logger.info(
    'Completed full reputation sync',
    {
      total: allResults.length,
      synced: totalSynced,
      failed: totalFailed,
      skipped: totalSkipped,
    },
    'ERC8004ReputationSync'
  );

  return {
    total: allResults.length,
    synced: totalSynced,
    failed: totalFailed,
    skipped: totalSkipped,
    results: allResults,
  };
}
