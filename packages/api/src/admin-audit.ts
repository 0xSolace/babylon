/**
 * Admin Audit Logging
 *
 * Provides audit logging functionality for admin actions.
 */

import { adminAuditLogs, db } from '@babylon/db'
import { logger } from '@babylon/shared'
import { v4 as uuidv4 } from 'uuid'

/**
 * Parameters for logging an admin modification action
 */
export interface LogAdminModifyParams {
  adminId: string
  resourceType: string
  resourceId: string
  previousValue: Record<string, unknown>
  newValue: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an admin modification action to the audit log
 */
export async function logAdminModify(
  params: LogAdminModifyParams,
): Promise<void> {
  const {
    adminId,
    resourceType,
    resourceId,
    previousValue,
    newValue,
    ipAddress,
    metadata,
  } = params

  try {
    await db.insert(adminAuditLogs).values({
      id: uuidv4(),
      adminId,
      action: 'modify',
      resourceType,
      resourceId,
      previousValue: JSON.stringify(previousValue),
      newValue: JSON.stringify(newValue),
      ipAddress: ipAddress ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date(),
    })

    logger.info(
      'Admin action logged',
      { adminId, resourceType, resourceId, action: 'modify' },
      'logAdminModify',
    )
  } catch (error) {
    // Log but don't throw - audit logging shouldn't break the main operation
    logger.error(
      'Failed to log admin action',
      { error: String(error), adminId, resourceType, resourceId },
      'logAdminModify',
    )
  }
}
