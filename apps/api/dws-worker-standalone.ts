/**
 * Babylon API DWS Worker - Standalone Entry Point
 * Self-contained worker for DWS deployment
 */

import { app as elysiaApp } from '../server/src/app'

// Export the Elysia app's fetch handler for workerd
export const fetch = elysiaApp.fetch.bind(elysiaApp)

// Default export for module workers
export default {
  fetch,
}

// Auto-start if running directly
if (import.meta.main) {
  const PORT = Number(process.env.PORT) || 5009
  const HOST = process.env.HOST || '0.0.0.0'

  elysiaApp.listen({ port: PORT, hostname: HOST })

  console.log(`
╔════════════════════════════════════════════════════════════╗
║            BABYLON API - DWS WORKER MODE                   ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running                                           ║
║  Port:   ${String(PORT).padEnd(47)}║
║  Host:   ${HOST.padEnd(47)}║
╚════════════════════════════════════════════════════════════╝
`)
}
