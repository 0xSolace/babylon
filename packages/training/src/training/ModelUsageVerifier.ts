/**
 * Model Usage Verifier
 *
 * Verifies that agents are using the correct models.
 * Provides assertions and logging for model usage verification.
 */

import { db } from '@babylon/db'
import { logger } from '@babylon/shared'
import type { IAgentRuntime } from '@elizaos/core'

export interface ModelUsageStats {
  agentId: string
  modelUsed: string
  modelSource: 'groq' | 'claude' | 'openai' | 'unknown'
  inferenceCount: number
}

export interface VerificationResult {
  success: boolean
  agentsChecked: number
  details: ModelUsageStats[]
  errors: string[]
}

/**
 * Verify an agent's model usage
 *
 * Checks the agent's runtime configuration to determine which model
 * is being used.
 *
 * @param agentUserId - Unique identifier for the agent
 * @param runtime - Agent runtime to verify
 * @returns ModelUsageStats with model information and inference count
 */
export async function verifyAgentModelUsage(
  agentUserId: string,
  runtime: IAgentRuntime,
): Promise<ModelUsageStats> {
  const settings = runtime.character?.settings

  // Check for different model providers
  const groqModel = String(
    settings?.GROQ_LARGE_MODEL || settings?.GROQ_SMALL_MODEL || '',
  )
  const claudeModel = String(settings?.CLAUDE_MODEL || '')
  const openaiModel = String(settings?.OPENAI_MODEL || '')

  let modelUsed: string
  let modelSource: 'groq' | 'claude' | 'openai' | 'unknown'

  if (claudeModel) {
    modelUsed = claudeModel
    modelSource = 'claude'
  } else if (openaiModel) {
    modelUsed = openaiModel
    modelSource = 'openai'
  } else if (groqModel) {
    modelUsed = groqModel
    modelSource = 'groq'
  } else {
    modelUsed = 'unknown'
    modelSource = 'unknown'
  }

  // Count inferences from logs (using trajectoryId)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const agentTrajectories = await db.trajectory.findMany({
    where: {
      AND: [
        { agentId: agentUserId },
        { startTime: { gte: twentyFourHoursAgo } },
      ],
    },
  })

  const trajectoryIds = agentTrajectories.map((t) => t.trajectoryId)

  let inferenceCount = 0
  if (trajectoryIds.length > 0) {
    inferenceCount = await db.llmCallLog.count({
      where: {
        AND: [
          { createdAt: { gte: twentyFourHoursAgo } },
          { trajectoryId: { in: trajectoryIds } },
        ],
      },
    })
  }

  return {
    agentId: agentUserId,
    modelUsed,
    modelSource,
    inferenceCount,
  }
}

/**
 * Verify multiple agents
 */
export async function verifyMultipleAgents(
  agentUserIds: string[],
  runtimes: Map<string, IAgentRuntime>,
): Promise<VerificationResult> {
  const details: ModelUsageStats[] = []
  const errors: string[] = []

  for (const agentId of agentUserIds) {
    const runtime = runtimes.get(agentId)
    if (!runtime) {
      errors.push(`Runtime not found for agent ${agentId}`)
      continue
    }

    const stats = await verifyAgentModelUsage(agentId, runtime)
    details.push(stats)
  }

  return {
    success: details.length > 0,
    agentsChecked: details.length,
    details,
    errors,
  }
}

/**
 * Assert that an agent is using a model
 */
export async function assertModelUsage(
  agentUserId: string,
  runtime: IAgentRuntime,
): Promise<void> {
  const stats = await verifyAgentModelUsage(agentUserId, runtime)

  if (stats.modelSource === 'unknown') {
    throw new Error(
      `Agent ${agentUserId} has no configured model. Using: ${stats.modelUsed}`,
    )
  }

  logger.info(
    'Model usage verified',
    {
      agentId: agentUserId,
      model: stats.modelUsed,
      source: stats.modelSource,
    },
    'ModelUsageVerifier',
  )
}

/**
 * Get model usage summary
 */
export async function getModelUsageSummary(): Promise<{
  totalAgents: number
}> {
  return {
    totalAgents: await db.user.count({ where: { isAgent: true } }),
  }
}
