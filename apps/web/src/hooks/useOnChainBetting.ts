import { getContractAddresses } from '@babylon/contracts';
import { logger } from '@babylon/shared';
import { useCallback, useState } from 'react';
import {
  buySharesOnchainAction,
  sellSharesOnchainAction,
} from '@/app/_actions/onchain';
import { useAuth } from '@/hooks/useAuth';

/**
 * Result of an on-chain betting transaction.
 */
export interface OnChainBetResult {
  /** Transaction hash */
  txHash: string;
  /** Collateral or share amount submitted */
  submittedAmount: number;
  /** Gas used (if available) */
  gasUsed?: string;
}

// Get contract addresses for current network (localnet or testnet/mainnet)
const { predictionAmmRouter: PREDICTION_AMM_ROUTER, network: NETWORK } =
  getContractAddresses();

/**
 * Hook for on-chain prediction market betting.
 *
 * Uses a server-side sponsored transaction flow (Privy embedded wallet + server actions).
 */
export function useOnChainBetting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessToken } = useAuth();

  const buyShares = useCallback(
    async (
      marketKey: string,
      outcome: 'YES' | 'NO',
      collateralAmount: number
    ): Promise<OnChainBetResult> => {
      setLoading(true);
      setError(null);

      try {
        logger.info('Buying shares on-chain', {
          network: NETWORK,
          router: PREDICTION_AMM_ROUTER,
          marketKey,
          outcome,
          collateralAmount,
        });

        const userJwt = await getAccessToken().catch(() => null);
        if (!userJwt) {
          throw new Error('Authentication required');
        }

        const { txHash } = await buySharesOnchainAction({
          marketKey,
          outcome,
          collateralAmount,
          userJwt,
        });

        return { txHash, submittedAmount: collateralAmount };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Buy failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken]
  );

  const sellShares = useCallback(
    async (
      marketKey: string,
      outcome: 'YES' | 'NO',
      shares: number
    ): Promise<OnChainBetResult> => {
      setLoading(true);
      setError(null);

      try {
        logger.info('Selling shares on-chain', {
          network: NETWORK,
          router: PREDICTION_AMM_ROUTER,
          marketKey,
          outcome,
          shares,
        });

        const userJwt = await getAccessToken().catch(() => null);
        if (!userJwt) {
          throw new Error('Authentication required');
        }

        const { txHash } = await sellSharesOnchainAction({
          marketKey,
          outcome,
          shares,
          userJwt,
        });

        return { txHash, submittedAmount: shares };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sell failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken]
  );

  return {
    buyShares,
    sellShares,
    loading,
    error,
    walletReady: true,
  };
}
