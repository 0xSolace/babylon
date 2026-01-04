/**
 * Babylon API DWS Worker - Self-Contained Bundle Entry Point
 *
 * This file uses relative imports to avoid workspace package resolution issues.
 * All imports are resolved relative to the source directory structure.
 */

// Use relative imports instead of workspace aliases
import { initializeDatabase } from '../../packages/db/src/index'
import {
  getDWSEndpoint,
  getNetworkName,
  getRpcUrl,
} from '../../packages/shared/src/config/index'
import { app as elysiaApp } from '../server/src/app'
import { setupEngineEvents } from '../server/src/engine-events'
import { toNetwork } from '../server/src/utils'

// Export the Elysia app for DWS worker invocation
export const app = elysiaApp

// Cloudflare Workers / workerd compatible fetch handler
export const fetch = elysiaApp.fetch.bind(elysiaApp)

// Default export for module workers
export default {
  fetch,
  async scheduled(
    event: ScheduledEvent,
    _env: WorkerEnv,
    _ctx: ExecutionContext,
  ) {
    // Handle cron triggers
    const cronName = event.cron
    const endpoint = CRON_MAP[cronName]
    if (endpoint) {
      const url = `http://localhost${endpoint}`
      const response = await fetch(new Request(url, { method: 'POST' }))
      if (!response.ok) {
        console.error(`Cron ${cronName} failed:`, await response.text())
      }
    }
  },
}

// Cron schedule to endpoint mapping
const CRON_MAP: Record<string, string> = {
  '*/5 * * * *': '/api/cron/game-tick',
  '0 * * * *': '/api/cron/resolve-markets',
  '*/2 * * * *': '/api/cron/agent-tick',
  '0 */6 * * *': '/api/cron/training-check',
}

// Types for Cloudflare Workers compatibility
interface ScheduledEvent {
  cron: string
  scheduledTime: number
}

interface WorkerEnv {
  [key: string]: string
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

/**
 * Initialize and start the Babylon API server (for Bun runtime)
 */
export async function startBabylonWorker(options: {
  port?: number
  host?: string
  rpcUrl?: string
  dwsEndpoint?: string
}): Promise<void> {
  const PORT =
    options.port ??
    Number(process.env.PORT) ??
    Number(process.env.BABYLON_API_PORT) ??
    5009
  const HOST = options.host ?? process.env.HOST ?? '0.0.0.0'

  // Get network from config or env
  const network = toNetwork(
    (typeof process !== 'undefined' ? process.env.JEJU_NETWORK : undefined) ||
      getNetworkName() ||
      'localnet',
  )

  // Configure DWS endpoint from config
  const dwsEndpoint =
    options.dwsEndpoint ?? getDWSEndpoint(network) ?? 'http://localhost:4030'
  if (typeof process !== 'undefined') {
    process.env.JEJU_DWS_ENDPOINT = dwsEndpoint
  }

  // Configure RPC URL from config
  const rpcUrl = options.rpcUrl ?? getRpcUrl(network) ?? 'http://localhost:6546'
  if (typeof process !== 'undefined') {
    process.env.JEJU_RPC_URL = rpcUrl
  }

  console.log(`DWS endpoint: ${dwsEndpoint}`)
  console.log(`RPC URL: ${rpcUrl}`)

  // Initialize database
  console.log('Initializing database...')
  await initializeDatabase()
  console.log('Database initialized')

  // Set up engine event listeners
  setupEngineEvents()

  // Start the server
  elysiaApp.listen({ port: PORT, hostname: HOST })

  console.log(`
╔════════════════════════════════════════════════════════════╗
║            BABYLON API - DWS WORKER MODE                   ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running                                           ║
║  Port:   ${String(PORT).padEnd(47)}║
║  Host:   ${HOST.padEnd(47)}║
║  Mode:   ${(process.env.TEE_PROVIDER || 'local').padEnd(47)}║
╚════════════════════════════════════════════════════════════╝
`)
}

// Auto-start if running directly with Bun (not imported as module)
if (import.meta.main) {
  startBabylonWorker({})
}
