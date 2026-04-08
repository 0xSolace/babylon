/**
 * Distributed Lock Service
 *
 * @description Generic distributed lock implementation using Drizzle.
 * Prevents race conditions across multiple servers/processes.
 * Supports automatic stale lock recovery.
 */

import {
  deleteGenerationLockIfHeldBy,
  insertGenerationLockOnConflictDoNothing,
  selectGenerationLockById,
  updateGenerationLockTakeIfExpired,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import { randomBytes } from 'crypto';

export interface LockOptions {
  lockId: string;
  durationMs: number;
  operation: string;
  processId?: string;
}

export class DistributedLockService {
  /**
   * Acquire a distributed lock
   */
  static async acquireLock(options: LockOptions): Promise<boolean> {
    const { lockId, durationMs, operation, processId } = options;
    const now = new Date();
    const expiry = new Date(now.getTime() + durationMs);

    const lockHolder =
      processId || `serverless-${Date.now()}-${randomBytes(8).toString('hex')}`;

    return asSystem(async (c) => {
      const tookStale = await updateGenerationLockTakeIfExpired(c, {
        lockId,
        lockHolder,
        now,
        expiresAt: expiry,
        operation,
      });

      if (tookStale) {
        logger.info(
          `Lock ${lockId} acquired (recovered stale)`,
          {
            lockId,
            lockHolder,
            expiresAt: expiry.toISOString(),
          },
          'DistributedLockService'
        );
        return true;
      }

      const existingLock = await selectGenerationLockById(c, lockId);

      if (existingLock) {
        const ageMinutes = Math.round(
          (now.getTime() - existingLock.lockedAt.getTime()) / 1000 / 60
        );
        logger.info(
          `Lock ${lockId} held by ${existingLock.lockedBy} - skipping`,
          {
            lockId,
            holder: existingLock.lockedBy,
            ageMinutes,
            expiresIn: Math.round(
              (existingLock.expiresAt.getTime() - now.getTime()) / 1000
            ),
          },
          'DistributedLockService'
        );
        return false;
      }

      const inserted = await insertGenerationLockOnConflictDoNothing(c, {
        id: lockId,
        lockedBy: lockHolder,
        lockedAt: now,
        expiresAt: expiry,
        operation,
      });

      if (inserted) {
        logger.info(
          `Lock ${lockId} acquired (created)`,
          {
            lockId,
            lockHolder,
            expiresAt: expiry.toISOString(),
          },
          'DistributedLockService'
        );
        return true;
      }

      logger.info(
        `Lock ${lockId} lost race to another process`,
        { lockId },
        'DistributedLockService'
      );
      return false;
    }, 'distributed-lock-acquire');
  }

  /**
   * Release a distributed lock
   */
  static async releaseLock(lockId: string, processId?: string): Promise<void> {
    if (!processId) {
      logger.warn(
        `releaseLock called without processId for ${lockId} - unsafe release prevented`,
        undefined,
        'DistributedLockService'
      );
      return;
    }

    await asSystem(async (c) => {
      const deleted = await deleteGenerationLockIfHeldBy(c, lockId, processId);

      if (deleted) {
        logger.info(
          `Lock ${lockId} released`,
          { lockId, lockHolder: processId },
          'DistributedLockService'
        );
      } else {
        logger.info(
          `Lock ${lockId} not released - not held by this process or already released`,
          { lockId, processId },
          'DistributedLockService'
        );
      }
    }, 'distributed-lock-release');
  }

  /**
   * Check if a lock is currently held
   */
  static async checkLock(lockId: string) {
    return asSystem(async (c) => {
      const lock = await selectGenerationLockById(c, lockId);

      if (!lock) return null;

      const now = new Date();
      if (lock.expiresAt < now) {
        return null;
      }

      return lock;
    }, 'distributed-lock-check');
  }
}
