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

// Import the Babylon API server app
import { app } from '@babylon/server'

export default app

// Export fetch handler for Cloudflare Workers compatibility
export const fetch = app.fetch

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
