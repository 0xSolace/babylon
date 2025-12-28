/**
 * OAuth3 Authentication Helpers for Babylon Synpress E2E Tests
 *
 * This module re-exports the canonical OAuth3 helpers from @jejunetwork/tests
 * and adds Babylon-specific configuration if needed.
 *
 * @module @babylon/testing/synpress/helpers/oauth3-auth
 */

// Re-export all OAuth3 helpers from Jeju
export {
  ensureLoggedIn,
  ensureLoggedOut,
  getDisplayedWalletAddress,
  isOAuth3Authenticated as isAuthenticated,
  loginWithWallet,
  logout,
  waitForAuth,
} from '@jejunetwork/tests'

// Re-export test wallet address for backward compatibility
import { TEST_WALLET_ADDRESS } from '@jejunetwork/tests'

/**
 * Default Anvil wallet address (first account from standard mnemonic)
 *
 * @deprecated Use TEST_WALLET_ADDRESS from @jejunetwork/tests instead
 */
export const DEFAULT_ANVIL_WALLET = {
  address: TEST_WALLET_ADDRESS,
  privateKey:
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5ef26407389dbfa0f123',
} as const
