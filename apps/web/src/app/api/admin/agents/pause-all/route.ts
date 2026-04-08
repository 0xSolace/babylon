/**
 * Admin Agents Pause All API
 *
 * @route POST /api/admin/agents/pause-all - Pause all agents
 * @access Admin
 *
 * @description
 * Emergency endpoint to pause ALL autonomous agents immediately. Disables
 * all autonomous behaviors (trading, posting, commenting, DMs, group chats).
 * Admin only.
 *
 * @openapi
 * /api/admin/agents/pause-all:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Pause all agents
 *     description: Emergency pause for all autonomous agents (admin only)
 *     security:
 *       - PrivyAuth: []
 *     responses:
 *       200:
 *         description: All agents paused successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                   description: Number of agents paused
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * @example
 * ```typescript
 * await fetch('/api/admin/agents/pause-all', {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${adminToken}` }
 * });
 * ```
 */

import {
  getClientIp,
  logAdminModify,
  requireAdmin,
  withErrorHandling,
} from '@babylon/api';

import { pauseAllUserAgentConfigsEmergency } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const POST = withErrorHandling(async (req: NextRequest) => {
  const admin = await requireAdmin(req);

  // Audit log the emergency action
  logAdminModify({
    adminId: admin.userId,
    ipAddress: getClientIp(req.headers) ?? undefined,
    resourceType: 'agents',
    metadata: { action: 'emergency_pause_all' },
  });

  await asSystem(
    (tx) => pauseAllUserAgentConfigsEmergency(tx),
    'admin-agents-pause-all'
  );

  logger.warn(
    `EMERGENCY: Paused all autonomous agents`,
    undefined,
    'AdminAgentsAPI'
  );

  return NextResponse.json({
    success: true,
    message: 'Paused all agents',
    data: {
      paused: 'all',
    },
  });
});
