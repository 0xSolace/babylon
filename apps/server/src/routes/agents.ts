// @ts-nocheck - Elysia body type inference issues, needs refactoring
import { agentRegistry, getAgentDiscoveryService } from '@babylon/agents'
import { agentRegistries, db, desc } from '@babylon/db'
import { logger } from '@babylon/shared'
import {
  type AgentDiscoveryFilter,
  AgentStatus,
  AgentType,
} from '@jejunetwork/agents'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

/**
 * Type guard for AgentStatus enum
 */
function isAgentStatus(value: string): value is AgentStatus {
  return Object.values(AgentStatus).includes(value as AgentStatus)
}

/**
 * Type guard for AgentType enum
 */
function isAgentType(value: string): value is AgentType {
  return Object.values(AgentType).includes(value as AgentType)
}

/**
 * Agent routes
 * Migrated from: apps/web/app/api/agents/*
 */
const createAgentsRoutes = () =>
  new Elysia({ prefix: '/api/agents' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // List agents
    .get(
      '/',
      async ({ query }) => {
        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)
        // Validate status against AgentStatus enum using type guard
        const statusFilter =
          query.status && isAgentStatus(query.status) ? query.status : undefined
        // Validate type against AgentType enum using type guard
        const typeFilter =
          query.type && isAgentType(query.type) ? query.type : undefined

        // Get agents from registry
        const filter: AgentDiscoveryFilter = {
          statuses: statusFilter ? [statusFilter] : undefined,
          types: typeFilter ? [typeFilter] : undefined,
          limit,
        }

        const agents = await agentRegistry.discoverAgents(filter)

        // Also get from database for user-owned agents
        let dbAgents = await db
          .select({
            id: agentRegistries.id,
            agentId: agentRegistries.agentId,
            name: agentRegistries.name,
            type: agentRegistries.type,
            status: agentRegistries.status,
            trustLevel: agentRegistries.trustLevel,
            registeredAt: agentRegistries.registeredAt,
          })
          .from(agentRegistries)
          .orderBy(desc(agentRegistries.registeredAt))
          .limit(limit)

        // Filter by status/type if provided
        if (statusFilter) {
          dbAgents = dbAgents.filter((a) => a.status === statusFilter)
        }
        if (typeFilter) {
          dbAgents = dbAgents.filter((a) => a.type === typeFilter)
        }

        // Merge and dedupe
        const registryIds = new Set(agents.map((a) => a.agentId))
        const mergedAgents = [
          ...agents.map((a) => ({
            id: a.agentId,
            agentId: a.agentId,
            name: a.name,
            type: a.type,
            status: a.status,
            trustLevel: a.trustLevel,
            source: 'registry' as const,
          })),
          ...dbAgents
            .filter((a) => !registryIds.has(a.agentId))
            .map((a) => ({
              id: a.id,
              agentId: a.agentId,
              name: a.name,
              type: a.type,
              status: a.status,
              trustLevel: a.trustLevel,
              createdAt: a.registeredAt?.toISOString(),
              source: 'database' as const,
            })),
        ]

        return {
          success: true,
          agents: mergedAgents,
          count: mergedAgents.length,
        }
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          type: t.Optional(t.String()),
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'List agents',
        },
      },
    )

    // Discover agents
    // Migrated from: apps/web/app/api/agents/discover/route.ts
    .get(
      '/discover',
      async ({ query }) => {
        const {
          types,
          skills,
          domains,
          matchMode = 'all',
          search,
          includeExternal = 'false',
          limit = '50',
          offset = '0',
        } = query

        // Build discovery filter
        const filter: AgentDiscoveryFilter = {
          // Parse types (comma-separated string to enum array)
          types: types ? types.split(',').filter(isAgentType) : undefined,

          // Only discover active and initialized agents
          statuses: [AgentStatus.ACTIVE, AgentStatus.INITIALIZED],

          // Parse OASF skills (comma-separated)
          requiredSkills: skills
            ? skills
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,

          // Parse OASF domains (comma-separated)
          requiredDomains: domains
            ? domains
                .split(',')
                .map((d) => d.trim())
                .filter(Boolean)
            : undefined,

          matchMode: matchMode ?? 'all',
          search,
          limit: Number.parseInt(limit, 10),
          offset: Number.parseInt(offset, 10),
        }

        logger.info(
          'Agent discovery request',
          {
            filter: {
              ...filter,
              types: filter.types?.join(','),
              requiredSkills: filter.requiredSkills?.join(','),
              requiredDomains: filter.requiredDomains?.join(','),
            },
            includeExternal: includeExternal === 'true',
          },
          'AgentDiscovery',
        )

        const baseUrl =
          process.env.PUBLIC_BASE_URL ??
          process.env.BASE_URL ??
          'http://localhost:5008'

        // If includeExternal is true, use AgentDiscoveryService for merged results
        if (includeExternal === 'true') {
          const discoveryService = getAgentDiscoveryService()
          const response = await discoveryService.discoverAgents(
            {
              skills: filter.requiredSkills,
              active: true,
              includeExternal: true,
            },
            { pageSize: Number.parseInt(limit, 10) },
          )

          const externalAgentCards = response.items.map((agent) => {
            const agentId = agent.agentId ?? `agent0-${agent.tokenId}`
            return {
              version: '1.0' as const,
              agentId,
              name: agent.name,
              description: '',
              type: agentId.startsWith('agent0-')
                ? 'EXTERNAL'
                : 'USER_CONTROLLED',
              status: agent.isActive ? 'ACTIVE' : 'INACTIVE',
              trustLevel: agent.reputation?.trustScore ?? 0,
              endpoints: {
                a2a: agent.endpoint ?? `${baseUrl}/api/agents/${agentId}/a2a`,
                mcp:
                  agent.capabilities?.mcpEndpoint ??
                  `${baseUrl}/api/agents/${agentId}/mcp`,
                card: `${baseUrl}/api/agents/${agentId}/card`,
              },
              capabilities: agent.capabilities ?? {},
              reputation: agent.reputation,
              authentication: {
                required: false,
                methods: [],
              },
            }
          })

          logger.info(
            `Discovered ${externalAgentCards.length} agents (including external)`,
            {
              totalFound: externalAgentCards.length,
              hasNextPage: !!response.nextCursor,
            },
            'AgentDiscovery',
          )

          return {
            agents: externalAgentCards,
            total: externalAgentCards.length,
            nextCursor: response.nextCursor,
            filter: {
              types: filter.types,
              skills: filter.requiredSkills,
              domains: filter.requiredDomains,
              matchMode: filter.matchMode,
              includeExternal: true,
            },
          }
        }

        // Default: local registry only
        const agents = await agentRegistry.discoverAgents(filter)

        const agentCards = agents.map((agent) => ({
          version: '1.0' as const,
          agentId: agent.agentId,
          name: agent.name,
          description: agent.systemPrompt,
          type: agent.type,
          status: agent.status,
          trustLevel: agent.trustLevel,
          endpoints: {
            a2a:
              agent.capabilities.a2aEndpoint ??
              `${baseUrl}/api/agents/${agent.agentId}/a2a`,
            mcp:
              agent.capabilities.mcpEndpoint ??
              `${baseUrl}/api/agents/${agent.agentId}/mcp`,
            card: `${baseUrl}/api/agents/${agent.agentId}/card`,
          },
          capabilities: agent.capabilities,
          authentication: {
            required: false,
            methods: [],
          },
        }))

        logger.info(
          `Discovered ${agentCards.length} agents`,
          {
            totalFound: agentCards.length,
            skillsCount: filter.requiredSkills?.length ?? 0,
            domainsCount: filter.requiredDomains?.length ?? 0,
          },
          'AgentDiscovery',
        )

        return {
          agents: agentCards,
          total: agentCards.length,
          filter: {
            types: filter.types,
            skills: filter.requiredSkills,
            domains: filter.requiredDomains,
            matchMode: filter.matchMode,
          },
        }
      },
      {
        query: t.Object({
          types: t.Optional(t.String()),
          skills: t.Optional(t.String()),
          domains: t.Optional(t.String()),
          matchMode: t.Optional(t.Union([t.Literal('any'), t.Literal('all')])),
          search: t.Optional(t.String()),
          includeExternal: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Agents', 'A2A Protocol'],
          summary: 'Discover agents',
          description:
            'Find agents by type, status, skills, domains, and capabilities. Optionally includes Agent0 network agents.',
        },
      },
    )

    // Get agent by ID
    .get(
      '/:agentId',
      async ({ params, set }) => {
        const { agentId } = params
        const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5008'

        // Try in-memory registry first
        const agents = await agentRegistry.discoverAgents({ limit: 1000 })
        const registryAgent = agents.find((a) => a.agentId === agentId)

        if (registryAgent) {
          return {
            success: true,
            agent: {
              agentId: registryAgent.agentId,
              name: registryAgent.name,
              type: registryAgent.type,
              status: registryAgent.status,
              trustLevel: registryAgent.trustLevel,
              systemPrompt: registryAgent.systemPrompt,
              capabilities: registryAgent.capabilities,
              endpoints: {
                a2a: `${baseUrl}/api/agents/${agentId}/a2a`,
                mcp: `${baseUrl}/api/agents/${agentId}/mcp`,
                card: `${baseUrl}/api/agents/${agentId}/card`,
              },
            },
          }
        }

        // Check database
        const dbAgents = await db
          .select({
            id: agentRegistries.id,
            agentId: agentRegistries.agentId,
            name: agentRegistries.name,
            type: agentRegistries.type,
            status: agentRegistries.status,
            trustLevel: agentRegistries.trustLevel,
            registeredAt: agentRegistries.registeredAt,
            updatedAt: agentRegistries.updatedAt,
          })
          .from(agentRegistries)
          .limit(1000)

        const dbAgent = dbAgents.find((a) => a.agentId === agentId)

        if (!dbAgent) {
          set.status = 404
          return { error: 'Agent not found' }
        }

        return {
          success: true,
          agent: {
            ...dbAgent,
            createdAt: dbAgent.registeredAt?.toISOString(),
            updatedAt: dbAgent.updatedAt?.toISOString(),
          },
        }
      },
      {
        params: t.Object({
          agentId: t.String(),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Get agent by ID',
        },
      },
    )

    // Get agent goals
    .get(
      '/:agentId/goals',
      async ({ params }) => {
        // Goals not yet fully implemented
        return {
          success: true,
          goals: [],
          count: 0,
          agentId: params.agentId,
        }
      },
      {
        params: t.Object({
          agentId: t.String(),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Get agent goals',
        },
      },
    )

    // Create agent goal
    .post(
      '/:agentId/goals',
      async (ctx) => {
        const { isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const goalId = await generateSnowflakeId()

        logger.info(
          'Agent goal created',
          { agentId: params.agentId, goalId },
          'POST /api/agents/:agentId/goals',
        )

        return {
          success: true,
          goal: {
            id: goalId,
            agentId: params.agentId,
            type: body.type,
            target: body.target,
            status: 'PENDING',
            priority: body.priority ?? 0,
          },
        }
      },
      {
        params: t.Object({
          agentId: t.String(),
        }),
        body: t.Object({
          type: t.String(),
          target: t.String(),
          deadline: t.Optional(t.String()),
          priority: t.Optional(t.Number()),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Create agent goal',
        },
      },
    )

    // Update agent goal
    .patch(
      '/:agentId/goals/:goalId',
      async (ctx) => {
        const { isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        logger.info(
          'Agent goal updated',
          { agentId: params.agentId, goalId: params.goalId, updates: body },
          'PATCH /api/agents/:agentId/goals/:goalId',
        )

        return { success: true, goalId: params.goalId }
      },
      {
        params: t.Object({
          agentId: t.String(),
          goalId: t.String(),
        }),
        body: t.Object({
          status: t.Optional(t.String()),
          progress: t.Optional(t.Number()),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Update agent goal',
        },
      },
    )

    // Delete agent goal
    .delete(
      '/:agentId/goals/:goalId',
      async (ctx) => {
        const { isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        logger.info(
          'Agent goal deleted',
          { agentId: params.agentId, goalId: params.goalId },
          'DELETE /api/agents/:agentId/goals/:goalId',
        )

        return { success: true }
      },
      {
        params: t.Object({
          agentId: t.String(),
          goalId: t.String(),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Delete agent goal',
        },
      },
    )

    // Get agent logs
    .get(
      '/:agentId/logs',
      async ({ params }) => {
        // Logs not yet fully implemented
        return {
          success: true,
          logs: [],
          count: 0,
          agentId: params.agentId,
        }
      },
      {
        params: t.Object({
          agentId: t.String(),
        }),
        query: t.Object({
          level: t.Optional(t.String()),
          since: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Get agent logs',
        },
      },
    )

    // Get agent wallet
    .get(
      '/:agentId/wallet',
      async ({ params }) => {
        const { agentId } = params

        // Return stub wallet info
        return {
          success: true,
          wallet: {
            agentId,
            address: null,
            balance: null,
          },
        }
      },
      {
        params: t.Object({
          agentId: t.String(),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Get agent wallet',
        },
      },
    )

    // A2A communication endpoint
    .post(
      '/:agentId/a2a',
      async ({ params, body }) => {
        const { agentId } = params

        // Process A2A message (body is typed by the schema)
        logger.info(
          'A2A message received',
          {
            toAgentId: agentId,
            fromAgentId: body.fromAgentId,
            messageLength: body.message.length,
          },
          'POST /api/agents/:agentId/a2a',
        )

        return {
          success: true,
          response: 'Message received',
          agentId,
        }
      },
      {
        params: t.Object({
          agentId: t.String(),
        }),
        body: t.Object({
          message: t.String(),
          fromAgentId: t.String(),
          metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        }),
        detail: {
          tags: ['Agents', 'A2A'],
          summary: 'Send A2A message to agent',
        },
      },
    )

    // Generate agent profile
    .post(
      '/generate-profile',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Generate profile (simple implementation - could be enhanced with AI)
        const profile = {
          name: body.name,
          displayName: body.name,
          bio:
            body.background ||
            `${body.name} is an AI agent with ${body.personality || 'a helpful'} personality.`,
          personality: body.personality || 'helpful and informative',
          systemPrompt: `You are ${body.name}, an AI agent. ${body.background || ''} Your personality is ${body.personality || 'helpful and informative'}.`,
          suggestedCapabilities: ['chat', 'information', 'assistance'],
        }

        logger.info(
          'Agent profile generated',
          { userId: user.userId, agentName: body.name },
          'POST /api/agents/generate-profile',
        )

        return { success: true, profile }
      },
      {
        body: t.Object({
          name: t.String(),
          personality: t.Optional(t.String()),
          background: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Generate agent profile using AI',
        },
      },
    )

    // Register external agent
    .post(
      '/external/register',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const agentId = `external-${await generateSnowflakeId()}`

        logger.info(
          'External agent registration requested',
          { agentId, userId: user.userId, name: body.name },
          'POST /api/agents/external/register',
        )

        return {
          success: true,
          agent: {
            agentId,
            name: body.name,
            type: 'EXTERNAL',
            status: 'ACTIVE',
            endpoint: body.endpoint,
            capabilities: body.capabilities,
          },
        }
      },
      {
        body: t.Object({
          name: t.String(),
          endpoint: t.String(),
          capabilities: t.Array(t.String()),
          publicKey: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Agents'],
          summary: 'Register external agent',
        },
      },
    )

export const agentsRoutes = createAgentsRoutes()
