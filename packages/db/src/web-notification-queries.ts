/**
 * SQL for `apps/web` notification helpers (market resolution + digest).
 */

import { and, eq, gt, gte, isNotNull, lt, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { markets } from './tables/markets';
import { positions } from './tables/positions';
import { users } from './tables/user';

type WebNotifDb = DrizzleClient | Transaction;

export type ResolvedMarketPositionOutcomeRow = {
  holderId: string;
  managedBy: string | null;
  isAgent: boolean | null;
  agentName: string | null;
  marketId: string;
  marketName: string | null;
  pnl: string | null;
};

export async function selectResolvedMarketPositionOutcomesForMarketNotify(
  db: WebNotifDb,
  marketId: string
): Promise<ResolvedMarketPositionOutcomeRow[]> {
  return db
    .select({
      holderId: positions.userId,
      managedBy: users.managedBy,
      isAgent: users.isAgent,
      agentName: users.displayName,
      marketId: positions.marketId,
      marketName: markets.question,
      pnl: positions.pnl,
    })
    .from(positions)
    .innerJoin(markets, eq(markets.id, positions.marketId))
    .leftJoin(users, eq(users.id, positions.userId))
    .where(
      and(
        eq(positions.marketId, marketId),
        eq(positions.status, 'resolved'),
        isNotNull(positions.outcome),
        isNotNull(positions.pnl),
        isNotNull(positions.resolvedAt),
        gt(positions.shares, '0')
      )
    );
}

export type NotificationDigestCandidateDbRow = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  digestEnabled: boolean;
  digestFrequency: string | null;
  deliveryChannel: string | null;
  lastSentAt: Date | null;
};

export async function selectUsersWithNotificationDigestEnabled(
  db: WebNotifDb
): Promise<NotificationDigestCandidateDbRow[]> {
  return db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      digestEnabled: users.notificationDigestEnabled,
      digestFrequency: users.notificationDigestFrequency,
      deliveryChannel: users.notificationDigestDeliveryChannel,
      lastSentAt: users.notificationDigestLastSentAt,
    })
    .from(users)
    .where(eq(users.notificationDigestEnabled, true));
}

export async function selectDigestPositionOutcomesForUserWindow(
  db: WebNotifDb,
  params: {
    userId: string;
    windowStart: Date;
    now: Date;
  }
): Promise<ResolvedMarketPositionOutcomeRow[]> {
  return db
    .select({
      holderId: positions.userId,
      managedBy: users.managedBy,
      isAgent: users.isAgent,
      agentName: users.displayName,
      marketId: positions.marketId,
      marketName: markets.question,
      pnl: positions.pnl,
    })
    .from(positions)
    .innerJoin(markets, eq(markets.id, positions.marketId))
    .leftJoin(users, eq(users.id, positions.userId))
    .where(
      and(
        eq(positions.status, 'resolved'),
        isNotNull(positions.outcome),
        isNotNull(positions.pnl),
        isNotNull(positions.resolvedAt),
        gt(positions.shares, '0'),
        gte(positions.resolvedAt, params.windowStart),
        lt(positions.resolvedAt, params.now),
        or(
          eq(positions.userId, params.userId),
          eq(users.managedBy, params.userId)
        )
      )
    );
}

export async function updateUserNotificationDigestLastSentAt(
  db: WebNotifDb,
  userId: string,
  sentAt: Date
): Promise<void> {
  await db
    .update(users)
    .set({
      notificationDigestLastSentAt: sentAt,
      updatedAt: sentAt,
    })
    .where(eq(users.id, userId));
}
