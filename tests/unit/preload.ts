/**
 * Preload file for unit tests
 *
 * This file is loaded before all unit tests to set up the test environment.
 * It mocks external dependencies like database and Redis connections.
 */

import { mock } from 'bun:test';

type EntityData = Record<string, unknown> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type MockArgs = {
  data?: EntityData | EntityData[];
  where?: { id?: string };
  create?: EntityData;
  update?: EntityData;
};

type MockModel = {
  findUnique: () => Promise<unknown>;
  findMany: () => Promise<unknown[]>;
  findFirst: () => Promise<unknown>;
  count: () => Promise<number>;
  create: (args: MockArgs) => Promise<Record<string, unknown>>;
  createMany: (args: MockArgs) => Promise<{ count: number }>;
  update: (args: MockArgs) => Promise<Record<string, unknown>>;
  updateMany: (args: MockArgs) => Promise<{ count: number }>;
  upsert: (args: MockArgs) => Promise<Record<string, unknown>>;
  delete: (args: MockArgs) => Promise<Record<string, unknown>>;
  deleteMany: () => Promise<{ count: number }>;
  aggregate: () => Promise<Record<string, unknown>>;
  groupBy: () => Promise<unknown[]>;
};

interface MockPrismaClient extends Record<string, MockModel> {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $queryRaw: () => Promise<unknown[]>;
  $executeRaw: () => Promise<number>;
  $transaction: (fn: (client: MockPrismaClient) => Promise<unknown>) => Promise<unknown>;
}

type PipelineCommand = [string, ...unknown[]];

// Set test environment
// @ts-expect-error - Need to override NODE_ENV for testing
process.env.NODE_ENV = 'test';
process.env.BUN_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock_test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock Prisma before any imports
mock.module('@/lib/prisma', () => {
  const createMockPrismaClient = () => {
    const mockModels = [
      'actor',
      'actorFollow',
      'actorRelationship',
      'agentLog',
      'agentMessage',
      'agentPerformanceMetrics',
      'agentGoal',
      'agentGoalAction',
      'agentPointsTransaction',
      'agentTrade',
      'balanceTransaction',
      'chat',
      'chatParticipant',
      'comment',
      'dMAcceptance',
      'favorite',
      'feedback',
      'follow',
      'followStatus',
      'game',
      'gameConfig',
      'groupChatMembership',
      'market',
      'message',
      'nPCTrade',
      'notification',
      'oAuthState',
      'onboardingIntent',
      'oracleCommitment',
      'oracleTransaction',
      'organization',
      'perpPosition',
      'pointsTransaction',
      'pool',
      'poolDeposit',
      'poolPosition',
      'position',
      'post',
      'postTag',
      'profileUpdateLog',
      'question',
      'reaction',
      'referral',
      'share',
      'shareAction',
      'stockPrice',
      'tag',
      'tradingFee',
      'trendingTag',
      'twitterOAuthToken',
      'user',
      'userActorFollow',
      'userGroup',
      'userGroupAdmin',
      'userGroupInvite',
      'userGroupMember',
      'userInteraction',
      'widgetCache',
      'worldEvent',
      'llmCallLog',
      'market_outcomes',
      'trainedModel',
      'trainingBatch',
      'trajectory',
      'rewardJudgment',
      'userBlock',
      'userMute',
      'report',
      'systemSettings',
      'worldFact',
      'rSSFeedSource',
      'rSSHeadline',
      'parodyHeadline',
      'characterMapping',
      'organizationMapping',
    ];

    const mockClient = {} as MockPrismaClient;

    mockClient.$connect = mock(() => Promise.resolve());
    mockClient.$disconnect = mock(() => Promise.resolve());
    mockClient.$queryRaw = mock(() => Promise.resolve([]));
    mockClient.$executeRaw = mock(() => Promise.resolve(0));
    mockClient.$transaction = mock(async (fn: (client: MockPrismaClient) => Promise<unknown>) => {
      return await fn(mockClient);
    });

    for (const modelName of mockModels) {
      const model: MockModel = {
        findUnique: mock(() => Promise.resolve(null)),
        findMany: mock(() => Promise.resolve([])),
        findFirst: mock(() => Promise.resolve(null)),
        count: mock(() => Promise.resolve(0)),
        create: mock((args: MockArgs = {}) => {
          // Return the data that was passed in, with defaults for required fields
          const rawData = Array.isArray(args.data) ? {} : args.data || {};
          const data = rawData as EntityData;
          return Promise.resolve({
            id: data.id || 'mock-id',
            createdAt: data.createdAt || new Date(),
            updatedAt: data.updatedAt || new Date(),
            ...data,
          });
        }),
        createMany: mock((args: MockArgs = {}) => {
          const count = Array.isArray(args.data) ? args.data.length : 0;
          return Promise.resolve({ count });
        }),
        update: mock((args: MockArgs = {}) => {
          const rawData = Array.isArray(args.data) ? {} : args.data || {};
          const data = rawData as EntityData;
          return Promise.resolve({
            id: args.where?.id || 'mock-id',
            updatedAt: new Date(),
            ...data,
          });
        }),
        updateMany: mock((args: MockArgs = {}) => {
          return Promise.resolve({ count: args.data ? 1 : 0 });
        }),
        upsert: mock((args: MockArgs = {}) => {
          const data = (args.create || args.update || {}) as EntityData;
          return Promise.resolve({
            id: args.where?.id || 'mock-id',
            createdAt: data.createdAt || new Date(),
            updatedAt: new Date(),
            ...data,
          });
        }),
        delete: mock((args: MockArgs = {}) => {
          return Promise.resolve({ id: args.where?.id || 'mock-id' });
        }),
        deleteMany: mock(() => Promise.resolve({ count: 0 })),
        aggregate: mock(() =>
          Promise.resolve({
            _count: 0,
            _sum: null,
            _avg: null,
            _min: null,
            _max: null,
          })
        ),
        groupBy: mock(() => Promise.resolve([])),
      };
      mockClient[modelName] = model;
    }

    return mockClient;
  };

  const mockPrismaClient = createMockPrismaClient();
  return {
    prisma: mockPrismaClient,
    prismaBase: mockPrismaClient,
  };
});

// Mock Redis/ioredis
mock.module('ioredis', () => {
  return {
    default: class MockRedis {
      on() {
        return this;
      }
      once() {
        return this;
      }
      removeListener() {
        return this;
      }
      removeAllListeners() {
        return this;
      }
      connect() {
        return Promise.resolve();
      }
      disconnect() {
        return Promise.resolve();
      }
      quit() {
        return Promise.resolve('OK');
      }
      get() {
        return Promise.resolve(null);
      }
      set() {
        return Promise.resolve('OK');
      }
      setex() {
        return Promise.resolve('OK');
      }
      del() {
        return Promise.resolve(1);
      }
      exists() {
        return Promise.resolve(0);
      }
      expire() {
        return Promise.resolve(1);
      }
      ttl() {
        return Promise.resolve(-1);
      }
      keys() {
        return Promise.resolve([]);
      }
      flushall() {
        return Promise.resolve('OK');
      }
      hget() {
        return Promise.resolve(null);
      }
      hset() {
        return Promise.resolve(1);
      }
      hdel() {
        return Promise.resolve(1);
      }
      hgetall() {
        return Promise.resolve({});
      }
      sadd() {
        return Promise.resolve(1);
      }
      srem() {
        return Promise.resolve(1);
      }
      smembers() {
        return Promise.resolve([]);
      }
      sismember() {
        return Promise.resolve(0);
      }
      zadd() {
        return Promise.resolve(1);
      }
      zrem() {
        return Promise.resolve(1);
      }
      zrange() {
        return Promise.resolve([]);
      }
      zrevrange() {
        return Promise.resolve([]);
      }
      pipeline() {
        const pipeline = {
          commands: [] as PipelineCommand[],
          get(key: string) {
            this.commands.push(['get', key]);
            return this;
          },
          set(key: string, value: unknown) {
            this.commands.push(['set', key, value]);
            return this;
          },
          del(key: string) {
            this.commands.push(['del', key]);
            return this;
          },
          exec() {
            return Promise.resolve(this.commands.map(() => [null, 'OK'] as [null, string]));
          },
        };
        return pipeline;
      }
    },
  };
});

// Mock other external dependencies if needed
console.log('Unit test environment initialized with mocked dependencies');
