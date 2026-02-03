/**
 * Acknowledge Instruction Action
 *
 * Allows an agent to acknowledge that it has understood an instruction
 * from its owner. This creates an audit trail and confirms receipt.
 */

import { agentLogs, db, generateSnowflakeId } from '@babylon/db';
import type {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import { logger } from '../../../../shared/logger';

// =============================================================================
// Types
// =============================================================================

interface AcknowledgeParams {
  instructionId: string;
  acknowledgment: string;
}

// =============================================================================
// Action
// =============================================================================

export const acknowledgeInstructionAction: Action = {
  name: 'ACKNOWLEDGE_INSTRUCTION',
  description:
    'Acknowledge that you understand and will follow an instruction from your owner. ' +
    'Use this to confirm you received and understood a command. ' +
    'This creates an audit log entry.',

  parameters: {
    instructionId: {
      type: 'string',
      description: 'The ID of the instruction to acknowledge',
      required: true,
    },
    acknowledgment: {
      type: 'string',
      description:
        'Your acknowledgment message explaining how you understood the instruction',
      required: true,
    },
  },

  examples: [
    [
      {
        name: 'User',
        content: { text: 'Never trade on weekends' },
      },
      {
        name: 'Agent',
        content: {
          text: "Understood! I'll avoid all trading activity on Saturdays and Sundays.",
          action: 'ACKNOWLEDGE_INSTRUCTION',
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Focus on prediction markets only' },
      },
      {
        name: 'Agent',
        content: {
          text: "Got it. I'll prioritize prediction market trades and reduce perp activity.",
          action: 'ACKNOWLEDGE_INSTRUCTION',
        },
      },
    ],
  ],

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    state?: State
  ): Promise<boolean> => {
    const params = state?.data?.actionParams as AcknowledgeParams | undefined;
    return !!params?.instructionId && !!params?.acknowledgment;
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
    const params = state?.data?.actionParams as AcknowledgeParams | undefined;

    if (!params?.instructionId) {
      return {
        success: false,
        text: 'Missing required parameter: instructionId',
        error: 'Missing instructionId',
      };
    }

    if (!params.acknowledgment) {
      return {
        success: false,
        text: 'Missing required parameter: acknowledgment',
        error: 'Missing acknowledgment',
      };
    }

    // Log acknowledgment for audit trail
    await db.insert(agentLogs).values({
      id: await generateSnowflakeId(),
      agentUserId,
      type: 'instruction',
      level: 'info',
      message: `Acknowledged instruction ${params.instructionId}: ${params.acknowledgment}`,
      metadata: {
        instructionId: params.instructionId,
        acknowledgment: params.acknowledgment,
      },
    });

    logger.info(
      `[ACKNOWLEDGE_INSTRUCTION] Agent ${agentUserId} acknowledged instruction ${params.instructionId}`,
      { acknowledgment: params.acknowledgment },
      'AcknowledgeInstruction'
    );

    return {
      success: true,
      text: params.acknowledgment,
      data: {
        acknowledged: params.instructionId,
        message: params.acknowledgment,
      },
    };
  },
};
