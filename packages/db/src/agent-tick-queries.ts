/**
 * SQL for POST /api/cron/agent-tick (batch user/config load + post-tick config update).
 */

import { eq, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { type User, users } from './tables/user';
import {
  type UserAgentConfig,
  userAgentConfigs,
} from './tables/user-agent-configs';

export async function selectUsersAndAgentConfigsForAgentTickBatch(
  userIds: string[]
): Promise<{ users: User[]; configs: UserAgentConfig[] }> {
  if (userIds.length === 0) {
    return { users: [], configs: [] };
  }
  return asSystem(async (tx) => {
    const [allUsers, allConfigs] = await Promise.all([
      tx.select().from(users).where(inArray(users.id, userIds)),
      tx
        .select()
        .from(userAgentConfigs)
        .where(inArray(userAgentConfigs.userId, userIds)),
    ]);
    return { users: allUsers, configs: allConfigs };
  }, 'agent-tick-batch-user-agents');
}

export async function updateUserAgentConfigLastTickRunningStatus(
  userId: string,
  at: Date
): Promise<void> {
  await asSystem(
    async (tx) =>
      tx
        .update(userAgentConfigs)
        .set({
          lastTickAt: at,
          status: 'running',
          updatedAt: at,
        })
        .where(eq(userAgentConfigs.userId, userId)),
    'agent-tick-update-user-agent-config'
  );
}
