/**
 * Babylon Storage Abstraction Layer
 *
 * Provides database-agnostic storage interfaces with multiple backend support:
 * - CQL (production, decentralized CovenantSQL)
 * - JSON files (simulation, training, debugging)
 * - In-memory (testing, benchmarking)
 *
 * Usage:
 * ```typescript
 * import { createStorageProvider, getStorageProvider } from '@babylon/core/storage';
 *
 * // Initialize with JSON mode for simulation
 * const provider = await createStorageProvider({ mode: 'json', jsonBasePath: './simulation-data' });
 *
 * // Or use CQL mode for production (decentralized)
 * const provider = await createStorageProvider({ mode: 'cql' });
 *
 * // Access through global context
 * const posts = await getStorageProvider().posts.getRecentPosts();
 * ```
 */

// Adapters
export * from './adapters';
// Factory functions
export * from './factory';
// Ports (interfaces)
export * from './ports';
// Types
export * from './types';
