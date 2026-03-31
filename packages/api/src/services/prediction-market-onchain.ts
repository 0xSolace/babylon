/**
 * Re-export from @babylon/engine for backward compatibility.
 *
 * The canonical implementation now lives in packages/engine/src/services/onchain-prediction-service.ts.
 * This shim ensures existing consumers importing from '@babylon/api' continue to work.
 */
export {
  getOnChainPredictionMarketService,
  getPredictionMarketKey,
  OnChainPredictionMarketService,
  type OnchainPredictionMarketSnapshot,
  type OnchainPredictionOutcome,
} from '@babylon/engine';
