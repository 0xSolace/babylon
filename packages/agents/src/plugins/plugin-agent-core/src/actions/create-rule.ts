/**
 * Create Rule Action
 *
 * Allows an agent to create a new rule for itself based on owner feedback
 * or its own analysis. Only available for user-controlled agents (not NPCs).
 */

import {
  db,
  eq,
  type InstructionCategory,
  type InstructionDirectiveType,
  users,
} from '@babylon/db';
import type {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import { StaticDataRegistry } from '@babylon/engine';
import { instructionService } from '../../../../services/InstructionService';
import { logger } from '../../../../shared/logger';

// =============================================================================
// Types
// =============================================================================

interface CreateRuleParams {
  rule: string;
  category: InstructionCategory;
  directiveType: InstructionDirectiveType;
  priority?: number;
  validUntil?: string;
}

// =============================================================================
// Constants
// =============================================================================

const VALID_CATEGORIES: InstructionCategory[] = [
  'trading',
  'social',
  'behavior',
  'general',
];

const VALID_DIRECTIVE_TYPES: InstructionDirectiveType[] = [
  'always',
  'never',
  'prefer',
  'avoid',
  'until',
];

/** Maximum priority agent can self-assign (owner rules can be higher) */
const MAX_AGENT_PRIORITY = 7;

// =============================================================================
// Action
// =============================================================================

export const createRuleAction: Action = {
  name: 'CREATE_RULE',
  description:
    'Create a new rule for yourself based on owner feedback or your own analysis. ' +
    'Use this when you want to remember something important for future decisions. ' +
    'The rule will be added to your active instructions and followed in subsequent ticks.',

  parameters: {
    rule: {
      type: 'string',
      description:
        'The rule in imperative form (e.g., "Never buy BitcAIn above $100k", "Prefer smaller position sizes")',
      required: true,
    },
    category: {
      type: 'string',
      description:
        'Category: "trading" (market decisions), "social" (posts/comments), "behavior" (general conduct), or "general"',
      required: true,
    },
    directiveType: {
      type: 'string',
      description:
        'Type: "always" (must do), "never" (must not do), "prefer" (prioritize), "avoid" (deprioritize), or "until" (time-bound)',
      required: true,
    },
    priority: {
      type: 'number',
      description: 'Priority 1-7 (7 = highest for self-created rules)',
      required: false,
    },
    validUntil: {
      type: 'string',
      description: 'ISO date string for when the rule expires (optional)',
      required: false,
    },
  },

  examples: [
    [
      {
        name: 'User',
        content: { text: 'Remember to be more conservative with perps' },
      },
      {
        name: 'Agent',
        content: {
          text: "I've created a rule to prefer smaller position sizes on perps.",
          action: 'CREATE_RULE',
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: "Don't trade meme coins anymore" },
      },
      {
        name: 'Agent',
        content: {
          text: "Understood. I've created a rule to avoid meme coin trades.",
          action: 'CREATE_RULE',
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Engage more with the community' },
      },
      {
        name: 'Agent',
        content: {
          text: "I've set a rule to prioritize responding to comments and engaging with posts.",
          action: 'CREATE_RULE',
        },
      },
    ],
  ],

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<boolean> => {
    // Only user-controlled agents can create rules (NPCs cannot)
    const isNpc = !!StaticDataRegistry.getActor(runtime.agentId);
    return !isNpc;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    _callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const agentUserId = runtime.agentId;

    // Get parameters from state
    const params = state?.data?.actionParams as CreateRuleParams | undefined;

    if (!params?.rule) {
      return {
        success: false,
        text: 'Missing required parameter: rule',
        error: 'Missing rule parameter',
      };
    }

    if (!params.category || !VALID_CATEGORIES.includes(params.category)) {
      return {
        success: false,
        text: `Invalid category "${params.category}". Valid: ${VALID_CATEGORIES.join(', ')}`,
        error: 'Invalid category',
      };
    }

    if (
      !params.directiveType ||
      !VALID_DIRECTIVE_TYPES.includes(params.directiveType)
    ) {
      return {
        success: false,
        text: `Invalid directiveType "${params.directiveType}". Valid: ${VALID_DIRECTIVE_TYPES.join(', ')}`,
        error: 'Invalid directiveType',
      };
    }

    // Cap priority for agent-created rules
    const priority = Math.min(
      Math.max(params.priority || 5, 1),
      MAX_AGENT_PRIORITY
    );

    // Get owner ID from agent's managedBy field
    const [agent] = await db
      .select({ managedBy: users.managedBy })
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1);

    if (!agent?.managedBy) {
      return {
        success: false,
        text: 'Cannot determine owner for this agent',
        error: 'No owner found',
      };
    }

    // Create the instruction
    const instruction = await instructionService.createInstruction(
      agentUserId,
      agent.managedBy,
      {
        isInstruction: true,
        confidence: 0.9, // Agent-created = high but not perfect confidence
        rule: params.rule,
        category: params.category,
        directiveType: params.directiveType,
        priority,
        validUntil: params.validUntil,
      },
      `Agent self-created rule: ${params.rule}`,
      undefined
    );

    logger.info(
      `[CREATE_RULE] Agent ${agentUserId} created rule: "${params.rule}"`,
      { instructionId: instruction.id, category: params.category, priority },
      'CreateRule'
    );

    return {
      success: true,
      text: `Created rule: "${params.rule}"`,
      data: {
        instructionId: instruction.id,
        rule: params.rule,
        category: params.category,
        directiveType: params.directiveType,
        priority,
      },
    };
  },
};

