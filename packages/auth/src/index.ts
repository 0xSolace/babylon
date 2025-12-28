/**
 * @babylon/auth
 *
 * Babylon-specific authentication layer built on @jejunetwork/auth.
 * For core auth functionality, import directly from @jejunetwork/auth.
 */

// Re-export commonly used items from @jejunetwork/auth
export {
  AuthProvider,
  ChainId,
  createOAuth3Client,
  OAuth3Client,
  type OAuth3Config,
  OAuth3Provider,
  type OAuth3Session,
  type SponsorshipPolicy,
  useOAuth3,
} from '@jejunetwork/auth'

// =============================================================================
// Babylon OAuth3 Client Factory
// =============================================================================

import {
  createOAuth3Client as createBaseClient,
  type OAuth3Config,
} from '@jejunetwork/auth'

// Singleton OAuth3 client instance
let oauth3ClientInstance: ReturnType<typeof createBaseClient> | null = null

/**
 * Get a singleton OAuth3 client configured for Babylon.
 * Uses lazy initialization - client is created on first call.
 */
export function getOAuth3Client(
  config: Partial<OAuth3Config> = {},
): ReturnType<typeof createBaseClient> {
  if (!oauth3ClientInstance) {
    oauth3ClientInstance = createBaseClient({
      appId: config.appId ?? 'babylon.apps.jeju',
      chainId: config.chainId ?? 420690, // testnet by default
      redirectUri: config.redirectUri ?? '',
      ...config,
    })
  }
  return oauth3ClientInstance
}

/**
 * Reset the OAuth3 client singleton (for testing)
 */
export function resetOAuth3Client(): void {
  oauth3ClientInstance = null
}
