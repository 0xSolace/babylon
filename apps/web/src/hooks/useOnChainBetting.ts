import { getContractAddresses } from '@babylon/contracts';
import { CHAIN, logger } from '@babylon/shared';
import { useMutation } from '@tanstack/react-query';
import { encodeFunctionData, pad } from 'viem';
import { useSmartWallet } from '@/hooks/useSmartWallet';

/**
 * Result of an on-chain betting transaction.
 */
export interface OnChainBetResult {
  /** Transaction hash */
  txHash: string;
  /** Number of shares purchased/sold */
  shares: number;
  /** Gas used (if available) */
  gasUsed?: string;
}

/**
 * Convert market ID (Snowflake ID string) to bytes32.
 * Preserves the numeric value by converting to hex and padding.
 */
function marketIdToBytes32(marketId: string): `0x${string}` {
  const bigintValue = BigInt(marketId);
  const hexValue = `0x${bigintValue.toString(16)}` as `0x${string}`;
  return pad(hexValue, { size: 32 });
}

const { diamond: DIAMOND_ADDRESS, network: NETWORK } = getContractAddresses();

const PREDICTION_MARKET_ABI = [
  {
    type: 'function',
    name: 'buyShares',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sellShares',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'calculateCost',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' },
    ],
    outputs: [{ name: 'cost', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

interface BuySharesParams {
  marketId: string;
  outcome: 'YES' | 'NO';
  numShares: number;
}

interface SellSharesParams {
  marketId: string;
  outcome: 'YES' | 'NO';
  numShares: number;
}

/**
 * Hook for on-chain prediction market betting with Base Sepolia ETH.
 *
 * Enables users to buy and sell shares in prediction markets using their
 * smart wallet. Transactions execute on the Base Sepolia blockchain through
 * the prediction market diamond contract. Supports gasless transactions when
 * using an embedded wallet.
 *
 * @returns An object containing:
 * - `buyShares`: Function to buy shares for a prediction market
 * - `sellShares`: Function to sell shares for a prediction market
 * - `loading`: Whether a transaction is currently in progress
 * - `error`: Any error that occurred during the transaction
 * - `smartWalletReady`: Whether the smart wallet is ready for transactions
 *
 * @example
 * ```tsx
 * const { buyShares, loading, error } = useOnChainBetting();
 *
 * const handleBuy = async () => {
 *   const result = await buyShares(marketId, 'YES', 10);
 *   console.log('Transaction:', result.txHash);
 * };
 * ```
 */
export function useOnChainBetting() {
  const { client, smartWalletReady, sendSmartWalletTransaction } =
    useSmartWallet();

  const buyMutation = useMutation({
    mutationFn: async ({
      marketId,
      outcome,
      numShares,
    }: BuySharesParams): Promise<OnChainBetResult> => {
      if (!smartWalletReady || !client) {
        throw new Error('Smart wallet not ready. Please connect your wallet.');
      }

      const outcomeIndex = outcome === 'YES' ? 1 : 0;
      const sharesBigInt = BigInt(Math.floor(numShares * 1e18));
      const marketIdBytes32 = marketIdToBytes32(marketId);

      logger.info('Buying shares on-chain', {
        network: NETWORK,
        diamond: DIAMOND_ADDRESS,
        marketId,
        marketIdBytes32,
        outcome,
        numShares,
        outcomeIndex,
      });

      const data = encodeFunctionData({
        abi: PREDICTION_MARKET_ABI,
        functionName: 'buyShares',
        args: [marketIdBytes32, outcomeIndex, sharesBigInt],
      });

      const hash = await sendSmartWalletTransaction({
        to: DIAMOND_ADDRESS,
        data,
        chain: CHAIN,
      });

      logger.info('Buy shares transaction sent', {
        marketId,
        outcome,
        txHash: hash,
      });

      return {
        txHash: hash,
        shares: numShares,
      };
    },
  });

  const sellMutation = useMutation({
    mutationFn: async ({
      marketId,
      outcome,
      numShares,
    }: SellSharesParams): Promise<OnChainBetResult> => {
      if (!smartWalletReady || !client) {
        throw new Error('Smart wallet not ready. Please connect your wallet.');
      }

      const outcomeIndex = outcome === 'YES' ? 1 : 0;
      const sharesBigInt = BigInt(Math.floor(numShares * 1e18));
      const marketIdBytes32 = marketIdToBytes32(marketId);

      logger.info('Selling shares on-chain', {
        marketId,
        marketIdBytes32,
        outcome,
        numShares,
      });

      const data = encodeFunctionData({
        abi: PREDICTION_MARKET_ABI,
        functionName: 'sellShares',
        args: [marketIdBytes32, outcomeIndex, sharesBigInt],
      });

      const hash = await sendSmartWalletTransaction({
        to: DIAMOND_ADDRESS,
        data,
        chain: CHAIN,
      });

      logger.info('Sell shares transaction sent', {
        marketId,
        outcome,
        txHash: hash,
      });

      return {
        txHash: hash,
        shares: numShares,
      };
    },
  });

  const buyShares = async (
    marketId: string,
    outcome: 'YES' | 'NO',
    numShares: number
  ): Promise<OnChainBetResult> => {
    return buyMutation.mutateAsync({ marketId, outcome, numShares });
  };

  const sellShares = async (
    marketId: string,
    outcome: 'YES' | 'NO',
    numShares: number
  ): Promise<OnChainBetResult> => {
    return sellMutation.mutateAsync({ marketId, outcome, numShares });
  };

  const loading = buyMutation.isPending || sellMutation.isPending;
  const error = buyMutation.error
    ? (buyMutation.error as Error).message
    : sellMutation.error
      ? (sellMutation.error as Error).message
      : null;

  return {
    buyShares,
    sellShares,
    loading,
    error,
    smartWalletReady,
  };
}
