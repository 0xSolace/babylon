/**
 * LLM Integrations
 *
 * ALL LLM inference routes through Jeju Compute marketplace.
 *
 * FOR AGENTS (autonomous services):
 * - callAgentLLM() - Routes through Jeju Compute
 * - Uses decentralized inference with TEE support
 * - On-chain settlement and micropayments
 *
 * FOR CORE GAME (MarketDecisionEngine, etc.):
 * - Uses BabylonLLMClient (in @babylon/engine)
 * - Routes through Jeju Compute
 *
 * RL Training Loop:
 * - Agents use trained models via callAgentLLM()
 * - Generate trajectory data
 * - Training pipeline trains new model
 * - Deploy to Jeju network
 * - Agents use new model
 */

// Jeju inference marketplace (decentralized LLM routing) - from @jejunetwork/agents
export {
  createJejuInference,
  type InferenceProvider,
  type InferenceRequest,
  type InferenceResponse,
  type JejuChatMessage,
  JejuInference,
  type JejuInferenceConfig,
} from '@jejunetwork/agents'
// Agent LLM (routes through Jeju Compute)
export * from './agent-llm'

// Jeju provider (alternative interface)
export * from './jeju-provider'

// Ollama provider (for local development with self-hosted models)
export * from './ollama-provider'
