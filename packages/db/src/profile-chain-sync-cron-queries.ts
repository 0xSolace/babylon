/**
 * SQL for POST /api/cron/profile-chain-sync (on-chain profile sync metrics).
 */

import { and, count, eq, isNotNull } from 'drizzle-orm';
import { asSystem } from './db';
import { users } from './tables/user';

export type ProfileChainSyncCronMetrics = {
  totalOnChainUsers: number;
  pendingSyncCount: number;
  syncErrorCount: number;
};

export async function selectProfileChainSyncCronMetrics(): Promise<ProfileChainSyncCronMetrics> {
  return asSystem(async (db) => {
    const [totalOnChainResult] = await db
      .select({ c: count() })
      .from(users)
      .where(eq(users.onChainRegistered, true));

    const [pendingSyncResult] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.onChainRegistered, true),
          eq(users.profileChainSyncNeeded, true)
        )
      );

    const [syncErrorResult] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.onChainRegistered, true),
          eq(users.profileChainSyncNeeded, true),
          isNotNull(users.profileChainSyncError)
        )
      );

    return {
      totalOnChainUsers: Number(totalOnChainResult?.c ?? 0),
      pendingSyncCount: Number(pendingSyncResult?.c ?? 0),
      syncErrorCount: Number(syncErrorResult?.c ?? 0),
    };
  }, 'cron-profile-chain-sync-counts');
}
