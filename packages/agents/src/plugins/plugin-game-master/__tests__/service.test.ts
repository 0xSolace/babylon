import { describe, expect, test } from 'bun:test';
import type { IAgentRuntime } from '@elizaos/core';
import { GameMasterPluginService } from '../src/service';
import type { GameMasterWorldSnapshot } from '@babylon/engine';

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
  test('publishes appraisals, syncs homeostasis, and recalculates motivation', async () => {
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
          };
        }

        return null;
      },
    } as unknown as IAgentRuntime;

    const service = new GameMasterPluginService(runtime);
    const context = await service.buildContext(
      createSnapshot({
        recentOrganizationPosts: [
          { id: 'post-1', authorId: 'org-1', timestamp: new Date() },
        ],
      })
    );

    expect(context.appraisals.length).toBeGreaterThan(0);
    expect(published.length).toBe(context.appraisals.length);
    expect(syncedState).not.toBeNull();
    expect(syncMetadata).toEqual({
      source: 'game-master',
      reason: 'world_snapshot_sync',
    });
    expect(recalculated).toBe(1);
    expect(service.getLatestContext()).toEqual(context);
  });

  test('falls back cleanly when optional plugin services are absent', async () => {
    const runtime = {
      agentId: 'test-agent',
      getService: () => null,
    } as unknown as IAgentRuntime;

    const service = new GameMasterPluginService(runtime);
    const context = await service.buildContext(createSnapshot());

    expect(context.observability.modeledPluginCount).toBeGreaterThan(0);
    expect(service.getLatestContext()).toEqual(context);
  });
});
