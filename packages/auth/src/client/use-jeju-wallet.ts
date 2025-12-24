/**
 * useJejuWallet Hook
 *
 * Hook for wallet operations using MPC threshold signatures.
 */

import type { JsonValue } from '@babylon/shared'
import { useCallback, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useJejuAuthContext } from './provider'

export interface TransactionRequest {
  to: Address
  value?: bigint
  data?: Hex
  gasLimit?: bigint
}

export interface WalletState {
  address: Address | null
  ready: boolean
  signing: boolean
  error: string | null
}

/**
 * Hook for wallet operations
 *
 * @example
 * ```tsx
 * const { address, signMessage, sendTransaction, hasGas, requestGas } = useJejuWallet();
 *
 * const handleSign = async () => {
 *   const signature = await signMessage("Hello, World!");
 *   console.log(signature);
 * };
 * ```
 */
export function useJejuWallet() {
  const context = useJejuAuthContext()
  const [signing, setSigning] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)

  const address = context.walletAddress
  const ready = context.authenticated && address !== null

  const signMessage = useCallback(
    async (message: string): Promise<Hex> => {
      if (!ready) {
        throw new Error('Wallet not ready')
      }

      setSigning(true)
      setTxError(null)

      try {
        return await context.signMessage(message)
      } finally {
        setSigning(false)
      }
    },
    [ready, context.signMessage],
  )

  const signTypedData = useCallback(
    async (typedData: Record<string, JsonValue>): Promise<Hex> => {
      if (!ready) {
        throw new Error('Wallet not ready')
      }

      setSigning(true)
      setTxError(null)

      try {
        return await context.signTypedData(typedData)
      } finally {
        setSigning(false)
      }
    },
    [ready, context.signTypedData],
  )

  const sendTransaction = useCallback(
    async (tx: TransactionRequest): Promise<Hex> => {
      if (!ready) {
        throw new Error('Wallet not ready')
      }

      setSigning(true)

      try {
        // Check if user has gas
        const hasUserGas = await context.hasGas()

        if (!hasUserGas) {
          // Request gas from treasury
          await context.requestGas()
        }

        // Sign the transaction
        // In production, would build and submit the transaction
        const txHash = await context.signMessage(JSON.stringify(tx))
        return txHash
      } finally {
        setSigning(false)
      }
    },
    [ready, context.hasGas, context.requestGas, context.signMessage],
  )

  const hasGas = useCallback(async (): Promise<boolean> => {
    return context.hasGas()
  }, [context.hasGas])

  const requestGas = useCallback(async (): Promise<boolean> => {
    return context.requestGas()
  }, [context.requestGas])

  const state: WalletState = useMemo(
    () => ({
      address,
      ready,
      signing,
      error: txError,
    }),
    [address, ready, signing, txError],
  )

  return {
    ...state,
    signMessage,
    signTypedData,
    sendTransaction,
    hasGas,
    requestGas,
  }
}
