import type { Plugin } from '@elizaos/core';
import { appraisalPlugin } from '@elizaos/plugin-appraisal';
import { homeostasisPlugin } from '@elizaos/plugin-homeostasis';
import { motivationPlugin } from '@elizaos/plugin-motivation';
import { neuroPlugin } from '@elizaos/plugin-neuro';
import { gameMasterPluginProvider } from './provider';
import { GameMasterPluginService } from './service';

export const gameMasterPluginRuntimeDependencies = [
  '@elizaos/plugin-homeostasis',
  '@elizaos/plugin-appraisal',
  '@elizaos/plugin-motivation',
  '@elizaos/plugin-neuro',
] as const;

const composedPlugins = [
  homeostasisPlugin,
  appraisalPlugin,
  motivationPlugin,
  neuroPlugin,
] as const;

export const gameMasterPlugin: Plugin = {
  name: 'game-master',
  description:
    'Halliday world-orchestration plugin that composes homeostasis, appraisal, motivation, and neuro with Babylon game-master context',
  services: [
    ...composedPlugins.flatMap((plugin) => plugin.services ?? []),
    GameMasterPluginService,
  ],
  providers: [
    gameMasterPluginProvider,
    ...composedPlugins.flatMap((plugin) => plugin.providers ?? []),
  ],
  evaluators: composedPlugins.flatMap((plugin) => plugin.evaluators ?? []),
  actions: composedPlugins.flatMap((plugin) => plugin.actions ?? []),
  routes: Object.assign(
    {},
    ...composedPlugins.map((plugin) => plugin.routes ?? {})
  ),
  dependencies: composedPlugins.flatMap((plugin) => plugin.dependencies ?? []),
  config: Object.assign(
    {},
    ...composedPlugins.map((plugin) => plugin.config ?? {})
  ),
};

export { gameMasterPluginProvider } from './provider';
export { GameMasterPluginService } from './service';
export * from './types';

export default gameMasterPlugin;
