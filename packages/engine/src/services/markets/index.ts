/**
 * Market Services - Server-side implementations
 *
 * Contains DB adapters and services for prediction and perpetual markets.
 * Import from @babylon/shared for client-safe types and pricing utilities.
 */

// Perpetual Markets
export { PerpDbAdapter } from './PerpDbAdapter'
export {
  PerpMarketService,
  type PriceUpdateSummary,
} from './PerpMarketService'
// Prediction Markets
export { PredictionDbAdapter } from './PredictionDbAdapter'
export { PredictionMarketService } from './PredictionMarketService'
