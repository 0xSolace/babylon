/**
 * MCP Request Handler
 *
 * Handles JSON-RPC 2.0 requests for MCP protocol methods
 * Similar to A2A's JsonRpcTransportHandler
 */

import {
  type JsonValue,
  JsonValueSchema,
  type StringRecord,
} from '@babylon/shared';
import { z } from 'zod';
import { authenticateAgent } from '../auth/agent-auth';
import { getAvailableTools, getInitializeResult } from '../server/mcp-server';
import type {
  JsonRpcError,
  JsonRpcResponse,
  JsonRpcResult,
  MCPAuthContext,
  MCPProtocolVersion,
  ToolCallResult,
  ToolsListResult,
} from '../types/mcp';
import { MCP_PROTOCOL_VERSIONS, MCPMethod } from '../types/mcp';
import { executeTool } from './tool-handlers';

// JSON-RPC 2.0 Request Validation Schema
const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string().min(1),
  params: z.record(z.string(), JsonValueSchema).optional(),
  id: z.union([z.string(), z.number()]),
});

type ValidatedJsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

// Initialize Params Validation Schema
const InitializeParamsSchema = z.object({
  protocolVersion: z.enum(
    MCP_PROTOCOL_VERSIONS as unknown as [string, ...string[]]
  ),
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
});

// Tool Call Params Validation Schema
const ToolCallParamsSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), JsonValueSchema),
});

/**
 * MCP Request Handler
 * Processes JSON-RPC 2.0 requests and routes to appropriate handlers
 */
export class MCPRequestHandler {
  private authContext: MCPAuthContext | null = null;

  /**
   * Validate and handle JSON-RPC request
   * @param rawRequest - The raw request object (before validation)
   * @param authContext - Optional authentication context
   */
  async handle(
    rawRequest: unknown,
    authContext?: MCPAuthContext
  ): Promise<JsonRpcResponse> {
    // Store auth context if provided
    if (authContext) {
      this.authContext = authContext;
    }

    // Validate JSON-RPC request structure
    const parseResult = JsonRpcRequestSchema.safeParse(rawRequest);
    if (!parseResult.success) {
      const id =
        typeof rawRequest === 'object' &&
        rawRequest !== null &&
        'id' in rawRequest
          ? (rawRequest as { id: string | number }).id
          : null;
      return this.createErrorResponse(
        id,
        -32600,
        `Invalid JSON-RPC request: ${parseResult.error.message}`
      );
    }

    const request = parseResult.data;

    // Route to appropriate handler based on method
    switch (request.method) {
      case MCPMethod.INITIALIZE:
        return await this.handleInitialize(request);
      case MCPMethod.PING:
        return await this.handlePing(request);
      case MCPMethod.TOOLS_LIST:
        return await this.handleToolsList(request);
      case MCPMethod.TOOLS_CALL:
        return await this.handleToolsCall(request);
      default:
        return this.createErrorResponse(
          request.id,
          -32601,
          `Method not found: ${request.method}`
        );
    }
  }

  /**
   * Handle initialize request with proper validation
   */
  private async handleInitialize(
    request: ValidatedJsonRpcRequest
  ): Promise<JsonRpcResponse> {
    const parseResult = InitializeParamsSchema.safeParse(request.params);

    if (!parseResult.success) {
      return this.createErrorResponse(
        request.id,
        -32602,
        `Invalid initialize params: ${parseResult.error.message}`
      );
    }

    const params = parseResult.data;

    // Get initialize result with validated protocol version
    const result = getInitializeResult(
      params.protocolVersion as MCPProtocolVersion
    );

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: result as unknown as JsonRpcResult,
    };
  }

  /**
   * Handle ping request
   */
  private async handlePing(
    request: ValidatedJsonRpcRequest
  ): Promise<JsonRpcResponse> {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {} as JsonValue,
    };
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(
    request: ValidatedJsonRpcRequest
  ): Promise<JsonRpcResponse> {
    const tools = getAvailableTools();
    const result: ToolsListResult = {
      tools,
    };

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: result as unknown as JsonRpcResult,
    };
  }

  /**
   * Handle tools/call request with proper validation
   */
  private async handleToolsCall(
    request: ValidatedJsonRpcRequest
  ): Promise<JsonRpcResponse> {
    // Require authentication for tool calls
    if (!this.authContext) {
      return this.createErrorResponse(
        request.id,
        -32000,
        'Authentication required'
      );
    }

    const parseResult = ToolCallParamsSchema.safeParse(request.params);

    if (!parseResult.success) {
      return this.createErrorResponse(
        request.id,
        -32602,
        `Invalid tool call params: ${parseResult.error.message}`
      );
    }

    const params = parseResult.data;

    // Authenticate agent using API key
    const agent = await authenticateAgent({
      apiKey: this.authContext.apiKey,
    });

    if (!agent) {
      return this.createErrorResponse(
        request.id,
        -32001,
        'Authentication failed'
      );
    }

    // Execute tool with validated arguments
    const toolResult = await executeTool(
      params.name,
      params.arguments as StringRecord<JsonValue>,
      agent
    );

    // Convert tool result to MCP content format
    const content = this.convertToolResultToContent(
      toolResult as unknown as JsonValue
    );

    const result: ToolCallResult = {
      content,
      isError: false,
    };

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: result as unknown as JsonRpcResult,
    };
  }

  /**
   * Convert tool result to MCP content format
   * Formats results as readable text content
   */
  private convertToolResultToContent(
    toolResult: JsonValue
  ): Array<{ type: 'text'; text: string }> {
    // Handle different result types
    if (typeof toolResult === 'string') {
      return [
        {
          type: 'text' as const,
          text: toolResult,
        },
      ];
    }

    if (typeof toolResult === 'object' && toolResult !== null) {
      // Format object results as readable JSON
      const formatted = JSON.stringify(toolResult, null, 2);
      return [
        {
          type: 'text' as const,
          text: formatted,
        },
      ];
    }

    // Fallback: convert to string
    return [
      {
        type: 'text' as const,
        text: String(toolResult),
      },
    ];
  }

  /**
   * Create JSON-RPC error response
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: JsonValue
  ): JsonRpcResponse {
    const error: JsonRpcError = {
      code,
      message,
      data,
    };

    return {
      jsonrpc: '2.0',
      id,
      error,
    };
  }
}
