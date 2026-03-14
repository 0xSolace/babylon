import { describe, expect, test } from 'bun:test';
import type { GameMasterWorldSnapshot } from '@babylon/engine';
import type { IAgentRuntime } from '@elizaos/core';
import { GameMasterPluginService } from '../src/service';

function createSnapshot(
  overrides: Partial<GameMasterWorldSnapshot> = {}
): GameMasterWorldSnapshot {
  return {
    gameId: 'continuous',
    gameDay: 14,
    isRunning: true,
    currentTopic: {
      topicKey: 'ai-markets',
      topicLabel: 'AI Markets',
      summary: 'Institutions are fighting over AI market direction.',
      isLocked: false,
    },
    recentWorldEvents: [],
    recentArticles: [],
    recentOrganizationPosts: [],
    recentRelationshipChanges: [],
    lastRunAt: new Date(Date.now() - 30 * 60 * 1000),
    lastInterventionAt: new Date(Date.now() - 45 * 60 * 1000),
    recentActionCount: 1,
    ...overrides,
  };
}

describe('GameMasterPluginService', () => {
  test('resolves runtime plugin context through mounted services', async () => {
    const published: Array<Record<string, unknown>> = [];
    let syncedState: Record<string, unknown> | null = null;
    let syncMetadata: Record<string, unknown> | null = null;
    let recalculated = 0;

    const runtime = {
      agentId: 'test-agent',
      getService: (name: string) => {
        if (name === 'appraisal') {
          return {
            publish(appraisal: Record<string, unknown>) {
              published.push(appraisal);
              return true;
            },
          };
        }

        if (name === 'homeostasis') {
          return {
            async syncExternalState(
              nextState: Record<string, unknown>,
              metadata?: Record<string, unknown>
            ) {
              syncedState = nextState;
              syncMetadata = metadata ?? null;
            },
          };
        }

        if (name === 'motivation') {
          return {
            async recalculate() {
              recalculated += 1;
            },
            getState() {
              return {
                priorities: [
                  {
                    need: 'restore_coverage',
                    intensity: 0.8,
                    drivers: ['coverage'],
                    rationale: 'Close the article coverage gap quickly.',
                  },
                ],
                constraints: [
                  {
                    type: 'narrative_only',
                    because: 'Halliday must not mutate markets directly.',
                    guidance: 'Keep interventions narrative and auditable.',
                  },
                ],
                opportunities: [
                  {
                    type: 'fresh_story_window',
                    because: 'A new event can still be shaped into coverage.',
                    potential: 0.7,
                  },
                ],
              };
            },
          };
        }

        return null;
      },
    } as unknown as IAgentRuntime;

    const service = new GameMasterPluginService(runtime);
    const resolved = await service.resolveContext(
      createSnapshot({
        recentOrganizationPosts: [
          { id: 'post-1', authorId: 'org-1', timestamp: new Date() },
        ],
      })
    );

    expect(resolved?.source).toBe('runtime_plugin');
    expect(resolved?.context.appraisals.length).toBeGreaterThan(0);
    expect(resolved?.context.motivation.priorities[0]).toBe(
      'Close the article coverage gap quickly.'
    );
    expect(published.length).toBe(resolved?.context.appraisals.length);
    expect(syncedState).not.toBeNull();
    expect(syncMetadata).toEqual({
      source: 'game-master',
      reason: 'world_snapshot_sync',
    });
    expect(recalculated).toBe(1);
    expect(service.getMountedPluginIds()).toEqual(
      expect.arrayContaining([
        'plugin-appraisal',
        'plugin-homeostasis',
        'plugin-motivation',
      ])
    );
    expect(service.getLatestContext()).toEqual(resolved?.context ?? null);
  });

  test('returns null runtime resolution when mounted plugin services are absent', async () => {
    const runtime = {
      agentId: 'test-agent',
      getService: () => null,
    } as unknown as IAgentRuntime;

    const service = new GameMasterPluginService(runtime);
    const resolved = await service.resolveContext(createSnapshot());
    const context = await service.buildContext(createSnapshot());

    expect(resolved).toBeNull();
    expect(context.observability.modeledPluginCount).toBeGreaterThan(0);
    expect(service.getLatestContext()).toEqual(context);
  });
});
