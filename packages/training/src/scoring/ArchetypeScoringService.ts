/**
 * ArchetypeScoringService
 *
 * Scores trajectories using LLM-as-judge with archetype-specific rubrics.
 * Supports both single trajectory scoring and RULER-style relative comparison.
 *
 * @packageDocumentation
 */

import { db } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { z } from 'zod';
import { getLLMCaller } from '../dependencies';
import { type BehavioralMetrics, trajectoryMetricsExtractor } from '../metrics';
import { hasCustomRubric } from '../rubrics';
import {
  parseTrajectorySteps,
  RulerScoreResponseSchema,
  TrajectoryScoreResponseSchema,
} from '../training/types';
import { splitIntoBatches } from '../utils';
import {
  judgePromptBuilder,
  type TrajectoryContext,
} from './JudgePromptBuilder';

/**
 * Score result for a single trajectory.
 */
export interface ArchetypeScore {
  trajectoryId: string;
  agentId: string;
  archetype: string;
  score: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  metrics: BehavioralMetrics;
  scoredAt: Date;
}

// Response types imported from ../training/types

/**
 * Options for scoring operations.
 */
export interface ScoringOptions {
  /** Override archetype for scoring */
  archetype?: string;
  /** Include detailed action context in prompts */
  includeActionDetails?: boolean;
  /** Save scores to database */
  saveToDatabase?: boolean;
}

const DEFAULT_OPTIONS: ScoringOptions = {
  includeActionDetails: false,
  saveToDatabase: true,
};

/**
 * Service for scoring trajectories with archetype-aware evaluation.
 */
export class ArchetypeScoringService {
  private readonly minGroupSize = 2;
  private readonly maxGroupSize = 8;

  /**
   * Score a single trajectory.
   * @param trajectoryId - ID of the trajectory to score
   * @param options - Scoring options
   * @returns The score or null if trajectory not found
   */
  async scoreTrajectory(
    trajectoryId: string,
    options: ScoringOptions = {}
  ): Promise<ArchetypeScore | null> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const traj = await db.trajectory.findUnique({
      where: { trajectoryId },
    });
    if (!traj) {
      logger.warn('Trajectory not found', { trajectoryId }, 'ArchetypeScoring');
      return null;
    }

    const archetype = traj.archetype ?? opts.archetype ?? 'default';
    const steps = parseTrajectorySteps(traj.stepsJson);

    const metrics = trajectoryMetricsExtractor.extractFromRaw({
      trajectoryId: traj.trajectoryId,
      agentId: traj.agentId,
      stepsJson: traj.stepsJson,
      scenarioId: traj.scenarioId ?? undefined,
      finalPnL: traj.finalPnL ?? undefined,
    });

    if (!metrics) {
      throw new Error(
        `Failed to extract metrics for trajectory ${trajectoryId}`
      );
    }

    const context: TrajectoryContext = {
      trajectoryId: traj.trajectoryId,
      agentId: traj.agentId,
      archetype,
      steps,
      metrics,
      finalPnL: traj.finalPnL ?? undefined,
      episodeLength: traj.episodeLength,
      totalReward: traj.totalReward,
    };

    const { system, user } = judgePromptBuilder.buildSinglePrompt(context, {
      includeActionDetails: opts.includeActionDetails,
    });

    const response = await this.callSingleJudge(system, user);
    if (!response) {
      throw new Error(
        `Judge returned no response for trajectory ${trajectoryId}`
      );
    }

    const score: ArchetypeScore = {
      trajectoryId: traj.trajectoryId,
      agentId: traj.agentId,
      archetype,
      score: Math.max(0, Math.min(1, response.score)),
      reasoning: response.reasoning,
      strengths: response.strengths || [],
      weaknesses: response.weaknesses || [],
      metrics,
      scoredAt: new Date(),
    };

    if (opts.saveToDatabase) {
      await db.trajectory.update({
        where: { trajectoryId },
        data: {
          aiJudgeReward: score.score,
          aiJudgeReasoning: score.reasoning,
          judgedAt: score.scoredAt,
          isTrainingData: true,
          updatedAt: new Date(),
        },
      });
    }

    logger.info(
      'Scored trajectory',
      {
        trajectoryId,
        archetype: score.archetype,
        score: score.score,
      },
      'ArchetypeScoring'
    );

    return score;
  }

  /**
   * Score multiple trajectories using RULER comparison.
   * @param trajectoryIds - IDs of trajectories to score
   * @param options - Scoring options
   * @returns Array of scores
   */
  async scoreTrajectoryGroup(
    trajectoryIds: string[],
    options: ScoringOptions = {}
  ): Promise<ArchetypeScore[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (trajectoryIds.length < this.minGroupSize) {
      logger.warn(
        'Group too small for RULER scoring',
        {
          size: trajectoryIds.length,
          minRequired: this.minGroupSize,
        },
        'ArchetypeScoring'
      );
      return [];
    }

    const trajResults = await db.trajectory.findMany({
      where: { trajectoryId: { in: trajectoryIds } },
    });

    if (trajResults.length < this.minGroupSize) {
      logger.warn(
        'Not enough valid trajectories',
        {
          requested: trajectoryIds.length,
          found: trajResults.length,
        },
        'ArchetypeScoring'
      );
      return [];
    }

    const contexts: TrajectoryContext[] = [];
    const fallbackArchetype = opts.archetype || 'default';

    for (const traj of trajResults) {
      const steps = parseTrajectorySteps(traj.stepsJson);
      const archetype = traj.archetype || fallbackArchetype;

      const metrics = trajectoryMetricsExtractor.extractFromRaw({
        trajectoryId: traj.trajectoryId,
        agentId: traj.agentId,
        stepsJson: traj.stepsJson,
        scenarioId: traj.scenarioId ?? undefined,
        finalPnL: traj.finalPnL ?? undefined,
      });

      if (!metrics) {
        throw new Error(
          `Failed to extract metrics for trajectory ${traj.trajectoryId}`
        );
      }

      contexts.push({
        trajectoryId: traj.trajectoryId,
        agentId: traj.agentId,
        archetype,
        steps,
        metrics,
        finalPnL: traj.finalPnL || undefined,
        episodeLength: traj.episodeLength,
        totalReward: traj.totalReward,
      });
    }

    const batches = splitIntoBatches(contexts, this.maxGroupSize);
    const scores: ArchetypeScore[] = [];

    for (const batch of batches) {
      const scenarioId = batch[0]?.archetype || 'unknown';
      const { system, user } = judgePromptBuilder.buildComparisonPrompt(
        batch,
        scenarioId
      );
      const response = await this.callComparisonJudge(system, user);

      if (!response) {
        throw new Error('Judge returned no response for batch');
      }

      for (let i = 0; i < batch.length; i++) {
        const ctx = batch[i];
        if (!ctx) continue;

        const expectedId = `trajectory-${i + 1}`;
        const scoreData = response.scores.find(
          (s) => s.trajectory_id === expectedId
        );

        if (!scoreData) {
          throw new Error(`Missing score for ${expectedId}`);
        }

        const score: ArchetypeScore = {
          trajectoryId: ctx.trajectoryId,
          agentId: ctx.agentId,
          archetype: ctx.archetype || 'default',
          score: Math.max(0, Math.min(1, scoreData.score)),
          reasoning: scoreData.explanation,
          strengths: [],
          weaknesses: [],
          metrics: ctx.metrics,
          scoredAt: new Date(),
        };

        scores.push(score);

        if (opts.saveToDatabase) {
          await db.trajectory.update({
            where: { trajectoryId: ctx.trajectoryId },
            data: {
              aiJudgeReward: score.score,
              aiJudgeReasoning: score.reasoning,
              judgedAt: score.scoredAt,
              isTrainingData: true,
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    logger.info(
      'Scored trajectory group',
      {
        requested: trajectoryIds.length,
        scored: scores.length,
      },
      'ArchetypeScoring'
    );

    return scores;
  }

  /**
   * Score trajectories by archetype.
   * @param archetype - Archetype to use for scoring
   * @param trajectoryIds - IDs to score
   * @returns Count of scored and errors
   */
  async scoreByArchetype(
    archetype: string,
    trajectoryIds: string[]
  ): Promise<{ scored: number; errors: number }> {
    if (!hasCustomRubric(archetype)) {
      logger.warn(
        'No custom rubric for archetype, using default',
        { archetype },
        'ArchetypeScoring'
      );
    }

    if (trajectoryIds.length === 0) {
      return { scored: 0, errors: 0 };
    }

    const scores = await this.scoreTrajectoryGroup(trajectoryIds, {
      archetype,
      saveToDatabase: true,
    });

    return {
      scored: scores.length,
      errors: trajectoryIds.length - scores.length,
    };
  }

  /**
   * Score all unscored trajectories.
   * @param archetype - Default archetype to use
   * @param limit - Maximum trajectories to score
   * @returns Count of scored and errors
   */
  async scoreUnscoredTrajectories(
    archetype: string = 'default',
    limit: number = 100
  ): Promise<{ scored: number; errors: number }> {
    const unscoredResult = await db.trajectory.findMany({
      where: {
        AND: [
          { aiJudgeReward: null },
          { isTrainingData: true },
          { stepsJson: { not: 'null' } },
          { stepsJson: { not: '[]' } },
        ],
      },
      take: limit,
    });

    if (unscoredResult.length === 0) {
      logger.info('No unscored trajectories found', {}, 'ArchetypeScoring');
      return { scored: 0, errors: 0 };
    }

    const trajectoryIds = unscoredResult.map((r) => r.trajectoryId);
    return this.scoreByArchetype(archetype, trajectoryIds);
  }

  /**
   * Score trajectories in parallel with rate limiting.
   * @param trajectoryIds - IDs to score
   * @param options - Scoring options
   * @param concurrency - Maximum concurrent calls
   * @returns Array of scores
   */
  async scoreTrajectoriesParallel(
    trajectoryIds: string[],
    options: ScoringOptions = {},
    concurrency: number = 5
  ): Promise<ArchetypeScore[]> {
    const results: ArchetypeScore[] = [];
    const batches = splitIntoBatches(trajectoryIds, concurrency);

    logger.info(
      'Starting parallel scoring',
      {
        total: trajectoryIds.length,
        batches: batches.length,
        concurrency,
      },
      'ArchetypeScoring'
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i] ?? [];
      const batchPromises = batch.map((id) =>
        this.scoreTrajectory(id, options)
      );
      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result) {
          results.push(result);
        }
      }

      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info(
      'Parallel scoring complete',
      {
        requested: trajectoryIds.length,
        scored: results.length,
      },
      'ArchetypeScoring'
    );

    return results;
  }

  /**
   * Call LLM judge for single trajectory.
   */
  private async callSingleJudge(
    system: string,
    user: string
  ): Promise<ReturnType<typeof TrajectoryScoreResponseSchema.parse> | null> {
    const llmCaller = getLLMCaller();
    const prompt = `${user}\n\nReturn ONLY valid JSON, no other text.`;

    const response = await llmCaller.callGroqDirect({
      prompt,
      system,
      modelSize: 'large',
      temperature: 0.3,
      maxTokens: 1000,
      actionType: 'archetype_score_trajectory',
    });

    return this.parseJudgeResponse(response, TrajectoryScoreResponseSchema);
  }

  /**
   * Call LLM judge for trajectory comparison.
   */
  private async callComparisonJudge(
    system: string,
    user: string
  ): Promise<ReturnType<typeof RulerScoreResponseSchema.parse> | null> {
    const llmCaller = getLLMCaller();
    const prompt = `${user}\n\nReturn ONLY valid JSON, no other text.`;

    const response = await llmCaller.callGroqDirect({
      prompt,
      system,
      modelSize: 'large',
      temperature: 0.3,
      maxTokens: 2000,
      actionType: 'archetype_ruler_score',
    });

    return this.parseJudgeResponse(response, RulerScoreResponseSchema);
  }

  /**
   * Parse JSON response from judge with Zod validation.
   */
  private parseJudgeResponse<T>(
    response: string,
    schema: z.ZodType<T>
  ): T | null {
    const jsonText = response
      .trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error(
        'No JSON found in response',
        {
          preview: response.substring(0, 200),
        },
        'ArchetypeScoring'
      );
      return null;
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    const result = schema.safeParse(parsed);

    if (!result.success) {
      logger.error(
        'Judge response validation failed',
        {
          errors: result.error.issues.map(
            (i) => `${i.path.map(String).join('.')}: ${String(i.message)}`
          ),
          preview: jsonMatch[0]?.substring(0, 200),
        },
        'ArchetypeScoring'
      );
      return null;
    }

    return result.data;
  }
}

/** Singleton instance */
export const archetypeScoringService = new ArchetypeScoringService();
