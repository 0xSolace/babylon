import type { GameMasterWorldSnapshot } from '../types';
import {
  GAME_MASTER_PLUGIN_CATALOG,
  listActiveGameMasterPlugins,
} from './catalog';
import type {
  GameMasterAppraisal,
  GameMasterHypothesis,
  GameMasterMotivationContext,
  GameMasterPluginContext,
  GameMasterPluginId,
  GameMasterPluginSummary,
} from './types';

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createAppraisals(
  snapshot: GameMasterWorldSnapshot
): GameMasterAppraisal[] {
  const eventVelocity = clampScore(snapshot.recentWorldEvents.length / 3);
  const coveragePressure = clampScore(
    (snapshot.recentOrganizationPosts.length -
      snapshot.recentArticles.length +
      2) /
      5
  );
  const relationshipHeat = clampScore(
    snapshot.recentRelationshipChanges.length / 4
  );
  const notorietyPressure = clampScore(
    (snapshot.recentOrganizationPosts.length + snapshot.recentArticles.length) /
      8
  );
  const powerImbalance = clampScore(
    snapshot.recentOrganizationPosts.length > snapshot.recentArticles.length
      ? 0.7
      : 0.45
  );
  const narrativeCoherence = snapshot.currentTopic ? 0.7 : 0.25;
  const minutesSinceIntervention = snapshot.lastInterventionAt
    ? (Date.now() - snapshot.lastInterventionAt.getTime()) / 60000
    : 999;
  const interventionUrgency = clampScore(minutesSinceIntervention / 60);
  const opportunityDensity = clampScore(
    eventVelocity * 0.5 +
      coveragePressure * 0.3 +
      (1 - narrativeCoherence) * 0.2
  );
  const moneyPressure = clampScore(
    snapshot.recentArticles.length === 0 &&
      snapshot.recentOrganizationPosts.length > 0
      ? 0.55
      : 0.25
  );

  return [
    {
      key: 'power',
      pluginId: 'plugin-appraisal',
      score: powerImbalance,
      summary:
        powerImbalance > 0.6
          ? 'Organizations are out-framing the news cycle and may be dominating narrative leverage.'
          : 'Narrative leverage looks relatively balanced across institutions and coverage.',
    },
    {
      key: 'money',
      pluginId: 'plugin-appraisal',
      score: moneyPressure,
      summary:
        moneyPressure > 0.5
          ? 'Economic framing pressure is building and may need narrative shaping.'
          : 'Financial pressure signals are present but not driving the cycle yet.',
    },
    {
      key: 'notoriety',
      pluginId: 'plugin-appraisal',
      score: notorietyPressure,
      summary:
        notorietyPressure > 0.65
          ? 'The feed is concentrating attention on a small set of voices.'
          : 'Attention is present but not yet overly concentrated.',
    },
    {
      key: 'relationship',
      pluginId: 'plugin-appraisal',
      score: relationshipHeat,
      summary:
        relationshipHeat > 0.5
          ? 'Relationship dynamics are active enough to support rivalry-driven beats.'
          : 'Relationship motion is low and may need a gentle nudge.',
    },
    {
      key: 'opportunity',
      pluginId: 'plugin-appraisal',
      score: opportunityDensity,
      summary:
        opportunityDensity > 0.55
          ? 'There is a meaningful opening for Halliday to sharpen the current narrative.'
          : 'The world is stable; only light interventions are justified.',
    },
    {
      key: 'coverage',
      pluginId: 'plugin-newsreporter',
      score: coveragePressure,
      summary:
        coveragePressure > 0.55
          ? 'Coverage is lagging behind posting volume and needs article support.'
          : 'Coverage looks roughly proportional to world activity.',
    },
    {
      key: 'coherence',
      pluginId: 'plugin-investigator',
      score: 1 - narrativeCoherence,
      summary:
        narrativeCoherence < 0.5
          ? 'The world lacks a strong narrative center of gravity.'
          : 'The daily topic still provides a coherent narrative center.',
    },
    {
      key: 'urgency',
      pluginId: 'plugin-observatory',
      score: interventionUrgency,
      summary:
        interventionUrgency > 0.75
          ? 'Halliday has been quiet for long enough that the world could use a fresh push.'
          : 'Intervention urgency is controlled.',
    },
  ];
}

function buildMotivation(appraisals: GameMasterAppraisal[]) {
  const priorities: string[] = [];
  const constraints: string[] = [];
  const opportunities: string[] = [];

  const byKey = Object.fromEntries(
    appraisals.map((appraisal) => [appraisal.key, appraisal])
  ) as Record<GameMasterAppraisal['key'], GameMasterAppraisal | undefined>;

  if ((byKey.coherence?.score ?? 0) > 0.5) {
    priorities.push('Re-center the day around a clear topic and hook.');
  }
  if ((byKey.coverage?.score ?? 0) > 0.55) {
    priorities.push(
      'Increase article coverage before organizations monopolize the frame.'
    );
  }
  if ((byKey.notoriety?.score ?? 0) > 0.6) {
    priorities.push(
      'Distribute attention instead of letting a single cluster own the conversation.'
    );
  }
  if ((byKey.urgency?.score ?? 0) > 0.75) {
    priorities.push(
      'Restore visible motion because Halliday has been quiet for too long.'
    );
  }
  if ((byKey.relationship?.score ?? 0) < 0.35) {
    opportunities.push(
      'Seed light actor rivalry or disagreement to create fresh interpersonal tension.'
    );
  }
  if ((byKey.opportunity?.score ?? 0) > 0.55) {
    opportunities.push(
      'Use a focused, low-risk intervention batch to sharpen the narrative.'
    );
  }
  if ((byKey.money?.score ?? 0) > 0.5) {
    opportunities.push(
      'Lean into economic framing without touching price or market state.'
    );
  }

  constraints.push(
    'Do not mutate prices, market outcomes, or trading behavior.'
  );
  constraints.push('Keep v1 interventions narrative-only and admin-auditable.');

  return {
    priorities,
    constraints,
    opportunities,
  };
}

function buildHypotheses(
  snapshot: GameMasterWorldSnapshot,
  appraisals: GameMasterAppraisal[]
): GameMasterHypothesis[] {
  const hypotheses: GameMasterHypothesis[] = [];
  const coverage = appraisals.find((entry) => entry.key === 'coverage');
  const coherence = appraisals.find((entry) => entry.key === 'coherence');
  const urgency = appraisals.find((entry) => entry.key === 'urgency');

  if ((coverage?.score ?? 0) > 0.55) {
    hypotheses.push({
      key: 'coverage-gap',
      confidence: coverage!.score,
      summary:
        'Organizations are generating more narrative than the article layer is absorbing.',
    });
  }

  if ((coherence?.score ?? 0) > 0.5 || !snapshot.currentTopic) {
    hypotheses.push({
      key: 'weak-center-of-gravity',
      confidence: coherence?.score ?? 0.8,
      summary:
        'The day lacks a stable center of gravity, so Halliday should reinforce a clearer story spine.',
    });
  }

  if ((urgency?.score ?? 0) > 0.75) {
    hypotheses.push({
      key: 'narrative-stall',
      confidence: urgency!.score,
      summary:
        'Conversation motion is at risk of stalling unless Halliday injects a new angle soon.',
    });
  }

  if (snapshot.recentWorldEvents.length > 0) {
    hypotheses.push({
      key: 'event-to-story-window',
      confidence: 0.72,
      summary:
        'A fresh event can still be converted into a coherent article or posting wave.',
    });
  }

  return hypotheses;
}

function buildPluginSummaries(
  appraisals: GameMasterAppraisal[],
  additionalModeledPluginIds: readonly GameMasterPluginId[]
): GameMasterPluginSummary[] {
  const summaries = appraisals.map((appraisal) => {
    const definition = GAME_MASTER_PLUGIN_CATALOG[appraisal.pluginId];
    return {
      pluginId: appraisal.pluginId,
      status: definition.status,
      summary: appraisal.summary,
    };
  });

  const activeIds = new Set(summaries.map((summary) => summary.pluginId));
  for (const pluginId of additionalModeledPluginIds) {
    if (activeIds.has(pluginId)) continue;
    const definition = GAME_MASTER_PLUGIN_CATALOG[pluginId];
    summaries.push({
      pluginId,
      status: definition.status,
      summary: definition.rationale,
    });
    activeIds.add(pluginId);
  }

  for (const definition of listActiveGameMasterPlugins()) {
    if (activeIds.has(definition.id)) continue;
    summaries.push({
      pluginId: definition.id,
      status: definition.status,
      summary: definition.rationale,
    });
  }

  return summaries;
}

export function buildGameMasterPluginContextFromData(input: {
  appraisals: GameMasterAppraisal[];
  motivation: GameMasterMotivationContext;
  hypotheses: GameMasterHypothesis[];
  additionalModeledPluginIds?: GameMasterPluginId[];
}): GameMasterPluginContext {
  const additionalModeledPluginIds = input.additionalModeledPluginIds ?? [];
  const pluginSummaries = buildPluginSummaries(
    input.appraisals,
    additionalModeledPluginIds
  );
  const catalogActivePluginIds = listActiveGameMasterPlugins().map(
    (plugin) => plugin.id
  );
  const modeledPluginIds = new Set<GameMasterPluginId>(
    input.appraisals.map((appraisal) => appraisal.pluginId)
  );
  for (const pluginId of additionalModeledPluginIds) {
    modeledPluginIds.add(pluginId);
  }

  return {
    pluginSummaries,
    appraisals: input.appraisals,
    motivation: input.motivation,
    hypotheses: input.hypotheses,
    observability: {
      catalogActivePluginCount: catalogActivePluginIds.length,
      catalogActivePluginIds,
      modeledPluginCount: modeledPluginIds.size,
      modeledPluginIds: [...modeledPluginIds],
    },
  };
}

export function buildGameMasterPluginContext(
  snapshot: GameMasterWorldSnapshot
): GameMasterPluginContext {
  const appraisals = createAppraisals(snapshot);
  const motivation = buildMotivation(appraisals);
  const hypotheses = buildHypotheses(snapshot, appraisals);

  return buildGameMasterPluginContextFromData({
    appraisals,
    motivation,
    hypotheses,
    additionalModeledPluginIds: ['plugin-observatory'],
  });
}
