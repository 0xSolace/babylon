/**
 * Production guards to prevent simulated code from running in prod.
 */

import { logger } from '@babylon/shared'

const isProduction = process.env.NODE_ENV === 'production'
const forceSimulation = process.env.FORCE_SIMULATION === 'true'

export function isProductionMode(): boolean {
  return isProduction && !forceSimulation
}

/** Throws if simulated code runs in production */
function _requireRealImplementation(feature: string): void {
  if (isProductionMode()) {
    throw new Error(`${feature} requires real implementation in production`)
  }
}

/** Warns about simulation in production without throwing */
function _warnSimulationInProduction(feature: string): void {
  if (isProductionMode()) {
    logger.warn(`⚠️ ${feature} using simulated implementation in production`)
  }
}
