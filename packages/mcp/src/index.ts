/**
 * @packageDocumentation
 * @module @babylon/mcp
 *
 * MCP Protocol Implementation for Babylon
 *
 * Babylon implements the Model Context Protocol (MCP) following JSON-RPC 2.0 specification.
 * This package provides a complete MCP server implementation for agent discovery and tool execution.
 *
 * This package builds on @jejunetwork/mcp internally for shared utilities, while providing
 * Babylon-specific tool definitions, handlers, and server configuration.
 *
 * @example
 * ```typescript
 * import { MCPRequestHandler } from '@babylon/mcp';
 *
 * const handler = new MCPRequestHandler();
 * const response = await handler.handle({
 *   jsonrpc: '2.0',
 *   method: 'tools/list',
 *   id: 1
 * });
 * ```
 *
 * @see {@link https://modelcontextprotocol.io | MCP Specification}
 */

// Schema utilities from Jeju MCP
export {
  createToolFromSchema,
  createValidator,
  safeParse,
  validateArgs,
  zodSchemaToMCPSchema,
} from '@jejunetwork/mcp'
// Babylon-specific MCP exports
export * from './auth'
export * from './handlers'
export * from './server'
export * from './types'
export * from './utils'
