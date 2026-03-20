/**
 * ⚠️  DEV-ONLY hook — seeds Zustand stores with mock wallet data.
 *
 * When WALLET_MOCK_ENABLED is false, this is a pure no-op with zero
 * side effects — no imports, no store access, no bundle cost.
 *
 * 🔴  REMOVE before merging to production.  See /WALLET-DEV-REMINDER.md
 */

'use client';

import { useEffect } from 'react';
import { WALLET_MOCK_ENABLED } from './wallet-mock-data';

/**
 * Seeds stores with mock data. Only loads mock data dynamically when enabled.
 */
export function useWalletMockData(_userId: string | undefined) {
  useEffect(() => {
    if (!WALLET_MOCK_ENABLED) return;

    // Dynamic imports — only loaded when mock is enabled
    void (async () => {
      const [
        { useWalletBalanceStore },
        { useUserPositionsStore },
        {
          MOCK_BALANCE,
          MOCK_LIFETIME_PNL,
          MOCK_PERP_POSITIONS,
          MOCK_PREDICTION_POSITIONS,
        },
      ] = await Promise.all([
        import('@/stores/walletBalanceStore'),
        import('@/stores/userPositionsStore'),
        import('./wallet-mock-data'),
      ]);

      // Seed wallet balance store + replace fetch with no-op
      useWalletBalanceStore.setState({
        balance: MOCK_BALANCE,
        lifetimePnL: MOCK_LIFETIME_PNL,
        loading: false,
        error: null,
        lastFetchedAt: Date.now(),
        userId: 'mock-user',
        fetchPromise: null,
      });
      useWalletBalanceStore.setState({
        fetchBalance: async () => {},
      });

      // Seed user positions store + replace fetch with no-op
      useUserPositionsStore.setState({
        perpPositions: MOCK_PERP_POSITIONS,
        predictionPositions: MOCK_PREDICTION_POSITIONS,
        loading: false,
        error: null,
        lastFetchedAt: Date.now(),
        userId: 'mock-user',
        fetchPromise: null,
      });
      useUserPositionsStore.setState({
        fetchPositions: async () => {},
      });
    })();
  }, []);
}
