import type { Plugin } from '@elizaos/core';
import { gameMasterPluginProvider } from './provider';
import { GameMasterPluginService } from './service';

export const gameMasterPluginPrimaryRuntimeDependencies = [
  '@elizaos/plugin-appraisal',
] as const;

export const gameMasterPluginSecondaryRuntimeDependencies = [
  '@elizaos/plugin-homeostasis',
  '@elizaos/plugin-motivation',
  '@elizaos/plugin-neuro',
] as const;

export const gameMasterPluginRuntimeDependencies = [
  ...gameMasterPluginPrimaryRuntimeDependencies,
  ...gameMasterPluginSecondaryRuntimeDependencies,
] as const;

export const gameMasterPlugin: Plugin = {
  name: 'game-master',
  description:
    'Optional Halliday runtime wrapper that resolves Babylon world-state into plugin context, with appraisal as the primary runtime dependency and homeostasis/motivation/neuro as secondary enrichments',
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
