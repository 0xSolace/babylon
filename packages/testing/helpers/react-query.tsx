/**
 * React Query Test Utilities
 *
 * Provides test-specific QueryClient configuration and wrapper components
 * for testing components that use React Query.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

/**
 * Creates a QueryClient configured for testing
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Wrapper component for testing components that use React Query
 */
export function TestQueryProvider({
  children,
  client,
}: {
  children: ReactNode
  client?: QueryClient
}): ReactElement {
  const queryClient = client ?? createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Export for use in tests
export { QueryClient, QueryClientProvider }
