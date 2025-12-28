import { logger, WALLET_ERROR_MESSAGES } from '@babylon/shared'
import { useJejuWallet } from '@jejunetwork/auth'
import type { JsonValue } from '@jejunetwork/shared'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Address, Hex } from 'viem'

interface SmartWalletTxInput {
  to: Address
  value?: bigint
  data?: Hex
  chain?: { id: number }
}

interface SmartWalletTxOptions {
  gasLimit?: bigint
}

/** Minimal client interface for backward compatibility */
interface SmartWalletClient {
  account: { address: Address | null }
  sendTransaction: (
    input: SmartWalletTxInput,
    options?: SmartWalletTxOptions,
  ) => Promise<Hex>
}

/**
 * Return type for the useSmartWallet hook.
 */
interface UseSmartWalletResult {
  /** The smart wallet client (for backward compatibility) */
  client?: SmartWalletClient
  /** The smart wallet address (if available) */
  smartWalletAddress: Address | null
  /** Whether the smart wallet is ready for transactions */
  smartWalletReady: boolean
  /** Function to send a transaction via the smart wallet */
  sendSmartWalletTransaction: (
    input: SmartWalletTxInput,
    options?: SmartWalletTxOptions,
  ) => Promise<Hex>
  /** Function to sign a message */
  signMessage: (message: string) => Promise<Hex>
  /** Function to sign typed data (EIP-712) */
  signTypedData: (typedData: Record<string, JsonValue>) => Promise<Hex>
}

/**
 * Hook for managing smart wallet operations.
 *
 * Provides access to Jeju's MPC-backed wallet functionality, enabling
 * threshold-signed transactions. The smart wallet uses MPC for key management
 * with TEE-backed security.
 *
 * @returns Smart wallet state and transaction sending function.
 *
 * @example
 * ```tsx
 * const { smartWalletReady, sendSmartWalletTransaction } = useSmartWallet();
 *
 * const handleTransaction = async () => {
 *   if (!smartWalletReady) {
 *     throw new Error('Smart wallet not ready');
 *   }
 *
 *   const txHash = await sendSmartWalletTransaction({
 *     to: '0x...',
 *     value: parseEther('0.1'),
 *     data: '0x...'
 *   });
 * };
 * ```
 */
export function useSmartWallet(): UseSmartWalletResult {
  const {
    address,
    ready,
    signMessage: jejuSignMessage,
    signTypedData: jejuSignTypedData,
    sendTransaction,
  } = useJejuWallet()

  const lastLoggedState = useRef<boolean | null>(null)
  const hasLoggedWarning = useRef(false)

  // Only log when the state changes, not on every render
  useEffect(() => {
    if (lastLoggedState.current !== ready) {
      lastLoggedState.current = ready
      logger.debug('Smart wallet state changed', {
        ready,
        hasAddress: !!address,
        address,
      })
    }

    // Log a warning if wallet is not available after a delay (but only once)
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    if (!ready && !hasLoggedWarning.current) {
      timeoutId = setTimeout(() => {
        if (!ready) {
          hasLoggedWarning.current = true
          logger.warn(
            'Smart wallet not initialized. Please login first.',
            { hasAddress: !!address },
            'useSmartWallet',
          )
        }
      }, 5000) // Wait 5 seconds before warning
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [ready, address])

  const smartWalletAddress = address
  const smartWalletReady = useMemo(
    () => Boolean(ready && smartWalletAddress),
    [ready, smartWalletAddress],
  )

  const sendSmartWalletTransaction = useCallback(
    async (
      input: SmartWalletTxInput,
      _options?: SmartWalletTxOptions,
    ): Promise<Hex> => {
      if (!ready || !smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET)
      }

      return await sendTransaction({
        to: input.to,
        value: input.value,
        data: input.data,
      })
    },
    [ready, smartWalletAddress, sendTransaction],
  )

  const signMessage = useCallback(
    async (message: string): Promise<Hex> => {
      if (!ready) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET)
      }
      return await jejuSignMessage(message)
    },
    [ready, jejuSignMessage],
  )

  const signTypedData = useCallback(
    async (typedData: Record<string, JsonValue>): Promise<Hex> => {
      if (!ready) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET)
      }
      return await jejuSignTypedData(typedData)
    },
    [ready, jejuSignTypedData],
  )

  // Create a backward-compatible client object
  const client: SmartWalletClient | undefined = smartWalletReady
    ? {
        account: { address: smartWalletAddress },
        sendTransaction: sendSmartWalletTransaction,
      }
    : undefined

  return {
    client,
    smartWalletAddress,
    smartWalletReady,
    sendSmartWalletTransaction,
    signMessage,
    signTypedData,
  }
}
