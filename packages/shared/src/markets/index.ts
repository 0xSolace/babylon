/**
 * Babylon Markets - Shared Types and Utilities
 *
 * Client-safe market code that can run in the browser.
 * For server-side services, import from @babylon/engine.
 */

// Prediction pricing (pure math, no db deps)
export {
  calculateBuy,
  calculateBuyWithFees,
  calculateExpectedPayout,
  calculateSell,
  calculateSellWithFees,
  getCurrentPrice,
  initializeMarket,
  PredictionPricing,
  type ShareCalculation,
  type ShareCalculationWithFees,
} from './prediction-pricing'

// Market types and schemas
export * from './types'
