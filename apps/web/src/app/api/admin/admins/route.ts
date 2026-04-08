/**
 * Admin Management API
 *
 * @route GET /api/admin/admins - Get admin users
 * @access Admin
 *
 * @description
 * Returns list of all admin users with their details. Excludes NPCs/actors.
 * Admin only endpoint.
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api';
import { selectAdminHumanUsersForAdminList } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  logger.info('Admin list requested', {}, 'GET /api/admin/admins');

  // Get all admin users
  const admins = await asSystem(
    (tx) => selectAdminHumanUsersForAdminList(tx),
    'admin-admins-list'
  );

  logger.info(`Found ${admins.length} admins`, {}, 'GET /api/admin/admins');

  return successResponse({
    admins,
    total: admins.length,
  });
});
