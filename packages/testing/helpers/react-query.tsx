/**
 * React Query Test Utilities
 *
 * Re-exports the canonical React Query test utilities from @jejunetwork/tests.
 * Use these for testing React components that use TanStack Query.
 *
 * @module @babylon/testing/helpers/react-query
 */

// Re-export all React Query test utilities from Jeju
export {
  createQueryWrapper,
  createTestQueryClient,
  invalidateAndWait,
  QueryClient,
  QueryClientProvider,
  TestQueryProvider,
  waitForQueriesToSettle,
} from '@jejunetwork/tests'
