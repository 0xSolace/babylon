// @ts-nocheck - Elysia body type inference issues, needs refactoring
import { babylonAgentCard } from '@babylon/a2a'
import { Elysia, t } from 'elysia'
import { rateLimitMiddleware } from '../middleware'

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
    async ({ body }) => {
      // TODO: Implement A2A message handling
      // Use @babylon/a2a package for protocol handling
      return {
        todo: 'Implement A2A message handling',
        received: {
          from: body.fromAgentId,
          messageType: body.type,
        },
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
    async () => {
      // TODO: Implement agent discovery using query params (capability, cursor, limit)
      // List agents registered with the system that support A2A
      return {
        todo: 'Implement agent discovery',
        agents: [],
        pagination: {
          cursor: null,
          hasMore: false,
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
    async () => {
      // TODO: Implement task creation using body params
      // Create a task that can be executed by agents
      return {
        todo: 'Implement A2A task creation',
        taskId: `task_${Date.now()}`,
        status: 'pending',
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
    async ({ params }) => {
      // TODO: Implement task status retrieval
      return {
        todo: 'Implement task status retrieval',
        taskId: params.taskId,
        status: 'unknown',
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
