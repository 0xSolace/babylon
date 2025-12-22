/**
 * Shared adapters for perps API routes.
 * Creates WalletPort implementations that wrap WalletService.
 */

import type { WalletPort } from '@babylon/core';
import { FEE_CONFIG, WalletService } from '@babylon/engine';

/**
 * Creates a WalletPort adapter that wraps WalletService methods.
 * Used by PerpMarketService in API handlers.
 */
interface DebitCreditParams {
  userId: string;
  amount: number;
  reason: string;
  description?: string;
  relatedId?: string;
}

interface RecordPnLParams {
  userId: string;
  pnl: number;
  reason: string;
  relatedId?: string;
}

export function createWalletAdapter(): WalletPort {
  return {
    debit: async ({
      userId,
      amount,
      reason,
      description,
      relatedId,
    }: DebitCreditParams) => {
      await WalletService.debit(
        userId,
        amount,
        reason,
        description ?? '',
        relatedId
      );
    },
    credit: async ({
      userId,
      amount,
      reason,
      description,
      relatedId,
    }: DebitCreditParams) => {
      await WalletService.credit(
        userId,
        amount,
        reason,
        description ?? '',
        relatedId
      );
    },
    recordPnL: async ({ userId, pnl, reason, relatedId }: RecordPnLParams) => {
      await WalletService.recordPnL(userId, pnl, reason, relatedId);
    },
    getBalance: (userId: string) => WalletService.getBalance(userId),
  };
}

/**
 * Standard fee config for perps trading.
 */
export const perpFeeConfig = {
  tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
  platformShare: FEE_CONFIG.PLATFORM_SHARE,
  referrerShare: FEE_CONFIG.REFERRER_SHARE,
  minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
};
