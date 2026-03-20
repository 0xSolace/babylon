import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

// Type for mock request
interface MockNextRequest {
  url: string;
  headers: {
    get: (name: string) => string | null;
  };
  cookies: {
    get: (name: string) => { value: string } | undefined;
  };
}

const mockVerifyAgentSession = mock();
const mockVerifyAuthToken = mock();
const mockSelect = mock();

const usersTable = {
  id: 'id',
  privyId: 'privyId',
  walletAddress: 'walletAddress',
  isAdmin: 'isAdmin',
};

// Mock the local agent-auth module
mock.module('../agent-auth', () => ({
  verifyAgentSession: mockVerifyAgentSession,
}));

// Mock @babylon/db with Drizzle-style API
mock.module('@babylon/db', () => ({
  db: {
    select: mockSelect,
  },
  eq: (field: unknown, value: unknown) => ({ field, value }),
  users: usersTable,
}));

// Mock @privy-io/server-auth - PrivyClient is a class that gets instantiated
mock.module('@privy-io/server-auth', () => ({
  PrivyClient: class MockPrivyClient {
    verifyAuthToken = mockVerifyAuthToken;
  },
}));

// Import after mocks are set up
import {
  _resetPrivyClientForTesting,
  authenticate,
  optionalAuth,
  optionalAuthFromHeaders,
} from '../auth-middleware';

let usersRows: Array<{ id: string; walletAddress: string; isAdmin?: boolean }> =
  [];

const createRequest = (token: string, pathname: string): NextRequest =>
  ({
    url: `https://example.com${pathname}`,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null,
    },
    cookies: {
      get: () => undefined,
    },
  }) as MockNextRequest as NextRequest;

describe('authenticate middleware', () => {
  beforeEach(() => {
    mockVerifyAgentSession.mockReset();
    mockVerifyAuthToken.mockReset();
    mockSelect.mockReset();
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app';
    process.env.PRIVY_APP_SECRET = 'test-secret';
    usersRows = [];

    // Default mock chain for db.select().from().where().limit()
    mockSelect.mockImplementation(() => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => {
            if (table === usersTable) return Promise.resolve(usersRows);
            return Promise.resolve([]);
          },
        }),
      }),
    }));
  });

  it('returns agent user when session token is valid', async () => {
    mockVerifyAgentSession.mockReturnValueOnce({ agentId: 'agent-123' });

    const request = createRequest('agent-session-token', '/api/posts');
    const result = await authenticate(request);

    expect(result).toEqual({
      userId: 'agent-123',
      privyId: 'agent-123',
      isAgent: true,
    });
    expect(mockVerifyAuthToken).not.toHaveBeenCalled();
  });

  it('falls through to Privy auth when verifyAgentSession throws', async () => {
    mockVerifyAgentSession.mockRejectedValueOnce(
      new Error('Redis connection refused')
    );
    mockVerifyAuthToken.mockResolvedValueOnce({ userId: 'privy-user' });

    usersRows = [{ id: 'db-user-id', walletAddress: '0xabc', isAdmin: false }];

    const request = createRequest('privy-token', '/api/users/me');
    const result = await authenticate(request);

    expect(result).toMatchObject({
      userId: 'db-user-id',
      dbUserId: 'db-user-id',
      privyId: 'privy-user',
      isAgent: false,
    });
    // Privy was used as fallback
    expect(mockVerifyAuthToken).toHaveBeenCalledWith('privy-token');
  });

  it('throws ServiceUnavailableError when getPrivyClient fails', async () => {
    const savedAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const savedSecret = process.env.PRIVY_APP_SECRET;
    delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    delete process.env.PRIVY_APP_SECRET;

    // Reset the lazy singleton so getPrivyClient re-reads env vars
    _resetPrivyClientForTesting();

    mockVerifyAgentSession.mockReturnValueOnce(null);

    const request = createRequest('some-token', '/api/users/me');

    try {
      await authenticate(request);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'Authentication service unavailable. Please try again later.'
      );
      expect((error as { code: string }).code).toBe('SERVICE_UNAVAILABLE');
      expect((error as { statusCode: number }).statusCode).toBe(503);
    } finally {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = savedAppId;
      process.env.PRIVY_APP_SECRET = savedSecret;
      // Re-reset so subsequent tests get a fresh client with correct env
      _resetPrivyClientForTesting();
    }
  });

  it('falls back to privy claims when agent session missing and db user absent', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null);
    mockVerifyAuthToken.mockResolvedValueOnce({ userId: 'privy-user' });

    usersRows = [];

    const request = createRequest('privy-token', '/api/users/me');
    const result = await authenticate(request);

    expect(result).toMatchObject({
      userId: 'privy-user',
      dbUserId: undefined,
      privyId: 'privy-user',
      isAgent: false,
    });
  });

  it('returns canonical id when privy user exists in db', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null);
    mockVerifyAuthToken.mockResolvedValueOnce({ userId: 'privy-user' });

    // Mock db user found
    usersRows = [{ id: 'db-user-id', walletAddress: '0xabc', isAdmin: false }];

    const request = createRequest('privy-token', '/api/users/me');
    const result = await authenticate(request);

    expect(result).toMatchObject({
      userId: 'db-user-id',
      dbUserId: 'db-user-id',
      privyId: 'privy-user',
      walletAddress: '0xabc',
      isAdmin: false,
    });
  });

  it('throws descriptive error when privy token is expired', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null);
    mockVerifyAuthToken.mockRejectedValueOnce(
      new Error('token expired: exp mismatch')
    );

    const request = createRequest('expired-token', '/api/users/me');

    try {
      await authenticate(request);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'Authentication token has expired. Please refresh your session.'
      );
      expect((error as { code: string }).code).toBe('AUTH_FAILED');
    }
  });

  it('normalizes malformed token verification failures to AuthenticationError', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null);
    mockVerifyAuthToken.mockRejectedValueOnce(new Error('jwt malformed'));

    const request = createRequest('garbage-token', '/api/users/me');

    try {
      await authenticate(request);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'Invalid authentication token. Please sign in again.'
      );
      expect((error as { code: string }).code).toBe('AUTH_FAILED');
    }
  });

  it('does not enforce the removed NFT gate even if the legacy env flag is set', async () => {
    process.env.NFT_GATING_ENABLED = 'true';

    mockVerifyAgentSession.mockReturnValueOnce(null);
    mockVerifyAuthToken.mockResolvedValueOnce({ userId: 'privy-user' });
    usersRows = [{ id: 'db-user-id', walletAddress: '0xabc', isAdmin: false }];

    const request = createRequest('privy-token', '/api/posts');
    const result = await authenticate(request);

    expect(result).toMatchObject({
      userId: 'db-user-id',
      dbUserId: 'db-user-id',
    });
  });
});

describe('optionalAuth', () => {
  beforeEach(() => {
    mockVerifyAgentSession.mockReset();
    mockVerifyAuthToken.mockReset();
    mockSelect.mockReset();
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app';
    process.env.PRIVY_APP_SECRET = 'test-secret';
    usersRows = [];

    mockSelect.mockImplementation(() => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => {
            if (table === usersTable) return Promise.resolve(usersRows);
            return Promise.resolve([]);
          },
        }),
      }),
    }));
  });

  it('returns null when verifyAgentSession throws instead of 500', async () => {
    mockVerifyAgentSession.mockRejectedValueOnce(
      new Error('Redis connection refused')
    );
    mockVerifyAuthToken.mockResolvedValueOnce({ userId: 'privy-user' });
    usersRows = [{ id: 'db-user-id', walletAddress: '0xabc', isAdmin: false }];

    const request = createRequest('some-token', '/api/posts');
    const result = await optionalAuth(request);

    // Should fall through to Privy and succeed, not throw 500
    expect(result).toMatchObject({
      userId: 'db-user-id',
      privyId: 'privy-user',
      isAgent: false,
    });
    expect(mockVerifyAuthToken).toHaveBeenCalledWith('some-token');
  });

  it('returns null when getPrivyClient fails instead of 500', async () => {
    const savedAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const savedSecret = process.env.PRIVY_APP_SECRET;
    delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    delete process.env.PRIVY_APP_SECRET;
    _resetPrivyClientForTesting();

    mockVerifyAgentSession.mockReturnValueOnce(null);

    const request = createRequest('some-token', '/api/posts');

    try {
      const result = await optionalAuth(request);
      expect(result).toBeNull();
    } finally {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = savedAppId;
      process.env.PRIVY_APP_SECRET = savedSecret;
      _resetPrivyClientForTesting();
    }
  });

  it('returns null when no token is provided', async () => {
    const request = {
      url: 'https://example.com/api/posts',
      headers: { get: () => null },
      cookies: { get: () => undefined },
    } as unknown as NextRequest;

    const result = await optionalAuth(request);
    expect(result).toBeNull();
  });
});

describe('optionalAuthFromHeaders', () => {
  beforeEach(() => {
    mockVerifyAgentSession.mockReset();
    mockVerifyAuthToken.mockReset();
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app';
    process.env.PRIVY_APP_SECRET = 'test-secret';
  });

  const createHeaders = (token?: string): Headers => {
    const headers = new Headers();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  };

  it('returns null when verifyAgentSession throws instead of 500', async () => {
    mockVerifyAgentSession.mockRejectedValueOnce(
      new Error('Redis connection refused')
    );
    mockVerifyAuthToken.mockResolvedValueOnce({ userId: 'privy-user' });

    const headers = createHeaders('some-token');
    const result = await optionalAuthFromHeaders(headers);

    // Should fall through to Privy and succeed, not throw 500
    expect(result).toMatchObject({
      userId: 'privy-user',
      isAgent: false,
    });
    expect(mockVerifyAuthToken).toHaveBeenCalledWith('some-token');
  });

  it('returns null when getPrivyClient fails instead of 500', async () => {
    const savedAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const savedSecret = process.env.PRIVY_APP_SECRET;
    delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    delete process.env.PRIVY_APP_SECRET;
    _resetPrivyClientForTesting();

    mockVerifyAgentSession.mockReturnValueOnce(null);

    const headers = createHeaders('some-token');

    try {
      const result = await optionalAuthFromHeaders(headers);
      expect(result).toBeNull();
    } finally {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = savedAppId;
      process.env.PRIVY_APP_SECRET = savedSecret;
      _resetPrivyClientForTesting();
    }
  });

  it('returns null when no authorization header is provided', async () => {
    const headers = createHeaders();
    const result = await optionalAuthFromHeaders(headers);
    expect(result).toBeNull();
  });
});
