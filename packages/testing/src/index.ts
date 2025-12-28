/**
 * @babylon/testing
 *
 * Testing utilities for Babylon built on @jejunetwork/tests infrastructure.
 *
 * This package provides:
 * - Integration with Jeju test infrastructure (wallet, auth, preflight)
 * - Babylon-specific test helpers (DB setup, contract setup)
 * - Load testing utilities (load tests, A2A stress tests)
 * - Synpress fixtures for MetaMask testing
 *
 * Tests can be run via:
 * - `jeju test --target-app babylon` - Run all babylon tests via Jeju CLI
 * - `bun test` - Run unit/integration tests directly
 * - `bunx playwright test --config synpress.config.ts` - Run synpress tests
 *
 * @example
 * ```typescript
 * // Using Jeju infrastructure
 * import {
 *   test,
 *   expect,
 *   SEED_PHRASE,
 *   PASSWORD,
 *   connectAndVerify,
 * } from '@babylon/testing';
 *
 * test('should connect wallet', async ({ page, metamask }) => {
 *   await page.goto('/');
 *   await connectAndVerify(page, metamask);
 * });
 *
 * // Using load testing
 * import { LoadTestSimulator, A2A_TEST_SCENARIOS } from '@babylon/testing';
 *
 * const simulator = new LoadTestSimulator('http://localhost:5009');
 * const result = await simulator.runTest(A2A_TEST_SCENARIOS.NORMAL);
 * ```
 */

// ============================================================================
// Re-exports from @jejunetwork/tests (canonical testing infrastructure)
// ============================================================================

// Wallet constants
// Synpress test fixtures and helpers
// React Query test utilities
// Navigation and page helpers
// OAuth3 authentication helpers
// Test data constants (imported from local helpers to avoid synpress-cache zod issue)
// Synpress configuration
// Infrastructure utilities
export {
  approveTransaction,
  BASE_SELECTORS,
  basicSetup,
  checkContractsDeployed,
  checkRpcHealth,
  checkServiceHealth,
  connectAndVerify,
  connectWallet,
  cooldownBetweenTests,
  createQueryWrapper,
  createSmokeTestConfig,
  createSynpressConfig,
  createTestQueryClient,
  createWalletSetup,
  ensureLoggedIn,
  ensureLoggedOut,
  expect,
  findJejuWorkspaceRoot,
  GLOBAL_SETUP_PATH,
  GLOBAL_TEARDOWN_PATH,
  generateTestEmail,
  generateTestUsername,
  getChainId,
  getCurrentRoute,
  getDisplayedWalletAddress,
  getRpcUrl,
  getTestEnv,
  getWalletAddress,
  HTTP_STATUS,
  hideNextDevOverlay,
  invalidateAndWait,
  isAtRoute,
  isAuthenticated,
  isOAuth3Authenticated,
  isRpcAvailable,
  isServiceAvailable,
  JEJU_CHAIN,
  JEJU_CHAIN_ID,
  JEJU_RPC_URL,
  LockManager,
  loginWithWallet,
  logout,
  navigateTo,
  navigateToRoute,
  PASSWORD,
  QueryClient,
  QueryClientProvider,
  quickHealthCheck,
  rejectTransaction,
  runPreflightChecks,
  SEED_PHRASE,
  SYNPRESS_CACHE_DIR,
  signMessage,
  sleep,
  switchNetwork,
  TEST_ACCOUNTS,
  TEST_FORM_DATA,
  TEST_NUMBERS,
  TEST_WALLET_ADDRESS,
  TestQueryProvider,
  TIMEOUTS,
  TRADING_TEST_DATA,
  test,
  VIEWPORTS,
  verifyAuth,
  verifyDisconnected,
  waitForAuth,
  waitForChain,
  waitForPageLoad,
  waitForQueriesToSettle,
  waitForRoute,
  waitForRpc,
  waitForServerHealthy,
  waitForService,
  walletPassword,
  withTestLock,
} from '@jejunetwork/tests'
// generateTestId is exported from local helpers to avoid synpress-cache dependency
export { generateTestId } from '../helpers/setup'

// ============================================================================
// Babylon-specific helpers
// ============================================================================

// Contract setup (Babylon-specific contracts)
export {
  areContractsDeployed,
  deployContracts,
  ensureContractsReady,
  ensureHardhatRunning,
} from '../helpers/contract-setup'
// Database test setup (Babylon-specific, uses @babylon/db)
export {
  cleanupStaleLocks,
  cleanupTestEnvironment,
  createIsolatedTestContext,
  ensureDatabaseReady,
  setupTestEnvironment,
  shouldSkipDatabaseTests,
  withTimeout,
} from '../helpers/setup'

// Type guards
export * from '../helpers/type-guards'

// ============================================================================
// Load testing utilities
// ============================================================================

// A2A specific utilities
export {
  A2A_METHODS,
  generateA2ARequest,
  getA2AHeaders,
} from '../load-test/a2a-load-test-scenarios'
// Load test simulator and scenarios
export {
  A2A_TEST_SCENARIOS,
  type EndpointConfig,
  type EndpointStats,
  type LoadTestConfig,
  type LoadTestError,
  type LoadTestResult,
  LoadTestSimulator,
  type ResponseTimeStats,
  TEST_SCENARIOS,
  type ThroughputStats,
} from '../load-test/index'

// ============================================================================
// Babylon-specific types
// ============================================================================

export type {
  A2ARequestResult,
  BenchmarkConfig,
  SimulationConfig,
  SimulationResult,
  TestActor,
  TestUser,
} from '../shared/types'

// ============================================================================
// Babylon-specific test data
// ============================================================================

export {
  ADMIN_ROUTES,
  AUTHENTICATED_ROUTES,
  BABYLON_FORM_DATA,
  DEFAULT_ANVIL_ACCOUNT,
  PUBLIC_ROUTES,
  ROUTES,
  SELECTORS,
} from '../synpress/helpers/test-data'
