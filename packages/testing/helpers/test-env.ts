/**
 * Test Environment Helper
 *
 * Provides utility functions for integration tests to check service availability
 * and initialize the test environment properly.
 *
 * Usage:
 *   import { ensureTestEnv, isServiceAvailable, skipIfNoService } from '../helpers/test-env'
 *
 *   describe.skipIf(!await isServiceAvailable('sqlit'))('My Test Suite', () => {
 *     beforeAll(async () => {
 *       await ensureTestEnv()
 *     })
 *     // ...
 *   })
 */

export type ServiceName =
  | 'sqlit'
  | 'dws'
  | 'chain'
  | 'oauth3'
  | 'storage'
  | 'kms'

const SERVICE_ENDPOINTS: Record<
  ServiceName,
  { url: string; healthPath: string }
> = {
  sqlit: {
    url: process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4661',
    healthPath: '/health',
  },
  dws: {
    url: process.env.JEJU_DWS_ENDPOINT ?? 'http://localhost:4030',
    healthPath: '/health',
  },
  chain: {
    url: process.env.JEJU_RPC_URL ?? 'http://localhost:6546',
    healthPath: '', // RPC uses JSON-RPC call
  },
  oauth3: {
    url: process.env.OAUTH3_URL ?? 'http://localhost:4200',
    healthPath: '/health',
  },
  storage: {
    url: process.env.STORAGE_URL ?? 'http://localhost:5004',
    healthPath: '/api/v0/id',
  },
  kms: {
    url: process.env.KMS_URL ?? 'http://localhost:5012',
    healthPath: '/health',
  },
}

/**
 * Check if a specific service is available
 */
export async function isServiceAvailable(
  service: ServiceName,
): Promise<boolean> {
  const config = SERVICE_ENDPOINTS[service]

  try {
    if (service === 'chain') {
      // Chain uses JSON-RPC
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    }

    const response = await fetch(`${config.url}${config.healthPath}`, {
      method: config.healthPath.includes('/api/v0') ? 'POST' : 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Check if all specified services are available
 */
export async function areServicesAvailable(
  services: ServiceName[],
): Promise<boolean> {
  const results = await Promise.all(services.map(isServiceAvailable))
  return results.every(Boolean)
}

/**
 * Get availability status for all services
 */
export async function getServiceStatus(): Promise<
  Record<ServiceName, boolean>
> {
  const services: ServiceName[] = [
    'sqlit',
    'dws',
    'chain',
    'oauth3',
    'storage',
    'kms',
  ]
  const results = await Promise.all(services.map(isServiceAvailable))

  return services.reduce(
    (acc, service, index) => {
      acc[service] = results[index] ?? false
      return acc
    },
    {} as Record<ServiceName, boolean>,
  )
}

/**
 * Helper to skip test if service is not available
 */
export function skipIfNoService(service: ServiceName): () => boolean {
  return () => {
    // This is evaluated at test definition time, so we need a sync check
    // Use the cached service status
    return !_cachedServiceStatus[service]
  }
}

// Cache service status at module load
let _cachedServiceStatus: Record<ServiceName, boolean> = {
  sqlit: false,
  dws: false,
  chain: false,
  oauth3: false,
  storage: false,
  kms: false,
}

// Initialize cache
;(async () => {
  _cachedServiceStatus = await getServiceStatus()
})()

/**
 * Check if LLM API key is configured
 */
export function hasLLMKey(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.INFERENCE_API_KEY,
  )
}

/**
 * Check if contracts are deployed
 */
export function hasContracts(): boolean {
  return Boolean(
    process.env.BABYLON_DIAMOND_ADDRESS || process.env.BABYLON_TOKEN_ADDRESS,
  )
}

/**
 * Ensure test environment is properly configured
 */
export async function ensureTestEnv(): Promise<{
  sqlitAvailable: boolean
  dwsAvailable: boolean
  chainAvailable: boolean
  dbInitialized: boolean
}> {
  // Set default environment variables
  process.env.NODE_ENV = 'test'
  process.env.BUN_ENV = 'test'
  process.env.JEJU_NETWORK = process.env.JEJU_NETWORK ?? 'localnet'
  process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT =
    process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4661'
  process.env.JEJU_DWS_ENDPOINT =
    process.env.JEJU_DWS_ENDPOINT ?? 'http://localhost:4030'

  const sqlitAvailable = await isServiceAvailable('sqlit')
  const dwsAvailable = await isServiceAvailable('dws')
  const chainAvailable = await isServiceAvailable('chain')

  let dbInitialized = false

  if (sqlitAvailable) {
    try {
      const { initializeDatabase } = await import('@babylon/db')
      await initializeDatabase()
      dbInitialized = true
    } catch (error) {
      console.warn('[TestEnv] Database initialization failed:', error)
    }
  }

  return {
    sqlitAvailable,
    dwsAvailable,
    chainAvailable,
    dbInitialized,
  }
}

/**
 * Pre-computed service availability for use in describe.skipIf
 */
export const services = {
  sqlit: await isServiceAvailable('sqlit'),
  dws: await isServiceAvailable('dws'),
  chain: await isServiceAvailable('chain'),
  oauth3: await isServiceAvailable('oauth3'),
  storage: await isServiceAvailable('storage'),
  kms: await isServiceAvailable('kms'),
  hasLLM: hasLLMKey(),
  hasContracts: hasContracts(),
}
