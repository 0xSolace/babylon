/**
 * Bundle Entry Point for Babylon DWS Worker
 *
 * This file is the actual entry point for the bundled worker.
 * It imports the main worker module and explicitly starts it.
 *
 * The separate entry point avoids race conditions where multiple
 * async operations from module initialization could interfere
 * with the server startup.
 */

import { startBabylonWorker } from './dws-worker'

// Export everything from the main worker for DWS/workerd compatibility
export * from './dws-worker'

// Start the server immediately when this entry point runs
startBabylonWorker({})
