/**
 * ERC-8004 Reputation Sync Service
 *
 * Continuously syncs reputation scores to ERC-8004 via Agent0 SDK.
 *
 * Based on ERC-8004 spec (https://eips.ethereum.org/EIPS/eip-8004):
 * - Publishes reputation as feedback signals on-chain
 * - Uses pre-authorization (feedbackAuth) for feedback submission
 * - Supports tags for filtering and composability
 * - Optional off-chain file for detailed reputation data
 *
 * Inspired by Neynar Scores approach:
 * - Weekly recalculation for most users
 * - More frequent updates for new accounts
 * - Continuous reputation tracking
 */

import {
  insertAgentPerformanceMetricsReputationRow,
  insertGameConfigRow,
  type JsonValue,
  selectAgentPerformanceMetricsFullRowByUserId,
  selectAgentPerformanceMetricsReputationActivitySliceByUserId,
  selectGameConfigCreatedAtByKeyOrderDesc,
  selectGameConfigRowByKey,
  selectUserErc8004ReputationUserSliceById,
  selectUsersForBatchErc8004ReputationSync,
  selectUserWalletAddressById,
  updateAgentPerformanceMetricsReputationScoreByUserId,
  updateGameConfigValueByKey,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { recalculateReputation } from '@babylon/engine';
import { logger } from '@babylon/shared';
import { generateSnowflakeId } from '../../shared/snowflake';
import { getAgent0SDK } from '../sdk-instance';
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

/**
 * Sync a single user's reputation to ERC-8004
 *
 * This publishes the reputation score as a feedback signal on-chain via Agent0 SDK.
 * According to ERC-8004, feedback requires pre-authorization from the agent.
 *
 * For system-level reputation (not user-submitted feedback), we use a special
 * "system" client address that agents pre-authorize during registration.
 */
export async function syncUserReputationToERC8004(
  userId: string,
  forceRecalculate = false
): Promise<ReputationSyncResult> {
  const user = await selectUserErc8004ReputationUserSliceById(db, userId);

  if (!user) {
    return {
      userId,
      agent0TokenId: null,
      reputationScore: 0,
      synced: false,
      error: 'User not found',
    };
  }

  if (!user.agent0TokenId) {
    return {
      userId,
      agent0TokenId: null,
      reputationScore: 0,
      synced: false,
      error: 'No Agent0 token ID',
    };
  }

  const metricsRow =
    await selectAgentPerformanceMetricsReputationActivitySliceByUserId(
      db,
      userId
    );

  const userWithMetrics = {
    ...user,
    AgentPerformanceMetrics: metricsRow ?? null,
  };

  let reputationScore: number;
  if (forceRecalculate) {
    const metrics = await recalculateReputation(userId);
    reputationScore = metrics?.reputationScore ?? 50;
  } else {
    reputationScore = await getCachedAgent0ReputationScore(userId);
  }

  const feedbackScore = Math.round(Math.max(0, Math.min(100, reputationScore)));

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

  const existingMetrics = await selectAgentPerformanceMetricsFullRowByUserId(
    db,
    userId
  );

  const now = new Date();
  if (existingMetrics) {
    await updateAgentPerformanceMetricsReputationScoreByUserId(db, userId, {
      reputationScore,
      updatedAt: now,
    });
  } else {
    await insertAgentPerformanceMetricsReputationRow(db, {
      id: await generateSnowflakeId(),
      userId,
      reputationScore,
      updatedAt: now,
    });
  }

  await recordReputationSync(userId, feedbackScore, tags);

  let onChainSubmitted = false;
  let onChainError: string | undefined;

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
        agent0TokenId: user.agent0TokenId,
      },
      'ERC8004ReputationSync'
    );
    onChainError = 'Feedback private key not configured';
  } else {
    const agentUser = await selectUserWalletAddressById(db, userId);

    if (!agentUser?.walletAddress) {
      logger.debug(
        'Agent has no wallet address, skipping on-chain submission',
        {
          userId,
          agent0TokenId: user.agent0TokenId,
        },
        'ERC8004ReputationSync'
      );
      onChainError = 'Agent has no wallet address';
    } else {
      const sdk = getAgent0SDK();

      if (sdk.isReadOnly) {
        onChainError = 'SDK is in read-only mode (no signer configured)';
        logger.debug(
          'SDK not available for feedback submission',
          {
            userId,
            agent0TokenId: user.agent0TokenId,
          },
          'ERC8004ReputationSync'
        );
      } else {
        const score = Math.round(feedbackScore);

        const agentId = `1:${userWithMetrics.agent0TokenId!}`;
        const feedbackFile = sdk.prepareFeedbackFile({
          text: `System reputation update: ${feedbackScore}/100. Tags: ${tags.join(', ')}`,
          context: { transactionId: `reputation-sync-${userId}-${Date.now()}` },
        });

        await sdk.giveFeedback(
          agentId,
          score,
          tags[0],
          tags[1],
          undefined,
          feedbackFile
        );

        onChainSubmitted = true;
        logger.info(
          'Reputation synced to ERC-8004 on-chain',
          {
            userId,
            agent0TokenId: userWithMetrics.agent0TokenId,
            feedbackScore,
            score,
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
 *
 * Processes users in batches to avoid overwhelming the system.
 * Prioritizes new accounts and recently active users.
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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const usersResult = await selectUsersForBatchErc8004ReputationSync(db, {
    prioritizeNew,
    sevenDaysAgo,
    limit,
    offset,
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

  for (const user of usersResult) {
    const result = await syncUserReputationToERC8004(user.id, forceRecalculate);
    results.push(result);

    if (result.synced) {
      synced++;
    } else if (result.error?.includes('not needed')) {
      skipped++;
    } else {
      failed++;
    }

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

function shouldSyncReputation(
  user: {
    createdAt: Date;
    AgentPerformanceMetrics: {
      updatedAt: Date;
      lastActivityAt: Date | null;
    } | null;
  },
  lastSync: Date | null,
  forceRecalculate: boolean
): boolean {
  if (forceRecalculate) {
    return true;
  }

  if (!lastSync) {
    return true;
  }

  const now = Date.now();
  const lastSyncTime = lastSync.getTime();
  const accountAge = now - user.createdAt.getTime();
  const daysSinceSync = (now - lastSyncTime) / (24 * 60 * 60 * 1000);

  if (accountAge < 7 * 24 * 60 * 60 * 1000) {
    return daysSinceSync >= 1;
  }

  const lastActivity = user.AgentPerformanceMetrics?.lastActivityAt;
  if (lastActivity) {
    const daysSinceActivity =
      (now - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceActivity < 7) {
      return daysSinceSync >= 7;
    }
  }

  return daysSinceSync >= 30;
}

async function getLastReputationSync(userId: string): Promise<Date | null> {
  const syncResult = await selectGameConfigCreatedAtByKeyOrderDesc(
    db,
    `reputation_sync_${userId}`
  );

  return syncResult?.createdAt ?? null;
}

async function recordReputationSync(
  userId: string,
  score: number,
  tags: string[]
): Promise<void> {
  const key = `reputation_sync_${userId}`;
  const value: JsonValue = {
    score,
    tags,
    syncedAt: new Date().toISOString(),
  };

  const existing = await selectGameConfigRowByKey(db, key);
  const now = new Date();

  if (existing) {
    await updateGameConfigValueByKey(db, key, {
      value,
      updatedAt: now,
    });
  } else {
    await insertGameConfigRow(db, {
      id: await generateSnowflakeId(),
      key,
      value,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Sync all active user reputations
 *
 * This is the main entry point for cron jobs.
 * Processes users in batches to stay within execution time limits.
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
      break;
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
