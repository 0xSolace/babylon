import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

const mockAuthenticateUser = mock();
const mockGetAgentSolanaRegistrationStatus = mock();
const mockRegisterAgentOnSolanaForOwner = mock();
const mockApplyRateLimit = mock();

mock.module('@babylon/api/auth-middleware', () => ({
  authenticateUser: mockAuthenticateUser,
}));

mock.module('@babylon/api/services/agent-solana-registration-service', () => ({
  getAgentSolanaRegistrationStatus: mockGetAgentSolanaRegistrationStatus,
  registerAgentOnSolanaForOwner: mockRegisterAgentOnSolanaForOwner,
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
    url: 'https://example.com/api/agents/agent-1/solana-registration',
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? 'Bearer test-token' : null,
    },
  } as unknown as NextRequest;
}

describe('/api/agents/[agentId]/solana-registration', () => {
  beforeEach(() => {
    mockApplyRateLimit.mockReset();
    mockAuthenticateUser.mockReset();
    mockGetAgentSolanaRegistrationStatus.mockReset();
    mockRegisterAgentOnSolanaForOwner.mockReset();

    mockApplyRateLimit.mockReturnValue({ allowed: true });
    mockAuthenticateUser.mockResolvedValue({ id: 'owner-1' });
  });

  it('returns the current Solana registration status for an owned agent', async () => {
    mockGetAgentSolanaRegistrationStatus.mockResolvedValue({
      isRegistered: false,
      assetId: null,
      metadataUri: null,
      txHash: null,
      walletAddress: 'SoLWallet111',
      walletReady: true,
      walletBalanceLamports: '20000000',
      walletBalanceSol: '0.02',
      minimumBalanceLamports: '21000000',
      minimumBalanceSol: '0.021',
      hasEnoughBalance: true,
      canRegister: true,
      cost: 100,
    });

    const response = (await GET(createMockRequest(), {
      params: Promise.resolve({ agentId: 'agent-1' }),
    })) as Response;
    const body = await response.json();

    expect(body.isRegistered).toBe(false);
    expect(body.walletBalanceSol).toBe('0.02');
    expect(body.canRegister).toBe(true);
    expect(mockGetAgentSolanaRegistrationStatus).toHaveBeenCalledWith({
      ownerUserId: 'owner-1',
      agentUserId: 'agent-1',
    });
  });

  it('registers the agent on Solana for the owner', async () => {
    mockRegisterAgentOnSolanaForOwner.mockResolvedValue({
      message: 'Successfully registered agent on Solana',
      alreadyRegistered: false,
      agentUserId: 'agent-1',
      assetId: 'asset-123',
      metadataUri: 'ipfs://cid-123',
      txHash: 'tx-123',
      walletAddress: 'SoLWallet111',
      cost: 100,
    });

    const response = (await POST(createMockRequest(), {
      params: Promise.resolve({ agentId: 'agent-1' }),
    })) as Response;
    const body = await response.json();

    expect(body.assetId).toBe('asset-123');
    expect(mockRegisterAgentOnSolanaForOwner).toHaveBeenCalledWith({
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
    expect(mockRegisterAgentOnSolanaForOwner).not.toHaveBeenCalled();
  });
});
