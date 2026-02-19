/**
 * Shared mock infrastructure for cron test suites.
 *
 * Both article-tick and markets-tick route handlers import from @babylon/db,
 * @babylon/api, @babylon/engine, and @babylon/core. When Bun runs multiple
 * test files in the same process, `mock.module()` calls from one suite can
 * pollute the module registry for another. This module centralises mock
 * registration so both suites share identical, non-leaking mocks.
 */

import { mock } from 'bun:test';
import { NextRequest } from 'next/server';

// Pre-import rate-limiting and format utilities from @babylon/api BEFORE
// mock.module replaces the module. These are re-exported in the mock so
// downstream tests that import them from @babylon/api still get the real
// implementations.
import * as rateLimiting from '../../../api/src/rate-limiting';
import {
  isValidSnowflakeId,
  parseSnowflakeId,
  SnowflakeGenerator,
} from '../../../shared/src/utils/snowflake';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockGame {
  id: string;
  isContinuous: boolean;
  isRunning: boolean;
  currentDay: number | null;
}

export interface MockQuestion {
  id: string;
  questionNumber: number;
  resolutionDate: Date;
  status: string;
}

export interface MockWorldEvent {
  id: string;
  timestamp: Date;
  description: string;
}

interface SqlCondition {
  sql?: string;
}

export interface CronMockState {
  articleGame: MockGame | null;
  articleCount: number;
  articleCronAuthResult: boolean;
  articleCoveredEventIds: Set<string>;
  marketsGame: MockGame | null;
  marketsActiveQuestions: MockQuestion[];
  marketsWorldEvents: MockWorldEvent[];
  marketsCronAuthResult: boolean;
  marketsAcquireLockResult: boolean;
}

// ---------------------------------------------------------------------------
// Shared global state (survives across suites in the same Bun process)
// ---------------------------------------------------------------------------

const CRON_MOCK_STATE_KEY = '__babylonCronMockState';

type GlobalWithCronMockState = typeof globalThis & {
  [CRON_MOCK_STATE_KEY]?: CronMockState;
};

const g = globalThis as GlobalWithCronMockState;

export const cronMockState: CronMockState =
  g[CRON_MOCK_STATE_KEY] ??
  (g[CRON_MOCK_STATE_KEY] = {
    articleGame: null,
    articleCount: 0,
    articleCronAuthResult: true,
    articleCoveredEventIds: new Set<string>(),
    marketsGame: null,
    marketsActiveQuestions: [],
    marketsWorldEvents: [],
    marketsCronAuthResult: true,
    marketsAcquireLockResult: true,
  });

// ---------------------------------------------------------------------------
// Deterministic snowflake stub (returns valid BigInt-parseable numeric strings)
// ---------------------------------------------------------------------------

let snowflakeSeq = 0;

const SNOWFLAKE_EPOCH = 1_704_067_200_000n; // Jan 1, 2024 UTC — must match @babylon/shared

export function nextMockSnowflakeId(): string {
  snowflakeSeq += 1;
  const ts = BigInt(Date.now()) - SNOWFLAKE_EPOCH;
  return String((ts << 22n) | BigInt(snowflakeSeq & 0x3fffff));
}

// ---------------------------------------------------------------------------
// Table tracking (used by markets-tick's table-aware query builder)
// ---------------------------------------------------------------------------

export let currentQueryTable: string | null = null;

export function resetQueryTable() {
  currentQueryTable = null;
}

// ---------------------------------------------------------------------------
// Table reference stubs
// ---------------------------------------------------------------------------

const TABLE_REFS: Record<string, Record<string, string>> = {
  games: {
    _tableName: 'games',
    id: 'id',
    isRunning: 'isRunning',
    isContinuous: 'isContinuous',
    currentDay: 'currentDay',
  },
  questions: {
    _tableName: 'questions',
    status: 'status',
    resolutionDate: 'resolutionDate',
    id: 'id',
    questionNumber: 'questionNumber',
  },
  userAgentConfigs: { _tableName: 'userAgentConfigs' },
  users: { _tableName: 'users' },
  actors: { _tableName: 'actors' },
  comments: { _tableName: 'comments' },
  organizations: { _tableName: 'organizations' },
  balanceTransactions: { _tableName: 'balanceTransactions' },
  pointsTransactions: { _tableName: 'pointsTransactions' },
  perpPositions: { _tableName: 'perpPositions' },
  poolPositions: { _tableName: 'poolPositions' },
  markets: { _tableName: 'markets' },
  generationLocks: { _tableName: 'generationLocks' },
  agentPerformanceMetrics: { _tableName: 'agentPerformanceMetrics' },
  agentTrades: { _tableName: 'agentTrades' },
  npcTrades: { _tableName: 'npcTrades' },
  timeframedMarkets: { _tableName: 'timeframedMarkets' },
  worldEvents: { _tableName: 'worldEvents', timestamp: 'timestamp' },
  posts: {
    _tableName: 'posts',
    type: 'type',
    timestamp: 'timestamp',
    deletedAt: 'deletedAt',
  },
};

// ---------------------------------------------------------------------------
// Query builder helpers
// ---------------------------------------------------------------------------

function getTableData(): unknown {
  switch (currentQueryTable) {
    case 'games':
      return cronMockState.marketsGame ? [cronMockState.marketsGame] : [];
    case 'questions':
      return cronMockState.marketsActiveQuestions;
    case 'worldEvents':
      return cronMockState.marketsWorldEvents;
    case 'timeframedMarkets':
    case 'posts':
      return [];
    default:
      return [];
  }
}

export function createQueryBuilder(
  resultFn: () => unknown = () => [{ id: 'mock-id' }],
  operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
) {
  const builder: Record<string, unknown> = {
    set: mock(() => builder),
    where: mock(() => builder),
    values: mock(() => builder),
    from: mock((table: { _tableName?: string }) => {
      if (table?._tableName) currentQueryTable = table._tableName;
      return builder;
    }),
    leftJoin: mock(() => builder),
    innerJoin: mock(() => builder),
    rightJoin: mock(() => builder),
    fullJoin: mock(() => builder),
    limit: mock(() => builder),
    orderBy: mock(() => builder),
    returning: mock(async () => {
      if (operation === 'insert') return [{ id: `mock-${Date.now()}` }];
      if (operation === 'update') return [{ id: 'mock-updated' }];
      if (operation === 'delete') return [{ id: 'mock-deleted' }];
      return resultFn();
    }),
    onConflictDoNothing: mock(() => builder),
    then: <TResult1, TResult2 = never>(
      onFulfilled?:
        | ((value: unknown) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): Promise<TResult1 | TResult2> => {
      return Promise.resolve(resultFn()).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function createMutationBuilder(operation: 'insert' | 'update' | 'delete') {
  return mock((table: { _tableName?: string }) => {
    if (table?._tableName) currentQueryTable = table._tableName;
    return createQueryBuilder(
      () => [{ id: `mock-${operation}-id` }],
      operation
    );
  });
}

// ---------------------------------------------------------------------------
// SQL operator stubs
// ---------------------------------------------------------------------------

const sqlOps = {
  eq: (): SqlCondition => ({}),
  ne: (): SqlCondition => ({}),
  gt: (): SqlCondition => ({}),
  gte: (): SqlCondition => ({}),
  lt: (): SqlCondition => ({}),
  lte: (): SqlCondition => ({}),
  and: (): SqlCondition => ({}),
  or: (): SqlCondition => ({}),
  not: (): SqlCondition => ({}),
  inArray: (): SqlCondition => ({}),
  desc: (): SqlCondition => ({}),
  asc: (): SqlCondition => ({}),
  isNull: (): SqlCondition => ({}),
  isNotNull: (): SqlCondition => ({}),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    sql: strings.join('?'),
    values,
  }),
  max: (col: unknown) => ({ _aggregation: 'max', column: col }),
};

// ---------------------------------------------------------------------------
// registerCronMocks — call once in beforeAll
// ---------------------------------------------------------------------------

export function registerCronMocks() {
  // --- @babylon/db ---
  mock.module('@babylon/db', () => ({
    ...TABLE_REFS,
    ...sqlOps,
    db: {
      select: mock((columns?: Record<string, unknown>) => {
        currentQueryTable = null;
        if (columns && 'maxNumber' in columns) {
          return createQueryBuilder(() => {
            const maxNum = cronMockState.marketsActiveQuestions.reduce(
              (max, q) => Math.max(max, q.questionNumber),
              0
            );
            return [{ maxNumber: maxNum > 0 ? maxNum : null }];
          });
        }
        return createQueryBuilder(() => {
          if (currentQueryTable) return getTableData();
          return cronMockState.articleGame ? [cronMockState.articleGame] : [];
        });
      }),
      insert: createMutationBuilder('insert'),
      update: createMutationBuilder('update'),
      delete: createMutationBuilder('delete'),
      transaction: mock(
        async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
          const tx = {
            select: mock(() => createQueryBuilder(() => getTableData())),
            insert: createMutationBuilder('insert'),
            update: createMutationBuilder('update'),
            delete: createMutationBuilder('delete'),
          };
          return callback(tx);
        }
      ),
    },
    generateSnowflakeId: async () => nextMockSnowflakeId(),
    isValidSnowflakeId,
    parseSnowflakeId,
    SnowflakeGenerator,
    withTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
    asUser: async <T>(_userId: string, fn: (db: unknown) => Promise<T>) =>
      fn({}),
    asSystem: async <T>(fn: (db: unknown) => Promise<T>) => fn({}),
    asPublic: async <T>(fn: (db: unknown) => Promise<T>) => fn({}),
  }));

  // --- @babylon/api ---
  mock.module('@babylon/api', () => ({
    // Re-export real rate-limiting so downstream tests get real implementations
    ...rateLimiting,
    CACHE_KEYS: { gameState: (_gameId: string) => 'game-state' },
    DEFAULT_TTLS: { gameState: 60 },
    verifyCronAuth: (req: Request | NextRequest) => {
      const pathname = new URL(req.url).pathname;
      return pathname.includes('/markets-tick')
        ? cronMockState.marketsCronAuthResult
        : cronMockState.articleCronAuthResult;
    },
    relayCronToStaging: async () => ({ forwarded: false }),
    broadcastAgentActivity: async () => {},
    broadcastToChannel: async () => {},
    notifyGroupChatInvite: async () => {},
    invalidateCache: async () => {},
    getCacheOrFetch: async <T>(_key: string, fn: () => Promise<T>) => {
      if (_key === 'continuous-game') return cronMockState.articleGame as T;
      if (_key.includes('game-state')) {
        return (cronMockState.marketsGame || {
          id: 'continuous',
          isRunning: false,
          isContinuous: true,
          currentDay: 1,
        }) as T;
      }
      return fn();
    },
    recordCronExecution: () => {},
    DistributedLockService: {
      acquireLock: async (options?: { lockId?: string }) => {
        if (options?.lockId?.includes('markets-tick'))
          return cronMockState.marketsAcquireLockResult;
        return true;
      },
      releaseLock: async () => {},
    },
  }));

  // --- @babylon/core/markets/prediction ---
  mock.module('@babylon/core/markets/prediction', () => ({
    PredictionDbAdapter: class {},
    PredictionMarketService: class {
      ensureMarketExists = async () => ({ id: 'mock-market-id' });
    },
  }));

  // --- @babylon/engine ---
  mock.module('@babylon/engine', () => ({
    articleRateLimiter: {
      canGenerateArticle: async () => ({
        allowed: cronMockState.articleCount < 2,
        currentCount: cronMockState.articleCount,
        maxAllowed: 2,
        remaining: Math.max(0, 2 - cronMockState.articleCount),
      }),
    },
    ArticleGenerator: class {
      generateArticleForQuestion = async () => ({
        id: `mock-article-${Date.now()}`,
        title: 'Test Article',
        summary: 'Test summary',
        content: 'Test content that is long enough to pass validation. '.repeat(
          20
        ),
        authorOrgId: 'org-1',
        authorOrgName: 'Test News',
        byline: 'Test Author',
        bylineActorId: 'actor-1',
        biasScore: 0,
        sentiment: 'neutral' as const,
        slant: 'Neutral coverage',
        relatedEventId: 'event-1',
        relatedActorIds: [],
        relatedOrgIds: ['org-1'],
        category: 'news',
        tags: ['test', 'article'],
        publishedAt: new Date(),
      });
    },
    BabylonLLMClient: {
      forGameTick: () => ({
        generateJSON: async () => ({
          title: 'Test Article',
          summary: 'Test summary',
          article: 'Test article body',
        }),
      }),
    },
    QuestionManager: class {
      constructor(_llmClient: unknown) {}
      async generateTimeframeQuestion() {
        return {
          text: 'Will AIlon Musk launch a new product?',
          expectedOutcome: true,
          resolutionCriteria: 'Product launch announcement',
          affiliatedActorIds: [],
          affiliatedOrgIds: [],
        };
      }
      async generateResolutionWithProof() {
        return {
          description: 'The product was launched',
          confidence: 0.95,
          requiresManualReview: false,
          proof: null,
        };
      }
    },
    getActiveEventsForPosting: async () => ({ activeEvents: [] }),
    hasEventBeenCovered: (eventId: string) =>
      cronMockState.articleCoveredEventIds.has(eventId),
    markEventAsCovered: (eventId: string) => {
      cronMockState.articleCoveredEventIds.add(eventId);
    },
    persistArticle: async (input: { id: string }) => ({
      success: true,
      articleId: input.id,
    }),
    publishOracleCommitments: async () => ({ committed: 1 }),
    publishOracleReveals: async () => ({ revealed: 1 }),
    getReputationBreakdown: () => ({
      total: 0,
      level: 'neutral',
      trend: 0,
      factors: {},
    }),
    recalculateReputation: async () => {},
    resolveQuestionPayouts: async () => {},
    SignalExtractionService: {
      extractMarketSignal: async () => ({
        suggestedOutcome: 'YES',
        confidence: 0.8,
        yesSignal: 0.7,
        noSignal: 0.3,
        signalStrength: 0.6,
        totalPosts: 10,
      }),
    },
    StaticDataRegistry: {
      getOrganizationsByType: () => [
        {
          id: 'org-1',
          name: 'Test News',
          description: 'A news org',
          type: 'media',
          canBeInvolved: true,
        },
      ],
      getTopActors: () => [
        {
          id: 'actor-1',
          name: 'Test Actor',
          description: 'A test actor',
          domain: ['tech'],
          personality: 'Analytical and cautious',
          tier: 'mid',
          affiliations: [],
          postStyle: 'Neutral analysis',
          postExample: [],
          role: 'Analyst',
          initialLuck: 'medium',
          initialMood: 0,
        },
      ],
      getAllActors: () => [],
      getAllOrganizations: () => [],
      getActor: () => null,
      getOrganization: () => null,
    },
    isEligibleActor: () => true,
    mapGranularToDbTimeframe: (timeframe: string) => timeframe,
    secureRandom: () => Math.random(),
    weightedPick: <T>(items: T[]) => items[0] ?? null,
    gameService: { getCurrentGame: async () => null },
    setBroadcastToChannel: () => {},
    setDistributedLockProvider: () => {},
    setNotifyGroupChatInvite: () => {},
    setRateLimitProvider: () => {},
    timeframeArcPlanner: {
      planTimeframeArc: () => ({
        questionId: 'q-1',
        timeframe: '1d',
        category: 'daily',
        outcome: true,
        durationMs: 86400000,
        phases: {},
        phaseOrder: ['setup', 'peak', 'resolution'],
        insiders: [],
        deceivers: [],
        affiliatedOrgIds: [],
        affiliatedActorIds: [],
        createdAt: new Date(),
      }),
    },
    worldFactsService: {
      generatePromptContext: async () => 'Test world facts context',
    },
  }));
}
