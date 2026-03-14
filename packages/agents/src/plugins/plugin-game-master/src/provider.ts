import type { GameMasterPluginContext } from '@babylon/engine';
import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type State,
} from '@elizaos/core';
import { GameMasterPluginService } from './service';
import type { GameMasterPluginState } from './types';

function buildProviderData(context: GameMasterPluginContext) {
  return {
    activePluginIds: context.observability.activePluginIds,
    activePluginCount: context.observability.activePluginCount,
    priorities: context.motivation.priorities,
    constraints: context.motivation.constraints,
    opportunities: context.motivation.opportunities,
    appraisals: context.appraisals.map((appraisal) => ({
      key: appraisal.key,
      pluginId: appraisal.pluginId,
      score: appraisal.score,
      summary: appraisal.summary,
    })),
    hypotheses: context.hypotheses.map((hypothesis) => ({
      key: hypothesis.key,
      confidence: hypothesis.confidence,
      summary: hypothesis.summary,
    })),
  };
}

function formatContext(context: GameMasterPluginContext): string {
  const appraisals = context.appraisals
    .map(
      (appraisal) =>
        `- ${appraisal.key} (${appraisal.pluginId}): ${appraisal.summary} [score=${appraisal.score.toFixed(2)}]`
    )
    .join('\n');

  const priorities = context.motivation.priorities
    .map((priority) => `- ${priority}`)
    .join('\n');
  const constraints = context.motivation.constraints
    .map((constraint) => `- ${constraint}`)
    .join('\n');
  const hypotheses = context.hypotheses
    .map(
      (hypothesis) =>
        `- ${hypothesis.key}: ${hypothesis.summary} [confidence=${hypothesis.confidence.toFixed(2)}]`
    )
    .join('\n');

  return [
    '[GAME_MASTER_PLUGIN_CONTEXT]',
    `Active integrations: ${context.observability.activePluginIds.join(', ')}`,
    '',
    'Appraisals:',
    appraisals || '- None',
    '',
    'Priorities:',
    priorities || '- None',
    '',
    'Constraints:',
    constraints || '- None',
    '',
    'Hypotheses:',
    hypotheses || '- None',
    '[/GAME_MASTER_PLUGIN_CONTEXT]',
  ].join('\n');
}

export const gameMasterPluginProvider: Provider = {
  name: 'GAME_MASTER_PLUGIN_CONTEXT',
  description:
    'Exposes Halliday plugin-backed appraisals, motivations, and hypotheses for world orchestration',

  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const service =
      runtime.getService<GameMasterPluginService>('GAME_MASTER_PLUGIN');
    if (!service) {
      return { text: '' };
    }

    const pluginState = state.values as Record<string, unknown>;
    const gameMasterState = pluginState.gameMaster as
      | GameMasterPluginState
      | undefined;
    const snapshot =
      gameMasterState?.worldSnapshot ??
      ((message.content.metadata as Record<string, unknown> | undefined)
        ?.gameMasterWorldSnapshot as GameMasterPluginState['worldSnapshot']);

    if (!snapshot) {
      const latestContext = service.getLatestContext();
      if (!latestContext) {
        return {
          text: '[GAME_MASTER_PLUGIN_CONTEXT]\nNo Game Master world snapshot has been provided to this runtime yet.\n[/GAME_MASTER_PLUGIN_CONTEXT]',
        };
      }

      return {
        text: formatContext(latestContext),
        data: buildProviderData(latestContext),
      };
    }

    const context = await service.buildContext(snapshot);
    return {
      text: formatContext(context),
      data: buildProviderData(context),
    };
  },
};
