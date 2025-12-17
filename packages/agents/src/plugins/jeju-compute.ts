/**
 * Jeju Compute Plugin for ElizaOS
 *
 * Decentralized LLM inference through Jeju's compute marketplace.
 * NO FALLBACKS - Jeju Compute is required for all LLM operations.
 *
 * This replaces groq/anthropic/openai plugins with a single
 * decentralized inference provider.
 *
 * @packageDocumentation
 */

import type {
  DetokenizeTextParams,
  GenerateTextParams,
  IAgentRuntime,
  ModelTypeName,
  ObjectGenerationParams,
  Plugin,
  TokenizeTextParams,
} from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import { encodingForModel, type TiktokenModel } from 'js-tiktoken';
import type { Address } from 'viem';
import { logger } from '../shared/logger';
import { isPromptLoggingEnabled, logPrompt } from '../utils/prompt-logger';
import type { TrajectoryLoggerService } from './plugin-trajectory-logger/src/TrajectoryLoggerService';

// Jeju Compute gateway URLs by network
const JEJU_GATEWAY_URLS: Record<'localnet' | 'testnet' | 'mainnet', string> = {
  localnet: 'http://localhost:4200',
  testnet: 'https://gateway.testnet.jeju.network',
  mainnet: 'https://gateway.jeju.network',
};

// Default models for small/large inference
const DEFAULT_MODELS = {
  small: 'llama-3.1-8b-instant',
  large: 'llama-3.1-70b-versatile',
};

interface JejuComputeResponse {
  id: string;
  model: string;
  choices: Array<{ message: { content: string } }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  settlement?: {
    provider: Address;
    requestHash: string;
    signature: string;
  };
}

/**
 * Get Jeju gateway URL from environment or default
 */
function getGatewayUrl(): string {
  if (process.env.JEJU_COMPUTE_GATEWAY_URL) {
    return process.env.JEJU_COMPUTE_GATEWAY_URL;
  }
  const network = (process.env.JEJU_NETWORK ?? 'localnet') as
    | 'localnet'
    | 'testnet'
    | 'mainnet';
  return JEJU_GATEWAY_URLS[network];
}

/**
 * Get user address for billing
 */
function getUserAddress(runtime: IAgentRuntime): string {
  const address = runtime.getSetting('JEJU_WALLET_ADDRESS');
  if (typeof address === 'string' && address) {
    return address;
  }
  if (process.env.JEJU_WALLET_ADDRESS) {
    return process.env.JEJU_WALLET_ADDRESS;
  }
  throw new Error(
    '[JejuCompute] JEJU_WALLET_ADDRESS is required for billing. ' +
      'Set it in runtime settings or environment.'
  );
}

/**
 * Find model name for tokenization
 */
function findModelName(model: ModelTypeName): TiktokenModel {
  const name =
    model === ModelType.TEXT_SMALL
      ? (process.env.JEJU_SMALL_MODEL ?? DEFAULT_MODELS.small)
      : (process.env.JEJU_LARGE_MODEL ?? DEFAULT_MODELS.large);
  return name as TiktokenModel;
}

/**
 * Tokenize text using tiktoken
 */
async function tokenizeText(
  model: ModelTypeName,
  prompt: string
): Promise<number[]> {
  const encoding = encodingForModel(findModelName(model));
  return encoding.encode(prompt);
}

/**
 * Detokenize tokens back to text
 */
async function detokenizeText(
  model: ModelTypeName,
  tokens: number[]
): Promise<string> {
  const encoding = encodingForModel(findModelName(model));
  return encoding.decode(tokens);
}

/**
 * Call Jeju Compute for text generation
 */
async function generateJejuText(params: {
  runtime: IAgentRuntime;
  model: string;
  prompt: string;
  system?: string;
  temperature: number;
  maxTokens: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  trajectoryLogger?: TrajectoryLoggerService;
  trajectoryId?: string;
  purpose?: 'action' | 'reasoning' | 'evaluation' | 'response' | 'other';
  actionType?: string;
  modelVersion?: string;
}): Promise<string> {
  const startTime = Date.now();
  const gatewayUrl = getGatewayUrl();
  const userAddress = getUserAddress(params.runtime);

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [];
  if (params.system) {
    messages.push({ role: 'system', content: params.system });
  }
  messages.push({ role: 'user', content: params.prompt });

  const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-jeju-address': userAddress,
    },
    body: JSON.stringify({
      model: params.model,
      messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      frequency_penalty: params.frequencyPenalty,
      presence_penalty: params.presencePenalty,
      stop: params.stopSequences,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[JejuCompute] Inference failed (${response.status}): ${errorText}. ` +
        'Ensure Jeju Compute is running: cd /path/to/jeju && bun run dev'
    );
  }

  const data = (await response.json()) as JejuComputeResponse;
  const content = data.choices[0]?.message?.content ?? '';
  const latencyMs = Date.now() - startTime;

  // Log prompt if enabled
  if (isPromptLoggingEnabled()) {
    await logPrompt({
      promptType: params.actionType ?? params.purpose ?? 'jeju_compute_text',
      input: `System: ${params.system ?? ''}\n\nUser: ${params.prompt}`,
      output: content,
      metadata: {
        provider: 'jeju-compute',
        model: params.model,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        latencyMs,
        settlement: data.settlement,
      },
    });
  }

  // Log to trajectory if available
  if (params.trajectoryLogger && params.trajectoryId) {
    const stepId = params.trajectoryLogger.getCurrentStepId(
      params.trajectoryId
    );
    if (stepId) {
      params.trajectoryLogger.logLLMCall(stepId, {
        model: params.model,
        modelVersion: params.modelVersion,
        systemPrompt: params.system ?? '',
        userPrompt: params.prompt,
        response: content,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        purpose: params.purpose ?? 'action',
        actionType: params.actionType,
        latencyMs,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      });
    }
  }

  logger.debug(
    'Jeju Compute inference completed',
    {
      model: params.model,
      latencyMs,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      provider: data.settlement?.provider ?? 'local',
    },
    'JejuComputePlugin'
  );

  return content;
}

/**
 * Call Jeju Compute for object generation
 */
async function generateJejuObject(
  runtime: IAgentRuntime,
  model: string,
  params: ObjectGenerationParams
): Promise<unknown> {
  const gatewayUrl = getGatewayUrl();
  const userAddress = getUserAddress(runtime);

  // For object generation, we request JSON output
  const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-jeju-address': userAddress,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: params.prompt }],
      temperature: params.temperature ?? 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[JejuCompute] Object generation failed (${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as JejuComputeResponse;
  const content = data.choices[0]?.message?.content ?? '{}';

  if (isPromptLoggingEnabled()) {
    await logPrompt({
      promptType: 'jeju_compute_object',
      input: params.prompt,
      output: content,
      metadata: {
        provider: 'jeju-compute',
        model,
        temperature: params.temperature,
      },
    });
  }

  return JSON.parse(content);
}

/**
 * Extended runtime with trajectory logging
 */
interface RuntimeWithTrajectory extends IAgentRuntime {
  trajectoryLogger?: TrajectoryLoggerService;
  currentTrajectoryId?: string;
  currentModelVersion?: string;
}

/**
 * Jeju Compute Plugin
 *
 * Provides decentralized LLM inference for ElizaOS agents.
 * Routes all requests through Jeju's compute marketplace.
 */
export const jejuComputePlugin: Plugin = {
  name: 'jeju-compute',
  description: 'Decentralized LLM inference via Jeju Compute marketplace',
  config: {
    JEJU_NETWORK: process.env.JEJU_NETWORK ?? 'localnet',
    JEJU_WALLET_ADDRESS: process.env.JEJU_WALLET_ADDRESS ?? '',
    JEJU_SMALL_MODEL: process.env.JEJU_SMALL_MODEL ?? DEFAULT_MODELS.small,
    JEJU_LARGE_MODEL: process.env.JEJU_LARGE_MODEL ?? DEFAULT_MODELS.large,
  },

  async init() {
    const gatewayUrl = getGatewayUrl();
    logger.info(
      `Jeju Compute plugin initialized`,
      { gateway: gatewayUrl, network: process.env.JEJU_NETWORK ?? 'localnet' },
      'JejuComputePlugin'
    );

    // Verify gateway is reachable
    const healthCheck = await fetch(`${gatewayUrl}/health`).catch(() => null);
    if (!healthCheck?.ok) {
      throw new Error(
        `[JejuCompute] Gateway not reachable at ${gatewayUrl}. ` +
          'Ensure Jeju is running: cd /path/to/jeju && bun run dev'
      );
    }
  },

  models: {
    // Tokenizer encode
    [ModelType.TEXT_TOKENIZER_ENCODE]: (async (
      _runtime: IAgentRuntime,
      params: Record<string, unknown>
    ) => {
      const { prompt, modelType = ModelType.TEXT_LARGE } =
        params as unknown as TokenizeTextParams;
      return await tokenizeText(modelType ?? ModelType.TEXT_LARGE, prompt);
    }) as never,

    // Tokenizer decode
    [ModelType.TEXT_TOKENIZER_DECODE]: (async (
      _runtime: IAgentRuntime,
      params: Record<string, unknown>
    ) => {
      const { tokens, modelType = ModelType.TEXT_LARGE } =
        params as unknown as DetokenizeTextParams;
      return await detokenizeText(modelType ?? ModelType.TEXT_LARGE, tokens);
    }) as never,

    // Small text model
    [ModelType.TEXT_SMALL]: (async (
      runtime: IAgentRuntime,
      params: Record<string, unknown>
    ) => {
      const { prompt, stopSequences = [] } =
        params as unknown as GenerateTextParams;

      const extendedRuntime = runtime as RuntimeWithTrajectory;
      const modelSetting =
        runtime.getSetting('JEJU_SMALL_MODEL') ??
        runtime.getSetting('SMALL_MODEL');
      const model =
        typeof modelSetting === 'string' ? modelSetting : DEFAULT_MODELS.small;

      return await generateJejuText({
        runtime,
        model,
        prompt,
        system: runtime.character.system ?? undefined,
        temperature: 0.7,
        maxTokens: 8000,
        frequencyPenalty: 0.7,
        presencePenalty: 0.7,
        stopSequences,
        trajectoryLogger: extendedRuntime.trajectoryLogger,
        trajectoryId: extendedRuntime.currentTrajectoryId,
        purpose: 'action',
        modelVersion: extendedRuntime.currentModelVersion,
      });
    }) as never,

    // Large text model
    [ModelType.TEXT_LARGE]: (async (
      runtime: IAgentRuntime,
      params: Record<string, unknown>
    ) => {
      const {
        prompt,
        stopSequences = [],
        maxTokens = 8192,
        temperature = 0.7,
        frequencyPenalty = 0.7,
        presencePenalty = 0.7,
      } = params as unknown as GenerateTextParams;

      const extendedRuntime = runtime as RuntimeWithTrajectory;
      const modelSetting =
        runtime.getSetting('JEJU_LARGE_MODEL') ??
        runtime.getSetting('LARGE_MODEL');
      const model =
        typeof modelSetting === 'string' ? modelSetting : DEFAULT_MODELS.large;

      logger.debug(
        'Using Jeju Compute for inference',
        { model, modelSource: 'jeju-compute' },
        'JejuComputePlugin'
      );

      return await generateJejuText({
        runtime,
        model,
        prompt,
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens,
        frequencyPenalty,
        presencePenalty,
        stopSequences,
        trajectoryLogger: extendedRuntime.trajectoryLogger,
        trajectoryId: extendedRuntime.currentTrajectoryId,
        purpose: 'action',
        modelVersion: extendedRuntime.currentModelVersion,
      });
    }) as never,

    // Small object model
    [ModelType.OBJECT_SMALL]: (async (
      runtime: IAgentRuntime,
      params: Record<string, unknown>
    ) => {
      const modelSetting =
        runtime.getSetting('JEJU_SMALL_MODEL') ??
        runtime.getSetting('SMALL_MODEL');
      const model =
        typeof modelSetting === 'string' ? modelSetting : DEFAULT_MODELS.small;

      return await generateJejuObject(
        runtime,
        model,
        params as unknown as ObjectGenerationParams
      );
    }) as never,

    // Large object model
    [ModelType.OBJECT_LARGE]: (async (
      runtime: IAgentRuntime,
      params: Record<string, unknown>
    ) => {
      const modelSetting =
        runtime.getSetting('JEJU_LARGE_MODEL') ??
        runtime.getSetting('LARGE_MODEL');
      const model =
        typeof modelSetting === 'string' ? modelSetting : DEFAULT_MODELS.large;

      return await generateJejuObject(
        runtime,
        model,
        params as unknown as ObjectGenerationParams
      );
    }) as never,
  },
};

export default jejuComputePlugin;
