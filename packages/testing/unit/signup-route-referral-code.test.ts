import { beforeEach, describe, expect, it, mock } from 'bun:test';
import * as babylonDb from '@babylon/db';
import * as actualShared from '@babylon/shared';
import type { NextRequest } from 'next/server';

const mockAuthenticate = mock();
const mockEnsureOfflineWalletReady = mock();
const mockGetHashedClientIp = mock();
const mockIsReferralCodeAvailableForUser = mock();
const mockNotifyNewAccount = mock();
const mockTrackServerEvent = mock();
const mockGetOrCreateReferralCode = mock();
const mockAwardReferralSignup = mock();
const mockAwardPoints = mock();
const mockAwardFarcasterLink = mock();
const mockAwardTwitterLink = mock();
const mockAwardWalletConnect = mock();
const mockAwardProfileCompletion = mock();
const mockWithRetry = mock();
const mockWithTransaction = mock();
const mockInvalidateUserIdentifierCaches = mock(async () => undefined);

const mockOnboardingProfileSchema = {
  extend: () => ({
    parse: (body: Record<string, unknown>) => body,
  }),
};

class MockNextRequest {
  headers: Headers;
  #body: string;

  constructor(
    _url: string,
    init: {
      body?: string;
      headers?: Record<string, string>;
      method?: string;
    } = {}
  ) {
    this.headers = new Headers(init.headers);
    this.#body = init.body ?? '{}';
  }

  async json() {
    return JSON.parse(this.#body);
  }
}

class MockConflictError extends Error {}
class MockInternalServerError extends Error {}

mock.module('next/server', () => ({
  NextRequest: MockNextRequest,
}));

mock.module('zod', () => {
  const createChain = () => {
    const chain: Record<string, unknown> = {};
    chain.min = mock(() => chain);
    chain.optional = mock(() => chain);
    chain.or = mock(() => chain);
    chain.transform = mock(() => chain);
    chain.default = mock(() => chain);

    return chain;
  };

  return {
    z: {
      string: () => createChain(),
      boolean: () => createChain(),
      literal: () => createChain(),
    },
  };
});

mock.module('@babylon/api', () => ({
  authenticate: mockAuthenticate,
  cachedDb: {
    invalidateUserIdentifierCaches: mockInvalidateUserIdentifierCaches,
  },
  ConflictError: MockConflictError,
  ensureOfflineWalletReady: mockEnsureOfflineWalletReady,
  getHashedClientIp: mockGetHashedClientIp,
  getOrCreateReferralCode: mockGetOrCreateReferralCode,
  getPrivyClient: mock(() => ({
    getUserFromIdToken: mock(),
  })),
  InternalServerError: MockInternalServerError,
  isReferralCodeAvailableForUser: mockIsReferralCodeAvailableForUser,
  notifyNewAccount: mockNotifyNewAccount,
  PointsService: {
    awardReferralSignup: mockAwardReferralSignup,
    awardPoints: mockAwardPoints,
    awardFarcasterLink: mockAwardFarcasterLink,
    awardTwitterLink: mockAwardTwitterLink,
    awardWalletConnect: mockAwardWalletConnect,
    awardProfileCompletion: mockAwardProfileCompletion,
  },
  successResponse: (data: unknown) =>
    Response.json({
      success: true,
      ...(typeof data === 'object' && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}),
    }),
  withErrorHandling: (
    handler: (request: MockNextRequest) => Promise<Response>
  ) => handler,
}));

mock.module('@babylon/db', () => ({
  ...babylonDb,
  and: (...conditions: unknown[]) => conditions,
  eq: (left: unknown, right: unknown) => ({ left, right }),
  isRetryableError: mock(() => false),
  ne: (left: unknown, right: unknown) => ({ left, right }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
  toDatabaseErrorType: mock((error: unknown) => error),
  withRetry: mockWithRetry,
}));

const signupMockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(async () => [] as { id?: string }[]),
      })),
    })),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(() => ({
        returning: mock(async () => [{ virtualBalance: '1000' }]),
      })),
    })),
  })),
  insert: mock(() => ({
    values: mock(async () => undefined),
  })),
};

mock.module('@babylon/db/engine-storage', () => ({
  balanceTransactions: {
    id: 'balanceTransactions.id',
    userId: 'balanceTransactions.userId',
    description: 'balanceTransactions.description',
  },
  db: signupMockDb,
  follows: { id: 'follows.id' },
  referrals: { id: 'referrals.id' },
  users: {
    id: 'users.id',
    walletAddress: 'users.walletAddress',
    username: 'users.username',
    virtualBalance: 'users.virtualBalance',
    totalDeposited: 'users.totalDeposited',
  },
  asSystem: async <T>(op: (tx: typeof signupMockDb) => Promise<T>) =>
    op(signupMockDb),
}));

mock.module('@babylon/engine', () => ({
  UserAlphaGroupAssignmentService: {
    assignDefaultGroups: mock(async () => ({
      groupsAssigned: 0,
      assignments: [],
      errors: [],
    })),
  },
}));

mock.module('@babylon/shared', () => ({
  ...actualShared,
  checkForAdminEmail: mock(() => ({
    adminEmail: null,
    allVerifiedEmails: [],
  })),
  generateSnowflakeId: mock(async () => 'generated-id'),
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  },
  OnboardingProfileSchema: mockOnboardingProfileSchema,
  POINTS: {
    INITIAL_SIGNUP: 1000,
    REFERRAL_BONUS: 100,
  },
}));

mock.module('@/lib/posthog/server', () => ({
  trackServerEvent: mockTrackServerEvent,
}));

const { POST } = await import(
  '../../../apps/web/src/app/api/users/signup/route'
);

describe('signup route referral code handling', () => {
  beforeEach(() => {
    mockAuthenticate.mockReset();
    mockEnsureOfflineWalletReady.mockReset();
    mockGetHashedClientIp.mockReset();
    mockIsReferralCodeAvailableForUser.mockReset();
    mockNotifyNewAccount.mockReset();
    mockTrackServerEvent.mockReset();
    mockGetOrCreateReferralCode.mockReset();
    mockAwardReferralSignup.mockReset();
    mockAwardPoints.mockReset();
    mockAwardFarcasterLink.mockReset();
    mockAwardTwitterLink.mockReset();
    mockAwardWalletConnect.mockReset();
    mockAwardProfileCompletion.mockReset();
    mockWithRetry.mockReset();
    mockWithTransaction.mockReset();
    mockInvalidateUserIdentifierCaches.mockReset();

    mockAuthenticate.mockResolvedValue({
      userId: 'user_1',
      dbUserId: 'user_1',
      privyId: 'did:privy:user_1',
      walletAddress: null,
    });
    mockEnsureOfflineWalletReady.mockResolvedValue({
      privyWalletId: null,
      walletAddress: null,
      offlineWalletReady: true,
    });
    mockGetHashedClientIp.mockReturnValue(null);
    mockIsReferralCodeAvailableForUser.mockResolvedValue(true);
    mockNotifyNewAccount.mockResolvedValue(undefined);
    mockTrackServerEvent.mockResolvedValue(undefined);
    mockAwardReferralSignup.mockResolvedValue({
      success: false,
      pointsAwarded: 0,
      error: 'not-applicable',
    });
    mockAwardPoints.mockResolvedValue({
      success: true,
      pointsAwarded: 0,
      newTotal: 0,
    });
    mockAwardFarcasterLink.mockResolvedValue({ pointsAwarded: 0 });
    mockAwardTwitterLink.mockResolvedValue({ pointsAwarded: 0 });
    mockAwardWalletConnect.mockResolvedValue({ pointsAwarded: 0 });
    mockAwardProfileCompletion.mockResolvedValue({ pointsAwarded: 0 });
    mockWithRetry.mockResolvedValue({
      user: {
        id: 'user_1',
        privyId: 'did:privy:user_1',
        username: 'alice',
        displayName: 'Alice',
        bio: '',
        profileImageUrl: null,
        coverImageUrl: null,
        walletAddress: null,
        profileComplete: true,
        hasUsername: true,
        hasBio: false,
        hasProfileImage: false,
        onChainRegistered: false,
        nftTokenId: null,
        referralCode: 'alice',
        referredBy: null,
        reputationPoints: 1000,
        pointsAwardedForProfile: true,
        hasFarcaster: false,
        hasTwitter: false,
        farcasterUsername: null,
        twitterUsername: null,
        createdAt: new Date('2026-03-20T20:11:55.000Z'),
        updatedAt: new Date('2026-03-20T20:11:55.000Z'),
      },
      referrerId: null,
      referralRecordId: null,
    });
    mockWithTransaction.mockResolvedValue(undefined);
  });

  it('returns success after post-signup referral code ensure + cache invalidation', async () => {
    mockGetOrCreateReferralCode.mockResolvedValue('alice');

    const request = new MockNextRequest(
      'https://babylon.market/api/users/signup',
      {
        method: 'POST',
        body: JSON.stringify({
          username: 'alice',
          displayName: 'Alice',
          isWaitlist: true,
        }),
        headers: {
          'content-type': 'application/json',
        },
      }
    );

    const response = await POST(request as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.referralCode).toBe('alice');
    expect(mockGetOrCreateReferralCode).toHaveBeenCalledWith('user_1');
    expect(mockInvalidateUserIdentifierCaches).toHaveBeenCalled();
    expect(mockNotifyNewAccount).toHaveBeenCalledWith('user_1');
    expect(mockTrackServerEvent).toHaveBeenCalledWith(
      'user_1',
      'signup_completed',
      expect.objectContaining({
        username: 'alice',
      })
    );
  });
});
