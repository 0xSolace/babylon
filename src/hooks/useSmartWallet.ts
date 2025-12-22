/**
 * useSmartWallet Hook
 *
 * Provides access to the OAuth3/MPC smart wallet for transactions.
 */

'use client';

import { useJejuWallet } from '@babylon/auth/client';
import { useCallback, useMemo } from 'react';
import type { Hex } from 'viem';
import {
  getWalletErrorMessage,
  WALLET_ERROR_MESSAGES,
} from '@/lib/wallet-utils';

interface SmartWalletTxInput {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
}

interface SmartWalletTxOptions {
  gas?: bigint;
}

interface UseSmartWalletResult {
  smartWalletAddress?: string;
  smartWalletReady: boolean;
  sendSmartWalletTransaction: (
    input: SmartWalletTxInput,
    options?: SmartWalletTxOptions
  ) => Promise<Hex>;
}

export function useSmartWallet(): UseSmartWalletResult {
  const { address, ready, sendTransaction } = useJejuWallet();

  const smartWalletReady = useMemo(
    () => Boolean(ready && address),
    [ready, address]
  );

  const sendSmartWalletTransaction = useCallback(
    async (
      input: SmartWalletTxInput,
      options?: SmartWalletTxOptions
    ): Promise<Hex> => {
      if (!ready || !address) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
      }

      const txHash = await sendTransaction({
        to: input.to,
        data: input.data,
        value: input.value,
        gas: options?.gas,
      });

      if (!txHash) {
        throw new Error(getWalletErrorMessage(new Error('Transaction failed')));
      }

      return txHash;
    },
    [ready, address, sendTransaction]
  );

  return {
    smartWalletAddress: address ?? undefined,
    smartWalletReady,
    sendSmartWalletTransaction,
  };
}
