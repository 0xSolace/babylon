/**
 * Admin NPC Instructions API
 *
 * @route GET /api/admin/npc/[actorId]/instructions - List NPC instructions
 * @route POST /api/admin/npc/[actorId]/instructions - Create NPC instruction
 * @route DELETE /api/admin/npc/[actorId]/instructions - Revoke NPC instruction
 * @access Admin
 *
 * @description
 * Manage instructions for NPCs (system-defined actors). NPCs receive instructions
 * from admins rather than human owners.
 */

import { instructionService } from '@babylon/agents';
import { requireAdmin, withErrorHandling } from '@babylon/api';
import {
  agentInstructions,
  and,
  db,
  eq,
  type InstructionStatus,
  users,
} from '@babylon/db';
import { StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ actorId: string }>;
};

/**
 * Verify that the actor ID is a valid NPC in the static registry
 * and exists in the users table (bootstrapped)
 */
async function verifyNpcActor(actorId: string): Promise<boolean> {
  // Check if it's a valid NPC in static registry
  const actor = StaticDataRegistry.getActor(actorId);
  if (!actor) {
    return false;
  }

  // Check if NPC has been bootstrapped (exists in users table)
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  return !!user;
}

// =============================================================================
// GET - List NPC instructions
// =============================================================================

async function handleGet(req: NextRequest, context: RouteContext) {
  await requireAdmin(req);
  const { actorId } = await context.params;

  const isValidNpc = await verifyNpcActor(actorId);
  if (!isValidNpc) {
    return NextResponse.json(
      { success: false, error: 'NPC not found' },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') || 'active';

  let instructions;
  if (statusFilter === 'all') {
    instructions = await db
      .select()
      .from(agentInstructions)
      .where(eq(agentInstructions.agentUserId, actorId))
      .orderBy(agentInstructions.createdAt)
      .limit(50);
  } else if (statusFilter === 'active') {
    instructions = await instructionService.getActiveInstructions(actorId);
  } else {
    instructions = await db
      .select()
      .from(agentInstructions)
      .where(
        and(
          eq(agentInstructions.agentUserId, actorId),
          eq(agentInstructions.status, statusFilter as InstructionStatus)
        )
      )
      .orderBy(agentInstructions.createdAt)
      .limit(50);
  }

  // Get NPC actor info
  const actor = StaticDataRegistry.getActor(actorId);

  return NextResponse.json({
    success: true,
    actorId,
    actorName: actor?.name || actorId,
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
      createdBy: inst.ownerId,
    })),
    count: instructions.length,
  });
}

// =============================================================================
// POST - Create NPC instruction
// =============================================================================

const createSchema = z.object({
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
});

async function handlePost(req: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(req);
  const { actorId } = await context.params;

  const isValidNpc = await verifyNpcActor(actorId);
  if (!isValidNpc) {
    return NextResponse.json(
      { success: false, error: 'NPC not found' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parseResult = createSchema.safeParse(body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return NextResponse.json(
      { success: false, error: firstError?.message || 'Invalid request' },
      { status: 400 }
    );
  }

  const { rule, category, directiveType, priority, validUntil, conditions } =
    parseResult.data;

  // Use admin's database user ID as the owner
  const adminUserId = admin.dbUserId || admin.userId;
  const instruction = await instructionService.createInstruction(
    actorId,
    adminUserId,
    {
      isInstruction: true,
      confidence: 1.0,
      rule,
      category,
      directiveType,
      priority,
      validUntil: validUntil || undefined,
      conditions: conditions || undefined,
    },
    `Admin instruction: ${rule}`,
    undefined
  );

  logger.info(
    'NPC instruction created by admin',
    {
      instructionId: instruction.id,
      actorId,
      adminId: adminUserId,
      category,
      priority,
    },
    'AdminNpcInstructionsAPI'
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
// DELETE - Revoke NPC instruction
// =============================================================================

const revokeSchema = z.object({
  instructionId: z.string().min(1),
});

async function handleDelete(req: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(req);
  const { actorId } = await context.params;

  const isValidNpc = await verifyNpcActor(actorId);
  if (!isValidNpc) {
    return NextResponse.json(
      { success: false, error: 'NPC not found' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parseResult = revokeSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: 'instructionId is required' },
      { status: 400 }
    );
  }

  const { instructionId } = parseResult.data;

  // Revoke the instruction (admin can revoke any instruction for this NPC)
  const adminUserId = admin.dbUserId || admin.userId;
  const revoked = await instructionService.revokeInstruction(
    instructionId,
    adminUserId
  );

  if (!revoked) {
    return NextResponse.json(
      { success: false, error: 'Instruction not found or already revoked' },
      { status: 404 }
    );
  }

  logger.info(
    'NPC instruction revoked by admin',
    { instructionId, actorId, adminId: adminUserId },
    'AdminNpcInstructionsAPI'
  );

  return NextResponse.json({
    success: true,
    message: 'Instruction revoked',
    instructionId,
  });
}

// =============================================================================
// Exports
// =============================================================================

export const GET = withErrorHandling(handleGet);
export const POST = withErrorHandling(handlePost);
export const DELETE = withErrorHandling(handleDelete);
