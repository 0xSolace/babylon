export const GAME_MASTER_PLUGIN_IDS = [
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
] as const;

export type GameMasterPluginId = (typeof GAME_MASTER_PLUGIN_IDS)[number];

export type GameMasterPluginStatus = 'active' | 'advisory' | 'inactive';

export interface GameMasterPluginDefinition {
  id: GameMasterPluginId;
  status: GameMasterPluginStatus;
  capability: string;
  rationale: string;
}

export interface GameMasterPluginSummary {
  pluginId: GameMasterPluginId;
  status: GameMasterPluginStatus;
  summary: string;
}

export interface GameMasterAppraisal {
  key:
    | 'power'
    | 'money'
    | 'notoriety'
    | 'relationship'
    | 'opportunity'
    | 'coverage'
    | 'coherence'
    | 'urgency';
  pluginId: GameMasterPluginId;
  score: number;
  summary: string;
}

export interface GameMasterMotivationContext {
  priorities: string[];
  constraints: string[];
  opportunities: string[];
}

export interface GameMasterHypothesis {
  key: string;
  confidence: number;
  summary: string;
}

export interface GameMasterPluginContext {
  pluginSummaries: GameMasterPluginSummary[];
  appraisals: GameMasterAppraisal[];
  motivation: GameMasterMotivationContext;
  hypotheses: GameMasterHypothesis[];
  observability: {
    catalogActivePluginCount: number;
    catalogActivePluginIds: GameMasterPluginId[];
    modeledPluginCount: number;
    modeledPluginIds: GameMasterPluginId[];
  };
}

export interface ResolvedGameMasterPluginContext {
  source: 'engine_modeled' | 'runtime_plugin';
  resolvedAt: Date;
  context: GameMasterPluginContext;
}
