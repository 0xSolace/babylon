/**
 * BabylonAuthProvider
 *
 * Babylon-specific wrapper around @jejunetwork/auth's OAuth3Provider.
 * Provides sensible defaults for Babylon apps.
 */

import {
  type AuthProvider,
  type OAuth3ContextValue,
  OAuth3Provider,
  type OAuth3ProviderProps,
  useOAuth3,
} from '@jejunetwork/auth'
import type React from 'react'
import type { ReactNode } from 'react'
import { useCallback, useMemo } from 'react'
import type { Address, Hex } from 'viem'
import {
  type BabylonAuthConfig,
  createBabylonAuthConfig,
  getBabylonChainId,
} from '../index'

/**
 * Props for BabylonAuthProvider
 */
export interface BabylonAuthProviderProps {
  children: ReactNode
  config?: BabylonAuthConfig
}

/**
 * Linked account information
 */
export interface LinkedAccount {
  /** Account type (e.g., 'farcaster', 'twitter', 'email') */
  type: string
  /** Account identifier (e.g., FID, username, email) */
  identifier: string
  /** Display handle */
  handle?: string
  /** When linked */
  linkedAt: number
}

/**
 * Babylon-specific auth context value with convenience properties
 */
export interface BabylonAuthContextValue extends OAuth3ContextValue {
  /** Babylon network */
  network: 'mainnet' | 'testnet' | 'localnet'
  /** Babylon chain ID */
  chainId: number

  // Convenience aliases for common property names
  /** Whether auth is ready (not loading) */
  ready: boolean
  /** Whether user is authenticated */
  authenticated: boolean
  /** Whether auth is loading */
  loading: boolean
  /** User ID (identity ID) */
  userId: Hex | null
  /** Connected wallet address */
  walletAddress: Address | null
  /** Linked social accounts */
  linkedAccounts: LinkedAccount[]

  // Convenience login methods
  /** Login with wallet */
  loginWithWallet: () => Promise<void>
  /** Login with Farcaster */
  loginWithFarcaster: () => Promise<void>

  // Token access
  /** Get access token for API calls */
  getAccessToken: () => Promise<string | null>
}

/**
 * BabylonAuthProvider
 *
 * Wraps OAuth3Provider with Babylon-specific defaults.
 *
 * @example
 * ```tsx
 * import { BabylonAuthProvider } from '@babylon/auth';
 *
 * function App() {
 *   return (
 *     <BabylonAuthProvider config={{ network: 'testnet' }}>
 *       <MyApp />
 *     </BabylonAuthProvider>
 *   );
 * }
 * ```
 */
export function BabylonAuthProvider({
  children,
  config = {},
}: BabylonAuthProviderProps): React.ReactElement {
  const oauth3Config = createBabylonAuthConfig(config)

  const providerProps: OAuth3ProviderProps = {
    config: oauth3Config,
    children,
  }

  return <OAuth3Provider {...providerProps}>{children}</OAuth3Provider>
}

/**
 * useBabylonAuth hook
 *
 * Babylon-specific auth hook with convenience methods.
 *
 * @example
 * ```tsx
 * import { useBabylonAuth } from '@babylon/auth';
 *
 * function MyComponent() {
 *   const {
 *     authenticated,
 *     session,
 *     loginWithWallet,
 *     loginWithFarcaster,
 *     logout,
 *   } = useBabylonAuth();
 *
 *   if (!authenticated) {
 *     return (
 *       <div>
 *         <button onClick={loginWithWallet}>Connect Wallet</button>
 *         <button onClick={loginWithFarcaster}>Login with Farcaster</button>
 *       </div>
 *     );
 *   }
 *
 *   return (
 *     <div>
 *       <p>Logged in as {session?.identityId}</p>
 *       <button onClick={logout}>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBabylonAuth(): BabylonAuthContextValue {
  const oauth3 = useOAuth3()

  // Determine network from chain ID
  let network: 'mainnet' | 'testnet' | 'localnet' = 'testnet'
  const chainId = oauth3.session?.attestation?.measurement
    ? getBabylonChainId('testnet')
    : 420691

  if (chainId === 420692) {
    network = 'mainnet'
  } else if (chainId === 420690) {
    network = 'testnet'
  } else {
    network = 'localnet'
  }

  // Build linked accounts from credentials
  // Note: Linked accounts should be fetched via getCredentials() for full data
  const linkedAccounts = useMemo((): LinkedAccount[] => {
    // For now return empty array - web app should fetch via API
    // Full implementation would call getCredentials and map to LinkedAccount[]
    return []
  }, [])

  // Login with wallet
  const loginWithWallet = useCallback(async () => {
    await oauth3.login('wallet' as AuthProvider)
  }, [oauth3.login])

  // Login with Farcaster
  const loginWithFarcaster = useCallback(async () => {
    await oauth3.login('farcaster' as AuthProvider)
  }, [oauth3.login])

  // Get access token
  // Note: In OAuth3, the "access token" is the sessionId which can be used for API auth
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const session = oauth3.session
    if (!session) return null
    // Use sessionId as the access token for API authentication
    return session.sessionId ?? null
  }, [oauth3.session])

  return {
    ...oauth3,
    network,
    chainId,
    // Convenience aliases
    ready: !oauth3.isLoading,
    authenticated: oauth3.isAuthenticated,
    loading: oauth3.isLoading,
    userId: oauth3.identityId,
    walletAddress: oauth3.smartAccountAddress,
    linkedAccounts,
    // Methods
    loginWithWallet,
    loginWithFarcaster,
    getAccessToken,
  }
}

/**
 * Wallet hook return type
 */
export interface UseWalletReturn {
  /** Smart wallet address */
  address: Address | null
  /** Whether the wallet is ready for transactions */
  ready: boolean
  /** Sign a message */
  signMessage: (message: string | Uint8Array) => Promise<Hex>
  /** Sign typed data */
  signTypedData: (typedData: Record<string, unknown>) => Promise<Hex>
  /** Send a transaction */
  sendTransaction: (tx: {
    to: Address
    data?: Hex
    value?: bigint
  }) => Promise<Hex>
}

/**
 * useBabylonWallet hook
 *
 * Returns the connected smart wallet address and ready state.
 */
export function useBabylonWallet(): UseWalletReturn {
  const oauth3 = useOAuth3()

  const signMessage = useCallback(
    async (message: string | Uint8Array): Promise<Hex> => {
      return oauth3.signMessage(message)
    },
    [oauth3.signMessage],
  )

  const signTypedData = useCallback(
    async (_typedData: Record<string, unknown>): Promise<Hex> => {
      // TODO: Implement typed data signing when available in OAuth3
      throw new Error('signTypedData not yet implemented')
    },
    [],
  )

  const sendTransaction = useCallback(
    async (_tx: { to: Address; data?: Hex; value?: bigint }): Promise<Hex> => {
      // TODO: Implement transaction sending via smart account
      throw new Error('sendTransaction not yet implemented')
    },
    [],
  )

  return {
    address: oauth3.smartAccountAddress,
    ready: oauth3.isAuthenticated && oauth3.smartAccountAddress !== null,
    signMessage,
    signTypedData,
    sendTransaction,
  }
}

// Aliases for backward compatibility
/** @deprecated Use useBabylonAuth instead */
export const useJejuAuth = useBabylonAuth

/** @deprecated Use useBabylonWallet instead */
export const useJejuWallet = useBabylonWallet

/** @deprecated Use BabylonAuthProvider instead */
export const JejuAuthProvider = BabylonAuthProvider
