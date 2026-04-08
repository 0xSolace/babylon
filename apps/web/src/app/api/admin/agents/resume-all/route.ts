/**
 * Admin Agents Resume All API
 *
 * @route POST /api/admin/agents/resume-all - Resume all agents
 * @access Admin
 *
 * @description
 * Resumes all autonomous agents that have sufficient balance. Re-enables all
 * autonomous behaviors (trading, posting, commenting, DMs, group chats).
 * Admin only.
 */

import {
  getClientIp,
  logAdminModify,
  requireAdmin,
  withErrorHandling,
} from '@babylon/api';
import { resumeAutonomousAgentsWithVirtualBalanceGteOne } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const POST = withErrorHandling(async (req: NextRequest) => {
  const admin = await requireAdmin(req);

  // Audit log the admin action
  logAdminModify({
    adminId: admin.userId,
    ipAddress: getClientIp(req.headers) ?? undefined,
    resourceType: 'agents',
    metadata: { action: 'resume_all' },
  });

  const eligibleUserIds = await asSystem(
    (tx) => resumeAutonomousAgentsWithVirtualBalanceGteOne(tx),
    'admin-agents-resume-all'
  );

  if (eligibleUserIds.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No agents with sufficient balance found',
      data: { resumed: 0 },
    });
  }

  logger.info(
    `Resumed ${eligibleUserIds.length} autonomous agents with balance >= 1`,
    undefined,
    'AdminAgentsAPI'
  );

  return NextResponse.json({
    success: true,
    message: `Resumed ${eligibleUserIds.length} agents with sufficient balance`,
    data: {
      resumed: eligibleUserIds.length,
    },
  });
});
