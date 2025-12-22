import { describe, expect, it, vi } from 'vitest';

/**
 * Auth Middleware Tests
 *
 * The auth middleware now re-exports from @babylon/api which uses OAuth3.
 * Tests for the actual authentication logic are in packages/api.
 *
 * This test file verifies the re-export works correctly.
 */

vi.mock('@babylon/api', () => ({
  authenticate: vi.fn(),
  authenticateUser: vi.fn(),
  authenticateWithDbUser: vi.fn(),
  authErrorResponse: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {
    code = 'AUTH_FAILED';
  },
  extractErrorMessage: vi.fn((e) =>
    e instanceof Error ? e.message : String(e)
  ),
  getAuthClient: vi.fn(),
  isAuthenticationError: vi.fn((e) => e?.code === 'AUTH_FAILED'),
  optionalAuth: vi.fn(),
  optionalAuthFromHeaders: vi.fn(),
}));

describe('auth-middleware re-exports', () => {
  it('exports authentication functions from @babylon/api', async () => {
    const exports = await import('../auth-middleware');

    expect(exports.authenticate).toBeDefined();
    expect(exports.authenticateUser).toBeDefined();
    expect(exports.authenticateWithDbUser).toBeDefined();
    expect(exports.authErrorResponse).toBeDefined();
    expect(exports.AuthenticationError).toBeDefined();
    expect(exports.extractErrorMessage).toBeDefined();
    expect(exports.getAuthClient).toBeDefined();
    expect(exports.isAuthenticationError).toBeDefined();
    expect(exports.optionalAuth).toBeDefined();
    expect(exports.optionalAuthFromHeaders).toBeDefined();
  });
});
