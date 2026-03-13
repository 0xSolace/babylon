import {
  actorRelationships,
  and,
  chats,
  count,
  dailyTopics,
  db,
  desc,
  eq,
  gameConfigs,
  gameMasterActions,
  gameMasterDirectives,
  gameMasterRuns,
  games,
  gt,
  gte,
  inArray,
  isNull,
  messages,
  or,
  posts,
  sql,
  type JsonValue,
  worldEvents,
  type DailyTopicSourceType,
} from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import { npcMemoryService } from '../services/npc-memory-service';
import { broadcastToChannel } from '../services/realtime-broadcaster';
import { DistributedLockService } from '../services/distributed-lock-service';
import { GAME_MASTER_CONTROL_CHAT_IDS, GAME_MASTER_DEFAULTS, GAME_MASTER_NAME, GAME_MASTER_SENDER_ID } from './constants';
import { gameMasterPlanner } from './planner';
import { gameMasterPolicyEngine } from './policy';
import {
  type GameMasterPlan,
  type GameMasterTriggerAssessment,
  type GameMasterWorldSnapshot,
  type GameMasterRunType,
} from './types';

type GameMasterDirectiveFilter = {
  directiveType?: 'actor_instruction' | 'organization_instruction' | 'article_brief' | 'market_narrative';
  targetType?: 'actor' | 'organization' | 'question' | 'world' | 'system';
  targetId?: string;
};

export interface GameMasterDashboard {
  enabled: boolean;
  autoRunEnabled: boolean;
  autoRunPausedUntil: string | null;
  currentDay: number | null;
  latestRuns: Array<{
    id: string;
    gameDay: number;
    runType: GameMasterRunType;
    status: string;
    triggerType: string | null;
    planSummary: string | null;
    startedAt: string;
    completedAt: string | null;
  }>;
  pendingActions: Array<{
    id: string;
    runId: string;
    actionType: string;
    authorityLevel: string;
    riskLevel: string;
    targetType: string;
    instructionText: string;
    status: string;
    requiresApproval: boolean;
    approvalReason: string | null;
    createdAt: string;
  }>;
  activeDirectives: Array<{
    id: string;
    directiveType: string;
    targetType: string;
    targetId: string;
    authorityLevel: string;
    promptOverlay: string;
    expiresAt: string | null;
  }>;
  recentMessages: Array<{
    id: string;
    chatId: string;
    content: string;
    createdAt: string;
  }>;
  hourlyAutoActionCount: number;
}

function envFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function normalizeDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function parseConfigTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class GameMasterService {
  isEnabled(): boolean {
    return envFlag(process.env.GAME_MASTER_ENABLED, true);
  }

  isAutoRunEnabled(): boolean {
    return envFlag(process.env.GAME_MASTER_AUTORUN_ENABLED, true);
  }

  async isAutoRunActive(): Promise<boolean> {
    if (!this.isAutoRunEnabled()) return false;
    const pauseUntil = await this.getPauseUntil();
    if (!pauseUntil) return true;
    return pauseUntil.getTime() <= Date.now();
  }

  private async getPauseUntil(): Promise<Date | null> {
    const [config] = await db
      .select({ value: gameConfigs.value })
      .from(gameConfigs)
      .where(eq(gameConfigs.key, 'game_master_auto_run_paused_until'))
      .limit(1);

    return parseConfigTimestamp(config?.value);
  }

  async setAutoRunPaused(paused: boolean): Promise<void> {
    const key = 'game_master_auto_run_paused_until';
    const now = new Date();
    const value = paused ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
    const [existing] = await db
      .select({ id: gameConfigs.id })
      .from(gameConfigs)
      .where(eq(gameConfigs.key, key))
      .limit(1);

    if (existing) {
      await db
        .update(gameConfigs)
        .set({
          value,
          updatedAt: now,
        })
        .where(eq(gameConfigs.id, existing.id));
      return;
    }

    await db.insert(gameConfigs).values({
      id: await generateSnowflakeId(),
      key,
      value,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async getCurrentGameState() {
    const [game] = await db
      .select({
        id: games.id,
        currentDay: games.currentDay,
        isRunning: games.isRunning,
      })
      .from(games)
      .where(eq(games.isContinuous, true))
      .limit(1);

    return game ?? null;
  }

  private async buildSnapshot(): Promise<GameMasterWorldSnapshot | null> {
    const game = await this.getCurrentGameState();
    if (!game) return null;

    const now = new Date();
    const recentCutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const hourCutoff = new Date(now.getTime() - 60 * 60 * 1000);
    const today = normalizeDate(now);

    const [topic, recentEvents, recentArticles, recentOrgPosts, relationships, lastRun, lastExecuted, recentActionCountResult] =
      await Promise.all([
        db
          .select({
            topicKey: dailyTopics.topicKey,
            topicLabel: dailyTopics.topicLabel,
            summary: dailyTopics.summary,
            isLocked: dailyTopics.isLocked,
          })
          .from(dailyTopics)
          .where(eq(dailyTopics.date, today))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({
            id: worldEvents.id,
            eventType: worldEvents.eventType,
            description: worldEvents.description,
            actors: worldEvents.actors,
            relatedQuestion: worldEvents.relatedQuestion,
            timestamp: worldEvents.timestamp,
          })
          .from(worldEvents)
          .where(gte(worldEvents.timestamp, recentCutoff))
          .orderBy(desc(worldEvents.timestamp))
          .limit(8),
        db
          .select({
            id: posts.id,
            title: posts.articleTitle,
            authorId: posts.authorId,
            timestamp: posts.timestamp,
            relatedQuestion: posts.relatedQuestion,
          })
          .from(posts)
          .where(and(eq(posts.type, 'article'), gte(posts.timestamp, recentCutoff)))
          .orderBy(desc(posts.timestamp))
          .limit(8),
        db
          .select({
            id: posts.id,
            authorId: posts.authorId,
            timestamp: posts.timestamp,
          })
          .from(posts)
          .where(and(eq(posts.type, 'post'), gte(posts.timestamp, recentCutoff)))
          .orderBy(desc(posts.timestamp))
          .limit(16),
        db
          .select({
            id: actorRelationships.id,
            actor1Id: actorRelationships.actor1Id,
            actor2Id: actorRelationships.actor2Id,
            strength: actorRelationships.strength,
            sentiment: actorRelationships.sentiment,
            updatedAt: actorRelationships.updatedAt,
          })
          .from(actorRelationships)
          .where(gte(actorRelationships.updatedAt, recentCutoff))
          .orderBy(desc(actorRelationships.updatedAt))
          .limit(8),
        db
          .select({
            startedAt: gameMasterRuns.startedAt,
          })
          .from(gameMasterRuns)
          .orderBy(desc(gameMasterRuns.startedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({
            executedAt: gameMasterActions.executedAt,
          })
          .from(gameMasterActions)
          .where(eq(gameMasterActions.status, 'executed'))
          .orderBy(desc(gameMasterActions.executedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({ count: count() })
          .from(gameMasterActions)
          .where(
            and(
              eq(gameMasterActions.status, 'executed'),
              gte(gameMasterActions.executedAt, hourCutoff)
            )
          )
          .then((rows) => rows[0]?.count ?? 0),
      ]);

    return {
      gameId: game.id,
      gameDay: game.currentDay,
      isRunning: game.isRunning,
      currentTopic: topic,
      recentWorldEvents: recentEvents,
      recentArticles,
      recentOrganizationPosts: recentOrgPosts,
      recentRelationshipChanges: relationships,
      lastRunAt: lastRun?.startedAt ?? null,
      lastInterventionAt: lastExecuted?.executedAt ?? null,
      recentActionCount: recentActionCountResult,
    };
  }

  private async assessTrigger(
    snapshot: GameMasterWorldSnapshot
  ): Promise<GameMasterTriggerAssessment> {
    const now = new Date();
    const [dailyRun] = await db
      .select({ id: gameMasterRuns.id })
      .from(gameMasterRuns)
      .where(
        and(
          eq(gameMasterRuns.gameDay, snapshot.gameDay),
          eq(gameMasterRuns.runType, 'daily')
        )
      )
      .limit(1);

    if (!dailyRun) {
      return {
        runType: 'daily',
        triggerType: 'new_game_day',
        triggerData: { gameDay: snapshot.gameDay },
        shouldPlan: true,
      };
    }

    if (!snapshot.lastInterventionAt) {
      return {
        runType: 'reactive',
        triggerType: 'no_prior_interventions',
        triggerData: {},
        shouldPlan: true,
      };
    }

    const minutesSinceIntervention =
      (now.getTime() - snapshot.lastInterventionAt.getTime()) / 60000;

    if (minutesSinceIntervention >= GAME_MASTER_DEFAULTS.maxSilenceMinutes) {
      return {
        runType: 'reactive',
        triggerType: 'long_silence',
        triggerData: { minutesSinceIntervention },
        shouldPlan: true,
      };
    }

    if (
      snapshot.lastRunAt &&
      snapshot.recentWorldEvents.some(
        (event) => event.timestamp.getTime() > snapshot.lastRunAt!.getTime()
      )
    ) {
      return {
        runType: 'reactive',
        triggerType: 'fresh_world_event',
        triggerData: { latestEventId: snapshot.recentWorldEvents[0]?.id ?? null },
        shouldPlan: true,
      };
    }

    return {
      runType: 'pulse',
      triggerType: 'scheduled_pulse',
      triggerData: {},
      shouldPlan: true,
    };
  }

  private async ensureControlChat(chatId: string, name: string): Promise<void> {
    const [existing] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (existing) return;

    const now = new Date();
    await db.insert(chats).values({
      id: chatId,
      name,
      description: 'Internal Game Master control thread',
      isGroup: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async writeControlMessage(chatId: string, content: string): Promise<void> {
    await this.ensureControlChat(
      chatId,
      chatId === GAME_MASTER_CONTROL_CHAT_IDS.timeline
        ? `${GAME_MASTER_NAME} Timeline`
        : `${GAME_MASTER_NAME} Actions`
    );

    const now = new Date();
    await db.execute(sql`
      insert into "Message" ("id", "chatId", "senderId", "content", "type", "createdAt")
      values (
        ${await generateSnowflakeId()},
        ${chatId},
        ${GAME_MASTER_SENDER_ID},
        ${content},
        ${'system'},
        ${now.toISOString()}
      )
    `);

    await db.update(chats).set({ updatedAt: now }).where(eq(chats.id, chatId));
  }

  private async getHourlyAutoActionCount(): Promise<number> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const [result] = await db
      .select({ count: count() })
      .from(gameMasterActions)
      .where(
        and(
          eq(gameMasterActions.status, 'executed'),
          gte(gameMasterActions.executedAt, cutoff)
        )
      );

    return result?.count ?? 0;
  }

  private async materializeDirective(
    actionId: string,
    directiveType: 'actor_instruction' | 'organization_instruction' | 'article_brief' | 'market_narrative',
    targetType: 'actor' | 'organization' | 'question' | 'system',
    targetId: string,
    authorityLevel: 'suggest' | 'steer' | 'override',
    promptOverlay: string,
    metadata: JsonValue,
    expiresAt?: Date | null
  ): Promise<void> {
    const now = new Date();
    await db.insert(gameMasterDirectives).values({
      id: await generateSnowflakeId(),
      sourceActionId: actionId,
      directiveType,
      targetType,
      targetId,
      authorityLevel,
      promptOverlay,
      metadata,
      startsAt: now,
      expiresAt: expiresAt ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async executeActionRecord(actionId: string): Promise<void> {
    const [record] = await db
      .select()
      .from(gameMasterActions)
      .where(eq(gameMasterActions.id, actionId))
      .limit(1);

    if (!record) {
      throw new Error(`Game Master action ${actionId} not found`);
    }

    if (record.status === 'executed') return;
    if (record.status === 'awaiting_approval' || record.status === 'rejected') {
      return;
    }

    const now = new Date();
    await db
      .update(gameMasterActions)
      .set({
        status: 'executing',
        updatedAt: now,
      })
      .where(eq(gameMasterActions.id, actionId));

    const payload = record.payload as Record<string, JsonValue>;
    const executionSummary: Record<string, JsonValue> = {};

    try {
      switch (record.actionType) {
        case 'INSTRUCT_ACTORS': {
          const actorIds = ((payload.actorIds as string[]) ?? []).filter(Boolean);
          const promptOverlay = String(payload.promptOverlay ?? '').trim();
          const expiresAt = payload.expiresAt
            ? new Date(String(payload.expiresAt))
            : endOfUtcDay(now);

          for (const actorId of actorIds) {
            await this.materializeDirective(
              actionId,
              'actor_instruction',
              'actor',
              actorId,
              record.authorityLevel,
              promptOverlay,
              payload,
              expiresAt
            );
          }
          executionSummary.targetCount = actorIds.length;
          break;
        }
        case 'INSTRUCT_ORGANIZATIONS': {
          const organizationIds = ((payload.organizationIds as string[]) ?? []).filter(Boolean);
          const promptOverlay = String(payload.promptOverlay ?? '').trim();
          const expiresAt = payload.expiresAt
            ? new Date(String(payload.expiresAt))
            : endOfUtcDay(now);

          for (const organizationId of organizationIds) {
            await this.materializeDirective(
              actionId,
              'organization_instruction',
              'organization',
              organizationId,
              record.authorityLevel,
              promptOverlay,
              payload,
              expiresAt
            );
          }
          executionSummary.targetCount = organizationIds.length;
          break;
        }
        case 'QUEUE_ARTICLE_BRIEF': {
          const expiresAt = payload.expiresAt
            ? new Date(String(payload.expiresAt))
            : endOfUtcDay(now);
          await this.materializeDirective(
            actionId,
            'article_brief',
            'system',
            'articles',
            record.authorityLevel,
            String(payload.brief ?? ''),
            payload,
            expiresAt
          );
          executionSummary.target = 'articles';
          break;
        }
        case 'SET_MARKET_NARRATIVE_BRIEF': {
          const expiresAt = payload.expiresAt
            ? new Date(String(payload.expiresAt))
            : endOfUtcDay(now);
          const questionIds = ((payload.questionIds as string[]) ?? []).filter(Boolean);
          const organizationIds = ((payload.organizationIds as string[]) ?? []).filter(Boolean);

          for (const questionId of questionIds) {
            await this.materializeDirective(
              actionId,
              'market_narrative',
              'question',
              questionId,
              record.authorityLevel,
              String(payload.brief ?? ''),
              payload,
              expiresAt
            );
          }

          for (const organizationId of organizationIds) {
            await this.materializeDirective(
              actionId,
              'market_narrative',
              'organization',
              organizationId,
              record.authorityLevel,
              String(payload.brief ?? ''),
              payload,
              expiresAt
            );
          }
          executionSummary.targetCount = questionIds.length + organizationIds.length;
          break;
        }
        case 'SET_DAILY_TOPIC': {
          const normalizedDate = normalizeDate(now);
          const topicKey = String(payload.topicKey ?? '').trim();
          const topicLabel = String(payload.topicLabel ?? '').trim();
          const summary = String(payload.summary ?? '').trim();
          const selectionReason = String(payload.selectionReason ?? '').trim();
          const [existing] = await db
            .select({ id: dailyTopics.id })
            .from(dailyTopics)
            .where(eq(dailyTopics.date, normalizedDate))
            .limit(1);

          const sourceType: DailyTopicSourceType = 'manual_override';
          if (existing) {
            await db
              .update(dailyTopics)
              .set({
                topicKey,
                topicLabel,
                summary,
                sourceType,
                sourceHeadlineIds: [],
                selectionReason,
                isLocked: true,
                updatedAt: now,
              })
              .where(eq(dailyTopics.id, existing.id));
          } else {
            await db.insert(dailyTopics).values({
              id: await generateSnowflakeId(),
              date: normalizedDate,
              topicKey,
              topicLabel,
              summary,
              sourceType,
              sourceHeadlineIds: [],
              selectionReason,
              isLocked: true,
              createdAt: now,
              updatedAt: now,
            });
          }
          executionSummary.topicKey = topicKey;
          break;
        }
        case 'QUEUE_WORLD_EVENT': {
          await db.insert(worldEvents).values({
            id: await generateSnowflakeId(),
            eventType: String(payload.eventType ?? 'game_master'),
            description: String(payload.description ?? ''),
            actors: ((payload.actorIds as string[]) ?? []).filter(Boolean),
            relatedQuestion:
              typeof payload.relatedQuestion === 'number'
                ? payload.relatedQuestion
                : null,
            visibility: String(payload.visibility ?? 'public'),
            timestamp: now,
            createdAt: now,
          });
          executionSummary.created = true;
          break;
        }
        case 'SHIFT_RELATIONSHIP': {
          const actorAId = String(payload.actorAId ?? '');
          const actorBId = String(payload.actorBId ?? '');
          const sentimentDelta = Number(payload.sentimentDelta ?? 0);
          const strengthDelta = Number(payload.strengthDelta ?? 0);
          const note = String(payload.note ?? '').trim();

          await npcMemoryService.updateRelationship(actorAId, actorBId, {
            sentimentChange: sentimentDelta,
            note,
          });
          await npcMemoryService.updateRelationship(actorBId, actorAId, {
            sentimentChange: sentimentDelta,
            note,
          });

          const [existing] = await db
            .select()
            .from(actorRelationships)
            .where(
              sql`(${actorRelationships.actor1Id} = ${actorAId} and ${actorRelationships.actor2Id} = ${actorBId}) or (${actorRelationships.actor1Id} = ${actorBId} and ${actorRelationships.actor2Id} = ${actorAId})`
            )
            .limit(1);

          if (existing) {
            await db
              .update(actorRelationships)
              .set({
                sentiment: Math.max(-1, Math.min(1, existing.sentiment + sentimentDelta)),
                strength: Math.max(0, Math.min(1, existing.strength + strengthDelta)),
                history: note || existing.history,
                updatedAt: now,
                lastInteraction: now,
                interactionCount: existing.interactionCount + 1,
                evolutionCount: existing.evolutionCount + 1,
              })
              .where(eq(actorRelationships.id, existing.id));
          } else {
            await db.insert(actorRelationships).values({
              id: await generateSnowflakeId(),
              actor1Id: actorAId,
              actor2Id: actorBId,
              relationshipType: 'game_master_shift',
              strength: Math.max(0, Math.min(1, 0.5 + strengthDelta)),
              sentiment: Math.max(-1, Math.min(1, sentimentDelta)),
              isPublic: true,
              history: note,
              createdAt: now,
              updatedAt: now,
              lastInteraction: now,
              interactionCount: 1,
              evolutionCount: 1,
            });
          }

          executionSummary.actorPair = [actorAId, actorBId];
          break;
        }
        default:
          throw new Error(`Unsupported Game Master action: ${record.actionType}`);
      }

      await db
        .update(gameMasterActions)
        .set({
          status: 'executed',
          executedAt: now,
          executionResult: executionSummary as JsonValue,
          updatedAt: now,
        })
        .where(eq(gameMasterActions.id, actionId));

      await this.writeControlMessage(
        GAME_MASTER_CONTROL_CHAT_IDS.actions,
        `${GAME_MASTER_NAME} executed ${record.actionType}: ${record.instructionText}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown execution error';
      await db
        .update(gameMasterActions)
        .set({
          status: 'failed',
          failedAt: now,
          error: errorMessage,
          updatedAt: now,
        })
        .where(eq(gameMasterActions.id, actionId));
      throw error;
    }
  }

  private async persistRun(
    snapshot: GameMasterWorldSnapshot,
    trigger: GameMasterTriggerAssessment,
    plan: GameMasterPlan
  ): Promise<{
    runId: string;
    actionIds: string[];
  }> {
    const runId = await generateSnowflakeId();
    const now = new Date();

    await db.insert(gameMasterRuns).values({
      id: runId,
      gameDay: snapshot.gameDay,
      runType: trigger.runType,
      triggerType: trigger.triggerType,
        triggerData: trigger.triggerData as JsonValue,
      status: 'running',
      dailyObjective: plan.dailyObjective,
      worldSummary: plan.worldSummary,
      observationSummary: plan.observationSummary,
      planSummary: plan.planSummary,
      model: process.env.GAME_MASTER_MODEL ?? 'heuristic-v1',
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const actionIds: string[] = [];
    for (const plannedAction of plan.actions) {
      const assessment = gameMasterPolicyEngine.assess(plannedAction);
      const actionId = await generateSnowflakeId();
      actionIds.push(actionId);

      let targetIds: string[] = [];
      switch (plannedAction.actionType) {
        case 'INSTRUCT_ACTORS':
          targetIds = plannedAction.payload.actorIds;
          break;
        case 'INSTRUCT_ORGANIZATIONS':
          targetIds = plannedAction.payload.organizationIds;
          break;
        case 'SET_MARKET_NARRATIVE_BRIEF':
          targetIds = [
            ...plannedAction.payload.questionIds,
            ...plannedAction.payload.organizationIds,
          ];
          break;
        case 'SHIFT_RELATIONSHIP':
          targetIds = [
            plannedAction.payload.actorAId,
            plannedAction.payload.actorBId,
          ];
          break;
        default:
          targetIds = [];
      }

      const status = assessment.requiresApproval
        ? 'awaiting_approval'
        : 'queued';

      await db.insert(gameMasterActions).values({
        id: actionId,
        runId,
        actionType: plannedAction.actionType,
        authorityLevel: plannedAction.authorityLevel,
        riskLevel: assessment.riskLevel,
        targetType: plannedAction.targetType,
        targetIds,
        instructionText: plannedAction.instructionText,
        payload: plannedAction.payload,
        status,
        requiresApproval: assessment.requiresApproval,
        approvalReason: assessment.approvalReason,
        createdAt: now,
        updatedAt: now,
      });
    }

    await this.writeControlMessage(
      GAME_MASTER_CONTROL_CHAT_IDS.timeline,
      `${GAME_MASTER_NAME} ${trigger.runType} pass for day ${snapshot.gameDay}: ${plan.planSummary}`
    );

    return { runId, actionIds };
  }

  private async finalizeRun(runId: string, status: 'completed' | 'failed', error?: string): Promise<void> {
    const now = new Date();
    await db
      .update(gameMasterRuns)
      .set({
        status,
        completedAt: status === 'completed' ? now : null,
        failedAt: status === 'failed' ? now : null,
        error: error ?? null,
        updatedAt: now,
      })
      .where(eq(gameMasterRuns.id, runId));
  }

  private async maybeExecuteQueuedActions(actionIds: string[]): Promise<void> {
    if (!this.isAutoRunEnabled()) return;

    const pauseUntil = await this.getPauseUntil();
    if (pauseUntil && pauseUntil.getTime() > Date.now()) {
      return;
    }

    const hourlyBudget = await this.getHourlyAutoActionCount();
    let remainingBudget =
      GAME_MASTER_DEFAULTS.maxAutoActionsPerHour - hourlyBudget;
    if (remainingBudget <= 0) {
      return;
    }

    for (const actionId of actionIds) {
      const [action] = await db
        .select({
          id: gameMasterActions.id,
          status: gameMasterActions.status,
          requiresApproval: gameMasterActions.requiresApproval,
        })
        .from(gameMasterActions)
        .where(eq(gameMasterActions.id, actionId))
        .limit(1);

      if (!action || action.requiresApproval || action.status !== 'queued') {
        continue;
      }

      if (remainingBudget <= 0) {
        break;
      }

      await this.executeActionRecord(actionId);
      remainingBudget -= 1;
    }
  }

  async runScheduledPass(options?: {
    forcedRunType?: GameMasterRunType;
    triggerType?: string;
    triggerData?: Record<string, unknown>;
  }): Promise<{ runId: string | null; runType: GameMasterRunType | null; skipped?: string }> {
    if (!this.isEnabled()) {
      return { runId: null, runType: null, skipped: 'disabled' };
    }

    const processId = `game-master-${Date.now()}`;
    const acquired = await DistributedLockService.acquireLock({
      lockId: 'game-master-global',
      durationMs: 4 * 60 * 1000,
      operation: 'game-master-tick',
      processId,
    });

    if (!acquired) {
      return { runId: null, runType: null, skipped: 'locked' };
    }

    try {
      const snapshot = await this.buildSnapshot();
      if (!snapshot) {
        return { runId: null, runType: null, skipped: 'no_game' };
      }

      if (!snapshot.isRunning) {
        return { runId: null, runType: null, skipped: 'game_paused' };
      }

      const trigger =
        options?.forcedRunType
          ? {
              runType: options.forcedRunType,
              triggerType: options.triggerType ?? 'manual',
              triggerData: options.triggerData ?? {},
              shouldPlan: true,
            }
          : await this.assessTrigger(snapshot);

      if (!trigger.shouldPlan) {
        return { runId: null, runType: trigger.runType, skipped: 'no_plan' };
      }

      const plan = gameMasterPlanner.plan(snapshot, trigger);
      const { runId, actionIds } = await this.persistRun(snapshot, trigger, plan);
      await this.maybeExecuteQueuedActions(actionIds);
      await this.finalizeRun(runId, 'completed');
      await broadcastToChannel('admin:game-master', {
        type: 'game-master.run.completed',
        runId,
        runType: trigger.runType,
        gameDay: snapshot.gameDay,
      });
      return { runId, runType: trigger.runType };
    } catch (error) {
      logger.error(
        'Game Master pass failed',
        { error: error instanceof Error ? error.message : String(error) },
        'GameMasterService'
      );
      throw error;
    } finally {
      await DistributedLockService.releaseLock('game-master-global', processId);
    }
  }

  async listActiveDirectives(filter: GameMasterDirectiveFilter = {}) {
    const now = new Date();
    const conditions = [
      eq(gameMasterDirectives.isActive, true),
      or(
        isNull(gameMasterDirectives.expiresAt),
        gt(gameMasterDirectives.expiresAt, now)
      ),
    ];

    if (filter.directiveType) {
      conditions.push(eq(gameMasterDirectives.directiveType, filter.directiveType));
    }
    if (filter.targetType) {
      conditions.push(eq(gameMasterDirectives.targetType, filter.targetType));
    }
    if (filter.targetId) {
      conditions.push(eq(gameMasterDirectives.targetId, filter.targetId));
    }

    return db
      .select()
      .from(gameMasterDirectives)
      .where(and(...conditions))
      .orderBy(desc(gameMasterDirectives.createdAt));
  }

  async buildPromptOverlay(params: {
    directiveType: 'actor_instruction' | 'organization_instruction' | 'market_narrative';
    targetType: 'actor' | 'organization' | 'question';
    targetId: string;
  }): Promise<string> {
    const directives = await this.listActiveDirectives({
      directiveType: params.directiveType,
      targetType: params.targetType,
      targetId: params.targetId,
    });

    if (params.directiveType === 'market_narrative') {
      const globalDirectives = await this.listActiveDirectives({
        directiveType: 'market_narrative',
      });
      directives.push(
        ...globalDirectives.filter(
          (directive) =>
            directive.targetType !== params.targetType ||
            directive.targetId !== params.targetId
        )
      );
    }

    const lines = directives
      .map((directive) => directive.promptOverlay.trim())
      .filter(Boolean);

    if (lines.length === 0) return '';
    return [`=== GAME MASTER HALLIDAY ===`, ...lines.map((line) => `- ${line}`)].join('\n');
  }

  async listQueuedArticleBriefs() {
    return this.listActiveDirectives({
      directiveType: 'article_brief',
      targetType: 'system',
      targetId: 'articles',
    });
  }

  async approveAction(actionId: string, adminId: string): Promise<void> {
    const now = new Date();
    await db
      .update(gameMasterActions)
      .set({
        status: 'approved',
        approvedBy: adminId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(gameMasterActions.id, actionId));
    await this.executeActionRecord(actionId);
  }

  async rejectAction(actionId: string, adminId: string): Promise<void> {
    const now = new Date();
    await db
      .update(gameMasterActions)
      .set({
        status: 'rejected',
        rejectedBy: adminId,
        rejectedAt: now,
        updatedAt: now,
      })
      .where(eq(gameMasterActions.id, actionId));
  }

  async retryAction(actionId: string): Promise<void> {
    const now = new Date();
    await db
      .update(gameMasterActions)
      .set({
        status: 'queued',
        failedAt: null,
        error: null,
        updatedAt: now,
      })
      .where(eq(gameMasterActions.id, actionId));
    await this.executeActionRecord(actionId);
  }

  async getDashboard(): Promise<GameMasterDashboard> {
    const [
      game,
      latestRuns,
      pendingActions,
      activeDirectives,
      recentMessages,
      hourlyAutoActionCount,
      pauseUntil,
      autoRunActive,
    ] =
      await Promise.all([
        this.getCurrentGameState(),
        db
          .select({
            id: gameMasterRuns.id,
            gameDay: gameMasterRuns.gameDay,
            runType: gameMasterRuns.runType,
            status: gameMasterRuns.status,
            triggerType: gameMasterRuns.triggerType,
            planSummary: gameMasterRuns.planSummary,
            startedAt: gameMasterRuns.startedAt,
            completedAt: gameMasterRuns.completedAt,
          })
          .from(gameMasterRuns)
          .orderBy(desc(gameMasterRuns.startedAt))
          .limit(15),
        db
          .select({
            id: gameMasterActions.id,
            runId: gameMasterActions.runId,
            actionType: gameMasterActions.actionType,
            authorityLevel: gameMasterActions.authorityLevel,
            riskLevel: gameMasterActions.riskLevel,
            targetType: gameMasterActions.targetType,
            instructionText: gameMasterActions.instructionText,
            status: gameMasterActions.status,
            requiresApproval: gameMasterActions.requiresApproval,
            approvalReason: gameMasterActions.approvalReason,
            createdAt: gameMasterActions.createdAt,
          })
          .from(gameMasterActions)
          .where(
            inArray(gameMasterActions.status, [
              'queued',
              'awaiting_approval',
              'approved',
              'failed',
            ])
          )
          .orderBy(desc(gameMasterActions.createdAt))
          .limit(20),
        this.listActiveDirectives(),
        db
          .select({
            id: messages.id,
            chatId: messages.chatId,
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(
            inArray(messages.chatId, [
              GAME_MASTER_CONTROL_CHAT_IDS.timeline,
              GAME_MASTER_CONTROL_CHAT_IDS.actions,
            ])
          )
          .orderBy(desc(messages.createdAt))
          .limit(20),
        this.getHourlyAutoActionCount(),
        this.getPauseUntil(),
        this.isAutoRunActive(),
      ]);

    return {
      enabled: this.isEnabled(),
      autoRunEnabled: autoRunActive,
      autoRunPausedUntil: pauseUntil?.toISOString() ?? null,
      currentDay: game?.currentDay ?? null,
      latestRuns: latestRuns.map((run) => ({
        ...run,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
      })),
      pendingActions: pendingActions.map((action) => ({
        ...action,
        createdAt: action.createdAt.toISOString(),
      })),
      activeDirectives: activeDirectives.map((directive) => ({
        id: directive.id,
        directiveType: directive.directiveType,
        targetType: directive.targetType,
        targetId: directive.targetId,
        authorityLevel: directive.authorityLevel,
        promptOverlay: directive.promptOverlay,
        expiresAt: directive.expiresAt?.toISOString() ?? null,
      })),
      recentMessages: recentMessages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
      hourlyAutoActionCount,
    };
  }
}

export const gameMasterService = new GameMasterService();
