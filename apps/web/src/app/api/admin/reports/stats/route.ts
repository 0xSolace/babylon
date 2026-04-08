/**
 * Admin Reports Statistics API
 *
 * @route GET /api/admin/reports/stats - Get report statistics
 * @access Admin
 *
 * @description
 * Returns comprehensive statistics about user reports including counts by
 * status, type breakdown, and recent activity. Admin only.
 *
 * @openapi
 * /api/admin/reports/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get report statistics
 *     description: Returns comprehensive report statistics (admin only)
 *     security:
 *       - PrivyAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalReports:
 *                   type: integer
 *                 pendingReports:
 *                   type: integer
 *                 resolvedReports:
 *                   type: integer
 *                 reportsByType:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * @example
 * ```typescript
 * const stats = await fetch('/api/admin/reports/stats', {
 *   headers: { 'Authorization': `Bearer ${adminToken}` }
 * }).then(r => r.json());
 * ```
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api';
import { fetchAdminReportsStatsPayload } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  logger.info(
    'Admin reports stats requested',
    {},
    'GET /api/admin/reports/stats'
  );

  return await asSystem(
    async (tx) => successResponse(await fetchAdminReportsStatsPayload(tx)),
    'admin-reports-stats'
  );
});
