/**
 * Direct LLM calls via Jeju Compute Marketplace
 *
 * ALL inference routes through Jeju's decentralized compute.
 * NO direct calls to centralized providers (Groq/OpenAI/Anthropic).
 *
 * IMPORTANT FOR RL TRAINING:
 * - When runtime is provided, trajectory context is automatically extracted
 * - Every LLM call is logged with EXACT input/output for training data
 * - Purpose field tracks call type: action, reasoning, evaluation, response
 */

import type { IAgentRuntime } from '@elizaos/core';
import { getTrajectoryContext } from '../plugins/plugin-trajectory-logger/src/action-interceptor';
import type { TrajectoryLoggerService } from '../plugins/plugin-trajectory-logger/src/TrajectoryLoggerService';
import { isPromptLoggingEnabled, logPrompt } from '../utils/prompt-logger';
import { createJejuInference, type JejuInference } from './jeju-inference';

export interface DirectGroqParams {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  modelSize?: 'small' | 'large';
  purpose?: 'action' | 'reasoning' | 'evaluation' | 'response';
  actionType?: string;
  runtime?: IAgentRuntime;
  trajectoryLogger?: TrajectoryLoggerService;
  trajectoryId?: string;
}

// Singleton inference client
let jejuInferenceClient: JejuInference | null = null;

function getInferenceClient(): JejuInference {
  if (!jejuInferenceClient) {
    const network =
      (process.env.JEJU_NETWORK as 'localnet' | 'testnet' | 'mainnet') ??
      'localnet';
    const userAddress =
      process.env.JEJU_WALLET_ADDRESS ??
      '0x0000000000000000000000000000000000000000';

    jejuInferenceClient = createJejuInference({
      network,
      userAddress: userAddress as `0x${string}`,
      gatewayUrl: process.env.JEJU_GATEWAY_URL,
    });
  }
  return jejuInferenceClient;
}

/**
 * Call LLM via Jeju decentralized compute marketplace
 *
 * @deprecated Use callJejuDirect instead - this is an alias for backwards compatibility
 */
export async function callGroqDirect(
  params: DirectGroqParams
): Promise<string> {
  return callJejuDirect(params);
}

/**
 * Call LLM via Jeju decentralized compute marketplace
 *
 * All inference routes through Jeju's marketplace.
 * NO fallbacks to centralized providers.
 */
export async function callJejuDirect(
  params: DirectGroqParams
): Promise<string> {
  // Auto-extract trajectory context from runtime if not explicitly provided
  // This ensures ALL LLM calls are logged for RL training
  let trajectoryLogger = params.trajectoryLogger;
  let trajectoryId = params.trajectoryId;

  if (!trajectoryLogger && !trajectoryId && params.runtime) {
    const context = getTrajectoryContext(params.runtime);
    if (context) {
      trajectoryLogger = context.logger;
      trajectoryId = context.trajectoryId;
    }
  }

  // Get the Jeju inference client
  const client = getInferenceClient();

  // Model selection based on task complexity
  const model =
    params.modelSize === 'large'
      ? (process.env.JEJU_LARGE_MODEL ?? 'llama-3.1-70b-versatile')
      : (process.env.JEJU_SMALL_MODEL ?? 'llama-3.1-8b-instant');

  const startTime = Date.now();

  // Add timeout to prevent hanging (60 seconds default, configurable)
  const timeoutMs = params.maxTokens && params.maxTokens < 500 ? 20000 : 60000;

  // Build messages array
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] =
    [];
  if (params.system) {
    messages.push({ role: 'system', content: params.system });
  }
  messages.push({ role: 'user', content: params.prompt });

  const result = await Promise.race([
    client.inference({
      model,
      messages,
      temperature: params.temperature ?? 0.7,
      maxTokens: params.maxTokens ?? 8192,
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`LLM call timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);

  const durationMs = Date.now() - startTime;
  const response = result.content;

  // Log prompt if enabled
  if (isPromptLoggingEnabled()) {
    logPrompt({
      promptType: params.purpose ?? 'response',
      input: params.prompt,
      output: response,
      promptTemplate: params.system,
      metadata: {
        provider: 'jeju',
        model,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        latencyMs: durationMs,
      },
    });
  }

  // Log to trajectory logger for RL training
  if (trajectoryLogger && trajectoryId) {
    const stepId = trajectoryLogger.getCurrentStepId(trajectoryId);
    if (stepId) {
      trajectoryLogger.logLLMCall(stepId, {
        model,
        systemPrompt: params.system ?? '',
        userPrompt: params.prompt,
        response,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens ?? 8192,
        purpose: params.purpose ?? 'response',
        actionType: params.actionType,
        latencyMs: durationMs,
      });
    }
  }

  return response;
}
