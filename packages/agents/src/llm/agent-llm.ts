/**
 * Agent LLM Provider
 *
 * Decentralized LLM interface for autonomous agents using Jeju Compute.
 *
 * Supports:
 * - Jeju Compute Marketplace (primary)
 * - HuggingFace Inference Endpoints (via Jeju)
 * - Phala TEE inference (via Jeju)
 *
 * @packageDocumentation
 */

import type { IAgentRuntime } from '@elizaos/core'
import { getTrajectoryContext } from '../plugins/plugin-trajectory-logger/src/action-interceptor'
import type { TrajectoryLoggerService } from '../plugins/plugin-trajectory-logger/src/TrajectoryLoggerService'
import { logger } from '../shared/logger'
import {
  callJejuInference,
  getJejuComputeStatus,
  isJejuComputeAvailable,
} from './jeju-provider'

/** Parameters for agent LLM inference calls */
export interface AgentLLMParams {
  prompt: string
  system?: string | null
  archetype?: string
  temperature?: number
  maxTokens?: number
  modelSize?: 'small' | 'medium' | 'large'
  trajectoryLogger?: TrajectoryLoggerService
  trajectoryId?: string
  purpose?: 'action' | 'reasoning' | 'evaluation' | 'response' | 'other'
  actionType?: string
  runtime?: IAgentRuntime
}

/**
 * Logs LLM call to trajectory logger for RL training data collection
 */
async function logToTrajectory(
  params: AgentLLMParams,
  model: string,
  response: string,
  latencyMs: number,
  tokenCounts?: { promptTokens?: number; completionTokens?: number },
): Promise<void> {
  let trajectoryLogger = params.trajectoryLogger
  let trajectoryId = params.trajectoryId

  if (!trajectoryLogger && !trajectoryId && params.runtime) {
    const context = getTrajectoryContext(params.runtime)
    if (context) {
      trajectoryLogger = context.logger
      trajectoryId = context.trajectoryId
    }
  }

  if (trajectoryLogger && trajectoryId) {
    const stepId = trajectoryLogger.getCurrentStepId(trajectoryId)
    if (stepId) {
      trajectoryLogger.logLLMCall(stepId, {
        model,
        systemPrompt: params.system || '',
        userPrompt: params.prompt,
        response,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens ?? 2048,
        purpose: params.purpose || 'action',
        actionType: params.actionType,
        latencyMs,
        promptTokens: tokenCounts?.promptTokens,
        completionTokens: tokenCounts?.completionTokens,
      })
    }
  }
}

/**
 * Main entry point for agent LLM inference calls
 *
 * Uses Jeju Compute Marketplace exclusively.
 */
export async function callAgentLLM(params: AgentLLMParams): Promise<string> {
  if (!isJejuComputeAvailable()) {
    throw new Error(
      '[AgentLLM] Jeju Compute not configured. ' +
        'Set JEJU_NETWORK (mainnet/testnet/localnet) or JEJU_COMPUTE_API_URL.',
    )
  }

  logger.debug(
    'Agent LLM call',
    {
      provider: 'jeju',
      archetype: params.archetype,
      purpose: params.purpose,
    },
    'AgentLLM',
  )

  const startTime = Date.now()

  const response = await callJejuInference({
    prompt: params.prompt,
    system: params.system,
    model: params.archetype ? `babylon-${params.archetype}` : undefined,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    trajectoryLogger: params.trajectoryLogger,
    trajectoryId: params.trajectoryId,
    purpose: params.purpose,
    actionType: params.actionType,
    runtime: params.runtime,
  })

  const latencyMs = Date.now() - startTime
  await logToTrajectory(params, 'jeju', response, latencyMs)

  return response
}

/**
 * Checks the Jeju Compute provider status and availability
 */
export async function getAgentLLMStatus(): Promise<{
  provider: 'jeju'
  configured: boolean
  available: boolean
  details: Record<string, string | boolean | number>
  error?: string
}> {
  const status = await getJejuComputeStatus()

  return {
    provider: 'jeju',
    configured: isJejuComputeAvailable(),
    available: status.available,
    details: {
      network: process.env.JEJU_NETWORK || 'not set',
      computeApiUrl: status.computeApiUrl || 'not set',
      modelsAvailable: status.modelsAvailable,
    },
    error: status.error,
  }
}

export type AgentLLMProvider = 'jeju'
