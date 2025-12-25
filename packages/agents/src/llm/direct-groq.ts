/**
 * Direct LLM calls via Jeju Compute Marketplace
 *
 * ALL LLM calls are routed through Jeju's decentralized compute marketplace.
 *
 * IMPORTANT FOR RL TRAINING:
 * - When runtime is provided, trajectory context is automatically extracted
 * - Every LLM call is logged with EXACT input/output for training data
 * - Purpose field tracks call type: action, reasoning, evaluation, response
 */

import type { IAgentRuntime } from '@elizaos/core'
import { createJejuInference, type JejuInference } from '@jejunetwork/agents'
import type { Address } from 'viem'
import { getTrajectoryContext } from '../plugins/plugin-trajectory-logger/src/action-interceptor'
import type { TrajectoryLoggerService } from '../plugins/plugin-trajectory-logger/src/TrajectoryLoggerService'
import { isPromptLoggingEnabled, logPrompt } from '../utils/prompt-logger'

export interface DirectGroqParams {
  prompt: string
  system?: string
  temperature?: number
  maxTokens?: number
  modelSize?: 'small' | 'large'
  purpose?: 'action' | 'reasoning' | 'evaluation' | 'response'
  actionType?: string
  runtime?: IAgentRuntime
  trajectoryLogger?: TrajectoryLoggerService
  trajectoryId?: string
}

// Singleton Jeju inference client
let jejuClient: JejuInference | null = null

function getJejuClient(): JejuInference {
  if (!jejuClient) {
    const userAddress = (process.env.JEJU_USER_ADDRESS ??
      process.env.AGENT_WALLET_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address

    jejuClient = createJejuInference({
      userAddress,
      gatewayUrl:
        process.env.JEJU_GATEWAY_URL ?? process.env.JEJU_COMPUTE_ENDPOINT,
    })
  }
  return jejuClient
}

/**
 * Call LLM via Jeju Compute Marketplace
 *
 * This routes ALL inference through Jeju's decentralized compute network.
 */
export async function callGroqDirect(
  params: DirectGroqParams,
): Promise<string> {
  // Auto-extract trajectory context from runtime if not explicitly provided
  // This ensures ALL LLM calls are logged for RL training
  let trajectoryLogger = params.trajectoryLogger
  let trajectoryId = params.trajectoryId

  if (!trajectoryLogger && !trajectoryId && params.runtime) {
    const context = getTrajectoryContext(params.runtime)
    if (context) {
      trajectoryLogger = context.logger
      trajectoryId = context.trajectoryId
    }
  }

  // Model selection based on task complexity
  // These are routed through Jeju marketplace which handles provider selection
  const model = params.modelSize === 'large' ? 'llama-70b' : 'llama-8b'

  const startTime = Date.now()

  // Route through Jeju Compute Marketplace
  const client = getJejuClient()
  const result = await client.inference({
    model,
    messages: [
      ...(params.system
        ? [{ role: 'system' as const, content: params.system }]
        : []),
      { role: 'user' as const, content: params.prompt },
    ],
    temperature: params.temperature ?? 0.7,
    maxTokens: params.maxTokens ?? 8192,
  })

  const latencyMs = Date.now() - startTime

  // Log to trajectory if available (CRITICAL for RL training data collection)
  if (trajectoryLogger && trajectoryId) {
    const stepId = trajectoryLogger.getCurrentStepId(trajectoryId)
    if (stepId) {
      trajectoryLogger.logLLMCall(stepId, {
        model: result.model,
        systemPrompt: params.system ?? '',
        userPrompt: params.prompt,
        response: result.content,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens ?? 8192,
        purpose: params.purpose ?? 'action',
        actionType: params.actionType,
        latencyMs,
      })
    }
  }

  if (isPromptLoggingEnabled()) {
    await logPrompt({
      promptType: params.actionType ?? params.purpose ?? 'jeju_inference',
      input: `System: ${params.system ?? ''}\n\nUser: ${params.prompt}`,
      output: result.content,
      metadata: {
        provider: result.provider ?? 'jeju',
        model: result.model,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens ?? 8192,
      },
    })
  }

  return result.content
}

/**
 * Reset the Jeju client (for testing)
 */
export function resetJejuClient(): void {
  jejuClient = null
}
