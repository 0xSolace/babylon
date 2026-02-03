/**
 * Agent Instructions API
 *
 * @route GET /api/agents/[agentId]/instructions - List active instructions
 * @route DELETE /api/agents/[agentId]/instructions - Revoke an instruction
 * @access Authenticated (owner only)
 *
 * @description
 * Manage owner-provided instructions for an agent. Instructions are strategic
 * directives that the agent will follow during autonomous ticks.
 *
 * @openapi
 * /api/agents/{agentId}/instructions:
 *   get:
 *     tags:
 *       - Agents
 *     summary: List active instructions
 *     description: Returns all active instructions for the specified agent
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent user ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expired, revoked, completed, all]
 *         description: Filter by status (default: active)
 *     responses:
 *       200:
 *         description: List of instructions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 instructions:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Agent not found
 *       401:
 *         description: Unauthorized
 *   delete:
 *     tags:
 *       - Agents
 *     summary: Revoke an instruction
 *     description: Revokes an active instruction by ID
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instructionId
 *             properties:
 *               instructionId:
 *                 type: string
 *                 description: ID of the instruction to revoke
 *     responses:
 *       200:
 *         description: Instruction revoked
 *       404:
 *         description: Instruction not found or already revoked
 *       401:
 *         description: Unauthorized
 */

import { instructionService } from '@babylon/agents';
import { authenticateUser } from '@babylon/api';
import {
  agentInstructions,
  and,
  db,
  eq,
  type InstructionStatus,
  users,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

/**
 * Verify that the authenticated user owns the specified agent.
 */
async function verifyAgentOwnership(
  userId: string,
  agentId: string
): Promise<boolean> {
  const [agent] = await db
    .select({ managedBy: users.managedBy })
    .from(users)
    .where(eq(users.id, agentId))
    .limit(1);

  return agent?.managedBy === userId;
}

// =============================================================================
// GET - List instructions
// =============================================================================

export async function GET(req: NextRequest, context: RouteContext) {
  const user = await authenticateUser(req);
  const { agentId } = await context.params;

  // Verify ownership
  const isOwner = await verifyAgentOwnership(user.id, agentId);
  if (!isOwner) {
    return NextResponse.json(
      { success: false, error: 'Agent not found or unauthorized' },
      { status: 404 }
    );
  }

  // Get status filter from query params
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') || 'active';

  let instructions;
  if (statusFilter === 'all') {
    // Get all instructions for this agent
    instructions = await db
      .select()
      .from(agentInstructions)
      .where(eq(agentInstructions.agentUserId, agentId))
      .orderBy(agentInstructions.createdAt)
      .limit(50);
  } else if (statusFilter === 'active') {
    // Use the service method which handles expiry
    instructions = await instructionService.getActiveInstructions(agentId);
  } else {
    // Filter by specific status
    instructions = await db
      .select()
      .from(agentInstructions)
      .where(
        and(
          eq(agentInstructions.agentUserId, agentId),
          eq(agentInstructions.status, statusFilter as InstructionStatus)
        )
      )
      .orderBy(agentInstructions.createdAt)
      .limit(50);
  }

  return NextResponse.json({
    success: true,
    instructions: instructions.map((inst) => ({
      id: inst.id,
      content: inst.content,
      parsedRule: inst.parsedRule,
      category: inst.category,
      directiveType: inst.directiveType,
      priority: inst.priority,
      status: inst.status,
      validFrom: inst.validFrom.toISOString(),
      validUntil: inst.validUntil?.toISOString() || null,
      conditions: inst.conditions,
      createdAt: inst.createdAt.toISOString(),
    })),
    count: instructions.length,
  });
}

// =============================================================================
// POST - Create instruction
// =============================================================================

const createInstructionSchema = z.object({
  rule: z.string().min(5, 'Rule must be at least 5 characters').max(500),
  category: z.enum(['trading', 'social', 'behavior', 'general']),
  directiveType: z.enum(['always', 'never', 'prefer', 'avoid', 'until']),
  priority: z.number().int().min(1).max(10).default(5),
  validUntil: z.string().datetime().optional().nullable(),
  conditions: z
    .object({
      priceBelow: z
        .object({ ticker: z.string(), value: z.number() })
        .optional(),
      priceAbove: z
        .object({ ticker: z.string(), value: z.number() })
        .optional(),
      afterDate: z.string().datetime().optional(),
      beforeDate: z.string().datetime().optional(),
    })
    .optional()
    .nullable(),
});

export async function POST(req: NextRequest, context: RouteContext) {
  const user = await authenticateUser(req);
  const { agentId } = await context.params;

  // Verify ownership
  const isOwner = await verifyAgentOwnership(user.id, agentId);
  if (!isOwner) {
    return NextResponse.json(
      { success: false, error: 'Agent not found or unauthorized' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const parseResult = createInstructionSchema.safeParse(body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return NextResponse.json(
      { success: false, error: firstError?.message || 'Invalid request body' },
      { status: 400 }
    );
  }

  const { rule, category, directiveType, priority, validUntil, conditions } =
    parseResult.data;

  // Create instruction directly (bypasses LLM parsing since user provides structure)
  const instruction = await instructionService.createInstruction(
    agentId,
    user.id,
    {
      isInstruction: true,
      confidence: 1.0, // User-created = full confidence
      rule,
      category,
      directiveType,
      priority,
      validUntil: validUntil || undefined,
      conditions: conditions || undefined,
    },
    rule, // Original content = the rule itself
    undefined // No source message ID
  );

  logger.info(
    'Instruction created via API',
    {
      instructionId: instruction.id,
      agentId,
      userId: user.id,
      category,
      directiveType,
      priority,
    },
    'AgentInstructionsAPI'
  );

  return NextResponse.json({
    success: true,
    instruction: {
      id: instruction.id,
      content: instruction.content,
      parsedRule: instruction.parsedRule,
      category: instruction.category,
      directiveType: instruction.directiveType,
      priority: instruction.priority,
      status: instruction.status,
      validFrom: instruction.validFrom.toISOString(),
      validUntil: instruction.validUntil?.toISOString() || null,
      conditions: instruction.conditions,
      createdAt: instruction.createdAt.toISOString(),
    },
  });
}

// =============================================================================
// DELETE - Revoke instruction
// =============================================================================

const revokeSchema = z.object({
  instructionId: z.string().min(1, 'Instruction ID is required'),
});

export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await authenticateUser(req);
  const { agentId } = await context.params;

  // Verify ownership
  const isOwner = await verifyAgentOwnership(user.id, agentId);
  if (!isOwner) {
    return NextResponse.json(
      { success: false, error: 'Agent not found or unauthorized' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const parseResult = revokeSchema.safeParse(body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return NextResponse.json(
      { success: false, error: firstError?.message || 'Invalid request body' },
      { status: 400 }
    );
  }

  const { instructionId } = parseResult.data;

  // Revoke the instruction
  const revoked = await instructionService.revokeInstruction(
    instructionId,
    user.id
  );

  if (!revoked) {
    return NextResponse.json(
      {
        success: false,
        error: 'Instruction not found, already revoked, or unauthorized',
      },
      { status: 404 }
    );
  }

  logger.info(
    'Instruction revoked via API',
    { instructionId, agentId, userId: user.id },
    'AgentInstructionsAPI'
  );

  return NextResponse.json({
    success: true,
    message: 'Instruction revoked',
    instructionId,
  });
}
