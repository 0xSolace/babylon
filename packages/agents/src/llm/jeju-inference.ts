/**
 * Jeju Inference Marketplace Client
 *
 * Routes ALL LLM inference through Jeju's decentralized compute marketplace.
 * NO FALLBACKS - Decentralized compute is required.
 *
 * Flow:
 * 1. Check marketplace for available providers
 * 2. Select cheapest/fastest provider for model
 * 3. Route request through provider's endpoint
 * 4. Settlement happens on-chain automatically
 */

import type { Address, Hex } from 'viem'

export interface JejuInferenceConfig {
  /** Jeju network: localnet | testnet | mainnet */
  network: 'localnet' | 'testnet' | 'mainnet'
  /** User's wallet address for billing */
  userAddress: Address
  /** Gateway URL (default: https://gateway.jeju.network) */
  gatewayUrl?: string
  /** Preferred model routing */
  preferredModels?: string[]
}

export interface InferenceProvider {
  address: Address
  endpoint: string
  models: string[]
  pricePerInputToken: bigint
  pricePerOutputToken: bigint
  latency: number // ms
  active: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface InferenceRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface InferenceResponse {
  id: string
  model: string
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  provider: Address
  settlement?: {
    requestHash: Hex
    signature: Hex
  }
}

// Model aliases -> actual model names
const MODEL_ALIASES: Record<string, string[]> = {
  'llama-70b': ['llama-3.1-70b-versatile', 'llama-3.1-70b-instant'],
  'llama-8b': ['llama-3.1-8b-instant', 'llama-3.2-8b-instant'],
  mixtral: ['mixtral-8x7b-32768'],
  'gpt-4': ['gpt-4o', 'gpt-4-turbo'],
  'gpt-4-mini': ['gpt-4o-mini'],
  claude: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
  'claude-haiku': ['claude-3-5-haiku-20241022'],
}

const GATEWAY_URLS: Record<'localnet' | 'testnet' | 'mainnet', string> = {
  localnet: 'http://localhost:4200',
  testnet: 'https://gateway.testnet.jeju.network',
  mainnet: 'https://gateway.jeju.network',
}

/**
 * Jeju Inference Client
 *
 * Decentralized LLM inference through the Jeju marketplace.
 */
export class JejuInference {
  private config: JejuInferenceConfig
  private gatewayUrl: string
  private providerCache: Map<string, InferenceProvider[]> = new Map()
  private cacheExpiry = 0

  constructor(config: JejuInferenceConfig) {
    this.config = config
    this.gatewayUrl = config.gatewayUrl ?? GATEWAY_URLS[config.network]
  }

  /**
   * List available inference providers from marketplace
   */
  async listProviders(model?: string): Promise<InferenceProvider[]> {
    // Check cache
    const now = Date.now()
    if (now < this.cacheExpiry && this.providerCache.has(model ?? 'all')) {
      return this.providerCache.get(model ?? 'all') ?? []
    }

    const url = new URL('/v1/providers', this.gatewayUrl)
    if (model) url.searchParams.set('model', model)

    const response = await fetch(url.toString(), {
      headers: { 'x-jeju-address': this.config.userAddress },
    })

    if (!response.ok) {
      throw new Error(`Gateway error: ${response.status}`)
    }

    const data = (await response.json()) as {
      providers: InferenceProvider[]
    }
    this.providerCache.set(model ?? 'all', data.providers)
    this.cacheExpiry = now + 60_000 // 1 minute cache

    return data.providers
  }

  /**
   * Get available models from marketplace
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.gatewayUrl}/v1/models`, {
      headers: { 'x-jeju-address': this.config.userAddress },
    })

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`)
    }

    const data = (await response.json()) as { data: Array<{ id: string }> }
    return data.data.map((m) => m.id)
  }

  /**
   * Run inference through Jeju marketplace
   * NO FALLBACKS - Jeju Compute is required
   */
  async inference(request: InferenceRequest): Promise<InferenceResponse> {
    // Resolve model aliases
    const resolvedModel = this.resolveModel(request.model)

    // Route through Jeju marketplace only
    return this.inferenceViaMarketplace({
      ...request,
      model: resolvedModel,
    })
  }

  /**
   * Route inference through Jeju marketplace
   */
  private async inferenceViaMarketplace(
    request: InferenceRequest,
  ): Promise<InferenceResponse> {
    const response = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': this.config.userAddress,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: request.stream ?? false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Marketplace inference failed: ${response.status}`)
    }

    const data = (await response.json()) as {
      id: string
      model: string
      choices: Array<{ message: { content: string } }>
      usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
      settlement?: {
        provider: Address
        requestHash: Hex
        signature: Hex
      }
    }

    return {
      id: data.id,
      model: data.model,
      content: data.choices[0]?.message?.content ?? '',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      provider: data.settlement?.provider ?? ('0x0' as Address),
      settlement: data.settlement
        ? {
            requestHash: data.settlement.requestHash,
            signature: data.settlement.signature,
          }
        : undefined,
    }
  }

  /**
   * Resolve model alias to actual model name
   */
  private resolveModel(model: string): string {
    const aliases = MODEL_ALIASES[model.toLowerCase()]
    if (aliases?.[0]) {
      return aliases[0]
    }
    return model
  }
}

/**
 * Create inference client with automatic network detection
 */
export function createJejuInference(
  config: Omit<JejuInferenceConfig, 'network'> & { network?: string },
): JejuInference {
  const network = (config.network ?? process.env.JEJU_NETWORK ?? 'localnet') as
    | 'localnet'
    | 'testnet'
    | 'mainnet'

  return new JejuInference({
    ...config,
    network,
  })
}
