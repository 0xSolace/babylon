/**
 * Auth Helper for Load Testing
 *
 * Provides authentication utilities for load testing scenarios
 * that require authenticated requests.
 */

/**
 * Test user credentials for load testing
 */
export interface TestUserCredentials {
  userId: string;
  username: string;
  token: string;
}

/**
 * Create test user credentials for load testing
 */
export function createTestCredentials(userId: string): TestUserCredentials {
  return {
    userId,
    username: `test-user-${userId}`,
    // Mock JWT token for testing
    token: `test-token-${userId}`,
  };
}

/**
 * Generate headers for authenticated requests
 */
export function getAuthHeaders(
  credentials: TestUserCredentials
): Record<string, string> {
  return {
    Authorization: `Bearer ${credentials.token}`,
    'Content-Type': 'application/json',
    'x-user-id': credentials.userId,
  };
}

/**
 * Create multiple test users for concurrent load testing
 */
export function createTestUsers(count: number): TestUserCredentials[] {
  return Array.from({ length: count }, (_, i) =>
    createTestCredentials(`load-test-user-${i}`)
  );
}

/**
 * Get admin headers for admin-only endpoints
 */
export function getAdminHeaders(
  adminToken = 'test-admin-token'
): Record<string, string> {
  return {
    'x-admin-token': adminToken,
    'Content-Type': 'application/json',
  };
}
