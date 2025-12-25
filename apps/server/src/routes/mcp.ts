// @ts-nocheck - Elysia body type inference issues, needs refactoring
import type { JsonRpcRequest, MCPAuthContext } from '@babylon/mcp'
import {
  getAvailableTools,
  getMCPServerInfo,
  MCPRequestHandler,
} from '@babylon/mcp'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

/**
 * MCP Protocol Routes
 * Model Context Protocol server implementation
 *
 * Routes:
 * - GET /mcp - Server info and available tools (discovery)
 * - POST /mcp - JSON-RPC 2.0 endpoint
 * - GET /api/mcp/tools - List tools (REST-style)
 * - POST /api/mcp/tools/:toolName/execute - Execute tool (REST-style)
 * - GET /api/mcp/resources - List resources
 * - GET /api/mcp/resources/:resourceId - Get resource
 * - POST /api/mcp/prompts - Execute prompt
 */

// Initialize MCP request handler
const mcpHandler = new MCPRequestHandler()

/**
 * Extract authentication from request headers
 */
function extractAuthFromHeaders(headers: Headers): MCPAuthContext {
  const apiKey = headers.get('x-babylon-api-key')
  const authHeader = headers.get('authorization')
  const apiKeyFromAuth = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null

  const auth: MCPAuthContext = {}
  if (apiKey) {
    auth.apiKey = apiKey
  } else if (apiKeyFromAuth) {
    auth.apiKey = apiKeyFromAuth
  }
  return auth
}

// JSON-RPC routes at /mcp (no prefix)
const mcpJsonRpcRoutes = new Elysia()
  .use(rateLimitMiddleware)

  // GET /mcp - Server info and available tools (discovery)
  .get(
    '/mcp',
    () => {
      const serverInfo = getMCPServerInfo()
      const tools = getAvailableTools()
      return { ...serverInfo, tools }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'MCP server info',
        description: 'Returns MCP server information and available tools',
      },
    },
  )

  // POST /mcp - JSON-RPC 2.0 endpoint
  .post(
    '/mcp',
    async ({ body, request, set }) => {
      // Validate JSON-RPC 2.0 format
      if (body.jsonrpc !== '2.0') {
        set.status = 400
        return {
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32600,
            message: 'Invalid Request: jsonrpc must be "2.0"',
          },
        }
      }

      // Extract authentication
      const authContext = extractAuthFromHeaders(request.headers)

      // Require API key for POST requests
      if (!authContext.apiKey) {
        set.status = 401
        return {
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32001,
            message:
              'Authentication required: X-Babylon-Api-Key header is required',
          },
        }
      }

      // Handle request - construct JsonRpcRequest from validated body
      const rpcRequest: JsonRpcRequest = {
        jsonrpc: body.jsonrpc,
        method: body.method,
        params: body.params,
        id: body.id,
      }
      const response = await mcpHandler.handle(rpcRequest, authContext)
      return response
    },
    {
      body: t.Object({
        jsonrpc: t.String(),
        method: t.String(),
        params: t.Optional(t.Record(t.String(), t.Unknown())),
        id: t.Union([t.String(), t.Number()]),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'MCP JSON-RPC endpoint',
        description: 'Handles MCP JSON-RPC 2.0 requests',
      },
    },
  )

// REST-style API routes at /api/mcp
const mcpRestRoutes = new Elysia({ prefix: '/api/mcp' })
  .use(authMiddleware)
  .use(rateLimitMiddleware)

  // List available tools
  .get(
    '/tools',
    () => {
      const tools = getAvailableTools()
      return { tools }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'List MCP tools',
      },
    },
  )

  // Execute a tool
  .post(
    '/tools/:toolName/execute',
    async (ctx) => {
      const { isAuthenticated } = getAuthContext(ctx)
      const { params, body, set } = ctx
      if (!isAuthenticated) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      return {
        todo: 'Implement MCP tool execution',
        tool: params.toolName,
        input: body.input,
        result: null,
      }
    },
    {
      params: t.Object({
        toolName: t.String(),
      }),
      body: t.Object({
        input: t.Record(t.String(), t.Unknown()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'Execute MCP tool',
      },
    },
  )

  // List available resources
  .get(
    '/resources',
    async () => {
      return {
        resources: [
          {
            uri: 'babylon://markets',
            name: 'Prediction Markets',
            description: 'Access to prediction market data',
            mimeType: 'application/json',
          },
          {
            uri: 'babylon://agents',
            name: 'Agent Directory',
            description: 'Directory of active AI agents',
            mimeType: 'application/json',
          },
          {
            uri: 'babylon://feed',
            name: 'Social Feed',
            description: 'Access to the social feed',
            mimeType: 'application/json',
          },
        ],
        todo: 'Implement full MCP resources from @babylon/mcp',
      }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'List MCP resources',
      },
    },
  )

  // Get resource content
  .get(
    '/resources/:resourceId',
    async ({ params, query: _query }) => {
      return {
        todo: 'Implement MCP resource retrieval',
        resourceId: params.resourceId,
        content: null,
      }
    },
    {
      params: t.Object({
        resourceId: t.String(),
      }),
      query: t.Object({
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'Get MCP resource',
      },
    },
  )

  // Execute prompt template
  .post(
    '/prompts',
    async (ctx) => {
      const { isAuthenticated } = getAuthContext(ctx)
      const { body, set } = ctx
      if (!isAuthenticated) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      return {
        todo: 'Implement MCP prompt execution',
        prompt: body.name,
        arguments: body.arguments,
        result: null,
      }
    },
    {
      body: t.Object({
        name: t.String(),
        arguments: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'Execute MCP prompt',
      },
    },
  )

// Combined MCP routes export
const createMcpRoutes = () =>
  new Elysia().use(mcpJsonRpcRoutes).use(mcpRestRoutes)

export const mcpRoutes = createMcpRoutes()
