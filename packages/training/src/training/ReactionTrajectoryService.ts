/**
 * Reaction Trajectory Service
 *
 * Records event-reaction-outcome chains for RL training.
 * Tracks which reactions led to engagement/market impact.
 *
 * Flow:
 * 1. NPC encounters event -> recordReactionStart()
 * 2. 1-24 hours later -> recordReactionOutcome()
 * 3. Export for training with calculated rewards
 */

import {
  insertReactionTrajectoryRow,
  type ReactionTrajectory,
  selectPendingReactionOutcomeMeasurements,
  selectReactionTrajectoriesTrainingReady,
  updateReactionTrajectoriesUsedInTrainingByIds,
  updateReactionTrajectoryOutcomeById,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { generateSnowflakeId, logger } from '@babylon/shared';

export interface ReactionDecision {
  eventId: string;
  eventType: string;
  eventSeverity: number;
  npcId: string;
  npcRole: 'insider' | 'affiliated' | 'observer';
  arcPhase: string | null;
  orgCoordinationContext: {
    orgMatesReacted: number;
    availableAngles: string[];
  } | null;
}

export interface ReactionAction {
  actionType: 'post' | 'comment' | 'trade' | 'none';
  angle: string | null;
  sentiment: string | null;
  postId: string | null;
  tradeDetails: {
    ticker: string;
    direction: 'buy' | 'sell';
    amount: number;
  } | null;
}

export interface ReactionOutcome {
  likes: number;
  comments: number;
  reposts: number;
  priceMovement: number | null;
  profitLoss: number | null;
  otherNpcsReacted: number;
  humanReactions: number;
}

export class ReactionTrajectoryService {
  async recordReactionStart(
    decision: ReactionDecision,
    action: ReactionAction
  ): Promise<string> {
    const id = await generateSnowflakeId();
    const now = new Date();

    try {
      await insertReactionTrajectoryRow(db, {
        id,
        eventId: decision.eventId,
        eventType: decision.eventType,
        eventSeverity: decision.eventSeverity,
        npcId: decision.npcId,
        npcRole: decision.npcRole,
        arcPhase: decision.arcPhase,
        orgContextJson: decision.orgCoordinationContext
          ? JSON.stringify(decision.orgCoordinationContext)
          : null,
        actionType: action.actionType,
        actionAngle: action.angle,
        actionSentiment: action.sentiment,
        postId: action.postId,
        tradeDetailsJson: action.tradeDetails
          ? JSON.stringify(action.tradeDetails)
          : null,
        createdAt: now,
      });

      logger.debug(
        'Recorded reaction start',
        {
          trajectoryId: id,
          eventId: decision.eventId,
          action: action.actionType,
        },
        'ReactionTrajectoryService'
      );

      return id;
    } catch (error) {
      logger.warn(
        'Failed to record reaction start',
        {
          eventId: decision.eventId,
          error: error instanceof Error ? error.message : String(error),
        },
        'ReactionTrajectoryService'
      );
      throw error;
    }
  }

  async recordReactionOutcome(
    trajectoryId: string,
    outcome: ReactionOutcome
  ): Promise<void> {
    const reward = this.calculateRewardFromOutcome(outcome);

    await updateReactionTrajectoryOutcomeById(db, trajectoryId, {
      outcomeRecordedAt: new Date(),
      outcomeLikes: outcome.likes,
      outcomeComments: outcome.comments,
      outcomeReposts: outcome.reposts,
      outcomePriceMovement: outcome.priceMovement?.toString() ?? null,
      outcomeProfitLoss: outcome.profitLoss?.toString() ?? null,
      outcomeOtherNpcs: outcome.otherNpcsReacted,
      outcomeHumans: outcome.humanReactions,
      reward: reward.toString(),
    });

    logger.debug(
      'Recorded reaction outcome',
      { trajectoryId, reward },
      'ReactionTrajectoryService'
    );
  }

  async getPendingOutcomeMeasurements(
    limit: number = 100
  ): Promise<{ id: string; postId: string | null }[]> {
    const now = Date.now();
    const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    return selectPendingReactionOutcomeMeasurements(
      db,
      twentyFourHoursAgo,
      oneHourAgo,
      limit
    );
  }

  private calculateRewardFromOutcome(outcome: ReactionOutcome): number {
    let reward = 0;

    reward += Math.log1p(outcome.likes) * 0.1;
    reward += Math.log1p(outcome.comments) * 0.2;
    reward += Math.log1p(outcome.reposts) * 0.15;
    reward += Math.log1p(outcome.humanReactions) * 0.3;

    if (outcome.profitLoss !== null) {
      reward += Math.tanh(outcome.profitLoss / 100) * 0.5;
    }

    reward += Math.log1p(outcome.otherNpcsReacted) * 0.1;

    return reward;
  }

  calculateReward(
    outcome: ReactionOutcome,
    decision: ReactionDecision
  ): number {
    let reward = this.calculateRewardFromOutcome(outcome);

    if (decision.npcRole === 'insider' && outcome.otherNpcsReacted > 0) {
      reward += 0.2;
    }

    if (
      decision.orgCoordinationContext?.orgMatesReacted &&
      decision.orgCoordinationContext.orgMatesReacted >= 3
    ) {
      reward -= 0.3;
    }

    if (decision.eventSeverity >= 4) {
      reward *= 1.2;
    }

    return reward;
  }

  async getTrainingReadyTrajectories(
    limit: number = 500
  ): Promise<ReactionTrajectory[]> {
    return selectReactionTrajectoriesTrainingReady(db, limit);
  }

  async markAsUsedInTraining(trajectoryIds: string[]): Promise<void> {
    await updateReactionTrajectoriesUsedInTrainingByIds(db, trajectoryIds);
  }
}

export const reactionTrajectoryService = new ReactionTrajectoryService();
