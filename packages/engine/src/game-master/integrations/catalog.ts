import type { GameMasterPluginDefinition, GameMasterPluginId } from './types';

export const GAME_MASTER_PLUGIN_CATALOG: Record<
  GameMasterPluginId,
  GameMasterPluginDefinition
> = {
  'plugin-homeostasis': {
    id: 'plugin-homeostasis',
    status: 'active',
    capability: 'internal drives and resource stress',
    rationale:
      'Halliday now maps world-state pressure into homeostasis-style stress signals so motivation can consume a normalized internal state.',
  },
  'plugin-appraisal': {
    id: 'plugin-appraisal',
    status: 'active',
    capability: 'typed world-state appraisal registry',
    rationale:
      'Best fit for converting raw Babylon snapshot data into reusable Halliday state.',
  },
  'plugin-motivation': {
    id: 'plugin-motivation',
    status: 'active',
    capability: 'priorities, constraints, and opportunities',
    rationale:
      'Halliday needs a motivational layer above appraisals so actions come from ranked concerns rather than ad hoc rules.',
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
    status: 'active',
    capability: 'hypotheses, narrative synthesis, and cognitive memory',
    rationale:
      'Directly improves Halliday’s ability to form and update world-level narrative theories.',
  },
  'plugin-opportunity': {
    id: 'plugin-opportunity',
    status: 'active',
    capability: 'opportunity detection',
    rationale:
      'Maps cleanly to identifying where Halliday can inject pressure or attention next.',
  },
  'plugin-investigator': {
    id: 'plugin-investigator',
    status: 'active',
    capability: 'story sensing and event tracking',
    rationale: 'Strong fit for article and world-event sensing.',
  },
  'plugin-newsreporter': {
    id: 'plugin-newsreporter',
    status: 'active',
    capability: 'coverage cadence and anti-spam reporting',
    rationale:
      'Improves how Halliday shapes article output without repetitive briefs.',
  },
  'plugin-power': {
    id: 'plugin-power',
    status: 'active',
    capability: 'influence and leverage appraisal',
    rationale:
      'Useful for deciding which actors and organizations Halliday should push or destabilize.',
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
    status: 'active',
    capability: 'visibility and reputation appraisal',
    rationale:
      'Useful for selecting amplification targets and narrative protagonists.',
  },
  'plugin-relationship': {
    id: 'plugin-relationship',
    status: 'active',
    capability: 'relationship health appraisal',
    rationale:
      'Babylon already has relationship state; Halliday benefits from a derived relationship heat signal.',
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
    status: 'active',
    capability: 'engagement and churn signals',
    rationale:
      'Useful for measuring whether the current narrative is landing or stalling.',
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
    rationale: 'Directly useful for Halliday operator trust and debugging.',
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
