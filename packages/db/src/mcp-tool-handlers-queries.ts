/**
 * SQL helpers for `packages/mcp` tool handlers (balance slice, NPC group membership checks).
 */

import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import type { User } from './tables/user';
import { users } from './tables/user';

type McpToolDb = DrizzleClient | Transaction;

export type McpUserBalanceSliceRow = Pick<
  User,
  'virtualBalance' | 'lifetimePnL'
>;

export async function selectMcpUserBalanceSlice(
  db: McpToolDb,
  userId: string
): Promise<McpUserBalanceSliceRow | undefined> {
  const [row] = await db
    .select({
      virtualBalance: users.virtualBalance,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

/** Active NPC group memberships for a user (for MCP invite acceptance limit). */
export async function selectActiveNpcGroupIdsForUser(
  db: McpToolDb,
  userId: string
): Promise<{ groupId: string }[]> {
  return db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.isActive, true),
        eq(groups.type, 'npc')
      )
    );
}
