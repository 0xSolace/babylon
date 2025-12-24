/**
 * Model Fetcher
 *
 * Fetches trained RL models from the database for inference.
 */

import { db } from '@babylon/db'
import { logger } from '@babylon/shared'

export interface ModelArtifact {
  version: string
  modelId: string
  modelPath: string
  metadata: {
    avgReward?: number | null
    benchmarkScore?: number | null
    baseModel: string
    trainedAt: Date
  }
}

/**
 * Get the latest RL model from database
 */
export async function getLatestRLModel(): Promise<ModelArtifact | null> {
  const model = await db.trainedModel.findFirst({
    where: { status: { in: ['ready', 'deployed'] } },
    orderBy: { createdAt: 'desc' },
  })

  if (!model) {
    return null
  }

  const rlModelId = model.storagePath || model.modelId

  if (!rlModelId || rlModelId.trim().length === 0) {
    logger.error(
      'Model has no storagePath or modelId',
      {
        modelId: model.modelId,
        storagePath: model.storagePath,
      },
      'ModelFetcher',
    )
    return null
  }

  if (!model.baseModel || model.baseModel.trim().length === 0) {
    logger.error(
      'Model has no baseModel',
      {
        modelId: model.modelId,
      },
      'ModelFetcher',
    )
    return null
  }

  return {
    version: model.version,
    modelId: rlModelId,
    modelPath: rlModelId,
    metadata: {
      avgReward: model.avgReward,
      benchmarkScore: model.benchmarkScore,
      baseModel: model.baseModel,
      trainedAt: model.createdAt,
    },
  }
}
