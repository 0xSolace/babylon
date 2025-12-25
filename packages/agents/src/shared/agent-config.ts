/**
 * Agent Config Helper
 *
 * Utility functions for accessing agent configuration from the UserAgentConfig table.
 * This replaces direct access to agent fields that were previously on the User table.
 */

import type { UserAgentConfig } from '@babylon/db'
import { db } from '@babylon/db'
import { first } from '@jejunetwork/shared'

/**
 * Get agent config for a user
 */
export async function getAgentConfig(
  userId: string,
): Promise<UserAgentConfig | null> {
  const result = await db.userAgentConfig.findMany({
    where: { userId },
    take: 1,
  })
  return first(result)
}
