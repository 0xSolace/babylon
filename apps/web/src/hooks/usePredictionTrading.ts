'use client';

import { useCallback, useState } from 'react';
import {
  buySharesOnchainAction,
  claimPredictionWinningsOnchainAction,
  sellSharesOnchainAction,
} from '@/app/_actions/onchain';
import { useAuth } from '@/hooks/useAuth';

type PredictionTradeSide = 'YES' | 'NO';

type BuyPredictionInput = {
  marketId: string;
  onChainMarketId?: string | null;
  side: PredictionTradeSide;
  amount: number;
};

type SellPredictionInput = {
  marketId: string;
  onChainMarketId?: string | null;
  side: PredictionTradeSide;
  shares: number;
  positionId: string;
};

type ClaimPredictionInput = {
  marketId: string;
  onChainMarketId: string;
};

type BuyPredictionResult =
  | {
      mode: 'onchain';
      txHash: string;
      shares: number;
      side: PredictionTradeSide;
    }
  | {
      mode: 'offchain';
      shares: number;
      avgPrice: number;
    };

type SellPredictionResult =
  | {
      mode: 'onchain';
      txHash: string;
      receivedSide: PredictionTradeSide;
      sharesIn: number;
      sharesOut: number;
    }
  | {
      mode: 'offchain';
      pnl: number;
      remainingShares: number;
    };

type ClaimPredictionResult = {
  txHash: string;
  payout: number;
};

function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'object' &&
    payload.error !== null &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  return fallback;
}

async function parseJsonPayload<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function usePredictionTrading() {
  const { embeddedWalletAddress, getAccessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requireAccessToken = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Authentication required. Please log in.');
    }

    return token;
  }, [getAccessToken]);

  const buyPrediction = useCallback(
    async (input: BuyPredictionInput): Promise<BuyPredictionResult> => {
      setLoading(true);
      setError(null);

      try {
        const accessToken = await requireAccessToken();

        if (input.onChainMarketId) {
          if (!embeddedWalletAddress) {
            throw new Error('Wallet not ready');
          }

          const { txHash } = await buySharesOnchainAction({
            marketKey: input.onChainMarketId,
            outcome: input.side,
            collateralAmount: input.amount,
            userJwt: accessToken,
          });

          const response = await fetch(
            `/api/markets/predictions/${input.marketId}/buy`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                side: input.side.toLowerCase(),
                collateralAmount: input.amount,
                txHash,
                walletAddress: embeddedWalletAddress,
              }),
            }
          );
          const payload = await parseJsonPayload<{
            position: { side: PredictionTradeSide; shares: number };
          }>(response);

          if (!response.ok) {
            throw new Error(
              readApiErrorMessage(payload, 'Failed to verify on-chain trade')
            );
          }

          return {
            mode: 'onchain',
            txHash,
            shares: payload.position.shares,
            side: payload.position.side,
          };
        }

        const response = await fetch(
          `/api/markets/predictions/${input.marketId}/buy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              side: input.side.toLowerCase(),
              amount: input.amount,
            }),
          }
        );
        const payload = await parseJsonPayload<{
          position: { shares: number; avgPrice: number };
        }>(response);

        if (!response.ok) {
          throw new Error(readApiErrorMessage(payload, 'Failed to buy shares'));
        }

        return {
          mode: 'offchain',
          shares: payload.position.shares,
          avgPrice: payload.position.avgPrice,
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Prediction buy failed';
        setError(message);
        throw caughtError;
      } finally {
        setLoading(false);
      }
    },
    [embeddedWalletAddress, requireAccessToken]
  );

  const sellPrediction = useCallback(
    async (input: SellPredictionInput): Promise<SellPredictionResult> => {
      setLoading(true);
      setError(null);

      try {
        const accessToken = await requireAccessToken();

        if (input.onChainMarketId) {
          if (!embeddedWalletAddress) {
            throw new Error('Wallet not ready');
          }

          const { txHash } = await sellSharesOnchainAction({
            marketKey: input.onChainMarketId,
            outcome: input.side,
            shares: input.shares,
            userJwt: accessToken,
          });

          const response = await fetch(
            `/api/markets/predictions/${input.marketId}/sell`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                side: input.side.toLowerCase(),
                shares: input.shares,
                txHash,
                walletAddress: embeddedWalletAddress,
              }),
            }
          );
          const payload = await parseJsonPayload<{
            trade: {
              receivedSide: PredictionTradeSide;
              sharesIn: number;
              sharesOut: number;
            };
          }>(response);

          if (!response.ok) {
            throw new Error(
              readApiErrorMessage(payload, 'Failed to verify on-chain trade')
            );
          }

          return {
            mode: 'onchain',
            txHash,
            receivedSide: payload.trade.receivedSide,
            sharesIn: payload.trade.sharesIn,
            sharesOut: payload.trade.sharesOut,
          };
        }

        const response = await fetch(
          `/api/markets/predictions/${input.marketId}/sell`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              shares: input.shares,
              positionId: input.positionId,
            }),
          }
        );
        const payload = await parseJsonPayload<{
          pnl: number;
          remainingShares: number;
        }>(response);

        if (!response.ok) {
          throw new Error(
            readApiErrorMessage(payload, 'Failed to sell shares')
          );
        }

        return {
          mode: 'offchain',
          pnl: payload.pnl,
          remainingShares: payload.remainingShares,
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Prediction sell failed';
        setError(message);
        throw caughtError;
      } finally {
        setLoading(false);
      }
    },
    [embeddedWalletAddress, requireAccessToken]
  );

  const claimPrediction = useCallback(
    async (input: ClaimPredictionInput): Promise<ClaimPredictionResult> => {
      setLoading(true);
      setError(null);

      try {
        const accessToken = await requireAccessToken();
        if (!embeddedWalletAddress) {
          throw new Error('Wallet not ready');
        }

        const { txHash } = await claimPredictionWinningsOnchainAction({
          marketKey: input.onChainMarketId,
          userJwt: accessToken,
        });

        const response = await fetch(
          `/api/markets/predictions/${input.marketId}/claim`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              txHash,
              walletAddress: embeddedWalletAddress,
            }),
          }
        );
        const payload = await parseJsonPayload<{
          claim: { payout: number };
        }>(response);

        if (!response.ok) {
          throw new Error(
            readApiErrorMessage(payload, 'Failed to verify on-chain claim')
          );
        }

        return {
          txHash,
          payout: payload.claim.payout,
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Prediction claim failed';
        setError(message);
        throw caughtError;
      } finally {
        setLoading(false);
      }
    },
    [embeddedWalletAddress, requireAccessToken]
  );

  return {
    buyPrediction,
    sellPrediction,
    claimPrediction,
    loading,
    error,
    walletAddress: embeddedWalletAddress,
  };
}
