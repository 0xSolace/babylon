import { StaticDataRegistry } from '../services/static-data-registry';
import { secureRandom } from '../utils/entropy';
import { GAME_MASTER_DEFAULTS } from './constants';
import {
  type GameMasterPlan,
  gameMasterPlanSchema,
  type GameMasterTriggerAssessment,
  type GameMasterWorldSnapshot,
} from './types';

function pickRandom<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(secureRandom() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item !== undefined) picked.push(item);
  }
  return picked;
}

function buildTopicSummary(snapshot: GameMasterWorldSnapshot): string {
  if (!snapshot.currentTopic) {
    return 'No daily topic is set. The narrative needs a clear center of gravity.';
  }

  return `The day is centered on ${snapshot.currentTopic.topicLabel}. ${snapshot.currentTopic.summary}`;
}

function shouldEmitRandomLowRiskBatch(snapshot: GameMasterWorldSnapshot): boolean {
  if (!snapshot.lastInterventionAt) return true;

  const millisSinceLastIntervention =
    Date.now() - snapshot.lastInterventionAt.getTime();
  const minutesSinceLastIntervention = millisSinceLastIntervention / 60000;
  if (minutesSinceLastIntervention < GAME_MASTER_DEFAULTS.minQuietMinutes) {
    return false;
  }

  return secureRandom() < GAME_MASTER_DEFAULTS.pulseChance;
}

export class GameMasterPlanner {
  plan(
    snapshot: GameMasterWorldSnapshot,
    trigger: GameMasterTriggerAssessment
  ): GameMasterPlan {
    const actors = pickRandom(
      StaticDataRegistry.getAllActors().filter((actor) => !/\btest\b/i.test(actor.name)),
      2
    );
    const organizations = pickRandom(
      StaticDataRegistry.getAllOrganizations().filter(
        (org) => org.canBeInvolved !== false
      ),
      2
    );
    const latestEvent = snapshot.recentWorldEvents[0];
    const currentTopicLabel =
      snapshot.currentTopic?.topicLabel ?? 'the emerging market narrative';

    const actions: GameMasterPlan['actions'] = [];
    const observations = [
      buildTopicSummary(snapshot),
      latestEvent
        ? `The freshest public event is ${latestEvent.description}.`
        : 'There are no fresh public world events right now.',
      `There have been ${snapshot.recentActionCount} Game Master actions in the last hour.`,
    ];

    if (trigger.runType === 'daily') {
      if (!snapshot.currentTopic) {
        actions.push({
          actionType: 'SET_DAILY_TOPIC',
          authorityLevel: 'steer',
          targetType: 'world',
          instructionText: 'Establish a clear narrative topic for the new game day.',
          payload: {
            topicKey: 'market-sentiment',
            topicLabel: 'Market Sentiment',
            summary:
              'Anchor the day around competing interpretations of AI, markets, and institutional positioning.',
            selectionReason: 'Halliday daily pass selected a stable narrative center.',
          },
        });
      }

      if (actors.length > 0) {
        actions.push({
          actionType: 'INSTRUCT_ACTORS',
          authorityLevel: 'steer',
          targetType: 'actor',
          instructionText:
            'Push a small set of actors to sharpen the day narrative with stronger personal takes.',
          payload: {
            actorIds: actors.map((actor) => actor.id),
            promptOverlay: `Lean into ${currentTopicLabel}. Be opinionated, specific, and in character. Create momentum rather than repeating consensus.`,
            reason: 'Daily pass actor steering',
          },
        });
      }

      if (organizations.length > 0) {
        actions.push({
          actionType: 'INSTRUCT_ORGANIZATIONS',
          authorityLevel: 'suggest',
          targetType: 'organization',
          instructionText:
            'Encourage a few organizations to reinforce the daily narrative from their institutional voice.',
          payload: {
            organizationIds: organizations.map((org) => org.id),
            promptOverlay: `Frame today through ${currentTopicLabel}. Stay in your editorial or institutional voice and add a new angle.`,
            reason: 'Daily pass organization steering',
          },
        });
      }

      actions.push({
        actionType: 'QUEUE_ARTICLE_BRIEF',
        authorityLevel: 'suggest',
        targetType: 'system',
        instructionText:
          'Queue an editorial brief that helps article generation stay aligned with the day objective.',
        payload: {
          targetOrgIds: organizations.map((org) => org.id),
          targetActorIds: actors.map((actor) => actor.id),
          headlineAngle: `${currentTopicLabel}: who is shaping the day`,
          brief: `Focus coverage on ${currentTopicLabel}. Prioritize tension, rivalry, and institutions trying to control the interpretation of events.`,
          priority: 'high',
          category: 'news',
        },
      });
    } else if (latestEvent) {
      actions.push({
        actionType: 'QUEUE_ARTICLE_BRIEF',
        authorityLevel: 'steer',
        targetType: 'system',
        instructionText:
          'Turn the latest world event into an article or framing hook quickly.',
        payload: {
          targetOrgIds: organizations.map((org) => org.id),
          headlineAngle: latestEvent.description,
          brief: `Use the event "${latestEvent.description}" as the immediate hook, but tie it back to ${currentTopicLabel}.`,
          priority: 'high',
          category: 'breaking',
        },
      });
    } else if (
      trigger.runType === 'reactive' ||
      shouldEmitRandomLowRiskBatch(snapshot)
    ) {
      if (actors.length > 0) {
        actions.push({
          actionType: 'INSTRUCT_ACTORS',
          authorityLevel: 'suggest',
          targetType: 'actor',
          instructionText:
            'Nudge a small set of actors to reintroduce motion into the feed.',
          payload: {
            actorIds: actors.map((actor) => actor.id),
            promptOverlay: `Inject fresh tension into ${currentTopicLabel}. Say something that moves the conversation forward without breaking character.`,
            reason: 'Pulse-based narrative nudge',
          },
        });
      }

      if (organizations.length > 0) {
        actions.push({
          actionType: 'INSTRUCT_ORGANIZATIONS',
          authorityLevel: 'suggest',
          targetType: 'organization',
          instructionText:
            'Ask one or two organizations to provide a sharper framing on the current narrative.',
          payload: {
            organizationIds: organizations.map((org) => org.id).slice(0, 1),
            promptOverlay: `Offer a concise institutional read on ${currentTopicLabel}. Add framing, not repetition.`,
            reason: 'Pulse-based organization nudge',
          },
        });
      }
    }

    const actionBudget = actions.slice(0, GAME_MASTER_DEFAULTS.maxLowRiskBatchSize + 2);

    return gameMasterPlanSchema.parse({
      dailyObjective: `Keep the world converging on ${currentTopicLabel} while preserving conflict and motion.`,
      worldSummary: observations.join(' '),
      observationSummary: observations.join(' '),
      planSummary: `Halliday is running a ${trigger.runType} pass with ${actionBudget.length} candidate interventions.`,
      actions: actionBudget,
    });
  }
}

export const gameMasterPlanner = new GameMasterPlanner();
