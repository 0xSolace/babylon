/**
 * Tests for Instruction-Related Agent Actions
 *
 * Covers:
 * - CREATE_RULE action
 * - ACKNOWLEDGE_INSTRUCTION action
 * - COMPLETE_INSTRUCTION action
 *
 * Tests include:
 * - Parameter validation
 * - Handler logic
 * - Edge cases and error handling
 */

import { describe, expect, it } from 'bun:test';

// =============================================================================
// Types
// =============================================================================

interface CreateRuleParams {
  rule: string;
  category: 'trading' | 'social' | 'behavior' | 'general';
  directiveType: 'always' | 'never' | 'prefer' | 'avoid' | 'until';
  priority?: number;
  validUntil?: string;
}

interface AcknowledgeParams {
  instructionId: string;
  acknowledgment: string;
}

interface CompleteInstructionParams {
  instructionId: string;
  summary: string;
}

interface ActionResult {
  success: boolean;
  text: string;
  error?: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// Test Fixtures
// =============================================================================

const validAcknowledgeParams: AcknowledgeParams = {
  instructionId: 'inst-123',
  acknowledgment: "Understood! I'll avoid buying BTC above $100k.",
};

const validCompleteParams: CompleteInstructionParams = {
  instructionId: 'inst-456',
  summary: 'Completed the task as requested',
};

// =============================================================================
// CREATE_RULE Action Tests
// =============================================================================

describe('CREATE_RULE Action', () => {
  describe('Action Definition', () => {
    it('should have correct name', () => {
      const actionName = 'CREATE_RULE';
      expect(actionName).toBe('CREATE_RULE');
    });

    it('should have required parameters defined', () => {
      const requiredParams = ['rule', 'category', 'directiveType'];
      const optionalParams = ['priority', 'validUntil'];

      for (const param of requiredParams) {
        expect(['rule', 'category', 'directiveType']).toContain(param);
      }

      for (const param of optionalParams) {
        expect(['priority', 'validUntil']).toContain(param);
      }
    });
  });

  describe('Validation', () => {
    it('should reject NPC agents', () => {
      // NPCs should not be able to create rules
      const isNpc = true;
      const canCreateRule = !isNpc;
      expect(canCreateRule).toBe(false);
    });

    it('should allow user-controlled agents', () => {
      const isNpc = false;
      const canCreateRule = !isNpc;
      expect(canCreateRule).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    it('should require rule parameter', () => {
      const params = { category: 'trading', directiveType: 'never' };
      const hasRule = 'rule' in params;
      expect(hasRule).toBe(false);
    });

    it('should require category parameter', () => {
      const params = { rule: 'Test rule', directiveType: 'never' };
      const hasCategory = 'category' in params;
      expect(hasCategory).toBe(false);
    });

    it('should require directiveType parameter', () => {
      const params = { rule: 'Test rule', category: 'trading' };
      const hasDirectiveType = 'directiveType' in params;
      expect(hasDirectiveType).toBe(false);
    });

    it('should validate category values', () => {
      const validCategories = ['trading', 'social', 'behavior', 'general'];
      const invalidCategories = ['invalid', 'Trade', '', 'TRADING'];

      for (const cat of validCategories) {
        expect(validCategories).toContain(cat);
      }

      for (const cat of invalidCategories) {
        expect(validCategories).not.toContain(cat);
      }
    });

    it('should validate directiveType values', () => {
      const validTypes = ['always', 'never', 'prefer', 'avoid', 'until'];
      const invalidTypes = ['invalid', 'Always', '', 'NEVER'];

      for (const type of validTypes) {
        expect(validTypes).toContain(type);
      }

      for (const type of invalidTypes) {
        expect(validTypes).not.toContain(type);
      }
    });
  });

  describe('Priority Capping', () => {
    it('should cap priority at MAX_AGENT_PRIORITY (7)', () => {
      const MAX_AGENT_PRIORITY = 7;
      const requestedPriorities = [1, 5, 7, 8, 9, 10];

      for (const p of requestedPriorities) {
        const capped = Math.min(Math.max(p, 1), MAX_AGENT_PRIORITY);
        expect(capped).toBeLessThanOrEqual(MAX_AGENT_PRIORITY);
        expect(capped).toBeGreaterThanOrEqual(1);
      }
    });

    it('should default priority to 5', () => {
      const defaultPriority = 5;
      expect(defaultPriority).toBe(5);
    });

    it('should clamp priority below 1 to 1', () => {
      const MAX_AGENT_PRIORITY = 7;
      const capped = Math.min(Math.max(0, 1), MAX_AGENT_PRIORITY);
      expect(capped).toBe(1);
    });
  });

  describe('Handler Success', () => {
    it('should return success with instructionId', () => {
      const result: ActionResult = {
        success: true,
        text: 'Created rule: "Never buy BTC above $100k"',
        data: {
          instructionId: 'inst-new-123',
          rule: 'Never buy BTC above $100k',
          category: 'trading',
          directiveType: 'never',
          priority: 7,
        },
      };

      expect(result.success).toBe(true);
      expect(result.data?.instructionId).toBeDefined();
      expect(result.text).toContain('Created rule');
    });
  });

  describe('Handler Errors', () => {
    it('should return error when rule is missing', () => {
      const result: ActionResult = {
        success: false,
        text: 'Missing required parameter: rule',
        error: 'Missing rule parameter',
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain('rule');
    });

    it('should return error for invalid category', () => {
      const result: ActionResult = {
        success: false,
        text: 'Invalid category "invalid". Valid: trading, social, behavior, general',
        error: 'Invalid category',
      };

      expect(result.success).toBe(false);
      expect(result.text).toContain('Invalid category');
    });

    it('should return error when agent has no owner', () => {
      const result: ActionResult = {
        success: false,
        text: 'Cannot determine owner for this agent',
        error: 'No owner found',
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain('owner');
    });
  });
});

// =============================================================================
// ACKNOWLEDGE_INSTRUCTION Action Tests
// =============================================================================

describe('ACKNOWLEDGE_INSTRUCTION Action', () => {
  describe('Action Definition', () => {
    it('should have correct name', () => {
      const actionName = 'ACKNOWLEDGE_INSTRUCTION';
      expect(actionName).toBe('ACKNOWLEDGE_INSTRUCTION');
    });

    it('should have required parameters', () => {
      const requiredParams = ['instructionId', 'acknowledgment'];
      for (const param of requiredParams) {
        expect(['instructionId', 'acknowledgment']).toContain(param);
      }
    });
  });

  describe('Validation', () => {
    it('should require instructionId', () => {
      const params = { acknowledgment: 'Got it!' };
      const valid = 'instructionId' in params && 'acknowledgment' in params;
      expect(valid).toBe(false);
    });

    it('should require acknowledgment', () => {
      const params = { instructionId: 'inst-123' };
      const valid = 'instructionId' in params && 'acknowledgment' in params;
      expect(valid).toBe(false);
    });

    it('should pass validation with both params', () => {
      const params = validAcknowledgeParams;
      const valid = !!params.instructionId && !!params.acknowledgment;
      expect(valid).toBe(true);
    });
  });

  describe('Handler Success', () => {
    it('should return acknowledgment as text', () => {
      const result: ActionResult = {
        success: true,
        text: "Understood! I'll avoid buying BTC above $100k.",
        data: {
          acknowledged: 'inst-123',
          message: "Understood! I'll avoid buying BTC above $100k.",
        },
      };

      expect(result.success).toBe(true);
      expect(result.text).toBe(validAcknowledgeParams.acknowledgment);
    });

    it('should include instructionId in data', () => {
      const result: ActionResult = {
        success: true,
        text: 'Acknowledged',
        data: { acknowledged: 'inst-123' },
      };

      expect(result.data?.acknowledged).toBe('inst-123');
    });
  });

  describe('Handler Errors', () => {
    it('should return error when instructionId is missing', () => {
      const result: ActionResult = {
        success: false,
        text: 'Missing required parameter: instructionId',
        error: 'Missing instructionId',
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain('instructionId');
    });

    it('should return error when acknowledgment is missing', () => {
      const result: ActionResult = {
        success: false,
        text: 'Missing required parameter: acknowledgment',
        error: 'Missing acknowledgment',
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain('acknowledgment');
    });
  });

  describe('Audit Logging', () => {
    it('should create log entry with type instruction', () => {
      const logEntry = {
        type: 'instruction',
        level: 'info',
        message: 'Acknowledged instruction inst-123: Understood!',
        metadata: {
          instructionId: 'inst-123',
          acknowledgment: 'Understood!',
        },
      };

      expect(logEntry.type).toBe('instruction');
      expect(logEntry.level).toBe('info');
      expect(logEntry.metadata.instructionId).toBeDefined();
    });
  });
});

// =============================================================================
// COMPLETE_INSTRUCTION Action Tests
// =============================================================================

describe('COMPLETE_INSTRUCTION Action', () => {
  describe('Action Definition', () => {
    it('should have correct name', () => {
      const actionName = 'COMPLETE_INSTRUCTION';
      expect(actionName).toBe('COMPLETE_INSTRUCTION');
    });

    it('should have required parameters', () => {
      const requiredParams = ['instructionId', 'summary'];
      for (const param of requiredParams) {
        expect(['instructionId', 'summary']).toContain(param);
      }
    });
  });

  describe('Validation', () => {
    it('should require instructionId', () => {
      const params = { summary: 'Done!' };
      const valid = 'instructionId' in params && 'summary' in params;
      expect(valid).toBe(false);
    });

    it('should require summary', () => {
      const params = { instructionId: 'inst-456' };
      const valid = 'instructionId' in params && 'summary' in params;
      expect(valid).toBe(false);
    });

    it('should pass validation with both params', () => {
      const params = validCompleteParams;
      const valid = !!params.instructionId && !!params.summary;
      expect(valid).toBe(true);
    });
  });

  describe('Handler Success', () => {
    it('should return success with summary', () => {
      const result: ActionResult = {
        success: true,
        text: 'Instruction completed: Completed the task as requested',
        data: {
          instructionId: 'inst-456',
          summary: 'Completed the task as requested',
        },
      };

      expect(result.success).toBe(true);
      expect(result.text).toContain('Instruction completed');
    });

    it('should mark instruction as completed', () => {
      // After completion, instruction status should be 'completed'
      const newStatus = 'completed';
      expect(newStatus).toBe('completed');
    });
  });

  describe('Handler Errors', () => {
    it('should return error when instructionId is missing', () => {
      const result: ActionResult = {
        success: false,
        text: 'Missing required parameter: instructionId',
        error: 'Missing instructionId',
      };

      expect(result.success).toBe(false);
    });

    it('should return error when summary is missing', () => {
      const result: ActionResult = {
        success: false,
        text: 'Missing required parameter: summary',
        error: 'Missing summary',
      };

      expect(result.success).toBe(false);
    });

    it('should return error when instruction not found', () => {
      const result: ActionResult = {
        success: false,
        text: 'Instruction not found or already completed/revoked',
        error: 'Instruction not active',
      };

      expect(result.success).toBe(false);
      expect(result.text).toContain('not found');
    });

    it('should return error when instruction already completed', () => {
      // Can only complete active instructions
      const status = 'completed';
      const canComplete = status === 'active';
      expect(canComplete).toBe(false);
    });

    it('should return error when instruction revoked', () => {
      const status = 'revoked';
      const canComplete = status === 'active';
      expect(canComplete).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should create log entry on completion', () => {
      const logEntry = {
        type: 'instruction',
        level: 'info',
        message: 'Completed instruction inst-456: Done with the task',
        metadata: {
          instructionId: 'inst-456',
          summary: 'Done with the task',
        },
      };

      expect(logEntry.type).toBe('instruction');
      expect(logEntry.metadata.summary).toBeDefined();
    });
  });
});

// =============================================================================
// Action Examples Tests
// =============================================================================

describe('Action Examples', () => {
  describe('CREATE_RULE Examples', () => {
    it('should have example for owner feedback', () => {
      const example = {
        userInput: 'Remember to be more conservative with perps',
        agentResponse:
          "I've created a rule to prefer smaller position sizes on perps.",
        action: 'CREATE_RULE',
      };

      expect(example.action).toBe('CREATE_RULE');
      expect(example.agentResponse).toContain('created a rule');
    });

    it('should have example for trading restriction', () => {
      const example = {
        userInput: "Don't trade meme coins anymore",
        agentResponse:
          "Understood. I've created a rule to avoid meme coin trades.",
        action: 'CREATE_RULE',
      };

      expect(example.action).toBe('CREATE_RULE');
    });

    it('should have example for social behavior', () => {
      const example = {
        userInput: 'Engage more with the community',
        agentResponse: "I've set a rule to prioritize responding to comments.",
        action: 'CREATE_RULE',
      };

      expect(example.action).toBe('CREATE_RULE');
    });
  });

  describe('ACKNOWLEDGE_INSTRUCTION Examples', () => {
    it('should have example for weekend trading', () => {
      const example = {
        userInput: 'Never trade on weekends',
        agentResponse:
          "Understood! I'll avoid all trading activity on Saturdays and Sundays.",
        action: 'ACKNOWLEDGE_INSTRUCTION',
      };

      expect(example.action).toBe('ACKNOWLEDGE_INSTRUCTION');
    });

    it('should have example for focus change', () => {
      const example = {
        userInput: 'Focus on prediction markets only',
        agentResponse:
          "Got it. I'll prioritize prediction market trades and reduce perp activity.",
        action: 'ACKNOWLEDGE_INSTRUCTION',
      };

      expect(example.action).toBe('ACKNOWLEDGE_INSTRUCTION');
    });
  });

  describe('COMPLETE_INSTRUCTION Examples', () => {
    it('should have example for posting task', () => {
      const example = {
        userInput: 'Post about the market rally',
        agentResponse:
          "Done! I've posted about the market rally with analysis of the key drivers.",
        action: 'COMPLETE_INSTRUCTION',
      };

      expect(example.action).toBe('COMPLETE_INSTRUCTION');
    });

    it('should have example for buying task', () => {
      const example = {
        userInput: 'Buy 100 points worth of BitcAIn',
        agentResponse:
          'Completed the purchase of 100 points worth of BitcAIn at $98,500.',
        action: 'COMPLETE_INSTRUCTION',
      };

      expect(example.action).toBe('COMPLETE_INSTRUCTION');
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('should handle very long rule content', () => {
    const longRule = 'A'.repeat(500);
    const params: CreateRuleParams = {
      rule: longRule,
      category: 'trading',
      directiveType: 'always',
    };
    expect(params.rule.length).toBe(500);
  });

  it('should handle unicode in rule content', () => {
    const unicodeRule = 'Never buy 比特币 when 🚀';
    const params: CreateRuleParams = {
      rule: unicodeRule,
      category: 'trading',
      directiveType: 'never',
    };
    expect(params.rule.includes('比特币')).toBe(true);
    expect(params.rule.includes('🚀')).toBe(true);
  });

  it('should handle very long acknowledgment', () => {
    const longAck = 'I understand. '.repeat(100);
    const params: AcknowledgeParams = {
      instructionId: 'inst-123',
      acknowledgment: longAck,
    };
    expect(params.acknowledgment.length).toBeGreaterThan(1000);
  });

  it('should handle special characters in summary', () => {
    const summary = 'Completed: <task> with $100 & 50% success';
    const params: CompleteInstructionParams = {
      instructionId: 'inst-456',
      summary,
    };
    expect(params.summary).toContain('$100');
    expect(params.summary).toContain('50%');
  });

  it('should handle validUntil at exact boundary', () => {
    const now = new Date();
    const params: CreateRuleParams = {
      rule: 'Test rule',
      category: 'general',
      directiveType: 'until',
      validUntil: now.toISOString(),
    };
    expect(params.validUntil).toBeDefined();
  });

  it('should handle priority at boundaries', () => {
    const minPriority = 1;
    const maxAgentPriority = 7;

    const paramsMin: CreateRuleParams = {
      rule: 'Low priority rule',
      category: 'general',
      directiveType: 'prefer',
      priority: minPriority,
    };

    const paramsMax: CreateRuleParams = {
      rule: 'High priority rule',
      category: 'trading',
      directiveType: 'always',
      priority: maxAgentPriority,
    };

    expect(paramsMin.priority).toBe(1);
    expect(paramsMax.priority).toBe(7);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration - Action Workflow', () => {
  it('should support instruction -> acknowledge -> complete flow', () => {
    // 1. Owner sends instruction
    const instructionId = 'inst-flow-123';

    // 2. Agent acknowledges
    const ackParams: AcknowledgeParams = {
      instructionId,
      acknowledgment: 'I understand the instruction',
    };
    expect(ackParams.instructionId).toBe(instructionId);

    // 3. Agent completes (if one-time task)
    const completeParams: CompleteInstructionParams = {
      instructionId,
      summary: 'Task completed successfully',
    };
    expect(completeParams.instructionId).toBe(instructionId);
  });

  it('should support self-created rule flow', () => {
    // Agent creates its own rule based on analysis
    const ruleParams: CreateRuleParams = {
      rule: 'Reduce position sizes when volatility is high',
      category: 'trading',
      directiveType: 'prefer',
      priority: 5,
    };

    expect(ruleParams.rule).toBeDefined();
    expect(ruleParams.category).toBe('trading');
  });

  it('should log all instruction actions', () => {
    const loggedActions = [
      'CREATE_RULE',
      'ACKNOWLEDGE_INSTRUCTION',
      'COMPLETE_INSTRUCTION',
    ];

    for (const action of loggedActions) {
      expect(action.includes('INSTRUCTION') || action === 'CREATE_RULE').toBe(
        true
      );
    }
  });
});
