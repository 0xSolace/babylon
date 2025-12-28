/**
 * MCP Request Handler
 *
 * Handles JSON-RPC 2.0 requests for MCP protocol methods
 * Similar to A2A's JsonRpcTransportHandler
 */

import { JsonValueSchema } from '@babylon/shared'
import type { JsonValue } from '@jejunetwork/shared'
import { z } from 'zod'
import { authenticateAgent } from '../auth/agent-auth'
import { getAvailableTools, getInitializeResult } from '../server/mcp-server'
import type {
  InitializeResult,
  JsonRpcResponse,
  MCPAuthContext,
  MCPProtocolVersion,
  ToolCallResult,
  ToolsListResult,
} from '../types/mcp'
import { MCPMethod } from '../types/mcp'
import { executeTool } from './tool-handlers'

/**
 * Type guard to check if an object has an 'id' property with a valid JSON-RPC id type
 */
function hasValidId(value: unknown): value is { id: string | number | null } {
  if (typeof value !== 'object' || value === null) return false
  if (!('id' in value)) return false
  const id = (value as Record<string, unknown>).id
  return typeof id === 'string' || typeof id === 'number' || id === null
}

/**
 * Extract request ID from raw request, returning null if not valid
 */
function extractRequestId(rawRequest: unknown): string | number | null {
  if (hasValidId(rawRequest)) {
    return rawRequest.id
  }
  return null
}

// JSON-RPC 2.0 Request Validation Schema
const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string().min(1),
  params: z.record(z.string(), JsonValueSchema).optional(),
  id: z.union([z.string(), z.number()]),
})

type ValidatedJsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>

// Initialize Params Validation Schema
// Using z.enum with tuple type for MCP protocol versions
const InitializeParamsSchema = z.object({
  protocolVersion: z.enum([
    '2024-11-05',
    '2025-03-26',
    '2025-06-18',
  ] satisfies readonly [MCPProtocolVersion, ...MCPProtocolVersion[]]),
  capabilities: z.object({
    roots: z.object({ listChanged: z.boolean().optional() }).optional(),
    sampling: z.record(z.string(), JsonValueSchema).optional(),
    tools: z.object({ listChanged: z.boolean().optional() }).optional(),
    prompts: z.object({ listChanged: z.boolean().optional() }).optional(),
    resources: z
      .object({
        subscribe: z.boolean().optional(),
        listChanged: z.boolean().optional(),
      })
      .optional(),
  }),
  clientInfo: z.object({
    name: z.string(),
    version: z.string(),
    title: z.string().optional(),
  }),
})

// Tool Call Params Validation Schema
const ToolCallParamsSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), JsonValueSchema),
})

/**
 * MCP Request Handler
 * Processes JSON-RPC 2.0 requests and routes to appropriate handlers
 */
export class MCPRequestHandler {
  private authContext: MCPAuthContext | null = null

  /**
   * Validate and handle JSON-RPC request
   * @param rawRequest - The raw request object (before validation)
   * @param authContext - Optional authentication context
   */
  async handle(
    rawRequest: unknown,
    authContext?: MCPAuthContext,
  ): Promise<
    JsonRpcResponse<
      InitializeResult | ToolsListResult | ToolCallResult | JsonValue
    >
  > {
    // Store auth context if provided
    if (authContext) {
      this.authContext = authContext
    }

    // Validate JSON-RPC request structure
    const parseResult = JsonRpcRequestSchema.safeParse(rawRequest)
    if (!parseResult.success) {
      const id = extractRequestId(rawRequest)
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32600,
          message: `Invalid JSON-RPC request: ${parseResult.error.message}`,
        },
      }
    }

    const request = parseResult.data

    // Route to appropriate handler based on method
    switch (request.method) {
      case MCPMethod.INITIALIZE:
        return await this.handleInitialize(request)
      case MCPMethod.PING:
        return await this.handlePing(request)
      case MCPMethod.TOOLS_LIST:
        return await this.handleToolsList(request)
      case MCPMethod.TOOLS_CALL:
        return await this.handleToolsCall(request)
      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        }
    }
  }

  /**
   * Handle initialize request with proper validation
   */
  private async handleInitialize(
    request: ValidatedJsonRpcRequest,
  ): Promise<JsonRpcResponse<InitializeResult>> {
    const parseResult = InitializeParamsSchema.safeParse(request.params)

    if (!parseResult.success) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: `Invalid initialize params: ${parseResult.error.message}`,
        },
      }
    }

    const params = parseResult.data

    // Get initialize result with validated protocol version
    const result = getInitializeResult(params.protocolVersion)

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    }
  }

  /**
   * Handle ping request
   */
  private async handlePing(
    request: ValidatedJsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const emptyResult: JsonValue = {}
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: emptyResult,
    }
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(
    request: ValidatedJsonRpcRequest,
  ): Promise<JsonRpcResponse<ToolsListResult>> {
    const tools = getAvailableTools()
    const result: ToolsListResult = {
      tools,
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    }
  }

  /**
   * Handle tools/call request with proper validation
   */
  private async handleToolsCall(
    request: ValidatedJsonRpcRequest,
  ): Promise<JsonRpcResponse<ToolCallResult>> {
    // Require authentication for tool calls
    if (!this.authContext) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32000, message: 'Authentication required' },
      }
    }

    const parseResult = ToolCallParamsSchema.safeParse(request.params)

    if (!parseResult.success) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: `Invalid tool call params: ${parseResult.error.message}`,
        },
      }
    }

    const params = parseResult.data

    // Authenticate agent using API key
    const agent = await authenticateAgent({
      apiKey: this.authContext.apiKey,
    })

    if (!agent) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32001, message: 'Authentication failed' },
      }
    }

    // Execute tool with validated arguments
    // params.arguments is already StringRecord<JsonValue> from Zod validation
    const toolResult = await executeTool(params.name, params.arguments, agent)

    // Convert tool result to MCP content format
    // MCPToolResult types are all JSON-serializable objects
    const content = this.convertToolResultToContent(toolResult)

    const result: ToolCallResult = {
      content,
      isError: false,
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    }
  }

  /**
   * Convert tool result to MCP content format
   * Formats results as readable text content
   */
  private convertToolResultToContent(
    toolResult: unknown,
  ): Array<{ type: 'text'; text: string }> {
    // Handle different result types
    if (typeof toolResult === 'string') {
      return [
        {
          type: 'text' as const,
          text: toolResult,
        },
      ]
    }

    if (typeof toolResult === 'object' && toolResult !== null) {
      // Format object results as readable JSON
      const formatted = JSON.stringify(toolResult, null, 2)
      return [
        {
          type: 'text' as const,
          text: formatted,
        },
      ]
    }

    // Fallback: convert to string
    return [
      {
        type: 'text' as const,
        text: String(toolResult),
      },
    ]
  }
}
