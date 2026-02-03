/**
 * Bulk Instructions API
 *
 * @route POST /api/agents/instructions/bulk - Create instructions for multiple agents
 * @access Authenticated (owner only)
 *
 * @description
 * Create the same instruction for multiple agents at once.
 * Each agent receives an independent copy of the instruction.
 */

import { instructionService } from '@babylon/agents';
import { authenticateUser } from '@babylon/api';
import { db, eq, users } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// =============================================================================
// Schemas
// =============================================================================

const bulkCreateSchema = z.object({
  agentIds: z
    .array(z.string().min(1))
    .min(1, 'At least one agent ID is required')
    .max(10, 'Maximum 10 agents per bulk request'),
  instruction: z.object({
    rule: z.string().min(5).max(500),
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
  }),
});

// =============================================================================
// POST - Bulk create instructions
// =============================================================================

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const parseResult = bulkCreateSchema.safeParse(body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return NextResponse.json(
      { success: false, error: firstError?.message || 'Invalid request body' },
      { status: 400 }
    );
  }

  const { agentIds, instruction } = parseResult.data;

  // Verify ownership of all agents
  const agents = await db
    .select({ id: users.id, managedBy: users.managedBy })
    .from(users)
    .where(eq(users.managedBy, user.id));

  const ownedAgentIds = new Set(agents.map((a) => a.id));

  // Filter to only agents the user owns
  const validAgentIds = agentIds.filter((id) => ownedAgentIds.has(id));

  if (validAgentIds.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'No valid agents found. You can only create instructions for agents you own.',
      },
      { status: 404 }
    );
  }

  const skippedAgentIds = agentIds.filter((id) => !ownedAgentIds.has(id));

  // Create instructions for each valid agent
  const createdInstructions: { agentId: string; instructionId: string }[] = [];

  for (const agentId of validAgentIds) {
    const created = await instructionService.createInstruction(
      agentId,
      user.id,
      {
        isInstruction: true,
        confidence: 1.0,
        rule: instruction.rule,
        category: instruction.category,
        directiveType: instruction.directiveType,
        priority: instruction.priority,
        validUntil: instruction.validUntil || undefined,
        conditions: instruction.conditions || undefined,
      },
      instruction.rule,
      undefined
    );

    createdInstructions.push({
      agentId,
      instructionId: created.id,
    });
  }

  logger.info(
    'Bulk instructions created',
    {
      userId: user.id,
      count: createdInstructions.length,
      skipped: skippedAgentIds.length,
      category: instruction.category,
      priority: instruction.priority,
    },
    'BulkInstructionsAPI'
  );

  return NextResponse.json({
    success: true,
    created: createdInstructions.length,
    skipped: skippedAgentIds.length,
    instructions: createdInstructions,
    skippedAgentIds: skippedAgentIds.length > 0 ? skippedAgentIds : undefined,
  });
}

