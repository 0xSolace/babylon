/**
 * Elysia API Framework
 *
 * @module @babylon/api/elysia
 *
 * Provides Elysia-based API infrastructure with:
 * - App factory for creating Elysia instances
 * - Authentication plugins (Privy + Agent sessions)
 * - Error handling plugin
 * - Request logging plugin
 * - OpenAPI documentation configuration
 *
 * Routes are assembled in the consuming application (apps/web) to avoid
 * circular dependencies with domain packages like @babylon/agents.
 *
 * @example
 * ```typescript
 * import { createApp, authPlugin, Elysia } from '@babylon/api/elysia';
 *
 * // Create app with plugins
 * const app = createApp('/api')
 *   .get('/health', () => ({ status: 'ok' }))
 *   .use(authPlugin)
 *   .get('/me', ({ authenticate }) => authenticate());
 * ```
 */

// ============================================================================
// App Factory
// ============================================================================

export { createApp, createRouter } from './app';

// ============================================================================
// Plugins
// ============================================================================

// Authentication
export {
  authPlugin,
  requireAuth,
  optionalAuthPlugin,
  requireAdmin,
  requireCronSecret,
} from './plugins/auth';

// Error handling
export { errorPlugin } from './plugins/error';

// Logging
export { loggingPlugin } from './plugins/logging';

// ============================================================================
// Types
// ============================================================================

export type {
  AuthContext,
  AuthenticatedContext,
  OptionalAuthContext,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedResponse,
} from './types';

// ============================================================================
// Re-exports
// ============================================================================

// Re-export Elysia for convenience
export { Elysia, t } from 'elysia';

