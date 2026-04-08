/**
 * SQL for agent plugin actions (LOOKUP_USER) and test-agent utilities in `packages/agents`.
 */

import { eq, ilike, inArray, like, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { NewUser, NewUserAgentConfig } from './model-types';
import type { User } from './tables/user';
import { users } from './tables/user';
import { userAgentConfigs } from './tables/user-agent-configs';

type AgentPluginDb = DrizzleClient | Transaction;

export type AgentLookupUserRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  isAgent: boolean | null;
  profileImageUrl: string | null;
  bio: string | null;
};

export async function searchUsersForAgentLookup(
  db: AgentPluginDb,
  searchTerm: string,
  limit: number
): Promise<AgentLookupUserRow[]> {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      isAgent: users.isAgent,
      profileImageUrl: users.profileImageUrl,
      bio: users.bio,
    })
    .from(users)
    .where(
      or(
        ilike(users.username, `%${searchTerm}%`),
        ilike(users.displayName, `%${searchTerm}%`)
      )
    )
    .limit(limit);
}

export async function selectUserFullRowByUsername(
  db: AgentPluginDb,
  username: string
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row;
}

export async function selectFirstUserFullRowByUsernameLike(
  db: AgentPluginDb,
  pattern: string
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(like(users.username, pattern))
    .limit(1);
  return row;
}

export async function insertTestAgentUserReturningFull(
  db: AgentPluginDb,
  row: NewUser
): Promise<User> {
  const [created] = await db.insert(users).values(row).returning();
  if (!created) {
    throw new Error('insertTestAgentUserReturningFull: insert returned no row');
  }
  return created;
}

export async function insertUserAgentConfigForTestAgent(
  db: AgentPluginDb,
  row: NewUserAgentConfig
): Promise<void> {
  await db.insert(userAgentConfigs).values(row);
}

export async function listUserIdsByUsernameLike(
  db: AgentPluginDb,
  pattern: string
): Promise<{ id: string }[]> {
  return db
    .select({ id: users.id })
    .from(users)
    .where(like(users.username, pattern));
}

export async function deleteUserAgentConfigsForUserIds(
  db: AgentPluginDb,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;
  await db
    .delete(userAgentConfigs)
    .where(inArray(userAgentConfigs.userId, userIds));
}

export async function deleteUsersByUsernameLikeReturningIds(
  db: AgentPluginDb,
  pattern: string
): Promise<{ id: string }[]> {
  return db
    .delete(users)
    .where(like(users.username, pattern))
    .returning({ id: users.id });
}
