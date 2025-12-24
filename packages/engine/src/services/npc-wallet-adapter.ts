/**
 * NPC Wallet Adapter
 *
 * Wraps actorState table operations to implement WalletPort interface.
 * This allows NPC trades to use the core PerpMarketService while
 * managing balances in the actorState table.
 *
 * Uses atomic SQL operations to prevent race conditions that could
 * lead to negative balances.
 */

import { actorState, type DbClient, db as defaultDb, eq } from '@babylon/db'
import { logger, type WalletPort } from '@babylon/shared'

/**
 * Creates a WalletPort implementation for NPC actors.
 * Uses actorState.tradingBalance instead of user wallets.
 *
 * All debit operations are atomic - the balance check and update happen
 * in a single SQL statement to prevent race conditions.
 */
export function createNpcWalletAdapter(
  actorId: string,
  dbClient?: DbClient,
): WalletPort {
  const db = dbClient ?? defaultDb

  return {
    async debit({
      amount,
      reason,
    }: {
      userId?: string
      amount: number
      reason: string
      description?: string
      relatedId?: string
    }) {
      const [actor] = await db
        .select({ tradingBalance: actorState.tradingBalance })
        .from(actorState)
        .where(eq(actorState.id, actorId))
        .limit(1)

      if (!actor) {
        throw new Error(`Actor not found: ${actorId}`)
      }

      const currentBalance = Number(actor.tradingBalance)
      if (currentBalance < amount) {
        throw new Error(
          `Insufficient trading balance: ${currentBalance.toFixed(2)} < ${amount.toFixed(2)} (${reason})`,
        )
      }

      await db
        .update(actorState)
        .set({
          tradingBalance: String(currentBalance - amount),
          updatedAt: new Date(),
        })
        .where(eq(actorState.id, actorId))
    },

    async credit({
      amount,
    }: {
      userId?: string
      amount: number
      reason: string
      description?: string
      relatedId?: string
    }) {
      const [actor] = await db
        .select({ tradingBalance: actorState.tradingBalance })
        .from(actorState)
        .where(eq(actorState.id, actorId))
        .limit(1)

      if (!actor) {
        throw new Error(`Actor not found: ${actorId}`)
      }

      const currentBalance = Number(actor.tradingBalance)
      await db
        .update(actorState)
        .set({
          tradingBalance: String(currentBalance + amount),
          updatedAt: new Date(),
        })
        .where(eq(actorState.id, actorId))
    },

    async recordPnL({
      pnl,
      reason,
    }: {
      userId?: string
      pnl: number
      reason: string
      relatedId?: string
    }) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(
          'NPC PnL update',
          { actorId, pnl: pnl.toFixed(2), reason },
          'NpcWallet',
        )
      }
    },

    async getBalance() {
      const [actor] = await db
        .select({ tradingBalance: actorState.tradingBalance })
        .from(actorState)
        .where(eq(actorState.id, actorId))
        .limit(1)

      if (!actor) {
        return { balance: 0 }
      }

      return { balance: Number(actor.tradingBalance) }
    },
  }
}
