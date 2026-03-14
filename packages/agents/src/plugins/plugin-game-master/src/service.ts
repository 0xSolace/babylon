import {
  buildGameMasterPluginContext,
  buildGameMasterPluginContextFromData,
  type GameMasterAppraisal,
  type GameMasterMotivationContext,
  type GameMasterPluginContext,
  type GameMasterPluginId,
  type GameMasterWorldSnapshot,
  type ResolvedGameMasterPluginContext,
  registerGameMasterRuntimeResolver,
} from '@babylon/engine';
import { type IAgentRuntime, Service } from '@elizaos/core';

type AppraisalRegistryEntry = {
  id: string;
  ts: number;
  confidence: number;
  source: string;
  payload: Record<string, unknown>;
};

type AppraisalServiceLike = {
  publish: (appraisal: AppraisalRegistryEntry) => boolean;
  getAll?: () => Record<string, AppraisalRegistryEntry>;
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

type MotivationStateLike = {
  priorities: Array<{
    need: string;
    intensity: number;
    drivers: string[];
    rationale?: string;
  }>;
  constraints: Array<{
    type: string;
    because: string;
    guidance: string;
  }>;
  opportunities: Array<{
    type: string;
    because: string;
    potential: number;
  }>;
};

type MotivationServiceLike = {
  recalculate: () => Promise<void>;
  getState?: () => MotivationStateLike;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isGameMasterPluginId(value: unknown): value is GameMasterPluginId {
  return (
    typeof value === 'string' &&
    [
      'plugin-homeostasis',
      'plugin-appraisal',
      'plugin-motivation',
      'plugin-goals',
      'plugin-autonomous',
      'plugin-neuro',
      'plugin-opportunity',
      'plugin-investigator',
      'plugin-newsreporter',
      'plugin-power',
      'plugin-money',
      'plugin-notoriety',
      'plugin-relationship',
      'plugin-health',
      'plugin-rolodex',
      'plugin-pim',
      'plugin-trust',
      'plugin-presence',
      'plugin-skills',
      'plugin-discovery',
      'plugin-attract',
      'plugin-engagement',
      'plugin-wrapped',
      'plugin-commerce',
      'plugin-expertise',
      'plugin-solana',
      'plugin-evm',
      'plugin-agent-factory',
      'plugin-digitaltwin',
      'plugin-observatory',
      'plugin-rss',
    ].includes(value)
  );
}

function mapRuntimeMotivation(
  state: MotivationStateLike | undefined,
  fallback: GameMasterMotivationContext
): GameMasterMotivationContext {
  if (!state) return fallback;

  return {
    priorities:
      state.priorities.map(
        (priority) =>
          priority.rationale ??
          `${priority.need.replaceAll('_', ' ')} [intensity=${priority.intensity.toFixed(2)}]`
      ) || fallback.priorities,
    constraints:
      state.constraints.map(
        (constraint) => `${constraint.guidance} (${constraint.because})`
      ) || fallback.constraints,
    opportunities:
      state.opportunities.map(
        (opportunity) =>
          `${opportunity.type.replaceAll('_', ' ')} (${opportunity.because})`
      ) || fallback.opportunities,
  };
}

function mapRuntimeAppraisals(
  appraisals: Record<string, AppraisalRegistryEntry> | undefined,
  fallback: GameMasterAppraisal[]
): GameMasterAppraisal[] {
  if (!appraisals) return fallback;

  const fallbackByKey = new Map(
    fallback.map((appraisal) => [appraisal.key, appraisal])
  );
  const runtimeAppraisals: GameMasterAppraisal[] = [];

  for (const entry of Object.values(appraisals)) {
    const payload = entry.payload ?? {};
    const key =
      typeof payload.key === 'string'
        ? payload.key
        : entry.id.startsWith('game_master_')
          ? entry.id.replace('game_master_', '')
          : entry.id;
    const fallbackAppraisal = fallbackByKey.get(
      key as GameMasterAppraisal['key']
    );
    if (!fallbackAppraisal) continue;

    const pluginId = isGameMasterPluginId(payload.pluginId)
      ? payload.pluginId
      : fallbackAppraisal.pluginId;
    const score =
      typeof payload.score === 'number'
        ? clamp(payload.score, 0, 1)
        : clamp(entry.confidence, 0, 1);
    const summary =
      typeof payload.summary === 'string'
        ? payload.summary
        : fallbackAppraisal.summary;

    runtimeAppraisals.push({
      key: fallbackAppraisal.key,
      pluginId,
      score,
      summary,
    });
  }

  if (runtimeAppraisals.length === 0) return fallback;

  const runtimeKeys = new Set(
    runtimeAppraisals.map((appraisal) => appraisal.key)
  );
  for (const appraisal of fallback) {
    if (!runtimeKeys.has(appraisal.key)) {
      runtimeAppraisals.push(appraisal);
    }
  }

  return runtimeAppraisals;
}

export class GameMasterPluginService extends Service {
  static serviceType = 'GAME_MASTER_PLUGIN';

  public readonly capabilityDescription =
    'Resolves Halliday runtime context from Babylon game state, mounted plugin services, and an engine fallback model';

  private latestContext: GameMasterPluginContext | null = null;
  private unregisterRuntimeResolver: (() => void) | null = null;

  static async start(runtime: IAgentRuntime): Promise<GameMasterPluginService> {
    const service = new GameMasterPluginService(runtime);
    service.unregisterRuntimeResolver = registerGameMasterRuntimeResolver(
      `game-master:${runtime.agentId}`,
      {
        resolveContext: async (snapshot) => service.resolveContext(snapshot),
        getMountedPluginIds: () => service.getMountedPluginIds(),
      }
    );
    return service;
  }

  async stop(): Promise<void> {
    this.unregisterRuntimeResolver?.();
    this.unregisterRuntimeResolver = null;
    this.latestContext = null;
  }

  private getAppraisalService(): AppraisalServiceLike | null {
    return this.runtime.getService('appraisal') as AppraisalServiceLike | null;
  }

  private getHomeostasisService(): HomeostasisServiceLike | null {
    return this.runtime.getService(
      'homeostasis'
    ) as HomeostasisServiceLike | null;
  }

  private getMotivationService(): MotivationServiceLike | null {
    return this.runtime.getService(
      'motivation'
    ) as MotivationServiceLike | null;
  }

  getMountedPluginIds(): GameMasterPluginId[] {
    const mounted = new Set<GameMasterPluginId>();

    if (this.getAppraisalService()) {
      mounted.add('plugin-appraisal');
    }
    if (this.getHomeostasisService()) {
      mounted.add('plugin-homeostasis');
    }
    if (this.getMotivationService()) {
      mounted.add('plugin-motivation');
    }

    return [...mounted];
  }

  private async syncAppraisalRegistry(
    context: GameMasterPluginContext
  ): Promise<void> {
    const appraisalService = this.getAppraisalService();
    if (!appraisalService) return;

    const ts = Date.now();
    for (const appraisal of context.appraisals) {
      appraisalService.publish({
        id: `game_master_${appraisal.key}`,
        ts,
        confidence: clamp(appraisal.score, 0.05, 1),
        source: appraisal.pluginId,
        payload: {
          key: appraisal.key,
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
    const homeostasis = this.getHomeostasisService();
    if (!homeostasis) return;

    const appraisalByKey = Object.fromEntries(
      context.appraisals.map((appraisal) => [appraisal.key, appraisal.score])
    ) as Record<string, number>;

    await homeostasis.syncExternalState(
      {
        drives: {
          security: clamp(
            50 +
              (appraisalByKey.coherence ?? 0) * 20 +
              (appraisalByKey.urgency ?? 0) * 10,
            0,
            100
          ),
          social: clamp(
            40 + snapshot.recentRelationshipChanges.length * 8,
            0,
            100
          ),
          status: clamp(45 + (appraisalByKey.notoriety ?? 0) * 35, 0, 100),
          autonomy: clamp(55 - (appraisalByKey.power ?? 0) * 20, 0, 100),
          meaning: clamp(45 + (appraisalByKey.opportunity ?? 0) * 35, 0, 100),
        },
        physiological: {
          hunger: clamp((appraisalByKey.coverage ?? 0) * 40, 0, 100),
          fatigue: clamp((appraisalByKey.urgency ?? 0) * 55, 0, 100),
          hydration: clamp((appraisalByKey.coherence ?? 0) * 30, 0, 100),
          health: clamp((appraisalByKey.relationship ?? 0) * 45, 0, 100),
        },
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
    const motivation = this.getMotivationService();
    if (!motivation) return;
    await motivation.recalculate();
  }

  private buildRuntimeContext(
    fallbackContext: GameMasterPluginContext
  ): GameMasterPluginContext {
    const appraisalService = this.getAppraisalService();
    const motivationService = this.getMotivationService();

    const runtimeAppraisals = mapRuntimeAppraisals(
      appraisalService?.getAll?.(),
      fallbackContext.appraisals
    );
    const runtimeMotivation = mapRuntimeMotivation(
      motivationService?.getState?.(),
      fallbackContext.motivation
    );

    const additionalModeledPluginIds: GameMasterPluginId[] = [
      'plugin-observatory',
      ...this.getMountedPluginIds().filter(
        (pluginId) =>
          pluginId !== 'plugin-homeostasis' && pluginId !== 'plugin-neuro'
      ),
    ];

    return buildGameMasterPluginContextFromData({
      appraisals: runtimeAppraisals,
      motivation: runtimeMotivation,
      hypotheses: fallbackContext.hypotheses,
      additionalModeledPluginIds,
    });
  }

  async buildContext(
    snapshot: GameMasterWorldSnapshot
  ): Promise<GameMasterPluginContext> {
    const fallbackContext = buildGameMasterPluginContext(snapshot);
    await this.syncAppraisalRegistry(fallbackContext);
    await this.syncHomeostasis(snapshot, fallbackContext);
    await this.syncMotivation();

    const context = this.buildRuntimeContext(fallbackContext);
    this.latestContext = context;
    return context;
  }

  async resolveContext(
    snapshot: GameMasterWorldSnapshot
  ): Promise<ResolvedGameMasterPluginContext | null> {
    const mountedPluginIds = this.getMountedPluginIds();
    if (mountedPluginIds.length === 0) {
      return null;
    }

    const context = await this.buildContext(snapshot);
    return {
      source: 'runtime_plugin',
      resolvedAt: new Date(),
      context,
    };
  }

  getLatestContext(): GameMasterPluginContext | null {
    return this.latestContext;
  }
}
