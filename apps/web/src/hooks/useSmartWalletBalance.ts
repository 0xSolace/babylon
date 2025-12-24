import { CHAIN, RPC_URL } from '@babylon/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { useSmartWallet } from '@/hooks/useSmartWallet'

const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
})

/**
 * Hook for fetching and managing smart wallet balance.
 *
 * Automatically fetches the native token balance (ETH) for the connected
 * smart wallet. Updates when the smart wallet address changes. Provides
 * manual refresh capability.
 *
 * @returns An object containing:
 * - `balance`: Current balance in wei (bigint), or null if not available
 * - `loading`: Whether balance is currently being fetched
 * - `refreshBalance`: Function to manually refresh the balance
 *
 * @example
 * ```tsx
 * const { balance, loading, refreshBalance } = useSmartWalletBalance();
 *
 * if (loading) return <div>Loading balance...</div>;
 * if (balance) {
 *   return <div>Balance: {formatEther(balance)} ETH</div>;
 * }
 * ```
 */
export function useSmartWalletBalance() {
  const { smartWalletAddress } = useSmartWallet()
  const queryClient = useQueryClient()

  const { data: balance = null, isLoading } = useQuery({
    queryKey: ['smartWalletBalance', smartWalletAddress],
    queryFn: async (): Promise<bigint> => {
      const result = await publicClient.getBalance({
        address: smartWalletAddress as Address,
      })
      return result
    },
    enabled: !!smartWalletAddress,
    staleTime: 15000,
  })

  const refreshBalance = useCallback(async (): Promise<bigint | null> => {
    if (!smartWalletAddress) {
      return null
    }
    await queryClient.invalidateQueries({
      queryKey: ['smartWalletBalance', smartWalletAddress],
    })
    const cachedBalance = queryClient.getQueryData<bigint>([
      'smartWalletBalance',
      smartWalletAddress,
    ])
    return cachedBalance !== undefined ? cachedBalance : null
  }, [queryClient, smartWalletAddress])

  return {
    balance,
    loading: isLoading,
    refreshBalance,
  }
}
