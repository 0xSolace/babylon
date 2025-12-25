// @ts-nocheck - Database query type inference issues, needs refactoring
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

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { asc, db, eq, oracleCommitments } from '@babylon/db'
import { logger } from '@babylon/shared'
import { toDate } from '@jejunetwork/shared'
import type { StoredCommitment } from './oracle/types'

const ENCRYPTION_KEY =
  process.env.ORACLE_ENCRYPTION_KEY || 'default-key-change-in-production-32'
const ALGORITHM = 'aes-256-cbc'

// biome-ignore lint/complexity/noStaticOnlyClass: Service pattern uses static methods for stateless operations
export class CommitmentStore {
  /**
   * Generate a cryptographically secure random salt
   */
  static generateSalt(): string {
    return `0x${randomBytes(32).toString('hex')}`
  }

  /**
   * Encrypt salt for storage
   */
  private static encryptSalt(salt: string): string {
    const iv = randomBytes(16)
    const cipher = createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv,
    )

    let encrypted = cipher.update(salt, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return `${iv.toString('hex')}:${encrypted}`
  }

  /**
   * Decrypt salt from storage
   */
  private static decryptSalt(encryptedSalt: string): string {
    const parts = encryptedSalt.split(':')
    const ivHex = parts[0] ?? ''
    const encrypted = parts[1] ?? ''
    const iv = Buffer.from(ivHex, 'hex')

    const decipher = createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv,
    )

    let decrypted: string = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * Store commitment with encrypted salt (upsert to handle updates)
   * Returns the stored commitment record
   */
  static async store(
    commitment: StoredCommitment,
  ): Promise<{ id: string; questionId: string }> {
    const encryptedSalt = CommitmentStore.encryptSalt(commitment.salt)

    // Check if exists
    const existing = await db
      .select({ id: oracleCommitments.id })
      .from(oracleCommitments)
      .where(eq(oracleCommitments.questionId, commitment.questionId))
      .limit(1)

    let result: { id: string; questionId: string }

    if (existing.length > 0) {
      // Update existing
      const updated = await db
        .update(oracleCommitments)
        .set({
          sessionId: commitment.sessionId,
          saltEncrypted: encryptedSalt,
          commitment: commitment.commitment,
        })
        .where(eq(oracleCommitments.questionId, commitment.questionId))
        .returning()

      const first = updated[0]
      result = {
        id: String(first?.id ?? ''),
        questionId: String(first?.questionId ?? ''),
      }
    } else {
      // Create new
      const created = await db
        .insert(oracleCommitments)
        .values({
          id: `commitment-${commitment.questionId}-${Date.now()}`,
          questionId: commitment.questionId,
          sessionId: commitment.sessionId,
          saltEncrypted: encryptedSalt,
          commitment: commitment.commitment,
          createdAt: commitment.createdAt,
        })
        .returning()

      const first = created[0]
      result = {
        id: String(first?.id ?? ''),
        questionId: String(first?.questionId ?? ''),
      }
    }

    logger.info(
      `Stored commitment for question ${commitment.questionId}`,
      {
        sessionId: commitment.sessionId,
        recordId: result.id,
        wasCreated: existing.length === 0,
        operation: 'upsert',
      },
      'CommitmentStore',
    )

    return result
  }

  /**
   * Retrieve commitment and decrypt salt
   */
  static async retrieve(questionId: string): Promise<StoredCommitment | null> {
    logger.info(
      `Retrieving commitment for question ${questionId}`,
      undefined,
      'CommitmentStore',
    )

    const result = await db
      .select()
      .from(oracleCommitments)
      .where(eq(oracleCommitments.questionId, questionId))
      .limit(1)

    const row = result[0]

    if (!row) {
      logger.warn(
        `No commitment found for question ${questionId}`,
        undefined,
        'CommitmentStore',
      )
      return null
    }

    // Access row properties with proper coercion
    const rowId = String(row.id ?? '')
    const rowSessionId = String(row.sessionId ?? '')
    const rowCommitment = String(row.commitment ?? '')
    const rowSaltEncrypted = String(row.saltEncrypted ?? '')
    const rowCreatedAt = row.createdAt

    logger.info(
      `Found commitment for question ${questionId}`,
      {
        recordId: rowId,
        sessionId: rowSessionId,
        hasCommitment: !!rowCommitment,
        hasSalt: !!rowSaltEncrypted,
      },
      'CommitmentStore',
    )

    const salt = CommitmentStore.decryptSalt(rowSaltEncrypted)

    return {
      questionId: String(row.questionId ?? ''),
      sessionId: rowSessionId,
      salt,
      commitment: rowCommitment,
      createdAt: toDate(
        rowCreatedAt instanceof Date
          ? rowCreatedAt
          : String(rowCreatedAt ?? ''),
      ),
    }
  }

  /**
   * Delete commitment after reveal (cleanup)
   * Idempotent - won't fail if commitment already deleted
   */
  static async delete(questionId: string): Promise<void> {
    const result = await db
      .delete(oracleCommitments)
      .where(eq(oracleCommitments.questionId, questionId))
      .returning()

    if (result.length > 0) {
      logger.info(
        `Deleted commitment for question ${questionId}`,
        undefined,
        'CommitmentStore',
      )
    } else {
      logger.info(
        `Commitment already deleted for question ${questionId}`,
        undefined,
        'CommitmentStore',
      )
    }
  }

  /**
   * List all pending commitments for recovery and monitoring
   */
  static async listPending(): Promise<StoredCommitment[]> {
    const rows = await db
      .select()
      .from(oracleCommitments)
      .orderBy(asc(oracleCommitments.createdAt))

    return rows
      .filter((row): row is NonNullable<typeof row> => row != null)
      .map((row) => {
        const rowCreatedAt = row.createdAt
        return {
          questionId: String(row.questionId ?? ''),
          sessionId: String(row.sessionId ?? ''),
          salt: CommitmentStore.decryptSalt(String(row.saltEncrypted ?? '')),
          commitment: String(row.commitment ?? ''),
          createdAt: toDate(
            rowCreatedAt instanceof Date
              ? rowCreatedAt
              : String(rowCreatedAt ?? ''),
          ),
        }
      })
  }
}
