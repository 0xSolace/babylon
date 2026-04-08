// GET /api/admin/roles - List admins
// POST /api/admin/roles - Grant/revoke roles (SUPER_ADMIN only)

import {
  applyRateLimit,
  errorResponse,
  getAllAdmins,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
  requireAdmin,
  requireSuperAdmin,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  type AdminRoleType,
  countActiveSuperAdminsForUpdate,
  generateSnowflakeId,
  revokeAdminRoleAndClearUserAdmin,
  selectActiveAdminRoleRowByUserId,
  selectAdminRoleTargetUserDisplaySlice,
  upsertAdminRoleGrantAndSetUserAdmin,
} from '@babylon/db';
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  type AdminPermission,
  asSystem,
  ROLE_PERMISSIONS,
} from '@babylon/db/engine-storage';
import { logger, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * Zod schema for role grant/revoke request validation
 *
 * Uses the canonical ADMIN_ROLES and ADMIN_PERMISSIONS constants from @babylon/db
 * to ensure validation stays in sync with the database schema.
 */
const RoleRequestSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  action: z.enum(['grant', 'revoke']),
  role: z.enum(ADMIN_ROLES).optional(),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).optional(),
});

/**
 * Custom error class for role operations that need to be caught
 * and converted to proper API responses
 */
class RoleOperationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'RoleOperationError';
  }
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  const admins = await getAllAdmins();

  return successResponse({
    admins: admins.map((admin) => ({
      userId: admin.userId,
      username: admin.username,
      displayName: admin.displayName,
      profileImageUrl: admin.profileImageUrl,
      role: admin.role,
      permissions: admin.permissions,
      grantedAt: toISO(admin.grantedAt),
      grantedBy: admin.grantedBy,
    })),
    total: admins.length,
  });
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const admin = await requireSuperAdmin(request);

  // Rate limit role management to prevent abuse
  const rateLimitResult = applyRateLimit(
    admin.userId,
    RATE_LIMIT_CONFIGS.ADMIN_ACTION
  );
  if (!rateLimitResult.allowed) {
    return rateLimitError(rateLimitResult.retryAfter);
  }

  const body = await request.json();

  // Validate request body with Zod
  const parseResult = RoleRequestSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    return errorResponse(
      firstIssue?.message ?? 'Invalid request body',
      'VALIDATION_ERROR',
      400
    );
  }

  // Extract validated data with proper typing
  const { userId, action, role, permissions } = parseResult.data as {
    userId: string;
    action: 'grant' | 'revoke';
    role?: AdminRoleType;
    permissions?: AdminPermission[];
  };

  const targetUser = await asSystem(
    (tx) => selectAdminRoleTargetUserDisplaySlice(tx, userId),
    'admin-roles-target-user'
  );

  if (!targetUser) {
    return errorResponse('User not found', 'USER_NOT_FOUND', 404);
  }

  if (action === 'grant') {
    if (!role) {
      return errorResponse(
        `Valid role is required. Must be one of: ${ADMIN_ROLES.join(', ')}`,
        'INVALID_ROLE',
        400
      );
    }

    // Get default permissions for the role
    const roleDefaultPermissions = ROLE_PERMISSIONS[role];

    // If custom permissions provided, validate they are a subset of role's allowed permissions
    if (permissions) {
      const invalidPermissions = permissions.filter(
        (p) => !roleDefaultPermissions.includes(p)
      );
      if (invalidPermissions.length > 0) {
        return errorResponse(
          `Custom permissions must be a subset of ${role} permissions. Invalid: ${invalidPermissions.join(', ')}`,
          'INVALID_PERMISSIONS',
          400
        );
      }
    }

    const finalPermissions: AdminPermission[] =
      permissions ?? roleDefaultPermissions;
    const now = new Date();

    await asSystem(
      (tx) =>
        upsertAdminRoleGrantAndSetUserAdmin(tx, {
          rowId: `admin_role_${generateSnowflakeId()}`,
          userId,
          role,
          permissions: finalPermissions,
          grantedBy: admin.userId,
          grantedAt: now,
        }),
      'admin-roles-grant'
    );

    logger.info(
      'Admin role granted/updated',
      { targetUserId: userId, role, grantedBy: admin.userId },
      'POST /api/admin/roles'
    );

    return successResponse({
      success: true,
      message: `${role} role granted to user`,
      user: {
        userId,
        username: targetUser.username,
        displayName: targetUser.displayName,
        role,
        permissions: finalPermissions,
      },
    });
  }

  const existingRole = await asSystem(
    (tx) => selectActiveAdminRoleRowByUserId(tx, userId),
    'admin-roles-existing'
  );

  if (!existingRole) {
    return errorResponse(
      'User does not have an active admin role',
      'NO_ACTIVE_ROLE',
      400
    );
  }

  if (admin.userId === userId) {
    return errorResponse(
      'Cannot revoke your own admin role',
      'CANNOT_REVOKE_SELF',
      400
    );
  }

  // Use transaction with SELECT FOR UPDATE to prevent race condition
  // when revoking super admin - locks the rows during the check and revoke
  try {
    await asSystem(async (tx) => {
      if (existingRole.role === 'SUPER_ADMIN') {
        const superAdminCountValue = await countActiveSuperAdminsForUpdate(tx);
        if (superAdminCountValue <= 1) {
          throw new RoleOperationError(
            'Cannot revoke the last super admin',
            'LAST_SUPER_ADMIN',
            400
          );
        }
      }

      await revokeAdminRoleAndClearUserAdmin(tx, userId);
    }, 'admin-roles-revoke');
  } catch (error) {
    if (error instanceof RoleOperationError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    throw error; // Re-throw unexpected errors to be handled by withErrorHandling
  }

  logger.info(
    'Admin role revoked',
    { targetUserId: userId, revokedBy: admin.userId },
    'POST /api/admin/roles'
  );

  return successResponse({
    success: true,
    message: 'Admin role revoked',
    user: {
      userId,
      username: targetUser.username,
      displayName: targetUser.displayName,
    },
  });
});
