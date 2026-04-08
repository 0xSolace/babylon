/**
 * SQL helpers for resolving user-controlled agent rows (NPCs use engine StaticDataRegistry).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type AgentContextDb = DrizzleClient | Transaction;

export type UserAgentContextSliceRow = {
  id: string;
  displayName: string | null;
  isAgent: boolean | null;
  lifetimePnL: string | null;
};

export async function selectUserAgentContextSliceById(
  db: AgentContextDb,
  agentUserId: string
): Promise<UserAgentContextSliceRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      isAgent: users.isAgent,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, agentUserId))
    .limit(1);
  return row;
}

/** User fields needed by the Babylon goals provider (agent runtime). */
export type AgentGoalsProviderUserRow = {
  id: string;
  displayName: string | null;
  bio: string | null;
  managedBy: string | null;
  virtualBalance: string | null;
};

export async function selectAgentGoalsProviderUserById(
  db: AgentContextDb,
  agentUserId: string
): Promise<AgentGoalsProviderUserRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      bio: users.bio,
      managedBy: users.managedBy,
      virtualBalance: users.virtualBalance,
    })
    .from(users)
    .where(eq(users.id, agentUserId))
    .limit(1);
  return row;
}
