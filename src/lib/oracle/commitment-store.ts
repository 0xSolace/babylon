/**
 * Commitment Storage
 *
 * Securely stores salts and commitments for commit-reveal pattern
 *
 * SECURITY NOTE:
 * - Salts are encrypted before storage
 * - In production, use KMS or secure key vault
 * - This implementation uses simple encryption for demonstration
 */

import { randomBytes } from 'node:crypto';
import { logger } from '../logger';
import { prisma } from '../prisma';
import type { StoredCommitment } from './types';

const _ENCRYPTION_KEY = process.env.ORACLE_ENCRYPTION_KEY || 'default-key-change-in-production-32';
const _ALGORITHM = 'aes-256-cbc';

export class CommitmentStore {
  /**
   * Generate a cryptographically secure random salt
   */
  static generateSalt(): string {
    return `0x${randomBytes(32).toString('hex')}`;
  }

  /**
   * Store commitment with encrypted salt (upsert to handle updates)
   * Returns the stored commitment record
   */
  static async store(commitment: StoredCommitment): Promise<{ id: string; questionId: string }> {
    const encryptedSalt = CommitmentStore.encryptSalt(commitment.salt);

    const result = await prisma.oracleCommitment.upsert({
      where: {
        questionId: commitment.questionId,
      },
      update: {
        sessionId: commitment.sessionId,
        saltEncrypted: encryptedSalt,
        commitment: commitment.commitment,
      },
      create: {
        id: `commitment-${commitment.questionId}-${Date.now()}`,
        questionId: commitment.questionId,
        sessionId: commitment.sessionId,
        saltEncrypted: encryptedSalt,
        commitment: commitment.commitment,
        createdAt: commitment.createdAt,
      },
    });

    logger.info(
      `Stored commitment for question ${commitment.questionId}`,
      {
        sessionId: commitment.sessionId,
        recordId: result.id,
        wasCreated: !result.sessionId || result.sessionId === '',
        operation: result.id.includes(commitment.questionId) ? 'upsert' : 'unknown',
      },
      'CommitmentStore'
    );

    return result;
  }

  /**
   * Retrieve commitment and decrypt salt
   */
  static async retrieve(questionId: string): Promise<StoredCommitment | null> {
    logger.info(`Retrieving commitment for question ${questionId}`, undefined, 'CommitmentStore');

    const stored = await prisma.oracleCommitment.findUnique({
      where: { questionId },
    });

    if (!stored) {
      logger.warn(`No commitment found for question ${questionId}`, undefined, 'CommitmentStore');
      return null;
    }

    logger.info(
      `Found commitment for question ${questionId}`,
      {
        recordId: stored.id,
        sessionId: stored.sessionId,
        hasCommitment: !!stored.commitment,
        hasSalt: !!stored.saltEncrypted,
      },
      'CommitmentStore'
    );

    const salt = CommitmentStore.decryptSalt(stored.saltEncrypted);

    return {
      questionId: stored.questionId,
      sessionId: stored.sessionId,
      salt,
      commitment: stored.commitment,
      createdAt: stored.createdAt,
    };
  }

  /**
   * Delete commitment after reveal (cleanup)
   * Idempotent - won't fail if commitment already deleted
   */
  static async delete(questionId: string): Promise<void> {
    try {
      await prisma.oracleCommitment.delete({
        where: { questionId },
      });
      logger.info(`Deleted commitment for question ${questionId}`, undefined, 'CommitmentStore');
    } catch (error: unknown) {
      // If record not found, that's okay (idempotent)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        logger.info(
          `Commitment already deleted for question ${questionId}`,
          undefined,
          'CommitmentStore'
        );
        return;
      }
      throw error;
    }
  }

  /**
   * List all pending commitments (for recovery/debugging)
   */
  static async listPending(): Promise<StoredCommitment[]> {
    const stored = await prisma.oracleCommitment.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return stored.map((s) => ({
      questionId: s.questionId,
      sessionId: s.sessionId,
      salt: CommitmentStore.decryptSalt(s.saltEncrypted),
      commitment: s.commitment,
      createdAt: s.createdAt,
    }));
  }
}
