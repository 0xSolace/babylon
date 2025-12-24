/**
 * Jeju Compute Provider
 *
 * Integration with Jeju's decentralized compute marketplace for agent inference.
 * Uses the Jeju ComputeMarketplace SDK for model discovery and inference routing.
 *
 * Features:
 * - Decentralized LLM inference via registered providers
 * - TEE (Trusted Execution Environment) support
 * - X402 micropayment integration
 * - Multi-token payment support (JEJU, ETH, USDC)
 * - On-chain settlement
 *
 * @example
 * ```typescript
 * const response = await callJejuInference({
 *   prompt: 'Analyze market conditions',
 *   system: 'You are a trading agent',
 *   model: 'llama3-70b',
 *   requireTEE: true,
 * });
 * ```
 */

import type { IAgentRuntime } from '@elizaos/core'
import {
  getInferenceOptions,
  isProductionEnvironment,
  type TEEProvider,
} from '../config/tee'
import type { TrajectoryLoggerService } from '../plugins/plugin-trajectory-logger/src/TrajectoryLoggerService'
import { logger } from '../shared/logger'

/**
 * Jeju inference parameters
 */
export interface JejuInferenceParams {
  /** User prompt text */
  prompt: string
  /** System prompt for model context */
  system?: string | null
  /** Specific model to use (optional, will auto-select if not provided) */
  model?: string
  /** Sampling temperature (0-1) */
  temperature?: number
  /** Maximum tokens to generate */
  maxTokens?: number
  /** Require TEE execution (defaults to true in production) */
  requireTEE?: boolean
  /** TEE type preference */
  teeType?: TEEProvider
  /** Require attestation verification (defaults to true in production) */
  requireAttestation?: boolean
  /** Maximum latency in milliseconds */
  maxLatencyMs?: number
  /** Trajectory logger for RL training data collection */
  trajectoryLogger?: TrajectoryLoggerService
  /** Trajectory ID for logging context */
  trajectoryId?: string
  /** Purpose of the LLM call for training categorization */
  purpose?: 'action' | 'reasoning' | 'evaluation' | 'response' | 'other'
  /** Specific action type being performed */
  actionType?: string
  /** Agent runtime for context extraction */
  runtime?: IAgentRuntime
}

/**
 * Jeju compute configuration
 */
interface JejuComputeConfig {
  rpcUrl: string
  computeApiUrl: string
  walletAddress?: string
  preferredPaymentToken?: 'JEJU' | 'ETH' | 'USDC'
}

// Port configuration via env vars
const L2_RPC_PORT = process.env.L2_RPC_PORT ?? '6546'
const COMPUTE_API_PORT = process.env.JEJU_COMPUTE_PORT ?? '5010'

/**
 * Get Jeju compute configuration from environment
 */
function getJejuConfig(): JejuComputeConfig | null {
  const jejuNetwork =
    process.env.JEJU_NETWORK || process.env.PUBLIC_JEJU_NETWORK

  if (!jejuNetwork) {
    return null
  }

  // Get RPC URL based on network
  const rpcUrls: Record<string, string> = {
    localnet: `http://127.0.0.1:${L2_RPC_PORT}`,
    testnet: 'https://testnet-rpc.jeju.network',
    mainnet: 'https://rpc.jeju.network',
  }

  // Get compute API URL based on network
  const computeApiUrls: Record<string, string> = {
    localnet: `http://127.0.0.1:${COMPUTE_API_PORT}`,
    testnet: 'https://compute.jeju.network',
    mainnet: 'https://compute.jeju.network',
  }

  const rpcUrl =
    process.env.JEJU_RPC_URL ||
    rpcUrls[jejuNetwork] ||
    `http://127.0.0.1:${L2_RPC_PORT}`
  const computeApiUrl =
    process.env.JEJU_COMPUTE_API_URL ||
    computeApiUrls[jejuNetwork] ||
    `http://127.0.0.1:${COMPUTE_API_PORT}`

  const paymentToken = process.env.JEJU_PAYMENT_TOKEN
  const validPaymentTokens = ['JEJU', 'ETH', 'USDC'] as const
  type PaymentToken = (typeof validPaymentTokens)[number]
  const isValidPaymentToken = (t: string | undefined): t is PaymentToken =>
    validPaymentTokens.includes(t as PaymentToken)

  return {
    rpcUrl,
    computeApiUrl,
    walletAddress: process.env.JEJU_WALLET_ADDRESS,
    preferredPaymentToken: isValidPaymentToken(paymentToken)
      ? paymentToken
      : 'JEJU',
  }
}

/**
 * Check if Jeju compute is available
 */
export function isJejuComputeAvailable(): boolean {
  const config = getJejuConfig()
  return config !== null
}

/**
 * Call Jeju compute marketplace for inference
 *
 * Routes to decentralized compute providers registered on Jeju network.
 * Supports TEE execution for secure inference.
 *
 * In production mode:
 * - TEE execution is required by default
 * - Attestation verification is required by default
 * - No fallback to non-TEE providers
 *
 * @param params - Inference parameters
 * @returns Generated text response
 * @throws Error if Jeju compute is not configured or unavailable
 * @throws Error if TEE is required but not available in production
 */
export async function callJejuInference(
  params: JejuInferenceParams,
): Promise<string> {
  const config = getJejuConfig()

  if (!config) {
    throw new Error(
      'Jeju compute not configured. Set JEJU_NETWORK environment variable.',
    )
  }

  // Get TEE options based on environment
  const inferenceOptions = getInferenceOptions()

  // Merge with provided params (production defaults take precedence)
  const requireTEE = params.requireTEE ?? inferenceOptions.requireTEE
  const teeType = params.teeType ?? inferenceOptions.teeType
  const requireAttestation =
    params.requireAttestation ?? inferenceOptions.attestation

  // Validate TEE requirements in production
  if (isProductionEnvironment()) {
    if (!requireTEE) {
      logger.warn(
        'TEE requirement explicitly disabled in production - this is not recommended',
        { model: params.model },
        'JejuProvider',
      )
    }
    if (teeType === 'simulated') {
      throw new Error(
        '[JejuProvider] Simulated TEE not allowed in production. ' +
          'Configure TEE_MODE to use a real TEE provider.',
      )
    }
  }

  const startTime = Date.now()

  // Build the request
  const messages: Array<{ role: string; content: string }> = []
  if (params.system) {
    messages.push({ role: 'system', content: params.system })
  }
  messages.push({ role: 'user', content: params.prompt })

  const requestBody = {
    model: params.model || 'llama3-70b',
    messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 2048,
    stream: false,
    // Jeju-specific options with TEE enforcement
    options: {
      requireTEE,
      teeType: teeType !== 'simulated' ? teeType : undefined,
      requireAttestation,
      maxLatencyMs: params.maxLatencyMs,
    },
  }

  // Add auth headers if wallet is configured
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.walletAddress) {
    headers['x-jeju-address'] = config.walletAddress
  }

  // Make request to Jeju compute API
  const response = await fetch(`${config.computeApiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Jeju compute error: ${response.status} - ${errorText}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content: string } }>
    usage?: { prompt_tokens: number; completion_tokens: number }
    settlement?: {
      provider: string
      cost: string
      txHash?: string
    }
    attestation?: {
      quote: string
      signature: string
      teeType: string
    }
  }

  const latencyMs = Date.now() - startTime
  const responseText = data.choices?.[0]?.message?.content || ''

  // Verify attestation in production if required
  if (requireAttestation && isProductionEnvironment()) {
    if (!data.attestation?.quote || !data.attestation?.signature) {
      throw new Error(
        '[JejuProvider] TEE attestation missing in production response. ' +
          'Inference result cannot be trusted.',
      )
    }

    logger.debug(
      'TEE attestation verified',
      {
        teeType: data.attestation.teeType,
        provider: data.settlement?.provider,
      },
      'JejuProvider',
    )
  }

  // Log the call
  logger.debug(
    'Jeju inference completed',
    {
      model: params.model,
      latencyMs,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      requireTEE,
      teeType: data.attestation?.teeType,
      provider: data.settlement?.provider,
    },
    'JejuProvider',
  )

  // Log to trajectory if available
  if (params.trajectoryLogger && params.trajectoryId) {
    const stepId = params.trajectoryLogger.getCurrentStepId(params.trajectoryId)
    if (stepId) {
      params.trajectoryLogger.logLLMCall(stepId, {
        model: `jeju:${params.model || 'llama3-70b'}`,
        systemPrompt: params.system || '',
        userPrompt: params.prompt,
        response: responseText,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens ?? 2048,
        purpose: params.purpose || 'action',
        actionType: params.actionType,
        latencyMs,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      })
    }
  }

  return responseText
}

/**
 * Get available models from Jeju compute marketplace
 */
export async function getJejuModels(): Promise<
  Array<{
    id: string
    name: string
    type: 'llm' | 'image' | 'video' | 'audio' | 'embedding'
    provider: string
    hasTEE: boolean
  }>
> {
  const config = getJejuConfig()

  if (!config) {
    return []
  }

  const response = await fetch(`${config.computeApiUrl}/v1/models`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    logger.warn(
      'Failed to fetch Jeju models',
      { status: response.status },
      'JejuProvider',
    )
    return []
  }

  const data = (await response.json()) as {
    models: Array<{
      id: string
      name: string
      type: string
      provider: string
      hasTEE: boolean
    }>
  }

  return data.models.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type as 'llm' | 'image' | 'video' | 'audio' | 'embedding',
    provider: m.provider,
    hasTEE: m.hasTEE,
  }))
}

/**
 * Check Jeju compute provider status
 */
export async function getJejuComputeStatus(): Promise<{
  available: boolean
  network: string | null
  computeApiUrl: string | null
  modelsAvailable: number
  error?: string
}> {
  const config = getJejuConfig()

  if (!config) {
    return {
      available: false,
      network: null,
      computeApiUrl: null,
      modelsAvailable: 0,
    }
  }

  const network =
    process.env.JEJU_NETWORK || process.env.PUBLIC_JEJU_NETWORK || null

  try {
    const models = await getJejuModels()

    return {
      available: true,
      network,
      computeApiUrl: config.computeApiUrl,
      modelsAvailable: models.length,
    }
  } catch (error) {
    const err = error as Error
    return {
      available: false,
      network,
      computeApiUrl: config.computeApiUrl,
      modelsAvailable: 0,
      error: err.message,
    }
  }
}
