import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

const mockAuthenticateUser = mock();
const mockListUserAgents = mock();
const mockGetPerformance = mock();
const mockGetAgentConfig = mock();
const mockLoggerWarn = mock();
const mockLoggerInfo = mock();

mock.module('@babylon/agents', () => ({
  agentService: {
    listUserAgents: mockListUserAgents,
    getPerformance: mockGetPerformance,
  },
  getAgentConfig: mockGetAgentConfig,
  isAutonomousTradingEnabled: (
    config: { autonomousTrading?: boolean } | null
  ) => config?.autonomousTrading ?? false,
}));

mock.module('@babylon/api', () => ({
  authenticateUser: mockAuthenticateUser,
  withErrorHandling: (handler: (request: NextRequest) => Promise<unknown>) =>
    handler,
}));

mock.module('@babylon/shared', () => ({
  logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
  },
}));

const { GET } = await import('./route');

describe('GET /api/agents', () => {
  beforeEach(() => {
    mockAuthenticateUser.mockReset();
    mockListUserAgents.mockReset();
    mockGetPerformance.mockReset();
    mockGetAgentConfig.mockReset();
    mockLoggerWarn.mockReset();
    mockLoggerInfo.mockReset();
  });

  it('returns a successful response even if per-agent stats fail', async () => {
    mockAuthenticateUser.mockResolvedValue({ id: 'user-1' });
    mockListUserAgents.mockResolvedValue([
      {
        id: 'agent-1',
        username: 'agent-one',
        displayName: 'Agent One',
        bio: 'bio',
        profileImageUrl: null,
        virtualBalance: '42.00',
        lifetimePnL: '5.50',
        walletAddress: null,
        onChainRegistered: false,
        agent0TokenId: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      },
    ]);
    mockGetPerformance.mockRejectedValue(new Error('broken trade row'));
    mockGetAgentConfig.mockResolvedValue(null);

    const response = (await GET({
      url: 'https://example.com/api/agents',
    } as NextRequest)) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0]).toMatchObject({
      id: 'agent-1',
      totalTrades: 0,
      profitableTrades: 0,
      winRate: 0,
      autonomousTrading: false,
    });
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});
