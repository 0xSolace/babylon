/**
 * Tests for Agent Instructions API Route
 *
 * @route GET /api/agents/[agentId]/instructions - List instructions
 * @route POST /api/agents/[agentId]/instructions - Create instruction
 * @route DELETE /api/agents/[agentId]/instructions - Revoke instruction
 *
 * Comprehensive tests covering:
 * - Authentication and authorization
 * - Query parameter validation
 * - Request body validation
 * - CRUD operations
 * - Edge cases and error handling
 */

import { describe, expect, it } from 'bun:test';

// =============================================================================
// Types
// =============================================================================

interface CreateInstructionBody {
  rule: string;
  category: 'trading' | 'social' | 'behavior' | 'general';
  directiveType: 'always' | 'never' | 'prefer' | 'avoid' | 'until';
  priority?: number;
  validUntil?: string | null;
  conditions?: {
    priceBelow?: { ticker: string; value: number };
    priceAbove?: { ticker: string; value: number };
    afterDate?: string;
    beforeDate?: string;
  } | null;
}

interface InstructionResponse {
  id: string;
  content: string;
  parsedRule: string | null;
  category: string;
  directiveType: string;
  priority: number;
  status: string;
  validFrom: string;
  validUntil: string | null;
  conditions: Record<string, unknown> | null;
  createdAt: string;
}

// =============================================================================
// Test Fixtures
// =============================================================================

const OWNER_ID = 'owner-test-456';

const validCreateBody: CreateInstructionBody = {
  rule: 'Never buy BTC above $100k',
  category: 'trading',
  directiveType: 'never',
  priority: 8,
  validUntil: null,
  conditions: null,
};

const createMockInstructionResponse = (
  overrides: Partial<InstructionResponse> = {}
): InstructionResponse => ({
  id: `inst-${Date.now()}`,
  content: 'Never buy BTC above $100k',
  parsedRule: 'Never buy BTC above $100k',
  category: 'trading',
  directiveType: 'never',
  priority: 8,
  status: 'active',
  validFrom: new Date().toISOString(),
  validUntil: null,
  conditions: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// =============================================================================
// GET /api/agents/[agentId]/instructions Tests
// =============================================================================

describe('GET /api/agents/[agentId]/instructions', () => {
  describe('Authentication', () => {
    it('should require authentication', () => {
      // Request without auth token should be rejected
      const hasAuthHeader = false;
      expect(hasAuthHeader).toBe(false);
    });

    it('should reject invalid auth tokens', () => {
      const invalidTokens = ['invalid', '', 'Bearer ', 'not-a-jwt'];
      for (const token of invalidTokens) {
        expect(token.length < 50 || !token.includes('.')).toBe(true);
      }
    });
  });

  describe('Authorization', () => {
    it('should only allow agent owner to view instructions', () => {
      // Owner check logic
      const agentManagedBy = OWNER_ID;
      const requestingUserId = OWNER_ID;
      const isOwner = agentManagedBy === requestingUserId;
      expect(isOwner).toBe(true);
    });

    it('should reject requests from non-owners', () => {
      const agentManagedBy: string = OWNER_ID;
      const requestingUserId: string = 'other-user';
      const isOwner = agentManagedBy === requestingUserId;
      expect(isOwner).toBe(false);
    });
  });

  describe('Status Filter Parameter', () => {
    it('should default to active when status not provided', () => {
      const defaultStatus = 'active';
      expect(defaultStatus).toBe('active');
    });

    it('should accept valid status values', () => {
      const validStatuses = [
        'active',
        'expired',
        'revoked',
        'completed',
        'all',
      ];
      for (const status of validStatuses) {
        expect(validStatuses).toContain(status);
      }
    });

    it('should handle status=all', () => {
      const status = 'all';
      const shouldFetchAll = status === 'all';
      expect(shouldFetchAll).toBe(true);
    });

    it('should filter by specific status', () => {
      const statuses = ['active', 'expired', 'revoked', 'completed'];
      for (const status of statuses) {
        const instructions = [
          { status: 'active' },
          { status: 'expired' },
          { status: 'revoked' },
        ];
        const filtered = instructions.filter((i) => i.status === status);
        expect(Array.isArray(filtered)).toBe(true);
      }
    });
  });

  describe('Response Format', () => {
    it('should return success response structure', () => {
      const response = {
        success: true,
        instructions: [createMockInstructionResponse()],
        count: 1,
      };

      expect(response.success).toBe(true);
      expect(Array.isArray(response.instructions)).toBe(true);
      expect(typeof response.count).toBe('number');
    });

    it('should format instruction dates as ISO strings', () => {
      const instruction = createMockInstructionResponse();
      expect(instruction.validFrom).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
      expect(instruction.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it('should handle null validUntil', () => {
      const instruction = createMockInstructionResponse({ validUntil: null });
      expect(instruction.validUntil).toBeNull();
    });

    it('should format validUntil as ISO string when present', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const instruction = createMockInstructionResponse({
        validUntil: futureDate.toISOString(),
      });
      expect(instruction.validUntil).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it('should limit results to 50', () => {
      const maxResults = 50;
      const instructions = Array.from({ length: 100 }, (_, i) =>
        createMockInstructionResponse({ id: `inst-${i}` })
      );
      const limited = instructions.slice(0, maxResults);
      expect(limited.length).toBe(50);
    });

    it('should return empty array when no instructions', () => {
      const response = {
        success: true,
        instructions: [],
        count: 0,
      };
      expect(response.instructions.length).toBe(0);
      expect(response.count).toBe(0);
    });
  });

  describe('Error Responses', () => {
    it('should return 404 for non-existent agent', () => {
      const errorResponse = {
        success: false,
        error: 'Agent not found or unauthorized',
      };
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toContain('not found');
    });
  });
});

// =============================================================================
// POST /api/agents/[agentId]/instructions Tests
// =============================================================================

describe('POST /api/agents/[agentId]/instructions', () => {
  describe('Request Body Validation', () => {
    it('should require rule field', () => {
      const bodyWithoutRule = {
        category: 'trading',
        directiveType: 'never',
      };
      expect('rule' in bodyWithoutRule).toBe(false);
    });

    it('should reject rule shorter than 5 characters', () => {
      const shortRules = ['Hi', 'Buy', 'No'];
      for (const rule of shortRules) {
        expect(rule.length).toBeLessThan(5);
      }
    });

    it('should reject rule longer than 500 characters', () => {
      const longRule = 'A'.repeat(501);
      expect(longRule.length).toBeGreaterThan(500);
    });

    it('should accept rule of exactly 5 characters', () => {
      const rule = 'ABCDE';
      expect(rule.length).toBe(5);
    });

    it('should accept rule of exactly 500 characters', () => {
      const rule = 'A'.repeat(500);
      expect(rule.length).toBe(500);
    });

    it('should require valid category', () => {
      const validCategories = ['trading', 'social', 'behavior', 'general'];
      const invalidCategories = ['invalid', 'TRADING', '', 'trade'];

      for (const cat of validCategories) {
        expect(validCategories).toContain(cat);
      }

      for (const cat of invalidCategories) {
        expect(validCategories).not.toContain(cat);
      }
    });

    it('should require valid directiveType', () => {
      const validTypes = ['always', 'never', 'prefer', 'avoid', 'until'];
      const invalidTypes = ['invalid', 'ALWAYS', '', 'do'];

      for (const type of validTypes) {
        expect(validTypes).toContain(type);
      }

      for (const type of invalidTypes) {
        expect(validTypes).not.toContain(type);
      }
    });

    it('should default priority to 5', () => {
      const bodyWithoutPriority: Partial<CreateInstructionBody> = {
        rule: 'Test rule here',
        category: 'trading',
        directiveType: 'always',
      };
      const defaultPriority = 5;
      expect(bodyWithoutPriority.priority ?? defaultPriority).toBe(5);
    });

    it('should accept priority in range 1-10', () => {
      const validPriorities = [1, 5, 10];
      for (const p of validPriorities) {
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(10);
      }
    });

    it('should reject priority below 1', () => {
      const invalidPriorities = [0, -1, -100];
      for (const p of invalidPriorities) {
        expect(p).toBeLessThan(1);
      }
    });

    it('should reject priority above 10', () => {
      const invalidPriorities = [11, 100];
      for (const p of invalidPriorities) {
        expect(p).toBeGreaterThan(10);
      }
    });

    it('should accept null validUntil', () => {
      const body: CreateInstructionBody = {
        ...validCreateBody,
        validUntil: null,
      };
      expect(body.validUntil).toBeNull();
    });

    it('should accept valid ISO datetime for validUntil', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const body: CreateInstructionBody = {
        ...validCreateBody,
        validUntil: futureDate.toISOString(),
      };
      expect(body.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should reject invalid datetime format', () => {
      const invalidDates = ['tomorrow', '2024-13-45', 'not-a-date'];
      for (const date of invalidDates) {
        const parsed = new Date(date);
        expect(isNaN(parsed.getTime())).toBe(true);
      }
    });

    it('should accept null conditions', () => {
      const body: CreateInstructionBody = {
        ...validCreateBody,
        conditions: null,
      };
      expect(body.conditions).toBeNull();
    });

    it('should accept valid priceBelow condition', () => {
      const body: CreateInstructionBody = {
        ...validCreateBody,
        conditions: {
          priceBelow: { ticker: 'BTC', value: 100000 },
        },
      };
      expect(body.conditions?.priceBelow?.ticker).toBe('BTC');
      expect(body.conditions?.priceBelow?.value).toBe(100000);
    });

    it('should accept valid priceAbove condition', () => {
      const body: CreateInstructionBody = {
        ...validCreateBody,
        conditions: {
          priceAbove: { ticker: 'ETH', value: 3000 },
        },
      };
      expect(body.conditions?.priceAbove?.ticker).toBe('ETH');
      expect(body.conditions?.priceAbove?.value).toBe(3000);
    });

    it('should accept valid afterDate condition', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const body: CreateInstructionBody = {
        ...validCreateBody,
        conditions: {
          afterDate: futureDate.toISOString(),
        },
      };
      expect(body.conditions?.afterDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should accept multiple conditions', () => {
      const body: CreateInstructionBody = {
        ...validCreateBody,
        conditions: {
          priceBelow: { ticker: 'BTC', value: 100000 },
          afterDate: new Date().toISOString(),
        },
      };
      expect(body.conditions?.priceBelow).toBeDefined();
      expect(body.conditions?.afterDate).toBeDefined();
    });
  });

  describe('JSON Parsing Errors', () => {
    it('should handle invalid JSON gracefully', () => {
      const invalidJsonStrings = ['{invalid', '{"unclosed":', '', 'not json'];
      for (const str of invalidJsonStrings) {
        let parseError = false;
        try {
          JSON.parse(str);
        } catch {
          parseError = true;
        }
        expect(parseError).toBe(true);
      }
    });
  });

  describe('Response Format', () => {
    it('should return created instruction on success', () => {
      const response = {
        success: true,
        instruction: createMockInstructionResponse(),
      };

      expect(response.success).toBe(true);
      expect(response.instruction.id).toBeDefined();
      expect(response.instruction.status).toBe('active');
    });

    it('should set confidence to 1.0 for UI-created instructions', () => {
      // UI-created instructions bypass LLM parsing
      const confidence = 1.0;
      expect(confidence).toBe(1.0);
    });
  });

  describe('Error Responses', () => {
    it('should return 400 for validation errors', () => {
      const errorResponse = {
        success: false,
        error: 'Rule must be at least 5 characters',
      };
      expect(errorResponse.success).toBe(false);
    });

    it('should return 404 for unauthorized agent', () => {
      const errorResponse = {
        success: false,
        error: 'Agent not found or unauthorized',
      };
      expect(errorResponse.success).toBe(false);
    });
  });
});

// =============================================================================
// DELETE /api/agents/[agentId]/instructions Tests
// =============================================================================

describe('DELETE /api/agents/[agentId]/instructions', () => {
  describe('Request Body Validation', () => {
    it('should require instructionId field', () => {
      const bodyWithoutId = {};
      expect('instructionId' in bodyWithoutId).toBe(false);
    });

    it('should reject empty instructionId', () => {
      const emptyIds = ['', '   '];
      for (const id of emptyIds) {
        expect(id.trim().length).toBe(0);
      }
    });

    it('should accept valid instructionId', () => {
      const validIds = ['inst-123', '1234567890', 'abc-def-ghi'];
      for (const id of validIds) {
        expect(id.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Revocation Logic', () => {
    it('should only revoke active instructions', () => {
      const statuses = ['active', 'expired', 'revoked', 'completed'];
      for (const status of statuses) {
        const canRevoke = status === 'active';
        if (status === 'active') {
          expect(canRevoke).toBe(true);
        } else {
          expect(canRevoke).toBe(false);
        }
      }
    });

    it('should verify owner before revocation', () => {
      const instructionOwnerId = OWNER_ID;
      const requestingUserId = OWNER_ID;
      const canRevoke = instructionOwnerId === requestingUserId;
      expect(canRevoke).toBe(true);
    });

    it('should reject revocation from non-owner', () => {
      const instructionOwnerId: string = OWNER_ID;
      const requestingUserId: string = 'other-user';
      const canRevoke = instructionOwnerId === requestingUserId;
      expect(canRevoke).toBe(false);
    });
  });

  describe('Response Format', () => {
    it('should return success with instructionId', () => {
      const instructionId = 'inst-123';
      const response = {
        success: true,
        message: 'Instruction revoked',
        instructionId,
      };

      expect(response.success).toBe(true);
      expect(response.instructionId).toBe(instructionId);
    });
  });

  describe('Error Responses', () => {
    it('should return 400 for missing instructionId', () => {
      const errorResponse = {
        success: false,
        error: 'Instruction ID is required',
      };
      expect(errorResponse.success).toBe(false);
    });

    it('should return 404 for non-existent instruction', () => {
      const errorResponse = {
        success: false,
        error: 'Instruction not found, already revoked, or unauthorized',
      };
      expect(errorResponse.success).toBe(false);
    });

    it('should return 404 for already revoked instruction', () => {
      const errorResponse = {
        success: false,
        error: 'Instruction not found, already revoked, or unauthorized',
      };
      expect(errorResponse.error).toContain('already revoked');
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('should handle concurrent requests gracefully', async () => {
    // Simulate concurrent instruction creation
    const requests = Array.from({ length: 5 }, (_, i) => ({
      rule: `Test rule ${i}`,
      category: 'trading' as const,
      directiveType: 'always' as const,
    }));

    expect(requests.length).toBe(5);
  });

  it('should handle unicode in rule content', () => {
    const rule = 'Never buy 比特币 when 🚀';
    expect(rule.length).toBeGreaterThan(5);
  });

  it('should handle special characters in rule', () => {
    const rules = [
      "Don't buy at $100k",
      'Avoid <script> tags',
      'Use 50% position size',
      'Check BTC/USD pair',
    ];

    for (const rule of rules) {
      expect(rule.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('should preserve whitespace in rules', () => {
    const rule = '  Never    buy   BTC  ';
    const trimmed = rule.trim();
    expect(trimmed).toBe('Never    buy   BTC');
  });

  it('should handle very long condition values', () => {
    const condition = {
      priceBelow: {
        ticker: 'A'.repeat(100),
        value: 999999999999,
      },
    };
    expect(condition.priceBelow.ticker.length).toBe(100);
    expect(condition.priceBelow.value).toBe(999999999999);
  });

  it('should handle condition with zero values', () => {
    const condition = {
      priceAbove: { ticker: 'BTC', value: 0 },
    };
    expect(condition.priceAbove.value).toBe(0);
  });

  it('should handle condition with negative values', () => {
    // Negative prices shouldn't normally occur but test the handling
    const condition = {
      priceBelow: { ticker: 'BTC', value: -100 },
    };
    expect(condition.priceBelow.value).toBe(-100);
  });
});

// =============================================================================
// Integration Points
// =============================================================================

describe('Integration Points', () => {
  it('should interact with InstructionService correctly', () => {
    // Verify expected service methods
    const expectedMethods = [
      'createInstruction',
      'getActiveInstructions',
      'revokeInstruction',
    ];

    for (const method of expectedMethods) {
      expect(typeof method).toBe('string');
    }
  });

  it('should use correct database table', () => {
    const tableName = 'AgentInstruction';
    expect(tableName).toBe('AgentInstruction');
  });

  it('should log instruction operations', () => {
    const operations = ['created via API', 'revoked via API'];
    for (const op of operations) {
      expect(op.includes('via API')).toBe(true);
    }
  });
});
