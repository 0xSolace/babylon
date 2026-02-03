/**
 * Complete Instruction Action
 *
 * Allows an agent to mark an instruction as completed.
 * Use when you have fulfilled a one-time task.
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
import { instructionService } from '../../../../services/InstructionService';
import { logger } from '../../../../shared/logger';

// =============================================================================
// Types
// =============================================================================

interface CompleteInstructionParams {
  instructionId: string;
  summary: string;
}

// =============================================================================
// Action
// =============================================================================

export const completeInstructionAction: Action = {
  name: 'COMPLETE_INSTRUCTION',
  description:
    'Mark an instruction as completed. Use when you have fulfilled a one-time task. ' +
    'This removes the instruction from your active list.',

  parameters: {
    instructionId: {
      type: 'string',
      description: 'The ID of the instruction to mark as complete',
      required: true,
    },
    summary: {
      type: 'string',
      description: 'Brief summary of what you did to complete the instruction',
      required: true,
    },
  },

  examples: [
    [
      {
        name: 'User',
        content: { text: 'Post about the market rally' },
      },
      {
        name: 'Agent',
        content: {
          text: "Done! I've posted about the market rally with analysis of the key drivers.",
          action: 'COMPLETE_INSTRUCTION',
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Buy 100 points worth of BitcAIn' },
      },
      {
        name: 'Agent',
        content: {
          text: 'Completed the purchase of 100 points worth of BitcAIn at $98,500.',
          action: 'COMPLETE_INSTRUCTION',
        },
      },
    ],
  ],

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    state?: State
  ): Promise<boolean> => {
    const params = state?.data?.actionParams as
      | CompleteInstructionParams
      | undefined;
    return !!params?.instructionId && !!params?.summary;
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
    const params = state?.data?.actionParams as
      | CompleteInstructionParams
      | undefined;

    if (!params?.instructionId) {
      return {
        success: false,
        text: 'Missing required parameter: instructionId',
        error: 'Missing instructionId',
      };
    }

    if (!params.summary) {
      return {
        success: false,
        text: 'Missing required parameter: summary',
        error: 'Missing summary',
      };
    }

    // Mark instruction as complete
    const success = await instructionService.completeInstruction(
      params.instructionId
    );

    if (!success) {
      return {
        success: false,
        text: 'Instruction not found or already completed/revoked',
        error: 'Instruction not active',
      };
    }

    // Log completion
    await db.insert(agentLogs).values({
      id: await generateSnowflakeId(),
      agentUserId,
      type: 'instruction',
      level: 'info',
      message: `Completed instruction ${params.instructionId}: ${params.summary}`,
      metadata: {
        instructionId: params.instructionId,
        summary: params.summary,
      },
    });

    logger.info(
      `[COMPLETE_INSTRUCTION] Agent ${agentUserId} completed instruction ${params.instructionId}`,
      { summary: params.summary },
      'CompleteInstruction'
    );

    return {
      success: true,
      text: `Instruction completed: ${params.summary}`,
      data: {
        instructionId: params.instructionId,
        summary: params.summary,
      },
    };
  },
};
