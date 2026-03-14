import { describe, expect, test } from 'bun:test';
import {
  buildGameMasterPluginContext,
  registerGameMasterRuntimeResolver,
  resolveRuntimeGameMasterPluginContext,
} from '../../game-master/integrations';
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
  test('builds modeled Halliday context from the world snapshot', () => {
    const context = buildGameMasterPluginContext(
      createSnapshot({
        recentOrganizationPosts: [
          {
            id: 'post-1',
            authorId: 'org-1',
            timestamp: new Date(),
          },
          {
            id: 'post-2',
            authorId: 'org-2',
            timestamp: new Date(),
          },
        ],
      })
    );

    expect(context.observability.modeledPluginCount).toBeGreaterThan(0);
    expect(
      context.appraisals.some((appraisal) => appraisal.key === 'coverage')
    ).toBe(true);
    expect(context.motivation.constraints.length).toBeGreaterThan(0);
  });

  test('creates daily pass actions for a new game day', () => {
    const pluginContext = buildGameMasterPluginContext(createSnapshot());
    const plan = gameMasterPlanner.plan({
      snapshot: createSnapshot(),
      trigger: {
        runType: 'daily',
        triggerType: 'new_game_day',
        triggerData: {},
        shouldPlan: true,
      },
      pluginContext: {
        source: 'engine_modeled',
        resolvedAt: new Date(),
        context: pluginContext,
      },
    });

    expect(plan.actions.length).toBeGreaterThan(0);
    expect(
      plan.actions.some((action) => action.actionType === 'QUEUE_ARTICLE_BRIEF')
    ).toBe(true);
    expect(plan.planSummary).toContain('modeled plugin integrations');
  });

  test('reactive run uses fresh event as a brief hook', () => {
    const snapshot = createSnapshot({
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
    });
    const plan = gameMasterPlanner.plan({
      snapshot,
      trigger: {
        runType: 'reactive',
        triggerType: 'fresh_world_event',
        triggerData: {},
        shouldPlan: true,
      },
      pluginContext: {
        source: 'engine_modeled',
        resolvedAt: new Date(),
        context: buildGameMasterPluginContext(snapshot),
      },
    });

    expect(plan.actions[0]?.actionType).toBe('QUEUE_ARTICLE_BRIEF');
  });

  test('uses the resolved plugin context instead of rebuilding priorities internally', () => {
    const snapshot = createSnapshot();
    const context = buildGameMasterPluginContext(snapshot);
    context.motivation.priorities = [
      'Drive coverage into a rivalry-heavy story.',
    ];
    context.motivation.opportunities = ['Use an injected opportunity.'];
    context.hypotheses = [
      {
        key: 'injected',
        confidence: 0.9,
        summary: 'Injected hypothesis should shape the plan.',
      },
    ];

    const plan = gameMasterPlanner.plan({
      snapshot,
      trigger: {
        runType: 'daily',
        triggerType: 'test',
        triggerData: {},
        shouldPlan: true,
      },
      pluginContext: {
        source: 'engine_modeled',
        resolvedAt: new Date(),
        context,
      },
    });

    expect(plan.dailyObjective).toBe(
      'Drive coverage into a rivalry-heavy story.'
    );
    expect(plan.worldSummary).toContain(
      'Injected hypothesis should shape the plan.'
    );
  });

  test('runtime resolver overrides engine fallback when mounted', async () => {
    const snapshot = createSnapshot();
    const unregister = registerGameMasterRuntimeResolver('test-runtime', {
      async resolveContext(resolvedSnapshot) {
        const context = buildGameMasterPluginContext(resolvedSnapshot);
        context.motivation.priorities = ['Use the mounted runtime context.'];
        return {
          source: 'runtime_plugin',
          resolvedAt: new Date(),
          context,
        };
      },
      getMountedPluginIds() {
        return ['plugin-appraisal'];
      },
    });

    try {
      const resolved = await resolveRuntimeGameMasterPluginContext(snapshot);
      expect(resolved?.source).toBe('runtime_plugin');
      expect(resolved?.context.motivation.priorities[0]).toBe(
        'Use the mounted runtime context.'
      );
    } finally {
      unregister();
    }
  });
});
