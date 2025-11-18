/**
 * Model Usage Verifier
 *
 * Verifies that agents are using trained W&B models instead of base models.
 * Provides assertions and logging for model usage verification.
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { IAgentRuntime } from '@elizaos/core';
import { getLatestRLModel } from './WandbModelFetcher';

export type ModelUsageStats = {
  agentId: string;
  modelUsed: string;
  modelSource: 'wandb' | 'groq' | 'unknown';
  modelVersion?: string;
  isTrainedModel: boolean;
  inferenceCount: number;
};

export type VerificationResult = {
  success: boolean;
  agentsChecked: number;
  agentsUsingTrainedModel: number;
  agentsUsingBaseModel: number;
  details: ModelUsageStats[];
  errors: string[];
};

const verifyAgentModelUsage = async (
  agentUserId: string,
  runtime: IAgentRuntime
): Promise<ModelUsageStats> => {
  const wandbEnabled = runtime.character?.settings?.WANDB_ENABLED === 'true';
  const wandbModel = String(runtime.character?.settings?.WANDB_MODEL || '');
  const groqModel = String(
    runtime.character?.settings?.LARGE_GROQ_MODEL ||
      runtime.character?.settings?.SMALL_GROQ_MODEL ||
      ''
  );

  let modelUsed: string;
  let modelSource: 'wandb' | 'groq' | 'unknown';
  let modelVersion: string | undefined;
  let isTrainedModel = false;

  if (wandbEnabled && wandbModel) {
    modelUsed = wandbModel;
    modelSource = 'wandb';

    const latestModel = await getLatestRLModel();
    if (latestModel && latestModel.modelPath === wandbModel) {
      isTrainedModel = true;
      modelVersion = latestModel.version;
    } else {
      isTrainedModel = false;
    }
  } else if (groqModel) {
    modelUsed = groqModel;
    modelSource = 'groq';
    isTrainedModel = false;
  } else {
    modelUsed = 'unknown';
    modelSource = 'unknown';
    isTrainedModel = false;
  }

  const inferenceCount = await prisma.llmCallLog
    .count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        trajectoryId: {
          in: await prisma.trajectory
            .findMany({
              where: { agentId: agentUserId },
              select: { trajectoryId: true },
            })
            .then((trajs) => trajs.map((t) => t.trajectoryId)),
        },
      },
    })
    .catch(() => 0);

  return {
    agentId: agentUserId,
    modelUsed,
    modelSource,
    modelVersion,
    isTrainedModel,
    inferenceCount,
  };
};

const verifyMultipleAgents = async (
  agentUserIds: string[],
  runtimes: Map<string, IAgentRuntime>
): Promise<VerificationResult> => {
  const details: ModelUsageStats[] = [];
  const errors: string[] = [];

  for (const agentId of agentUserIds) {
    try {
      const runtime = runtimes.get(agentId);
      if (!runtime) {
        errors.push(`Runtime not found for agent ${agentId}`);
        continue;
      }

      const stats = await verifyAgentModelUsage(agentId, runtime);
      details.push(stats);
    } catch (error) {
      errors.push(
        `Failed to verify agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const agentsUsingTrainedModel = details.filter((d) => d.isTrainedModel).length;
  const agentsUsingBaseModel = details.filter((d) => !d.isTrainedModel).length;

  return {
    success: agentsUsingTrainedModel > 0,
    agentsChecked: details.length,
    agentsUsingTrainedModel,
    agentsUsingBaseModel,
    details,
    errors,
  };
};

const assertTrainedModelUsage = async (
  agentUserId: string,
  runtime: IAgentRuntime
): Promise<void> => {
  const stats = await verifyAgentModelUsage(agentUserId, runtime);

  if (!stats.isTrainedModel) {
    throw new Error(
      `Agent ${agentUserId} is not using trained model. Using: ${stats.modelUsed} (source: ${stats.modelSource})`
    );
  }

  logger.info(
    'Model usage assertion passed',
    {
      agentId: agentUserId,
      model: stats.modelUsed,
      version: stats.modelVersion,
    },
    'ModelUsageVerifier'
  );
};

const getModelUsageSummary = async () => {
  const agents = await prisma.user.findMany({
    where: { isAgent: true },
    select: { id: true },
  });

  const latestModel = await getLatestRLModel();

  return {
    totalAgents: agents.length,
    usingTrainedModel: 0,
    usingBaseModel: agents.length,
    latestModelVersion: latestModel?.version,
  };
};

export const ModelUsageVerifier = {
  verifyAgentModelUsage,
  verifyMultipleAgents,
  assertTrainedModelUsage,
  getModelUsageSummary,
};
