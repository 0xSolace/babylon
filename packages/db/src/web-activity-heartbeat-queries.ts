/**
 * SQL for `apps/web` POST /api/activity/heartbeat (sessions + activity logs).
 */

import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type NewUserActivityLog,
  userActivityLogs,
} from './tables/user-activity-logs';
import { type NewUserSession, userSessions } from './tables/user-sessions';

type HeartbeatDb = DrizzleClient | Transaction;

export async function selectOpenUserSessionForBrowserSession(
  db: HeartbeatDb,
  userId: string,
  browserSessionId: string
): Promise<{ id: string; lastActiveAt: Date } | undefined> {
  const [row] = await db
    .select({
      id: userSessions.id,
      lastActiveAt: userSessions.lastActiveAt,
    })
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        eq(userSessions.sessionId, browserSessionId),
        isNull(userSessions.endedAt)
      )
    )
    .limit(1);
  return row;
}

export async function insertUserSessionRow(
  db: HeartbeatDb,
  row: NewUserSession
): Promise<void> {
  await db.insert(userSessions).values(row);
}

export async function updateUserSessionEndedAtById(
  db: HeartbeatDb,
  sessionRowId: string,
  endedAt: Date
): Promise<void> {
  await db
    .update(userSessions)
    .set({ endedAt })
    .where(eq(userSessions.id, sessionRowId));
}

export async function bumpUserSessionHeartbeatCounters(
  db: HeartbeatDb,
  sessionRowId: string,
  lastActiveAt: Date,
  pageViewsDelta: number
): Promise<void> {
  await db
    .update(userSessions)
    .set({
      lastActiveAt,
      pageCount: sql`${userSessions.pageCount} + ${pageViewsDelta}`,
      heartbeatCount: sql`${userSessions.heartbeatCount} + 1`,
    })
    .where(eq(userSessions.id, sessionRowId));
}

export async function insertUserActivityLogOnConflictDoNothing(
  db: HeartbeatDb,
  row: NewUserActivityLog
): Promise<void> {
  await db
    .insert(userActivityLogs)
    .values(row)
    .onConflictDoNothing({
      target: [
        userActivityLogs.userId,
        userActivityLogs.activityDate,
        userActivityLogs.activityType,
      ],
    });
}

/**
 * Marks stale open sessions as ended (`endedAt` = `lastActiveAt`).
 * Returns ids that were targeted (same as previous `findMany` shape for callers).
 */
export async function closeStaleOpenUserSessionsBefore(
  db: HeartbeatDb,
  threshold: Date
): Promise<{ id: string }[]> {
  const stale = await db
    .select({
      id: userSessions.id,
      lastActiveAt: userSessions.lastActiveAt,
    })
    .from(userSessions)
    .where(
      and(
        isNull(userSessions.endedAt),
        lt(userSessions.lastActiveAt, threshold)
      )
    );

  if (stale.length === 0) {
    return [];
  }

  const ids = stale.map((s) => s.id);

  await db
    .update(userSessions)
    .set({ endedAt: sql`${userSessions.lastActiveAt}` })
    .where(
      and(
        isNull(userSessions.endedAt),
        lt(userSessions.lastActiveAt, threshold),
        inArray(userSessions.id, ids)
      )
    );

  return stale.map((s) => ({ id: s.id }));
}
