/**
 * Common Type Definitions
 *
 * Re-exports shared types from @babylon/shared for common patterns.
 * Engine-specific types that don't exist in shared are defined here.
 */

// Re-export common types from @babylon/shared
export type {
  ApiResponse,
  ErrorLike,
  FilterParams,
  JsonRpcParams,
  JsonRpcResult,
  JsonValue,
  LogData,
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  SortOrder,
  SortParams,
  StringRecord,
} from '@babylon/shared';

/**
 * WebSocket message data payload (engine-specific)
 */
export interface WebSocketData {
  type: string;
  payload?: import('@babylon/shared').JsonValue;
  timestamp?: string;
  [key: string]: import('@babylon/shared').JsonValue | undefined;
}

/**
 * LLM response wrapper (engine-specific)
 */
export interface LLMResponse<T = import('@babylon/shared').JsonValue> {
  content: string;
  parsed?: T;
  raw?: string;
  metadata?: {
    model?: string;
    tokens?: number;
    temperature?: number;
  };
}
