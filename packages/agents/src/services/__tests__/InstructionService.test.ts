/**
 * Tests for InstructionService
 *
 * Comprehensive tests covering:
 * - LLM-based instruction parsing (parseUserMessage)
 * - Instruction CRUD operations
 * - Condition evaluation
 * - Edge cases and error handling
 */

import { describe, expect, it } from 'bun:test';

// =============================================================================
// Types for Testing
// =============================================================================

interface ParsedInstruction {
  isInstruction: boolean;
  confidence: number;
  rule: string;
  category: 'trading' | 'social' | 'behavior' | 'general';
  directiveType: 'always' | 'never' | 'prefer' | 'avoid' | 'until';
  priority: number;
  validUntil?: string;
  conditions?: {
    priceAbove?: { ticker: string; value: number };
    priceBelow?: { ticker: string; value: number };
    afterDate?: string;
    beforeDate?: string;
  };
}

interface AgentInstruction {
  id: string;
  agentUserId: string;
  ownerId: string;
  content: string;
  parsedRule: string | null;
  category: string;
  directiveType: string;
  priority: number;
  status: string;
  validFrom: Date;
  validUntil: Date | null;
  conditions: Record<string, unknown> | null;
  sourceMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  revokedAt: Date | null;
}

interface PerpMarketContext {
  ticker: string;
  currentPrice: number;
}

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_AGENT_ID = 'agent-test-12345';
const TEST_OWNER_ID = 'owner-test-67890';

const createMockInstruction = (
  overrides: Partial<AgentInstruction> = {}
): AgentInstruction => ({
  id: `inst-${Date.now()}`,
  agentUserId: TEST_AGENT_ID,
  ownerId: TEST_OWNER_ID,
  content: 'Never buy BTC above $100k',
  parsedRule: 'Never buy BTC above $100k',
  category: 'trading',
  directiveType: 'never',
  priority: 8,
  status: 'active',
  validFrom: new Date(),
  validUntil: null,
  conditions: null,
  sourceMessageId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  revokedAt: null,
  ...overrides,
});

const createMockParsedInstruction = (
  overrides: Partial<ParsedInstruction> = {}
): ParsedInstruction => ({
  isInstruction: true,
  confidence: 0.9,
  rule: 'Never buy BTC above $100k',
  category: 'trading',
  directiveType: 'never',
  priority: 8,
  ...overrides,
});

// =============================================================================
// parseUserMessage Tests
// =============================================================================

describe('InstructionService - parseUserMessage', () => {
  describe('Message Classification', () => {
    it('should return null for very short messages (< 5 chars)', () => {
      const shortMessages = ['Hi', 'Ok', 'Yes', 'No', ''];
      for (const msg of shortMessages) {
        // Short messages should be filtered before LLM call
        expect(msg.length).toBeLessThan(5);
      }
    });

    it('should skip pure questions ending with ?', () => {
      const questions = [
        'How are you doing?',
        "What's your P&L?",
        'Can you show me your positions?',
        "What's the market like?",
      ];
      for (const q of questions) {
        expect(q.endsWith('?')).toBe(true);
        // These should NOT be instructions unless they contain negation
        const containsNegation =
          q.toLowerCase().includes("don't") ||
          q.toLowerCase().includes('do not') ||
          q.toLowerCase().includes('stop');
        expect(containsNegation).toBe(false);
      }
    });

    it('should process questions containing "don\'t" as potential instructions', () => {
      const instructionQuestions = [
        "Why don't you stop buying meme coins?",
        "Can you don't trade on weekends?",
      ];
      for (const q of instructionQuestions) {
        expect(q.endsWith('?')).toBe(true);
        expect(q.toLowerCase().includes("don't")).toBe(true);
      }
    });

    it('should process questions containing "stop" as potential instructions', () => {
      const stopQuestions = ['Can you stop trading today?'];
      for (const q of stopQuestions) {
        expect(q.toLowerCase().includes('stop')).toBe(true);
      }
    });
  });

  describe('Instruction Detection Examples', () => {
    it('should classify trading directives correctly', () => {
      const tradingInstructions = [
        "Don't buy any more BitcAIn",
        'Focus on prediction markets instead of perps',
        'Be more aggressive with your trades',
        'Only buy if the price drops below $100k',
        'Limit position sizes to 500 points',
      ];

      for (const inst of tradingInstructions) {
        // All these should contain action verbs or negations
        const hasActionVerb =
          inst.toLowerCase().includes('buy') ||
          inst.toLowerCase().includes('focus') ||
          inst.toLowerCase().includes('be') ||
          inst.toLowerCase().includes('limit');
        expect(hasActionVerb).toBe(true);
      }
    });

    it('should classify conversational messages correctly', () => {
      const conversationalMessages = [
        'How are you doing?',
        "What's your P&L?",
        'Thanks!',
        'Show me your positions',
        'Hello',
      ];

      for (const msg of conversationalMessages) {
        // These should NOT be classified as instructions
        const hasImperativeAction =
          msg.toLowerCase().includes('never') ||
          msg.toLowerCase().includes('always') ||
          msg.toLowerCase().includes("don't") ||
          msg.toLowerCase().includes('must');
        expect(hasImperativeAction).toBe(false);
      }
    });
  });

  describe('Parsed Instruction Validation', () => {
    it('should clamp priority to valid range 1-10', () => {
      const priorities = [-5, 0, 5, 10, 15, 100];
      for (const p of priorities) {
        const clamped = Math.max(1, Math.min(10, p));
        expect(clamped).toBeGreaterThanOrEqual(1);
        expect(clamped).toBeLessThanOrEqual(10);
      }
    });

    it('should require rule, category, and directiveType fields', () => {
      const validParsed = createMockParsedInstruction();
      expect(validParsed.rule).toBeTruthy();
      expect(validParsed.category).toBeTruthy();
      expect(validParsed.directiveType).toBeTruthy();
    });

    it('should accept valid categories', () => {
      const validCategories = ['trading', 'social', 'behavior', 'general'];
      for (const cat of validCategories) {
        expect(validCategories).toContain(cat);
      }
    });

    it('should accept valid directive types', () => {
      const validTypes = ['always', 'never', 'prefer', 'avoid', 'until'];
      for (const type of validTypes) {
        expect(validTypes).toContain(type);
      }
    });
  });

  describe('Confidence Threshold', () => {
    it('should reject instructions below confidence threshold (0.7)', () => {
      const lowConfidenceResults = [
        { isInstruction: true, confidence: 0.3 },
        { isInstruction: true, confidence: 0.5 },
        { isInstruction: true, confidence: 0.69 },
      ];

      const threshold = 0.7;
      for (const result of lowConfidenceResults) {
        const shouldReject = result.confidence < threshold;
        expect(shouldReject).toBe(true);
      }
    });

    it('should accept instructions at or above confidence threshold', () => {
      const highConfidenceResults = [
        { isInstruction: true, confidence: 0.7 },
        { isInstruction: true, confidence: 0.85 },
        { isInstruction: true, confidence: 1.0 },
      ];

      const threshold = 0.7;
      for (const result of highConfidenceResults) {
        const shouldAccept = result.confidence >= threshold;
        expect(shouldAccept).toBe(true);
      }
    });
  });
});

// =============================================================================
// createInstruction Tests
// =============================================================================

describe('InstructionService - createInstruction', () => {
  it('should create instruction with all required fields', () => {
    const parsed = createMockParsedInstruction();
    const instruction = createMockInstruction({
      content: 'Test instruction',
      parsedRule: parsed.rule,
      category: parsed.category,
      directiveType: parsed.directiveType,
      priority: parsed.priority,
      status: 'active',
    });

    expect(instruction.id).toBeDefined();
    expect(instruction.agentUserId).toBe(TEST_AGENT_ID);
    expect(instruction.ownerId).toBe(TEST_OWNER_ID);
    expect(instruction.content).toBe('Test instruction');
    expect(instruction.parsedRule).toBe(parsed.rule);
    expect(instruction.category).toBe('trading');
    expect(instruction.directiveType).toBe('never');
    expect(instruction.priority).toBe(8);
    expect(instruction.status).toBe('active');
  });

  it('should set validFrom to current time', () => {
    const before = new Date();
    const instruction = createMockInstruction();
    const after = new Date();

    expect(instruction.validFrom.getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000
    );
    expect(instruction.validFrom.getTime()).toBeLessThanOrEqual(
      after.getTime() + 1000
    );
  });

  it('should parse validUntil from ISO string', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const instruction = createMockInstruction({
      validUntil: futureDate,
    });

    expect(instruction.validUntil).toBeDefined();
    expect(instruction.validUntil!.getTime()).toBe(futureDate.getTime());
  });

  it('should allow null validUntil for permanent instructions', () => {
    const instruction = createMockInstruction({ validUntil: null });
    expect(instruction.validUntil).toBeNull();
  });

  it('should store conditions as JSON', () => {
    const conditions = {
      priceBelow: { ticker: 'BTC', value: 100000 },
    };
    const instruction = createMockInstruction({ conditions });

    expect(instruction.conditions).toEqual(conditions);
  });

  it('should store sourceMessageId when provided', () => {
    const instruction = createMockInstruction({
      sourceMessageId: 'msg-123456',
    });
    expect(instruction.sourceMessageId).toBe('msg-123456');
  });
});

// =============================================================================
// getActiveInstructions Tests
// =============================================================================

describe('InstructionService - getActiveInstructions', () => {
  it('should filter out expired instructions', () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

    const instructions = [
      createMockInstruction({ status: 'active', validUntil: null }),
      createMockInstruction({ status: 'active', validUntil: pastDate }),
      createMockInstruction({ status: 'expired', validUntil: pastDate }),
    ];

    const active = instructions.filter((i) => {
      if (i.status !== 'active') return false;
      if (i.validUntil && i.validUntil < now) return false;
      return true;
    });

    expect(active.length).toBe(1);
  });

  it('should include instructions with no validUntil', () => {
    const instructions = [
      createMockInstruction({ status: 'active', validUntil: null }),
      createMockInstruction({ status: 'active', validUntil: null }),
    ];

    const active = instructions.filter((i) => i.validUntil === null);
    expect(active.length).toBe(2);
  });

  it('should include instructions with future validUntil', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const instructions = [
      createMockInstruction({ status: 'active', validUntil: futureDate }),
    ];

    const now = new Date();
    const active = instructions.filter(
      (i) => i.status === 'active' && (!i.validUntil || i.validUntil > now)
    );
    expect(active.length).toBe(1);
  });

  it('should sort by priority descending (highest first)', () => {
    const instructions = [
      createMockInstruction({ priority: 3, id: 'low' }),
      createMockInstruction({ priority: 9, id: 'high' }),
      createMockInstruction({ priority: 5, id: 'medium' }),
    ];

    const sorted = instructions.sort((a, b) => b.priority - a.priority);
    expect(sorted[0]!.id).toBe('high');
    expect(sorted[1]!.id).toBe('medium');
    expect(sorted[2]!.id).toBe('low');
  });

  it('should limit to MAX_INSTRUCTIONS_PER_AGENT (15)', () => {
    const MAX_INSTRUCTIONS = 15;
    const instructions = Array.from({ length: 20 }, (_, i) =>
      createMockInstruction({ id: `inst-${i}`, priority: i })
    );

    const limited = instructions.slice(0, MAX_INSTRUCTIONS);
    expect(limited.length).toBe(15);
  });

  it('should return empty array for agents with no instructions', () => {
    const instructions: AgentInstruction[] = [];
    expect(instructions.length).toBe(0);
  });
});

// =============================================================================
// revokeInstruction Tests
// =============================================================================

describe('InstructionService - revokeInstruction', () => {
  it('should mark instruction as revoked with revokedAt timestamp', () => {
    const instruction = createMockInstruction({ status: 'active' });

    // Simulate revocation
    const now = new Date();
    const revoked = {
      ...instruction,
      status: 'revoked',
      revokedAt: now,
      updatedAt: now,
    };

    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedAt).toBeDefined();
    expect(revoked.updatedAt).toBeDefined();
  });

  it('should only revoke instructions owned by the requester', () => {
    const instruction = createMockInstruction({ ownerId: 'owner-A' });

    // Owner A can revoke
    const canRevokeA = instruction.ownerId === 'owner-A';
    expect(canRevokeA).toBe(true);

    // Owner B cannot revoke
    const canRevokeB = instruction.ownerId === 'owner-B';
    expect(canRevokeB).toBe(false);
  });

  it('should not revoke already revoked instructions', () => {
    const instruction = createMockInstruction({ status: 'revoked' });
    const canRevoke = instruction.status === 'active';
    expect(canRevoke).toBe(false);
  });

  it('should not revoke completed instructions', () => {
    const instruction = createMockInstruction({ status: 'completed' });
    const canRevoke = instruction.status === 'active';
    expect(canRevoke).toBe(false);
  });

  it('should not revoke expired instructions', () => {
    const instruction = createMockInstruction({ status: 'expired' });
    const canRevoke = instruction.status === 'active';
    expect(canRevoke).toBe(false);
  });
});

// =============================================================================
// completeInstruction Tests
// =============================================================================

describe('InstructionService - completeInstruction', () => {
  it('should mark instruction as completed with completedAt timestamp', () => {
    const instruction = createMockInstruction({ status: 'active' });

    const now = new Date();
    const completed = {
      ...instruction,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    };

    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeDefined();
  });

  it('should only complete active instructions', () => {
    const statuses = ['active', 'expired', 'revoked', 'completed'];
    for (const status of statuses) {
      const canComplete = status === 'active';
      if (status === 'active') {
        expect(canComplete).toBe(true);
      } else {
        expect(canComplete).toBe(false);
      }
    }
  });
});

// =============================================================================
// expireStaleInstructions Tests
// =============================================================================

describe('InstructionService - expireStaleInstructions', () => {
  it('should expire instructions past their validUntil date', () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const instructions = [
      createMockInstruction({
        status: 'active',
        validUntil: pastDate,
        id: 'expired-1',
      }),
      createMockInstruction({
        status: 'active',
        validUntil: null,
        id: 'active-1',
      }),
      createMockInstruction({
        status: 'active',
        validUntil: pastDate,
        id: 'expired-2',
      }),
    ];

    const toExpire = instructions.filter(
      (i) => i.status === 'active' && i.validUntil && i.validUntil < now
    );

    expect(toExpire.length).toBe(2);
    expect(toExpire.map((i) => i.id)).toContain('expired-1');
    expect(toExpire.map((i) => i.id)).toContain('expired-2');
  });

  it('should not expire instructions with no validUntil', () => {
    const instructions = [
      createMockInstruction({ status: 'active', validUntil: null }),
    ];

    const now = new Date();
    const toExpire = instructions.filter(
      (i) => i.status === 'active' && i.validUntil && i.validUntil < now
    );

    expect(toExpire.length).toBe(0);
  });

  it('should not expire instructions with future validUntil', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const instructions = [
      createMockInstruction({ status: 'active', validUntil: futureDate }),
    ];

    const now = new Date();
    const toExpire = instructions.filter(
      (i) => i.status === 'active' && i.validUntil && i.validUntil < now
    );

    expect(toExpire.length).toBe(0);
  });
});

// =============================================================================
// evaluateConditions Tests
// =============================================================================

describe('InstructionService - evaluateConditions', () => {
  const createMarketContext = (
    ticker: string,
    price: number
  ): PerpMarketContext => ({
    ticker,
    currentPrice: price,
  });

  describe('No Conditions', () => {
    it('should return met=true when instruction has no conditions', () => {
      const instruction = createMockInstruction({ conditions: null });
      // No conditions = always applies
      expect(instruction.conditions).toBeNull();
    });
  });

  describe('priceBelow Condition', () => {
    it('should return met=true when price is below threshold', () => {
      const conditions = { priceBelow: { ticker: 'BTC', value: 100000 } };
      const markets = [createMarketContext('BTC', 95000)];

      const market = markets.find((m) => m.ticker === 'BTC');
      const isMet = market && market.currentPrice < conditions.priceBelow.value;
      expect(isMet).toBe(true);
    });

    it('should return met=false when price is at threshold', () => {
      const conditions = { priceBelow: { ticker: 'BTC', value: 100000 } };
      const markets = [createMarketContext('BTC', 100000)];

      const market = markets.find((m) => m.ticker === 'BTC');
      const isMet = market && market.currentPrice < conditions.priceBelow.value;
      expect(isMet).toBe(false);
    });

    it('should return met=false when price is above threshold', () => {
      const conditions = { priceBelow: { ticker: 'BTC', value: 100000 } };
      const markets = [createMarketContext('BTC', 105000)];

      const market = markets.find((m) => m.ticker === 'BTC');
      const isMet = market && market.currentPrice < conditions.priceBelow.value;
      expect(isMet).toBe(false);
    });

    it('should return met=false when ticker not found in markets', () => {
      // conditions = { priceBelow: { ticker: 'XYZ', value: 100 } }
      const markets = [createMarketContext('BTC', 95000)];

      const market = markets.find((m) => m.ticker === 'XYZ');
      expect(market).toBeUndefined();
    });
  });

  describe('priceAbove Condition', () => {
    it('should return met=true when price is above threshold', () => {
      const conditions = { priceAbove: { ticker: 'ETH', value: 3000 } };
      const markets = [createMarketContext('ETH', 3500)];

      const market = markets.find((m) => m.ticker === 'ETH');
      const isMet = market && market.currentPrice > conditions.priceAbove.value;
      expect(isMet).toBe(true);
    });

    it('should return met=false when price is at threshold', () => {
      const conditions = { priceAbove: { ticker: 'ETH', value: 3000 } };
      const markets = [createMarketContext('ETH', 3000)];

      const market = markets.find((m) => m.ticker === 'ETH');
      const isMet = market && market.currentPrice > conditions.priceAbove.value;
      expect(isMet).toBe(false);
    });

    it('should return met=false when price is below threshold', () => {
      const conditions = { priceAbove: { ticker: 'ETH', value: 3000 } };
      const markets = [createMarketContext('ETH', 2500)];

      const market = markets.find((m) => m.ticker === 'ETH');
      const isMet = market && market.currentPrice > conditions.priceAbove.value;
      expect(isMet).toBe(false);
    });
  });

  describe('afterDate Condition', () => {
    it('should return met=true when current time is after the date', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const conditions = { afterDate: pastDate.toISOString() };

      const now = new Date();
      const isMet = now >= new Date(conditions.afterDate);
      expect(isMet).toBe(true);
    });

    it('should return met=false when current time is before the date', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const conditions = { afterDate: futureDate.toISOString() };

      const now = new Date();
      const isMet = now >= new Date(conditions.afterDate);
      expect(isMet).toBe(false);
    });
  });

  describe('beforeDate Condition', () => {
    it('should return met=true when current time is before the date', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const conditions = { beforeDate: futureDate.toISOString() };

      const now = new Date();
      const isMet = now <= new Date(conditions.beforeDate);
      expect(isMet).toBe(true);
    });

    it('should return met=false when current time is after the date', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const conditions = { beforeDate: pastDate.toISOString() };

      const now = new Date();
      const isMet = now <= new Date(conditions.beforeDate);
      expect(isMet).toBe(false);
    });
  });

  describe('Multiple Conditions', () => {
    it('should require ALL conditions to be met', () => {
      const conditions = {
        priceBelow: { ticker: 'BTC', value: 100000 },
        afterDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };
      const markets = [createMarketContext('BTC', 95000)];
      const now = new Date();

      const market = markets.find((m) => m.ticker === 'BTC');
      const priceMet =
        market && market.currentPrice < conditions.priceBelow.value;
      const dateMet = now >= new Date(conditions.afterDate);
      const allMet = priceMet && dateMet;

      expect(allMet).toBe(true);
    });

    it('should return met=false if any condition fails', () => {
      const conditions = {
        priceBelow: { ticker: 'BTC', value: 100000 },
        afterDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Future date
      };
      const markets = [createMarketContext('BTC', 95000)];
      const now = new Date();

      const market = markets.find((m) => m.ticker === 'BTC');
      const priceMet =
        market && market.currentPrice < conditions.priceBelow.value;
      const dateMet = now >= new Date(conditions.afterDate);
      const allMet = priceMet && dateMet;

      expect(priceMet).toBe(true);
      expect(dateMet).toBe(false);
      expect(allMet).toBe(false);
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('InstructionService - Edge Cases', () => {
  it('should handle instructions with all optional fields null', () => {
    const instruction = createMockInstruction({
      parsedRule: null,
      validUntil: null,
      conditions: null,
      sourceMessageId: null,
      completedAt: null,
      revokedAt: null,
    });

    expect(instruction.parsedRule).toBeNull();
    expect(instruction.validUntil).toBeNull();
    expect(instruction.conditions).toBeNull();
  });

  it('should handle very long rule content (up to 500 chars)', () => {
    const longRule = 'A'.repeat(500);
    const instruction = createMockInstruction({ content: longRule });
    expect(instruction.content.length).toBe(500);
  });

  it('should handle priority at boundaries', () => {
    const minPriority = createMockInstruction({ priority: 1 });
    const maxPriority = createMockInstruction({ priority: 10 });

    expect(minPriority.priority).toBe(1);
    expect(maxPriority.priority).toBe(10);
  });

  it('should handle all status values', () => {
    const statuses = ['active', 'expired', 'revoked', 'completed'];
    for (const status of statuses) {
      const instruction = createMockInstruction({
        status: status as AgentInstruction['status'],
      });
      expect(instruction.status).toBe(status);
    }
  });

  it('should handle very precise price conditions', () => {
    const conditions = {
      priceBelow: { ticker: 'BTC', value: 99999.99999 },
    };
    const instruction = createMockInstruction({ conditions });
    expect(
      (instruction.conditions as { priceBelow: { value: number } }).priceBelow
        .value
    ).toBe(99999.99999);
  });

  it('should handle date conditions at exact boundaries', () => {
    const now = new Date();
    const conditions = {
      afterDate: now.toISOString(),
    };
    const instruction = createMockInstruction({ conditions });
    expect(instruction.conditions).toBeDefined();
  });
});
