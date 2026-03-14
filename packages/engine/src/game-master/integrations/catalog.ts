import type { GameMasterPluginDefinition, GameMasterPluginId } from './types';

export const GAME_MASTER_PLUGIN_CATALOG: Record<
  GameMasterPluginId,
  GameMasterPluginDefinition
> = {
  'plugin-homeostasis': {
    id: 'plugin-homeostasis',
    status: 'advisory',
    capability: 'internal drives and resource stress',
    rationale:
      'Useful as a secondary runtime enrichment, but Halliday should not depend on internal-drive simulation for core planning.',
  },
  'plugin-appraisal': {
    id: 'plugin-appraisal',
    status: 'active',
    capability: 'typed world-state appraisal registry',
    rationale:
      'Primary structured scoring source for Halliday world-state interpretation.',
  },
  'plugin-motivation': {
    id: 'plugin-motivation',
    status: 'advisory',
    capability: 'priorities, constraints, and opportunities',
    rationale:
      'Useful as an optional secondary interpreter, but not required for Halliday’s minimal correct architecture.',
  },
  'plugin-goals': {
    id: 'plugin-goals',
    status: 'advisory',
    capability: 'goal tracking and follow-through',
    rationale:
      'Useful for future multi-step Halliday campaigns, but not the core world steering loop.',
  },
  'plugin-autonomous': {
    id: 'plugin-autonomous',
    status: 'advisory',
    capability: 'batched planning and orchestration',
    rationale:
      'Halliday already has cron cadence and typed actions; only the planning discipline is directly relevant.',
  },
  'plugin-neuro': {
    id: 'plugin-neuro',
    status: 'advisory',
    capability: 'hypotheses, narrative synthesis, and cognitive memory',
    rationale:
      'Useful for future richer hypothesis memory, but not required for lean Halliday planning.',
  },
  'plugin-opportunity': {
    id: 'plugin-opportunity',
    status: 'advisory',
    capability: 'opportunity detection',
    rationale:
      'Its signal can be represented through appraisal outputs without Halliday depending on a separate first-class plugin.',
  },
  'plugin-investigator': {
    id: 'plugin-investigator',
    status: 'active',
    capability: 'story sensing and event tracking',
    rationale:
      'Primary story-sensing source for Halliday event and narrative coherence analysis.',
  },
  'plugin-newsreporter': {
    id: 'plugin-newsreporter',
    status: 'active',
    capability: 'coverage cadence and anti-spam reporting',
    rationale:
      'Primary coverage-gap and article-brief shaping source for Halliday.',
  },
  'plugin-power': {
    id: 'plugin-power',
    status: 'advisory',
    capability: 'influence and leverage appraisal',
    rationale:
      'Best represented as a domain inside plugin-appraisal for Halliday rather than a separate required planning dependency.',
  },
  'plugin-money': {
    id: 'plugin-money',
    status: 'advisory',
    capability: 'resource and money appraisal',
    rationale:
      'Only relevant for narrative and pressure analysis because Halliday must not manipulate markets directly.',
  },
  'plugin-notoriety': {
    id: 'plugin-notoriety',
    status: 'advisory',
    capability: 'visibility and reputation appraisal',
    rationale:
      'Useful as an appraisal domain, but not a required first-class Halliday plugin.',
  },
  'plugin-relationship': {
    id: 'plugin-relationship',
    status: 'advisory',
    capability: 'relationship health appraisal',
    rationale:
      'Halliday can consume relationship heat via appraisals without depending on a dedicated first-class relationship plugin.',
  },
  'plugin-health': {
    id: 'plugin-health',
    status: 'advisory',
    capability: 'aggregated wellbeing state',
    rationale:
      'Can be adapted into narrative health rather than literal agent health.',
  },
  'plugin-rolodex': {
    id: 'plugin-rolodex',
    status: 'advisory',
    capability: 'entities and associations',
    rationale:
      'Babylon already tracks actors and orgs, but richer graph metadata could be useful later.',
  },
  'plugin-pim': {
    id: 'plugin-pim',
    status: 'inactive',
    capability: 'tasks and reminders',
    rationale:
      'Administrative utility only, not a Halliday narrative core feature.',
  },
  'plugin-trust': {
    id: 'plugin-trust',
    status: 'advisory',
    capability: 'trust and permission controls',
    rationale:
      'Potentially useful for admin approval policy, but not part of Halliday narrative quality.',
  },
  'plugin-presence': {
    id: 'plugin-presence',
    status: 'advisory',
    capability: 'real-time presence and availability',
    rationale: 'Helpful when Babylon exposes stronger live activity signals.',
  },
  'plugin-skills': {
    id: 'plugin-skills',
    status: 'inactive',
    capability: 'capability inventory',
    rationale: 'Halliday currently steers narrative, not skill dispatch.',
  },
  'plugin-discovery': {
    id: 'plugin-discovery',
    status: 'inactive',
    capability: 'capability discovery',
    rationale:
      'Halliday is internal-only and does not need conversational discovery.',
  },
  'plugin-attract': {
    id: 'plugin-attract',
    status: 'advisory',
    capability: 'proactive engagement cadence',
    rationale:
      'Useful as a cadence pattern, but Halliday already owns its pulse loop.',
  },
  'plugin-engagement': {
    id: 'plugin-engagement',
    status: 'advisory',
    capability: 'engagement and churn signals',
    rationale:
      'Useful as a secondary signal, but not part of the lean core Halliday planning stack.',
  },
  'plugin-wrapped': {
    id: 'plugin-wrapped',
    status: 'inactive',
    capability: 'retrospective storytelling',
    rationale: 'No immediate Halliday planning value.',
  },
  'plugin-commerce': {
    id: 'plugin-commerce',
    status: 'inactive',
    capability: 'economic agency',
    rationale: 'Halliday should not become an economic actor in v1.',
  },
  'plugin-expertise': {
    id: 'plugin-expertise',
    status: 'inactive',
    capability: 'expert service delivery primitives',
    rationale: 'Not a fit for Halliday world orchestration.',
  },
  'plugin-solana': {
    id: 'plugin-solana',
    status: 'inactive',
    capability: 'Solana execution',
    rationale: 'Explicitly out of scope for Halliday narrative control.',
  },
  'plugin-evm': {
    id: 'plugin-evm',
    status: 'inactive',
    capability: 'EVM execution',
    rationale: 'Explicitly out of scope for Halliday narrative control.',
  },
  'plugin-agent-factory': {
    id: 'plugin-agent-factory',
    status: 'inactive',
    capability: 'agent creation and refinement',
    rationale: 'Halliday steers the world; it does not create agents.',
  },
  'plugin-digitaltwin': {
    id: 'plugin-digitaltwin',
    status: 'advisory',
    capability: 'persona and audience modeling',
    rationale:
      'Potentially useful later for modeling recurring humans, not a core Halliday need now.',
  },
  'plugin-observatory': {
    id: 'plugin-observatory',
    status: 'active',
    capability: 'provider observability and influence tracing',
    rationale:
      'Primary operator-trust and planning-trace surface for Halliday.',
  },
  'plugin-rss': {
    id: 'plugin-rss',
    status: 'advisory',
    capability: 'external feed ingestion',
    rationale:
      'Only useful if Babylon later expands Halliday into external signal intake.',
  },
};

export function listActiveGameMasterPlugins(): GameMasterPluginDefinition[] {
  return Object.values(GAME_MASTER_PLUGIN_CATALOG).filter(
    (plugin) => plugin.status === 'active'
  );
}
