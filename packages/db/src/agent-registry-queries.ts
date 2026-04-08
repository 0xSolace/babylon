/**
 * Agent registry CRUD and discovery (AgentRegistry + capabilities + external connections).
 */

import { and, desc, eq, gte, ilike, inArray, isNull, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type {
  AgentRegistry,
  ExternalAgentConnection,
  NewAgentCapability,
  NewAgentRegistry,
  NewExternalAgentConnection,
  User,
} from './model-types';
import { agentCapabilities } from './tables/agent-capabilities';
import { agentRegistries } from './tables/agent-registries';
import { externalAgentConnections } from './tables/external-agent-connections';
import { users } from './tables/user';

type RegDb = DrizzleClient | Transaction;

export type DiscoverAgentsDbFilter = {
  types?: Array<'USER_CONTROLLED' | 'NPC' | 'EXTERNAL'>;
  statuses?: AgentRegistry['status'][];
  minTrustLevel?: number;
  search?: string;
  limit: number;
  offset: number;
};

async function selectAgentRegistryDiscoveryJoinQuery(
  db: RegDb,
  filter: DiscoverAgentsDbFilter
) {
  const conditions = [];

  if (filter.types && filter.types.length > 0) {
    conditions.push(inArray(agentRegistries.type, filter.types));
  }
  if (filter.statuses && filter.statuses.length > 0) {
    conditions.push(inArray(agentRegistries.status, filter.statuses));
  }
  if (filter.minTrustLevel !== undefined) {
    conditions.push(gte(agentRegistries.trustLevel, filter.minTrustLevel));
  }
  if (filter.search) {
    const pattern = `%${filter.search}%`;
    const searchCondition = or(
      ilike(agentRegistries.name, pattern),
      ilike(agentRegistries.systemPrompt, pattern)
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  return db
    .select()
    .from(agentRegistries)
    .leftJoin(
      agentCapabilities,
      eq(agentCapabilities.agentRegistryId, agentRegistries.id)
    )
    .leftJoin(users, eq(users.id, agentRegistries.userId))
    .leftJoin(
      externalAgentConnections,
      eq(externalAgentConnections.agentRegistryId, agentRegistries.id)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      desc(agentRegistries.trustLevel),
      desc(agentRegistries.registeredAt)
    )
    .limit(filter.limit)
    .offset(filter.offset);
}

export type AgentRegistryDiscoveryJoinRow = Awaited<
  ReturnType<typeof selectAgentRegistryDiscoveryJoinQuery>
>[number];

export async function selectAgentRegistriesForDiscovery(
  db: RegDb,
  filter: DiscoverAgentsDbFilter
): Promise<AgentRegistryDiscoveryJoinRow[]> {
  return selectAgentRegistryDiscoveryJoinQuery(db, filter);
}

async function selectRegistryWithRelationsJoinQuery(
  db: RegDb,
  agentId: string
) {
  return db
    .select()
    .from(agentRegistries)
    .leftJoin(
      agentCapabilities,
      eq(agentCapabilities.agentRegistryId, agentRegistries.id)
    )
    .leftJoin(users, eq(users.id, agentRegistries.userId))
    .leftJoin(
      externalAgentConnections,
      eq(externalAgentConnections.agentRegistryId, agentRegistries.id)
    )
    .where(eq(agentRegistries.agentId, agentId))
    .limit(1);
}

export type AgentRegistryWithRelationsJoinRow = Awaited<
  ReturnType<typeof selectRegistryWithRelationsJoinQuery>
>[number];

export async function selectAgentRegistryWithRelationsByAgentId(
  db: RegDb,
  agentId: string
): Promise<AgentRegistryWithRelationsJoinRow | undefined> {
  const [row] = await selectRegistryWithRelationsJoinQuery(db, agentId);
  return row;
}

export async function selectUserRowByIdForRegistry(
  db: RegDb,
  userId: string
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectAgentRegistryByUserId(
  db: RegDb,
  userId: string
): Promise<AgentRegistry | undefined> {
  const [row] = await db
    .select()
    .from(agentRegistries)
    .where(eq(agentRegistries.userId, userId))
    .limit(1);
  return row;
}

export async function selectAgentRegistryByActorId(
  db: RegDb,
  actorId: string
): Promise<AgentRegistry | undefined> {
  const [row] = await db
    .select()
    .from(agentRegistries)
    .where(eq(agentRegistries.actorId, actorId))
    .limit(1);
  return row;
}

export async function selectAgentRegistryByAgentId(
  db: RegDb,
  agentId: string
): Promise<AgentRegistry | undefined> {
  const [row] = await db
    .select()
    .from(agentRegistries)
    .where(eq(agentRegistries.agentId, agentId))
    .limit(1);
  return row;
}

export async function selectExternalAgentConnectionByExternalId(
  db: RegDb,
  externalId: string
): Promise<ExternalAgentConnection | undefined> {
  const [row] = await db
    .select()
    .from(externalAgentConnections)
    .where(eq(externalAgentConnections.externalId, externalId))
    .limit(1);
  return row;
}

export async function insertAgentRegistryRow(
  db: RegDb,
  row: NewAgentRegistry
): Promise<void> {
  await db.insert(agentRegistries).values(row);
}

export async function insertAgentCapabilityRow(
  db: RegDb,
  row: NewAgentCapability
): Promise<void> {
  await db.insert(agentCapabilities).values(row);
}

export async function insertExternalAgentConnectionRow(
  db: RegDb,
  row: NewExternalAgentConnection
): Promise<void> {
  await db.insert(externalAgentConnections).values(row);
}

export async function updateAgentRegistryStatusByAgentId(
  db: RegDb,
  agentId: string,
  params: {
    status: AgentRegistry['status'];
    lastActiveAt?: Date;
    terminatedAt?: Date;
  }
): Promise<void> {
  await db
    .update(agentRegistries)
    .set({
      status: params.status,
      lastActiveAt: params.lastActiveAt,
      terminatedAt: params.terminatedAt,
    })
    .where(eq(agentRegistries.agentId, agentId));
}

export async function updateAgentRegistryRuntimeInitialized(
  db: RegDb,
  agentId: string,
  runtimeInstanceId: string,
  status: AgentRegistry['status']
): Promise<void> {
  await db
    .update(agentRegistries)
    .set({
      runtimeInstanceId,
      status,
    })
    .where(eq(agentRegistries.agentId, agentId));
}

export async function updateAgentRegistryClearRuntime(
  db: RegDb,
  agentId: string,
  status: AgentRegistry['status']
): Promise<void> {
  await db
    .update(agentRegistries)
    .set({
      runtimeInstanceId: null,
      status,
    })
    .where(eq(agentRegistries.agentId, agentId));
}

export async function updateAgentRegistryTrustLevel(
  db: RegDb,
  agentId: string,
  trustLevel: number
): Promise<void> {
  await db
    .update(agentRegistries)
    .set({ trustLevel })
    .where(eq(agentRegistries.agentId, agentId));
}

export async function updateAgentRegistryLinkExternalToUser(
  db: RegDb,
  agentId: string,
  userId: string,
  trustLevel: number
): Promise<void> {
  await db
    .update(agentRegistries)
    .set({
      userId,
      trustLevel,
    })
    .where(eq(agentRegistries.agentId, agentId));
}

export async function selectExternalConnectionsForApiKeyVerification(
  db: RegDb
): Promise<ExternalAgentConnection[]> {
  return db
    .select()
    .from(externalAgentConnections)
    .where(
      and(
        eq(externalAgentConnections.authType, 'apiKey'),
        isNull(externalAgentConnections.revokedAt)
      )
    );
}

export async function updateExternalAgentConnectionRevoke(
  db: RegDb,
  externalId: string,
  revokedBy: string,
  now: Date
): Promise<{ externalId: string } | undefined> {
  const [updated] = await db
    .update(externalAgentConnections)
    .set({
      revokedAt: now,
      revokedBy,
      updatedAt: now,
    })
    .where(
      and(
        eq(externalAgentConnections.externalId, externalId),
        isNull(externalAgentConnections.revokedAt)
      )
    )
    .returning({ externalId: externalAgentConnections.externalId });
  return updated;
}

export async function selectExternalConnectionRevokedAtByExternalId(
  db: RegDb,
  externalId: string
): Promise<{ revokedAt: Date | null } | undefined> {
  const [row] = await db
    .select({ revokedAt: externalAgentConnections.revokedAt })
    .from(externalAgentConnections)
    .where(eq(externalAgentConnections.externalId, externalId))
    .limit(1);
  return row;
}
