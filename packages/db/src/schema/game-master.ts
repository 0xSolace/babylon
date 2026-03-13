import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { JsonValue } from '../types';
import { users } from './users';

export const gameMasterRunTypeEnum = pgEnum('game_master_run_type', [
  'daily',
  'pulse',
  'reactive',
]);

export const gameMasterRunStatusEnum = pgEnum('game_master_run_status', [
  'running',
  'completed',
  'failed',
]);

export const gameMasterActionStatusEnum = pgEnum('game_master_action_status', [
  'queued',
  'awaiting_approval',
  'approved',
  'rejected',
  'executing',
  'executed',
  'failed',
]);

export const gameMasterAuthorityEnum = pgEnum('game_master_authority', [
  'suggest',
  'steer',
  'override',
]);

export const gameMasterRiskEnum = pgEnum('game_master_risk', [
  'low',
  'medium',
  'high',
]);

export const gameMasterTargetTypeEnum = pgEnum('game_master_target_type', [
  'actor',
  'organization',
  'question',
  'relationship',
  'world',
  'system',
]);

export const gameMasterDirectiveTypeEnum = pgEnum(
  'game_master_directive_type',
  [
    'actor_instruction',
    'organization_instruction',
    'article_brief',
    'market_narrative',
  ]
);

export const GAME_MASTER_ACTION_TYPES = [
  'SET_DAILY_TOPIC',
  'QUEUE_WORLD_EVENT',
  'INSTRUCT_ACTORS',
  'INSTRUCT_ORGANIZATIONS',
  'QUEUE_ARTICLE_BRIEF',
  'SHIFT_RELATIONSHIP',
  'SET_MARKET_NARRATIVE_BRIEF',
] as const;

export type GameMasterActionType = (typeof GAME_MASTER_ACTION_TYPES)[number];

export const gameMasterRuns = pgTable(
  'GameMasterRun',
  {
    id: text('id').primaryKey(),
    gameDay: integer('gameDay').notNull(),
    runType: gameMasterRunTypeEnum('runType').notNull(),
    triggerType: text('triggerType'),
    triggerData: jsonb('triggerData').$type<JsonValue>(),
    status: gameMasterRunStatusEnum('status').notNull().default('running'),
    dailyObjective: text('dailyObjective'),
    worldSummary: text('worldSummary'),
    observationSummary: text('observationSummary'),
    planSummary: text('planSummary'),
    model: text('model'),
    startedAt: timestamp('startedAt', { mode: 'date' }).notNull().defaultNow(),
    completedAt: timestamp('completedAt', { mode: 'date' }),
    failedAt: timestamp('failedAt', { mode: 'date' }),
    error: text('error'),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
  },
  (table) => [
    index('GameMasterRun_gameDay_runType_idx').on(table.gameDay, table.runType),
    index('GameMasterRun_status_startedAt_idx').on(
      table.status,
      table.startedAt
    ),
    index('GameMasterRun_createdAt_idx').on(table.createdAt),
  ]
);

export const gameMasterActions = pgTable(
  'GameMasterAction',
  {
    id: text('id').primaryKey(),
    runId: text('runId').notNull(),
    actionType: text('actionType').$type<GameMasterActionType>().notNull(),
    authorityLevel: gameMasterAuthorityEnum('authorityLevel').notNull(),
    riskLevel: gameMasterRiskEnum('riskLevel').notNull(),
    targetType: gameMasterTargetTypeEnum('targetType').notNull(),
    targetIds: jsonb('targetIds')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    instructionText: text('instructionText').notNull(),
    payload: jsonb('payload').$type<JsonValue>().notNull(),
    status: gameMasterActionStatusEnum('status').notNull().default('queued'),
    requiresApproval: boolean('requiresApproval').notNull().default(false),
    approvalReason: text('approvalReason'),
    approvedBy: text('approvedBy'),
    approvedAt: timestamp('approvedAt', { mode: 'date' }),
    rejectedBy: text('rejectedBy'),
    rejectedAt: timestamp('rejectedAt', { mode: 'date' }),
    executedAt: timestamp('executedAt', { mode: 'date' }),
    executionResult: jsonb('executionResult').$type<JsonValue>(),
    failedAt: timestamp('failedAt', { mode: 'date' }),
    error: text('error'),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
  },
  (table) => [
    index('GameMasterAction_runId_idx').on(table.runId),
    index('GameMasterAction_status_createdAt_idx').on(
      table.status,
      table.createdAt
    ),
    index('GameMasterAction_requiresApproval_status_idx').on(
      table.requiresApproval,
      table.status
    ),
    index('GameMasterAction_actionType_idx').on(table.actionType),
    index('GameMasterAction_targetType_idx').on(table.targetType),
  ]
);

export const gameMasterDirectives = pgTable(
  'GameMasterDirective',
  {
    id: text('id').primaryKey(),
    sourceActionId: text('sourceActionId').notNull(),
    directiveType: gameMasterDirectiveTypeEnum('directiveType').notNull(),
    targetType: gameMasterTargetTypeEnum('targetType').notNull(),
    targetId: text('targetId').notNull(),
    authorityLevel: gameMasterAuthorityEnum('authorityLevel').notNull(),
    promptOverlay: text('promptOverlay').notNull(),
    metadata: jsonb('metadata').$type<JsonValue>(),
    startsAt: timestamp('startsAt', { mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expiresAt', { mode: 'date' }),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
  },
  (table) => [
    index('GameMasterDirective_targetType_targetId_idx').on(
      table.targetType,
      table.targetId
    ),
    index('GameMasterDirective_isActive_expiresAt_idx').on(
      table.isActive,
      table.expiresAt
    ),
    index('GameMasterDirective_sourceActionId_idx').on(table.sourceActionId),
  ]
);

export const gameMasterRunsRelations = relations(
  gameMasterRuns,
  ({ many }) => ({
    actions: many(gameMasterActions),
  })
);

export const gameMasterActionsRelations = relations(
  gameMasterActions,
  ({ one, many }) => ({
    run: one(gameMasterRuns, {
      fields: [gameMasterActions.runId],
      references: [gameMasterRuns.id],
    }),
    approvedByUser: one(users, {
      fields: [gameMasterActions.approvedBy],
      references: [users.id],
      relationName: 'GameMasterAction_approvedBy',
    }),
    rejectedByUser: one(users, {
      fields: [gameMasterActions.rejectedBy],
      references: [users.id],
      relationName: 'GameMasterAction_rejectedBy',
    }),
    directives: many(gameMasterDirectives),
  })
);

export const gameMasterDirectivesRelations = relations(
  gameMasterDirectives,
  ({ one }) => ({
    sourceAction: one(gameMasterActions, {
      fields: [gameMasterDirectives.sourceActionId],
      references: [gameMasterActions.id],
    }),
  })
);

export type GameMasterRun = typeof gameMasterRuns.$inferSelect;
export type NewGameMasterRun = typeof gameMasterRuns.$inferInsert;
export type GameMasterAction = typeof gameMasterActions.$inferSelect;
export type NewGameMasterAction = typeof gameMasterActions.$inferInsert;
export type GameMasterDirective = typeof gameMasterDirectives.$inferSelect;
export type NewGameMasterDirective = typeof gameMasterDirectives.$inferInsert;
