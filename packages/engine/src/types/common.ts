/**
 * Common Type Definitions
 *
 * Engine-specific types that don't exist in shared are defined here.
 */

export type { LogData } from '@babylon/shared'
export type { JsonValue } from '@jejunetwork/shared'

// Actor state from DB queries
export interface DbActorState {
  id: string
  name: string
  description?: string
  personality?: string
  bio?: string
  role?: string
  organizationId?: string
  isActive: boolean
  lastActiveAt?: number
  createdAt: number
}

// Common utility types
export type StringRecord = Record<string, string>

export type SortOrder = 'asc' | 'desc'

export interface SortParams {
  field: string
  order: SortOrder
}

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface FilterParams {
  [key: string]: string | number | boolean | null | undefined
}

export interface QueryParams extends PaginationParams {
  sort?: SortParams
  filter?: FilterParams
}

export interface ErrorLike {
  message: string
  code?: string | number
  details?: Record<string, unknown>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ErrorLike
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface JsonRpcParams {
  [key: string]: unknown
}

export interface JsonRpcResult<T = unknown> {
  jsonrpc: '2.0'
  id: string | number | null
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * WebSocket message data payload (engine-specific)
 */
export interface WebSocketData {
  type: string
  payload?: import('@babylon/shared').JsonValue
  timestamp?: string
  [key: string]: import('@babylon/shared').JsonValue | undefined
}

/**
 * LLM response wrapper (engine-specific)
 */
export interface LLMResponse<T = import('@babylon/shared').JsonValue> {
  content: string
  parsed?: T
  raw?: string
  metadata?: {
    model?: string
    tokens?: number
    temperature?: number
  }
}
