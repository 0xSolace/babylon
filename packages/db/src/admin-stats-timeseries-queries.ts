/**
 * SQL for GET /api/admin/stats/timeseries (system metrics snapshots in a range).
 */

import { and, eq, gte, lte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type SystemMetricsSnapshot,
  systemMetricsSnapshots,
} from './tables/system-metrics-snapshots';

type AdminStatsDb = DrizzleClient | Transaction;

export async function selectSystemMetricsSnapshotsForAdminTimeseries(
  db: AdminStatsDb,
  params: {
    environment: string;
    startDate: Date;
    endDate: Date;
  }
): Promise<SystemMetricsSnapshot[]> {
  const { environment, startDate, endDate } = params;
  return db
    .select()
    .from(systemMetricsSnapshots)
    .where(
      and(
        eq(systemMetricsSnapshots.environment, environment),
        gte(systemMetricsSnapshots.timestamp, startDate),
        lte(systemMetricsSnapshots.timestamp, endDate)
      )
    )
    .orderBy(systemMetricsSnapshots.timestamp);
}
