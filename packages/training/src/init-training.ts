/**
 * Training Package Initialization
 *
 * This module sets up all dependencies required by the training package.
 * Import this before using TrajectoryGenerator or other training services.
 *
 * Usage:
 *   import { initializeTrainingPackage } from '@babylon/training/init-training';
 *   await initializeTrainingPackage();
 */

import {
  agentRuntimeManager,
  agentService,
  autonomousCoordinator,
} from '@babylon/agents'
import { logger } from '@babylon/shared'
import {
  configureTrainingDependencies,
  type IAgentRuntimeManager,
  type IAgentService,
  type IAutonomousCoordinator,
  type ILLMCaller,
} from './dependencies'

/** OpenAI/vLLM compatible chat completion response */
interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>
}

let initialized = false

/**
 * Initialize training package with dependencies from @babylon/agents
 */
export async function initializeTrainingPackage(): Promise<void> {
  if (initialized) {
    logger.debug('Training package already initialized', {}, 'TrainingInit')
    return
  }

  logger.info('Initializing training package...', {}, 'TrainingInit')

  // Get the agentService (implements IAgentService)
  // The agentService from @babylon/agents has createAgent method matching IAgentService
  const agentServiceInstance = agentService as IAgentService

  // Get the agentRuntimeManager (implements IAgentRuntimeManager)
  const runtimeManager = agentRuntimeManager
  const agentRuntimeManagerInstance: IAgentRuntimeManager = {
    getRuntime: (agentId: string) => runtimeManager.getRuntime(agentId),
    resetRuntime: async (agentId: string) => {
      await runtimeManager.clearRuntime(agentId)
    },
  }

  // Get the autonomousCoordinator (implements IAutonomousCoordinator)
  const coordinatorInstance = autonomousCoordinator
  const autonomousCoordinatorInstance: IAutonomousCoordinator = {
    executeAutonomousTick: async (
      agentUserId,
      agentRuntime,
      recordTrajectories,
    ) => {
      const result = await coordinatorInstance.executeAutonomousTick(
        agentUserId,
        agentRuntime,
        recordTrajectories,
      )
      return {
        success: result.success,
        actionsExecuted: result.actionsExecuted,
        trajectoryId: result.trajectoryId,
      }
    },
  }

  // Get the LLM caller from agents (uses Jeju Compute)
  const callLLM = async (params: {
    prompt: string
    system: string
    modelSize?: 'small' | 'medium' | 'large'
    temperature?: number
    maxTokens?: number
  }): Promise<string> => {
    // Route through Jeju Compute - NO centralized fallback
    const jejuEndpoint =
      process.env.JEJU_COMPUTE_API_URL ||
      process.env.JEJU_COMPUTE_ENDPOINT ||
      'http://localhost:4500'

    const modelMap: Record<'small' | 'medium' | 'large', string> = {
      small: 'llama-3.1-8b-instant',
      medium: 'llama-3.1-70b-versatile',
      large: 'llama-3.1-70b-versatile',
    }

    const model = modelMap[params.modelSize || 'medium']

    const response = await fetch(`${jejuEndpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.prompt },
        ],
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 1024,
      }),
    })

    if (!response.ok) {
      throw new Error(`Jeju Compute error: ${response.status}`)
    }

    const data: ChatCompletionResponse = await response.json()
    return data.choices[0]?.message.content || ''
  }

  const llmCaller: ILLMCaller = {
    callAgentLLM: callLLM,
    callGroqDirect: callLLM,
  }

  // Configure all dependencies
  configureTrainingDependencies({
    agentService: agentServiceInstance,
    agentRuntimeManager: agentRuntimeManagerInstance,
    autonomousCoordinator: autonomousCoordinatorInstance,
    llmCaller,
  })

  initialized = true
  logger.info('Training package initialized successfully', {}, 'TrainingInit')
}

/**
 * Check if training package is initialized
 */
export function isTrainingInitialized(): boolean {
  return initialized
}

/**
 * Reset initialization state (for testing)
 */
export function resetTrainingInitialization(): void {
  initialized = false
}
