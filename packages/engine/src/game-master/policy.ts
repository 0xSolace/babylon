import { GAME_MASTER_DEFAULTS } from './constants';
import type {
  GameMasterActionAssessment,
  GameMasterPlannedAction,
} from './types';

function getTargetCount(action: GameMasterPlannedAction): number {
  switch (action.actionType) {
    case 'INSTRUCT_ACTORS':
      return action.payload.actorIds.length;
    case 'INSTRUCT_ORGANIZATIONS':
      return action.payload.organizationIds.length;
    case 'SET_MARKET_NARRATIVE_BRIEF':
      return (
        action.payload.questionIds.length +
        action.payload.organizationIds.length
      );
    case 'SHIFT_RELATIONSHIP':
      return 2;
    default:
      return 1;
  }
}

export class GameMasterPolicyEngine {
  assess(action: GameMasterPlannedAction): GameMasterActionAssessment {
    const targetCount = getTargetCount(action);

    if (action.authorityLevel === 'override') {
      return {
        riskLevel: 'high',
        requiresApproval: true,
        approvalReason: 'All override actions require admin approval.',
      };
    }

    if (action.actionType === 'SET_DAILY_TOPIC') {
      return {
        riskLevel: 'high',
        requiresApproval: true,
        approvalReason: 'Changing the daily topic requires admin approval.',
      };
    }

    if (action.actionType === 'QUEUE_WORLD_EVENT') {
      return {
        riskLevel: 'high',
        requiresApproval: true,
        approvalReason: 'Injecting a world event requires admin approval.',
      };
    }

    if (action.actionType === 'SHIFT_RELATIONSHIP') {
      return {
        riskLevel: 'medium',
        requiresApproval: true,
        approvalReason: 'Relationship shifts are approval-gated in v1.',
      };
    }

    if (
      action.actionType === 'SET_MARKET_NARRATIVE_BRIEF' &&
      targetCount > GAME_MASTER_DEFAULTS.maxAutoOrgTargets
    ) {
      return {
        riskLevel: 'high',
        requiresApproval: true,
        approvalReason:
          'Global market narrative briefs require approval in v1.',
      };
    }

    if (
      action.actionType === 'INSTRUCT_ACTORS' &&
      targetCount > GAME_MASTER_DEFAULTS.maxAutoActorTargets
    ) {
      return {
        riskLevel: 'medium',
        requiresApproval: true,
        approvalReason:
          'Actor directive scope is broader than auto-run policy.',
      };
    }

    if (
      action.actionType === 'INSTRUCT_ORGANIZATIONS' &&
      targetCount > GAME_MASTER_DEFAULTS.maxAutoOrgTargets
    ) {
      return {
        riskLevel: 'medium',
        requiresApproval: true,
        approvalReason:
          'Organization directive scope is broader than auto-run policy.',
      };
    }

    if (action.authorityLevel === 'steer') {
      return {
        riskLevel: 'medium',
        requiresApproval: false,
        approvalReason: null,
      };
    }

    return {
      riskLevel: 'low',
      requiresApproval: false,
      approvalReason: null,
    };
  }
}

export const gameMasterPolicyEngine = new GameMasterPolicyEngine();
