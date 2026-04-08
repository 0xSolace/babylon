/**
 * Share action queries for user-facing routes (verified shares list, pending insert).
 */

import { and, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { type ShareAction, shareActions } from './tables/share-actions';

type WebUserShareDb = DrizzleClient | Transaction;

export type VerifiedEarnedShareActionRow = {
  id: string;
  platform: string;
  contentType: string;
  contentId: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
};

export async function selectVerifiedEarnedShareActionsByUserId(
  db: WebUserShareDb,
  userId: string,
  contentType: string | undefined
): Promise<VerifiedEarnedShareActionRow[]> {
  const base = and(
    eq(shareActions.userId, userId),
    eq(shareActions.verified, true),
    eq(shareActions.pointsAwarded, true)
  );
  const where =
    contentType !== undefined && contentType !== ''
      ? and(base, eq(shareActions.contentType, contentType))
      : base;

  return db
    .select({
      id: shareActions.id,
      platform: shareActions.platform,
      contentType: shareActions.contentType,
      contentId: shareActions.contentId,
      createdAt: shareActions.createdAt,
      verifiedAt: shareActions.verifiedAt,
    })
    .from(shareActions)
    .where(where)
    .orderBy(desc(shareActions.verifiedAt));
}

export type InsertPendingShareActionInput = {
  id: string;
  userId: string;
  platform: string;
  contentType: string;
  contentId?: string | null;
  url?: string | null;
};

export async function insertPendingShareActionReturning(
  db: WebUserShareDb,
  input: InsertPendingShareActionInput
): Promise<ShareAction[]> {
  return db
    .insert(shareActions)
    .values({
      id: input.id,
      userId: input.userId,
      platform: input.platform,
      contentType: input.contentType,
      contentId: input.contentId,
      url: input.url,
      pointsAwarded: false,
      verified: false,
    })
    .returning();
}
