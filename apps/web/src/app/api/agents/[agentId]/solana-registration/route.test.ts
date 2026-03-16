import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

const mockAuthenticateUser = mock();
const mockGetAgentSolanaRegistrationStatus = mock();
const mockRegisterAgentOnSolanaForOwner = mock();

mock.module('@babylon/api', () => ({
  authenticateUser: mockAuthenticateUser,
  getAgentSolanaRegistrationStatus: mockGetAgentSolanaRegistrationStatus,
  registerAgentOnSolanaForOwner: mockRegisterAgentOnSolanaForOwner,
  successResponse: (data: unknown) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(data, { status: 200 });
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
    mockAuthenticateUser.mockReset();
    mockGetAgentSolanaRegistrationStatus.mockReset();
    mockRegisterAgentOnSolanaForOwner.mockReset();

    mockAuthenticateUser.mockResolvedValue({ id: 'owner-1' });
  });

  it('returns the current Solana registration status for an owned agent', async () => {
    mockGetAgentSolanaRegistrationStatus.mockResolvedValue({
      isRegistered: false,
      assetId: null,
      metadataUri: null,
      txHash: null,
      walletAddress: null,
      walletReady: false,
      cost: 100,
    });

    const response = (await GET(createMockRequest(), {
      params: Promise.resolve({ agentId: 'agent-1' }),
    })) as Response;
    const body = await response.json();

    expect(body.isRegistered).toBe(false);
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
});
