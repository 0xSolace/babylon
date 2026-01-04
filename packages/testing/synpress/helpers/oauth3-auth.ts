/**
 * OAuth3 Authentication Helpers for Babylon Synpress E2E Tests
 *
 * Re-exports common auth helpers from @jejunetwork/tests for convenience.
 *
 * @module @babylon/testing/synpress/helpers/oauth3-auth
 */

// Re-export common auth helpers from @jejunetwork/tests
export {
  ensureLoggedIn,
  ensureLoggedOut,
  getDisplayedWalletAddress,
  isOAuth3Authenticated,
  loginWithWallet,
  logout,
  TEST_WALLET_ADDRESS,
  waitForAuth,
} from '@jejunetwork/tests'
