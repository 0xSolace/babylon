import { initializeDatabase } from '@babylon/db'
import { type App, app } from './app'
import { setupEngineEvents } from './engine-events'
import { toNetwork } from './utils'

export type { App }

const PORT =
  Number(process.env.PORT) || Number(process.env.BABYLON_API_PORT) || 5009
const HOST = process.env.HOST || '0.0.0.0'

async function startServer(): Promise<void> {
  // Ensure DWS endpoint is set for @jejunetwork/db
  if (!process.env.JEJU_DWS_ENDPOINT) {
    const network = toNetwork(process.env.JEJU_NETWORK || 'localnet')

    try {
      const { getDWSUrl } = await import('@jejunetwork/config')
      process.env.JEJU_DWS_ENDPOINT = getDWSUrl(network)
    } catch {
      // Fallback for local development
      process.env.JEJU_DWS_ENDPOINT = 'http://localhost:4030'
    }
    console.log(`DWS endpoint: ${process.env.JEJU_DWS_ENDPOINT}`)
  }

  // Initialize database before starting server
  try {
    console.log('Initializing database...')
    await initializeDatabase()
    console.log('✅ Database initialized')
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
    console.error(
      'Make sure EQLite and DWS are running and EQLITE_BLOCK_PRODUCER_ENDPOINT is set',
    )
    if (
      String(error).includes('4028') ||
      String(error).includes('ConnectionRefused')
    ) {
      console.error(
        'DWS connection failed - ensure DWS is running on port 4030',
      )
      console.error(
        `Current JEJU_DWS_ENDPOINT: ${process.env.JEJU_DWS_ENDPOINT}`,
      )
    }
    process.exit(1)
  }

  // Set up engine event listeners
  setupEngineEvents()

  app.listen({ port: PORT, hostname: HOST })

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    BABYLON API SERVER                       ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running                                            ║
║  Port:   ${String(PORT).padEnd(48)}║
║  Host:   ${HOST.padEnd(48)}║
║  Docs:   http://${HOST}:${PORT}/docs${' '.repeat(27)}║
╚════════════════════════════════════════════════════════════╝
`)

  console.log('Environment:', process.env.NODE_ENV || 'development')
  console.log('')
  console.log('Available routes:')
  console.log('  GET  /health            - Health check')
  console.log('  GET  /docs              - API documentation')
  console.log('  GET  /api/users/me      - Current user profile')
  console.log('  GET  /api/markets/*     - Market endpoints')
  console.log('  GET  /api/agents/*      - Agent endpoints')
  console.log('  GET  /api/chats/*       - Chat endpoints')
  console.log('  GET  /api/posts         - Feed/posts endpoints')
  console.log('  GET  /api/admin/*       - Admin endpoints')
  console.log('  POST /api/cron/*        - Cron triggers')
  console.log('  GET  /api/realtime/*    - SSE/realtime')
  console.log('  *    /api/a2a/*         - A2A protocol')
  console.log('  *    /api/mcp/*         - MCP protocol')
  console.log('  WS   /ws/realtime       - WebSocket realtime')
  console.log('')
}

startServer()

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...')
  process.exit(0)
})
