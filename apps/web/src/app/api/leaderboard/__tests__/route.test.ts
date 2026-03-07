import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockGetCache = mock();
const mockOptionalAuth = mock();
const mockGetWalletLeaderboard = mock();
const mockGetTeamLeaderboard = mock();
const mockGetUserPosition = mock();
const mockSetCache = mock();
const mockLoggerInfo = mock();

mock.module('@babylon/api', () => ({
  getCache: mockGetCache,
  optionalAuth: mockOptionalAuth,
  PointsService: {
    getWalletLeaderboard: mockGetWalletLeaderboard,
    getTeamLeaderboard: mockGetTeamLeaderboard,
    getUserPosition: mockGetUserPosition,
  },
  setCache: mockSetCache,
  successResponse: (
    body: unknown,
    status = 200,
    headers?: Record<string, string>
  ) =>
    new Response(JSON.stringify(body), {
      status,
      headers,
    }),
  withErrorHandling: (handler: (...args: unknown[]) => unknown) => handler,
}));

mock.module('@babylon/shared', () => ({
  LeaderboardQuerySchema: {
    safeParse: (input: Record<string, string>) => ({
      success: true,
      data: {
        page: Number(input.page ?? 1) || 1,
        pageSize: Number(input.pageSize ?? 100) || 100,
        type: input.type === 'team' ? 'team' : 'wallet',
        userId: input.userId,
      },
    }),
  },
  logger: {
    info: mockLoggerInfo,
  },
}));

import { GET } from '../route';

const leaderboardData = {
  users: [
    {
      id: 'user-1',
      username: 'alice',
      displayName: 'Alice',
      profileImageUrl: null,
      totalPoints: 123,
      balance: 456,
      lifetimePnL: 7,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      rank: 1,
      isAgent: false,
      onChainRegistered: false,
      nftTokenId: null,
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 100,
  totalPages: 1,
};

function createRequest(url: string): {
  url: string;
} {
  return { url };
}

describe('GET /api/leaderboard', () => {
  beforeEach(() => {
    mockGetCache.mockReset();
    mockOptionalAuth.mockReset();
    mockGetWalletLeaderboard.mockReset();
    mockGetTeamLeaderboard.mockReset();
    mockGetUserPosition.mockReset();
    mockSetCache.mockReset();
    mockLoggerInfo.mockReset();

    mockGetCache.mockResolvedValue(leaderboardData);
    mockGetWalletLeaderboard.mockResolvedValue(leaderboardData);
    mockGetTeamLeaderboard.mockResolvedValue(leaderboardData);
    mockGetUserPosition.mockResolvedValue({
      rank: 3,
      page: 1,
      entry: leaderboardData.users[0],
    });
  });

  it('populates currentUser from auth when userId query param is absent', async () => {
    mockOptionalAuth.mockResolvedValue({
      userId: 'privy-user',
      dbUserId: 'db-user-1',
      isAgent: false,
    });

    const response = (await GET(
      createRequest('https://example.com/api/leaderboard')
    )) as Response;
    const body = await response.json();

    expect(mockGetUserPosition).toHaveBeenCalledWith(
      'db-user-1',
      'wallet',
      100
    );
    expect(body.currentUser.rank).toBe(3);
    expect(body.currentUser.page).toBe(1);
    expect(body.currentUser.entry).toMatchObject({
      id: 'user-1',
      username: 'alice',
      rank: 1,
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('keeps public cache headers when the request is anonymous', async () => {
    mockOptionalAuth.mockResolvedValue(null);

    const response = (await GET(
      createRequest('https://example.com/api/leaderboard?type=team')
    )) as Response;
    const body = await response.json();

    expect(mockGetUserPosition).not.toHaveBeenCalled();
    expect(body.currentUser).toBeNull();
    expect(response.headers.get('Cache-Control')).toContain(
      'public, s-maxage='
    );
  });
});
