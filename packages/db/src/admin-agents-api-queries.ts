/**
 * Admin API SQL for autonomous agent bulk actions (`apps/web` admin routes).
 */

import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { agentLogs } from './tables/agent-logs';
import { users } from './tables/user';
import { userAgentConfigs } from './tables/user-agent-configs';

/** Admin routes use `asSystem` / `asUser`, which pass a full `DrizzleClient` (not raw `Transaction`). */
type AdminAgentsApiDb = DrizzleClient;

export async function updateUserAgentConfigAutonomousModeByUserId(
  db: AdminAgentsApiDb,
  userId: string,
  enabled: boolean
): Promise<void> {
  await db
    .update(userAgentConfigs)
    .set({
      autonomousTrading: enabled,
      autonomousPosting: enabled,
      autonomousCommenting: enabled,
      autonomousDMs: enabled,
      autonomousGroupChats: enabled,
      status: enabled ? 'running' : 'paused',
      updatedAt: new Date(),
    })
    .where(eq(userAgentConfigs.userId, userId));
}

/**
 * Select agent user IDs with `virtualBalance >= 1`, then re-enable core autonomous flags and status.
 * Returns the user IDs that were updated.
 */
export async function resumeAutonomousAgentsWithVirtualBalanceGteOne(
  db: AdminAgentsApiDb
): Promise<string[]> {
  const eligibleAgents = await db
    .select({ userId: userAgentConfigs.userId })
    .from(userAgentConfigs)
    .innerJoin(users, eq(userAgentConfigs.userId, users.id))
    .where(gte(sql`CAST(${users.virtualBalance} AS NUMERIC)`, 1));

  const ids = eligibleAgents.map((a) => a.userId);
  if (ids.length === 0) {
    return ids;
  }

  await db
    .update(userAgentConfigs)
    .set({
      autonomousTrading: true,
      autonomousPosting: true,
      autonomousCommenting: true,
      status: 'running',
      updatedAt: new Date(),
    })
    .where(inArray(userAgentConfigs.userId, ids));

  return ids;
}

/** Emergency: disable autonomous flags on every agent config row. */
export async function pauseAllUserAgentConfigsEmergency(
  db: AdminAgentsApiDb
): Promise<void> {
  await db.update(userAgentConfigs).set({
    autonomousTrading: false,
    autonomousPosting: false,
    autonomousCommenting: false,
    autonomousDMs: false,
    autonomousGroupChats: false,
    status: 'idle',
    updatedAt: new Date(),
  });
}

/**
 * Data for `GET /api/admin/agents`: agents + configs, metrics, creators, 24h log aggregates.
 */
export async function fetchAdminAgentsListDashboardData(
  db: AdminAgentsApiDb,
  since: Date
) {
  const agentsWithConfigs = await db
    .select({
      user: users,
      config: userAgentConfigs,
    })
    .from(users)
    .leftJoin(userAgentConfigs, eq(users.id, userAgentConfigs.userId))
    .where(eq(users.isAgent, true))
    .orderBy(desc(userAgentConfigs.lastTickAt));

  const agents = agentsWithConfigs.map((a) => a.user);
  const agentIds = agents.map((a) => a.id);

  const performanceMetrics =
    agentIds.length === 0
      ? []
      : await db.agentPerformanceMetrics.findMany({
          where: { userId: { in: agentIds } },
        });

  const creatorIds = agents
    .map((a) => a.managedBy)
    .filter((id): id is string => Boolean(id));

  const creators =
    creatorIds.length === 0
      ? []
      : await db.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, displayName: true, username: true },
        });

  const logCounts = await db
    .select({
      agentUserId: agentLogs.agentUserId,
      _count: count(),
    })
    .from(agentLogs)
    .where(gte(agentLogs.createdAt, since))
    .groupBy(agentLogs.agentUserId);

  const errorCounts = await db
    .select({
      agentUserId: agentLogs.agentUserId,
      _count: count(),
    })
    .from(agentLogs)
    .where(and(gte(agentLogs.createdAt, since), eq(agentLogs.level, 'error')))
    .groupBy(agentLogs.agentUserId);

  return {
    agentsWithConfigs,
    performanceMetrics,
    creators,
    logCounts,
    errorCounts,
  };
}
