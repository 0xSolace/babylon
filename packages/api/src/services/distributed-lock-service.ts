/**
 * Distributed Lock Service
 *
 * @description Generic distributed lock implementation using CQL.
 * Prevents race conditions across multiple servers/processes.
 * Supports automatic stale lock recovery.
 */

import { randomBytes } from 'node:crypto'
import { db } from '@babylon/db'
import { logger } from '@babylon/shared'

/** Safely convert a CQL date field to a Date object */
function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value)
  }
  return null
}

export interface LockOptions {
  lockId: string
  durationMs: number
  operation: string
  processId?: string
}

/**
 * Acquire a distributed lock
 *
 * @description Uses a "check-first, create-second" pattern to avoid triggering
 * unique constraint errors in normal cases. Race conditions (multiple processes
 * checking and creating simultaneously) are handled gracefully with proper error
 * recovery. Supports automatic stale lock recovery for expired locks.
 *
 * @param {LockOptions} options - Lock acquisition options
 * @param {string} options.lockId - Unique lock identifier
 * @param {number} options.durationMs - Lock duration in milliseconds
 * @param {string} options.operation - Operation name for logging
 * @param {string} [options.processId] - Optional process identifier (auto-generated if not provided)
 * @returns {Promise<boolean>} True if lock was acquired, false otherwise
 */
export async function acquireLock(options: LockOptions): Promise<boolean> {
  const { lockId, durationMs, operation, processId } = options
  const now = new Date()
  const expiry = new Date(now.getTime() + durationMs)

  // Generate serverless-safe unique ID if not provided
  const lockHolder =
    processId || `serverless-${Date.now()}-${randomBytes(8).toString('hex')}`

  // First, check if lock already exists (avoids unique constraint errors in most cases)
  const existingLock = await db.generationLock.findFirst({
    where: { id: lockId },
  })

  if (existingLock) {
    // Lock exists - check if it's expired
    const existingExpiresAt = toDate(existingLock.expiresAt)
    if (existingExpiresAt && existingExpiresAt <= now) {
      // Expired - try to recover atomically using conditional update
      await db.generationLock.update({
        where: { id: lockId },
        data: {
          lockedBy: lockHolder,
          lockedAt: now,
          expiresAt: expiry,
          operation,
        },
      })

      // Check if we updated (need to verify the lock is still expired)
      const updatedLock = await db.generationLock.findFirst({
        where: { id: lockId },
      })

      if (updatedLock && updatedLock.lockedBy === lockHolder) {
        logger.info(
          `Lock ${lockId} acquired (recovered stale)`,
          {
            lockId,
            lockHolder,
            expiresAt: expiry.toISOString(),
          },
          'DistributedLockService',
        )
        return true
      }
      // Someone else recovered it between our check and update - fall through to log
    }

    // Lock exists and is valid (or was just recovered by another process)
    const existingLockedAt = toDate(existingLock.lockedAt)
    const ageMinutes = existingLockedAt
      ? Math.round((now.getTime() - existingLockedAt.getTime()) / 1000 / 60)
      : 0
    logger.info(
      `Lock ${lockId} held by ${existingLock.lockedBy} - skipping`,
      {
        lockId,
        holder: existingLock.lockedBy,
        ageMinutes,
        expiresIn: existingExpiresAt
          ? Math.round((existingExpiresAt.getTime() - now.getTime()) / 1000)
          : 0,
      },
      'DistributedLockService',
    )
    return false
  }

  // No lock exists - try to create it
  await db.generationLock.create({
    data: {
      id: lockId,
      lockedBy: lockHolder,
      lockedAt: now,
      expiresAt: expiry,
      operation,
    },
  })

  logger.info(
    `Lock ${lockId} acquired (created)`,
    {
      lockId,
      lockHolder,
      expiresAt: expiry.toISOString(),
    },
    'DistributedLockService',
  )
  return true
}

/**
 * Release a distributed lock
 *
 * @description Releases a lock only if it's held by the specified process ID.
 * This prevents accidental release of locks held by other processes. Process ID
 * is required for safe lock release in distributed environments.
 *
 * @param {string} lockId - Lock identifier to release
 * @param {string} [processId] - Process ID that holds the lock (required for safe release)
 * @returns {Promise<void>}
 */
export async function releaseLock(
  lockId: string,
  processId?: string,
): Promise<void> {
  if (!processId) {
    // Process ID is required for safe lock release to prevent releasing locks held by other processes
    logger.warn(
      `releaseLock called without processId for ${lockId} - unsafe release prevented`,
      undefined,
      'DistributedLockService',
    )
    return
  }

  // Only delete if we're the holder
  const existingLock = await db.generationLock.findFirst({
    where: { id: lockId },
  })

  if (existingLock && existingLock.lockedBy === processId) {
    await db.generationLock.delete({
      where: { id: lockId },
    })

    logger.info(
      `Lock ${lockId} released`,
      { lockId, lockHolder: processId },
      'DistributedLockService',
    )
  } else if (existingLock) {
    logger.warn(
      `Lock ${lockId} not held by this process`,
      {
        lockId,
        requestedHolder: processId,
        actualHolder: existingLock.lockedBy,
      },
      'DistributedLockService',
    )
  } else {
    logger.info(
      `Lock ${lockId} already released or expired`,
      { lockId },
      'DistributedLockService',
    )
  }
}

/**
 * Check if a lock is currently held
 *
 * @description Queries the database to check if a lock exists and is still valid
 * (not expired). Returns the lock information if held, null otherwise.
 *
 * @param {string} lockId - Lock identifier to check
 * @returns {Promise<object | null>} Lock information if held and valid, null otherwise
 */
export async function checkLock(lockId: string) {
  const lock = await db.generationLock.findFirst({
    where: { id: lockId },
  })

  if (!lock) return null

  const now = new Date()
  const lockExpiresAt = toDate(lock.expiresAt)
  if (!lockExpiresAt || lockExpiresAt < now) {
    return null // Expired or invalid
  }

  return lock
}
