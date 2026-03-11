import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test';
import { NextRequest } from 'next/server';

const mockAuthenticate = mock(async () => ({ userId: 'user-123' }));
const mockRequireUserByIdentifier = mock(async () => ({ id: 'user-123' }));
const mockCheckProfileUpdateRateLimit = mock(async () => undefined);
const mockLogProfileUpdate = mock(async () => undefined);
const mockNotifyProfileComplete = mock(async () => undefined);
const mockAwardProfileCompletion = mock(async () => ({
  success: false,
  pointsAwarded: 0,
}));
const mockTrackServerEvent = mock(async () => undefined);

const mockCurrentUser = {
  id: 'user-123',
  username: 'existing-user',
  displayName: 'Existing User',
  bio: 'Existing bio that is already long enough to stay valid in tests.',
  profileImageUrl: 'https://example.com/avatar.png',
  coverImageUrl: 'https://example.com/cover.png',
  hasUsername: true,
  hasBio: true,
  hasProfileImage: true,
  reputationPoints: 42,
  referralCount: 3,
  referralCode: 'EXISTING',
  usernameChangedAt: new Date('2024-01-01T00:00:00.000Z'),
  pointsAwardedForProfile: false,
  walletAddress: '0x123',
  onChainRegistered: false,
  nftTokenId: null,
  profileChainSyncNeeded: false,
};

const mockUpdatedUser = {
  id: 'user-123',
  username: 'existing-user',
  displayName: 'Updated Name',
  bio: 'Existing bio that is already long enough to stay valid in tests.',
  profileImageUrl: 'https://example.com/avatar.png',
  coverImageUrl: 'https://example.com/cover.png',
  profileComplete: true,
  hasUsername: true,
  hasBio: true,
  hasProfileImage: true,
  reputationPoints: 42,
  referralCount: 3,
  referralCode: 'EXISTING',
  usernameChangedAt: new Date('2024-01-01T00:00:00.000Z'),
  onChainRegistered: false,
  nftTokenId: null,
  profileChainSyncNeeded: false,
};

const updateSetMock = mock((_data: unknown) => ({
  where: () => ({
    returning: async () => [mockUpdatedUser],
  }),
}));
const updateMock = mock(() => ({ set: updateSetMock }));

let POST: (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => Promise<Response>;

const createRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/users/user-123/update-profile', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('/api/users/[userId]/update-profile empty update behavior', () => {
  beforeAll(async () => {
    mock.module('@babylon/api', () => ({
      AuthorizationError: class AuthorizationError extends Error {},
      BusinessLogicError: class BusinessLogicError extends Error {},
      authenticate: mockAuthenticate,
      checkProfileUpdateRateLimit: mockCheckProfileUpdateRateLimit,
      confirmOnchainProfileUpdate: mock(async () => ({
        metadata: null,
        tokenId: null,
      })),
      logProfileUpdate: mockLogProfileUpdate,
      notifyProfileComplete: mockNotifyProfileComplete,
      PointsService: {
        awardProfileCompletion: mockAwardProfileCompletion,
        checkAndQualifyReferral: mock(async () => null),
      },
      requireUserByIdentifier: mockRequireUserByIdentifier,
      successResponse: (body: unknown) => Response.json(body),
      withErrorHandling: (
        handler: (
          request: NextRequest,
          context: { params: Promise<{ userId: string }> }
        ) => Promise<Response>
      ) => handler,
    }));

    mock.module('@babylon/db', async () => {
      const actual = await import('@babylon/db');
      return {
        ...actual,
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [mockCurrentUser],
              }),
            }),
          }),
          update: updateMock,
        },
      };
    });

    mock.module('@babylon/shared', async () => {
      const actual = await import('@babylon/shared');
      return {
        ...actual,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {},
        },
      };
    });

    mock.module('@/lib/posthog/server', () => ({
      trackServerEvent: mockTrackServerEvent,
    }));

    ({ POST } = await import(
      '../../../apps/web/src/app/api/users/[userId]/update-profile/route'
    ));
  });

  beforeEach(() => {
    mockAuthenticate.mockClear();
    mockRequireUserByIdentifier.mockClear();
    mockCheckProfileUpdateRateLimit.mockClear();
    mockLogProfileUpdate.mockClear();
    mockNotifyProfileComplete.mockClear();
    mockAwardProfileCompletion.mockClear();
    mockTrackServerEvent.mockClear();
    updateMock.mockClear();
    updateSetMock.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  it('skips db.update when sanitized update data is empty', async () => {
    const response = await POST(createRequest({}), {
      params: Promise.resolve({ userId: 'user-123' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
    expect(body.user.username).toBe('existing-user');
    expect(body.user.displayName).toBe('Existing User');
    expect(mockLogProfileUpdate).toHaveBeenCalledWith(
      'user-123',
      [],
      false,
      undefined
    );
  });

  it('omits undefined fields and only updates defined values', async () => {
    const response = await POST(
      createRequest({
        displayName: '  Updated Name  ',
        bio: undefined,
      }),
      {
        params: Promise.resolve({ userId: 'user-123' }),
      }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateSetMock).toHaveBeenCalledTimes(1);
    expect(updateSetMock.mock.calls[0]?.[0]).toEqual({
      displayName: 'Updated Name',
    });
    expect(body.user.displayName).toBe('Updated Name');
  });
});
