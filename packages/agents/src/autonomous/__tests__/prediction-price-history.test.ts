import { beforeEach, describe, expect, mock, test } from 'bun:test';

const predictionPriceHistories = { table: 'PredictionPriceHistory' };
const markets = { table: 'Market', id: 'id' };
const positions = {
  table: 'Position',
  userId: 'userId',
  marketId: 'marketId',
  side: 'side',
  status: 'status',
  amount: 'amount',
  id: 'id',
};
const users = { table: 'User', id: 'id', displayName: 'displayName' };
const agentTrades = { table: 'AgentTrade' };
const agentLogs = { table: 'AgentLog' };

const marketRow = {
  id: '260717599719948288',
  yesShares: '100',
  noShares: '100',
  liquidity: '10000',
  question: 'Will something happen?',
};

const userRow = { displayName: 'Test Agent' };

const insertedPredictionHistory: Array<Record<string, unknown>> = [];

const mockTxDb = {
  update: mock(() => ({
    set: mock(() => ({
      where: mock(async () => []),
      returning: mock(async () => []),
    })),
  })),
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(async () => []),
      })),
    })),
  })),
  insert: mock((table: unknown) => ({
    values: mock(async (values: Record<string, unknown>) => {
      if (table === predictionPriceHistories) {
        insertedPredictionHistory.push(values);
      }
      return [];
    }),
    returning: mock(async () => []),
  })),
  delete: mock(() => ({
    where: mock(async () => []),
  })),
};

const mockDb = {
  select: mock(() => ({
    from: mock((table: unknown) => ({
      where: mock(() => ({
        limit: mock(async () => {
          if (table === markets) return [marketRow];
          if (table === users) return [userRow];
          return [];
        }),
      })),
    })),
  })),
};

mock.module('@babylon/api', () => ({
  broadcastAgentActivity: mock(async () => undefined),
  broadcastChatMessage: mock(async () => undefined),
  broadcastToChannel: mock(async () => undefined),
}));

mock.module('@babylon/core/markets/perps', () => ({
  PerpDbAdapter: class {},
  PerpMarketService: class {},
}));

mock.module('@babylon/engine', () => ({
  FEE_CONFIG: { TRADING_FEE_RATE: 0.001 },
  invalidateAfterPredictionTrade: mock(async () => undefined),
  PredictionPricing: {
    calculateBuyWithFees: mock(() => ({
      sharesBought: 10,
      avgPrice: 0.75,
      netAmount: 9.99,
      newYesShares: 110,
      newNoShares: 90,
      newYesPrice: 0.55,
      newNoPrice: 0.45,
    })),
    calculateSellWithFees: mock(() => ({
      avgPrice: 0.5,
      netProceeds: 5,
      netAmount: 5,
      totalCost: 5,
      newYesShares: 100,
      newNoShares: 100,
      newYesPrice: 0.5,
      newNoPrice: 0.5,
    })),
  },
  StaticDataRegistry: {
    getActor: () => null,
    getAllOrganizations: () => [],
  },
  WalletService: {
    getBalance: mock(async () => ({ balance: 10000 })),
    debit: mock(async () => undefined),
    credit: mock(async () => undefined),
    recordPnL: mock(async () => undefined),
  },
  generateTagsFromPost: mock(async () => []),
  storeTagsForPost: mock(async () => undefined),
}));

mock.module('@babylon/db', () => ({
  actorState: { id: 'id', tradingBalance: 'tradingBalance' },
  agentLogs,
  agentTrades,
  aliasedTable: (table: unknown) => table,
  and: (...args: unknown[]) => args,
  asSystem: async (
    operation: (database: typeof mockTxDb) => Promise<unknown>
  ) => operation(mockTxDb),
  asUser: async (
    _user: { userId: string },
    operation: (database: typeof mockTxDb) => Promise<unknown>
  ) => operation(mockTxDb),
  chatParticipants: {},
  chats: {},
  comments: {},
  db: mockDb,
  dmAcceptances: {},
  eq: (a: unknown, b: unknown) => ({ a, b }),
  gte: (a: unknown, b: unknown) => ({ a, b }),
  isNull: (a: unknown) => ({ a }),
  markets,
  messages: {},
  perpPositions: {},
  positions,
  posts: {},
  predictionPriceHistories,
  reactions: {},
  shares: {},
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
  users,
  withTransaction: async (
    operation: (database: typeof mockTxDb) => Promise<unknown>
  ) => operation(mockTxDb),
  desc: (a: unknown) => a,
}));

describe('DirectExecutors prediction price history', () => {
  beforeEach(() => {
    insertedPredictionHistory.length = 0;
  });

  test('records PredictionPriceHistory for agent prediction buys', async () => {
    const { executeDirectTrade } = await import('../DirectExecutors');

    const result = await executeDirectTrade({
      agentUserId: '123456789012345678',
      marketType: 'prediction',
      marketId: marketRow.id,
      side: 'buy_yes',
      amount: 10,
      reasoning: 'test',
    });

    expect(result.success).toBe(true);
    expect(insertedPredictionHistory).toHaveLength(1);

    const snapshot = insertedPredictionHistory[0]!;
    expect(snapshot.marketId).toBe(marketRow.id);
    expect(snapshot.eventType).toBe('trade');
    expect(snapshot.source).toBe('user_trade');
    expect(snapshot.yesPrice).toBe(0.55);
    expect(snapshot.noPrice).toBe(0.45);
    expect(snapshot.yesShares).toBe('110');
    expect(snapshot.noShares).toBe('90');
    expect(snapshot.liquidity).toBe('10009.99');
    expect(typeof snapshot.id).toBe('string');
  });
});
