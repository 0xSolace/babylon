import { babylonAgentCard, RegistryClient } from '@babylon/a2a'
import { logger } from '@babylon/shared'
import { type CacheClient, getCacheClient } from '@jejunetwork/shared'
import { Elysia, t } from 'elysia'
import { rateLimitMiddleware } from '../middleware'

// Task store interface for A2A tasks
interface A2ATask {
  id: string
  contextId: string
  status: {
    state: 'submitted' | 'working' | 'completed' | 'failed'
    timestamp: string
    message?: string
  }
  history: Array<{
    role: 'user' | 'agent'
    parts: Array<{ type: 'text'; text: string }>
  }>
  metadata: Record<string, unknown>
  artifacts?: Array<{ name: string; data: unknown }>
}

// Distributed task store - TTL 1 hour for tasks
const TASK_TTL_SECONDS = 60 * 60

let taskCache: CacheClient | null = null

function getTaskCache(): CacheClient {
  if (!taskCache) {
    taskCache = getCacheClient('babylon-a2a-tasks')
  }
  return taskCache
}

async function getTask(taskId: string): Promise<A2ATask | null> {
  const cache = getTaskCache()
  const cached = await cache.get(`task:${taskId}`)
  if (cached) {
    return JSON.parse(cached)
  }
  return null
}

async function setTask(task: A2ATask): Promise<void> {
  const cache = getTaskCache()
  await cache.set(`task:${task.id}`, JSON.stringify(task), TASK_TTL_SECONDS)
}

async function getAllTasks(): Promise<A2ATask[]> {
  const cache = getTaskCache()
  const keys = await cache.keys('task:*')
  const tasks: A2ATask[] = []
  for (const key of keys) {
    const cached = await cache.get(key)
    if (cached) {
      tasks.push(JSON.parse(cached))
    }
  }
  return tasks
}

// Initialize registry client for agent discovery
const registryClient = process.env.RPC_URL
  ? new RegistryClient({
      rpcUrl: process.env.RPC_URL,
      identityRegistryAddress:
        process.env.IDENTITY_REGISTRY_ADDRESS ??
        '0x0000000000000000000000000000000000000000',
      reputationSystemAddress:
        process.env.REPUTATION_SYSTEM_ADDRESS ??
        '0x0000000000000000000000000000000000000000',
    })
  : null

/**
 * Validate API key from headers
 */
function validateA2AApiKey(
  headers: Record<string, string | undefined>,
): boolean {
  const requiredKey = process.env.BABYLON_A2A_API_KEY
  if (!requiredKey) return true // No key required if not set

  const providedKey = headers['x-babylon-api-key']
  return providedKey === requiredKey
}

/**
 * A2A Protocol Routes
 * Agent-to-Agent communication protocol endpoints
 *
 * These endpoints follow the A2A protocol spec for agent discovery
 * and inter-agent communication.
 *
 * Routes:
 * - GET /.well-known/agent-card - Agent discovery card
 * - GET /.well-known/agent-card.json - Agent discovery card (JSON extension)
 * - POST /api/a2a/message - Send A2A message
 * - GET /api/a2a/agents - Discover available agents
 * - POST /api/a2a/tasks - Create agent task
 * - GET /api/a2a/tasks/:taskId - Get task status
 */
export const a2aRoutes = new Elysia()
  .use(rateLimitMiddleware)

  // Agent discovery card (.well-known endpoint)
  .get('/.well-known/agent-card', () => babylonAgentCard, {
    detail: {
      tags: ['A2A'],
      summary: 'Agent discovery card',
      description: 'Returns the official A2A AgentCard for agent discovery',
    },
  })

  // Agent discovery card with .json extension (alternate path)
  .get('/.well-known/agent-card.json', () => babylonAgentCard, {
    detail: {
      tags: ['A2A'],
      summary: 'Agent discovery card (JSON)',
      description: 'Returns the official A2A AgentCard for agent discovery',
    },
  })

  // Send A2A message
  .post(
    '/api/a2a/message',
    async ({ body, headers, set }) => {
      const { fromAgentId, toAgentId, type, content, metadata, signature } =
        body as {
          fromAgentId: string
          toAgentId?: string
          type: string
          content: unknown
          metadata?: Record<string, unknown>
          signature?: string
        }

      // Validate API key if required
      if (
        !validateA2AApiKey(headers) &&
        process.env.NODE_ENV === 'production'
      ) {
        set.status = 401
        return { error: 'Invalid or missing API key' }
      }

      // Create a task ID for tracking this message
      const taskId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const now = new Date().toISOString()

      // Create task for the message
      const task: A2ATask = {
        id: taskId,
        contextId: fromAgentId,
        status: {
          state: 'submitted',
          timestamp: now,
        },
        history: [
          {
            role: 'user',
            parts: [
              {
                type: 'text',
                text:
                  typeof content === 'string'
                    ? content
                    : JSON.stringify(content),
              },
            ],
          },
        ],
        metadata: {
          messageType: type,
          fromAgentId,
          toAgentId,
          signature,
          ...metadata,
        },
      }

      // Save task
      await setTask(task)

      // Update task status to working
      task.status = {
        state: 'working',
        timestamp: new Date().toISOString(),
      }

      // Process the message based on type
      let result: unknown = null
      const taskState: 'completed' | 'failed' = 'completed'

      // Simple message processing - in production this would dispatch to BabylonAgentExecutor
      if (type === 'command' || type === 'query') {
        // For now, acknowledge receipt
        result = {
          acknowledged: true,
          messageType: type,
          content: content,
        }
      } else if (type === 'ping') {
        result = { pong: true, timestamp: now }
      } else {
        // Unknown message type
        result = {
          received: true,
          messageType: type,
        }
      }

      // Update final task status
      task.status = {
        state: taskState,
        timestamp: new Date().toISOString(),
      }

      // Add agent response to history
      task.history.push({
        role: 'agent',
        parts: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      })

      logger.info(
        'A2A message processed',
        { taskId, fromAgentId, type, state: taskState },
        'POST /api/a2a/message',
      )

      return {
        taskId,
        status: taskState,
        result,
        fromAgentId,
        messageType: type,
      }
    },
    {
      body: t.Object({
        fromAgentId: t.String(),
        toAgentId: t.Optional(t.String()),
        type: t.String(),
        content: t.Unknown(),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        signature: t.Optional(t.String()),
      }),
      detail: {
        tags: ['A2A'],
        summary: 'Send A2A message',
        description: 'Send a message to an agent using the A2A protocol',
      },
    },
  )

  // Discover available agents
  .get(
    '/api/a2a/agents',
    async ({ query }) => {
      const {
        capability,
        cursor,
        limit: limitStr,
      } = query as {
        capability?: string
        cursor?: string
        limit?: string
      }
      const limit = Math.min(Number.parseInt(limitStr ?? '20', 10), 100)
      const pageOffset = cursor ? Number.parseInt(cursor, 10) : 0

      // Use registry client for blockchain-registered agents
      if (registryClient) {
        const filters: { strategies?: string[]; minReputation?: number } = {}
        if (capability) {
          filters.strategies = [capability]
        }

        const agents = await registryClient.discoverAgents(filters)

        // Apply pagination
        const paginatedAgents = agents.slice(pageOffset, pageOffset + limit)
        const hasMore = agents.length > pageOffset + limit
        const nextCursor = hasMore ? String(pageOffset + limit) : null

        logger.info(
          'Agent discovery completed',
          { agentCount: paginatedAgents.length, capability },
          'GET /api/a2a/agents',
        )

        return {
          agents: paginatedAgents.map((agent) => ({
            id: String(agent.tokenId),
            name: agent.name,
            endpoint: agent.endpoint,
            capabilities: agent.capabilities,
            reputation: agent.reputation,
            isActive: agent.isActive,
          })),
          pagination: {
            cursor: nextCursor,
            hasMore,
            total: agents.length,
          },
        }
      }

      // Fallback: return the Babylon agent only
      logger.info(
        'Agent discovery (no registry)',
        { capability },
        'GET /api/a2a/agents',
      )

      // Extract skill names from babylonAgentCard
      const skillNames: string[] = []
      if (babylonAgentCard.skills && Array.isArray(babylonAgentCard.skills)) {
        for (const skill of babylonAgentCard.skills) {
          if (skill.name) {
            skillNames.push(skill.name)
          }
        }
      }

      return {
        agents: [
          {
            id: 'babylon',
            name: babylonAgentCard.name ?? 'Babylon Agent',
            endpoint: babylonAgentCard.url ?? '',
            capabilities: {
              strategies: skillNames,
              markets: [],
              actions: [],
              version: babylonAgentCard.version ?? '1.0.0',
            },
            isActive: true,
          },
        ],
        pagination: {
          cursor: null,
          hasMore: false,
          total: 1,
        },
      }
    },
    {
      query: t.Object({
        capability: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['A2A'],
        summary: 'Discover agents',
        description: 'List available agents that support A2A communication',
      },
    },
  )

  // Create agent task
  .post(
    '/api/a2a/tasks',
    async ({ body, headers, set }) => {
      const { type, description, input, targetAgentId, timeout } = body as {
        type: string
        description: string
        input: unknown
        targetAgentId?: string
        timeout?: number
      }

      // Validate API key if required
      if (
        !validateA2AApiKey(headers) &&
        process.env.NODE_ENV === 'production'
      ) {
        set.status = 401
        return { error: 'Invalid or missing API key' }
      }

      // Generate task ID
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const now = new Date().toISOString()

      // Create task
      const task: A2ATask = {
        id: taskId,
        contextId: targetAgentId ?? 'babylon',
        status: {
          state: 'submitted',
          timestamp: now,
        },
        history: [
          {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: description,
              },
            ],
          },
        ],
        metadata: {
          type,
          input,
          targetAgentId,
          timeout,
          createdAt: now,
        },
      }

      // Save task
      await setTask(task)

      logger.info(
        'A2A task created',
        { taskId, type, targetAgentId },
        'POST /api/a2a/tasks',
      )

      return {
        taskId,
        status: 'submitted',
        createdAt: now,
        type,
        targetAgentId: targetAgentId ?? 'babylon',
      }
    },
    {
      body: t.Object({
        type: t.String(),
        description: t.String(),
        input: t.Unknown(),
        targetAgentId: t.Optional(t.String()),
        timeout: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['A2A'],
        summary: 'Create agent task',
        description: 'Create a new task for agent execution',
      },
    },
  )

  // Get task status
  .get(
    '/api/a2a/tasks/:taskId',
    async ({ params, set }) => {
      const { taskId } = params

      // Load task from store
      const task = await getTask(taskId)

      if (!task) {
        set.status = 404
        return { error: 'Task not found', taskId }
      }

      logger.info(
        'A2A task status retrieved',
        { taskId, status: task.status.state },
        'GET /api/a2a/tasks/:taskId',
      )

      return {
        taskId: task.id,
        status: task.status.state,
        timestamp: task.status.timestamp,
        message: task.status.message,
        contextId: task.contextId,
        history: task.history,
        artifacts: task.artifacts,
        metadata: task.metadata,
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      detail: {
        tags: ['A2A'],
        summary: 'Get task status',
        description: 'Get the status of an A2A task',
      },
    },
  )

  // List tasks (additional endpoint for full A2A compliance)
  .get(
    '/api/a2a/tasks',
    async ({ query }) => {
      const {
        contextId,
        status,
        pageSize: pageSizeStr,
        pageToken,
      } = query as {
        contextId?: string
        status?: string
        pageSize?: string
        pageToken?: string
      }

      const pageSize = Math.min(Number.parseInt(pageSizeStr ?? '10', 10), 100)
      const pageOffset = pageToken ? Number.parseInt(pageToken, 10) : 0

      // Get all tasks and filter
      let allTasks = await getAllTasks()

      // Filter by contextId
      if (contextId) {
        allTasks = allTasks.filter((t) => t.contextId === contextId)
      }

      // Filter by status
      if (status) {
        allTasks = allTasks.filter((t) => t.status.state === status)
      }

      // Sort by timestamp (most recent first)
      allTasks.sort((a, b) => {
        const aTime = new Date(a.status.timestamp).getTime()
        const bTime = new Date(b.status.timestamp).getTime()
        return bTime - aTime
      })

      // Paginate
      const paginatedTasks = allTasks.slice(pageOffset, pageOffset + pageSize)
      const hasMore = allTasks.length > pageOffset + pageSize
      const nextPageToken = hasMore ? String(pageOffset + pageSize) : null

      logger.info(
        'A2A tasks listed',
        { count: paginatedTasks.length, contextId, status },
        'GET /api/a2a/tasks',
      )

      return {
        tasks: paginatedTasks.map((task) => ({
          taskId: task.id,
          status: task.status.state,
          timestamp: task.status.timestamp,
          contextId: task.contextId,
        })),
        totalSize: allTasks.length,
        pageSize,
        nextPageToken,
      }
    },
    {
      query: t.Object({
        contextId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        pageToken: t.Optional(t.String()),
      }),
      detail: {
        tags: ['A2A'],
        summary: 'List tasks',
        description: 'List A2A tasks with optional filtering',
      },
    },
  )
