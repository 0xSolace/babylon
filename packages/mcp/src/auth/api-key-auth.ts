/**
 * MCP API Key Authentication
 *
 * Validates user API keys for MCP authentication
 */

import { hashApiKey } from '@babylon/api'
import { db, type UserApiKey } from '@babylon/db'
import { logger } from '@babylon/shared'

/**
 * Validate user API key and return userId
 *
 * @param apiKey - The API key to validate
 * @returns User ID if key is valid, null otherwise
 */
export async function validateUserApiKey(
  apiKey: string,
): Promise<{ userId: string } | null> {
  if (!apiKey) {
    return null
  }

  // Hash the provided API key
  const keyHash = hashApiKey(apiKey)

  // Query for a valid key that matches the hash, is not revoked, and hasn't expired
  type KeyRecord = Pick<UserApiKey, 'id' | 'userId' | 'expiresAt' | 'revokedAt'>
  const keys = await db.query<KeyRecord>(
    `SELECT id, "userId", "expiresAt", "revokedAt"
     FROM "UserApiKey"
     WHERE "keyHash" = $1
       AND "revokedAt" IS NULL
       AND ("expiresAt" IS NULL OR "expiresAt" > $2)
     LIMIT 1`,
    [keyHash, new Date().toISOString()],
  )

  const keyRecord = keys[0]

  if (!keyRecord) {
    logger.warn('Invalid or expired API key', undefined, 'MCP Auth')
    return null
  }

  // Update lastUsedAt timestamp
  await db.exec(`UPDATE "UserApiKey" SET "lastUsedAt" = $1 WHERE id = $2`, [
    new Date().toISOString(),
    keyRecord.id,
  ])

  return {
    userId: keyRecord.userId,
  }
}
