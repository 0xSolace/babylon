/**
 * Simulation Metrics Parser
 *
 * Shared utility for validating and parsing SimulationMetrics from JSON data.
 * Used by ModelBenchmarkService and HuggingFaceModelUploader.
 *
 * Note: SimulationMetrics type is imported from ./index (circular import workaround)
 * due to SimulationEngine being deprecated and types being consolidated.
 */

import { isObject } from '@babylon/shared'
import type { SimulationMetrics } from './index'

/**
 * JSON value type for parsing untyped data
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * Parse and validate SimulationMetrics from JSON data
 *
 * @param data - Raw JSON data to parse
 * @returns Validated SimulationMetrics object
 * @throws Error if data is invalid or missing required fields
 */
export function parseSimulationMetrics(data: JsonValue): SimulationMetrics {
  if (!isObject(data)) {
    throw new Error('Invalid SimulationMetrics: expected object')
  }

  const metrics = data

  // Validate required fields
  if (typeof metrics.totalPnl !== 'number') {
    throw new Error('Invalid SimulationMetrics: totalPnl must be a number')
  }

  if (
    typeof metrics.predictionMetrics !== 'object' ||
    metrics.predictionMetrics === null
  ) {
    throw new Error(
      'Invalid SimulationMetrics: predictionMetrics must be an object',
    )
  }

  if (typeof metrics.perpMetrics !== 'object' || metrics.perpMetrics === null) {
    throw new Error('Invalid SimulationMetrics: perpMetrics must be an object')
  }

  if (typeof metrics.optimalityScore !== 'number') {
    throw new Error(
      'Invalid SimulationMetrics: optimalityScore must be a number',
    )
  }

  if (typeof metrics.timing !== 'object' || metrics.timing === null) {
    throw new Error('Invalid SimulationMetrics: timing must be an object')
  }

  // Validate nested structures
  const predictionMetrics = metrics.predictionMetrics
  const perpMetrics = metrics.perpMetrics
  const timing = metrics.timing

  // Helper to safely get number or default from an object
  const getNumber = (
    obj: { [key: string]: JsonValue } | JsonValue[],
    key: string,
  ): number => {
    if (Array.isArray(obj)) return 0
    const val = obj[key]
    return typeof val === 'number' ? val : 0
  }

  // Parse socialMetrics if present
  const socialMetricsData = metrics.socialMetrics
  const socialMetrics = isObject(socialMetricsData) ? socialMetricsData : null

  return {
    totalPnl: typeof metrics.totalPnl === 'number' ? metrics.totalPnl : 0,
    predictionMetrics: {
      totalPositions: getNumber(predictionMetrics, 'totalPositions'),
      correctPredictions: getNumber(predictionMetrics, 'correctPredictions'),
      incorrectPredictions: getNumber(
        predictionMetrics,
        'incorrectPredictions',
      ),
      accuracy: getNumber(predictionMetrics, 'accuracy'),
      avgPnlPerPosition: getNumber(predictionMetrics, 'avgPnlPerPosition'),
    },
    perpMetrics: {
      totalTrades: getNumber(perpMetrics, 'totalTrades'),
      profitableTrades: getNumber(perpMetrics, 'profitableTrades'),
      winRate: getNumber(perpMetrics, 'winRate'),
      avgPnlPerTrade: getNumber(perpMetrics, 'avgPnlPerTrade'),
      maxDrawdown: getNumber(perpMetrics, 'maxDrawdown'),
    },
    socialMetrics: socialMetrics
      ? {
          postsCreated: getNumber(socialMetrics, 'postsCreated'),
          groupsJoined: getNumber(socialMetrics, 'groupsJoined'),
          messagesReceived: getNumber(socialMetrics, 'messagesReceived'),
          reputationGained: getNumber(socialMetrics, 'reputationGained'),
        }
      : {
          postsCreated: 0,
          groupsJoined: 0,
          messagesReceived: 0,
          reputationGained: 0,
        },
    timing: {
      avgResponseTime: getNumber(timing, 'avgResponseTime'),
      maxResponseTime: getNumber(timing, 'maxResponseTime'),
      totalDuration: getNumber(timing, 'totalDuration'),
    },
    optimalityScore:
      typeof metrics.optimalityScore === 'number' ? metrics.optimalityScore : 0,
  }
}
