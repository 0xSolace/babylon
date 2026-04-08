/**
 * SQL for `packages/training` `ModelUsageVerifier` (trajectory + LLM log aggregates).
 */

import { and, count, eq, gte, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { llmCallLogs } from './tables/llm-call-logs';
import { trajectories } from './tables/trajectories';
import { users } from './tables/user';

type ModelUsageVerifierDb = DrizzleClient | Transaction;

export async function selectTrajectoryIdsForAgentUser(
  db: ModelUsageVerifierDb,
  agentId: string
): Promise<string[]> {
  const rows = await db
    .select({ trajectoryId: trajectories.trajectoryId })
    .from(trajectories)
    .where(eq(trajectories.agentId, agentId));
  return rows.map((r) => r.trajectoryId);
}

export async function countLlmCallLogsForTrajectoryIdsSince(
  db: ModelUsageVerifierDb,
  trajectoryIds: string[],
  since: Date
): Promise<number> {
  if (trajectoryIds.length === 0) return 0;
  const [row] = await db
    .select({ count: count() })
    .from(llmCallLogs)
    .where(
      and(
        gte(llmCallLogs.createdAt, since),
        inArray(llmCallLogs.trajectoryId, trajectoryIds)
      )
    );
  return Number(row?.count ?? 0);
}

export async function countUsersWhereIsAgent(
  db: ModelUsageVerifierDb
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isAgent, true));
  return Number(row?.count ?? 0);
}
