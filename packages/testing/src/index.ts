/**
 * @babylon/testing
 *
 * Testing utilities for Babylon built on @jejunetwork/tests infrastructure.
 *
 * This package provides:
 * - Load testing utilities (load tests, A2A stress tests)
 * - Test helpers and fixtures
 * - Integration with jeju test infrastructure
 *
 * Tests can be run via:
 * - `jeju test babylon` - Run all babylon tests
 * - `babylon test load` - Load testing via CLI
 * - `babylon test a2a` - A2A stress testing via CLI
 *
 * @example
 * ```typescript
 * import { LoadTestSimulator, TEST_SCENARIOS } from '@babylon/testing';
 *
 * const simulator = new LoadTestSimulator('http://localhost:5009');
 * const result = await simulator.runTest(TEST_SCENARIOS.NORMAL);
 * ```
 */

// Test helpers
export {
  cleanupStaleLocks,
  cleanupTestEnvironment,
  createIsolatedTestContext,
  ensureDatabaseReady,
  generateTestId,
  setupTestEnvironment,
  shouldSkipDatabaseTests,
  withTimeout,
} from '../helpers/index.js'

// A2A stress testing scenarios
export { A2A_TEST_SCENARIOS } from '../load-test/a2a-load-test-scenarios.js'
// Load testing utilities
export {
  type EndpointConfig,
  type LoadTestConfig,
  type LoadTestError,
  type LoadTestResult,
  LoadTestSimulator,
  type ResponseTimeStats,
  TEST_SCENARIOS,
  type ThroughputStats,
} from '../load-test/index.js'

// Shared types
export type {
  A2ARequestResult,
  BenchmarkConfig,
  SimulationConfig,
  SimulationResult,
  TestActor,
  TestUser,
} from '../shared/types.js'
