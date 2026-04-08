/**
 * User row slice for agent trade DM notifications.
 *
 * **Why here:** Keeps `users` `where` out of engine; notification formatting stays in engine.
 */

import { eq } from 'drizzle-orm';
import { asSystem } from './db';
import { users } from './tables/user';

export type AgentTradeNotificationAgentRow = {
  id: string;
  displayName: string | null;
  managedBy: string | null;
  isAgent: boolean;
};

export async function fetchAgentUserForTradeNotification(
  agentUserId: string
): Promise<AgentTradeNotificationAgentRow | null> {
  return asSystem(async (c) => {
    const [agent] = await c
      .select({
        id: users.id,
        displayName: users.displayName,
        managedBy: users.managedBy,
        isAgent: users.isAgent,
      })
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1);
    return agent ?? null;
  }, 'agent-trade-notification-lookup');
}
