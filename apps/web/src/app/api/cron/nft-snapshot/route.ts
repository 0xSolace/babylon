/**
 * NFT Snapshot Cron Job - DISABLED
 *
 * This cron job previously updated the NftSnapshot table dynamically
 * based on the live leaderboard. It has been disabled because:
 *
 * 1. ProtoMonkeys uses a static CSV snapshot (2025-12-31)
 * 2. Each user has a pre-assigned NFT that should not change
 * 3. Use scripts/seed-nft-snapshot-from-csv.ts to populate the snapshot
 *
 * This endpoint returns a no-op success response to prevent errors
 * if the cron job is still configured in Vercel.
 */

import {
  requireCronAuth,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const maxDuration = 10;

export const POST = withErrorHandling(async (request: NextRequest) => {
  requireCronAuth(request, { jobName: 'NftSnapshotCron' });

  logger.info(
    'NFT Snapshot cron job skipped - using static CSV snapshot',
    undefined,
    'NftSnapshotCron'
  );

  return successResponse({
    success: true,
    message: 'NFT snapshot cron is disabled. Using static CSV snapshot.',
    skipped: true,
  });
});
