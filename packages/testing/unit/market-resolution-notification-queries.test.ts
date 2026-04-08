import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as actualApi from '@babylon/api';
import * as actualShared from '@babylon/shared';

const positionsTable = {
  marketId: 'positions.marketId',
  status: 'positions.status',
  outcome: 'positions.outcome',
  pnl: 'positions.pnl',
  resolvedAt: 'positions.resolvedAt',
  shares: 'positions.shares',
  userId: 'positions.userId',
};

const usersTable = {
  id: 'users.id',
  managedBy: 'users.managedBy',
  isAgent: 'users.isAgent',
  displayName: 'users.displayName',
};

const marketsTable = {
  id: 'markets.id',
  question: 'markets.question',
};

type Condition =
  | {
      op: 'and' | 'or';
      conditions: Condition[];
    }
  | {
      op: 'eq' | 'gt' | 'gte' | 'lt';
      left: unknown;
      right: unknown;
    }
  | {
      op: 'isNotNull';
      value: unknown;
    };

let capturedWhere: unknown = null;

const mockWhere = mock(async (condition: unknown) => {
  capturedWhere = condition;
  return [];
});

const mockCreateNotification = mock(async () => ({ created: true }));
const mockBroadcastToChannel = mock(async () => undefined);
const mockSendNotificationEmail = mock(async () => undefined);

mock.module('@babylon/api', () => ({
  ...actualApi,
  broadcastToChannel: mockBroadcastToChannel,
  createNotification: mockCreateNotification,
  sendNotificationEmail: mockSendNotificationEmail,
}));

mock.module('@babylon/shared', () => ({
  ...actualShared,
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  },
}));

mock.module('@babylon/db', () => ({
  and: (...conditions: Condition[]) => ({ op: 'and', conditions }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  gt: (left: unknown, right: unknown) => ({ op: 'gt', left, right }),
  gte: (left: unknown, right: unknown) => ({ op: 'gte', left, right }),
  isNotNull: (value: unknown) => ({ op: 'isNotNull', value }),
  lt: (left: unknown, right: unknown) => ({ op: 'lt', left, right }),
  or: (...conditions: Condition[]) => ({ op: 'or', conditions }),
}));

const marketResolutionMockDb = {
  select: mock(() => ({
    from: mock(() => ({
      innerJoin: mock(() => ({
        leftJoin: mock(() => ({
          where: mockWhere,
        })),
      })),
    })),
  })),
};

mock.module('@babylon/db/engine-storage', () => ({
  db: marketResolutionMockDb,
  markets: marketsTable,
  positions: positionsTable,
  users: usersTable,
  asSystem: async <T>(
    op: (c: typeof marketResolutionMockDb) => Promise<T>,
    _operationName?: string
  ) => op(marketResolutionMockDb),
  asUser: async <T>(
    _userIdOrUser: unknown,
    op: (c: typeof marketResolutionMockDb) => Promise<T>
  ) => op(marketResolutionMockDb),
}));

const { notifyResolvedMarketOwners } = await import(
  '../../../apps/web/src/lib/services/market-resolution-notifications'
);
const { buildDigestForUser } = await import(
  '../../../apps/web/src/lib/services/notification-digest-service'
);

function expectSharesFilter(condition: unknown) {
  expect(condition).not.toBeNull();
  const serialized = JSON.stringify(condition);
  expect(serialized).toContain('positions.shares');
  expect(serialized).toContain('>');
  expect(serialized).toContain('0');
}

describe('market resolution notification queries', () => {
  beforeEach(() => {
    capturedWhere = null;
    mockWhere.mockClear();
    mockCreateNotification.mockClear();
    mockBroadcastToChannel.mockClear();
    mockSendNotificationEmail.mockClear();
  });

  test('notifyResolvedMarketOwners excludes zero-share positions', async () => {
    const createdCount = await notifyResolvedMarketOwners('market-1');

    expect(createdCount).toBe(0);
    expectSharesFilter(capturedWhere);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  test('buildDigestForUser excludes zero-share positions', async () => {
    const digest = await buildDigestForUser({
      userId: 'user-1',
      frequency: 'daily',
      now: new Date('2026-03-20T15:00:00.000Z'),
    });

    expect(digest).toBeNull();
    expectSharesFilter(capturedWhere);
    expect(mockSendNotificationEmail).not.toHaveBeenCalled();
  });
});
