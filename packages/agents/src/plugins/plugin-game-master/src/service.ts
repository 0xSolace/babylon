import {
  buildGameMasterPluginContext,
  type GameMasterPluginContext,
  type GameMasterWorldSnapshot,
} from '@babylon/engine';
import { type IAgentRuntime, Service } from '@elizaos/core';

type AppraisalServiceLike = {
  publish: (appraisal: {
    id: string;
    ts: number;
    confidence: number;
    source: string;
    payload: Record<string, unknown>;
  }) => boolean;
};

type HomeostasisServiceLike = {
  syncExternalState: (
    nextState: {
      physiological?: Record<string, number>;
      drives?: Record<string, number>;
      resources?: Record<string, number>;
    },
    metadata?: Record<string, unknown>
  ) => Promise<void>;
};

type MotivationServiceLike = {
  recalculate: () => Promise<void>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class GameMasterPluginService extends Service {
  static serviceType = 'GAME_MASTER_PLUGIN';

  public readonly capabilityDescription =
    'Builds Halliday plugin-backed world planning context from Babylon game state';

  private latestContext: GameMasterPluginContext | null = null;

  static async start(runtime: IAgentRuntime): Promise<GameMasterPluginService> {
    return new GameMasterPluginService(runtime);
  }

  async stop(): Promise<void> {
    this.latestContext = null;
  }

  private async syncAppraisalRegistry(
    context: GameMasterPluginContext
  ): Promise<void> {
    const appraisalService = this.runtime.getService(
      'appraisal'
    ) as AppraisalServiceLike | null;
    if (!appraisalService) return;

    const ts = Date.now();
    for (const appraisal of context.appraisals) {
      appraisalService.publish({
        id: `game_master_${appraisal.key}`,
        ts,
        confidence: clamp(appraisal.score, 0.05, 1),
        source: appraisal.pluginId,
        payload: {
          score: appraisal.score,
          summary: appraisal.summary,
          pluginId: appraisal.pluginId,
        },
      });
    }
  }

  private async syncHomeostasis(
    snapshot: GameMasterWorldSnapshot,
    context: GameMasterPluginContext
  ): Promise<void> {
    const homeostasis = this.runtime.getService(
      'homeostasis'
    ) as HomeostasisServiceLike | null;
    if (!homeostasis) return;

    const appraisalByKey = Object.fromEntries(
      context.appraisals.map((appraisal) => [appraisal.key, appraisal.score])
    ) as Record<string, number>;

    const driveTargets = {
      security: clamp(
        50 +
          (appraisalByKey.coherence ?? 0) * 20 +
          (appraisalByKey.urgency ?? 0) * 10,
        0,
        100
      ),
      social: clamp(40 + snapshot.recentRelationshipChanges.length * 8, 0, 100),
      status: clamp(45 + (appraisalByKey.notoriety ?? 0) * 35, 0, 100),
      autonomy: clamp(55 - (appraisalByKey.power ?? 0) * 20, 0, 100),
      meaning: clamp(45 + (appraisalByKey.opportunity ?? 0) * 35, 0, 100),
    };

    const physiologicalTargets = {
      hunger: clamp((appraisalByKey.coverage ?? 0) * 40, 0, 100),
      fatigue: clamp((appraisalByKey.urgency ?? 0) * 55, 0, 100),
      hydration: clamp((appraisalByKey.coherence ?? 0) * 30, 0, 100),
      health: clamp((appraisalByKey.relationship ?? 0) * 45, 0, 100),
    };

    await homeostasis.syncExternalState(
      {
        drives: driveTargets,
        physiological: physiologicalTargets,
        resources: {
          narrativeMomentum: snapshot.recentActionCount,
          articleVolume: snapshot.recentArticles.length,
          eventVolume: snapshot.recentWorldEvents.length,
        },
      },
      {
        source: 'game-master',
        reason: 'world_snapshot_sync',
      }
    );
  }

  private async syncMotivation(): Promise<void> {
    const motivation = this.runtime.getService(
      'motivation'
    ) as MotivationServiceLike | null;
    if (!motivation) return;
    await motivation.recalculate();
  }

  async buildContext(
    snapshot: GameMasterWorldSnapshot
  ): Promise<GameMasterPluginContext> {
    const context = buildGameMasterPluginContext(snapshot);
    await this.syncAppraisalRegistry(context);
    await this.syncHomeostasis(snapshot, context);
    await this.syncMotivation();
    this.latestContext = context;
    return context;
  }

  getLatestContext(): GameMasterPluginContext | null {
    return this.latestContext;
  }
}
