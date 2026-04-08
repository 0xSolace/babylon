import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as babylonDb from '@babylon/db';
import { NextRequest } from 'next/server';

/**
 * Mock game state type
 */
interface MockGame {
  id: string;
  isContinuous: boolean;
  isRunning: boolean;
}

/**
 * Mock database model interface
 */
interface MockModel {
  findFirst: () => Promise<MockGame | null>;
  findUnique: () => Promise<{ id: string } | null>;
  findMany: () => Promise<Array<{ id: string }>>;
  count: () => Promise<number>;
  create: () => Promise<{ id: string }>;
  update: () => Promise<{ id: string }>;
  delete: () => Promise<{ id: string }>;
  deleteMany: () => Promise<{ count: number }>;
}

/**
 * Mock database transaction callback
 */
type TransactionCallback<T> = (tx: MockDb) => Promise<T>;

/**
 * Mock database interface
 */
interface MockDb {
  game: MockModel;
  user: MockModel;
  $transaction: <T>(
    fn: TransactionCallback<T> | Array<Promise<T>>
  ) => Promise<T | T[]>;
}

// Mock db with a mutable state we can control in tests
let mockGame: MockGame | null = null;

mock.module('server-only', () => ({}));

const createModelMock = (overrides: Partial<MockModel> = {}): MockModel => ({
  findFirst: mock(async () => mockGame),
  findUnique: mock(async () => null),
  findMany: mock(async () => []),
  count: mock(async () => 0),
  create: mock(async () => ({ id: 'mock-id' })),
  update: mock(async () => ({ id: 'mock-id' })),
  delete: mock(async () => ({ id: 'mock-id' })),
  deleteMany: mock(async () => ({ count: 0 })),
  ...overrides,
});

const createQueryBuilder = () => {
  const builder = {
    set: mock(() => builder),
    where: mock(() => builder),
    values: mock(() => builder),
    from: mock(() => builder),
    limit: mock(() => builder),
    returning: mock(async () => [{ id: 'mock-lock-id' }]),
    onConflictDoNothing: mock(() => builder),
    then: <TResult1 = Array<{ id: string }>, TResult2 = never>(
      onFulfilled?:
        | ((value: Array<{ id: string }>) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): Promise<TResult1 | TResult2> =>
      Promise.resolve([{ id: 'mock-lock-id' }]).then(onFulfilled, onRejected),
  };
  return builder;
};

const mockDb = {
  game: createModelMock(),
  user: createModelMock(),
  $transaction: async <T>(
    fn: TransactionCallback<T> | Array<Promise<T>>
  ): Promise<T | T[]> => {
    if (typeof fn === 'function') return fn({} as MockDb);
    return Promise.all(fn);
  },
  update: mock(() => createQueryBuilder()),
  insert: mock(() => createQueryBuilder()),
  delete: mock(() => createQueryBuilder()),
  select: mock(() => createQueryBuilder()),
};

const realDbRuntime = await import('@babylon/db/engine-storage');
mock.module('@babylon/db/engine-storage', () => ({
  ...realDbRuntime,
  db: mockDb,
  asSystem: async <T>(
    fn: (db: typeof mockDb) => Promise<T>,
    _operationName?: string
  ): Promise<T> => fn(mockDb),
  asUser: async <T>(
    _userId: string,
    fn: (db: typeof mockDb) => Promise<T>
  ): Promise<T> => fn(mockDb),
  asPublic: async <T>(fn: (db: typeof mockDb) => Promise<T>): Promise<T> =>
    fn(mockDb),
}));

mock.module('@babylon/db', () => ({
  ...babylonDb,
  selectContinuousGameStateForCron: mock(async () => {
    if (!mockGame) {
      return null;
    }
    return {
      id: mockGame.id,
      isRunning: mockGame.isRunning,
      isContinuous: mockGame.isContinuous,
      currentDay: null,
    };
  }),
}));

mock.module('@babylon/agents/services/agent-registry.service', () => ({
  agentRegistry: {
    discoverAgents: async () => [],
  },
}));

mock.module('@babylon/agents/services/agent-lock-service', () => ({
  acquireAgentLock: async () => true,
  releaseAgentLock: async () => {},
}));

// Mock other services to avoid errors if they are imported
mock.module('@babylon/agents/runtime/AgentRuntimeManager', () => ({
  agentRuntimeManager: {
    getRuntime: async () => ({}),
  },
}));

mock.module('@babylon/agents/services/AgentService', () => ({
  agentService: {
    deductPoints: async () => {},
    createLog: async () => {},
  },
}));

mock.module('@babylon/agents/autonomous', () => ({
  autonomousCoordinator: {
    executeAutonomousTick: async () => ({
      success: true,
      method: 'test',
      actionsExecuted: {
        trades: 0,
        posts: 0,
        comments: 0,
        messages: 0,
        groupMessages: 0,
      },
    }),
  },
}));

const actualApiModule = await import('@babylon/api');
mock.module('@babylon/api', () => ({
  ...actualApiModule,
  DistributedLockService: {
    acquireLock: mock(async () => true),
    releaseLock: mock(async () => {}),
  },
  verifyCronAuth: mock(() => true),
  recordCronExecution: mock(async () => undefined),
  relayCronToStaging: mock(async () => ({ forwarded: false })),
}));

mock.module('@/lib/engine/ensure-engine-services', () => ({
  ensureEngineServices: () => {},
}));

// Import the route handler after mocks are set up
const { POST } = await import('@/app/api/cron/agent-tick/route');

describe('Agent Tick Cron - DB State', () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    mockGame = null;
  });

  test('should be skipped when no continuous game exists', async () => {
    mockGame = null;

    const req = new NextRequest('http://localhost/api/cron/agent-tick', {
      method: 'POST',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.skipped).toBe(true);
    expect(data.reason).toBe('No continuous game found');
  });

  test('should be paused when game.isRunning is false', async () => {
    mockGame = {
      id: 'game-123',
      isContinuous: true,
      isRunning: false,
    };

    const req = new NextRequest('http://localhost/api/cron/agent-tick', {
      method: 'POST',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.skipped).toBe(true);
    expect(data.reason).toBe('Game is paused');
    expect(data.gameId).toBe('game-123');
  });

  test('should proceed when game.isRunning is true', async () => {
    mockGame = {
      id: 'game-123',
      isContinuous: true,
      isRunning: true,
    };

    const req = new NextRequest('http://localhost/api/cron/agent-tick', {
      method: 'POST',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.skipped).toBeUndefined();
    expect(data.success).toBe(true);
    // Since we mocked discoverAgents to return [], it should handle 0 agents
    expect(data.processed).toBe(0);
  });
});
