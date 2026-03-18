import { z } from 'zod';

export const gameMasterRunTypeSchema = z.enum(['daily', 'pulse', 'reactive']);
export type GameMasterRunType = z.infer<typeof gameMasterRunTypeSchema>;

export const gameMasterAuthoritySchema = z.enum([
  'suggest',
  'steer',
  'override',
]);
export type GameMasterAuthority = z.infer<typeof gameMasterAuthoritySchema>;

export const gameMasterRiskSchema = z.enum(['low', 'medium', 'high']);
export type GameMasterRisk = z.infer<typeof gameMasterRiskSchema>;

export const gameMasterTargetTypeSchema = z.enum([
  'actor',
  'organization',
  'question',
  'relationship',
  'world',
  'system',
]);
export type GameMasterTargetType = z.infer<typeof gameMasterTargetTypeSchema>;

const actorInstructionPayloadSchema = z.object({
  actorIds: z.array(z.string()).min(1),
  promptOverlay: z.string().min(1),
  reason: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

const organizationInstructionPayloadSchema = z.object({
  organizationIds: z.array(z.string()).min(1),
  promptOverlay: z.string().min(1),
  reason: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

const articleBriefPayloadSchema = z.object({
  targetOrgIds: z.array(z.string()).optional(),
  targetActorIds: z.array(z.string()).optional(),
  headlineAngle: z.string().min(1),
  brief: z.string().min(1),
  slant: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  expiresAt: z.string().datetime().optional(),
});

const dailyTopicPayloadSchema = z.object({
  topicKey: z.string().min(1),
  topicLabel: z.string().min(1),
  summary: z.string().min(1),
  selectionReason: z.string().min(1),
});

const worldEventPayloadSchema = z.object({
  eventType: z.string().min(1),
  description: z.string().min(1),
  actorIds: z.array(z.string()).default([]),
  visibility: z.enum(['public', 'private']).default('public'),
  relatedQuestion: z.number().int().positive().optional(),
});

const relationshipShiftPayloadSchema = z.object({
  actorAId: z.string().min(1),
  actorBId: z.string().min(1),
  sentimentDelta: z.number().min(-0.15).max(0.15),
  strengthDelta: z.number().min(-0.2).max(0.2),
  note: z.string().min(1),
});

const marketNarrativePayloadSchema = z.object({
  questionIds: z.array(z.string()).default([]),
  organizationIds: z.array(z.string()).default([]),
  brief: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  expiresAt: z.string().datetime().optional(),
});

export const gameMasterActionSchema = z.discriminatedUnion('actionType', [
  z.object({
    actionType: z.literal('SET_DAILY_TOPIC'),
    authorityLevel: gameMasterAuthoritySchema,
    targetType: z.literal('world'),
    instructionText: z.string().min(1),
    payload: dailyTopicPayloadSchema,
  }),
  z.object({
    actionType: z.literal('QUEUE_WORLD_EVENT'),
    authorityLevel: gameMasterAuthoritySchema,
    targetType: z.literal('world'),
    instructionText: z.string().min(1),
    payload: worldEventPayloadSchema,
  }),
  z.object({
    actionType: z.literal('INSTRUCT_ACTORS'),
    authorityLevel: gameMasterAuthoritySchema,
    targetType: z.literal('actor'),
    instructionText: z.string().min(1),
    payload: actorInstructionPayloadSchema,
  }),
  z.object({
    actionType: z.literal('INSTRUCT_ORGANIZATIONS'),
    authorityLevel: gameMasterAuthoritySchema,
    targetType: z.literal('organization'),
    instructionText: z.string().min(1),
    payload: organizationInstructionPayloadSchema,
  }),
  z.object({
    actionType: z.literal('QUEUE_ARTICLE_BRIEF'),
    authorityLevel: gameMasterAuthoritySchema,
    targetType: z.literal('system'),
    instructionText: z.string().min(1),
    payload: articleBriefPayloadSchema,
  }),
  z.object({
    actionType: z.literal('SHIFT_RELATIONSHIP'),
    authorityLevel: gameMasterAuthoritySchema,
    targetType: z.literal('relationship'),
    instructionText: z.string().min(1),
    payload: relationshipShiftPayloadSchema,
  }),
  z.object({
    actionType: z.literal('SET_MARKET_NARRATIVE_BRIEF'),
    authorityLevel: gameMasterAuthoritySchema,
    targetType: z.union([z.literal('question'), z.literal('organization')]),
    instructionText: z.string().min(1),
    payload: marketNarrativePayloadSchema,
  }),
]);

export type GameMasterPlannedAction = z.infer<typeof gameMasterActionSchema>;

export const gameMasterPlanSchema = z.object({
  dailyObjective: z.string().min(1),
  worldSummary: z.string().min(1),
  observationSummary: z.string().min(1),
  planSummary: z.string().min(1),
  actions: z.array(gameMasterActionSchema),
});

export type GameMasterPlan = z.infer<typeof gameMasterPlanSchema>;

export interface GameMasterWorldSnapshot {
  gameId: string;
  gameDay: number;
  isRunning: boolean;
  currentTopic: {
    topicKey: string;
    topicLabel: string;
    summary: string;
    isLocked: boolean;
  } | null;
  recentWorldEvents: Array<{
    id: string;
    eventType: string;
    description: string;
    actors: string[];
    relatedQuestion: number | null;
    timestamp: Date;
  }>;
  recentArticles: Array<{
    id: string;
    title: string | null;
    authorId: string;
    timestamp: Date;
    relatedQuestion: number | null;
  }>;
  recentOrganizationPosts: Array<{
    id: string;
    authorId: string;
    timestamp: Date;
  }>;
  recentRelationshipChanges: Array<{
    id: string;
    actor1Id: string;
    actor2Id: string;
    strength: number;
    sentiment: number;
    updatedAt: Date;
  }>;
  lastRunAt: Date | null;
  lastInterventionAt: Date | null;
  recentActionCount: number;
  /** Arc events scheduled within the next 48 game hours that have not yet fired. */
  upcomingArcEvents: Array<{
    questionId: string;
    questionNumber: number;
    currentArcState: string;
  }>;
}

export interface GameMasterTriggerAssessment {
  runType: GameMasterRunType;
  triggerType: string;
  triggerData: Record<string, unknown>;
  shouldPlan: boolean;
}

export interface GameMasterActionAssessment {
  riskLevel: GameMasterRisk;
  requiresApproval: boolean;
  approvalReason: string | null;
}

export interface GameMasterOverlayDirective {
  authorityLevel: GameMasterAuthority;
  promptOverlay: string;
}

export interface GameMasterOverlayResult {
  /** Full formatted block ready to inject into an LLM prompt, with authority labels embedded. Empty string when no active directives. */
  formatted: string;
  /** Structured directive list for callers that need to inspect authority levels programmatically. */
  directives: GameMasterOverlayDirective[];
}
