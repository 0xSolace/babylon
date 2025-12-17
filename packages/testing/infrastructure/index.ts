/**
 * Test Infrastructure
 *
 * Exports setup utilities, health checks, and contract management.
 * All services are managed by Jeju CLI - no Docker Compose fallback.
 *
 * To start services: cd /path/to/jeju && bun run dev
 */

export * from './contracts';
export * from './health-check';
export * from './setup';
