/**
 * SQL for GET /api/admin/audit-logs (paginated list + filter option lists).
 */

import { and, asc, count, desc, eq, lt } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { adminAuditLogs } from './tables/admin-audit-logs';
import { users } from './tables/user';
import type { JsonValue } from './types';

type AuditLogsDb = DrizzleClient | Transaction;

export type AdminAuditLogJoinedRow = {
  id: string;
  adminId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  previousValue: JsonValue | null;
  newValue: JsonValue | null;
  ipAddress: string | null;
  metadata: JsonValue | null;
  createdAt: Date;
  adminUsername: string | null;
  adminDisplayName: string | null;
  adminProfileImageUrl: string | null;
};

function buildAdminAuditFilterConditions(filters: {
  adminId?: string;
  action?: string;
  resourceType?: string;
}) {
  const filterConditions = [];
  if (filters.adminId) {
    filterConditions.push(eq(adminAuditLogs.adminId, filters.adminId));
  }
  if (filters.action) {
    filterConditions.push(eq(adminAuditLogs.action, filters.action));
  }
  if (filters.resourceType) {
    filterConditions.push(
      eq(adminAuditLogs.resourceType, filters.resourceType)
    );
  }
  return filterConditions;
}

export async function countAdminAuditLogsForFilters(
  db: AuditLogsDb,
  filters: {
    adminId?: string;
    action?: string;
    resourceType?: string;
  }
): Promise<number> {
  const filterConditions = buildAdminAuditFilterConditions(filters);
  const filterCondition =
    filterConditions.length > 0 ? and(...filterConditions) : undefined;
  const [totalResult] = await db
    .select({ count: count() })
    .from(adminAuditLogs)
    .where(filterCondition);
  return totalResult?.count ?? 0;
}

export async function selectAdminAuditLogsPageJoinedUsers(
  db: AuditLogsDb,
  params: {
    limit: number;
    offset: number;
    useCursorPagination: boolean;
    cursor?: string;
    filterAdminId?: string;
    filterAction?: string;
    filterResourceType?: string;
  }
): Promise<AdminAuditLogJoinedRow[]> {
  const {
    limit,
    offset,
    useCursorPagination,
    cursor,
    filterAdminId,
    filterAction,
    filterResourceType,
  } = params;

  const filterConditions = buildAdminAuditFilterConditions({
    adminId: filterAdminId,
    action: filterAction,
    resourceType: filterResourceType,
  });

  const queryConditions = [...filterConditions];
  if (cursor) {
    queryConditions.push(lt(adminAuditLogs.createdAt, new Date(cursor)));
  }
  const whereCondition =
    queryConditions.length > 0 ? and(...queryConditions) : undefined;

  return db
    .select({
      id: adminAuditLogs.id,
      adminId: adminAuditLogs.adminId,
      action: adminAuditLogs.action,
      resourceType: adminAuditLogs.resourceType,
      resourceId: adminAuditLogs.resourceId,
      previousValue: adminAuditLogs.previousValue,
      newValue: adminAuditLogs.newValue,
      ipAddress: adminAuditLogs.ipAddress,
      metadata: adminAuditLogs.metadata,
      createdAt: adminAuditLogs.createdAt,
      adminUsername: users.username,
      adminDisplayName: users.displayName,
      adminProfileImageUrl: users.profileImageUrl,
    })
    .from(adminAuditLogs)
    .leftJoin(users, eq(adminAuditLogs.adminId, users.id))
    .where(whereCondition)
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(limit + 1)
    .offset(useCursorPagination ? 0 : offset);
}

export async function fetchAdminAuditLogsPageBundle(
  db: AuditLogsDb,
  params: {
    limit: number;
    offset: number;
    useCursorPagination: boolean;
    cursor?: string;
    filterAdminId?: string;
    filterAction?: string;
    filterResourceType?: string;
  }
): Promise<{ total: number; logs: AdminAuditLogJoinedRow[] }> {
  const {
    useCursorPagination,
    filterAdminId,
    filterAction,
    filterResourceType,
  } = params;

  let totalCount = 0;
  if (!useCursorPagination) {
    totalCount = await countAdminAuditLogsForFilters(db, {
      adminId: filterAdminId,
      action: filterAction,
      resourceType: filterResourceType,
    });
  }

  const logs = await selectAdminAuditLogsPageJoinedUsers(db, params);
  return { total: totalCount, logs };
}

export async function selectAdminAuditLogDistinctActions(db: AuditLogsDb) {
  return db
    .selectDistinct({ action: adminAuditLogs.action })
    .from(adminAuditLogs)
    .orderBy(asc(adminAuditLogs.action));
}

export async function selectAdminAuditLogDistinctResourceTypes(
  db: AuditLogsDb
) {
  return db
    .selectDistinct({ resourceType: adminAuditLogs.resourceType })
    .from(adminAuditLogs)
    .orderBy(asc(adminAuditLogs.resourceType));
}
