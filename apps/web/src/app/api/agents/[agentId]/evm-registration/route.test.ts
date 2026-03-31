import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

const mockAuthenticateUser = mock();
const mockGetAgentEvmRegistrationStatus = mock();
const mockRegisterAgentOnEvmForOwner = mock();
const mockApplyRateLimit = mock();

mock.module('@babylon/api/auth-middleware', () => ({
  authenticateUser: mockAuthenticateUser,
}));

mock.module('@babylon/api/services/agent-evm-registration-service', () => ({
  getAgentEvmRegistrationStatus: mockGetAgentEvmRegistrationStatus,
  registerAgentOnEvmForOwner: mockRegisterAgentOnEvmForOwner,
}));

mock.module('@babylon/api/rate-limiting', () => ({
  applyRateLimit: mockApplyRateLimit,
  RATE_LIMIT_CONFIGS: {
    ONCHAIN_REGISTRATION: 'ONCHAIN_REGISTRATION',
  },
  rateLimitError: (retryAfter?: number) => {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter,
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
}));

mock.module('@babylon/api/error-handler', () => ({
  successResponse: (data: unknown) => {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
  withErrorHandling: (
    handler: (req: NextRequest, ctx: unknown) => Promise<unknown>
  ) => handler,
}));

const { GET, POST } = await import('./route');

function createMockRequest(): NextRequest {
  return {
    url: 'https://example.com/api/agents/agent-1/evm-registration',
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? 'Bearer test-token' : null,
    },
  } as unknown as NextRequest;
}

describe('/api/agents/[agentId]/evm-registration', () => {
  beforeEach(() => {
    mockApplyRateLimit.mockReset();
    mockAuthenticateUser.mockReset();
    mockGetAgentEvmRegistrationStatus.mockReset();
    mockRegisterAgentOnEvmForOwner.mockReset();

    mockApplyRateLimit.mockReturnValue({ allowed: true });
    mockAuthenticateUser.mockResolvedValue({ id: 'owner-1' });
  });

  it('returns the current EVM registration status for an owned agent', async () => {
    mockGetAgentEvmRegistrationStatus.mockResolvedValue({
      isRegistered: false,
      tokenId: null,
      metadataCid: null,
      txHash: null,
      walletAddress: '0xabc',
      walletReady: true,
      canRegister: true,
      cost: 100,
    });

    const response = (await GET(createMockRequest(), {
      params: Promise.resolve({ agentId: 'agent-1' }),
    })) as Response;
    const body = await response.json();

    expect(body.isRegistered).toBe(false);
    expect(body.walletReady).toBe(true);
    expect(body.canRegister).toBe(true);
    expect(mockGetAgentEvmRegistrationStatus).toHaveBeenCalledWith({
      ownerUserId: 'owner-1',
      agentUserId: 'agent-1',
    });
  });

  it('registers the agent on EVM for the owner', async () => {
    mockRegisterAgentOnEvmForOwner.mockResolvedValue({
      message: 'Successfully registered agent on-chain via Agent0',
      alreadyRegistered: false,
      agentUserId: 'agent-1',
      tokenId: 123,
      txHash: '0x123',
      walletAddress: '0xabc',
      cost: 100,
    });

    const response = (await POST(createMockRequest(), {
      params: Promise.resolve({ agentId: 'agent-1' }),
    })) as Response;
    const body = await response.json();

    expect(body.tokenId).toBe(123);
    expect(mockRegisterAgentOnEvmForOwner).toHaveBeenCalledWith({
      ownerUserId: 'owner-1',
      agentUserId: 'agent-1',
    });
  });

  it('rate limits repeated registration attempts', async () => {
    mockApplyRateLimit.mockReturnValueOnce({
      allowed: false,
      retryAfter: 42,
    });

    const response = (await POST(createMockRequest(), {
      params: Promise.resolve({ agentId: 'agent-1' }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.retryAfter).toBe(42);
    expect(mockRegisterAgentOnEvmForOwner).not.toHaveBeenCalled();
  });
});
