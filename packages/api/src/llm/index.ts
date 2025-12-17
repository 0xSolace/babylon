/**
 * LLM Module
 *
 * Decentralized inference through Jeju Compute.
 * NO FALLBACKS to centralized providers.
 */

export {
  callLLM,
  getInference,
  InferenceClient,
  type InferenceMessage,
  type InferenceModel,
  type InferenceParams,
  type InferenceResult,
  initializeInference,
  resetInference,
} from './inference-client';
