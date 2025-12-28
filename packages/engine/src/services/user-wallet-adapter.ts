/**
 * User Wallet Adapter
 *
 * Wraps BBLNWalletService to implement WalletPort interface for users.
 * All user trades use real BBLN tokens - no simulation mode.
 */

import type { WalletPort } from '@babylon/shared'
import { BBLNWalletService } from './bbln-wallet-service'

/**
 * Creates a WalletPort implementation for users using real BBLN tokens.
 *
 * @param userId - The user ID
 * @returns WalletPort interface for the user
 */
export function createUserWalletAdapter(userId: string): WalletPort {
  return {
    async getBalance(): Promise<{ balance: number }> {
      const balanceInfo = await BBLNWalletService.getBalance(userId)
      return { balance: balanceInfo.balance }
    },

    async debit({
      amount,
      reason,
      description,
      relatedId,
    }: {
      userId?: string
      amount: number
      reason: string
      description?: string
      relatedId?: string
    }): Promise<void> {
      await BBLNWalletService.debit(
        userId,
        amount,
        reason,
        description ?? reason,
        relatedId,
      )
    },

    async credit({
      amount,
      reason,
      description,
      relatedId,
    }: {
      userId?: string
      amount: number
      reason: string
      description?: string
      relatedId?: string
    }): Promise<void> {
      await BBLNWalletService.credit(
        userId,
        amount,
        reason,
        description ?? reason,
        relatedId,
      )
    },

    async recordPnL({
      pnl,
      reason,
      relatedId,
    }: {
      userId?: string
      pnl: number
      reason: string
      relatedId?: string
    }): Promise<void> {
      await BBLNWalletService.recordPnL(userId, pnl, reason, relatedId)
    },
  }
}
