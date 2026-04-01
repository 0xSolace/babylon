import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Recipient returned by the first DB query (recipient lookup)
let mockRecipientUser: {
  id: string;
  isAgent: boolean;
  isActor: boolean;
  managedBy: string | null;
} | null = {
  id: 'agent-2',
  isAgent: true,
  isActor: false,
  managedBy: 'owner-B',
};

// Sender info returned by the second DB query (managedBy lookup)
let mockSenderInfo: { managedBy: string | null } | null = {
  managedBy: 'owner-A',
};

let mockSenderBalance = 1000;
let lastDebitCall: {
  userId: string;
  amount: number;
  type: string;
  description: string;
  relatedId?: string;
} | null = null;
let lastCreditCall: {
  userId: string;
  amount: number;
  type: string;
  description: string;
  relatedId?: string;
} | null = null;
let debitShouldFail = false;

const invalidateUserCacheMock = mock(async () => undefined);

// Track sequential DB queries: first call = recipient lookup, second = sender managedBy
let dbSelectCallCount = 0;

const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(async () => {
          dbSelectCallCount++;
          if (dbSelectCallCount === 1) {
            // First query: recipient lookup
            return mockRecipientUser ? [mockRecipientUser] : [];
          }
          // Second query: sender managedBy lookup
          return mockSenderInfo ? [mockSenderInfo] : [];
        }),
      })),
    })),
  })),
  insert: mock(() => ({
    values: mock(() => ({
      onConflictDoNothing: mock(() => ({
        returning: mock(async () => []),
      })),
    })),
  })),
  delete: mock(() => ({
    where: mock(() => ({
      returning: mock(async () => []),
    })),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(async () => []),
    })),
  })),
  transaction: mock(async () => undefined),
};

mock.module('@babylon/db', () => ({
  actorState: {},
  aliasedTable: mock(() => ({})),
  and: (...args: unknown[]) => args,
  asSystem: () => ({}),
  asUser: () => ({}),
  chatParticipants: {},
  chats: {},
  comments: {},
  db: mockDb,
  dmAcceptances: {},
  eq: (a: unknown, b: unknown) => ({ a, b }),
  follows: { id: 'id', followerId: 'followerId', followingId: 'followingId' },
  groupMembers: { role: 'role' },
  groups: { id: 'id' },
  gte: (...args: unknown[]) => args,
  isNull: (...args: unknown[]) => args,
  messages: {},
  perpPositions: {},
  posts: {
    id: 'id',
    authorId: 'authorId',
    content: 'content',
    originalPostId: 'originalPostId',
  },
  reactions: {},
  shares: { id: 'id', postId: 'postId', userId: 'userId' },
  sql: {},
  users: {
    id: 'id',
    isActor: 'isActor',
    isAgent: 'isAgent',
    managedBy: 'managedBy',
    displayName: 'displayName',
  },
  withTransaction: mock(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockDb)
  ),
}));

mock.module('@babylon/api', () => ({
  broadcastAgentActivity: mock(async () => undefined),
  broadcastChatMessage: mock(async () => undefined),
  broadcastToChannel: mock(async () => undefined),
  cachedDb: {
    invalidateUserCache: invalidateUserCacheMock,
  },
  notifyGroupChatMessage: async () => undefined,
}));

mock.module('@babylon/core/markets/perps', () => ({
  PerpDbAdapter: class {},
  PerpMarketService: class {},
}));

mock.module('@babylon/core/markets/prediction', () => ({
  PredictionDbAdapter: class {},
  PredictionMarketService: class {},
}));

mock.module('@babylon/engine', () => ({
  FEE_CONFIG: {
    TRADING_FEE_RATE: 0,
    PLATFORM_SHARE: 0,
    REFERRER_SHARE: 0,
    MIN_FEE_AMOUNT: 0,
    FEE_TYPES: {},
  },
  FeeService: { processTradingFee: mock(async () => ({ feeCharged: 0 })) },
  generateTagsFromPost: mock(async () => []),
  invalidateAfterPredictionTrade: mock(async () => undefined),
  PredictionPricing: {},
  createPerpPriceImpactPort: mock(() => ({})),
  StaticDataRegistry: { getActor: mock(() => null) },
  storeTagsForPost: mock(async () => undefined),
  WalletService: {
    debit: mock(
      async (
        userId: string,
        amount: number,
        type: string,
        description: string,
        relatedId?: string,
        _tx?: unknown
      ) => {
        if (debitShouldFail) {
          throw new Error('Insufficient balance');
        }
        lastDebitCall = { userId, amount, type, description, relatedId };
        mockSenderBalance -= amount;
      }
    ),
    credit: mock(
      async (
        userId: string,
        amount: number,
        type: string,
        description: string,
        relatedId?: string,
        _tx?: unknown
      ) => {
        lastCreditCall = { userId, amount, type, description, relatedId };
      }
    ),
    getBalance: mock(async () => ({
      balance: mockSenderBalance,
      totalDeposited: 0,
      totalWithdrawn: 0,
      lifetimePnL: 0,
    })),
  },
}));

mock.module('../../shared/logger', () => ({
  logger: {
    info: mock(() => undefined),
    warn: mock(() => undefined),
    debug: mock(() => undefined),
    error: mock(() => undefined),
  },
}));

mock.module('../../shared/snowflake', () => ({
  generateSnowflakeId: mock(async () => 'snowflake-tx-id'),
}));

mock.module('../../services/AgentPnLService', () => ({
  agentPnLService: { recordTrade: mock(async () => undefined) },
}));

mock.module('../TopicDiversityService', () => ({
  topicDiversityService: { trackPostTopics: mock(async () => undefined) },
}));

mock.module('../utils/resolvePerpTicker', () => ({
  resolvePerpTicker: mock(() => null),
}));

const { executeDirectSendMoney } = await import('../DirectExecutors');

describe('executeDirectSendMoney', () => {
  beforeEach(() => {
    // Default: recipient is a valid agent owned by a different user
    mockRecipientUser = {
      id: 'agent-2',
      isAgent: true,
      isActor: false,
      managedBy: 'owner-B',
    };
    mockSenderInfo = { managedBy: 'owner-A' };
    mockSenderBalance = 1000;
    lastDebitCall = null;
    lastCreditCall = null;
    debitShouldFail = false;
    dbSelectCallCount = 0;
  });

  // =========================================================================
  // Success cases
  // =========================================================================

  test('sends money to another agent successfully', async () => {
    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 100,
      reason: 'payment for services',
    });

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('snowflake-tx-id');
    expect(result.newBalance).toBe(900);
    expect(lastDebitCall).toBeDefined();
    expect(lastDebitCall!.userId).toBe('agent-1');
    expect(lastDebitCall!.amount).toBe(100);
    expect(lastDebitCall!.type).toBe('transfer_sent');
    expect(lastCreditCall).toBeDefined();
    expect(lastCreditCall!.userId).toBe('agent-2');
    expect(lastCreditCall!.amount).toBe(100);
    expect(lastCreditCall!.type).toBe('transfer_received');
  });

  test('links debit and credit with same transactionId', async () => {
    await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 50,
    });

    expect(lastDebitCall!.relatedId).toBe('snowflake-tx-id');
    expect(lastCreditCall!.relatedId).toBe('snowflake-tx-id');
  });

  test('includes reason in transaction descriptions', async () => {
    await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 50,
      reason: 'bet payment',
    });

    expect(lastDebitCall!.description).toContain('bet payment');
    expect(lastCreditCall!.description).toContain('bet payment');
  });

  test('sends without reason (optional parameter)', async () => {
    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 25,
    });

    expect(result.success).toBe(true);
    expect(lastDebitCall!.description).not.toContain('undefined');
  });

  // =========================================================================
  // Balance cap
  // =========================================================================

  test('caps transfer at 50% of balance', async () => {
    mockSenderBalance = 1000;

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 800,
    });

    expect(result.success).toBe(true);
    expect(lastDebitCall!.amount).toBe(500);
    expect(lastCreditCall!.amount).toBe(500);
  });

  test('allows transfer at exactly 50% of balance', async () => {
    mockSenderBalance = 1000;

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 500,
    });

    expect(result.success).toBe(true);
    expect(lastDebitCall!.amount).toBe(500);
  });

  // =========================================================================
  // Recipient restrictions (anti-bypass for user-to-user transfer ban)
  // =========================================================================

  test('rejects transfer to a human user (non-agent)', async () => {
    mockRecipientUser = {
      id: 'human-user',
      isAgent: false,
      isActor: false,
      managedBy: null,
    };

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'human-user',
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('non-agent users are disabled');
    expect(lastDebitCall).toBeNull();
  });

  test('rejects transfer to an NPC/actor', async () => {
    mockRecipientUser = {
      id: 'npc-1',
      isAgent: false,
      isActor: true,
      managedBy: null,
    };

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'npc-1',
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot send money to NPCs');
    expect(lastDebitCall).toBeNull();
  });

  test('rejects transfer between agents owned by the same user', async () => {
    mockRecipientUser = {
      id: 'agent-2',
      isAgent: true,
      isActor: false,
      managedBy: 'same-owner',
    };
    mockSenderInfo = { managedBy: 'same-owner' };

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('same user');
    expect(lastDebitCall).toBeNull();
  });

  test('allows transfer between agents owned by different users', async () => {
    mockRecipientUser = {
      id: 'agent-2',
      isAgent: true,
      isActor: false,
      managedBy: 'owner-B',
    };
    mockSenderInfo = { managedBy: 'owner-A' };

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 100,
    });

    expect(result.success).toBe(true);
  });

  test('allows transfer when sender has no managedBy (edge case)', async () => {
    // Sender is not managed by anyone (perhaps a standalone agent)
    mockSenderInfo = { managedBy: null };
    mockRecipientUser = {
      id: 'agent-2',
      isAgent: true,
      isActor: false,
      managedBy: 'owner-B',
    };

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 100,
    });

    expect(result.success).toBe(true);
  });

  // =========================================================================
  // Input validation
  // =========================================================================

  test('rejects self-transfer', async () => {
    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-1',
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot send money to yourself');
    expect(lastDebitCall).toBeNull();
  });

  test('rejects zero amount', async () => {
    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('positive number');
    expect(lastDebitCall).toBeNull();
  });

  test('rejects negative amount', async () => {
    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: -50,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('positive number');
  });

  test('rejects NaN amount', async () => {
    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: Number.NaN,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('positive number');
  });

  test('rejects empty recipientId', async () => {
    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: '  ',
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Recipient ID is required');
  });

  test('rejects nonexistent recipient', async () => {
    mockRecipientUser = null;

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'nonexistent',
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  // =========================================================================
  // Balance checks
  // =========================================================================

  test('rejects when sender has zero balance', async () => {
    mockSenderBalance = 0;

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient balance');
  });

  test('rejects when debit fails (insufficient funds)', async () => {
    debitShouldFail = true;

    const result = await executeDirectSendMoney({
      agentUserId: 'agent-1',
      recipientId: 'agent-2',
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient balance');
  });
});
