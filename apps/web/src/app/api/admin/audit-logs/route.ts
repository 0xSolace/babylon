/**
 * Admin Audit Logs API
 *
 * @route GET /api/admin/audit-logs - Get admin audit logs
 * @access Admin
 *
 * @description
 * Returns admin audit logs for reviewing admin actions.
 * Supports both offset-based and cursor-based pagination.
 * Cursor-based pagination is recommended for large datasets.
 *
 * @openapi
 * /api/admin/audit-logs:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get admin audit logs
 *     description: Returns admin audit logs with pagination (admin only). Supports both offset-based and cursor-based pagination.
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - name: offset
 *         in: query
 *         description: Offset for offset-based pagination (max 1000). Use cursor for large datasets.
 *         schema:
 *           type: integer
 *           default: 0
 *           maximum: 1000
 *       - name: cursor
 *         in: query
 *         description: ISO timestamp cursor for cursor-based pagination. Use nextCursor from previous response.
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: adminId
 *         in: query
 *         schema:
 *           type: string
 *       - name: action
 *         in: query
 *         schema:
 *           type: string
 *       - name: resourceType
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */

import {
  errorResponse,
  requireAdmin,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  fetchAdminAuditLogsPageBundle,
  selectAdminAuditLogDistinctActions,
  selectAdminAuditLogDistinctResourceTypes,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// Audit log filters schema
// Action and resourceType accept any string value from the database
// to avoid validation mismatches when new resource types are logged
const AuditLogFiltersSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  // Offset-based pagination (legacy, max 1000 to prevent performance issues)
  offset: z.coerce.number().min(0).max(1000).default(0),
  // Cursor-based pagination (recommended for large datasets)
  // Cursor is the ISO timestamp of the last item from previous page
  cursor: z.string().datetime().optional(),
  adminId: z.string().min(1).optional(),
  // Accept any action string to match database values dynamically
  action: z.string().min(1).max(64).optional(),
  // Accept any resource type string to match database values dynamically
  resourceType: z.string().min(1).max(64).optional(),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);

  // Validate query parameters with Zod
  const parseResult = AuditLogFiltersSchema.safeParse({
    limit: searchParams.get('limit') || undefined,
    offset: searchParams.get('offset') || undefined,
    cursor: searchParams.get('cursor') || undefined,
    adminId: searchParams.get('adminId') || undefined,
    action: searchParams.get('action') || undefined,
    resourceType: searchParams.get('resourceType') || undefined,
  });

  if (!parseResult.success) {
    return errorResponse('Invalid query parameters', 'VALIDATION_ERROR', 400, {
      details: parseResult.error.flatten(),
    });
  }

  const {
    limit,
    offset,
    cursor,
    adminId: filterAdminId,
    action: filterAction,
    resourceType: filterResourceType,
  } = parseResult.data;

  // Determine pagination mode (cursor-based preferred for performance)
  const useCursorPagination = !!cursor;

  logger.info(
    'Admin audit logs requested',
    {
      limit,
      offset: useCursorPagination ? undefined : offset,
      cursor: useCursorPagination ? cursor : undefined,
      filterAdminId,
      filterAction,
      filterResourceType,
      paginationMode: useCursorPagination ? 'cursor' : 'offset',
    },
    'GET /api/admin/audit-logs'
  );

  const { total, logs } = await asSystem(
    (tx) =>
      fetchAdminAuditLogsPageBundle(tx, {
        limit,
        offset,
        useCursorPagination,
        cursor,
        filterAdminId,
        filterAction,
        filterResourceType,
      }),
    'admin-audit-logs'
  );

  // Determine if there are more results
  const hasMore = logs.length > limit;
  const resultLogs = hasMore ? logs.slice(0, limit) : logs;

  // Generate next cursor from the last item
  const lastLog = resultLogs[resultLogs.length - 1];
  const nextCursor = hasMore && lastLog ? toISO(lastLog.createdAt) : null;

  const [actionTypes, resourceTypes] = await asSystem(
    (tx) =>
      Promise.all([
        selectAdminAuditLogDistinctActions(tx),
        selectAdminAuditLogDistinctResourceTypes(tx),
      ]),
    'admin-audit-filters'
  );

  return successResponse({
    logs: resultLogs.map((log) => ({
      ...log,
      createdAt: toISO(log.createdAt),
      admin: {
        id: log.adminId,
        username: log.adminUsername,
        displayName: log.adminDisplayName,
        profileImageUrl: log.adminProfileImageUrl,
      },
    })),
    pagination: {
      limit,
      // Offset-based pagination fields (for backwards compatibility)
      offset: useCursorPagination ? undefined : offset,
      total: useCursorPagination ? undefined : total,
      // Cursor-based pagination fields (preferred for large datasets)
      cursor: useCursorPagination ? cursor : undefined,
      nextCursor,
      hasMore,
    },
    filters: {
      actionTypes: actionTypes.map((a) => a.action),
      resourceTypes: resourceTypes.map((r) => r.resourceType),
    },
  });
});
