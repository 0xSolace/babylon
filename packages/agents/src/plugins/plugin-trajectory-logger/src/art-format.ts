/**
 * ART Format Conversion
 *
 * Converts trajectories to OpenPipe ART format for RLAIF training.
 */

import type { JsonValue } from '@jejunetwork/shared'
import type { Trajectory } from './types'

/**
 * ART-compatible trajectory format
 */
export interface ARTTrajectory {
  id: string
  agent_id: string
  scenario_id?: string
  group_index?: number
  start_time: number
  end_time: number
  duration_ms: number
  total_reward: number
  steps: ARTStep[]
  metadata?: Record<string, JsonValue>
}

/**
 * ART-compatible step format
 */
export interface ARTStep {
  step_id: string
  sequence_num: number
  timestamp: number
  action_type?: string
  action_name?: string
  parameters?: Record<string, JsonValue>
  success: boolean
  reward: number
  llm_calls?: ARTLLMCall[]
}

/**
 * ART-compatible LLM call format
 */
export interface ARTLLMCall {
  model: string
  system_prompt: string
  user_prompt: string
  response: string
  temperature: number
  latency_ms: number
  purpose: string
}

/**
 * Convert a trajectory to ART format
 */
export function toARTTrajectory(trajectory: Trajectory): ARTTrajectory {
  return {
    id: trajectory.trajectoryId,
    agent_id: trajectory.agentId,
    scenario_id: trajectory.scenarioId,
    group_index: trajectory.groupIndex,
    start_time: trajectory.startTime,
    end_time: trajectory.endTime,
    duration_ms: trajectory.durationMs,
    total_reward: trajectory.totalReward,
    steps: trajectory.steps.map((step) => ({
      step_id: step.stepId,
      sequence_num: step.sequenceNum,
      timestamp: step.startTime,
      action_type: step.action?.actionType,
      action_name: step.action?.actionName,
      parameters: step.action?.parameters,
      success: step.action?.success ?? false,
      reward: step.reward ?? 0,
      llm_calls: step.llmCalls?.map((call) => ({
        model: call.model,
        system_prompt: call.systemPrompt,
        user_prompt: call.userPrompt,
        response: call.response,
        temperature: call.temperature,
        latency_ms: call.latencyMs,
        purpose: call.purpose,
      })),
    })),
    metadata: trajectory.metadata,
  }
}

/**
 * Group trajectories by scenario for GRPO training
 */
export function groupTrajectories(
  trajectories: Trajectory[],
): Map<string, Trajectory[]> {
  const groups = new Map<string, Trajectory[]>()

  for (const trajectory of trajectories) {
    const scenarioId = trajectory.scenarioId ?? 'default'
    const existing = groups.get(scenarioId) ?? []
    existing.push(trajectory)
    groups.set(scenarioId, existing)
  }

  return groups
}
