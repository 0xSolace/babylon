/**
 * Notification creation / dedupe reads for `notification-service`.
 */

import type { NotificationData } from '@babylon/shared';
import { and, count, desc, eq, gt, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { Notification as NotificationRow } from './tables/notifications';
import { notifications } from './tables/notifications';
import { users } from './tables/user';

type NotifyDb = DrizzleClient | Transaction;

export async function selectUserDisplayForNotification(
  db: NotifyDb,
  userId: string
): Promise<
  { displayName: string | null; username: string | null } | undefined
> {
  const [row] = await db
    .select({
      displayName: users.displayName,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type NotificationRecipientEmailPrefsRow = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  emailNotificationsEnabled: boolean;
  emailNotificationsRealtime: boolean;
  emailNotificationsDailySummary: boolean;
  emailNotificationsWeeklySummary: boolean;
  emailNotificationsMonthlySummary: boolean;
};

export async function selectNotificationRecipientEmailPrefs(
  db: NotifyDb,
  userId: string
): Promise<NotificationRecipientEmailPrefsRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      emailNotificationsEnabled: users.emailNotificationsEnabled,
      emailNotificationsRealtime: users.emailNotificationsRealtime,
      emailNotificationsDailySummary: users.emailNotificationsDailySummary,
      emailNotificationsWeeklySummary: users.emailNotificationsWeeklySummary,
      emailNotificationsMonthlySummary: users.emailNotificationsMonthlySummary,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectRecentDuplicateNotificationId(
  db: NotifyDb,
  params: {
    userId: string;
    type: string;
    actorId: string;
    cutoffTime: Date;
    postId?: string;
    commentId?: string;
  }
): Promise<string | undefined> {
  const conditions = [
    eq(notifications.userId, params.userId),
    eq(notifications.type, params.type),
    eq(notifications.actorId, params.actorId),
    gt(notifications.createdAt, params.cutoffTime),
  ];
  if (params.postId) {
    conditions.push(eq(notifications.postId, params.postId));
  }
  if (params.commentId) {
    conditions.push(eq(notifications.commentId, params.commentId));
  }

  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  return existing?.id;
}

export async function selectNotificationsListForUser(
  db: NotifyDb,
  params: {
    userId: string;
    unreadOnly: boolean;
    type?: string;
    fetchLimit: number;
  }
): Promise<NotificationRow[]> {
  const conditions = [eq(notifications.userId, params.userId)];
  if (params.unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }
  if (params.type) {
    conditions.push(eq(notifications.type, params.type));
  }
  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(params.fetchLimit);
}

export async function countUnreadNotificationsForUser(
  db: NotifyDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false))
    );
  return Number(row?.c ?? 0);
}

export async function markAllUnreadNotificationsReadForUser(
  db: NotifyDb,
  userId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false))
    );
}

export async function markUnreadNotificationsReadByTypeForUser(
  db: NotifyDb,
  userId: string,
  notificationType: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, notificationType),
        eq(notifications.read, false)
      )
    );
}

export async function markNotificationsReadByIdsForUser(
  db: NotifyDb,
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        inArray(notifications.id, notificationIds),
        eq(notifications.userId, userId)
      )
    );
}

export async function deleteAllNotificationsForUser(
  db: NotifyDb,
  userId: string
): Promise<void> {
  await db.delete(notifications).where(eq(notifications.userId, userId));
}

export async function deleteNotificationsByIdsForUser(
  db: NotifyDb,
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;
  await db
    .delete(notifications)
    .where(
      and(
        inArray(notifications.id, notificationIds),
        eq(notifications.userId, userId)
      )
    );
}

export type NotificationInsertRow = {
  id: string;
  userId: string;
  dedupeKey?: string | null;
  type: string;
  actorId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  chatId?: string | null;
  groupId?: string | null;
  inviteId?: string | null;
  title: string;
  message: string;
  data?: NotificationData | null;
};

export async function insertNotificationRow(
  db: NotifyDb,
  values: NotificationInsertRow
): Promise<void> {
  await db.insert(notifications).values(values);
}

/** Returns inserted id, or undefined if conflict on dedupeKey. */
export async function insertNotificationRowOnDedupeKey(
  db: NotifyDb,
  values: NotificationInsertRow
): Promise<string | undefined> {
  const inserted = await db
    .insert(notifications)
    .values(values)
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id });
  return inserted[0]?.id;
}
