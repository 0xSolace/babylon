/**
 * Storage Provider Factory
 *
 * Creates and configures storage providers based on the specified mode.
 */

import { JsonStorageProvider } from './adapters/json';
import { PostgresStorageProvider } from './adapters/postgres/postgres-storage-provider';
import type {
  IStorageProvider,
  StorageProviderConfig,
} from './ports/storage-provider';
import { setStorageProvider } from './ports/storage-provider';

/**
 * Create a storage provider based on configuration.
 *
 * @example
 * ```typescript
 * // For simulation/training (no database needed)
 * const provider = await createStorageProvider({
 *   mode: 'json',
 *   jsonBasePath: './simulation-data',
 * });
 *
 * // For production (CQL - decentralized)
 * const provider = await createStorageProvider({ mode: 'cql' });
 * ```
 */
export async function createStorageProvider(
  config: StorageProviderConfig
): Promise<IStorageProvider> {
  let provider: IStorageProvider;

  switch (config.mode) {
    case 'json':
      provider = new JsonStorageProvider(config);
      break;
    case 'memory':
      // Memory mode uses JSON provider without persistence
      provider = new JsonStorageProvider({
        ...config,
        persistOnChange: false,
      });
      break;
    case 'cql':
      // CQL not yet implemented - use Postgres as fallback
      provider = new PostgresStorageProvider();
      break;
    case 'postgres':
      provider = new PostgresStorageProvider();
      break;
    default:
      throw new Error(`Unknown storage mode: ${config.mode as string}`);
  }

  // Initialize and set as global provider
  await provider.initialize();
  setStorageProvider(provider);

  return provider;
}

/**
 * Create a JSON storage provider for simulation.
 * Convenience function with sensible defaults.
 */
export async function createSimulationStorage(
  basePath = './simulation-data'
): Promise<IStorageProvider> {
  return createStorageProvider({
    mode: 'json',
    jsonBasePath: basePath,
    persistOnChange: true,
  });
}

/**
 * Create an in-memory storage provider for testing.
 * Data is not persisted to disk.
 */
export async function createTestStorage(): Promise<IStorageProvider> {
  return createStorageProvider({
    mode: 'memory',
    persistOnChange: false,
  });
}
