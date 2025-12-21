import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

// Type for mock request
interface MockNextRequest {
  headers: {
    get: (name: string) => string | null;
  };
  cookies: {
    get: (name: string) => { value: string } | undefined;
  };
}

const mockVerifyAgentSession = mock();
const mockValidateSession = mock();
const mockSelect = mock();

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
  users: {
    id: 'id',
    oauth3Id: 'oauth3Id',
    walletAddress: 'walletAddress',
  },
}));

// Mock @babylon/auth - OAuth3Client
mock.module('@babylon/auth', () => ({
  getOAuth3Client: () => ({
    validateSession: mockValidateSession,
  }),
}));

// Import after mocks are set up
import { authenticate } from '../auth-middleware';

const createRequest = (token: string): NextRequest =>
  ({
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
    mockValidateSession.mockReset();
    mockSelect.mockReset();

    // Default mock chain for db.select().from().where().limit()
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });
  });

  it('returns agent user when session token is valid', async () => {
    mockVerifyAgentSession.mockReturnValueOnce({ agentId: 'agent-123' });

    const request = createRequest('agent-session-token');
    const result = await authenticate(request);

    expect(result).toEqual({
      userId: 'agent-123',
      oauth3Id: 'agent-123',
      isAgent: true,
    });
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it('falls back to oauth3 session when agent session missing and db user absent', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null);
    mockValidateSession.mockResolvedValueOnce({ identityId: 'oauth3-user' });

    // Mock empty db result
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });

    const request = createRequest('oauth3-token');
    const result = await authenticate(request);

    expect(result).toMatchObject({
      userId: 'oauth3-user',
      dbUserId: undefined,
      oauth3Id: 'oauth3-user',
      isAgent: false,
    });
  });

  it('returns canonical id when oauth3 user exists in db', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null);
    mockValidateSession.mockResolvedValueOnce({ identityId: 'oauth3-user' });

    // Mock db user found
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: 'db-user-id',
                walletAddress: '0xabc',
              },
            ]),
        }),
      }),
    });

    const request = createRequest('oauth3-token');
    const result = await authenticate(request);

    expect(result).toMatchObject({
      userId: 'db-user-id',
      dbUserId: 'db-user-id',
      oauth3Id: 'oauth3-user',
      walletAddress: '0xabc',
    });
  });

  it('throws descriptive error when oauth3 token is expired', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null);
    mockValidateSession.mockRejectedValueOnce(
      new Error('token expired: exp mismatch')
    );

    const request = createRequest('expired-token');

    await expect(authenticate(request)).rejects.toMatchObject({
      message: 'Authentication token has expired. Please refresh your session.',
      code: 'AUTH_FAILED',
    });
  });
});
