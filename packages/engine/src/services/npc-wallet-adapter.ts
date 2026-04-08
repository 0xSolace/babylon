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
import type { WalletPort } from '@babylon/core/markets/shared';
import {
  type DrizzleClient,
  npcActorStateAtomicCredit,
  npcActorStateAtomicCreditAsSystem,
  npcActorStateAtomicDebit,
  npcActorStateAtomicDebitAsSystem,
  selectNpcActorTradingBalance,
  selectNpcActorTradingBalanceAsSystem,
  type Transaction,
} from '@babylon/db';
import { logger } from '@babylon/shared';

type DbClient = DrizzleClient | Transaction;

/**
 * Creates a WalletPort implementation for NPC actors.
 * Uses actorState.tradingBalance instead of user wallets.
 *
 * All debit operations are atomic - the balance check and update happen
 * in a single SQL statement to prevent race conditions.
 */
export function createNpcWalletAdapter(
  actorId: string,
  dbClient?: DbClient
): WalletPort {
  if (dbClient) {
    const db = dbClient;
    return {
      async debit({ amount, reason }: { amount: number; reason: string }) {
        const result = await npcActorStateAtomicDebit(db, actorId, amount);

        if (result.length === 0) {
          const actor = await selectNpcActorTradingBalance(db, actorId);

          if (!actor) {
            throw new Error(`Actor not found: ${actorId}`);
          }

          const currentBalance = Number(actor.tradingBalance);
          throw new Error(
            `Insufficient trading balance: ${currentBalance.toFixed(2)} < ${amount.toFixed(2)} (${reason})`
          );
        }
      },

      async credit({ amount }: { amount: number }) {
        const result = await npcActorStateAtomicCredit(db, actorId, amount);

        if (result.length === 0) {
          throw new Error(`Actor not found: ${actorId}`);
        }
      },

      async recordPnL({ pnl, reason }: { pnl: number; reason: string }) {
        logger.debug(
          'NPC PnL recorded',
          { actorId, pnl: pnl.toFixed(2), reason },
          'NpcWalletAdapter'
        );
      },

      async getBalance() {
        const actor = await selectNpcActorTradingBalance(db, actorId);

        if (!actor) {
          return { balance: 0 };
        }

        return { balance: Number(actor.tradingBalance) };
      },
    };
  }

  return {
    async debit({ amount, reason }: { amount: number; reason: string }) {
      const result = await npcActorStateAtomicDebitAsSystem(actorId, amount);

      if (result.length === 0) {
        const actor = await selectNpcActorTradingBalanceAsSystem(actorId);

        if (!actor) {
          throw new Error(`Actor not found: ${actorId}`);
        }

        const currentBalance = Number(actor.tradingBalance);
        throw new Error(
          `Insufficient trading balance: ${currentBalance.toFixed(2)} < ${amount.toFixed(2)} (${reason})`
        );
      }
    },

    async credit({ amount }: { amount: number }) {
      const result = await npcActorStateAtomicCreditAsSystem(actorId, amount);

      if (result.length === 0) {
        throw new Error(`Actor not found: ${actorId}`);
      }
    },

    async recordPnL({ pnl, reason }: { pnl: number; reason: string }) {
      logger.debug(
        'NPC PnL recorded',
        { actorId, pnl: pnl.toFixed(2), reason },
        'NpcWalletAdapter'
      );
    },

    async getBalance() {
      const actor = await selectNpcActorTradingBalanceAsSystem(actorId);

      if (!actor) {
        return { balance: 0 };
      }

      return { balance: Number(actor.tradingBalance) };
    },
  };
}
