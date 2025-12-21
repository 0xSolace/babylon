'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Represents wallet balance state.
 */
interface WalletBalanceState {
  /** Current available balance */
  balance: number;
  /** Lifetime profit and loss */
  lifetimePnL: number;
}

/**
 * Options for configuring wallet balance loading.
 */
interface UseWalletBalanceOptions {
  /** Whether to enable balance fetching (default: true) */
  enabled?: boolean;
}

const defaultState: WalletBalanceState = {
  balance: 0,
  lifetimePnL: 0,
};

interface BalanceApiResponse {
  balance: number | string;
  lifetimePnL: number | string;
}

/**
 * Hook for fetching and managing user wallet balance.
 *
 * Loads the current balance and lifetime PnL for a user's wallet. Automatically
 * refreshes when the userId changes and polls every 30 seconds to keep balance
 * up-to-date.
 *
 * @param userId - The user ID to fetch balance for, or null/undefined to clear balance
 * @param options - Configuration options including enabled flag
 *
 * @returns An object containing:
 * - `balance`: Current available balance
 * - `lifetimePnL`: Lifetime profit and loss
 * - `loading`: Whether balance is currently loading
 * - `error`: Any error that occurred while fetching
 * - `refresh`: Function to manually refresh balance
 *
 * @example
 * ```tsx
 * const { balance, lifetimePnL, loading } = useWalletBalance(userId);
 *
 * if (loading) return <div>Loading balance...</div>;
 *
 * return (
 *   <div>
 *     <p>Balance: ${balance.toFixed(2)}</p>
 *     <p>Lifetime PnL: ${lifetimePnL.toFixed(2)}</p>
 *   </div>
 * );
 * ```
 */
export function useWalletBalance(
  userId?: string | null,
  options: UseWalletBalanceOptions = {}
) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const {
    data = defaultState,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['walletBalance', userId],
    queryFn: async (): Promise<WalletBalanceState> => {
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId!)}/balance`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch wallet balance');
      }

      const data = (await response.json()) as BalanceApiResponse;

      return {
        balance: Number(data.balance) || 0,
        lifetimePnL: Number(data.lifetimePnL) || 0,
      };
    },
    enabled: enabled && !!userId,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const refresh = useCallback(() => {
    if (userId && enabled) {
      void queryClient.invalidateQueries({
        queryKey: ['walletBalance', userId],
      });
    }
  }, [queryClient, userId, enabled]);

  return {
    balance: data.balance,
    lifetimePnL: data.lifetimePnL,
    loading: isLoading,
    error: error as Error | null,
    refresh,
  };
}
