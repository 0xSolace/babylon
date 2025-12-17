/**
 * LLM Client for Babylon Game Generation
 *
 * Uses Jeju decentralized compute exclusively.
 * NO FALLBACKS - Jeju Compute is required.
 */

import 'dotenv/config';
import { getJejuConfig, logger } from '@babylon/shared';
import type { LLMCallTokenUsage } from '../types/token-stats';
import { isPromptLoggingEnabled, logPrompt } from '../utils/prompt-logger';
import {
  cleanMarkdownCodeBlocks,
  extractJsonFromText,
} from './json-continuation-parser';
import { parseXML } from './xml-parser';

/** Token usage callback type */
export type TokenUsageCallback = (
  usage: Omit<LLMCallTokenUsage, 'callId' | 'timestamp'>
) => void;

let globalTokenUsageCallback: TokenUsageCallback | null = null;

export function setTokenUsageCallback(
  callback: TokenUsageCallback | null
): void {
  globalTokenUsageCallback = callback;
}

export function getTokenUsageCallback(): TokenUsageCallback | null {
  return globalTokenUsageCallback;
}

interface JSONSchema {
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
}

interface JsonSchemaProperty {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
}

export class BabylonLLMClient {
  private jejuConfig: ReturnType<typeof getJejuConfig>;

  static forJeju(): BabylonLLMClient {
    return new BabylonLLMClient();
  }

  /** Legacy factory methods - all route to Jeju */
  static forGroq(): BabylonLLMClient {
    return new BabylonLLMClient();
  }

  static forClaude(): BabylonLLMClient {
    return new BabylonLLMClient();
  }

  static forOpenAI(_apiKey?: string): BabylonLLMClient {
    return new BabylonLLMClient();
  }

  static forGameTick(): BabylonLLMClient {
    return new BabylonLLMClient();
  }

  constructor(_apiKey?: string, _forceProvider?: string) {
    this.jejuConfig = getJejuConfig();

    const jejuNetwork =
      process.env.JEJU_NETWORK || process.env.NEXT_PUBLIC_JEJU_NETWORK;

    if (!jejuNetwork) {
      throw new Error(
        '[BabylonLLMClient] JEJU_NETWORK not set. ' +
          'Decentralized compute is required. ' +
          'Set JEJU_NETWORK=mainnet, testnet, or localnet.'
      );
    }

    logger.info(
      `Using Jeju decentralized compute (${jejuNetwork})`,
      undefined,
      'BabylonLLMClient'
    );
  }

  getProvider(): string {
    return 'jeju';
  }

  getDefaultModel(): string {
    return 'llama3-70b';
  }

  getStats(): { provider: string; model: string; configured: boolean } {
    return {
      provider: 'jeju',
      model: this.getDefaultModel(),
      configured: true,
    };
  }

  async generateJSON<T>(
    prompt: string,
    _schema?: JSONSchema,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      format?: 'xml' | 'json';
      promptType?: string;
      promptTemplate?: string;
    } = {}
  ): Promise<T> {
    const {
      model = this.getDefaultModel(),
      temperature = 0.7,
      maxTokens = 16000,
      format = 'xml',
      promptType = 'unknown',
      promptTemplate,
    } = options;

    // Babylon world context
    const babylonContext = `You are generating content for Babylon, a satirical prediction market game.
WORLD RULES:
- Use ONLY parody names (e.g., "AIlon Musk" not "Elon Musk", "TeslAI" not "Tesla", "OpenAGI" not "OpenAI")
- NEVER use real-world person or organization names
- NO hashtags (#) in any content
- NO emojis in any content
- Each character has a UNIQUE voice - match their writing style exactly

`;

    const systemContent =
      format === 'xml'
        ? babylonContext +
          'You are an XML-only assistant. CRITICAL INSTRUCTIONS:\n' +
          '1. Respond ONLY with valid XML - NO explanations, NO reasoning, NO markdown\n' +
          '2. Start your response IMMEDIATELY with < (the opening tag)\n' +
          '3. End your response with > (the closing tag)\n' +
          '4. Do NOT write any thinking process\n' +
          '5. Just output the pure XML structure directly\n'
        : babylonContext +
          'You are a JSON-only assistant. Respond ONLY with valid JSON.';

    let retryCount = 0;
    const maxRetries = 3;
    const initialDelayMs = 2000;

    while (retryCount <= maxRetries) {
      try {
        const startTime = Date.now();

        const response = await this.callJejuCompute(
          systemContent,
          prompt,
          model,
          temperature,
          maxTokens
        );

        const latencyMs = Date.now() - startTime;

        // Log prompt if enabled
        if (isPromptLoggingEnabled()) {
          logPrompt({
            promptType,
            promptTemplate: promptTemplate || prompt.slice(0, 500),
            input: prompt,
            output: response.content,
            metadata: {
              model,
              provider: 'jeju',
            },
          });
        }

        // Report token usage
        if (globalTokenUsageCallback) {
          const inputTokens =
            response.usage?.promptTokens ?? this.estimateTokens(prompt);
          const outputTokens =
            response.usage?.completionTokens ??
            this.estimateTokens(response.content);
          globalTokenUsageCallback({
            provider: 'jeju',
            model,
            promptType,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            durationMs: latencyMs,
            success: true,
          });
        }

        // Parse response
        const cleanedContent = cleanMarkdownCodeBlocks(response.content);

        if (format === 'xml') {
          const result = parseXML(cleanedContent);
          if (!result.success) {
            throw new Error(`XML parse failed: ${result.error}`);
          }
          return result.data as T;
        }

        const parsed = JSON.parse(extractJsonFromText(cleanedContent));
        return parsed as T;
      } catch (error) {
        retryCount++;
        const err = error as Error;

        logger.warn(
          `LLM call failed (attempt ${retryCount}/${maxRetries + 1}): ${err.message}`,
          { promptType, model },
          'BabylonLLMClient'
        );

        if (globalTokenUsageCallback) {
          globalTokenUsageCallback({
            provider: 'jeju',
            model,
            promptType,
            inputTokens: this.estimateTokens(prompt),
            outputTokens: 0,
            totalTokens: this.estimateTokens(prompt),
            durationMs: 0,
            success: false,
            error: err.message,
          });
        }

        if (retryCount > maxRetries) {
          throw new Error(
            `LLM call failed after ${maxRetries + 1} attempts: ${err.message}`
          );
        }

        // Exponential backoff
        const delayMs = initialDelayMs * Math.pow(2, retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('LLM call failed: exhausted all retries');
  }

  async generate(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      promptType?: string;
    } = {}
  ): Promise<string> {
    const {
      model = this.getDefaultModel(),
      temperature = 0.7,
      maxTokens = 4000,
      promptType = 'unknown',
    } = options;

    const startTime = Date.now();

    const response = await this.callJejuCompute(
      'You are a helpful assistant.',
      prompt,
      model,
      temperature,
      maxTokens
    );

    const latencyMs = Date.now() - startTime;

    if (globalTokenUsageCallback) {
      const inputTokens =
        response.usage?.promptTokens ?? this.estimateTokens(prompt);
      const outputTokens =
        response.usage?.completionTokens ??
        this.estimateTokens(response.content);
      globalTokenUsageCallback({
        provider: 'jeju',
        model,
        promptType,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        durationMs: latencyMs,
        success: true,
      });
    }

    return response.content;
  }

  async generateWithContinuation<T>(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokensPerChunk?: number;
      maxChunks?: number;
      promptType?: string;
    } = {}
  ): Promise<T> {
    const {
      model = this.getDefaultModel(),
      temperature = 0.7,
      maxTokensPerChunk = 16000,
      maxChunks = 3,
    } = options;

    let fullContent = '';
    let chunk = 0;

    while (chunk < maxChunks) {
      const isFirstChunk = chunk === 0;
      const currentPrompt = isFirstChunk
        ? prompt
        : `Continue generating from where you left off. The previous output ended with:\n...\n${fullContent.slice(-500)}\n\nContinue:`;

      const response = await this.callJejuCompute(
        'You are an XML-only assistant generating content for Babylon.',
        currentPrompt,
        model,
        temperature,
        maxTokensPerChunk
      );

      fullContent += response.content;
      chunk++;

      // Check if response seems complete (ends with closing tag)
      const cleanedSoFar = cleanMarkdownCodeBlocks(fullContent);
      if (cleanedSoFar.match(/<\/\w+>\s*$/)) {
        break;
      }
    }

    const cleanedContent = cleanMarkdownCodeBlocks(fullContent);
    const result = parseXML(cleanedContent);
    if (!result.success) {
      throw new Error(`XML parse failed: ${result.error}`);
    }
    return result.data as T;
  }

  private async callJejuCompute(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    temperature: number,
    maxTokens: number
  ): Promise<{
    content: string;
    usage?: { promptTokens: number; completionTokens: number };
  }> {
    const computeApiUrl = this.getComputeApiUrl();

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await fetch(`${computeApiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.jejuConfig?.walletAddress && {
          'x-jeju-address': this.jejuConfig.walletAddress,
        }),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(300000), // 5 minutes
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jeju compute error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  private getComputeApiUrl(): string {
    if (process.env.JEJU_COMPUTE_API_URL) {
      return process.env.JEJU_COMPUTE_API_URL;
    }

    const network =
      process.env.JEJU_NETWORK || process.env.NEXT_PUBLIC_JEJU_NETWORK;

    const urls: Record<string, string> = {
      localnet: 'http://127.0.0.1:5010',
      testnet: 'https://compute.jeju.network',
      mainnet: 'https://compute.jeju.network',
    };

    return urls[network ?? 'localnet'] ?? 'http://127.0.0.1:5010';
  }

  private estimateTokens(text: string): number {
    // Rough estimate: 4 chars per token
    return Math.ceil(text.length / 4);
  }
}

// Legacy exports
export { cleanMarkdownCodeBlocks, extractJsonFromText };
