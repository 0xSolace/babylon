/**
 * Drizzle for `@babylon/api` admin middleware (roles + legacy `isAdmin`).
 */

import { and, eq, isNull, notInArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type AdminPermission,
  type AdminRoleType,
  adminRoles,
} from './tables/admin-roles';
import { users } from './tables/user';

type AdminDb = DrizzleClient | Transaction;

export async function selectActiveAdminRoleSliceForUser(
  client: AdminDb,
  userId: string
): Promise<{ role: string; permissions: unknown } | undefined> {
  const [adminRole] = await client
    .select({
      role: adminRoles.role,
      permissions: adminRoles.permissions,
    })
    .from(adminRoles)
    .where(and(eq(adminRoles.userId, userId), isNull(adminRoles.revokedAt)))
    .limit(1);
  return adminRole;
}

export async function selectUserLegacyAdminPrivySlice(
  client: AdminDb,
  userId: string
): Promise<{ isAdmin: boolean; privyId: string | null } | undefined> {
  const [user] = await client
    .select({
      isAdmin: users.isAdmin,
      privyId: users.privyId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user;
}

export async function selectAdminGateUserRow(
  client: AdminDb,
  userId: string
): Promise<
  | {
      isAdmin: boolean;
      isBanned: boolean;
      username: string | null;
      displayName: string | null;
    }
  | undefined
> {
  const [row] = await client
    .select({
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type RoleAdminJoinedRow = {
  userId: string;
  role: string;
  permissions: unknown;
  grantedAt: Date;
  grantedBy: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
};

export async function selectRoleAdminsJoinedUsers(
  client: AdminDb
): Promise<RoleAdminJoinedRow[]> {
  return client
    .select({
      userId: adminRoles.userId,
      role: adminRoles.role,
      permissions: adminRoles.permissions,
      grantedAt: adminRoles.grantedAt,
      grantedBy: adminRoles.grantedBy,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
    })
    .from(adminRoles)
    .innerJoin(users, eq(adminRoles.userId, users.id))
    .where(isNull(adminRoles.revokedAt));
}

export type LegacyAdminRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
};

export async function selectLegacyAdminsExcludingUserIds(
  client: AdminDb,
  excludeUserIds: string[]
): Promise<LegacyAdminRow[]> {
  const condition =
    excludeUserIds.length > 0
      ? and(eq(users.isAdmin, true), notInArray(users.id, excludeUserIds))
      : eq(users.isAdmin, true);

  return client
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(condition);
}

export async function selectAdminRoleTargetUserDisplaySlice(
  client: AdminDb,
  userId: string
): Promise<
  | { id: string; username: string | null; displayName: string | null }
  | undefined
> {
  const [row] = await client
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectActiveAdminRoleRowByUserId(
  client: AdminDb,
  userId: string
): Promise<typeof adminRoles.$inferSelect | undefined> {
  const [row] = await client
    .select()
    .from(adminRoles)
    .where(and(eq(adminRoles.userId, userId), isNull(adminRoles.revokedAt)))
    .limit(1);
  return row;
}

/** Row lock: prevents revoking the last SUPER_ADMIN concurrently. */
export async function countActiveSuperAdminsForUpdate(
  client: AdminDb
): Promise<number> {
  const superAdminCountResult = await client.execute(
    sql`SELECT COUNT(*) as count FROM ${adminRoles}
        WHERE ${adminRoles.role} = 'SUPER_ADMIN'
        AND ${adminRoles.revokedAt} IS NULL
        FOR UPDATE`
  );

  const rows = Array.isArray(superAdminCountResult)
    ? superAdminCountResult
    : [];
  return Number((rows[0] as { count: string } | undefined)?.count ?? 0);
}

export async function upsertAdminRoleGrantAndSetUserAdmin(
  client: AdminDb,
  params: {
    rowId: string;
    userId: string;
    role: AdminRoleType;
    permissions: AdminPermission[];
    grantedBy: string;
    grantedAt: Date;
  }
): Promise<void> {
  const { rowId, userId, role, permissions, grantedBy, grantedAt } = params;
  await client
    .insert(adminRoles)
    .values({
      id: rowId,
      userId,
      role,
      permissions,
      grantedBy,
      grantedAt,
    })
    .onConflictDoUpdate({
      target: adminRoles.userId,
      set: {
        role,
        permissions,
        grantedBy,
        grantedAt,
        revokedAt: null,
      },
    });

  await client.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
}

export async function revokeAdminRoleAndClearUserAdmin(
  client: AdminDb,
  userId: string
): Promise<void> {
  await client
    .update(adminRoles)
    .set({ revokedAt: new Date() })
    .where(eq(adminRoles.userId, userId));

  await client
    .update(users)
    .set({ isAdmin: false })
    .where(eq(users.id, userId));
}
