/**
 * Virtual balance reads/writes for `WalletService`.
 *
 * **Why here:** `User` / `BalanceTransaction` SQL lives in `@babylon/db`; validation,
 * `InsufficientFundsError`, cache invalidation, and points hooks stay in engine.
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { asSystem, type Transaction } from './db';
import { balanceTransactions } from './tables/balance-transactions';
import { nftOwnership } from './tables/nft-ownership';
import { users } from './tables/user';
import {
  type WalletTransferLimitRow,
  walletTransferLimit,
} from './tables/wallet-transfer-limit';
import {
  type WalletTransferLogInsert,
  walletTransferLog,
} from './tables/wallet-transfer-log';

type DbLike = DrizzleClient | Transaction;

export type WalletBalanceStatsRow = {
  virtualBalance: string | null;
  totalDeposited: string | null;
  totalWithdrawn: string | null;
  lifetimePnL: string | null;
};

export async function fetchUserWalletBalanceStats(
  userId: string
): Promise<WalletBalanceStatsRow | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        virtualBalance: users.virtualBalance,
        totalDeposited: users.totalDeposited,
        totalWithdrawn: users.totalWithdrawn,
        lifetimePnL: users.lifetimePnL,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row;
  }, 'wallet-balance-stats');
}

export async function fetchUserVirtualBalanceOnly(
  userId: string
): Promise<{ virtualBalance: string | null } | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ virtualBalance: users.virtualBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row;
  }, 'wallet-virtual-balance');
}

export async function listBalanceTransactionsForUser(
  userId: string,
  limit: number
): Promise<(typeof balanceTransactions.$inferSelect)[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(balanceTransactions)
        .where(eq(balanceTransactions.userId, userId))
        .orderBy(desc(balanceTransactions.createdAt))
        .limit(limit),
    'wallet-tx-history'
  );
}

export async function fetchUserRowByIdForWallet(
  userId: string
): Promise<typeof users.$inferSelect | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row;
  }, 'wallet-user-row');
}

export async function selectUserVirtualBalanceInTx(
  tx: DbLike,
  userId: string
): Promise<{ virtualBalance: string | null } | undefined> {
  const [row] = await tx
    .select({ virtualBalance: users.virtualBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

/** Same columns as `fetchUserWalletBalanceStats`, for use inside an existing transaction. */
export async function selectUserWalletBalanceStatsInTx(
  tx: DbLike,
  userId: string
): Promise<WalletBalanceStatsRow | undefined> {
  const [row] = await tx
    .select({
      virtualBalance: users.virtualBalance,
      totalDeposited: users.totalDeposited,
      totalWithdrawn: users.totalWithdrawn,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectBalanceTransactionsForUserOrderCreatedDescLimitInTx(
  tx: DbLike,
  userId: string,
  limit: number
): Promise<(typeof balanceTransactions.$inferSelect)[]> {
  return tx
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.userId, userId))
    .orderBy(desc(balanceTransactions.createdAt))
    .limit(limit);
}

/** Purchase-like balance rows for `GET .../points-history`. */
export async function selectBalanceTransactionsByUserIdAndTypesOrderCreatedDescLimit(
  db: DbLike,
  userId: string,
  types: string[],
  limit: number
): Promise<(typeof balanceTransactions.$inferSelect)[]> {
  if (types.length === 0) return [];
  return db
    .select()
    .from(balanceTransactions)
    .where(
      and(
        eq(balanceTransactions.userId, userId),
        inArray(balanceTransactions.type, types)
      )
    )
    .orderBy(desc(balanceTransactions.createdAt))
    .limit(limit);
}

/** Full history for `GET /api/users/points/award` (RLS `db`). */
export type BalanceTransactionHistorySliceRow = {
  id: string;
  amount: string;
  description: string | null;
  createdAt: Date;
  balanceBefore: string;
  balanceAfter: string;
};

export async function selectBalanceTransactionHistorySlicesByUserIdOrderCreatedDesc(
  db: DbLike,
  userId: string
): Promise<BalanceTransactionHistorySliceRow[]> {
  return db
    .select({
      id: balanceTransactions.id,
      amount: balanceTransactions.amount,
      description: balanceTransactions.description,
      createdAt: balanceTransactions.createdAt,
      balanceBefore: balanceTransactions.balanceBefore,
      balanceAfter: balanceTransactions.balanceAfter,
    })
    .from(balanceTransactions)
    .where(eq(balanceTransactions.userId, userId))
    .orderBy(desc(balanceTransactions.createdAt));
}

/** Admin points award: insert deposit row + increment user virtual/total deposited. */
export async function insertPointsAwardDepositReturningAdminSlices(
  tx: DbLike,
  params: {
    transactionId: string;
    userId: string;
    amount: number;
    amountStr: string;
    balanceBeforeStr: string;
    balanceAfterStr: string;
    description: string;
  }
): Promise<{
  transaction: typeof balanceTransactions.$inferSelect | undefined;
  updatedUser:
    | {
        id: string;
        virtualBalance: string | null;
        totalDeposited: string | null;
      }
    | undefined;
}> {
  const [txRow] = await tx
    .insert(balanceTransactions)
    .values({
      id: params.transactionId,
      userId: params.userId,
      type: 'deposit',
      amount: params.amountStr,
      balanceBefore: params.balanceBeforeStr,
      balanceAfter: params.balanceAfterStr,
      description: params.description,
    })
    .returning();

  const [userRow] = await tx
    .update(users)
    .set({
      virtualBalance: sql`${users.virtualBalance} + ${params.amount}`,
      totalDeposited: sql`${users.totalDeposited} + ${params.amount}`,
    })
    .where(eq(users.id, params.userId))
    .returning({
      id: users.id,
      virtualBalance: users.virtualBalance,
      totalDeposited: users.totalDeposited,
    });

  return { transaction: txRow, updatedUser: userRow };
}

export async function updateUserVirtualBalanceInTx(
  tx: DbLike,
  userId: string,
  newBalance: string
): Promise<void> {
  await tx
    .update(users)
    .set({ virtualBalance: newBalance })
    .where(eq(users.id, userId));
}

export async function insertBalanceTransactionInTx(
  tx: DbLike,
  row: typeof balanceTransactions.$inferInsert
): Promise<void> {
  await tx.insert(balanceTransactions).values(row);
}

export async function selectUserRowByIdInTx(
  tx: DbLike,
  userId: string
): Promise<typeof users.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateUserLifetimePnLInTx(
  tx: DbLike,
  userId: string,
  lifetimePnL: string
): Promise<void> {
  await tx.update(users).set({ lifetimePnL }).where(eq(users.id, userId));
}

export async function applyInitialDepositInTx(
  tx: DbLike,
  userId: string,
  startingBalance: number,
  balanceTxRow: typeof balanceTransactions.$inferInsert
): Promise<void> {
  await tx
    .update(users)
    .set({
      virtualBalance: String(startingBalance),
      totalDeposited: String(startingBalance),
    })
    .where(eq(users.id, userId));

  await tx.insert(balanceTransactions).values(balanceTxRow);
}

/** @see apps/web `checkAndReserveDailyLimit` */
export async function insertWalletTransferLimitOnConflictDoNothing(
  tx: DbLike,
  userId: string
): Promise<void> {
  await tx.insert(walletTransferLimit).values({ userId }).onConflictDoNothing();
}

export async function selectWalletTransferLimitByUserIdForUpdate(
  tx: DbLike,
  userId: string
): Promise<WalletTransferLimitRow | undefined> {
  const [row] = await tx
    .select()
    .from(walletTransferLimit)
    .where(eq(walletTransferLimit.userId, userId))
    .for('update');
  return row;
}

export async function updateWalletTransferLimitDailySpentInTx(
  tx: DbLike,
  userId: string,
  patch: { dailySpentUsd: string; lastResetAt?: Date }
): Promise<void> {
  await tx
    .update(walletTransferLimit)
    .set(patch)
    .where(eq(walletTransferLimit.userId, userId));
}

export async function insertWalletTransferLogInTx(
  tx: DbLike,
  row: WalletTransferLogInsert
): Promise<void> {
  await tx.insert(walletTransferLog).values(row);
}

export async function updateWalletTransferLogStatusByIdInTx(
  tx: DbLike,
  logId: string,
  status: string
): Promise<void> {
  await tx
    .update(walletTransferLog)
    .set({ status })
    .where(eq(walletTransferLog.id, logId));
}

export async function updateWalletTransferLogTxHashByIdInTx(
  tx: DbLike,
  logId: string,
  txHash: string
): Promise<void> {
  await tx
    .update(walletTransferLog)
    .set({ txHash })
    .where(eq(walletTransferLog.id, logId));
}

export async function selectNftOwnershipTokenIdForOwnerInTx(
  tx: DbLike,
  tokenId: number,
  ownerAddress: string
): Promise<{ tokenId: number } | undefined> {
  const [row] = await tx
    .select({ tokenId: nftOwnership.tokenId })
    .from(nftOwnership)
    .where(
      and(
        eq(nftOwnership.tokenId, tokenId),
        eq(nftOwnership.ownerAddress, ownerAddress)
      )
    )
    .limit(1);
  return row;
}
