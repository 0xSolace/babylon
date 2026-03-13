import { describe, expect, test } from 'bun:test';
import { gameMasterPlanner } from '../../game-master/planner';
import { gameMasterPolicyEngine } from '../../game-master/policy';
import type { GameMasterWorldSnapshot } from '../../game-master/types';

function createSnapshot(
  overrides: Partial<GameMasterWorldSnapshot> = {}
): GameMasterWorldSnapshot {
  return {
    gameId: 'continuous',
    gameDay: 12,
    isRunning: true,
    currentTopic: {
      topicKey: 'ai-markets',
      topicLabel: 'AI Markets',
      summary: 'Institutions and actors are fighting over AI market direction.',
      isLocked: false,
    },
    recentWorldEvents: [],
    recentArticles: [],
    recentOrganizationPosts: [],
    recentRelationshipChanges: [],
    lastRunAt: new Date(Date.now() - 20 * 60 * 1000),
    lastInterventionAt: new Date(Date.now() - 20 * 60 * 1000),
    recentActionCount: 0,
    ...overrides,
  };
}

describe('Game Master policy', () => {
  test('auto-runs narrow suggest actor instructions', () => {
    const assessment = gameMasterPolicyEngine.assess({
      actionType: 'INSTRUCT_ACTORS',
      authorityLevel: 'suggest',
      targetType: 'actor',
      instructionText: 'Nudge two actors.',
      payload: {
        actorIds: ['a', 'b'],
        promptOverlay: 'Say something sharper.',
        reason: 'Pulse nudge',
      },
    });

    expect(assessment.requiresApproval).toBe(false);
    expect(assessment.riskLevel).toBe('low');
  });

  test('requires approval for relationship shifts', () => {
    const assessment = gameMasterPolicyEngine.assess({
      actionType: 'SHIFT_RELATIONSHIP',
      authorityLevel: 'steer',
      targetType: 'relationship',
      instructionText: 'Increase rivalry.',
      payload: {
        actorAId: 'a',
        actorBId: 'b',
        sentimentDelta: -0.1,
        strengthDelta: 0.1,
        note: 'Escalate conflict.',
      },
    });

    expect(assessment.requiresApproval).toBe(true);
    expect(assessment.riskLevel).toBe('medium');
  });
});

describe('Game Master planner', () => {
  test('creates daily pass actions for a new game day', () => {
    const plan = gameMasterPlanner.plan(createSnapshot(), {
      runType: 'daily',
      triggerType: 'new_game_day',
      triggerData: {},
      shouldPlan: true,
    });

    expect(plan.actions.length).toBeGreaterThan(0);
    expect(
      plan.actions.some((action) => action.actionType === 'QUEUE_ARTICLE_BRIEF')
    ).toBe(true);
  });

  test('reactive run uses fresh event as a brief hook', () => {
    const plan = gameMasterPlanner.plan(
      createSnapshot({
        recentWorldEvents: [
          {
            id: 'evt-1',
            eventType: 'news',
            description: 'A dramatic earnings surprise hit the feed.',
            actors: ['actor-1'],
            relatedQuestion: null,
            timestamp: new Date(),
          },
        ],
      }),
      {
        runType: 'reactive',
        triggerType: 'fresh_world_event',
        triggerData: {},
        shouldPlan: true,
      }
    );

    expect(plan.actions[0]?.actionType).toBe('QUEUE_ARTICLE_BRIEF');
  });
});
