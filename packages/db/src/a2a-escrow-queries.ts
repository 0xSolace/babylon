/**
 * Moderation escrow SQL for A2A escrow handlers.
 */

import { and, eq, lt, type SQL, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type ModerationEscrow,
  moderationEscrows,
  type NewModerationEscrow,
} from './tables/moderation-escrows';
import { users } from './tables/user';

type EscrowDb = DrizzleClient | Transaction;

export type ModerationEscrowAdminListParams = {
  recipientId?: string;
  adminId?: string;
  status?: string;
  limit: number;
  offset: number;
};

/** Relational `with` shape from `listModerationEscrowsAdminPage` (not inferable from DrizzleClient). */
export type ModerationEscrowAdminListRow = ModerationEscrow & {
  recipient: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
  } | null;
  admin: {
    id: string;
    username: string | null;
    displayName: string | null;
  } | null;
  refundedByUser: {
    id: string;
    username: string | null;
    displayName: string | null;
  } | null;
};

export async function insertModerationEscrowReturning(
  db: EscrowDb,
  row: NewModerationEscrow
): Promise<ModerationEscrow | undefined> {
  const [created] = await db.insert(moderationEscrows).values(row).returning();
  return created;
}

export async function expireStalePendingModerationEscrows(
  db: EscrowDb,
  now: Date
): Promise<void> {
  await db
    .update(moderationEscrows)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        eq(moderationEscrows.status, 'pending'),
        lt(moderationEscrows.expiresAt, now)
      )
    );
}

function buildModerationEscrowAdminFilters(
  params: ModerationEscrowAdminListParams
): SQL | undefined {
  const conditions: SQL[] = [];
  if (params.recipientId) {
    conditions.push(eq(moderationEscrows.recipientId, params.recipientId));
  }
  if (params.adminId) {
    conditions.push(eq(moderationEscrows.adminId, params.adminId));
  }
  if (params.status) {
    conditions.push(eq(moderationEscrows.status, params.status));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listModerationEscrowsAdminPage(
  db: EscrowDb,
  params: ModerationEscrowAdminListParams
): Promise<{ rows: ModerationEscrowAdminListRow[]; total: number }> {
  const whereClause = buildModerationEscrowAdminFilters(params);

  const hasFilters = Boolean(
    params.recipientId || params.adminId || params.status
  );

  const [rows, totalRows] = await Promise.all([
    db.query.moderationEscrows.findMany({
      where: hasFilters
        ? (table, { eq: eqFn, and: andFn }) => {
            const c: SQL[] = [];
            if (params.recipientId) {
              c.push(eqFn(table.recipientId, params.recipientId));
            }
            if (params.adminId) {
              c.push(eqFn(table.adminId, params.adminId));
            }
            if (params.status) {
              c.push(eqFn(table.status, params.status));
            }
            return c.length > 0 ? andFn(...c) : undefined;
          }
        : undefined,
      orderBy: (table, { desc: descFn }) => [descFn(table.createdAt)],
      limit: params.limit,
      offset: params.offset,
      with: {
        recipient: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
        admin: {
          columns: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        refundedByUser: {
          columns: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    }),
    whereClause
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(moderationEscrows)
          .where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(moderationEscrows),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return { rows: rows as ModerationEscrowAdminListRow[], total };
}

export async function updateUserAppealStakeFromEscrow(
  db: EscrowDb,
  userId: string,
  data: {
    appealCount: number;
    appealStakeAmount: string;
    appealStakeTxHash: string;
  }
): Promise<void> {
  await db
    .update(users)
    .set({
      appealCount: data.appealCount,
      appealStaked: true,
      appealStakeAmount: data.appealStakeAmount,
      appealStakeTxHash: data.appealStakeTxHash,
      appealStatus: 'lenient_review',
      appealSubmittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
