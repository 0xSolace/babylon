/**
 * @packageDocumentation
 * @module @babylon/a2a
 *
 * A2A Protocol Implementation for Babylon
 *
 * Babylon implements the official A2A (Agent-to-Agent) protocol using @a2a-js/sdk.
 * All A2A operations use the standard message/send, tasks/get, and related methods
 * as defined in the A2A Protocol specification.
 *
 * This package provides Babylon-specific implementations like BabylonAgentExecutor and escrow handlers.
 * For core A2A functionality, import directly from @jejunetwork/a2a.
 *
 * @example
 * ```typescript
 * import { babylonAgentCard, BabylonAgentExecutor } from '@babylon/a2a';
 * import { A2AClient } from '@a2a-js/sdk/client';
 * import type { AgentProfile } from '@jejunetwork/a2a';
 *
 * const client = new A2AClient({
 *   endpoint: 'https://babylon.game/api/a2a',
 *   agentCard: babylonAgentCard
 * });
 * ```
 *
 * @see {@link https://github.com/a2a-js/sdk | A2A SDK Documentation}
 */

// Babylon-specific exports
export { babylonAgentCard } from './babylon-agent-card'
export { RegistryClient } from './blockchain/registry-client'
export { BabylonAgentExecutor } from './executors/babylon-executor'
export type { ListTasksParams, ListTasksResult } from './extended-task-store'
// Extended task store
export { ExtendedTaskStore } from './extended-task-store'
export * from './handlers/escrow-handlers'
// Agent card generator functions
export {
  generateAgentCard,
  generateAgentCardSync,
} from './sdk/agent-card-generator'
// Agent types
export type {
  AgentProfile,
  AgentReputation,
  JsonRpcParams,
  JsonRpcRequest,
  JsonRpcResponse,
} from './types/a2a'

// Re-export utilities from @jejunetwork/a2a
import type {
  ApiKeyAuthConfig,
  AuthRequest,
  AuthResult,
} from '@jejunetwork/a2a'
import {
  isLocalHost,
  RateLimiter,
  validateApiKey as validateApiKeyBase,
} from '@jejunetwork/a2a'

export type { ApiKeyAuthConfig, AuthRequest, AuthResult }
export { isLocalHost, RateLimiter }

// Babylon-specific API key header constant
export const A2A_API_KEY_HEADER = 'x-babylon-api-key'

// Babylon-specific API key getter (uses BABYLON_A2A_API_KEY env var)
export function getRequiredApiKey(): string | undefined {
  return process.env.BABYLON_A2A_API_KEY
}

// Babylon-specific validateApiKey wrapper with default header name
export function validateApiKey(
  request: AuthRequest,
  config: ApiKeyAuthConfig = {},
): AuthResult {
  return validateApiKeyBase(request, {
    ...config,
    headerName: config.headerName ?? A2A_API_KEY_HEADER,
  })
}
// Validation schemas
export {
  type BuySharesParams,
  BuySharesParamsSchema,
  type CreatePostParams,
  CreatePostParamsSchema,
  type DiscoverParams,
  DiscoverParamsSchema,
  type GetFeedParams,
  GetFeedParamsSchema,
  type OpenPositionParams,
  OpenPositionParamsSchema,
  type PaymentRequestParams,
  PaymentRequestParamsSchema,
  type SearchUsersParams,
  SearchUsersParamsSchema,
  type TransferPointsParams,
  TransferPointsParamsSchema,
} from './validation'
