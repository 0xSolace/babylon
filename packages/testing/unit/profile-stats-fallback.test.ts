import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockGetUserProfileStats = mock();
const mockLogger = {
  warn: mock(),
  error: mock(),
};

mock.module('@babylon/api', () => ({
  cachedDb: {
    getUserProfileStats: mockGetUserProfileStats,
  },
}));

mock.module('@babylon/shared', () => ({
  logger: mockLogger,
}));

const { getOptionalProfileStats } = await import(
  '../../../apps/web/src/lib/users/profile-stats'
);

describe('getOptionalProfileStats', () => {
  beforeEach(() => {
    mockGetUserProfileStats.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
  });

  it('returns stats when cache lookup succeeds', async () => {
    const stats = {
      followers: 4,
      following: 2,
      positions: 1,
      comments: 3,
      reactions: 5,
      posts: 6,
    };
    mockGetUserProfileStats.mockResolvedValue(stats);

    const result = await getOptionalProfileStats('user-1', 'ProfileRoute');

    expect(result).toEqual(stats);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('returns undefined and warns when stats are unavailable', async () => {
    mockGetUserProfileStats.mockResolvedValue(null);

    const result = await getOptionalProfileStats('user-1', 'ProfileRoute');

    expect(result).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('returns undefined and logs when stats fetching throws', async () => {
    mockGetUserProfileStats.mockRejectedValue(new Error('redis unavailable'));

    const result = await getOptionalProfileStats('user-1', 'ProfileRoute');

    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
