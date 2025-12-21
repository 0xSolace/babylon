/**
 * Decentralized Inference Client
 *
 * Routes LLM inference through Jeju's decentralized compute network.
 * NO FALLBACKS to centralized providers (OpenAI, Anthropic).
 *
 * This replaces direct API calls to Claude/OpenAI with decentralized inference.
 */

import { logger } from '@babylon/shared';

// ============================================================================
// Types
// ============================================================================

export interface InferenceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InferenceParams {
  model: string;
  messages: InferenceMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface InferenceResult {
  id: string;
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface InferenceModel {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  pricePerInputToken: bigint;
  pricePerOutputToken: bigint;
  available: boolean;
}

// ============================================================================
// Decentralized Inference Client
// ============================================================================

class InferenceClient {
  private initialized = false;
  private walletAddress: string | null = null;
  private modelsCache: InferenceModel[] = [];
  private modelsCacheExpiry = 0;

  async initialize(walletAddress?: string): Promise<void> {
    if (this.initialized) return;

    this.walletAddress =
      walletAddress ?? process.env.BABYLON_WALLET_ADDRESS ?? null;

    // Load available models from Jeju compute registry
    await this.refreshModels();

    this.initialized = true;
    logger.info(
      '[Inference] Decentralized inference client initialized',
      {},
      'Inference'
    );
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        '[Inference] Client not initialized. Call initialize() first.'
      );
    }
  }

  async refreshModels(): Promise<void> {
    const endpoint =
      process.env.JEJU_INFERENCE_REGISTRY ??
      process.env.JEJU_RPC_URL ??
      'http://localhost:8545';

    // Query available inference providers from Jeju network
    const response = await fetch(`${endpoint}/inference/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(
        `[Inference] Failed to fetch models: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as { models: InferenceModel[] };
    if (!data.models) {
      throw new Error('[Inference] Invalid response: missing models array');
    }

    this.modelsCache = data.models;
    this.modelsCacheExpiry = Date.now() + 60000; // 1 minute cache
  }

  async listModels(): Promise<InferenceModel[]> {
    this.requireInitialized();

    if (Date.now() > this.modelsCacheExpiry) {
      await this.refreshModels();
    }

    return this.modelsCache.filter((m) => m.available);
  }

  async inference(params: InferenceParams): Promise<InferenceResult> {
    this.requireInitialized();

    const models = await this.listModels();
    const model = models.find(
      (m) => m.id === params.model || m.name === params.model
    );

    if (!model) {
      throw new Error(
        `[Inference] Model "${params.model}" not available. Available: ${models.map((m) => m.id).join(', ')}`
      );
    }

    const startTime = Date.now();

    const response = await fetch(`${model.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.walletAddress && { 'x-jeju-address': this.walletAddress }),
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 4096,
        stream: params.stream ?? false,
      }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout for long generations
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `[Inference] Request failed: ${response.status} - ${error}`
      );
    }

    const data = (await response.json()) as {
      id: string;
      model: string;
      choices: Array<{ message: { content: string } }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const latencyMs = Date.now() - startTime;

    logger.debug(
      '[Inference] Completed',
      {
        model: params.model,
        latencyMs,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      },
      'Inference'
    );

    const content = data.choices[0]?.message?.content;
    if (content === undefined) {
      throw new Error('[Inference] Invalid response: missing content');
    }

    return {
      id: data.id,
      model: data.model,
      content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  /**
   * Simple completion API for compatibility with existing code
   */
  async complete(params: {
    prompt: string;
    system?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const messages: InferenceMessage[] = [];

    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }
    messages.push({ role: 'user', content: params.prompt });

    const result = await this.inference({
      model: params.model ?? 'llama-3.2-70b',
      messages,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    return result.content;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let inferenceInstance: InferenceClient | null = null;

export function getInference(): InferenceClient {
  if (!inferenceInstance) {
    inferenceInstance = new InferenceClient();
  }
  return inferenceInstance;
}

export async function initializeInference(
  walletAddress?: string
): Promise<InferenceClient> {
  const client = getInference();
  await client.initialize(walletAddress);
  return client;
}

export function resetInference(): void {
  inferenceInstance = null;
}

export { InferenceClient };

// ============================================================================
// Convenience Functions (replacement for callClaudeDirect)
// ============================================================================

/**
 * Drop-in replacement for callClaudeDirect that uses decentralized inference
 */
export async function callLLM(params: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const client = getInference();
  if (!client.isInitialized()) {
    await client.initialize();
  }
  return client.complete(params);
}
