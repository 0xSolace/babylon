/**
 * Admin Authentication Middleware
 *
 * @description Middleware for verifying admin privileges. Authenticates the user
 * and checks if they have admin access. In development mode, supports dev admin
 * token authentication for easier testing. In production, requires full Privy
 * authentication and database admin flag verification.
 *
 * @security
 * - NEVER bypasses authentication based on localhost/host header
 * - Dev mode requires explicit dev admin token
 * - Production requires Privy auth + database admin flag
 *
 * @rbac
 * - SUPER_ADMIN: Full access, can manage other admins
 * - ADMIN: Can view all stats and perform admin actions
 * - VIEWER: Read-only access to admin dashboards
 */

import {
  type AdminPermission,
  type AdminRoleType,
  selectActiveAdminRoleSliceForUser,
  selectAdminGateUserRow,
  selectLegacyAdminsExcludingUserIds,
  selectRoleAdminsJoinedUsers,
  selectUserLegacyAdminPrivySlice,
} from '@babylon/db';
import { asSystem, ROLE_PERMISSIONS } from '@babylon/db/engine-storage';
import { checkForAdminEmail, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import type { AuthenticatedUser } from './auth-middleware';
import { authenticate, getPrivyClient } from './auth-middleware';
import { getDevAdminUser, isValidDevAdminToken } from './dev-credentials';
import { AuthorizationError } from './errors';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Authenticated admin user with role information
 */
export interface AuthenticatedAdminUser extends AuthenticatedUser {
  role: AdminRoleType | null;
  permissions: AdminPermission[];
}

/**
 * Get admin role and permissions for a user
 *
 * @param userId - The database user ID
 * @param privyId - Optional Privy ID for fetching verified email directly from Privy
 */
export async function getAdminRole(
  userId: string,
  privyId?: string
): Promise<{ role: AdminRoleType | null; permissions: AdminPermission[] }> {
  const dbPart = await asSystem(async (c) => {
    const adminRole = await selectActiveAdminRoleSliceForUser(c, userId);

    if (adminRole?.role) {
      const role = adminRole.role as AdminRoleType;
      const permissions =
        (adminRole.permissions as AdminPermission[]) || ROLE_PERMISSIONS[role];
      return { type: 'role' as const, role, permissions, user: null };
    }

    const user = await selectUserLegacyAdminPrivySlice(c, userId);

    if (user?.isAdmin) {
      return {
        type: 'legacy' as const,
        role: 'ADMIN' as const,
        permissions: ROLE_PERMISSIONS.ADMIN,
        user: null,
      };
    }

    return { type: 'privy' as const, user };
  }, 'admin-get-role');

  if (dbPart.type === 'role') {
    return { role: dbPart.role, permissions: dbPart.permissions };
  }
  if (dbPart.type === 'legacy') {
    return { role: dbPart.role, permissions: dbPart.permissions };
  }

  const user = dbPart.user;

  const adminDomain = process.env.ADMIN_EMAIL_DOMAIN?.trim();
  const effectivePrivyId = privyId ?? user?.privyId;

  if (adminDomain && effectivePrivyId) {
    const privyClient = getPrivyClient();
    const privyUser = await privyClient.getUser(effectivePrivyId);

    const { adminEmail, allVerifiedEmails } = checkForAdminEmail(privyUser);

    if (adminEmail) {
      logger.info(
        'Auto-promoting user to ADMIN via verified Privy email domain',
        {
          userId,
          emailDomain: adminEmail.split('@')[1] ?? null,
          emailCount: allVerifiedEmails.length,
          privyId: effectivePrivyId,
        },
        'getAdminRole'
      );
      return { role: 'ADMIN', permissions: ROLE_PERMISSIONS.ADMIN };
    }
  }

  return { role: null, permissions: [] };
}

/**
 * Authenticate request and verify admin privileges.
 */
export async function requireAdmin(
  request: NextRequest
): Promise<AuthenticatedAdminUser> {
  if (isDevelopment) {
    const devAdminToken = request.headers.get('x-dev-admin-token');
    if (devAdminToken && isValidDevAdminToken(devAdminToken)) {
      const devUser = getDevAdminUser();
      if (devUser) {
        logger.info(
          'Admin access granted via dev token',
          { userId: devUser.userId },
          'requireAdmin'
        );
        return {
          userId: devUser.userId,
          dbUserId: devUser.dbUserId,
          walletAddress: devUser.walletAddress,
          role: 'SUPER_ADMIN',
          permissions: ROLE_PERMISSIONS.SUPER_ADMIN,
        };
      }
    }
  }

  const user = await authenticate(request);

  const dbUser = await asSystem(
    async (c) => selectAdminGateUserRow(c, user.userId),
    'require-admin-user-row'
  );

  if (!dbUser) {
    logger.warn(
      'Admin check failed: User not found in database',
      { userId: user.userId },
      'requireAdmin'
    );
    throw new AuthorizationError('User not found', 'admin', 'access');
  }

  if (dbUser.isBanned) {
    logger.warn(
      'Admin check failed: User is banned',
      { userId: user.userId },
      'requireAdmin'
    );
    throw new AuthorizationError('User is banned', 'admin', 'access');
  }

  const { role, permissions } = await getAdminRole(user.userId, user.privyId);

  if (!role) {
    logger.warn(
      'Admin check failed: User is not an admin',
      {
        userId: user.userId,
        username: dbUser.username,
      },
      'requireAdmin'
    );
    throw new AuthorizationError('Admin access required', 'admin', 'access');
  }

  logger.info(
    'Admin access granted',
    {
      userId: user.userId,
      username: dbUser.username,
      role,
    },
    'requireAdmin'
  );

  return {
    ...user,
    role,
    permissions,
  };
}

/**
 * Require specific admin permission
 */
export async function requirePermission(
  request: NextRequest,
  permission: AdminPermission
): Promise<AuthenticatedAdminUser> {
  const admin = await requireAdmin(request);

  if (!admin.permissions.includes(permission)) {
    logger.warn(
      'Permission check failed',
      {
        userId: admin.userId,
        role: admin.role,
        requiredPermission: permission,
      },
      'requirePermission'
    );
    throw new AuthorizationError(
      `Permission required: ${permission}`,
      'admin',
      permission
    );
  }

  return admin;
}

/**
 * Require SUPER_ADMIN role
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<AuthenticatedAdminUser> {
  const admin = await requireAdmin(request);

  if (admin.role !== 'SUPER_ADMIN') {
    logger.warn(
      'Super admin check failed',
      {
        userId: admin.userId,
        role: admin.role,
      },
      'requireSuperAdmin'
    );
    throw new AuthorizationError(
      'Super admin access required',
      'admin',
      'super_admin'
    );
  }

  return admin;
}

/**
 * Check if a user ID has admin privileges (without requiring request auth)
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const { role } = await getAdminRole(userId);
  return role !== null;
}

/**
 * Get all admin users with their roles
 */
export async function getAllAdmins(): Promise<
  Array<{
    userId: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    role: AdminRoleType;
    permissions: AdminPermission[];
    grantedAt: Date;
    grantedBy: string;
  }>
> {
  const { roleAdmins, legacyAdmins } = await asSystem(async (c) => {
    const roleAdmins = await selectRoleAdminsJoinedUsers(c);
    const roleUserIds = roleAdmins.map((a) => a.userId);
    const legacyAdmins = await selectLegacyAdminsExcludingUserIds(
      c,
      roleUserIds
    );
    return { roleAdmins, legacyAdmins };
  }, 'admin-list-all-admins');

  const results: Array<{
    userId: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    role: AdminRoleType;
    permissions: AdminPermission[];
    grantedAt: Date;
    grantedBy: string;
  }> = [];

  for (const admin of roleAdmins) {
    const role = admin.role as AdminRoleType;
    results.push({
      userId: admin.userId,
      username: admin.username,
      displayName: admin.displayName,
      profileImageUrl: admin.profileImageUrl,
      role,
      permissions:
        (admin.permissions as AdminPermission[]) || ROLE_PERMISSIONS[role],
      grantedAt: admin.grantedAt,
      grantedBy: admin.grantedBy,
    });
  }

  for (const legacy of legacyAdmins) {
    results.push({
      userId: legacy.id,
      username: legacy.username,
      displayName: legacy.displayName,
      profileImageUrl: legacy.profileImageUrl,
      role: 'ADMIN',
      permissions: ROLE_PERMISSIONS.ADMIN,
      grantedAt: legacy.createdAt,
      grantedBy: legacy.id,
    });
  }

  return results;
}
