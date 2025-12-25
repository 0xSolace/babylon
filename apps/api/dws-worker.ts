/**
 * Babylon API DWS Worker Entry Point
 *
 * This file serves as the entry point for Babylon's backend when deployed
 * on Jeju's Decentralized Web Services (DWS).
 *
 * The worker handles:
 * - API endpoints for the Babylon application
 * - Cron jobs for game tick, market resolution, agent actions
 * - WebSocket connections for real-time updates
 *
 * Deployment:
 * 1. Build: bun build apps/api/dws-worker.ts --outdir dist
 * 2. Upload: jeju storage upload dist/dws-worker.js
 * 3. Deploy: jeju deploy app babylon --target dws
 */

import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import type { Address } from 'viem'
import { createA2ARouter } from './routes/a2a/index.js'
import { createCronRouter } from './routes/cron/index.js'
// Import Babylon API routes
import { createAPIRouter } from './routes/index.js'
import { createMCPRouter } from './routes/mcp/index.js'

/**
 * DWS Worker Configuration
 * Populated from environment variables set during deployment
 */
interface DWSWorkerConfig {
  // Jeju Network
  chainId: number
  rpcUrl: string

  // Database (CovenantQL)
  databaseId: string
  cqlEndpoint: string

  // Cache
  cacheServiceUrl: string
  cacheNamespace: string

  // Storage (IPFS)
  storageServiceUrl: string
  ipfsGateway: string

  // KMS
  kmsServiceUrl: string
  kmsNamespace: string

  // OAuth3
  oauth3ServiceUrl: string
  oauth3AppId: string

  // Babylon-specific
  aiCeoAgentId: string
  treasuryAddress: Address
  agentVaultAddress: Address

  // MPC
  mpcParties: number
  mpcThreshold: number
}

/**
 * Get configuration from environment
 */
function getConfig(): DWSWorkerConfig {
  const chainId = parseInt(process.env.JEJU_CHAIN_ID ?? '420691', 10)
  const rpcUrl = process.env.JEJU_RPC_URL ?? 'http://localhost:8545'

  return {
    chainId,
    rpcUrl,
    databaseId: process.env.CQL_DATABASE_ID ?? 'babylon',
    cqlEndpoint:
      process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4661',
    cacheServiceUrl:
      process.env.JEJU_CACHE_SERVICE_URL ?? 'http://localhost:4015',
    cacheNamespace: process.env.CACHE_NAMESPACE ?? 'babylon',
    storageServiceUrl:
      process.env.JEJU_STORAGE_SERVICE_URL ?? 'http://localhost:5001',
    ipfsGateway: process.env.VITE_IPFS_GATEWAY ?? 'https://ipfs.babylon.game',
    kmsServiceUrl: process.env.JEJU_KMS_SERVICE_URL ?? 'http://localhost:4200',
    kmsNamespace: process.env.KMS_NAMESPACE ?? 'babylon',
    oauth3ServiceUrl:
      process.env.JEJU_OAUTH3_SERVICE_URL ?? 'http://localhost:4100',
    oauth3AppId: process.env.BABYLON_OAUTH3_APP_ID ?? 'babylon',
    aiCeoAgentId: process.env.AI_CEO_AGENT_ID ?? '1',
    treasuryAddress: (process.env.BABYLON_TREASURY_ADDRESS ?? '0x') as Address,
    agentVaultAddress: (process.env.BABYLON_AGENT_VAULT_ADDRESS ??
      '0x') as Address,
    mpcParties: parseInt(process.env.MPC_PARTIES ?? '5', 10),
    mpcThreshold: parseInt(process.env.MPC_THRESHOLD ?? '3', 10),
  }
}

/**
 * Create the Babylon DWS Worker
 */
export function createBabylonWorker(config: DWSWorkerConfig) {
  const app = new Elysia({ name: 'babylon-api' })
    .use(cors())
    .use(
      swagger({
        documentation: {
          info: {
            title: 'Babylon API',
            version: '2.0.0',
            description: 'Decentralized prediction markets and social game API',
          },
          tags: [
            { name: 'Markets', description: 'Prediction market endpoints' },
            { name: 'Social', description: 'Social features (posts, follows)' },
            { name: 'Agents', description: 'AI agent interactions' },
            { name: 'A2A', description: 'Agent-to-Agent protocol' },
            { name: 'MCP', description: 'Model Context Protocol' },
            { name: 'Cron', description: 'Scheduled tasks' },
          ],
        },
      }),
    )

    // Health check
    .get('/health', () => ({
      status: 'healthy',
      service: 'babylon-api',
      version: '2.0.0',
      chainId: config.chainId,
      database: config.databaseId,
      timestamp: Date.now(),
    }))

    // API routes
    .use(createAPIRouter(config))

    // Cron endpoints (called by DWS scheduler)
    .use(createCronRouter(config))

    // A2A Protocol
    .use(createA2ARouter(config))

    // MCP Protocol
    .use(createMCPRouter(config))

  return app
}

// Worker exports for DWS
const config = getConfig()
const worker = createBabylonWorker(config)

// Export default for workerd/Elysia
export default worker

// Export fetch handler for Cloudflare Workers compatibility
export const fetch = worker.fetch

/**
 * DWS Worker Manifest
 *
 * This configuration is used by `jeju deploy app babylon --target dws`
 */
export const DWS_MANIFEST = {
  name: 'babylon-api',
  version: '2.0.0',
  description: 'Babylon decentralized prediction markets API',

  // Runtime
  runtime: 'bun' as const,
  entrypoint: 'dws-worker.ts',
  memoryMb: 512,
  cpuMillis: 2000,
  timeoutMs: 30000,

  // Scaling
  scaling: {
    minInstances: 1,
    maxInstances: 10,
    targetConcurrency: 100,
    scaleToZero: false, // Keep at least one instance for cron jobs
    cooldownMs: 60000,
  },

  // Requirements
  requirements: {
    teeRequired: false, // Use TEE for sensitive operations via KMS
    gpuRequired: false,
    minNodeReputation: 70,
  },

  // Cron triggers (executed by DWS scheduler)
  cron: [
    {
      name: 'game-tick',
      schedule: '*/5 * * * *',
      endpoint: '/api/cron/game-tick',
      timeout: 30000,
    },
    {
      name: 'market-resolution',
      schedule: '0 * * * *',
      endpoint: '/api/cron/resolve-markets',
      timeout: 60000,
    },
    {
      name: 'agent-tick',
      schedule: '*/2 * * * *',
      endpoint: '/api/cron/agent-tick',
      timeout: 45000,
    },
    {
      name: 'training-check',
      schedule: '0 */6 * * *',
      endpoint: '/api/cron/training-check',
      timeout: 60000,
    },
    {
      name: 'health-check',
      schedule: '*/5 * * * *',
      endpoint: '/api/cron/health-check',
      timeout: 30000,
    },
  ],

  // Environment variables (non-sensitive)
  env: {
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
  },

  // KMS secrets to inject at runtime
  secrets: ['INFERENCE_API_KEY', 'TRAINING_CONFIG'],

  // Service dependencies
  dependencies: [
    'cql',
    'cache-service',
    'storage',
    'kms',
    'oauth3',
    'contracts',
    'compute',
  ],
}
