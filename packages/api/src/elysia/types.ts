/**
 * Elysia Types
 *
 * Shared types for Elysia plugins and routes
 */

import type { AuthenticatedUser } from '@babylon/shared';

/**
 * Context with authentication utilities
 */
export interface AuthContext {
  authToken: string | undefined;
  authenticate(): Promise<AuthenticatedUser>;
  optionalAuth(): Promise<AuthenticatedUser | null>;
}

/**
 * Context with authenticated user
 */
export interface AuthenticatedContext extends AuthContext {
  user: AuthenticatedUser;
}

/**
 * Context with optional user
 */
export interface OptionalAuthContext extends AuthContext {
  user: AuthenticatedUser | null;
}

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = Record<string, unknown>> {
  success: true;
  data?: T;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success?: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  items: T[];
  total?: number;
  limit: number;
  offset?: number;
  cursor?: string | null;
  hasMore: boolean;
}

