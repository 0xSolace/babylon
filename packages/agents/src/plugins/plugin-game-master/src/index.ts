import type { Plugin } from '@elizaos/core';
import { gameMasterPluginProvider } from './provider';
import { GameMasterPluginService } from './service';

export const gameMasterPluginRuntimeDependencies = [
  '@elizaos/plugin-homeostasis',
  '@elizaos/plugin-appraisal',
  '@elizaos/plugin-motivation',
  '@elizaos/plugin-neuro',
] as const;

export const gameMasterPlugin: Plugin = {
  name: 'game-master',
  description:
    'Optional Halliday world-orchestration wrapper that publishes Babylon game-master context into runtimes that may also mount homeostasis, appraisal, motivation, and neuro',
  services: [GameMasterPluginService],
  providers: [gameMasterPluginProvider],
  evaluators: [],
  actions: [],
  routes: [],
  dependencies: [],
  config: {},
};

export { gameMasterPluginProvider } from './provider';
export { GameMasterPluginService } from './service';
export * from './types';

export default gameMasterPlugin;
