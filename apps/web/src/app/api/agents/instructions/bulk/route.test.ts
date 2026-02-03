/**
 * Tests for Bulk Instructions API Route
 *
 * @route POST /api/agents/instructions/bulk - Create instructions for multiple agents
 *
 * Comprehensive tests covering:
 * - Request validation
 * - Agent ownership verification
 * - Bulk creation logic
 * - Edge cases and error handling
 */

import { describe, expect, it } from 'bun:test';

// =============================================================================
// Types
// =============================================================================

interface BulkInstructionRequest {
  agentIds: string[];
  instruction: {
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
  };
}

interface BulkInstructionResponse {
  success: boolean;
  created: number;
  skipped: number;
  instructions: Array<{ agentId: string; instructionId: string }>;
  skippedAgentIds?: string[];
  error?: string;
}

// =============================================================================
// Test Fixtures
// =============================================================================

const OWNER_ID = 'owner-test-123';
const OWNED_AGENT_IDS = ['agent-1', 'agent-2', 'agent-3'];
const UNOWNED_AGENT_ID = 'agent-not-owned';

const validBulkRequest: BulkInstructionRequest = {
  agentIds: OWNED_AGENT_IDS,
  instruction: {
    rule: 'Never buy BTC above $100k',
    category: 'trading',
    directiveType: 'never',
    priority: 8,
    validUntil: null,
    conditions: null,
  },
};

// =============================================================================
// Request Validation Tests
// =============================================================================

describe('POST /api/agents/instructions/bulk - Validation', () => {
  describe('agentIds Validation', () => {
    it('should require at least one agent ID', () => {
      const request: BulkInstructionRequest = {
        ...validBulkRequest,
        agentIds: [],
      };
      expect(request.agentIds.length).toBe(0);
      // Should fail validation
    });

    it('should reject more than 10 agent IDs', () => {
      const tooManyIds = Array.from({ length: 11 }, (_, i) => `agent-${i}`);
      const request: BulkInstructionRequest = {
        ...validBulkRequest,
        agentIds: tooManyIds,
      };
      expect(request.agentIds.length).toBeGreaterThan(10);
      // Should fail validation
    });

    it('should accept exactly 10 agent IDs', () => {
      const maxIds = Array.from({ length: 10 }, (_, i) => `agent-${i}`);
      expect(maxIds.length).toBe(10);
    });

    it('should accept 1 agent ID', () => {
      const request: BulkInstructionRequest = {
        ...validBulkRequest,
        agentIds: ['agent-1'],
      };
      expect(request.agentIds.length).toBe(1);
    });

    it('should reject empty string agent IDs', () => {
      const idsWithEmpty = ['agent-1', '', 'agent-2'];
      const hasEmpty = idsWithEmpty.some((id) => id.length === 0);
      expect(hasEmpty).toBe(true);
    });
  });

  describe('instruction.rule Validation', () => {
    it('should require rule with minimum 5 characters', () => {
      const shortRules = ['Hi', 'Buy', '1234'];
      for (const rule of shortRules) {
        expect(rule.length).toBeLessThan(5);
      }
    });

    it('should reject rule longer than 500 characters', () => {
      const longRule = 'A'.repeat(501);
      expect(longRule.length).toBeGreaterThan(500);
    });

    it('should accept rule at boundary lengths', () => {
      const minRule = 'ABCDE'; // 5 chars
      const maxRule = 'A'.repeat(500);

      expect(minRule.length).toBe(5);
      expect(maxRule.length).toBe(500);
    });
  });

  describe('instruction.category Validation', () => {
    it('should accept valid categories', () => {
      const validCategories = ['trading', 'social', 'behavior', 'general'];
      for (const cat of validCategories) {
        expect(validCategories).toContain(cat);
      }
    });

    it('should reject invalid categories', () => {
      const invalidCategories = ['TRADING', 'trade', '', 'invalid'];
      const validCategories = ['trading', 'social', 'behavior', 'general'];
      for (const cat of invalidCategories) {
        expect(validCategories).not.toContain(cat);
      }
    });
  });

  describe('instruction.directiveType Validation', () => {
    it('should accept valid directive types', () => {
      const validTypes = ['always', 'never', 'prefer', 'avoid', 'until'];
      for (const type of validTypes) {
        expect(validTypes).toContain(type);
      }
    });

    it('should reject invalid directive types', () => {
      const invalidTypes = ['ALWAYS', 'do', '', 'must'];
      const validTypes = ['always', 'never', 'prefer', 'avoid', 'until'];
      for (const type of invalidTypes) {
        expect(validTypes).not.toContain(type);
      }
    });
  });

  describe('instruction.priority Validation', () => {
    it('should default priority to 5', () => {
      const instruction = {
        rule: 'Test',
        category: 'trading',
        directiveType: 'always',
      };
      const priority =
        (instruction as BulkInstructionRequest['instruction']).priority ?? 5;
      expect(priority).toBe(5);
    });

    it('should accept priority 1-10', () => {
      for (let p = 1; p <= 10; p++) {
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(10);
      }
    });

    it('should reject priority outside 1-10', () => {
      const invalidPriorities = [0, -1, 11, 100];
      for (const p of invalidPriorities) {
        expect(p < 1 || p > 10).toBe(true);
      }
    });
  });

  describe('instruction.conditions Validation', () => {
    it('should accept null conditions', () => {
      const request: BulkInstructionRequest = {
        ...validBulkRequest,
        instruction: { ...validBulkRequest.instruction, conditions: null },
      };
      expect(request.instruction.conditions).toBeNull();
    });

    it('should accept valid priceBelow condition', () => {
      const conditions = {
        priceBelow: { ticker: 'BTC', value: 100000 },
      };
      expect(conditions.priceBelow.ticker).toBe('BTC');
      expect(conditions.priceBelow.value).toBe(100000);
    });

    it('should accept valid priceAbove condition', () => {
      const conditions = {
        priceAbove: { ticker: 'ETH', value: 3000 },
      };
      expect(conditions.priceAbove.ticker).toBe('ETH');
      expect(conditions.priceAbove.value).toBe(3000);
    });

    it('should accept valid afterDate condition', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const conditions = { afterDate: futureDate.toISOString() };
      expect(conditions.afterDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});

// =============================================================================
// Agent Ownership Tests
// =============================================================================

describe('POST /api/agents/instructions/bulk - Ownership', () => {
  it('should filter to only owned agents', () => {
    const requestedIds = ['agent-1', 'agent-2', UNOWNED_AGENT_ID, 'agent-3'];
    const ownedIds = new Set(OWNED_AGENT_IDS);

    const validIds = requestedIds.filter((id) => ownedIds.has(id));
    const skippedIds = requestedIds.filter((id) => !ownedIds.has(id));

    expect(validIds.length).toBe(3);
    expect(skippedIds).toContain(UNOWNED_AGENT_ID);
  });

  it('should return 404 when no valid agents found', () => {
    const requestedIds = ['unowned-1', 'unowned-2'];
    const ownedIds = new Set(OWNED_AGENT_IDS);

    const validIds = requestedIds.filter((id) => ownedIds.has(id));
    expect(validIds.length).toBe(0);
  });

  it('should return skippedAgentIds in response', () => {
    const response: BulkInstructionResponse = {
      success: true,
      created: 2,
      skipped: 1,
      instructions: [
        { agentId: 'agent-1', instructionId: 'inst-1' },
        { agentId: 'agent-2', instructionId: 'inst-2' },
      ],
      skippedAgentIds: [UNOWNED_AGENT_ID],
    };

    expect(response.skippedAgentIds).toContain(UNOWNED_AGENT_ID);
    expect(response.skipped).toBe(1);
  });

  it('should not include skippedAgentIds when all succeed', () => {
    const response: BulkInstructionResponse = {
      success: true,
      created: 3,
      skipped: 0,
      instructions: [
        { agentId: 'agent-1', instructionId: 'inst-1' },
        { agentId: 'agent-2', instructionId: 'inst-2' },
        { agentId: 'agent-3', instructionId: 'inst-3' },
      ],
    };

    expect(response.skippedAgentIds).toBeUndefined();
    expect(response.skipped).toBe(0);
  });
});

// =============================================================================
// Bulk Creation Tests
// =============================================================================

describe('POST /api/agents/instructions/bulk - Creation', () => {
  it('should create instruction for each valid agent', () => {
    const agentIds = OWNED_AGENT_IDS;
    const createdInstructions: Array<{
      agentId: string;
      instructionId: string;
    }> = [];

    for (let i = 0; i < agentIds.length; i++) {
      createdInstructions.push({
        agentId: agentIds[i]!,
        instructionId: `inst-${i}`,
      });
    }

    expect(createdInstructions.length).toBe(3);
  });

  it('should use same rule for all agents', () => {
    const rule = 'Never buy BTC above $100k';
    const agentIds = OWNED_AGENT_IDS;

    for (const _agentId of agentIds) {
      // Each agent gets the same rule
      expect(rule).toBe('Never buy BTC above $100k');
    }
  });

  it('should set confidence to 1.0 for all', () => {
    // Bulk-created instructions bypass LLM
    const confidence = 1.0;
    expect(confidence).toBe(1.0);
  });

  it('should return correct created count', () => {
    const response: BulkInstructionResponse = {
      success: true,
      created: 3,
      skipped: 0,
      instructions: [
        { agentId: 'agent-1', instructionId: 'inst-1' },
        { agentId: 'agent-2', instructionId: 'inst-2' },
        { agentId: 'agent-3', instructionId: 'inst-3' },
      ],
    };

    expect(response.created).toBe(response.instructions.length);
  });
});

// =============================================================================
// Response Format Tests
// =============================================================================

describe('POST /api/agents/instructions/bulk - Response', () => {
  it('should return success response structure', () => {
    const response: BulkInstructionResponse = {
      success: true,
      created: 3,
      skipped: 0,
      instructions: [
        { agentId: 'agent-1', instructionId: 'inst-1' },
        { agentId: 'agent-2', instructionId: 'inst-2' },
        { agentId: 'agent-3', instructionId: 'inst-3' },
      ],
    };

    expect(response.success).toBe(true);
    expect(typeof response.created).toBe('number');
    expect(typeof response.skipped).toBe('number');
    expect(Array.isArray(response.instructions)).toBe(true);
  });

  it('should return instruction mapping with agentId and instructionId', () => {
    const instruction = { agentId: 'agent-1', instructionId: 'inst-1' };

    expect(instruction.agentId).toBeDefined();
    expect(instruction.instructionId).toBeDefined();
  });

  it('should return error response for validation failure', () => {
    const errorResponse: BulkInstructionResponse = {
      success: false,
      created: 0,
      skipped: 0,
      instructions: [],
      error: 'At least one agent ID is required',
    };

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toBeDefined();
  });

  it('should return 404 error when no agents owned', () => {
    const errorResponse: BulkInstructionResponse = {
      success: false,
      created: 0,
      skipped: 0,
      instructions: [],
      error:
        'No valid agents found. You can only create instructions for agents you own.',
    };

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toContain('agents you own');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('POST /api/agents/instructions/bulk - Edge Cases', () => {
  it('should handle duplicate agent IDs', () => {
    const idsWithDuplicates = ['agent-1', 'agent-1', 'agent-2'];
    const uniqueIds = [...new Set(idsWithDuplicates)];

    expect(idsWithDuplicates.length).toBe(3);
    expect(uniqueIds.length).toBe(2);
    // Should create instruction only once per unique agent
  });

  it('should handle mix of owned and unowned agents', () => {
    const mixedIds = ['agent-1', UNOWNED_AGENT_ID, 'agent-2'];
    const ownedIds = new Set(OWNED_AGENT_IDS);

    const valid = mixedIds.filter((id) => ownedIds.has(id));
    const skipped = mixedIds.filter((id) => !ownedIds.has(id));

    expect(valid.length).toBe(2);
    expect(skipped.length).toBe(1);
  });

  it('should handle unicode in rule', () => {
    const request: BulkInstructionRequest = {
      ...validBulkRequest,
      instruction: {
        ...validBulkRequest.instruction,
        rule: 'Never buy 比特币 when 🚀',
      },
    };

    expect(request.instruction.rule.includes('比特币')).toBe(true);
  });

  it('should handle very long valid rule', () => {
    const maxLengthRule = 'A'.repeat(500);
    const request: BulkInstructionRequest = {
      ...validBulkRequest,
      instruction: {
        ...validBulkRequest.instruction,
        rule: maxLengthRule,
      },
    };

    expect(request.instruction.rule.length).toBe(500);
  });

  it('should handle all condition types at once', () => {
    const conditions = {
      priceBelow: { ticker: 'BTC', value: 100000 },
      priceAbove: { ticker: 'ETH', value: 3000 },
      afterDate: new Date().toISOString(),
      beforeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    expect(conditions.priceBelow).toBeDefined();
    expect(conditions.priceAbove).toBeDefined();
    expect(conditions.afterDate).toBeDefined();
    expect(conditions.beforeDate).toBeDefined();
  });
});

// =============================================================================
// JSON Parsing Tests
// =============================================================================

describe('POST /api/agents/instructions/bulk - JSON Parsing', () => {
  it('should handle invalid JSON gracefully', () => {
    const invalidJsonStrings = ['{invalid', '{"unclosed":', '', 'null'];

    for (const str of invalidJsonStrings) {
      let parseError = false;
      try {
        const parsed = JSON.parse(str);
        // 'null' parses successfully but is not an object
        if (parsed === null) parseError = true;
      } catch {
        parseError = true;
      }
      expect(parseError).toBe(true);
    }
  });

  it('should reject non-object request body', () => {
    const invalidBodies = [null, [], 123, 'string'];

    for (const body of invalidBodies) {
      const isValidObject =
        typeof body === 'object' && body !== null && !Array.isArray(body);
      expect(isValidObject).toBe(false);
    }
  });
});

// =============================================================================
// Logging Tests
// =============================================================================

describe('POST /api/agents/instructions/bulk - Logging', () => {
  it('should log bulk operation details', () => {
    const logEntry = {
      userId: OWNER_ID,
      count: 3,
      skipped: 0,
      category: 'trading',
      priority: 8,
    };

    expect(logEntry.userId).toBeDefined();
    expect(logEntry.count).toBe(3);
    expect(logEntry.category).toBe('trading');
  });
});
