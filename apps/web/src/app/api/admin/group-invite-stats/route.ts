/**
 * Admin Group Invite Stats API
 *
 * @route GET /api/admin/group-invite-stats - Get group invite statistics
 * @access Admin / Localhost
 *
 * @description
 * Returns real-time statistics about the group invite system including:
 * - Pending candidates in queue
 * - Pending invites awaiting response
 * - Recent invite activity (last 24h)
 * - Current configuration values
 *
 * Use this endpoint to monitor the health of the invite system and debug issues.
 */

import { getClientIp, logAdminView, requireAdmin, withErrorHandling } from '@babylon/api';
import {
  getGroupChatConfigSummary,
  GroupInviteOrchestrator,
  validateGroupChatConfig,
} from '@babylon/engine';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const admin = await requireAdmin(request);

  logAdminView({
    adminId: admin.userId,
    ipAddress: getClientIp(request.headers) ?? undefined,
    resourceType: 'group-invite-stats',
    metadata: { action: 'view_stats' },
  });

  const [stats, configSummary, configValidation] = await Promise.all([
    GroupInviteOrchestrator.getInviteStats(),
    Promise.resolve(getGroupChatConfigSummary()),
    Promise.resolve(validateGroupChatConfig()),
  ]);

  return NextResponse.json({
    stats: {
      pendingCandidates: stats.pendingCandidates,
      pendingInvites: stats.pendingInvites,
      invitesLast24h: stats.invitesLast24h,
      acceptsLast24h: stats.acceptsLast24h,
      acceptRate: stats.invitesLast24h > 0
        ? ((stats.acceptsLast24h / stats.invitesLast24h) * 100).toFixed(1) + '%'
        : 'N/A',
    },
    config: configSummary,
    configValid: configValidation.valid,
    configWarnings: configValidation.warnings,
    timestamp: new Date().toISOString(),
  });
});

